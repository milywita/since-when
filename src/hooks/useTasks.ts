import { useState, useEffect, useCallback } from 'react';
import auth from '@react-native-firebase/auth';
import { subscribeToTasks, addTask as svcAdd, completeTask as svcComplete, deleteTask as svcDelete, updateTask as svcUpdate, reorderTasks as svcReorder, pinTask as svcPin, unpinTask as svcUnpin } from '../services/taskService';
import type { Task } from '../types/Task';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = auth().currentUser?.uid;

  useEffect(() => {
    if (!userId) {
      return;
    }
    const unsubscribe = subscribeToTasks(
      userId,
      incoming => {
        setTasks(incoming);
        setError(null);
        setLoading(false);
      },
      err => {
        setError(err.message);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [userId]);

  const activeTasks = tasks.filter(t => t.completedAt === null);
  const completedTasks = tasks.filter(t => t.completedAt !== null);

  const addTask = useCallback(
    (title: string, estimatedMs: number | null, options?: { isPublic?: boolean }) => {
      if (!userId) { return Promise.resolve(); }
      return svcAdd(userId, title, estimatedMs, activeTasks.length, options);
    },
    [userId, activeTasks.length],
  );

  const completeTask = useCallback(
    (completingTask: Task, remainingActiveTasks: Task[], completedInSessionId?: string) => {
      if (!userId) { return Promise.resolve(); }
      return svcComplete(userId, completingTask, remainingActiveTasks, completedInSessionId);
    },
    [userId],
  );

  const deleteTask = useCallback(
    (deletingTask: Task, remainingActiveTasks: Task[]) => {
      if (!userId) { return Promise.resolve(); }
      return svcDelete(userId, deletingTask, remainingActiveTasks);
    },
    [userId],
  );

  const updateTask = useCallback(
    (taskId: string, changes: { title?: string; estimatedMs?: number | null; isPublic?: boolean }) => {
      if (!userId) { return Promise.resolve(); }
      return svcUpdate(userId, taskId, changes);
    },
    [userId],
  );

  const reorderTasks = useCallback(
    (orderedTasks: Task[], previousFirstTask: Task | null) => {
      if (!userId) { return Promise.resolve(); }
      return svcReorder(userId, orderedTasks, previousFirstTask);
    },
    [userId],
  );

  const pinTask = useCallback(
    (task: Task) => {
      if (!userId) { return Promise.resolve(); }
      return svcPin(userId, task);
    },
    [userId],
  );

  const unpinTask = useCallback(
    (task: Task) => {
      if (!userId) { return Promise.resolve(); }
      return svcUnpin(userId, task);
    },
    [userId],
  );

  return { tasks, activeTasks, completedTasks, loading, error, addTask, completeTask, deleteTask, updateTask, reorderTasks, pinTask, unpinTask };
}
