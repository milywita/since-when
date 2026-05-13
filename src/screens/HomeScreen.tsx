import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import type { RenderItemParams } from 'react-native-draggable-flatlist';
import auth from '@react-native-firebase/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../components/ui/Screen';
import { useTheme, useThemeToggle } from '../theme/ThemeContext';
import type { AppTheme } from '../theme/themes';
import { EmptyState } from '../components/layout/EmptyState';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { TaskCard } from '../components/tasks/TaskCard';
import { useTasks } from '../hooks/useTasks';
import { useSessionHistory } from '../hooks/useSessionHistory';
import type { Task } from '../types/Task';
import type { SessionHistoryRecord } from '../types/Session';
import type { AppScreenProps } from '../navigation/types';
import { formatElapsed } from '../utils/formatElapsed';
import { subscribeToUserProfile, setActiveSession } from '../services/userService';
import { getSessionOnce } from '../services/sessionService';
import { useTaskEstimatePresets } from '../context/TaskEstimatePresetsContext';
import type { TaskEstimatePreset } from '../types/TaskEstimatePreset';
import { presetChipLabelFromMs, presetSpokenLabelFromMs } from '../utils/taskEstimatePresetLabel';
import {
  SETTINGS_DEFAULTS,
  type ReminderPreset,
  type TogetherVisibility,
} from '../types/settingsPreferences';

/** Full-screen modal host: same layout as `StyleSheet.absoluteFillObject` (RN typings often omit that alias). */

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Light theme only: Together banner + history session cards (dark uses theme tokens). */
const TOGETHER_LIGHT = {
  surface: '#ffffff',
  border: '#c4c9ef',
  divider: '#e6e9fb',
} as const;

/** Light: TOGETHER pill text — deeper indigo than default accent for readability on white. */
const TOGETHER_BADGE_TEXT_LIGHT = '#3730a3';

// ─── Queue task row ───────────────────────────────────────────────────────────

function formatAddedDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatSeconds(totalSec: number): string {
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) { return `${days}d ${hours}h ${mins}m`; }
  if (hours > 0) { return `${hours}h ${mins}m ${secs}s`; }
  if (mins > 0) { return `${mins}m ${secs}s`; }
  return `${secs}s`;
}

// ─── Task action sheet ────────────────────────────────────────────────────────

type TaskActionSheetProps = {
  task: Task | null;
  onClose: () => void;
  onEdit: () => void;
  onComplete: () => void;
  onDelete: () => void;
  c: AppTheme['colors'];
  s: S;
  insetBottom: number;
};

