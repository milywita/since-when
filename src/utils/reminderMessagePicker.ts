import {
  NOTIFICATION_TEMPLATES,
  type ReminderTone,
  type ReminderEvent,
} from '../constants/notificationTemplates';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReminderType =
  | 'overdue_focused'   // focused task has exceeded its time threshold
  | 'not_started'       // unfocused task has been sitting idle too long
  | 'completed_on_time' // task completed within estimate
  | 'completed_late';   // task completed after estimate (or no estimate)

export type PickedMessage = {
  message: string;
  /** Unique identifier used to avoid repeating the same message. */
  messageId: string;
  emoji: string;
};

// ─── Emoji pools ──────────────────────────────────────────────────────────────

const REMINDER_EMOJIS = ['🔥', '👀', '🙃', '✨', '🎯', '⚡️', '😈'] as const;
const COMPLETION_EMOJIS = ['🎉', '✅', '🏆', '⭐', '🎊'] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getReminderEvent(type: ReminderType): ReminderEvent {
  if (type === 'completed_on_time') {
    return 'finished_on_time';
  }
  if (type === 'completed_late') {
    return 'finished_late';
  }
  // Both 'overdue_focused' and 'not_started' use the same template bucket
  return 'overdue_or_taking_long';
}

/** Stable string key that uniquely identifies one message in the templates. */
function makeMessageId(tone: ReminderTone, event: ReminderEvent, index: number): string {
  return `${tone}:${event}:${index}`;
}

function pickEmoji(type: ReminderType): string {
  const pool = type === 'completed_on_time' || type === 'completed_late'
    ? COMPLETION_EMOJIS
    : REMINDER_EMOJIS;
  return pool[Math.floor(Math.random() * pool.length)] ?? pool[0];
}


// ─── Main picker ──────────────────────────────────────────────────────────────

/**
 * Picks a reminder message for `type`, avoiding the last N shown message IDs.
 *
 * Falls back to picking from all messages if every candidate was recently shown.
 * Default tone is 'sarcastic' — matches the app's default personality.
 */
export function pickReminderMessage(
  type: ReminderType,
  recentIds: string[],
  tone: ReminderTone = 'sarcastic',
): PickedMessage {
  const event = getReminderEvent(type);
  const messages = NOTIFICATION_TEMPLATES[tone][event] as readonly string[];

  // Prefer messages not in the recent history window
  const unusedIndices = messages
    .map((_, i) => i)
    .filter(i => !recentIds.includes(makeMessageId(tone, event, i)));

  // Fall back to all indices if everything was recently used (full reset)
  const candidates = unusedIndices.length > 0
    ? unusedIndices
    : messages.map((_, i) => i);

  const idx = candidates[Math.floor(Math.random() * candidates.length)] ?? 0;
  const message = messages[idx] ?? messages[0] ?? '';

  return {
    message,
    messageId: makeMessageId(tone, event, idx),
    emoji: pickEmoji(type),
  };
}
