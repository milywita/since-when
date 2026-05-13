/**
 * Placeholder preference types for the Settings UI.
 * TODO: Align with real user settings / Firestore schema when persistence ships.
 */

/** Sarcasm / reminder tone — how copy sounds when the app nudges you (placeholder only). */
export type SarcasmLevel = 'formal' | 'softie' | 'sarcastic' | 'mystic';

/** Global default for new tasks — per-task overrides planned (placeholder only). */
export type ReminderPreset = 'silent' | 'normal' | 'annoyMe' | 'partnerOnly';

/** Task-level urgency marker (placeholder until persistence/backend wiring ships). */
export type TaskPriority = 'low' | 'normal' | 'high';

/** Together visibility for a single task (placeholder policy; enforcement not implemented yet). */
export type TogetherVisibility = 'visible' | 'hidden';

/** Task category used for future stats and smarter reminders. */
export type TaskType =
  | 'Study'
  | 'Work'
  | 'Cleaning'
  | 'Fitness'
  | 'Cooking'
  | 'Admin'
  | 'Bureaucracy'
  | 'Social'
  | 'Creative'
  | 'Shopping'
  | 'Health'
  | 'Self-care'
  | 'Maintenance'
  | 'Errand'
  | 'Deep work'
  | 'Tiny task'
  | 'Repeating chore'
  | 'Anxiety task'
  | 'Other';

export const TASK_TYPE_OPTIONS: TaskType[] = [
  'Study',
  'Work',
  'Cleaning',
  'Fitness',
  'Cooking',
  'Admin',
  'Bureaucracy',
  'Social',
  'Creative',
  'Shopping',
  'Health',
  'Self-care',
  'Maintenance',
  'Errand',
  'Deep work',
  'Tiny task',
  'Repeating chore',
  'Anxiety task',
  'Other',
];

export type SettingsDefaults = {
  sarcasmLevel: SarcasmLevel;
  reminderPreset: ReminderPreset;
  taskPriority: TaskPriority;
  taskType: TaskType;
  togetherVisibility: TogetherVisibility;
};

/** Shared defaults used by both Settings preview UI and task creation draft state. */
export const SETTINGS_DEFAULTS: SettingsDefaults = {
  sarcasmLevel: 'sarcastic',
  reminderPreset: 'silent',
  taskPriority: 'normal',
  taskType: 'Other',
  togetherVisibility: 'visible',
};
