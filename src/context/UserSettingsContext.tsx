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
import type { SarcasmLevel, ReminderPreset } from '../types/settingsPreferences';
import { SETTINGS_DEFAULTS } from '../types/settingsPreferences';

const STORAGE_KEY = '@sinceWhen/userSettings/v1';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserSettings = {
  sarcasmLevel: SarcasmLevel;
  reminderPreset: ReminderPreset;
  /**
   * Partner reaction nudges (OS / in-session). When off, reactions still appear in Activity.
   * Forced off while Reminder Frequency is Silent; previous value is restored when leaving Silent.
   */
  partnerReactionPushEnabled: boolean;
  /**
   * Snapshot of `partnerReactionPushEnabled` taken when entering Silent mode.
   * Restored when switching to any non-Silent reminder frequency.
   */
  partnerReactionPushBeforeSilent: boolean;
};

const DEFAULT_SETTINGS: UserSettings = {
  sarcasmLevel: SETTINGS_DEFAULTS.sarcasmLevel as SarcasmLevel,
  reminderPreset: SETTINGS_DEFAULTS.reminderPreset as ReminderPreset,
  partnerReactionPushEnabled: true,
  partnerReactionPushBeforeSilent: true,
};

// ─── Context ──────────────────────────────────────────────────────────────────

type ContextValue = {
  settings: UserSettings;
  setSarcasmLevel: (v: SarcasmLevel) => void;
  setReminderPreset: (v: ReminderPreset) => void;
  setPartnerReactionPushEnabled: (v: boolean) => void;
  ready: boolean;
};

const UserSettingsContext = createContext<ContextValue>({
  settings: DEFAULT_SETTINGS,
  setSarcasmLevel: () => {},
  setReminderPreset: () => {},
  setPartnerReactionPushEnabled: () => {},
  ready: false,
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function UserSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  // Keep a stable ref so async callbacks always write the freshest state
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Partial<UserSettings> & {
              pushNotificationsEnabled?: boolean;
            };
            const { pushNotificationsEnabled: _legacyPush, ...parsedRest } = parsed;
            setSettings(prev => {
              const merged: UserSettings = { ...prev, ...parsedRest };
              if (merged.partnerReactionPushBeforeSilent === undefined) {
                merged.partnerReactionPushBeforeSilent =
                  merged.reminderPreset === 'silent'
                    ? true
                    : (merged.partnerReactionPushEnabled ?? true);
              }
              return merged;
            });
          } catch {
            /* keep defaults on malformed data */
          }
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const update = useCallback((patch: Partial<UserSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const setSarcasmLevel = useCallback(
    (v: SarcasmLevel) => update({ sarcasmLevel: v }),
    [update],
  );
  const setReminderPreset = useCallback(
    (v: ReminderPreset) => {
      setSettings(prev => {
        const wasSilent = prev.reminderPreset === 'silent';
        const goingSilent = v === 'silent';
        let next: UserSettings = { ...prev, reminderPreset: v };

        if (goingSilent && !wasSilent) {
          next = {
            ...next,
            partnerReactionPushBeforeSilent: prev.partnerReactionPushEnabled,
            partnerReactionPushEnabled: false,
          };
        } else if (wasSilent && !goingSilent) {
          next = {
            ...next,
            partnerReactionPushEnabled: prev.partnerReactionPushBeforeSilent,
          };
        }

        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [],
  );
  const setPartnerReactionPushEnabled = useCallback(
    (v: boolean) => {
      setSettings(prev => {
        if (prev.reminderPreset === 'silent') {
          return prev;
        }
        const next = { ...prev, partnerReactionPushEnabled: v };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [],
  );

  const value = useMemo(
    () => ({
      settings,
      setSarcasmLevel,
      setReminderPreset,
      setPartnerReactionPushEnabled,
      ready,
    }),
    [settings, setSarcasmLevel, setReminderPreset, setPartnerReactionPushEnabled, ready],
  );

  return (
    <UserSettingsContext.Provider value={value}>
      {children}
    </UserSettingsContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useUserSettings(): ContextValue {
  return useContext(UserSettingsContext);
}
