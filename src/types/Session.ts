export type SessionTask = {
  taskId: string;
  /** If this task was imported from Solo mode, this is its Firestore task ID. */
  sourceSoloTaskId?: string;
  title: string;
  createdAt: number;
  completedAt: number | null;
  estimatedMs: number | null;
  /** 1-based queue position among active tasks. Completed tasks keep their last position. */
  position: number;
  /**
   * True when the user has pinned this task as co-active.
   * Only non-#1 tasks can be pinned. Timer runs in parallel with #1.
   */
  isPinned: boolean;
  /** Seconds accumulated while this task was in focus (position #1 or pinned). */
  accumulatedSeconds: number;
  /**
   * Unix ms timestamp of when the current active timer session started.
   * Non-null while this task is #1 or pinned. Live elapsed = accumulatedSeconds + (now - timerStartedAt) / 1000.
   */
  timerStartedAt: number | null;
};

export const EXTEND_PRESETS: { label: string; ms: number }[] = [
  { label: '+10m', ms: 10 * 60 * 1000 },
  { label: '+25m', ms: 25 * 60 * 1000 },
  { label: '+50m', ms: 50 * 60 * 1000 },
];

export type SessionMember = {
  userId: string;
  displayName: string;
  joinedAt: number;
  tasks: SessionTask[];
  activeTaskId: string | null;
};

export type Session = {
  id: string;
  inviteCode: string;
  createdBy: string;
  status: 'waiting' | 'active' | 'ended';
  durationMs: number;
  startedAt: number | null;
  endsAt: number | null;
  participantIds: string[];
};

export type Reaction = {
  id: string;
  fromUserId: string;
  toUserId: string;
  taskId: string;
  text: string;
  sentAt: number;
};

/** Reactions to send while a task is still in progress. */
export const REACTION_OPTIONS_ACTIVE = [
  "Killing it!",
  "I'm watching you",
  "Do it faster",
  "Judging respectfully",
  "You got this",
] as const;

/** Reactions to send after a task has been completed. */
export const REACTION_OPTIONS_COMPLETED = [
  "Finally!",
  "Took you long enough",
  "That's actually impressive",
  "About time",
  "Proud of you (I guess)",
] as const;

export const REACTION_OPTIONS = REACTION_OPTIONS_ACTIVE;

export const SESSION_DURATION_PRESETS: { label: string; ms: number }[] = [
  { label: '25m', ms: 25 * 60 * 1000 },
  { label: '50m', ms: 50 * 60 * 1000 },
  { label: '90m', ms: 90 * 60 * 1000 },
];

export const MAX_SESSION_TASKS = 6;
export const MAX_REACTIONS_PER_TASK = 3;

export type JoinRequest = {
  id: string;
  sessionId: string;
  userId: string;
  displayName: string;
  tasks: SessionTask[];
  status: 'pending' | 'approved' | 'denied';
  createdAt: number;
};

export type PartnerSummary = {
  userId: string;
  displayName: string;
  tasks: SessionTask[];
};

/** Snapshot saved to users/{uid}/sessionHistory/{sessionId} when a session ends or user leaves. */
export type SessionHistoryRecord = {
  sessionId: string;
  startedAt: number;
  endedAt: number;
  /** Other members present during this user's participation. */
  partners: PartnerSummary[];
  /** This user's own tasks at the time of exit. */
  myTasks: SessionTask[];
  /** Reactions sent TO this user's tasks by others. */
  reactionsReceived: Reaction[];
};
