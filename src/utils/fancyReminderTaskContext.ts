import type { Task } from '../types/Task';


/**
 * Compact duration for reminder copy (no seconds once past 1 minute).
 * Examples: `45m`, `2h 15m`, `1d 3h`.
 */
export function formatCompactDurationFromSeconds(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const days = Math.floor(safe / 86400);
  const hours = Math.floor((safe % 86400) / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  if (mins > 0) {
    return `${mins}m`;
  }
  return `${safe}s`;
}


/**
 * Live focus seconds — matches `QueueTaskRow` rules (#1 or pinned runs the timer).
 */
export function getLiveFocusSeconds(
  task: Task,
  nowMs: number,
  queuePosition: number,
): number {
  const isFirst = queuePosition === 1;
  const timerRuns = isFirst || task.isPinned;
  if (timerRuns) {
    const extra =
      task.timerStartedAt !== null
        ? Math.max(0, Math.floor((nowMs - task.timerStartedAt) / 1000))
        : 0;
    return (task.accumulatedSeconds ?? 0) + extra;
  }
  return task.accumulatedSeconds ?? 0;
}


export type FancyReminderContextParams = {
  task: Task;
  /** Wall-clock "now" for live timer math. */
  nowMs: number;
  /** 1-based index in the active queue (first row = 1). */
  queuePosition: number;
};


/**
 * Short timing explanation for the fancy reminder (no full scheduling / deadline engine).
 */
export function buildFancyReminderTimingLabel(params: FancyReminderContextParams): string {
  const { task, nowMs, queuePosition } = params;
  const liveSec = getLiveFocusSeconds(task, nowMs, queuePosition);
  const estimatedSec =
    task.estimatedMs !== null ? Math.max(0, Math.floor(task.estimatedMs / 1000)) : null;
  const isFirst = queuePosition === 1;
  const timerRuns = isFirst || task.isPinned;
  const ageSec = Math.max(0, Math.floor((nowMs - task.createdAt) / 1000));

  if (estimatedSec !== null && liveSec > estimatedSec) {
    const overBy = liveSec - estimatedSec;
    return `Overdue by ${formatCompactDurationFromSeconds(overBy)}`;
  }

  if (!timerRuns && liveSec === 0) {
    return `Not started for ${formatCompactDurationFromSeconds(ageSec)}`;
  }

  if (!timerRuns && liveSec > 0) {
    return `Paused · ${formatCompactDurationFromSeconds(liveSec)} logged`;
  }

  if (timerRuns && liveSec === 0) {
    return `Not started for ${formatCompactDurationFromSeconds(ageSec)}`;
  }

  return `Running for ${formatCompactDurationFromSeconds(liveSec)}`;
}


function truncateTaskTitle(title: string, maxChars: number): string {
  const t = title.trim();
  if (t.length <= maxChars) {
    return t;
  }
  return `${t.slice(0, Math.max(0, maxChars - 1))}…`;
}


/**
 * Title + timing fragments for UI (e.g. different colors per segment in the modal).
 */
export function buildFancyReminderContextParts(
  task: Task,
  params: Omit<FancyReminderContextParams, 'task'>,
  titleMaxChars = 32,
): { taskTitleTruncated: string; timingLabel: string } {
  return {
    taskTitleTruncated: truncateTaskTitle(task.title, titleMaxChars),
    timingLabel: buildFancyReminderTimingLabel({ task, ...params }),
  };
}


/**
 * Single-line task + timing (for logs, tests, or plain text).
 */
export function buildFancyReminderContextLine(
  task: Task,
  params: Omit<FancyReminderContextParams, 'task'>,
  titleMaxChars = 32,
): string {
  const { taskTitleTruncated, timingLabel } = buildFancyReminderContextParts(
    task,
    params,
    titleMaxChars,
  );
  return `Task: ${taskTitleTruncated} · ${timingLabel}`;
}
