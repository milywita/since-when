import firestore from '@react-native-firebase/firestore';
import type { SessionHistoryRecord } from '../types/Session';

const sessionHistoryCol = (userId: string) =>
  firestore().collection('users').doc(userId).collection('sessionHistory');

export async function saveSessionHistory(
  userId: string,
  record: SessionHistoryRecord,
): Promise<void> {
  await sessionHistoryCol(userId).doc(record.sessionId).set(record);
}

export function subscribeToSessionHistory(
  userId: string,
  onUpdate: (records: SessionHistoryRecord[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return sessionHistoryCol(userId)
    .orderBy('endedAt', 'desc')
    .limit(50)
    .onSnapshot(
      snap => {
        onUpdate(snap.docs.map(d => d.data() as SessionHistoryRecord));
      },
      error => {
        console.error('[historyService] sessionHistory error:', error.message);
        onError?.(error);
      },
    );
}
