import type { Task } from '../types/Task';

// ─── Rank tiers ───────────────────────────────────────────────────────────────
// Task importance is determined purely by position in the queue.
// Lower position = more important.

export type RankTier = 'high' | 'normal' | 'low';

/** Maps 1-based queue position to a rank tier used for reminder thresholds. */
export function getRankTier(position: number): RankTier {
  if (position <= 2) {
    return 'high';
  }
  if (position <= 5) {
    return 'normal';
  }
  return 'low';
}

// ─── Focused task thresholds ──────────────────────────────────────────────────
// A "focused" task is one with the timer running (position 1 or isPinned).
// The "taking too long" reminder fires when total focus time exceeds
// estimatedMs × factor (or a fallback time if no estimate).

/** Factor applied to estimatedMs to determine the "taking too long" threshold. */
export function getFocusFactor(tier: RankTier): number {
  const factors: Record<RankTier, number> = {
    high: 1.10,
    normal: 1.25,
    low: 1.50,
  };
  return factors[tier];
}

/** Fallback threshold (ms) for focused tasks that have no estimate. */
export function getFocusFallbackMs(tier: RankTier): number {
  const fallbacks: Record<RankTier, number> = {
    high: 30 * 60 * 1000,   // 30 minutes
    normal: 60 * 60 * 1000, // 60 minutes
    low: 90 * 60 * 1000,    // 90 minutes
  };
  return fallbacks[tier];
}

// ─── Unfocused task intervals ──────────────────────────────────────────────────
// "Not started" reminders repeat at these intervals while the task sits idle.

/** Interval (ms) between "not started" reminders for unfocused tasks. */
export function getNotStartedIntervalMs(tier: RankTier): number {
  const intervals: Record<RankTier, number> = {
    high: 60 * 60 * 1000,    // 60 minutes
    normal: 90 * 60 * 1000,  // 1.5 hours
    low: 135 * 60 * 1000,    // 2 hours 15 minutes
  };
  return intervals[tier];
}

// ─── Task state helpers ────────────────────────────────────────────────────────

/** True when the task timer is actively running (position 1 or pinned). */
export function isTaskFocused(task: Task): boolean {
  return (task.position === 1 || task.isPinned) && task.timerStartedAt !== null;
}

/** Total focus time in ms, including the current live timer segment. */
export function getLiveFocusMs(task: Task, nowMs: number): number {
  const accMs = (task.accumulatedSeconds ?? 0) * 1000;
  if (task.timerStartedAt !== null) {
    return accMs + Math.max(0, nowMs - task.timerStartedAt);
  }
  return accMs;
}

// ─── Focused reminder scheduling ──────────────────────────────────────────────

/**
 * Returns the timestamp (ms) when the focused "taking too long" reminder should fire.
 *
 * Formula: timerStartedAt + (threshold - alreadyAccumulatedMs)
 * where threshold = estimatedMs × factor (or fallback).
 *
 * Returns null if the task is not focused.
 * Returns nowMs + 2 minutes if the threshold is already in the past
 * (avoids showing reminders instantly on estimate edits or app restarts).
 */
export function calcFocusedReminderAt(task: Task, nowMs: number): number | null {
  if (!isTaskFocused(task)) {
    return null;
  }

  const tier = getRankTier(task.position);
  const accMs = (task.accumulatedSeconds ?? 0) * 1000;
  const thresholdMs = task.estimatedMs !== null
    ? task.estimatedMs * getFocusFactor(tier)
    : getFocusFallbackMs(tier);

  // Remaining time until threshold, given what's already been accumulated
  const remainingMs = thresholdMs - accMs;

  if (remainingMs <= 0) {
    // Already over threshold — fire in 2 min instead of instantly
    return nowMs + 2 * 60 * 1000;
  }

  const fireAt = task.timerStartedAt! + remainingMs;
  if (fireAt <= nowMs) {
    return nowMs + 2 * 60 * 1000;
  }

  return fireAt;
}
