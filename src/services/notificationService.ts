import { AppState, PermissionsAndroid, Platform } from 'react-native';
import notifee, { AndroidImportance, TimestampTrigger, TriggerType } from '@notifee/react-native';

const SESSION_TIMER_CHANNEL_ID = 'session-timer';
const SESSION_TIMER_NOTIFICATION_ID = 'session-timer-ended';

/** Separate channel for partner activity (reactions, join requests). */
const PARTNER_ACTIVITY_CHANNEL_ID = 'partner-activity';
const PARTNER_ACTIVITY_CHANNEL_NAME = 'Partner activity';

// ─── Foreground guard ─────────────────────────────────────────────────────────

/**
 * Returns true when the app is running in the foreground.
 *
 * This is the single source of truth for the "should we push?" decision.
 * Every OS push function in this file calls this before displaying a notification.
 * Callers in UI components can also import it to branch between in-app and push paths.
 */
export function isAppForegrounded(): boolean {
  return AppState.currentState === 'active';
}

// ─── Permissions & channels ──────────────────────────────────────────────────

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
  await notifee.createChannel({
    id: PARTNER_ACTIVITY_CHANNEL_ID,
    name: PARTNER_ACTIVITY_CHANNEL_NAME,
    importance: AndroidImportance.HIGH,
  });
}

// ─── Partner activity notifications ──────────────────────────────────────────

/**
 * Show a local push notification for an incoming partner reaction.
 *
 * Suppressed automatically when the app is in the foreground — the caller is
 * responsible for showing the in-app PartnerReactionModal instead.
 * Call only when the user has partner reaction push notifications enabled.
 */
export async function showPartnerReactionNotification(params: {
  fromDisplayName: string;
  reactionText: string;
  taskTitle: string;
}): Promise<void> {
  // Defense-in-depth: never push while the user is looking at the screen.
  if (isAppForegrounded()) { return; }
  await notifee.displayNotification({
    title: `${params.fromDisplayName} reacted`,
    body: `"${params.reactionText}" on "${params.taskTitle}"`,
    android: {
      channelId: PARTNER_ACTIVITY_CHANNEL_ID,
      pressAction: { id: 'default' },
    },
  });
}

/**
 * Show a local push notification when a partner is requesting to join a session.
 *
 * Suppressed when the app is foregrounded — the host already sees the join
 * request UI inside the session screen.
 */
export async function showJoinRequestNotification(displayName: string): Promise<void> {
  // Host is actively in the session; the in-app request banner handles this.
  if (isAppForegrounded()) { return; }
  await notifee.displayNotification({
    title: 'Someone wants to join',
    body: `${displayName} is requesting to join your Together session.`,
    android: {
      channelId: PARTNER_ACTIVITY_CHANNEL_ID,
      pressAction: { id: 'default' },
    },
  });
}

// ─── Session timer notifications ──────────────────────────────────────────────

export async function cancelSessionTimerNotification(): Promise<void> {
  await notifee.cancelNotification(SESSION_TIMER_NOTIFICATION_ID);
  await notifee.cancelTriggerNotification(SESSION_TIMER_NOTIFICATION_ID);
}

/**
 * Schedule a background push notification to fire when the session timer ends.
 *
 * Two guards are applied:
 * 1. If `endsAt` is already in the past the session has expired before we could
 *    schedule (e.g. the user rejoins an already-ended session). We cancel any
 *    stale trigger instead of re-scheduling — this prevents an immediate spurious push.
 * 2. The trigger itself is only useful for when the user has backgrounded the app.
 *    The JS-side `timerExpired` effect cancels it when the timer fires while the
 *    app is in the foreground, so the in-app UI handles expiry instead.
 */
export async function scheduleSessionTimerNotification(endsAt: number): Promise<void> {
  // Guard: session time has already passed — cancel any stale trigger and bail.
  // Scheduling for a past timestamp would cause Notifee to fire immediately.
  if (endsAt <= Date.now()) {
    await cancelSessionTimerNotification();
    return;
  }

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: endsAt,
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

/**
 * Fire the session-ended push immediately (used when JS detects expiry while the
 * app is backgrounded).
 *
 * Suppressed when the app is foregrounded — the in-app expired-timer UI already
 * communicates this. The caller should also cancel the scheduled trigger first to
 * prevent a duplicate OS notification from the Notifee trigger.
 */
export async function showSessionTimerNotificationNow(): Promise<void> {
  // Never show a push while the user can see the timer expire in-app.
  if (isAppForegrounded()) { return; }
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
