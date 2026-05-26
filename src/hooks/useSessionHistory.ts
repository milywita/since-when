import { useState, useEffect } from 'react';
import auth from '@react-native-firebase/auth';
import { subscribeToSessionHistory } from '../services/historyService';
import type { SessionHistoryRecord } from '../types/Session';

export function useSessionHistory() {
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryRecord[]>([]);

  const userId = auth().currentUser?.uid ?? '';

  useEffect(() => {
    if (!userId) { return; }
    // Together sessions stream in when Firestore responds; callers do not block
    // on this subscription — solo history must always render independently.
    const unsub = subscribeToSessionHistory(
      userId,
      records => setSessionHistory(records),
    );
    return unsub;
  }, [userId]);

  return { sessionHistory };
}
