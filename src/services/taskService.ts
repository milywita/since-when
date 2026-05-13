import firestore from '@react-native-firebase/firestore';
import type { Task } from '../types/Task';

const tasksCollection = (userId: string) =>
  firestore().collection('users').doc(userId).collection('tasks');

// ─── Timer helpers ────────────────────────────────────────────────────────────

/** Fields to write when pausing a task's timer (it's leaving the #1 slot). */
function pausedTimerFields(task: { accumulatedSeconds: number; timerStartedAt: number | null }) {
  const extra = task.timerStartedAt !== null
    ? Math.floor((Date.now() - task.timerStartedAt) / 1000)
    : 0;
  return {
    accumulatedSeconds: task.accumulatedSeconds + extra,
    timerStartedAt: null,
  };
}

/** Fields to write when starting a task's timer (it's entering the #1 slot). */
function startedTimerFields() {
  return { timerStartedAt: Date.now() };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function addTask(
  userId: string,
  title: string,
  estimatedMs: number | null,
  activeTaskCount: number,
): Promise<void> {
  const col = tasksCollection(userId);
  // Find the highest existing position across all tasks (no where clause = no composite index needed).
  // Positions only ever increment, so using the global max is correct.
  const tail = await col
    .orderBy('position', 'desc')
    .limit(1)
    .get();
  const maxPosition = tail.empty
    ? 0
    : ((tail.docs[0].data() as Task).position ?? 0);

  // isFirst is based on the *active* queue length the caller already knows,
  // not the global max position (which includes completed tasks).
  const isFirst = activeTaskCount === 0;
  const ref = col.doc();
  const task: Task = {
    id: ref.id,
    userId,
    title: title.trim(),
    createdAt: Date.now(),
    completedAt: null,
    estimatedMs,
    isPublic: false,
    position: maxPosition + 1,
    isPinned: false,
    accumulatedSeconds: 0,
    // If this is the very first active task it immediately becomes #1 — start its timer.
    timerStartedAt: isFirst ? Date.now() : null,
  };
  await ref.set(task);
}

/**
 * Write a task with explicit timestamps — used to port session tasks back to Solo
 * while preserving the original createdAt (and completedAt if already done).
 * Passing sessionId marks the task as originating from a Together session so it
 * is excluded from the solo history view.
 */
export async function addTaskFromSession(
  userId: string,
  data: {
    title: string;
    createdAt: number;
    completedAt: number | null;
    estimatedMs: number | null;
    sessionId?: string;
    accumulatedSeconds?: number;
  },
): Promise<void> {
  const ref = tasksCollection(userId).doc();
  const task: Task = {
    id: ref.id,
    userId,
    title: data.title,
    createdAt: data.createdAt,
    completedAt: data.completedAt,
    estimatedMs: data.estimatedMs,
    isPublic: false,
    position: 0,
    isPinned: false,
    accumulatedSeconds: data.accumulatedSeconds ?? 0,
    timerStartedAt: null,
    ...(data.sessionId ? { sessionId: data.sessionId } : {}),
  };
  await ref.set(task);
}

/**
 * Mark a task as complete and resequence the remaining active tasks in a
 * single batch so positions stay 1-based and gapless.
 *
 * `completingTask` — the full task being completed (needed to snapshot its timer).
 * `remainingActiveTasks` — active tasks that stay in the queue, in desired order
 *   (exclude the completing task).
 *
 * Pass completedInSessionId when completing from inside a Together session
 * so the task is excluded from the solo history view.
 */
export async function completeTask(
  userId: string,
  completingTask: Task,
  remainingActiveTasks: Task[],
  completedInSessionId?: string,
): Promise<void> {
  const col = tasksCollection(userId);
  const batch = firestore().batch();

  // Pause and complete the outgoing task.
  batch.update(col.doc(completingTask.id), {
    completedAt: Date.now(),
    ...pausedTimerFields(completingTask),
    ...(completedInSessionId ? { completedInSessionId } : {}),
  });

  remainingActiveTasks.forEach((t, idx) => {
    const newPosition = idx + 1;
    const stepsIntoFirst = completingTask.position === 1 && newPosition === 1;
    // A pinned task stepping into #1 transitions from pinned → default focus.
    // Timer keeps running (timerStartedAt already set), just clear isPinned.
    const wasAlreadyRunning = t.isPinned && stepsIntoFirst;
    batch.update(col.doc(t.id), {
      position: newPosition,
      ...(stepsIntoFirst && !wasAlreadyRunning ? startedTimerFields() : {}),
      ...(wasAlreadyRunning ? { isPinned: false } : {}),
    });
  });

  await batch.commit();
}

export async function updateTask(
  userId: string,
  taskId: string,
  changes: { title?: string; estimatedMs?: number | null },
): Promise<void> {
  await tasksCollection(userId).doc(taskId).update(changes);
}

/** Pin a non-#1 task as co-active. Starts its timer immediately. */
export async function pinTask(userId: string, task: Task): Promise<void> {
  await tasksCollection(userId).doc(task.id).update({
    isPinned: true,
    ...startedTimerFields(),
  });
}

/**
 * Un-pin a task. Pauses its timer and saves accumulated time.
 */
export async function unpinTask(userId: string, task: Task): Promise<void> {
  await tasksCollection(userId).doc(task.id).update({
    isPinned: false,
    ...pausedTimerFields(task),
  });
}

/**
 * Delete a task and resequence the remaining active tasks in a single batch.
 *
 * `deletingTask` — the full task being deleted (needed to snapshot its timer if it was #1).
 * `remainingActiveTasks` — active tasks that stay in the queue, in desired order.
 */
export async function deleteTask(
  userId: string,
  deletingTask: Task,
  remainingActiveTasks: Task[],
): Promise<void> {
  const col = tasksCollection(userId);
  const batch = firestore().batch();
  batch.delete(col.doc(deletingTask.id));

  remainingActiveTasks.forEach((t, idx) => {
    const newPosition = idx + 1;
    const stepsIntoFirst = deletingTask.position === 1 && newPosition === 1;
    const wasAlreadyRunning = t.isPinned && stepsIntoFirst;
    batch.update(col.doc(t.id), {
      position: newPosition,
      ...(stepsIntoFirst && !wasAlreadyRunning ? startedTimerFields() : {}),
      ...(wasAlreadyRunning ? { isPinned: false } : {}),
    });
  });

  await batch.commit();
}

/**
 * Batch-write new positions after a drag-to-reorder.
 * Pauses the outgoing #1's timer and starts the new #1's timer if #1 changed.
 *
 * `orderedTasks` — the full active task list in the new desired order.
 * `previousFirstTask` — the task that was at position #1 before the drag.
 */
export async function reorderTasks(
  userId: string,
  orderedTasks: Task[],
  previousFirstTask: Task | null,
): Promise<void> {
  const col = tasksCollection(userId);
  const batch = firestore().batch();
  const newFirstTask = orderedTasks[0] ?? null;
  const firstChanged = previousFirstTask && newFirstTask && previousFirstTask.id !== newFirstTask.id;

  orderedTasks.forEach((t, idx) => {
    const newPosition = idx + 1;
    const isOutgoingFirst = firstChanged && t.id === previousFirstTask!.id;
    const isIncomingFirst = firstChanged && t.id === newFirstTask!.id;
    // Pinned task dragged into #1 — timer already running, just clear isPinned.
    const pinnedBecomesFirst = isIncomingFirst && t.isPinned;

    batch.update(col.doc(t.id), {
      position: newPosition,
      ...(isOutgoingFirst ? { ...pausedTimerFields(t), isPinned: false } : {}),
      ...(isIncomingFirst && !pinnedBecomesFirst ? startedTimerFields() : {}),
      ...(pinnedBecomesFirst ? { isPinned: false } : {}),
    });
  });

  await batch.commit();
}

export function subscribeToTasks(
  userId: string,
  onUpdate: (tasks: Task[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return tasksCollection(userId)
    .orderBy('position', 'asc')
    .onSnapshot(
      snapshot => {
        if (!snapshot) { return; }
        const tasks: Task[] = snapshot.docs.map(doc => doc.data() as Task);
        onUpdate(tasks);
      },
      error => {
        console.error('[taskService] snapshot error:', error.message);
        onError?.(error);
      },
    );
}

/**
 * Lightweight completion for a solo task that was completed inside a Together
 * session. Does NOT resequence remaining tasks (the task was already detached
 * from the active queue when the session started). Snapshots accumulated timer
 * time if the task had a running timer.
 */
export async function markSoloTaskCompleteFromSession(
  userId: string,
  taskId: string,
  completedInSessionId: string,
): Promise<void> {
  const col = tasksCollection(userId);
  const doc = await col.doc(taskId).get();
  if (!doc.exists) { return; }
  const task = doc.data() as Task;
  const now = Date.now();
  const extra = task.timerStartedAt !== null
    ? Math.floor((now - task.timerStartedAt) / 1000)
    : 0;
  await col.doc(taskId).update({
    completedAt: now,
    completedInSessionId,
    accumulatedSeconds: (task.accumulatedSeconds ?? 0) + extra,
    timerStartedAt: null,
  });
}

/**
 * Pause the timers of a set of solo tasks that are being moved into a Together
 * session. Snapshots any live elapsed time so it is not double-counted later.
 * Call this right before adding the tasks to the session.
 */
export async function pauseTaskTimers(
  userId: string,
  taskIds: string[],
): Promise<void> {
  if (taskIds.length === 0) { return; }
  const col = tasksCollection(userId);
  const now = Date.now();
  const batch = firestore().batch();
  const docs = await Promise.all(taskIds.map(id => col.doc(id).get()));
  for (const doc of docs) {
    if (!doc.exists) { continue; }
    const task = doc.data() as Task;
    if (task.timerStartedAt === null) { continue; }
    const extra = Math.floor((now - task.timerStartedAt) / 1000);
    batch.update(col.doc(task.id), {
      accumulatedSeconds: (task.accumulatedSeconds ?? 0) + extra,
      timerStartedAt: null,
    });
  }
  await batch.commit();
}

/**
 * Update a solo task's accumulated focus time after a Together session ends.
 * Also restarts the timer if this task is currently at position #1 (so #1
 * auto-focuses again once the user returns to the solo queue).
 */
export async function updateSoloTaskAfterSession(
  userId: string,
  taskId: string,
  accumulatedSeconds: number,
): Promise<void> {
  const col = tasksCollection(userId);
  const doc = await col.doc(taskId).get();
  if (!doc.exists) { return; }
  const task = doc.data() as Task;
  if (task.completedAt !== null) { return; } // already completed — don't touch
  await col.doc(taskId).update({
    accumulatedSeconds,
    // Restart the timer if it's position #1 so it keeps ticking once the user is back.
    timerStartedAt: task.position === 1 ? Date.now() : null,
  });
}
