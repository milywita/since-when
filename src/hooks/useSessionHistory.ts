import { useState, useEffect } from 'react';
import auth from '@react-native-firebase/auth';
import { subscribeToSessionHistory } from '../services/historyService';
import type { SessionHistoryRecord } from '../types/Session';

export function useSessionHistory() {
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const userId = auth().currentUser?.uid ?? '';

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const unsub = subscribeToSessionHistory(
      userId,
      records => {
        setSessionHistory(records);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [userId]);

  return { sessionHistory, loading };
}