function TaskActionSheet({ task, onClose, onEdit, onComplete, onDelete, c, s, insetBottom }: TaskActionSheetProps) {
  if (!task) { return null; }

  function act(fn: () => void) {
    onClose();
    setTimeout(fn, 120);
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.popupHost}>
        <TouchableOpacity style={s.popupBackdrop} activeOpacity={1} onPress={onClose} />
        <View
          style={[
            s.popupCard,
            s.actionSheet,
            { marginBottom: insetBottom + 100, backgroundColor: c.surfaceRaised, borderColor: c.border },
          ]}>
          {/* title */}
          <Text style={[s.actionSheetTitle, { color: c.textMuted }]} numberOfLines={2}>{task.title}</Text>
          <View style={[s.actionSheetDivider, { backgroundColor: c.border }]} />

          <TouchableOpacity style={s.actionSheetRow} onPress={() => act(onEdit)}>
            <Text style={[s.actionSheetRowText, { color: c.text }]}>Edit task</Text>
          </TouchableOpacity>
          <View style={[s.actionSheetDivider, { backgroundColor: c.borderInner }]} />

          <TouchableOpacity style={s.actionSheetRow} onPress={() => act(onComplete)}>
            <Text style={[s.actionSheetRowText, { color: c.success }]}>Mark as done</Text>
          </TouchableOpacity>
          <View style={[s.actionSheetDivider, { backgroundColor: c.borderInner }]} />

          <TouchableOpacity style={s.actionSheetRow} onPress={() => act(onDelete)}>
            <Text style={[s.actionSheetRowText, { color: c.danger }]}>Delete task</Text>
          </TouchableOpacity>
          <View style={[s.actionSheetDivider, { backgroundColor: c.border }]} />

          <TouchableOpacity style={s.actionSheetRow} onPress={onClose}>
            <Text style={[s.actionSheetRowText, { color: c.textMuted }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Queue task row ───────────────────────────────────────────────────────────

type QueueTaskRowProps = {
  task: Task;
  position: number;
  now: number;
  onComplete: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onLongPress: () => void;
  onTogglePin: () => void;
  drag: () => void;
  isActive: boolean;
  c: AppTheme['colors'];
  s: S;
  isDark: boolean;
};

function QueueTaskRow({ task, position, now, onComplete, onDelete, onEdit, onLongPress, onTogglePin, drag, isActive, c, s, isDark }: QueueTaskRowProps) {
  const isFirst = position === 1;
  const isTimerRunning = isFirst || task.isPinned;

  const liveSeconds = isTimerRunning
    ? (task.accumulatedSeconds ?? 0) +
      (task.timerStartedAt !== null ? Math.max(0, Math.floor((now - task.timerStartedAt) / 1000)) : 0)
    : (task.accumulatedSeconds ?? 0);

  const hasFocusTime = liveSeconds > 0;
  const estimatedSec = task.estimatedMs !== null ? task.estimatedMs / 1000 : null;
  const isOverEstimate = estimatedSec !== null && liveSeconds > estimatedSec;

  return (
    <View
      style={[
        s.queueRow,
        {
          backgroundColor: isActive ? c.surfaceRaised : c.surface,
          borderColor: isFirst ? c.accent : task.isPinned ? c.accentLight : c.border,
          borderWidth: isFirst || task.isPinned ? 1.5 : 1,
          opacity: isActive ? 0.95 : 1,
        },
      ]}>
      {/* drag handle */}
      <TouchableOpacity onPressIn={drag} style={s.dragHandle} hitSlop={8}>
        <Text style={[s.dragHandleText, { color: c.textDim }]}>⠿</Text>
      </TouchableOpacity>

      {/* position badge — tapping toggles pin on non-#1 tasks */}
      <TouchableOpacity
        style={[
          s.queueBadge,
          { backgroundColor: isFirst ? c.accent : task.isPinned ? c.accentSurface : (isDark ? c.surfaceInset : c.surfaceSoft) },
        ]}
        onPress={isFirst ? undefined : onTogglePin}
        activeOpacity={isFirst ? 1 : 0.6}
        hitSlop={6}>
        <Text style={[s.queueBadgeText, { color: isFirst ? c.onAccent : task.isPinned ? c.accentLight : c.textMuted }]}>
          {position}
        </Text>
      </TouchableOpacity>

      {/* content — long press opens action sheet */}
      <TouchableOpacity style={s.queueContent} onLongPress={onLongPress} activeOpacity={1}>
        <Text style={[s.queueTitle, { color: c.text }]} numberOfLines={2}>
          {task.title}
        </Text>

        {isTimerRunning ? (
          <View style={s.queueTimerRow}>
            <Text
              style={[s.queueTimer, { color: isOverEstimate ? c.danger : isFirst ? c.accent : c.accentLight }]}
              numberOfLines={1}>
              {formatSeconds(liveSeconds)}
            </Text>
            {estimatedSec !== null && (
              <Text style={[s.queueEstimate, { color: isOverEstimate ? c.dangerMuted : c.textSoft }]}>
                {isOverEstimate
                  ? `over by ${formatSeconds(liveSeconds - estimatedSec)}`
                  : `est. ${formatSeconds(estimatedSec)}`}
              </Text>
            )}
          </View>
        ) : hasFocusTime ? (
          <View style={s.queueTimerRow}>
            <Text style={[s.queueTimer, { color: c.textMuted }]} numberOfLines={1}>
              {formatSeconds(liveSeconds)}
            </Text>
            {estimatedSec !== null && (
              <Text style={[s.queueEstimate, { color: isOverEstimate ? c.dangerMuted : c.textSoft }]}>
                {isOverEstimate
                  ? `over by ${formatSeconds(liveSeconds - estimatedSec)}`
                  : `est. ${formatSeconds(estimatedSec)}`}
              </Text>
            )}
          </View>
        ) : (
          <View style={s.queueTimerRow}>
            <Text style={[s.queueMeta, { color: c.textMuted }]}>
              Added {formatAddedDate(task.createdAt)}
            </Text>
            {estimatedSec !== null && (
              <Text style={[s.queueEstimate, { color: c.textSoft }]}>
                est. {formatSeconds(estimatedSec)}
              </Text>
            )}
          </View>
        )}
      </TouchableOpacity>

      {/* done button */}
      <TouchableOpacity
        style={[s.queueDoneBtn, { borderColor: c.border }]}
        onPress={onComplete}
        hitSlop={12}>
        <Text style={[s.queueDoneBtnText, { color: c.textMuted }]}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Completed task row ───────────────────────────────────────────────────────

type S = ReturnType<typeof buildStyles>;

type CompletedRowProps = { task: Task; c: AppTheme['colors']; s: S };

function CompletedRow({ task, c, s }: CompletedRowProps) {
  const completedAt = task.completedAt ?? 0;
  // Use actual focus time (accumulatedSeconds); fall back to wall-clock for legacy tasks
  // that were completed before the timer system was added.
  const focusMs = (task.accumulatedSeconds ?? 0) > 0
    ? (task.accumulatedSeconds ?? 0) * 1000
    : completedAt - task.createdAt;
  const beatEstimate = task.estimatedMs !== null && focusMs <= task.estimatedMs;
  return (
    <View style={s.completedRow}>
      <View style={s.completedLeft}>
        <View style={s.soloModeBadge}>
          <Text style={[s.soloModeBadgeText, { color: c.textDim }]}>SOLO</Text>
        </View>
        <Text style={[s.completedTitle, { color: c.textSoft }]} numberOfLines={1}>{task.title}</Text>
      </View>
      <View style={s.completedRight}>
        <Text style={[s.completedTime, { color: c.textSoft }]}>{formatTime(completedAt)}</Text>
        <Text style={[s.completedDuration, { color: c.textDim }]}>{formatElapsed(focusMs)}</Text>
        {task.estimatedMs !== null && (
          <Text style={[s.completedEstLabel, { color: beatEstimate ? c.success : c.dangerMuted }]}>
            {beatEstimate ? 'on time' : 'late'}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Together session history card ───────────────────────────────────────────

function formatTime(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m} ${ampm}`;
}

type TogetherHistoryCardProps = {
  record: SessionHistoryRecord;
  c: AppTheme['colors'];
  s: S;
  isDark: boolean;
};

function TogetherHistoryCard({ record, c, s, isDark }: TogetherHistoryCardProps) {
  const [expanded, setExpanded] = useState(false);

  const myCompleted = record.myTasks.filter(t => t.completedAt !== null);
  const myIncomplete = record.myTasks.filter(t => t.completedAt === null);
  const partnerNames = record.partners.map(p => p.displayName).join(', ');
  const sessionDurationMs = record.endedAt - record.startedAt;
  const hasAnyTasks = record.myTasks.length > 0 || record.partners.some(p => p.tasks.length > 0);

  function formatSessionDuration(ms: number): string {
    const mins = Math.floor(ms / 60000);
    if (mins < 60) { return `${mins}m`; }
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  return (
    <TouchableOpacity
      style={s.togetherCard}
      onPress={hasAnyTasks ? () => setExpanded(e => !e) : undefined}
      activeOpacity={hasAnyTasks ? 0.85 : 1}>
      <View style={s.togetherCardHeader}>
        <View style={s.togetherCardLeft}>
          <View style={s.togetherCardBadge}>
            <Text
              style={[
                s.togetherCardBadgeText,
                { color: isDark ? c.accent : TOGETHER_BADGE_TEXT_LIGHT },
              ]}>
              TOGETHER
            </Text>
          </View>
          <Text style={[s.togetherCardPartner, { color: c.text }]} numberOfLines={1}>
            with {partnerNames || 'no partner'}
          </Text>
        </View>
        <View style={s.togetherCardRight}>
          <Text style={[s.togetherCardTime, { color: c.textSoft }]}>{formatTime(record.startedAt)}</Text>
          <Text style={[s.togetherCardDuration, { color: c.textDim }]}>{formatSessionDuration(sessionDurationMs)}</Text>
        </View>
      </View>

      <Text style={[s.togetherCardSummary, { color: isDark ? c.textSoft : c.textMuted }]}>
        {myCompleted.length > 0
          ? `${myCompleted.length} of ${record.myTasks.length} task${record.myTasks.length !== 1 ? 's' : ''} completed`
          : record.myTasks.length > 0
            ? `${record.myTasks.length} task${record.myTasks.length !== 1 ? 's' : ''} — none completed`
            : 'No tasks'}
        {myIncomplete.length > 0 ? ` · ${myIncomplete.length} back in Solo` : ''}
      </Text>

      {expanded && (
        <View style={s.togetherCardBody}>
          {record.myTasks.length > 0 && (
            <View style={s.togetherSection}>
              <Text style={[s.togetherSectionLabel, { color: c.accent }]}>Your tasks</Text>
              {record.myTasks.map(task => {
                const isDone = task.completedAt !== null;
                const duration = isDone ? (task.completedAt! - task.createdAt) : null;
                const reactionsForTask = record.reactionsReceived.filter(r => r.taskId === task.taskId);
                return (
                  <View key={task.taskId} style={s.togetherTaskRow}>
                    <Text style={[
                      s.togetherTaskMark,
                      { color: isDone ? c.success : c.textDim },
                    ]}>
                      {isDone ? '✓' : '○'}
                    </Text>
                    <View style={s.togetherTaskInfo}>
                      <Text
                        style={[
                          s.togetherTaskTitle,
                          {
                            color: isDone
                              ? (isDark ? c.accentMuted : c.textMuted)
                              : (isDark ? c.textDim : c.text),
                          },
                        ]}
                        numberOfLines={2}>
                        {task.title}
                      </Text>
                      {isDone && duration !== null && (
                        <Text style={[s.togetherTaskDuration, { color: c.textSoft }]}>
                          {formatElapsed(duration)}
                        </Text>
                      )}
                      {!isDone && (
                        <Text style={[s.togetherTaskSolo, { color: c.textDim }]}>moved to Solo</Text>
                      )}
                      {reactionsForTask.length > 0 && (
                        <View style={s.togetherReactionList}>
                          {reactionsForTask.map(r => (
                            <Text key={r.id} style={[s.togetherReactionBubble, { color: c.accentLight }]}>
                              "{r.text}"
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {record.partners.map(partner => (
            <View key={partner.userId} style={s.togetherSection}>
              <Text style={[s.togetherSectionLabel, { color: c.accent }]}>{partner.displayName}'s tasks</Text>
              {partner.tasks.length === 0 && (
                <Text style={[s.togetherEmptyPartner, { color: c.textFaint }]}>No tasks added.</Text>
              )}
              {partner.tasks.map(task => {
                const isDone = task.completedAt !== null;
                const duration = isDone ? (task.completedAt! - task.createdAt) : null;
                return (
                  <View key={task.taskId} style={s.togetherTaskRow}>
                    <Text style={[s.togetherTaskMark, { color: isDone ? c.success : c.textDim }]}>
                      {isDone ? '✓' : '○'}
                    </Text>
                    <View style={s.togetherTaskInfo}>
                      <Text
                        style={[
                          s.togetherTaskTitle,
                          {
                            color: isDone
                              ? (isDark ? c.accentMuted : c.textMuted)
                              : (isDark ? c.textDim : c.text),
                          },
                        ]}
                        numberOfLines={2}>
                        {task.title}
                      </Text>
                      {isDone && duration !== null && (
                        <Text style={[s.togetherTaskDuration, { color: c.textSoft }]}>
                          {formatElapsed(duration)}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      )}

      {hasAnyTasks && (
        <Text style={[s.togetherCardChevron, { color: isDark ? c.textFaint : c.accent }]}>
          {expanded ? '▲' : '▼'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ─── History grouping helpers ─────────────────────────────────────────────────

type HistoryDayItem =
  | { kind: 'soloTask'; task: Task }
  | { kind: 'togetherSession'; record: SessionHistoryRecord };

type HistoryDaySection = {
  dateKey: string;
  dateLabel: string;
  data: HistoryDayItem[];
};

function getDayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) { return 'Today'; }
  if (sameDay(d, yesterday)) { return 'Yesterday'; }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildHistorySections(
  completedTasks: Task[],
  sessionHistory: SessionHistoryRecord[],
): HistoryDaySection[] {
  const buckets = new Map<string, { label: string; ts: number; items: HistoryDayItem[] }>();
  const todayKey = getDayKey(Date.now());
  buckets.set(todayKey, { label: 'Today', ts: Date.now(), items: [] });

  const ensureBucket = (ts: number) => {
    const key = getDayKey(ts);
    if (!buckets.has(key)) {
      buckets.set(key, { label: getDayLabel(ts), ts, items: [] });
    }
    return buckets.get(key)!;
  };

  for (const task of completedTasks) {
    if (task.sessionId || task.completedInSessionId) { continue; }
    const ts = task.completedAt ?? task.createdAt;
    ensureBucket(ts).items.push({ kind: 'soloTask', task });
  }

  for (const record of sessionHistory) {
    ensureBucket(record.endedAt).items.push({ kind: 'togetherSession', record });
  }

  return Array.from(buckets.entries())
    .sort(([, a], [, b]) => b.ts - a.ts)
    .map(([key, bucket]) => ({
      dateKey: key,
      dateLabel: bucket.label,
      data: bucket.items.sort((a, b) => {
        const tsA = a.kind === 'soloTask'
          ? (a.task.completedAt ?? a.task.createdAt)
          : a.record.endedAt;
        const tsB = b.kind === 'soloTask'
          ? (b.task.completedAt ?? b.task.createdAt)
          : b.record.endedAt;
        return tsB - tsA;
      }),
    }));
}

// ─── Add task modal ───────────────────────────────────────────────────────────

type AddTaskModalProps = {
  visible: boolean;
  onClose: () => void;
  onAdd: (title: string, estimatedMs: number | null) => Promise<void>;
  timePresets: TaskEstimatePreset[];
  c: AppTheme['colors'];
  s: S;
};

const REMINDER_PRESET_OPTIONS: { id: ReminderPreset; label: string }[] = [
  { id: 'silent', label: 'Silent' },
  { id: 'normal', label: 'Normal' },
  { id: 'annoyMe', label: 'Annoy Me' },
  { id: 'partnerOnly', label: 'Partner Only' },
];

const TOGETHER_VISIBILITY_OPTIONS: { id: TogetherVisibility; label: string }[] = [
  { id: 'visible', label: 'Visible in Together' },
  { id: 'hidden', label: 'Hidden in Together' },
];

function VisibilityEyeIcon({ color, crossed }: { color: string; crossed: boolean }) {
  return (
    <View style={visibilityIconStyles.wrap}>
      <View style={[visibilityIconStyles.eyeOutline, { borderColor: color }]} />
      <View style={[visibilityIconStyles.pupil, { backgroundColor: color }]} />
      {crossed ? (
        <View
          style={[
            visibilityIconStyles.crossLine,
            { backgroundColor: color, transform: [{ rotate: '-28deg' }] },
          ]}
        />
      ) : null}
    </View>
  );
}

function stashAdvancedDraftForLater(draft: {
  reminderPreset: ReminderPreset;
  reminderPresetOverride: ReminderPreset | null;
  togetherVisibility: TogetherVisibility;
  togetherVisibilityOverride: TogetherVisibility | null;
}) {
  // TODO: Persist advanced task draft fields with task creation payload once task schema/backing service are ready.
  // TODO: Keep this centralized so task creation and edit flows share the same override mapping behavior.
  // TODO: Add taskType/category field later for database, statistics, and task-type-based reminder behavior.
  return draft;
}

function AddTaskModal({ visible, onClose, onAdd, timePresets, c, s }: AddTaskModalProps) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [selectedMs, setSelectedMs] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [reminderPresetOverride, setReminderPresetOverride] = useState<ReminderPreset | null>(null);
  const [togetherVisibilityOverride, setTogetherVisibilityOverride] = useState<TogetherVisibility | null>(null);
  const selectedReminderPreset = reminderPresetOverride ?? SETTINGS_DEFAULTS.reminderPreset;
  const selectedTogetherVisibility = togetherVisibilityOverride ?? SETTINGS_DEFAULTS.togetherVisibility;

  function resetDraft() {
    setText('');
    setSelectedMs(null);
    setAdvancedOpen(false);
    setReminderPresetOverride(null);
    setTogetherVisibilityOverride(null);
  }

  async function handleAdd() {
    const trimmed = text.trim();
    if (!trimmed) { return; }
    const taskCreationAdvancedDraft = {
      reminderPreset: selectedReminderPreset,
      reminderPresetOverride,
      togetherVisibility: selectedTogetherVisibility,
      togetherVisibilityOverride,
    };
    stashAdvancedDraftForLater(taskCreationAdvancedDraft);
    // TODO: Use `taskCreationAdvancedDraft.reminderPreset` to drive per-task reminder scheduling when notifications ship.
    // TODO: Enforce `taskCreationAdvancedDraft.togetherVisibility` in Together mode permissions/filtering once backend support is added.
    setSaving(true);
    try {
      await onAdd(trimmed, selectedMs);
      resetDraft();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    resetDraft();
    onClose();
  }

  const cardBottom = insets.bottom + 100;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={s.popupHost}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={s.popupBackdrop} activeOpacity={1} onPress={handleClose} />
        <View style={[s.popupCard, { marginBottom: cardBottom, backgroundColor: c.surfaceRaised, borderColor: c.border }]}>
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.popupScroll}>
            <Text style={[s.popupTitle, { color: c.text }]}>What have you been avoiding?</Text>
            <TextInput
              style={s.modalInput}
              placeholder="e.g. Reply to that email"
              placeholderTextColor={c.textSoft}
              value={text}
              onChangeText={setText}
              autoFocus
              multiline
              maxLength={120}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={handleAdd}
            />
            <Text style={[s.estimateLabel, { color: c.textSoft }]}>How long will it actually take?</Text>
            <View style={s.presetRow}>
              {timePresets.map((p, idx) => (
                <TouchableOpacity
                  key={`${idx}-${p.ms}`}
                  style={[s.presetChip, selectedMs === p.ms && s.presetChipSelected]}
                  onPress={() => setSelectedMs(prev => prev === p.ms ? null : p.ms)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedMs === p.ms }}
                  accessibilityLabel={presetSpokenLabelFromMs(p.ms)}>
                  <Text style={[s.presetChipText, selectedMs === p.ms && s.presetChipTextSelected]}>
                    {presetChipLabelFromMs(p.ms)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={s.advancedToggleRow}
              onPress={() => setAdvancedOpen(prev => !prev)}
              accessibilityRole="button"
              accessibilityState={{ expanded: advancedOpen }}>
              <Text style={[s.advancedToggleLabel, { color: c.textSoft }]}>Advanced options</Text>
              <Text style={[s.advancedToggleChevron, { color: c.textDim }]}>
                {advancedOpen ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>
            {advancedOpen && (
              <View style={s.advancedCard}>
                <Text style={[s.advancedGroupTitle, { color: c.textSoft }]}>Reminder preset</Text>
                <View style={s.advancedChipRow}>
                  {REMINDER_PRESET_OPTIONS.map(opt => (
                    <TouchableOpacity
                      key={opt.id}
                      style={[s.advancedChip, selectedReminderPreset === opt.id && s.advancedChipSelected]}
                      onPress={() => setReminderPresetOverride(opt.id)}>
                      <Text
                        style={[
                          s.advancedChipText,
                          { color: selectedReminderPreset === opt.id ? c.primaryText : c.textMuted },
                        ]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[s.advancedGroupTitle, { color: c.textSoft }]}>Together Mode visibility</Text>
                <View style={s.advancedChipRow}>
                  {TOGETHER_VISIBILITY_OPTIONS.map(opt => (
                    <TouchableOpacity
                      key={opt.id}
                      style={[s.advancedChip, selectedTogetherVisibility === opt.id && s.advancedChipSelected]}
                      onPress={() => setTogetherVisibilityOverride(opt.id)}>
                      <View style={s.advancedChipContent}>
                        <VisibilityEyeIcon
                          color={selectedTogetherVisibility === opt.id ? c.primaryText : c.textMuted}
                          crossed={opt.id === 'hidden'}
                        />
                        <Text
                          style={[
                            s.advancedChipText,
                            { color: selectedTogetherVisibility === opt.id ? c.primaryText : c.textMuted },
                          ]}>
                          {opt.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            <TouchableOpacity
              style={[s.modalAddBtn, !text.trim() && s.modalAddBtnDisabled]}
              onPress={handleAdd}
              disabled={!text.trim() || saving}>
              {saving
                ? <ActivityIndicator color={c.primaryText} />
                : <Text style={[s.modalAddBtnText, { color: c.primaryText }]}>Start the clock</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Edit task modal ──────────────────────────────────────────────────────────

type EditTaskModalProps = {
  task: Task | null;
  onClose: () => void;
  onSave: (taskId: string, title: string, estimatedMs: number | null) => Promise<void>;
  timePresets: TaskEstimatePreset[];
  c: AppTheme['colors'];
  s: S;
};

function EditTaskModal({ task, onClose, onSave, timePresets, c, s }: EditTaskModalProps) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [selectedMs, setSelectedMs] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setText(task.title);
      setSelectedMs(task.estimatedMs);
    }
  }, [task]);

  async function handleSave() {
    const trimmed = text.trim();
    if (!trimmed || !task) { return; }
    setSaving(true);
    try {
      await onSave(task.id, trimmed, selectedMs);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const cardBottom = insets.bottom + 100;

  return (
    <Modal visible={task !== null} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={s.popupHost}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={s.popupBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={[s.popupCard, { marginBottom: cardBottom, backgroundColor: c.surfaceRaised, borderColor: c.border }]}>
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.popupScroll}>
            <Text style={[s.popupTitle, { color: c.text }]}>Edit task</Text>
            <TextInput
              style={s.modalInput}
              placeholderTextColor={c.textSoft}
              value={text}
              onChangeText={setText}
              autoFocus
              multiline
              maxLength={120}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={handleSave}
            />
            <Text style={[s.estimateLabel, { color: c.textSoft }]}>How long will it actually take?</Text>
            <View style={s.presetRow}>
              {timePresets.map((p, idx) => (
                <TouchableOpacity
                  key={`${idx}-${p.ms}`}
                  style={[s.presetChip, selectedMs === p.ms && s.presetChipSelected]}
                  onPress={() => setSelectedMs(prev => prev === p.ms ? null : p.ms)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedMs === p.ms }}
                  accessibilityLabel={presetSpokenLabelFromMs(p.ms)}>
                  <Text style={[s.presetChipText, selectedMs === p.ms && s.presetChipTextSelected]}>
                    {presetChipLabelFromMs(p.ms)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[s.modalAddBtn, !text.trim() && s.modalAddBtnDisabled]}
              onPress={handleSave}
              disabled={!text.trim() || saving}>
              {saving
                ? <ActivityIndicator color={c.primaryText} />
                : <Text style={[s.modalAddBtnText, { color: c.primaryText }]}>Save changes</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Flash banner ─────────────────────────────────────────────────────────────

function useDoneFlash() {
  const opacity = useRef(new Animated.Value(0)).current;
  const [message, setMessage] = useState('');

  const flash = useCallback((msg: string) => {
    setMessage(msg);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [opacity]);

  return { opacity, message, flash };
}

// ─── Main screen ──────────────────────────────────────────────────────────────

type ActiveTab = 'active' | 'history';
type Props = AppScreenProps<'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const thm = useTheme();
  const { colors: c } = thm;
  const { isDark, toggleTheme } = useThemeToggle();
  const s = useMemo(() => buildStyles(thm, isDark), [thm, isDark]);
  const { presets: timePresets } = useTaskEstimatePresets();
  const insets = useSafeAreaInsets();

  const { activeTasks, completedTasks, loading, error, addTask, completeTask, deleteTask, updateTask, reorderTasks, pinTask, unpinTask } = useTasks();
  const { sessionHistory, loading: historyLoading } = useSessionHistory();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [actionSheetTask, setActionSheetTask] = useState<Task | null>(null);
  const [tab, setTab] = useState<ActiveTab>('active');
  const now = useNow();
  const { opacity: flashOpacity, message: flashMessage, flash } = useDoneFlash();

  const [rejoinSessionId, setRejoinSessionId] = useState<string | null>(null);

  useEffect(() => {
    const uid = auth().currentUser?.uid;
    if (!uid) { return; }
    const unsub = subscribeToUserProfile(uid, async profile => {
      const sid = profile.activeSessionId;
      if (!sid) {
        setRejoinSessionId(null);
        return;
      }
      try {
        const session = await getSessionOnce(sid);
        if (session?.status === 'active') {
          setRejoinSessionId(sid);
        } else {
          setRejoinSessionId(null);
          await setActiveSession(uid, null);
        }
      } catch {
        setRejoinSessionId(null);
      }
    });
    return unsub;
  }, []);

  const historySections = useMemo(
    () => buildHistorySections(completedTasks, sessionHistory),
    [completedTasks, sessionHistory],
  );

  const [historyDayIndex, setHistoryDayIndex] = useState(0);

  const prevTabRef = useRef(tab);
  useEffect(() => {
    if (tab === 'history' && prevTabRef.current !== 'history') {
      setHistoryDayIndex(0);
    }
    prevTabRef.current = tab;
  }, [tab]);

  useEffect(() => {
    setHistoryDayIndex(0);
  }, [historySections.length]);

  async function handleComplete(task: Task) {
    const remaining = activeTasks.filter(t => t.id !== task.id);
    await completeTask(task, remaining);
    // Calculate focus time: snapshot accumulated + any live session time
    const liveSecs = task.timerStartedAt !== null
      ? Math.floor((Date.now() - task.timerStartedAt) / 1000)
      : 0;
    const focusSecs = (task.accumulatedSeconds ?? 0) + liveSecs;
    const focusMs = focusSecs > 0 ? focusSecs * 1000 : Date.now() - task.createdAt;
    flash(`You did it. It took ${formatElapsed(focusMs)} but you did it.`);
  }

  async function handleDelete(task: Task) {
    const remaining = activeTasks.filter(t => t.id !== task.id);
    await deleteTask(task, remaining);
  }

  async function handleTogglePin(task: Task) {
    if (task.isPinned) {
      await unpinTask(task);
    } else {
      await pinTask(task);
    }
  }

  async function handleEdit(taskId: string, title: string, estimatedMs: number | null) {
    await updateTask(taskId, { title, estimatedMs });
  }

  if (loading) {
    return (
      <Screen>
        <View style={s.loadingRoot}>
          <ActivityIndicator size="large" color={c.text} />
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <View style={s.loadingRoot}>
          <Text style={[s.errorText, { color: c.danger }]}>Firestore error:</Text>
          <Text style={[s.errorDetail, { color: c.textMuted }]}>{error}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen safeArea edges={['top']}>
      {/* ── Flash banner ─────────────────────────────── */}
      <Animated.View style={[s.flashBanner, { opacity: flashOpacity }]} pointerEvents="none">
        <Text style={[s.flashText, { color: c.text }]}>{flashMessage}</Text>
      </Animated.View>

      {/* ── Header ───────────────────────────────────── */}
      <ScreenHeader
        title="Since When"
        badge={{ text: 'SOLO', variant: 'muted' }}
        trailing={
          <View style={s.headerActions}>
            <TouchableOpacity style={s.themeToggleBtn} onPress={toggleTheme}>
              {isDark
                ? <SunIcon color={c.accentMuted} />
                : <MoonIcon color={c.accent} bgColor={c.background} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={s.settingsIconBtn}
              onPress={() => navigation.navigate('Settings')}
              accessibilityRole="button"
              accessibilityLabel="Open settings">
              <Text
                style={[
                  s.settingsIcon,
                  { color: isDark ? c.accentMuted : c.accent },
                ]}>
                ⚙
              </Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* ── Rejoin active session banner ─────────────── */}
      {rejoinSessionId !== null && (
        <TouchableOpacity
          style={[s.rejoinBanner, { backgroundColor: c.liveSessionBg, borderColor: c.liveSessionBorder }]}
          onPress={() => navigation.navigate('Session', { sessionId: rejoinSessionId! })}
          activeOpacity={0.75}>
          <View style={s.rejoinBannerLeft}>
            <View style={[s.rejoinDot, { backgroundColor: c.liveSessionText }]} />
            <View>
              <Text style={[s.rejoinBannerLabel, { color: c.liveSessionText }]}>ACTIVE SESSION</Text>
              <Text style={[s.rejoinBannerText, { color: c.liveSessionTextMuted }]}>Tap to rejoin your Together session</Text>
            </View>
          </View>
          <Text style={[s.rejoinBannerArrow, { color: c.liveSessionText }]}>›</Text>
        </TouchableOpacity>
      )}

      {/* ── Together banner ──────────────────────────── */}
      <TouchableOpacity
        style={s.togetherBanner}
        onPress={() => navigation.navigate('TogetherLobby')}
        activeOpacity={0.75}>
        <View style={s.togetherBannerLeft}>
          <View style={s.togetherBannerBadge}>
            <Text
              style={[
                s.togetherCardBadgeText,
                { color: isDark ? c.accent : TOGETHER_BADGE_TEXT_LIGHT },
              ]}>
              TOGETHER
            </Text>
          </View>
          <Text style={[s.togetherBannerText, { color: c.text }]}>Work with someone</Text>
        </View>
        <Text style={[s.togetherBannerArrow, { color: c.accent }]}>›</Text>
      </TouchableOpacity>

      {/* ── Tabs ─────────────────────────────────────── */}
      <View style={s.tabs}>
        <TouchableOpacity
          style={[s.tab, tab === 'active' && s.tabActive]}
          onPress={() => setTab('active')}>
          <Text style={[s.tabText, { color: tab === 'active' ? c.text : c.textSoft }]}>
            Active{activeTasks.length > 0 ? ` (${activeTasks.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, tab === 'history' && s.tabActive]}
          onPress={() => setTab('history')}>
          <Text style={[s.tabText, { color: tab === 'history' ? c.text : c.textSoft }]}>
            History
          </Text>
        </TouchableOpacity>
      </View>

      <View style={s.tabBody}>
      {/* ── Active tasks ─────────────────────────────── */}
      {tab === 'active' && (
        <>
          {activeTasks.length === 0 ? (
            <View style={s.tabBodyFill}>
              <EmptyState
                title="Nothing to avoid."
                subtitle="Add a task and let the guilt begin."
              />
            </View>
          ) : (
            <View style={s.tabBodyFill}>
              <DraggableFlatList
                data={activeTasks}
                keyExtractor={t => t.id}
                renderItem={({ item, getIndex, drag, isActive }: RenderItemParams<Task>) => (
                  <ScaleDecorator>
                    <QueueTaskRow
                      task={item}
                      position={(getIndex() ?? 0) + 1}
                      now={now}
                      onComplete={() => handleComplete(item)}
                      onDelete={() => handleDelete(item)}
                      onEdit={() => setEditingTask(item)}
                      onLongPress={() => setActionSheetTask(item)}
                      onTogglePin={() => handleTogglePin(item)}
                      drag={drag}
                      isActive={isActive}
                      c={c}
                      s={s}
                      isDark={isDark}
                    />
                  </ScaleDecorator>
                )}
                onDragEnd={({ data }) => reorderTasks(data, activeTasks[0] ?? null)}
                contentContainerStyle={s.list}
                showsVerticalScrollIndicator={false}
                activationDistance={5}
              />
            </View>
          )}
        </>
      )}

      {/* ── History tab ──────────────────────────────── */}
      {tab === 'history' && (
        <>
          {(loading || historyLoading) ? (
            <View style={s.historyLoading}>
              <ActivityIndicator color={c.textMuted} />
            </View>
          ) : (() => {
            const currentSection = historySections[historyDayIndex];
            const canGoOlder = historyDayIndex < historySections.length - 1;
            const canGoNewer = historyDayIndex > 0;

            return (
              <View style={s.tabBodyFill}>
                <View style={s.dayNav}>
                  <TouchableOpacity
                    onPress={() => setHistoryDayIndex(i => i + 1)}
                    disabled={!canGoOlder}
                    hitSlop={12}
                    style={s.dayNavArrow}>
                    <Text style={[s.dayNavArrowText, { color: canGoOlder ? c.text : c.border }]}>
                      ‹
                    </Text>
                  </TouchableOpacity>
                  <Text style={[s.dayNavLabel, { color: c.text }]}>{currentSection.dateLabel}</Text>
                  <TouchableOpacity
                    onPress={() => setHistoryDayIndex(i => i - 1)}
                    disabled={!canGoNewer}
                    hitSlop={12}
                    style={s.dayNavArrow}>
                    <Text style={[s.dayNavArrowText, { color: canGoNewer ? c.text : c.border }]}>
                      ›
                    </Text>
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={s.tabBodyFill}
                  contentContainerStyle={s.historyDayContent}
                  showsVerticalScrollIndicator={false}>

                  {currentSection.data.length === 0 && (
                    <View style={s.dayEmptyState}>
                      <Text style={[s.dayEmptyTitle, { color: c.text }]}>Nothing done today.</Text>
                      <Text style={[s.dayEmptySubtitle, { color: c.textSoft }]}>
                        The tasks won't do themselves.{'\n'}Allegedly.
                      </Text>
                    </View>
                  )}

                  {currentSection.data.map(item =>
                    item.kind === 'togetherSession' ? (
                      <TogetherHistoryCard key={item.record.sessionId} record={item.record} c={c} s={s} isDark={isDark} />
                    ) : (
                      <CompletedRow key={item.task.id} task={item.task} c={c} s={s} />
                    ),
                  )}

                  <View style={s.historyBottomPad} />
                </ScrollView>
              </View>
            );
          })()}
        </>
      )}
      </View>

      {/* ── FAB ──────────────────────────────────────── */}
      {tab === 'active' && (
        <TouchableOpacity style={s.fab} onPress={() => setModalVisible(true)}>
          <Text style={[s.fabText, { color: c.primaryText }]}>+</Text>
        </TouchableOpacity>
      )}

      <AddTaskModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onAdd={(title, estimatedMs) => addTask(title, estimatedMs)}
        timePresets={timePresets}
        c={c}
        s={s}
      />

      <EditTaskModal
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleEdit}
        timePresets={timePresets}
        c={c}
        s={s}
      />

      <TaskActionSheet
        task={actionSheetTask}
        onClose={() => setActionSheetTask(null)}
        onEdit={() => { setEditingTask(actionSheetTask); setActionSheetTask(null); }}
        onComplete={() => actionSheetTask && handleComplete(actionSheetTask)}
        onDelete={() => actionSheetTask && handleDelete(actionSheetTask)}
        c={c}
        s={s}
        insetBottom={insets.bottom}
      />
    </Screen>
  );
}

// ─── Theme toggle icons ────────────────────────────────────────────────────────

/** Sun: small filled circle + 4 thin rays through it */
function SunIcon({ color }: { color: string }) {
  return (
    <View style={themeIconStyles.wrap}>
      {/* rays behind the core */}
      {([0, 45, 90, 135] as const).map(deg => (
        <View
          key={deg}
          style={[
            themeIconStyles.ray,
            { backgroundColor: color, transform: [{ rotate: `${deg}deg` }] },
          ]}
        />
      ))}
      {/* core circle on top */}
      <View style={[themeIconStyles.sunCore, { backgroundColor: color }]} />
    </View>
  );
}

/**
 * Moon: filled circle with an offset overlay circle in the bg-color
 * to carve out a crescent shape.
 */
function MoonIcon({ color, bgColor }: { color: string; bgColor: string }) {
  return (
    <View style={themeIconStyles.wrap}>
      <View style={[themeIconStyles.moonOuter, { backgroundColor: color }]} />
      <View style={[themeIconStyles.moonCutout, { backgroundColor: bgColor }]} />
    </View>
  );
}

const themeIconStyles = StyleSheet.create({
  wrap: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Sun
  ray: { position: 'absolute', width: 1.5, height: 18, borderRadius: 1 },
  sunCore: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  // Moon
  moonOuter: { position: 'absolute', width: 13, height: 13, borderRadius: 6.5 },
  moonCutout: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    top: 1,
    right: 1,
  },
});

const visibilityIconStyles = StyleSheet.create({
  wrap: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeOutline: {
    position: 'absolute',
    width: 12,
    height: 8,
    borderWidth: 1.4,
    borderRadius: 6,
  },
  pupil: {
    width: 3.5,
    height: 3.5,
    borderRadius: 1.75,
  },
  crossLine: {
    position: 'absolute',
    width: 14,
    height: 1.5,
    borderRadius: 1,
  },
});

// ─── Style factory ────────────────────────────────────────────────────────────

function buildStyles(thm: AppTheme, isDark: boolean) {
  const { colors: c, spacing: sp, radius: r } = thm;

  /** Bordered TOGETHER pill — history session cards only (home banner uses borderless label). */
  const togetherPillBadge = {
    alignSelf: 'flex-start' as const,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    ...(isDark
      ? { backgroundColor: c.accentSurface, borderColor: c.accentSurfaceBorder }
      : { backgroundColor: '#e8ebfb', borderColor: '#a8b4f0' }),
  };

  /** Home Together row: TOGETHER label without inner border (both themes). */
  const togetherBannerBadge = {
    alignSelf: 'flex-start' as const,
    paddingVertical: 2,
    paddingHorizontal: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  };

  return StyleSheet.create({
    loadingRoot: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: sp.xl + sp.sm },
    errorText: { fontSize: 15, fontWeight: '600', marginBottom: sp.sm, textAlign: 'center' },
    errorDetail: { fontSize: 13, textAlign: 'center', lineHeight: 20 },

    flashBanner: {
      position: 'absolute', top: 60, left: sp.gutter, right: sp.gutter, zIndex: 100,
      backgroundColor: c.surface, borderRadius: r.md, borderWidth: 1, borderColor: c.border,
      paddingVertical: 14, paddingHorizontal: 18,
    },
    flashText: { fontSize: 14, fontWeight: '500', textAlign: 'center' },

    headerActions: { flexDirection: 'row', alignItems: 'center', gap: sp.xs, marginTop: sp.xs },
    themeToggleBtn: { paddingVertical: 6, paddingHorizontal: sp.sm, justifyContent: 'center', alignItems: 'center' },
    settingsIconBtn: {
      paddingVertical: 6,
      paddingHorizontal: sp.sm,
      justifyContent: 'center',
      alignItems: 'center',
      minWidth: 36,
    },
    settingsIcon: { fontSize: 20, lineHeight: 24 },

    rejoinBanner: {
      marginHorizontal: sp.gutter, marginBottom: sp.sm,
      borderRadius: r.sm, borderWidth: 1,
      paddingVertical: 12, paddingHorizontal: 14,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    rejoinBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    rejoinDot: { width: 8, height: 8, borderRadius: 4 },
    rejoinBannerLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 2, marginBottom: 2 },
    rejoinBannerText: { fontSize: 14, fontWeight: '500' },
    rejoinBannerArrow: { fontSize: 20, fontWeight: '300' },

    togetherBanner: {
      marginHorizontal: sp.gutter,
      marginBottom: sp.xl,
      borderRadius: r.sm,
      paddingVertical: sp.md,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      ...(isDark
        ? {
            backgroundColor: c.accentSurface,
            borderWidth: 1,
            borderColor: c.accentSurfaceBorder,
          }
        : {
            backgroundColor: TOGETHER_LIGHT.surface,
            borderWidth: 1.5,
            borderColor: TOGETHER_LIGHT.border,
            shadowColor: '#1c1740',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 5,
          }),
    },
    togetherBannerLeft: { gap: 3 },
    togetherBannerText: { fontSize: 14, fontWeight: '600', letterSpacing: 0.15 },
    togetherBannerBadge,
    togetherBannerArrow: { fontSize: 20, fontWeight: '300' },

    tabs: { flexDirection: 'row', paddingHorizontal: sp.gutter, marginTop: sp.sm, marginBottom: sp.sm, gap: sp.xs },
    tab: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: sp.sm },
    tabActive: { backgroundColor: c.surface },
    tabText: { fontSize: 14, fontWeight: '500' },

    /** Fills space below tabs so list/empty state sits on a solid `c.background` (avoids transparent gap above home indicator). */
    tabBody: { flex: 1, minHeight: 0, backgroundColor: c.background },
    tabBodyFill: { flex: 1, minHeight: 0 },

    list: { paddingHorizontal: sp.gutter, paddingBottom: 100, gap: sp.md },
    historyLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 48 },

    // Completed row
    completedRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.surface,
    },
    completedLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 12, gap: 8 },
    soloModeBadge: {
      backgroundColor: c.surface, borderRadius: 4, borderWidth: 1,
      borderColor: c.border, paddingHorizontal: 5, paddingVertical: 2,
    },
    soloModeBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
    completedTitle: { fontSize: 15, flex: 1, marginRight: sp.md, textDecorationLine: 'line-through' },
    completedRight: { alignItems: 'flex-end', gap: 2 },
    completedTime: { fontSize: 12, fontVariant: ['tabular-nums'] },
    completedDuration: { fontSize: 12, fontVariant: ['tabular-nums'] },
    completedEstLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },

    // Queue task row
    queueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: r.md,
      padding: 14,
    },
    dragHandle: {
      paddingHorizontal: 4,
      paddingVertical: 6,
      marginRight: sp.sm,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dragHandleText: { fontSize: 18, lineHeight: 22 },
    queueBadge: {
      width: 30,
      height: 30,
      borderRadius: r.sm,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: sp.md,
      flexShrink: 0,
    },
    queueBadgeText: { fontSize: 13, fontWeight: '700' },
    queueContent: { flex: 1, marginRight: sp.sm },
    queueTitle: { fontSize: 15, fontWeight: '500', marginBottom: 3 },
    queueMeta: { fontSize: 12 },
    queueTimerRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
    queueTimer: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
    queueEstimate: { fontSize: 12, fontVariant: ['tabular-nums'] },
    queueDoneBtn: {
      borderRadius: r.sm,
      borderWidth: 1,
      paddingVertical: 6,
      paddingHorizontal: 12,
      flexShrink: 0,
    },
    queueDoneBtnText: { fontSize: 13, fontWeight: '500' },

    // FAB
    fab: {
      position: 'absolute', bottom: 36, right: sp.xl,
      width: 56, height: 56, borderRadius: 28, backgroundColor: c.primary,
      justifyContent: 'center', alignItems: 'center',
      shadowColor: c.shadow, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4, shadowRadius: sp.sm, elevation: sp.sm,
    },
    fabText: { fontSize: 28, fontWeight: '300', lineHeight: 32 },

    // Floating popup card
    popupHost: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    popupBackdrop: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'transparent',
    },

    // Task action sheet (extends popupCard)
    actionSheet: { overflow: 'hidden' },
    actionSheetTitle: {
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 0.2,
      textAlign: 'center',
      paddingVertical: 14,
      paddingHorizontal: sp.xl,
    },
    actionSheetDivider: { height: StyleSheet.hairlineWidth },
    actionSheetRow: {
      paddingVertical: 17,
      paddingHorizontal: sp.xl,
      alignItems: 'center',
    },
    actionSheetRowText: { fontSize: 17, fontWeight: '400' },
    popupCard: {
      marginHorizontal: sp.lg,
      borderRadius: 20,
      borderWidth: 1,
      maxHeight: '80%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 24,
      elevation: 12,
    },
    popupScroll: {
      padding: sp.xl,
      gap: 14,
    },
    popupTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
    modalInput: {
      backgroundColor: c.surface, color: c.text, borderRadius: r.sm,
      paddingHorizontal: sp.lg, paddingVertical: 14, fontSize: 16,
      borderWidth: 1, borderColor: c.border, minHeight: 52,
    },
    estimateLabel: { fontSize: 13 },
    presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm },
    presetChip: { borderRadius: sp.sm, borderWidth: 1, borderColor: c.border, paddingVertical: 7, paddingHorizontal: 13 },
    presetChipSelected: { backgroundColor: c.primary, borderColor: c.primary },
    presetChipText: { color: c.textMuted, fontSize: 13, fontWeight: '500' },
    presetChipTextSelected: { color: c.primaryText },
    advancedToggleRow: {
      marginTop: 2,
      marginBottom: sp.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    advancedToggleLabel: { fontSize: 13, fontWeight: '600' },
    advancedToggleChevron: { fontSize: 11, fontWeight: '700' },
    advancedCard: {
      marginBottom: sp.md,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      paddingHorizontal: sp.md,
      paddingVertical: sp.md,
      gap: sp.xs,
    },
    advancedGroupTitle: { marginTop: sp.xs, marginBottom: 6, fontSize: 12, fontWeight: '600' },
    advancedChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs, marginBottom: 8 },
    advancedChip: {
      borderRadius: sp.sm,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 6,
      paddingHorizontal: 10,
      backgroundColor: c.surfaceRaised,
    },
    advancedChipSelected: { backgroundColor: c.primary, borderColor: c.primary },
    advancedChipContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    advancedChipText: { fontSize: 12, fontWeight: '500' },
    modalAddBtn: { backgroundColor: c.primary, borderRadius: r.sm, paddingVertical: 15, alignItems: 'center' },
    modalAddBtnDisabled: { opacity: 0.3 },
    modalAddBtnText: { fontSize: 16, fontWeight: '600' },

    // Day navigator
    dayNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 },
    dayNavArrow: { width: 32, alignItems: 'center' },
    dayNavArrowText: { fontSize: 24, fontWeight: '300', lineHeight: 28 },
    dayNavLabel: { fontSize: 15, fontWeight: '600' },
    historyDayContent: { paddingHorizontal: 20, paddingBottom: 100, gap: 0 },
    historyBottomPad: { height: 20 },

    dayEmptyState: { flex: 1, alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
    dayEmptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
    dayEmptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 22 },

    // Together history card
    togetherCard: {
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      ...(isDark
        ? {
            backgroundColor: c.accentSurface,
            borderWidth: 1,
            borderColor: c.accentSurfaceBorder,
          }
        : {
            backgroundColor: TOGETHER_LIGHT.surface,
            borderWidth: 1.5,
            borderColor: TOGETHER_LIGHT.border,
            shadowColor: '#1c1740',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 10,
            elevation: 4,
          }),
    },
    togetherCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
    togetherCardLeft: { flex: 1, gap: 3, marginRight: 12 },
    togetherCardBadge: togetherPillBadge,
    togetherCardBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
    togetherCardPartner: { fontSize: 15, fontWeight: '600' },
    togetherCardRight: { alignItems: 'flex-end', gap: 2 },
    togetherCardTime: { fontSize: 12, fontVariant: ['tabular-nums'] },
    togetherCardDuration: { fontSize: 11 },
    togetherCardSummary: { fontSize: 13, marginBottom: 4 },
    togetherCardChevron: { fontSize: 10, textAlign: 'center', marginTop: 6 },
    togetherCardBody: {
      marginTop: 10,
      borderTopWidth: 1,
      borderTopColor: isDark ? c.accentSurfaceBorder : TOGETHER_LIGHT.divider,
      paddingTop: 10,
      gap: 12,
    },
    togetherSection: { gap: 6 },
    togetherSectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
    togetherEmptyPartner: { fontSize: 13, fontStyle: 'italic' },
    togetherTaskRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    togetherTaskMark: { fontSize: 13, width: 16, marginTop: 2 },
    togetherTaskInfo: { flex: 1, gap: 2 },
    togetherTaskTitle: { fontSize: 14 },
    togetherTaskDuration: { fontSize: 12, fontVariant: ['tabular-nums'] },
    togetherTaskSolo: { fontSize: 11, fontStyle: 'italic' },
    togetherReactionList: { gap: 3, marginTop: 2 },
    togetherReactionBubble: { fontSize: 12, fontStyle: 'italic' },
  });
}
