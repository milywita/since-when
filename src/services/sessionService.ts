import firestore from '@react-native-firebase/firestore';
import type { Session, SessionMember, SessionTask, Reaction } from '../types/Session';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const sessionsCol = () => firestore().collection('sessions');
const membersCol = (sessionId: string) =>
  sessionsCol().doc(sessionId).collection('members');
const reactionsCol = (sessionId: string) =>
  sessionsCol().doc(sessionId).collection('reactions');

// ─── Session lifecycle ────────────────────────────────────────────────────────

export async function createSession(
  userId: string,
  displayName: string,
  durationMs: number,
  initialTasks: SessionTask[] = [],
): Promise<string> {
  const ref = sessionsCol().doc();
  const session: Session = {
    id: ref.id,
    inviteCode: generateInviteCode(),
    createdBy: userId,
    status: 'waiting',
    durationMs,
    startedAt: null,
    endsAt: null,
    participantIds: [userId],
  };
  await ref.set(session);
  await membersCol(ref.id).doc(userId).set({
    userId,
    displayName,
    joinedAt: Date.now(),
    tasks: initialTasks,
    activeTaskId: null,
  } as SessionMember);
  return ref.id;
}

/**
 * Look up an open session by invite code without modifying anything.
 * Returns null if not found or already started.
 */
export async function findSessionByCode(
  inviteCode: string,
): Promise<{ sessionId: string; durationMs: number } | null> {
  const snapshot = await sessionsCol()
    .where('inviteCode', '==', inviteCode.toUpperCase().trim())
    .where('status', '==', 'waiting')
    .limit(1)
    .get();
  if (snapshot.empty) { return null; }
  const data = snapshot.docs[0].data() as Session;
  return { sessionId: data.id, durationMs: data.durationMs };
}

export async function joinSession(
  sessionId: string,
  userId: string,
  displayName: string,
  initialTasks: SessionTask[] = [],
): Promise<void> {
  await sessionsCol().doc(sessionId).update({
    participantIds: firestore.FieldValue.arrayUnion(userId),
  });
  await membersCol(sessionId).doc(userId).set({
    userId,
    displayName,
    joinedAt: Date.now(),
    tasks: initialTasks,
    activeTaskId: null,
  } as SessionMember);
}

export async function startSession(sessionId: string, durationMs: number): Promise<void> {
  const now = Date.now();
  await sessionsCol().doc(sessionId).update({
    status: 'active',
    startedAt: now,
    endsAt: now + durationMs,
  });
}

export async function extendSession(sessionId: string, additionalMs: number): Promise<void> {
  const doc = await sessionsCol().doc(sessionId).get();
  const data = doc.data() as Session;
  // Extend from now if the timer has already expired, otherwise extend from endsAt
  const base = Math.max(data.endsAt ?? Date.now(), Date.now());
  await sessionsCol().doc(sessionId).update({
    endsAt: base + additionalMs,
    status: 'active',
  });
}

export async function endSession(sessionId: string): Promise<void> {
  await sessionsCol().doc(sessionId).update({ status: 'ended' });
}

// ─── Member task management ───────────────────────────────────────────────────

export async function addTaskToSession(
  sessionId: string,
  userId: string,
  task: SessionTask,
): Promise<void> {
  const memberRef = membersCol(sessionId).doc(userId);
  const doc = await memberRef.get();
  if (!doc.exists) { return; }
  const member = doc.data() as SessionMember;
  if (member.tasks.length >= 6) {
    throw new Error('You can only bring 6 tasks into a session.');
  }
  await memberRef.update({ tasks: [...member.tasks, task] });
}

export async function removeTaskFromSession(
  sessionId: string,
  userId: string,
  taskId: string,
): Promise<void> {
  const memberRef = membersCol(sessionId).doc(userId);
  const doc = await memberRef.get();
  if (!doc.exists) { return; }
  const member = doc.data() as SessionMember;
  const tasks = member.tasks.filter(t => t.taskId !== taskId);
  const updates: Partial<SessionMember> = { tasks };
  if (member.activeTaskId === taskId) { updates.activeTaskId = null; }
  await memberRef.update(updates);
}

export async function completeSessionTask(
  sessionId: string,
  userId: string,
  taskId: string,
): Promise<void> {
  const memberRef = membersCol(sessionId).doc(userId);
  const doc = await memberRef.get();
  if (!doc.exists) { return; }
  const member = doc.data() as SessionMember;
  const tasks = member.tasks.map(t =>
    t.taskId === taskId ? { ...t, completedAt: Date.now() } : t,
  );
  const updates: Partial<SessionMember> = { tasks };
  if (member.activeTaskId === taskId) { updates.activeTaskId = null; }
  await memberRef.update(updates);
}

export async function setActiveTask(
  sessionId: string,
  userId: string,
  taskId: string | null,
): Promise<void> {
  await membersCol(sessionId).doc(userId).update({ activeTaskId: taskId });
}

// ─── Reactions ────────────────────────────────────────────────────────────────

export async function sendReaction(
  sessionId: string,
  fromUserId: string,
  toUserId: string,
  taskId: string,
  text: string,
): Promise<void> {
  const ref = reactionsCol(sessionId).doc();
  await ref.set({
    id: ref.id,
    fromUserId,
    toUserId,
    taskId,
    text,
    sentAt: Date.now(),
  } as Reaction);
}

// ─── Real-time subscriptions ──────────────────────────────────────────────────

export function subscribeToSession(
  sessionId: string,
  onUpdate: (session: Session) => void,
  onError?: (error: Error) => void,
): () => void {
  return sessionsCol().doc(sessionId).onSnapshot(
    doc => {
      if (doc.data() !== undefined) { onUpdate(doc.data() as Session); }
    },
    error => {
      console.error('[sessionService] session error:', error.message);
      onError?.(error);
    },
  );
}

export function subscribeToMembers(
  sessionId: string,
  onUpdate: (members: SessionMember[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return membersCol(sessionId).onSnapshot(
    snapshot => {
      onUpdate(snapshot.docs.map(d => d.data() as SessionMember));
    },
    error => {
      console.error('[sessionService] members error:', error.message);
      onError?.(error);
    },
  );
}

export function subscribeToReactions(
  sessionId: string,
  onUpdate: (reactions: Reaction[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return reactionsCol(sessionId)
    .orderBy('sentAt', 'desc')
    .limit(100)
    .onSnapshot(
      snapshot => {
        onUpdate(snapshot.docs.map(d => d.data() as Reaction));
      },
      error => {
        console.error('[sessionService] reactions error:', error.message);
        onError?.(error);
      },
    );
}
