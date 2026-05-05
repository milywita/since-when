import firestore from '@react-native-firebase/firestore';
import type { Session, SessionMember, SessionTask, Reaction, JoinRequest } from '../types/Session';
import { findUserByInviteCode, setActiveSession, recordSessionPartner } from './userService';

const sessionsCol = () => firestore().collection('sessions');
const membersCol = (sessionId: string) =>
  sessionsCol().doc(sessionId).collection('members');
const reactionsCol = (sessionId: string) =>
  sessionsCol().doc(sessionId).collection('reactions');
const joinRequestsCol = (sessionId: string) =>
  sessionsCol().doc(sessionId).collection('joinRequests');

// ─── Session lifecycle ────────────────────────────────────────────────────────

/**
 * Create a new Together session that starts immediately as 'active'.
 * The invite code shown to users is the host's personal invite code (from userService),
 * not stored on the session itself.
 */
export async function createSession(
  userId: string,
  displayName: string,
  durationMs: number,
  initialTasks: SessionTask[] = [],
): Promise<string> {
  const ref = sessionsCol().doc();
  const now = Date.now();
  const session: Session = {
    id: ref.id,
    inviteCode: '',
    createdBy: userId,
    status: 'active',
    durationMs,
    startedAt: now,
    endsAt: now + durationMs,
    participantIds: [userId],
  };
  await ref.set(session);
  await membersCol(ref.id).doc(userId).set({
    userId,
    displayName,
    joinedAt: now,
    tasks: initialTasks,
    activeTaskId: null,
  } as SessionMember);
  await setActiveSession(userId, ref.id);
  return ref.id;
}

/**
 * Find a user's active session by their personal invite code.
 * Returns session info if the user is currently in an active session, otherwise null.
 */
export async function findActiveSessionByInviteCode(
  code: string,
): Promise<{ sessionId: string; durationMs: number; hostUsername: string } | null> {
  const userProfile = await findUserByInviteCode(code);
  if (!userProfile) { return null; }
  if (!userProfile.activeSessionId) { return null; }
  const sessionDoc = await sessionsCol().doc(userProfile.activeSessionId).get();
  if (!sessionDoc.exists) { return null; }
  const session = sessionDoc.data() as Session;
  if (session.status !== 'active') { return null; }
  return {
    sessionId: userProfile.activeSessionId,
    durationMs: session.durationMs,
    hostUsername: userProfile.username,
  };
}

export async function joinSession(
  sessionId: string,
  userId: string,
  displayName: string,
  initialTasks: SessionTask[] = [],
): Promise<void> {
  const now = Date.now();

  await sessionsCol().doc(sessionId).update({
    participantIds: firestore.FieldValue.arrayUnion(userId),
  });
  await membersCol(sessionId).doc(userId).set({
    userId,
    displayName,
    joinedAt: now,
    tasks: initialTasks,
    activeTaskId: null,
  } as SessionMember);
  await setActiveSession(userId, sessionId);

  // Record the host in the JOINER's own partner list.
  // Each user can only write their own Firestore doc, so we only write userId's profile here.
  // The host records the joiner from their own side when they see the new member appear
  // (handled in SessionScreen's member-change effect).
  const sessionDoc = await sessionsCol().doc(sessionId).get();
  const session = (sessionDoc.data() ?? {}) as Partial<Session>;
  const hostId = session.createdBy;
  if (hostId && hostId !== userId) {
    const hostMemberDoc = await membersCol(sessionId).doc(hostId).get();
    const hostMember = (hostMemberDoc.data() ?? {}) as Partial<SessionMember>;
    const hostName = hostMember.displayName ?? '';
    await recordSessionPartner(userId, {
      userId: hostId,
      username: hostName,
      lastSessionAt: now,
    });
  }
}

/**
 * Leave a session without ending it for everyone.
 * Removes the member doc (so others see them disappear in real time) and
 * clears their activeSessionId.
 */
export async function leaveSession(sessionId: string, userId: string): Promise<void> {
  await Promise.all([
    membersCol(sessionId).doc(userId).delete(),
    sessionsCol().doc(sessionId).update({
      participantIds: firestore.FieldValue.arrayRemove(userId),
    }),
    setActiveSession(userId, null),
  ]);
}

export async function extendSession(sessionId: string, additionalMs: number): Promise<void> {
  const doc = await sessionsCol().doc(sessionId).get();
  const data = doc.data() as Session;
  const base = Math.max(data.endsAt ?? Date.now(), Date.now());
  await sessionsCol().doc(sessionId).update({
    endsAt: base + additionalMs,
    status: 'active',
  });
}

