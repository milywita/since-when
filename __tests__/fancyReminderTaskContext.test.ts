import {
  buildFancyReminderTimingLabel,
  formatCompactDurationFromSeconds,
  getLiveFocusSeconds,
} from '../src/utils/fancyReminderTaskContext';
import type { Task } from '../src/types/Task';

function baseTask(overrides: Partial<Task> = {}): Task {
  const createdAt = 1_700_000_000_000;
  return {
    id: 't1',
    userId: 'u1',
    title: 'Reply to email',
    createdAt,
    completedAt: null,
    estimatedMs: 60_000,
    isPublic: false,
    position: 1,
    isPinned: false,
    accumulatedSeconds: 0,
    timerStartedAt: createdAt,
    ...overrides,
  };
}

describe('formatCompactDurationFromSeconds', () => {
  it('formats minutes and hours', () => {
    expect(formatCompactDurationFromSeconds(45 * 60)).toBe('45m');
    expect(formatCompactDurationFromSeconds(3600 + 15 * 60)).toBe('1h 15m');
  });
});

describe('getLiveFocusSeconds', () => {
  it('adds live segment when timer runs on #1', () => {
    const task = baseTask({ accumulatedSeconds: 100, timerStartedAt: 1_700_000_060_000 });
    const now = 1_700_000_090_000;
    expect(getLiveFocusSeconds(task, now, 1)).toBe(130);
  });

  it('does not add live segment when not #1 and not pinned', () => {
    const task = baseTask({ accumulatedSeconds: 200, timerStartedAt: 1_700_000_060_000 });
    const now = 1_700_000_120_000;
    expect(getLiveFocusSeconds(task, now, 2)).toBe(200);
  });
});

describe('buildFancyReminderTimingLabel', () => {
  it('flags overdue when focus exceeds estimate', () => {
    const task = baseTask({
      estimatedMs: 60_000,
      accumulatedSeconds: 90,
      timerStartedAt: null,
    });
    const label = buildFancyReminderTimingLabel({
      task,
      nowMs: task.createdAt + 5000,
      queuePosition: 1,
    });
    expect(label).toContain('Overdue by');
    expect(label).toContain('30s');
  });

  it('says not started when queued behind others with zero focus', () => {
    const task = baseTask({
      estimatedMs: null,
      accumulatedSeconds: 0,
      timerStartedAt: null,
    });
    const label = buildFancyReminderTimingLabel({
      task,
      nowMs: task.createdAt + 45 * 60_000,
      queuePosition: 2,
    });
    expect(label).toContain('Not started for');
    expect(label).toContain('45m');
  });
});
