import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@sinceWhen/activityCenter/v1';
const MAX_ITEMS = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

/** One entry in the persistent activity feed (partner reactions/nudges). */
export type ActivityItem = {
  /**
   * Stable ID: `sessionId:sentAt:message` — prevents duplicate insertions.
   * Old items (pre-migration) used `:text` suffix instead; both are unique.
   */
  id: string;
  type: 'reaction';
  /** Firestore userId of the person who sent the reaction. */
  fromUserId?: string;
  fromDisplayName: string;
  /** The taskId the reaction was sent for. */
  taskId?: string;
  taskTitle: string;
  /** The reaction text (e.g. "Killing it!"). Replaces the old `text` field. */
  message: string;
  /** Unix ms when the reaction was created (same value as sentAt). */
  createdAt: number;
  /** Legacy alias for createdAt — kept for ID deduplication across storage versions. */
  sentAt: number;
  sessionId: string;
  /** Unix ms when the user read this item, or null/undefined if unread. */
  readAt?: number | null;
};

type PersistedData = {
  items: ActivityItem[];
  lastReadAt: number;
};

// ─── Context ──────────────────────────────────────────────────────────────────

type ContextValue = {
  items: ActivityItem[];
  unreadCount: number;
  /**
   * Add a new reaction to the feed. Duplicates (same id) are silently ignored.
   * The list is capped at 10 items (newest first).
   */
  addActivity: (item: Omit<ActivityItem, 'id'>) => void;
  markAllRead: () => void;
  ready: boolean;
};

const ActivityCenterContext = createContext<ContextValue>({
  items: [],
  unreadCount: 0,
  addActivity: () => {},
  markAllRead: () => {},
  ready: false,
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ActivityCenterProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [lastReadAt, setLastReadAt] = useState(0);
  const [ready, setReady] = useState(false);

  // Tracks IDs already in the list to deduplicate across calls
  const seenIdsRef = useRef<Set<string>>(new Set());
  // Stable ref so persist callback doesn't stale-close over lastReadAt
  const lastReadAtRef = useRef(lastReadAt);
  useEffect(() => { lastReadAtRef.current = lastReadAt; }, [lastReadAt]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (raw) {
          try {
            const data = JSON.parse(raw) as PersistedData;
            const loaded = data.items ?? [];
            setItems(loaded);
            setLastReadAt(data.lastReadAt ?? 0);
            seenIdsRef.current = new Set(loaded.map(i => i.id));
          } catch {
            /* start fresh on malformed data */
          }
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const persist = useCallback((nextItems: ActivityItem[], nextLastReadAt: number) => {
    const data: PersistedData = { items: nextItems, lastReadAt: nextLastReadAt };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => {});
  }, []);

  const addActivity = useCallback(
    (raw: Omit<ActivityItem, 'id'>) => {
      // Use message for the stable ID (message === reaction text, same as old `text`)
      const id = `${raw.sessionId}:${raw.sentAt}:${raw.message}`;
      if (seenIdsRef.current.has(id)) {
        return;
      }
      seenIdsRef.current.add(id);
      const newItem: ActivityItem = { ...raw, id };
      setItems(prev => {
        const next = [newItem, ...prev].slice(0, MAX_ITEMS);
        persist(next, lastReadAtRef.current);
        return next;
      });
    },
    [persist],
  );

  const markAllRead = useCallback(() => {
    const now = Date.now();
    setLastReadAt(now);
    setItems(prev => {
      persist(prev, now);
      return prev;
    });
  }, [persist]);

  const unreadCount = useMemo(
    () => items.filter(i => i.sentAt > lastReadAt).length,
    [items, lastReadAt],
  );

  const value = useMemo(
    () => ({ items, unreadCount, addActivity, markAllRead, ready }),
    [items, unreadCount, addActivity, markAllRead, ready],
  );

  return (
    <ActivityCenterContext.Provider value={value}>
      {children}
    </ActivityCenterContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useActivityCenter(): ContextValue {
  return useContext(ActivityCenterContext);
}
