/**
 * Placeholder preference types for the Settings UI.
 * TODO: Align with real user settings / Firestore schema when persistence ships.
 */

/** Sarcasm / reminder tone — how copy sounds when the app nudges you (placeholder only). */
export type SarcasmLevel = 'formal' | 'softie' | 'sarcastic' | 'mystic';

/** Global default for new tasks — per-task overrides planned (placeholder only). */
export type ReminderPreset = 'silent' | 'normal' | 'annoyMe' | 'partnerOnly';
