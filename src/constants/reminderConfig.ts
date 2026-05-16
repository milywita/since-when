import type { ReminderPreset } from '../types/settingsPreferences';

// ─── Core timing constants ────────────────────────────────────────────────────
// Centralised here so they are easy to tune without hunting through hook code.

/** How often the reminder engine polls for due reminders (ms). */
export const CHECK_INTERVAL_MS = 30_000;

/** Minimum ms between any two non-completion reminder pop-ups (global). */
export const GLOBAL_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * How long an overdue / taking-too-long reminder stays visible before auto-dismissing.
 * Long intentionally — the user should see the pop-up even if they glance away.
 */
export const POPUP_AUTO_DISMISS_REMINDER_MS = 6 * 60 * 1000;

/**
 * How long a task-completion celebration pop-up stays visible before auto-dismissing.
 * Short — it is just a cheerful acknowledgement, not critical info.
 */
export const POPUP_AUTO_DISMISS_COMPLETION_MS = 12_000;

/** Number of recently-shown message IDs to remember (avoids repetition). */
export const RECENT_MESSAGE_HISTORY = 6;

/** When a reminder is blocked by cooldown, push the task's next slot by this much. */
export const COOLDOWN_DELAY_MS = 5 * 60 * 1000;

// ─── Per-task daily caps ──────────────────────────────────────────────────────
// How many reminder pop-ups a single task may generate per calendar day.
// Preset-dependent: annoyMe users opted into more frequent nudges.

/** Returns the max daily reminder count for a given effective task preset. */
export function getMaxDailyPerTask(preset: ReminderPreset): number {
  if (preset === 'annoyMe') { return 9; }
  return 4; // normal (and safe fallback)
}

/**
 * If a partner reaction was received within this window (ms), the solo reminder
 * engine will skip its cycle so partner activity takes priority.
 * Applies only when `lastPartnerReactionAt` is passed to `useSoloReminderEngine`.
 */
export const PARTNER_REACTION_SOLO_COOLDOWN_MS = 8 * 60 * 1000;

// ─── Preset modifiers ─────────────────────────────────────────────────────────
// Multipliers applied to per-task focused thresholds and unfocused intervals.
// Values < 1 mean reminders fire sooner / more often (annoyMe mode).
// 'silent' and 'partnerOnly' are handled by skipping — no modifiers needed.

export type PresetModifiers = {
  /** Multiply the focus-time threshold before "taking too long" fires. */
  focusThresholdMult: number;
  /** Multiply the "not started" repeat interval. */
  notStartedIntervalMult: number;
};

export const PRESET_MODIFIERS: Record<
  Exclude<ReminderPreset, 'silent' | 'partnerOnly'>,
  PresetModifiers
> = {
  normal: {
    focusThresholdMult: 1.0,
    notStartedIntervalMult: 1.0,
  },
  annoyMe: {
    // Reminds at 50% of the normal focus threshold → fires noticeably sooner
    // (e.g. 1-hour task gets a nudge at 30 min instead of 60 min)
    focusThresholdMult: 0.5,
    // Reminds after 40% of the normal not-started interval → much more frequent
    notStartedIntervalMult: 0.4,
  },
};

/** True when the preset means "no automatic app reminders at all." */
export function isSilentPreset(preset: ReminderPreset): boolean {
  return preset === 'silent' || preset === 'partnerOnly';
}
