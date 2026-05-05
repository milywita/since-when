import { useState, useEffect, useCallback } from 'react';
import auth from '@react-native-firebase/auth';
import { subscribeToTasks, addTask as svcAdd, completeTask as svcComplete, deleteTask as svcDelete } from '../services/taskService';
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

  const addTask = useCallback(
    (title: string, estimatedMs: number | null) => {
      if (!userId) { return Promise.resolve(); }
      return svcAdd(userId, title, estimatedMs);
    },
    [userId],
  );

  const completeTask = useCallback(
    (taskId: string) => {
      if (!userId) { return Promise.resolve(); }
      return svcComplete(userId, taskId);
    },
    [userId],
  );

  const deleteTask = useCallback(
    (taskId: string) => {
      if (!userId) { return Promise.resolve(); }
      return svcDelete(userId, taskId);
    },
    [userId],
  );

  const activeTasks = tasks.filter(t => t.completedAt === null);
  const completedTasks = tasks.filter(t => t.completedAt !== null);

  return { tasks, activeTasks, completedTasks, loading, error, addTask, completeTask, deleteTask };
}
