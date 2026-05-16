import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Task } from '../types/Task';
import type { ReminderPreset } from '../types/settingsPreferences';
import type { ReminderTone } from '../constants/notificationTemplates';
import {
  isTaskFocused,
  getLiveFocusMs,
  calcFocusedReminderAt,
  getRankTier,
  getNotStartedIntervalMs,
} from '../utils/reminderCalculator';
import { pickReminderMessage, type ReminderType } from '../utils/reminderMessagePicker';
import { buildFancyReminderContextParts } from '../utils/fancyReminderTaskContext';
import {
  CHECK_INTERVAL_MS,
  GLOBAL_COOLDOWN_MS,
  POPUP_AUTO_DISMISS_REMINDER_MS,
  POPUP_AUTO_DISMISS_COMPLETION_MS,
  RECENT_MESSAGE_HISTORY,
  COOLDOWN_DELAY_MS,
  PRESET_MODIFIERS,
  isSilentPreset,
  getMaxDailyPerTask,
} from '../constants/reminderConfig';

// ─── Persisted state ──────────────────────────────────────────────────────────

// Bump the key so stale v1 data (with the combined recentMessageIds field)
// is ignored rather than partially parsed.
const STORAGE_KEY = '@sinceWhen/reminderState/v2';

type PersistedState = {
  dailyDate: string;
  perTaskDailyCounts: Record<string, number>;
  lastReminderShownAt: number | null;
  /** Recent message IDs for overdue / not-started reminders only. */
  recentReminderMessageIds: string[];
  /** Recent message IDs for completion events only (separate pool). */
  recentCompletionMessageIds: string[];
  lastNotStartedReminderAt: Record<string, number>;
};

const BLANK_STATE: PersistedState = {
  dailyDate: '',
  perTaskDailyCounts: {},
  lastReminderShownAt: null,
  recentReminderMessageIds: [],
  recentCompletionMessageIds: [],
  lastNotStartedReminderAt: {},
};

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function withDailyReset(state: PersistedState): PersistedState {
  const today = todayString();
  if (state.dailyDate === today) { return state; }
  return { ...state, dailyDate: today, perTaskDailyCounts: {} };
}

// ─── Public interface ─────────────────────────────────────────────────────────

