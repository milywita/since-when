import firestore from '@react-native-firebase/firestore';
import type { Task } from '../types/Task';

const tasksCollection = (userId: string) =>
  firestore().collection('users').doc(userId).collection('tasks');

export async function addTask(
  userId: string,
  title: string,
  estimatedMs: number | null,
): Promise<void> {
  const ref = tasksCollection(userId).doc();
  const task: Task = {
    id: ref.id,
    userId,
    title: title.trim(),
    createdAt: Date.now(),
    completedAt: null,
    estimatedMs,
    isPublic: false,
  };
  await ref.set(task);
}

export async function completeTask(userId: string, taskId: string): Promise<void> {
  await tasksCollection(userId).doc(taskId).update({
    completedAt: Date.now(),
  });
}

export async function deleteTask(userId: string, taskId: string): Promise<void> {
  await tasksCollection(userId).doc(taskId).delete();
}

export function subscribeToTasks(
  userId: string,
  onUpdate: (tasks: Task[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return tasksCollection(userId)
    .orderBy('createdAt', 'desc')
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