/**
 * End a session and clear activeSessionId for all participants.
 * Records session partners in each user's partner history.
 */
/**
 * End the session. Only operates on the host's own profile — other participants
 * clear their own activeSessionId when they detect status === 'ended' in the UI.
 * (Writing to another user's profile document is forbidden by Firestore rules.)
 */
export async function endSession(sessionId: string, hostUserId: string): Promise<void> {
  await sessionsCol().doc(sessionId).update({ status: 'ended' });

  // Clear the host's own activeSessionId.
  await setActiveSession(hostUserId, null);

  // Record all other current members as partners in the host's own profile.
  const membersSnap = await membersCol(sessionId).get();
  const allMembers = membersSnap.docs.map(d => d.data() as SessionMember);
  const now = Date.now();
  const otherMembers = allMembers.filter(m => m.userId !== hostUserId);
  await Promise.all(
    otherMembers.map(other =>
      recordSessionPartner(hostUserId, {
        userId: other.userId,
        username: other.displayName,
        lastSessionAt: now,
      }),
    ),
  );
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

// ─── Join requests ────────────────────────────────────────────────────────────

/**
 * Joiner creates a pending join request instead of joining directly.
 * Returns the request ID so the joiner can subscribe to status changes.
 */
export async function requestToJoin(
  sessionId: string,
  userId: string,
  displayName: string,
  tasks: SessionTask[],
): Promise<string> {
  const ref = joinRequestsCol(sessionId).doc();
  const request: JoinRequest = {
    id: ref.id,
    sessionId,
    userId,
    displayName,
    tasks,
    status: 'pending',
    createdAt: Date.now(),
  };
  await ref.set(request);
  return ref.id;
}

/**
 * Host approves the request: adds the joiner to participantIds and marks approved.
 * The joiner's client will see the status change and call completeJoin themselves.
 */
export async function approveJoinRequest(
  sessionId: string,
  requestId: string,
  joinerId: string,
): Promise<void> {
  await Promise.all([
    joinRequestsCol(sessionId).doc(requestId).update({ status: 'approved' }),
    sessionsCol().doc(sessionId).update({
      participantIds: firestore.FieldValue.arrayUnion(joinerId),
    }),
  ]);
}

export async function denyJoinRequest(
  sessionId: string,
  requestId: string,
): Promise<void> {
  await joinRequestsCol(sessionId).doc(requestId).update({ status: 'denied' });
}

/**
 * Called by the joiner after seeing their request approved.
 * Writes their member doc, sets activeSessionId, and records the partnership.
 */
export async function completeJoin(
  sessionId: string,
  request: JoinRequest,
): Promise<void> {
  const now = Date.now();
  await membersCol(sessionId).doc(request.userId).set({
    userId: request.userId,
    displayName: request.displayName,
    joinedAt: now,
    tasks: request.tasks,
    activeTaskId: null,
  } as SessionMember);
  await setActiveSession(request.userId, sessionId);

  // Record host in joiner's partner list
  const sessionDoc = await sessionsCol().doc(sessionId).get();
  const session = (sessionDoc.data() ?? {}) as Partial<Session>;
  const hostId = session.createdBy;
  if (hostId && hostId !== request.userId) {
    const hostMemberDoc = await membersCol(sessionId).doc(hostId).get();
    const hostMember = (hostMemberDoc.data() ?? {}) as Partial<SessionMember>;
    await recordSessionPartner(request.userId, {
      userId: hostId,
      username: hostMember.displayName ?? '',
      lastSessionAt: now,
    });
  }
}

/** Host subscribes to all pending join requests for the session. */
export function subscribeToJoinRequests(
  sessionId: string,
  onUpdate: (requests: JoinRequest[]) => void,
): () => void {
  return joinRequestsCol(sessionId)
    .where('status', '==', 'pending')
    .onSnapshot(snap => {
      const requests = snap.docs
        .map(d => d.data() as JoinRequest)
        .sort((a, b) => a.createdAt - b.createdAt);
      onUpdate(requests);
    }, err => {
      console.error('[sessionService] joinRequests error:', err.message);
    });
}

/** Joiner subscribes to their own request to detect approval/denial. */
export function subscribeToJoinRequest(
  sessionId: string,
  requestId: string,
  onUpdate: (request: JoinRequest | null) => void,
): () => void {
  return joinRequestsCol(sessionId).doc(requestId).onSnapshot(doc => {
    const data = doc.data() as JoinRequest | undefined;
    onUpdate(data ?? null);
  });
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
