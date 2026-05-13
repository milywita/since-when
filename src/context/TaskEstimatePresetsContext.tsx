import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_TASK_ESTIMATE_PRESETS,
  TASK_ESTIMATE_PRESET_COUNT,
} from '../constants/defaultTaskEstimatePresets';
import type { TaskEstimatePreset } from '../types/TaskEstimatePreset';
import { presetChipLabelFromMs } from '../utils/taskEstimatePresetLabel';

const STORAGE_KEY = '@sinceWhen/taskEstimatePresets/v1';

const MIN_MS = 60 * 1000;
const MAX_MS = 30 * 24 * 60 * 60 * 1000;

function normalizePresets(parsed: unknown): TaskEstimatePreset[] | null {
  if (!Array.isArray(parsed) || parsed.length !== TASK_ESTIMATE_PRESET_COUNT) {
    return null;
  }
  const out: TaskEstimatePreset[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== 'object') {
      return null;
    }
    const o = row as { label?: unknown; ms?: unknown };
    const ms = Number(o.ms);
    if (!Number.isFinite(ms) || ms < MIN_MS || ms > MAX_MS) {
      return null;
    }
    const rounded = Math.round(ms);
    out.push({ label: presetChipLabelFromMs(rounded), ms: rounded });
  }
  const keys = out.map(p => p.ms);
  if (new Set(keys).size !== keys.length) {
    return null;
  }
  return out;
}

type TaskEstimatePresetsContextValue = {
  presets: TaskEstimatePreset[];
  /** Persist validated presets (replaces entire list). */
  setPresets: (next: TaskEstimatePreset[]) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  ready: boolean;
};

const TaskEstimatePresetsContext = createContext<TaskEstimatePresetsContextValue | null>(null);

export function TaskEstimatePresetsProvider({ children }: { children: ReactNode }) {
  const [presets, setPresetsState] = useState<TaskEstimatePreset[]>(DEFAULT_TASK_ESTIMATE_PRESETS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && !cancelled) {
          const parsed = JSON.parse(raw) as unknown;
          const n = normalizePresets(parsed);
          if (n) {
            setPresetsState(n);
          }
        }
      } catch {
        /* keep defaults */
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setPresets = useCallback(async (next: TaskEstimatePreset[]) => {
    const n = normalizePresets(next);
    if (!n) {
      return;
    }
    setPresetsState(n);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(n));
    } catch {
      /* ignore write errors */
    }
  }, []);

  const resetToDefaults = useCallback(async () => {
    const next = [...DEFAULT_TASK_ESTIMATE_PRESETS];
    setPresetsState(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ presets, setPresets, resetToDefaults, ready }),
    [presets, setPresets, resetToDefaults, ready],
  );

  return (
    <TaskEstimatePresetsContext.Provider value={value}>{children}</TaskEstimatePresetsContext.Provider>
  );
}

export function useTaskEstimatePresets(): TaskEstimatePresetsContextValue {
  const ctx = useContext(TaskEstimatePresetsContext);
  if (!ctx) {
    throw new Error('useTaskEstimatePresets must be used within TaskEstimatePresetsProvider');
  }
  return ctx;
}
