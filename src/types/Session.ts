export type SessionTask = {
  taskId: string;
  /** If this task was imported from Solo mode, this is its Firestore task ID. */
  sourceSoloTaskId?: string;
  title: string;
  createdAt: number;
  completedAt: number | null;
};

export const EXTEND_PRESETS: { label: string; ms: number }[] = [
  { label: '+10 min', ms: 10 * 60 * 1000 },
  { label: '+25 min', ms: 25 * 60 * 1000 },
  { label: '+50 min', ms: 50 * 60 * 1000 },
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

export const REACTION_OPTIONS = [
  "Killing it!",
  "I'm watching you",
  "Do it faster",
  "Judging respectfully",
  "You got this",
] as const;

export const SESSION_DURATION_PRESETS: { label: string; ms: number }[] = [
  { label: '25 min', ms: 25 * 60 * 1000 },
  { label: '50 min', ms: 50 * 60 * 1000 },
  { label: '90 min', ms: 90 * 60 * 1000 },
];

export const MAX_SESSION_TASKS = 6;
export const MAX_REACTIONS_PER_TASK = 3;
