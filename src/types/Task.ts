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
  /** Set when this task was synced from a Together session. Prevents it showing as a solo history item. */
  sessionId?: string;
  /** Set on the original solo task when it is completed inside a Together session. Prevents double-counting in solo history. */
  completedInSessionId?: string;
};
