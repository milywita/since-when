import {
  NOTIFICATION_TEMPLATES,
  type NotificationTemplates,
} from '../constants/notificationTemplates';

function flattenTemplates(templates: NotificationTemplates): string[] {
  const lines: string[] = [];
  for (const groups of Object.values(templates)) {
    lines.push(...groups.overdue_or_taking_long);
    lines.push(...groups.finished_on_time);
    lines.push(...groups.finished_late);
  }
  return lines;
}

const ALL_LINES = flattenTemplates(NOTIFICATION_TEMPLATES);

/** Uniform random line from every tone/event bucket in `NOTIFICATION_TEMPLATES`. */
export function pickRandomNotificationLine(): string {
  const idx = Math.floor(Math.random() * ALL_LINES.length);
  return ALL_LINES[idx] ?? ALL_LINES[0] ?? '';
}
