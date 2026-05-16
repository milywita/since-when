import { PermissionsAndroid, Platform } from 'react-native';
import notifee, { AndroidImportance, TimestampTrigger, TriggerType } from '@notifee/react-native';

const SESSION_TIMER_CHANNEL_ID = 'session-timer';
const SESSION_TIMER_NOTIFICATION_ID = 'session-timer-ended';

async function requestAndroidNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  if (Platform.Version < 33) {
    return true;
  }
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const androidAllowed = await requestAndroidNotificationPermission();
  if (!androidAllowed) {
    return false;
  }
  if (Platform.OS === 'ios') {
    const settings = await notifee.requestPermission();
    return settings.authorizationStatus >= 1;
  }
  return true;
}

export async function ensureNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  await notifee.createChannel({
    id: SESSION_TIMER_CHANNEL_ID,
    name: 'Session timer',
    importance: AndroidImportance.HIGH,
  });
}

export async function cancelSessionTimerNotification(): Promise<void> {
  await notifee.cancelNotification(SESSION_TIMER_NOTIFICATION_ID);
  await notifee.cancelTriggerNotification(SESSION_TIMER_NOTIFICATION_ID);
}

export async function scheduleSessionTimerNotification(endsAt: number): Promise<void> {
  const triggerAt = Math.max(Date.now() + 1000, endsAt);
  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: triggerAt,
  };

  await notifee.createTriggerNotification(
    {
      id: SESSION_TIMER_NOTIFICATION_ID,
      title: "Time's up",
      body: 'Your Together session just ended. Extend or close it in the app.',
      android: {
        channelId: SESSION_TIMER_CHANNEL_ID,
        pressAction: { id: 'default' },
      },
    },
    trigger,
  );
}

export async function showSessionTimerNotificationNow(): Promise<void> {
  await notifee.displayNotification({
    id: SESSION_TIMER_NOTIFICATION_ID,
    title: "Time's up",
    body: 'Your Together session just ended. Extend or close it in the app.',
    android: {
      channelId: SESSION_TIMER_CHANNEL_ID,
      pressAction: { id: 'default' },
    },
  });
}

// ─── Reminder preview (dev / showcase) ───────────────────────────────────────

const REMINDER_PREVIEW_CHANNEL_ID = 'reminder-preview';

export async function ensureReminderPreviewChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  await notifee.createChannel({
    id: REMINDER_PREVIEW_CHANNEL_ID,
    name: 'Reminder preview',
    importance: AndroidImportance.HIGH,
  });
}

export async function showReminderPreviewNotification(title: string, body: string): Promise<void> {
  await notifee.displayNotification({
    title,
    body,
    android: {
      channelId: REMINDER_PREVIEW_CHANNEL_ID,
      pressAction: { id: 'default' },
    },
  });
}
