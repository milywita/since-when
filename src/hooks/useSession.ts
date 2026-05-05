import { useState, useEffect, useCallback } from 'react';
import auth from '@react-native-firebase/auth';
import {
  subscribeToSession,
  subscribeToMembers,
  subscribeToReactions,
  endSession as svcEnd,
  leaveSession as svcLeave,
  extendSession as svcExtend,
  addTaskToSession as svcAddTask,
  removeTaskFromSession as svcRemoveTask,
  completeSessionTask as svcCompleteTask,
  setActiveTask as svcSetActive,
  sendReaction as svcSendReaction,
} from '../services/sessionService';
import { setActiveSession } from '../services/userService';
import {
  completeTask as svcCompleteSoloTask,
  addTaskFromSession as svcAddTaskFromSession,
} from '../services/taskService';
import type { Session, SessionMember, SessionTask, Reaction } from '../types/Session';
import { MAX_REACTIONS_PER_TASK } from '../types/Session';

export function useSession(sessionId: string) {
  const [session, setSession] = useState<Session | null>(null);
  const [members, setMembers] = useState<SessionMember[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = auth().currentUser?.uid ?? '';

  useEffect(() => {
    if (!sessionId) { return; }
    let resolved = 0;
    const onResolved = () => { if (++resolved >= 2) { setLoading(false); } };

    const unsubSession = subscribeToSession(
      sessionId,
      s => { setSession(s); setError(null); onResolved(); },
      e => { setError(e.message); onResolved(); },
    );
    const unsubMembers = subscribeToMembers(
      sessionId,
      m => { setMembers(m); onResolved(); },
      e => { setError(e.message); onResolved(); },
    );
    const unsubReactions = subscribeToReactions(
      sessionId,
      r => setReactions(r),
    );
    return () => { unsubSession(); unsubMembers(); unsubReactions(); };
  }, [sessionId]);

  const myMember = members.find(m => m.userId === userId) ?? null;
  const otherMembers = members.filter(m => m.userId !== userId);
  const isHost = session?.createdBy === userId;

  const myReactionCountForTask = useCallback(
    (taskId: string) =>
      reactions.filter(r => r.fromUserId === userId && r.taskId === taskId).length,
    [reactions, userId],
  );

  const canReact = useCallback(
    (taskId: string) => myReactionCountForTask(taskId) < MAX_REACTIONS_PER_TASK,
    [myReactionCountForTask],
  );

  const endSession = useCallback(
    () => svcEnd(sessionId, userId),
    [sessionId, userId],
  );

  /** Clear the current user's activeSessionId — used by non-hosts on session end. */
  const clearActiveSession = useCallback(
    () => setActiveSession(userId, null),
    [userId],
  );

  const leaveSession = useCallback(
    () => svcLeave(sessionId, userId),
    [sessionId, userId],
  );

  const extendSession = useCallback(
    (additionalMs: number) => svcExtend(sessionId, additionalMs),
    [sessionId],
  );

  const addTask = useCallback(
    (task: SessionTask) => svcAddTask(sessionId, userId, task),
    [sessionId, userId],
  );

  const removeTask = useCallback(
    (taskId: string) => svcRemoveTask(sessionId, userId, taskId),
    [sessionId, userId],
  );

  /**
   * Complete a session task. If the task was imported from Solo mode
   * (sourceSoloTaskId is set), the original Solo task is also marked complete.
   */
  const completeTask = useCallback(
    async (task: SessionTask) => {
      await svcCompleteTask(sessionId, userId, task.taskId);
      if (task.sourceSoloTaskId) {
        await svcCompleteSoloTask(userId, task.sourceSoloTaskId).catch(err =>
          console.warn('[useSession] could not sync solo task completion:', err.message),
        );
      }
    },
    [sessionId, userId],
  );

  const setActiveTask = useCallback(
    (taskId: string | null) => svcSetActive(sessionId, userId, taskId),
    [sessionId, userId],
  );

  const sendReaction = useCallback(
    (toUserId: string, taskId: string, text: string) => {
      if (!canReact(taskId)) {
        return Promise.reject(new Error('Reaction limit reached for this task.'));
      }
      return svcSendReaction(sessionId, userId, toUserId, taskId, text);
    },
    [sessionId, userId, canReact],
  );

  /**
   * Copy session-only tasks (no sourceSoloTaskId) back to the user's Solo task
   * list, preserving completedAt so finished work appears in history.
   * Tasks that were imported from Solo mode are already there — nothing to do.
   */
  const syncMyTasksToSolo = useCallback(async () => {
    if (!myMember) { return; }
    const sessionOnlyTasks = myMember.tasks.filter(t => !t.sourceSoloTaskId);
    if (sessionOnlyTasks.length === 0) { return; }
    await Promise.all(
      sessionOnlyTasks.map(task =>
        svcAddTaskFromSession(userId, {
          title: task.title,
          createdAt: task.createdAt,
          completedAt: task.completedAt,
          estimatedMs: task.estimatedMs ?? null,
        }).catch(err =>
          console.warn('[useSession] syncMyTasksToSolo failed for task:', task.title, err.message),
        ),
      ),
    );
  }, [myMember, userId]);

  return {
    session,
    members,
    myMember,
    otherMembers,
    reactions,
    loading,
    error,
    userId,
    isHost,
    myReactionCountForTask,
    canReact,
    endSession,
    clearActiveSession,
    leaveSession,
    extendSession,
    addTask,
    removeTask,
    completeTask,
    setActiveTask,
    sendReaction,
    syncMyTasksToSolo,
  };
}