export type SoloReminderEngine = {
  visible: boolean;
  emoji: string;
  message: string;
  contextTaskTitle: string;
  contextTimingLabel: string;
  /** True when the currently-visible modal is for a task completion (not an overdue reminder). */
  isCompletion: boolean;
  dismiss: () => void;
  notifyTaskCompleted: (task: Task) => void;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSoloReminderEngine(options: {
  activeTasks: Task[];
  enabled: boolean;
  /** Tone from user settings — controls which copy template is used. */
  tone: ReminderTone;
  /** Global reminder preset from user settings (per-task field overrides this). */
  globalReminderPreset: ReminderPreset;
  /**
   * When true, any pending pop-ups are suppressed but the engine keeps running.
   * Use when a blocking modal/sheet/overlay is open (e.g. time's up screen,
   * task edit sheet) to avoid stacking reminders on top of critical UI.
   */
  suppressPopups?: boolean;
}): SoloReminderEngine {
  const { activeTasks, enabled, tone, globalReminderPreset, suppressPopups = false } = options;

  const [visible, setVisible] = useState(false);
  const [emoji, setEmoji] = useState('🔥');
  const [message, setMessage] = useState('');
  const [contextTaskTitle, setContextTaskTitle] = useState('');
  const [contextTimingLabel, setContextTimingLabel] = useState('');
  const [isCompletion, setIsCompletion] = useState(false);

  const persistedRef = useRef<PersistedState>({ ...BLANK_STATE, dailyDate: todayString() });
  const loadedRef = useRef(false);

  // In-memory: focused reminder fires once per focus session per task
  const firedFocusedRef = useRef<Set<string>>(new Set());

  // Prev-value snapshots to detect focus changes → reset firedFocusedRef
  const prevTimerStartedAtRef = useRef<Record<string, number | null>>({});
  const prevPositionRef = useRef<Record<string, number>>({});
  const prevEstimatedMsRef = useRef<Record<string, number | null>>({});

  const visibleRef = useRef(false);
  useEffect(() => { visibleRef.current = visible; }, [visible]);

  const activeTasksRef = useRef<Task[]>(activeTasks);
  useEffect(() => { activeTasksRef.current = activeTasks; }, [activeTasks]);

  // Stable refs so setInterval callbacks always read the freshest values
  const toneRef = useRef(tone);
  useEffect(() => { toneRef.current = tone; }, [tone]);
  const globalPresetRef = useRef(globalReminderPreset);
  useEffect(() => { globalPresetRef.current = globalReminderPreset; }, [globalReminderPreset]);
  const suppressPopupsRef = useRef(suppressPopups);
  useEffect(() => { suppressPopupsRef.current = suppressPopups; }, [suppressPopups]);

  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load persisted state ────────────────────────────────────────────────────

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (raw) {
          try {
            persistedRef.current = withDailyReset(JSON.parse(raw) as PersistedState);
          } catch { /* start fresh */ }
        }
      })
      .catch(() => {})
      .finally(() => { loadedRef.current = true; });
  }, []);

  const persist = useCallback((state: PersistedState) => {
    persistedRef.current = state;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, []);

  // ── Detect focus/estimate/position changes → reset firedFocused ────────────

  useEffect(() => {
    for (const task of activeTasks) {
      const id = task.id;
      const timerChanged = prevTimerStartedAtRef.current[id] !== task.timerStartedAt;
      const posChanged = prevPositionRef.current[id] !== task.position;
      const estChanged = prevEstimatedMsRef.current[id] !== task.estimatedMs;
      if (timerChanged || posChanged || estChanged) {
        firedFocusedRef.current.delete(id);
      }
      prevTimerStartedAtRef.current[id] = task.timerStartedAt;
      prevPositionRef.current[id] = task.position;
      prevEstimatedMsRef.current[id] = task.estimatedMs;
    }
  }, [activeTasks]);

  // ── Show UI helper ──────────────────────────────────────────────────────────

  const showModal = useCallback((
    e: string, msg: string, title: string, timing: string, completion = false,
  ) => {
    if (autoDismissRef.current) { clearTimeout(autoDismissRef.current); }
    setEmoji(e);
    setMessage(msg);
    setContextTaskTitle(title);
    setContextTimingLabel(timing);
    setIsCompletion(completion);
    setVisible(true);
    // Completion pop-ups auto-dismiss quickly (just a cheer).
    // Overdue/reminder pop-ups stay up for 6 minutes so the user actually sees them.
    const dismissAfter = completion
      ? POPUP_AUTO_DISMISS_COMPLETION_MS
      : POPUP_AUTO_DISMISS_REMINDER_MS;
    autoDismissRef.current = setTimeout(() => setVisible(false), dismissAfter);
  }, []);

  // ── Resolve effective preset for one task ───────────────────────────────────

  function effectivePreset(task: Task): ReminderPreset {
    // Global override (silent/partnerOnly) beats per-task setting
    if (isSilentPreset(globalPresetRef.current)) { return globalPresetRef.current; }
    return task.reminderPreset ?? globalPresetRef.current;
  }

  function presetModifiers(preset: ReminderPreset) {
    if (preset === 'annoyMe') { return PRESET_MODIFIERS.annoyMe; }
    return PRESET_MODIFIERS.normal;
  }

  // ── Main polling check ──────────────────────────────────────────────────────

  const checkReminders = useCallback(() => {
    // Skip entirely if disabled, not yet loaded, a pop-up is already showing,
    // or a blocking UI (time's up, form sheet) is suppressing pop-ups.
    if (!enabled || !loadedRef.current || visibleRef.current || suppressPopupsRef.current) {
      return;
    }

    const nowMs = Date.now();
    let state = withDailyReset(persistedRef.current);
    const tasks = activeTasksRef.current;
    const cooldownActive =
      state.lastReminderShownAt !== null &&
      nowMs - state.lastReminderShownAt < GLOBAL_COOLDOWN_MS;

    // ── 1. Focused task reminders ───────────────────────────────────────────

    for (const task of tasks) {
      if (!isTaskFocused(task)) { continue; }

      const preset = effectivePreset(task);
      if (isSilentPreset(preset)) { continue; }
      if (firedFocusedRef.current.has(task.id)) { continue; }

      const taskCount = state.perTaskDailyCounts[task.id] ?? 0;
      if (taskCount >= getMaxDailyPerTask(preset)) { continue; }

      const mods = presetModifiers(preset);
      const rawReminderAt = calcFocusedReminderAt(task, nowMs);
      if (rawReminderAt === null) { continue; }
      // Apply preset modifier — scale the window between focus-start and raw reminder.
      // The 2-min-delay "already past" case stays as-is.
      const nearFutureMs = nowMs + 2 * 60 * 1000;
      const reminderAt = rawReminderAt === nearFutureMs
        ? rawReminderAt
        : task.timerStartedAt! + (rawReminderAt - task.timerStartedAt!) * mods.focusThresholdMult;

      if (nowMs < reminderAt) { continue; }
      if (cooldownActive) { persist(state); return; }

      firedFocusedRef.current.add(task.id);
      const picked = pickReminderMessage('overdue_focused', state.recentReminderMessageIds, toneRef.current);
      const parts = buildFancyReminderContextParts(task, { nowMs, queuePosition: task.position });

      state = {
        ...state,
        perTaskDailyCounts: { ...state.perTaskDailyCounts, [task.id]: taskCount + 1 },
        lastReminderShownAt: nowMs,
        recentReminderMessageIds: [picked.messageId, ...state.recentReminderMessageIds].slice(0, RECENT_MESSAGE_HISTORY),
      };
      persist(state);
      showModal(picked.emoji, picked.message, parts.taskTitleTruncated, parts.timingLabel);
      return;
    }

    // ── 2. Unfocused "not started" reminders ────────────────────────────────

    for (const task of tasks) {
      if (isTaskFocused(task)) { continue; }

      const preset = effectivePreset(task);
      if (isSilentPreset(preset)) { continue; }

      const taskCount = state.perTaskDailyCounts[task.id] ?? 0;
      if (taskCount >= getMaxDailyPerTask(preset)) { continue; }

      const mods = presetModifiers(preset);
      const tier = getRankTier(task.position);
      const baseInterval = getNotStartedIntervalMs(tier);
      const interval = Math.round(baseInterval * mods.notStartedIntervalMult);
      const lastAt = state.lastNotStartedReminderAt[task.id] ?? task.createdAt;
      const nextAt = lastAt + interval;

      if (nowMs < nextAt) { continue; }

      if (cooldownActive) {
        // Don't drop — push next reminder time forward instead
        state = {
          ...state,
          lastNotStartedReminderAt: {
            ...state.lastNotStartedReminderAt,
            [task.id]: nowMs + COOLDOWN_DELAY_MS - interval,
          },
        };
        continue;
      }

      const picked = pickReminderMessage('not_started', state.recentReminderMessageIds, toneRef.current);
      const parts = buildFancyReminderContextParts(task, { nowMs, queuePosition: task.position });

      state = {
        ...state,
        perTaskDailyCounts: { ...state.perTaskDailyCounts, [task.id]: taskCount + 1 },
        lastReminderShownAt: nowMs,
        lastNotStartedReminderAt: { ...state.lastNotStartedReminderAt, [task.id]: nowMs },
        recentReminderMessageIds: [picked.messageId, ...state.recentReminderMessageIds].slice(0, RECENT_MESSAGE_HISTORY),
      };
      persist(state);
      showModal(picked.emoji, picked.message, parts.taskTitleTruncated, parts.timingLabel);
      return;
    }

    if (state !== persistedRef.current) { persist(state); }
  // effectivePreset / presetModifiers are pure helpers reading only refs — safe to omit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, persist, showModal]);

  // ── Interval ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!enabled) { return; }
    const id = setInterval(checkReminders, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [enabled, checkReminders]);

  // ── Dismiss ─────────────────────────────────────────────────────────────────

  const dismiss = useCallback(() => {
    if (autoDismissRef.current) { clearTimeout(autoDismissRef.current); }
    setVisible(false);
  }, []);

  // ── Completion notification (bypasses cooldown; respects suppressPopups) ────

  const notifyTaskCompleted = useCallback(
    (task: Task) => {
      // Never show completion pop-up when a blocking screen is open
      if (suppressPopupsRef.current) { return; }
      // Respect global silent setting for completion messages too
      if (isSilentPreset(globalPresetRef.current)) { return; }

      const nowMs = Date.now();
      const liveFocusMs = getLiveFocusMs(task, nowMs);
      const type: ReminderType =
        task.estimatedMs !== null && liveFocusMs <= task.estimatedMs
          ? 'completed_on_time'
          : 'completed_late';

      const state = withDailyReset(persistedRef.current);
      const picked = pickReminderMessage(type, state.recentCompletionMessageIds, toneRef.current);
      const parts = buildFancyReminderContextParts(task, { nowMs, queuePosition: task.position });

      persist({
        ...state,
        recentCompletionMessageIds: [picked.messageId, ...state.recentCompletionMessageIds].slice(0, RECENT_MESSAGE_HISTORY),
      });

      showModal(picked.emoji, picked.message, parts.taskTitleTruncated, parts.timingLabel, true);
    },
    [persist, showModal],
  );

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (autoDismissRef.current) { clearTimeout(autoDismissRef.current); }
    };
  }, []);

  return { visible, emoji, message, contextTaskTitle, contextTimingLabel, isCompletion, dismiss, notifyTaskCompleted };
}
