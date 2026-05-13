export type Task = {
  id: string;
  userId: string;
  title: string;
  createdAt: number;           // unix timestamp ms — the avoidance counter starts here
  completedAt: number | null;
  estimatedMs: number | null;  // how long the user thought it would take, in ms
  isPublic: boolean;           // false = private/solo, true = visible to invited users
  /** 1-based queue position. Lower = earlier in the plan. Shifts down when tasks ahead complete. */
  position: number;
  /**
   * True when the user has explicitly pinned this task as co-active.
   * Only non-#1 tasks can be pinned. A pinned task's timer runs in parallel with #1.
   * When a pinned task is reordered into #1 this becomes false (it's now default focus).
   */
  isPinned: boolean;
  /** Seconds accumulated while this task was in focus (position #1 or pinned). */
  accumulatedSeconds: number;
  /**
   * Unix ms timestamp of when the current active timer session started.
   * Non-null while the task is #1 or pinned. Live elapsed = accumulatedSeconds + (now - timerStartedAt) / 1000
   */
  timerStartedAt: number | null;
  /** Set when this task was synced from a Together session. Prevents it showing as a solo history item. */
  sessionId?: string;
  /** Set on the original solo task when it is completed inside a Together session. Prevents double-counting in solo history. */
  completedInSessionId?: string;
};
