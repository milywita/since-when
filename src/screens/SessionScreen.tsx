import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
  Share,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { Screen } from '../components/ui/Screen';
import { PartnerCard } from '../components/session/PartnerCard';
import { SessionTimerCard } from '../components/session/SessionTimerCard';
import { theme } from '../theme/themes';
import { useSession } from '../hooks/useSession';
import { SwipeableRow } from '../components/SwipeableRow';
import { subscribeToUserProfile } from '../services/userService';
import {
  subscribeToJoinRequests,
  approveJoinRequest,
  denyJoinRequest,
} from '../services/sessionService';
import type { SessionMember, SessionTask, Reaction, JoinRequest } from '../types/Session';
import {
  REACTION_OPTIONS_ACTIVE,
  REACTION_OPTIONS_COMPLETED,
  MAX_SESSION_TASKS,
  EXTEND_PRESETS,
} from '../types/Session';
import type { UserProfile } from '../types/User';
import type { AppScreenProps } from '../navigation/types';
import {
  requestNotificationPermissions,
  ensureNotificationChannel,
  scheduleSessionTimerNotification,
  cancelSessionTimerNotification,
  showSessionTimerNotificationNow,
} from '../services/notificationService';
import { TaskReactions } from '../components/session/TaskReactions';
import { formatElapsed } from '../utils/formatElapsed';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCountdown(ms: number): string {
  if (ms <= 0) { return '0:00'; }
  const totalSec = Math.ceil(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function useDoneFlash() {
  const opacity = useRef(new Animated.Value(0)).current;
  const [message, setMessage] = useState('');
  const flash = useCallback((msg: string) => {
    setMessage(msg);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2800),
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [opacity]);
  return { opacity, message, flash };
}

// ─── Time estimate presets (mirrors solo mode) ────────────────────────────────

const SESSION_TIME_PRESETS: { label: string; ms: number }[] = [
  { label: '15m',   ms: 15 * 60 * 1000 },
  { label: '30m',   ms: 30 * 60 * 1000 },
  { label: '1h',    ms: 60 * 60 * 1000 },
  { label: '2h',    ms: 2 * 60 * 60 * 1000 },
  { label: '4h',    ms: 4 * 60 * 60 * 1000 },
  { label: '1 day', ms: 24 * 60 * 60 * 1000 },
];

// ─── Add task modal ───────────────────────────────────────────────────────────

type AddTaskModalProps = {
  visible: boolean;
  onClose: () => void;
  onAdd: (title: string, estimatedMs: number | null) => Promise<void>;
  atLimit: boolean;
};

function AddTaskModal({ visible, onClose, onAdd, atLimit }: AddTaskModalProps) {
  const [text, setText] = useState('');
  const [selectedMs, setSelectedMs] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    const trimmed = text.trim();
    if (!trimmed) { return; }
    setSaving(true);
    try {
      await onAdd(trimmed, selectedMs);
      setText('');
      setSelectedMs(null);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setText('');
    setSelectedMs(null);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={handleClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          {atLimit ? (
            <>
              <Text style={styles.modalTitle}>Task limit reached</Text>
              <Text style={styles.modalSubtitle}>
                You can bring up to {MAX_SESSION_TASKS} tasks into a session.
              </Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={handleClose}>
                <Text style={styles.modalCloseBtnText}>Got it</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.modalTitle}>What are you working on?</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Fix the login bug"
                placeholderTextColor={theme.colors.textSoft}
                value={text}
                onChangeText={setText}
                autoFocus
                multiline
                maxLength={120}
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={handleAdd}
              />
              <Text style={styles.estimateLabel}>How long will it take?</Text>
              <View style={styles.estimateRow}>
                {SESSION_TIME_PRESETS.map(p => (
                  <TouchableOpacity
                    key={p.ms}
                    style={[
                      styles.estimateChip,
                      selectedMs === p.ms && styles.estimateChipSelected,
                    ]}
                    onPress={() => setSelectedMs(prev => prev === p.ms ? null : p.ms)}>
                    <Text style={[
                      styles.estimateChipText,
                      selectedMs === p.ms && styles.estimateChipTextSelected,
                    ]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.modalAddBtn, !text.trim() && styles.modalAddBtnDisabled]}
                onPress={handleAdd}
                disabled={!text.trim() || saving}>
                {saving
                  ? <ActivityIndicator color={theme.colors.primaryText} />
                  : <Text style={styles.modalAddBtnText}>Add to session</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Reaction picker ──────────────────────────────────────────────────────────

type ReactionPickerProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (text: string) => Promise<void>;
  canReact: boolean;
  reactionCount: number;
  isCompleted: boolean;
};

function ReactionPicker({ visible, onClose, onSelect, canReact, reactionCount, isCompleted }: ReactionPickerProps) {
  const [sending, setSending] = useState(false);
  const options = isCompleted ? REACTION_OPTIONS_COMPLETED : REACTION_OPTIONS_ACTIVE;
  const title = isCompleted ? 'Celebrate the win' : 'Send a reaction';
  const remaining = 3 - reactionCount;

  async function handleSelect(text: string) {
    setSending(true);
    try {
      await onSelect(text);
      onClose();
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.reactionSheet}>
        {canReact ? (
          <>
            <Text style={styles.reactionTitle}>{title}</Text>
            <Text style={styles.reactionMeta}>
              {remaining} {remaining === 1 ? 'reaction' : 'reactions'} left for this task
            </Text>
            <View style={styles.reactionOptions}>
              {options.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={styles.reactionBtn}
                  onPress={() => handleSelect(opt)}
                  disabled={sending}>
                  <Text style={styles.reactionBtnText}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.reactionTitle}>Reaction limit reached</Text>
            <Text style={styles.reactionMeta}>3 reactions per task per session.</Text>
            <TouchableOpacity style={styles.reactionCloseBtn} onPress={onClose}>
              <Text style={styles.reactionCloseBtnText}>OK</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

// ─── Extend timer overlay ─────────────────────────────────────────────────────

type ExtendOverlayProps = {
  isHost: boolean;
  hostName: string;
  onExtend: (ms: number) => Promise<void>;
  onCustomExtend: (minutes: number) => Promise<void>;
  onEnd: () => Promise<void>;
  onLeave?: () => void;
};

function ExtendOverlay({ isHost, hostName, onExtend, onCustomExtend, onEnd, onLeave }: ExtendOverlayProps) {
  const [busy, setBusy] = useState(false);
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [customInput, setCustomInput] = useState('');

  async function handleExtend(ms: number) {
    setBusy(true);
    try { await onExtend(ms); } finally { setBusy(false); }
  }

  async function handleEnd() {
    setBusy(true);
    try { await onEnd(); } finally { setBusy(false); }
  }

  async function handleCustomExtend() {
    const minutes = parseInt(customInput, 10);
    if (Number.isNaN(minutes) || minutes < 1) {
      return;
    }
    setBusy(true);
    try {
      await onCustomExtend(minutes);
      setCustomModalVisible(false);
      setCustomInput('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.extendOverlay}>
      <View style={styles.extendCard}>
        <Text style={styles.extendTitle}>Time's up.</Text>
        {isHost ? (
          <>
            <Text style={styles.extendSubtitle}>
              Keep going or call it done?
            </Text>
            <View style={styles.extendBtns}>
              {EXTEND_PRESETS.map(p => (
                <TouchableOpacity
                  key={p.ms}
                  style={[styles.extendChip, busy && styles.extendChipDisabled]}
                  onPress={() => handleExtend(p.ms)}
                  disabled={busy}>
                  <Text style={styles.extendChipText}>{p.label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.extendChip, busy && styles.extendChipDisabled]}
                onPress={() => setCustomModalVisible(true)}
                disabled={busy}>
                <Text style={styles.extendChipText}>Custom</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.extendEndBtn, busy && styles.extendChipDisabled]}
              onPress={() =>
                Alert.alert(
                  'End session?',
                  'This will end the session for everyone.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'End', style: 'destructive', onPress: handleEnd },
                  ],
                )
              }
              disabled={busy}>
              <Text style={styles.extendEndBtnText}>End session</Text>
            </TouchableOpacity>

            <Modal
              visible={customModalVisible}
              transparent
              animationType="slide"
              onRequestClose={() => setCustomModalVisible(false)}>
              <KeyboardAvoidingView
                style={styles.modalOverlay}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <TouchableOpacity
                  style={styles.modalBackdrop}
                  activeOpacity={1}
                  onPress={() => setCustomModalVisible(false)}
                />
                <View style={styles.modalSheet}>
                  <View style={styles.modalHandle} />
                  <Text style={styles.modalTitle}>Extend session</Text>
                  <Text style={styles.modalSubtitle}>Enter minutes to add</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 35"
                    placeholderTextColor="#555"
                    value={customInput}
                    onChangeText={v => setCustomInput(v.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    autoFocus
                    maxLength={4}
                  />
                  <TouchableOpacity
                    style={[
                      styles.modalAddBtn,
                      (!customInput || parseInt(customInput, 10) < 1 || busy) && styles.modalAddBtnDisabled,
                    ]}
                    disabled={!customInput || parseInt(customInput, 10) < 1 || busy}
                    onPress={handleCustomExtend}>
                    {busy
                      ? <ActivityIndicator color="#0d0d0d" />
                      : <Text style={styles.modalAddBtnText}>Add time</Text>}
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </Modal>
          </>
        ) : (
          <>
            <Text style={styles.extendSubtitle}>
              Waiting for {hostName} to extend or end the session…
            </Text>
            <TouchableOpacity
              style={styles.extendEndBtn}
              onPress={() =>
                Alert.alert(
                  'Leave session?',
                  'You can rejoin later if the session is still active.',
                  [
                    { text: 'Stay', style: 'cancel' },
                    { text: 'Leave', style: 'destructive', onPress: onLeave },
                  ],
                )
              }>
              <Text style={styles.extendEndBtnText}>Leave session</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

// ─── My task row ──────────────────────────────────────────────────────────────

type MyTaskRowProps = {
  task: SessionTask;
  now: number;
  isActive: boolean;
  receivedReactions: Reaction[];
  onComplete: () => void;
  onSetActive: () => void;
  onClearActive: () => void;
};

function MyTaskRow({ task, now, isActive, receivedReactions, onComplete, onSetActive, onClearActive }: MyTaskRowProps) {
  const elapsed = now - task.createdAt;
  const isOld = elapsed > 86400 * 1000;
  const isDone = task.completedAt !== null;
  const overEstimate = task.estimatedMs != null && elapsed > task.estimatedMs;

  if (isActive && !isDone) {
    return (
      <View style={styles.focusWrap}>
        <SessionTimerCard
          task={task}
          now={now}
          onComplete={onComplete}
          onClearFocus={onClearActive}
        />
        <TaskReactions reactions={receivedReactions} now={now} />
      </View>
    );
  }

  return (
    <View style={[styles.myTaskRow, isDone && styles.myTaskRowDone]}>
      <TouchableOpacity
        style={styles.activeDot}
        onPress={isDone ? undefined : onSetActive}
        hitSlop={8}>
        <View style={styles.activeDotInner} />
      </TouchableOpacity>
      <View style={styles.myTaskInfo}>
        <Text style={[styles.myTaskTitle, isDone && styles.myTaskTitleDone]} numberOfLines={2}>
          {task.title}
        </Text>
        {!isDone && (
          <View style={styles.myTaskMeta}>
            <Text style={[styles.myTaskTimer, (isOld || overEstimate) && styles.myTaskTimerOld]}>
              {formatElapsed(elapsed)}
            </Text>
            {task.estimatedMs != null && (
              <Text style={[styles.myTaskEstimate, overEstimate && styles.myTaskEstimateOver]}>
                {overEstimate
                  ? `over by ${formatElapsed(elapsed - task.estimatedMs)}`
                  : `est. ${formatElapsed(task.estimatedMs)}`}
              </Text>
            )}
          </View>
        )}
        {isDone && (
          <Text style={styles.myTaskDoneLabel}>
            Done in {formatElapsed((task.completedAt ?? 0) - task.createdAt)}
          </Text>
        )}
        <TaskReactions reactions={receivedReactions} now={now} />
      </View>
      {!isDone && (
        <TouchableOpacity style={styles.myDoneBtn} onPress={onComplete} hitSlop={8}>
          <Text style={styles.myDoneBtnText}>Done</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Join request popup (host sees this) ─────────────────────────────────────

type JoinRequestPopupProps = {
  request: JoinRequest;
  onApprove: () => void;
  onDeny: () => void;
  busy: boolean;
};

function JoinRequestPopup({ request, onApprove, onDeny, busy }: JoinRequestPopupProps) {
  return (
    <View style={styles.joinPopupOverlay} pointerEvents="box-none">
      <View style={styles.joinPopupCard}>
        <View style={styles.joinPopupHeader}>
          <View style={styles.joinPopupDot} />
          <Text style={styles.joinPopupName}>{request.displayName}</Text>
          <Text style={styles.joinPopupLabel}>wants to join</Text>
        </View>
        {request.tasks.length > 0 && (
          <Text style={styles.joinPopupMeta}>
            Bringing {request.tasks.length} task{request.tasks.length !== 1 ? 's' : ''}
          </Text>
        )}
        <View style={styles.joinPopupBtns}>
          <TouchableOpacity
            style={[styles.joinDenyBtn, busy && styles.joinBtnDisabled]}
            onPress={onDeny}
            disabled={busy}>
            <Text style={styles.joinDenyBtnText}>Not now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.joinApproveBtn, busy && styles.joinBtnDisabled]}
            onPress={onApprove}
            disabled={busy}>
            {busy
              ? <ActivityIndicator color={theme.colors.onAccent} size="small" />
              : <Text style={styles.joinApproveBtnText}>Let them in</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Session ended overlay ────────────────────────────────────────────────────

type EndedOverlayProps = {
  onBack: () => void;
  myMember: SessionMember | null;
};

function EndedOverlay({ onBack, myMember }: EndedOverlayProps) {
  const completed = myMember?.tasks.filter(t => t.completedAt !== null) ?? [];
  const total = myMember?.tasks.length ?? 0;
  return (
    <View style={styles.endedOverlay}>
      <Text style={styles.endedTitle}>Session over.</Text>
      <Text style={styles.endedSubtitle}>
        {completed.length > 0
          ? `You completed ${completed.length} of ${total} task${total !== 1 ? 's' : ''}.`
          : 'No tasks completed this session. Remaining ones are still in Solo.'}
      </Text>
      {completed.map(t => (
        <View key={t.taskId} style={styles.endedTask}>
          <Text style={styles.endedTaskMark}>✓</Text>
          <Text style={styles.endedTaskTitle}>{t.title}</Text>
        </View>
      ))}
      <TouchableOpacity style={styles.endedBackBtn} onPress={onBack}>
        <Text style={styles.endedBackBtnText}>Back to Solo</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

type Props = AppScreenProps<'Session'>;

export default function SessionScreen({ route, navigation }: Props) {
  const { sessionId } = route.params;
  const {
    session,
    myMember,
    otherMembers,
    members,
    reactions,
    loading,
    error,
    userId,
    isHost,
    canReact,
    myReactionCountForTask,
    endSession,
    clearActiveSession,
    leaveSession,
    extendSession,
    addTask,
    removeTask,
    completeTask,
    setActiveTask,
    sendReaction,
    finalizeSession,
  } = useSession(sessionId);

  const now = useNow();
  const { opacity: flashOpacity, message: flashMessage, flash } = useDoneFlash();
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [reactionTarget, setReactionTarget] = useState<{
    toUserId: string;
    taskId: string;
    completed: boolean;
  } | null>(null);

  // Invite code chip
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const currentUser = auth().currentUser;
  useEffect(() => {
    if (!currentUser?.uid) { return; }
    const unsub = subscribeToUserProfile(currentUser.uid, setUserProfile);
    return unsub;
  }, [currentUser?.uid]);

  // Join requests (host only)
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [handlingRequest, setHandlingRequest] = useState(false);
  useEffect(() => {
    if (!isHost || !sessionId) { return; }
    const unsub = subscribeToJoinRequests(sessionId, setJoinRequests);
    return unsub;
  }, [isHost, sessionId]);

  const pendingRequest = joinRequests[0] ?? null;

  async function handleApproveRequest(req: JoinRequest) {
    setHandlingRequest(true);
    try {
      await approveJoinRequest(sessionId, req.id, req.userId);
      flash(`${req.displayName} is in!`);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not approve request.');
    } finally {
      setHandlingRequest(false);
    }
  }

  async function handleDenyRequest(req: JoinRequest) {
    setHandlingRequest(true);
    try {
      await denyJoinRequest(sessionId, req.id);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not deny request.');
    } finally {
      setHandlingRequest(false);
    }
  }

  // "X joined" notification + record partner from this user's own side
  const prevMemberCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (loading) { return; }
    const prev = prevMemberCountRef.current;
    if (prev !== null && members.length > prev) {
      const newMembers = members.filter(
        m => m.userId !== userId && m.joinedAt > (Date.now() - 10000),
      );
      if (newMembers.length > 0) {
        flash(`${newMembers[0].displayName} joined the session.`);
        // Record the new member as a partner from the current user's own profile
        import('../services/userService').then(({ recordSessionPartner }) => {
          newMembers.forEach(m => {
            recordSessionPartner(userId, {
              userId: m.userId,
              username: m.displayName,
              lastSessionAt: Date.now(),
            }).catch(console.error);
          });
        });
      }
    }
    prevMemberCountRef.current = members.length;
  }, [members, loading, userId, flash]);

  // Incoming reaction notification — fire a flash when a new reaction lands on one of MY tasks
  const prevIncomingReactionIdsRef = useRef<Set<string>>(new Set());
  const incomingReactionsBootstrapped = useRef(false);
  useEffect(() => {
    if (loading) { return; }
    const incoming = reactions.filter(r => r.toUserId === userId);
    if (!incomingReactionsBootstrapped.current) {
      prevIncomingReactionIdsRef.current = new Set(incoming.map(r => r.id));
      incomingReactionsBootstrapped.current = true;
      return;
    }
    const fresh = incoming.filter(r => !prevIncomingReactionIdsRef.current.has(r.id));
    if (fresh.length > 0) {
      const r = fresh[0];
      const senderName = members.find(m => m.userId === r.fromUserId)?.displayName ?? 'Someone';
      const taskTitle = myMember?.tasks.find(t => t.taskId === r.taskId)?.title;
      flash(`${senderName}: "${r.text}"${taskTitle ? ` on "${taskTitle}"` : ''}`);
    }
    prevIncomingReactionIdsRef.current = new Set(incoming.map(r => r.id));
  }, [reactions, loading, userId, members, myMember, flash]);

  const myActiveTasks = myMember?.tasks.filter(t => t.completedAt === null) ?? [];
  const myCompletedTasks = myMember?.tasks.filter(t => t.completedAt !== null) ?? [];

  const timeLeft = session?.endsAt ? Math.max(0, session.endsAt - now) : null;
  const timerExpired = timeLeft !== null && timeLeft <= 0 && session?.status === 'active';
  const sessionEnded = session?.status === 'ended';
  const timerNotificationFiredRef = useRef(false);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      const granted = await requestNotificationPermissions();
      if (!granted || !alive) {
        return;
      }
      await ensureNotificationChannel();
    };
    run().catch(console.error);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!session?.endsAt || session.status !== 'active') {
        await cancelSessionTimerNotification();
        return;
      }
      await scheduleSessionTimerNotification(session.endsAt);
    };
    run().catch(() => {
      flash('Could not schedule background timer notification.');
    });
  }, [session?.endsAt, session?.status, flash]);

  useEffect(() => {
    if (!session?.endsAt || session.status !== 'active') {
      timerNotificationFiredRef.current = false;
      return;
    }
    if (timerExpired && !timerNotificationFiredRef.current) {
      timerNotificationFiredRef.current = true;
      showSessionTimerNotificationNow().catch(console.error);
    }
    if (!timerExpired) {
      timerNotificationFiredRef.current = false;
    }
  }, [timerExpired, session?.endsAt, session?.status]);

  // When the session ends, each user clears their own activeSessionId and syncs
  // session-only tasks back to Solo. (The host already cleared their own inside
  // endSession; calling it again is a harmless no-op for the host.)
  const syncedOnEndRef = useRef(false);
  useEffect(() => {
    if (sessionEnded && !syncedOnEndRef.current) {
      syncedOnEndRef.current = true;
      clearActiveSession().catch(console.error);
      finalizeSession().catch(console.error);
    }
  }, [sessionEnded, clearActiveSession, finalizeSession]);

  // Host name for the extend overlay non-host message
  const hostMember = members.find(m => m.userId === session?.createdBy);
  const hostName = hostMember?.displayName ?? 'the host';

  async function handleAddTask(title: string, estimatedMs: number | null) {
    const newTask: SessionTask = {
      taskId: `${userId}-${Date.now()}`,
      title,
      createdAt: Date.now(),
      completedAt: null,
      estimatedMs,
    };
    await addTask(newTask);
  }

  async function handleLeave() {
    // Save history and sync session-only tasks to Solo before removing the member doc.
    await finalizeSession().catch(console.error);
    leaveSession().catch(console.error);
    navigation.popToTop();
  }

  async function handleCompleteTask(task: SessionTask) {
    await completeTask(task);
    flash(`You did it. "${task.title}" — gone.`);
  }

  async function handleRemoveTask(task: SessionTask) {
    await removeTask(task.taskId);
  }

  function handleSetActive(taskId: string) {
    const current = myMember?.activeTaskId;
    setActiveTask(current === taskId ? null : taskId).catch(console.error);
  }

  async function handleSendReaction(text: string) {
    if (!reactionTarget) { return; }
    await sendReaction(reactionTarget.toUserId, reactionTarget.taskId, text);
    flash(`Sent: "${text}"`);
  }

  if (loading) {
    return (
      <Screen>
        <View style={styles.loadingRoot}>
          <ActivityIndicator size="large" color={theme.colors.text} />
        </View>
      </Screen>
    );
  }

  if (error || !session) {
    return (
      <Screen>
        <View style={styles.loadingRoot}>
          <Text style={styles.errorText}>{error ?? 'Session not found.'}</Text>
          <TouchableOpacity style={styles.errorBackBtn} onPress={() => navigation.popToTop()}>
            <Text style={styles.errorBackBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  if (sessionEnded) {
    return (
      <Screen safeArea edges={['top', 'bottom']}>
        <EndedOverlay myMember={myMember} onBack={() => navigation.popToTop()} />
      </Screen>
    );
  }

  const isTimerWarning = timeLeft !== null && timeLeft < 5 * 60 * 1000 && !timerExpired;

  return (
    <Screen safeArea edges={['top']}>
      {/* Flash banner */}
      <Animated.View style={[styles.flashBanner, { opacity: flashOpacity }]} pointerEvents="none">
        <Text style={styles.flashText}>{flashMessage}</Text>
      </Animated.View>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Since When</Text>
          <View style={styles.modeBadge}>
            <Text style={styles.modeBadgeText}>TOGETHER</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {timeLeft !== null && (
            <Text style={[
              styles.countdown,
              isTimerWarning && styles.countdownWarning,
              timerExpired && styles.countdownExpired,
            ]}>
              {timerExpired ? 'Time up' : formatCountdown(timeLeft)}
            </Text>
          )}
          {isHost && !timerExpired && (
            <TouchableOpacity
              style={styles.endBtn}
              onPress={() =>
                Alert.alert('End session?', 'This will end the session for everyone.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'End', style: 'destructive', onPress: () => endSession() },
                ])
              }>
              <Text style={styles.endBtnText}>End</Text>
            </TouchableOpacity>
          )}
          {!isHost && (
            <TouchableOpacity
              style={styles.leaveBtn}
              onPress={() =>
                Alert.alert('Leave session?', 'You can rejoin later using the host\'s invite code.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Leave', style: 'destructive', onPress: handleLeave },
                ])
              }>
              <Text style={styles.leaveBtnText}>Leave</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Time-expired overlay — sits over the rest of the screen */}
      {timerExpired && (
        <ExtendOverlay
          isHost={isHost}
          hostName={hostName}
          onExtend={extendSession}
          onCustomExtend={async minutes => extendSession(minutes * 60 * 1000)}
          onEnd={endSession}
          onLeave={isHost ? undefined : handleLeave}
        />
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* My tasks */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your tasks</Text>

          {myActiveTasks.length === 0 && myCompletedTasks.length === 0 && (
            <Text style={styles.emptyMy}>Add tasks you're working on this session.</Text>
          )}

          <View style={styles.taskGap}>
            {myActiveTasks.map(task => (
              <SwipeableRow
                key={task.taskId}
                onDelete={() => handleRemoveTask(task)}
                borderRadius={10}>
                <MyTaskRow
                  task={task}
                  now={now}
                  isActive={(myMember?.activeTaskId ?? null) === task.taskId}
                  receivedReactions={reactions.filter(r => r.taskId === task.taskId && r.toUserId === userId)}
                  onComplete={() => handleCompleteTask(task)}
                  onSetActive={() => handleSetActive(task.taskId)}
                  onClearActive={() => setActiveTask(null)}
                />
              </SwipeableRow>
            ))}
          </View>

          <TouchableOpacity
            style={styles.addTaskBtn}
            onPress={() => setAddModalVisible(true)}>
            <Text style={styles.addTaskBtnText}>+ Add task</Text>
          </TouchableOpacity>

          {myCompletedTasks.length > 0 && (
            <>
              <TouchableOpacity
                style={styles.completedToggle}
                onPress={() => setCompletedExpanded(e => !e)}
                activeOpacity={0.7}>
                <Text style={styles.completedToggleText}>
                  Done this session ({myCompletedTasks.length})
                </Text>
                <Text style={styles.completedToggleChevron}>
                  {completedExpanded ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>

              {completedExpanded && (
                <View style={styles.taskGap}>
                  {myCompletedTasks.map(task => (
                    <MyTaskRow
                      key={task.taskId}
                      task={task}
                      now={now}
                      isActive={false}
                      receivedReactions={reactions.filter(r => r.taskId === task.taskId && r.toUserId === userId)}
                      onComplete={() => {}}
                      onSetActive={() => {}}
                      onClearActive={() => {}}
                    />
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        {/* Active task hint when nothing is focused yet */}
        {myActiveTasks.length > 0 && myMember?.activeTaskId === null && (
          <View style={styles.focusHint}>
            <Text style={styles.focusHintText}>
              Tap the dot next to a task to set your focus. Your partner can see what you're working on. Swipe left to remove tasks.
            </Text>
          </View>
        )}

        {/* Invite code — shown while nobody else has joined yet */}
        {otherMembers.length === 0 && userProfile?.personalInviteCode && (
          <TouchableOpacity
            style={styles.inviteCard}
            onPress={() => Share.share({ message: userProfile.personalInviteCode })}
            activeOpacity={0.7}>
            <Text style={styles.inviteCardLabel}>YOUR INVITE CODE</Text>
            <Text style={styles.inviteCardCode}>{userProfile.personalInviteCode}</Text>
            <Text style={styles.inviteCardHint}>Tap to share · disappears when someone joins</Text>
          </TouchableOpacity>
        )}

        {/* Partner tasks */}
        {otherMembers.length === 0 && (
          <View style={styles.section}>
            <Text style={styles.waitingPartner}>Waiting for your partner to join…</Text>
          </View>
        )}

        {otherMembers.map(member => (
          <View key={member.userId} style={styles.section}>
            <PartnerCard
              member={member}
              now={now}
              recentReactions={reactions.filter(
                r => r.fromUserId === userId && r.toUserId === member.userId,
              )}
              onReact={(taskId, completed) =>
                setReactionTarget({ toUserId: member.userId, taskId, completed })
              }
            />
          </View>
        ))}
      </ScrollView>

      {/* Join request popup — host only, sits above everything */}
      {pendingRequest && (
        <JoinRequestPopup
          request={pendingRequest}
          onApprove={() => handleApproveRequest(pendingRequest)}
          onDeny={() => handleDenyRequest(pendingRequest)}
          busy={handlingRequest}
        />
      )}

      {/* Modals */}
      <AddTaskModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onAdd={handleAddTask}
        atLimit={(myMember?.tasks.length ?? 0) >= MAX_SESSION_TASKS}
      />

      {reactionTarget !== null && (
        <ReactionPicker
          visible
          onClose={() => setReactionTarget(null)}
          onSelect={handleSendReaction}
          canReact={canReact(reactionTarget.taskId)}
          reactionCount={myReactionCountForTask(reactionTarget.taskId)}
          isCompleted={reactionTarget.completed}
        />
      )}
    </Screen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const c = theme.colors;
const sp = theme.spacing;
const r = theme.radius;

const styles = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: sp.xl + sp.sm,
    gap: sp.lg,
  },
  errorText: {
    color: c.danger,
    fontSize: 15,
    textAlign: 'center',
  },
  errorBackBtn: {
    paddingVertical: 10,
    paddingHorizontal: sp.gutter,
  },
  errorBackBtnText: {
    color: c.textSoft,
    fontSize: 14,
  },

  // Flash
  flashBanner: {
    position: 'absolute',
    top: 60,
    left: sp.gutter,
    right: sp.gutter,
    zIndex: 100,
    backgroundColor: c.surface,
    borderRadius: r.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  flashText: {
    color: c.text,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: sp.gutter,
    paddingTop: sp.lg,
    paddingBottom: sp.sm,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: c.text,
    letterSpacing: -0.5,
  },
  modeBadge: {
    marginTop: sp.xs,
    alignSelf: 'flex-start',
    backgroundColor: c.surface,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: c.accent,
    letterSpacing: 1.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.md,
    marginTop: sp.xs,
  },
  countdown: {
    fontSize: 22,
    fontWeight: '700',
    color: c.text,
    fontVariant: ['tabular-nums'],
  },
  countdownWarning: {
    color: c.danger,
  },
  countdownExpired: {
    color: c.textSoft,
    fontSize: 14,
    fontWeight: '500',
  },
  // Invite card (shown in scroll body while no one has joined)
  inviteCard: {
    backgroundColor: c.accentSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.accentSurfaceBorder,
    padding: sp.gutter,
    alignItems: 'center',
    gap: 6,
  },
  inviteCardLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: c.accent,
    letterSpacing: 2,
  },
  inviteCardCode: {
    fontSize: 36,
    fontWeight: '700',
    color: c.text,
    letterSpacing: 8,
    fontVariant: ['tabular-nums'],
  },
  inviteCardHint: {
    fontSize: 11,
    color: c.textDim,
    marginTop: 2,
  },
  endBtn: {
    paddingVertical: 6,
    paddingHorizontal: sp.md,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: c.border,
  },
  endBtnText: {
    color: c.textSoft,
    fontSize: 13,
  },
  leaveBtn: {
    paddingVertical: 6,
    paddingHorizontal: sp.md,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: c.borderDanger,
  },
  leaveBtnText: {
    color: c.danger,
    fontSize: 13,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: sp.gutter,
    paddingBottom: 60,
    gap: sp.xl,
    paddingTop: sp.sm,
  },

  // Sections
  section: {},
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: sp.sm,
    marginBottom: 10,
  },
  sectionTitle: {
    color: c.text,
    fontSize: 16,
    fontWeight: '600',
  },
  sectionMeta: {
    color: c.textFaint,
    fontSize: 12,
  },
  emptyMy: {
    color: c.textFaint,
    fontSize: 14,
    marginBottom: sp.sm,
  },
  waitingPartner: {
    color: c.textFaint,
    fontSize: 14,
  },

  // Focus hint
  focusHint: {
    backgroundColor: c.accentSurface,
    borderRadius: r.sm,
    borderWidth: 1,
    borderColor: c.accentSurfaceBorder,
    paddingVertical: sp.md,
    paddingHorizontal: 14,
  },
  focusHintText: {
    color: c.accent,
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.8,
  },

  focusWrap: {
    gap: sp.sm,
    marginBottom: sp.sm,
  },

  taskGap: {
    gap: sp.sm,
  },

  // Regular my-task row
  myTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: r.sm,
    borderWidth: 1,
    borderColor: c.border,
    padding: sp.md,
    marginBottom: sp.sm,
    gap: 10,
  },
  myTaskRowDone: { opacity: 0.45 },
  activeDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: c.borderStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: c.border,
  },
  myTaskInfo: { flex: 1, gap: 2 },
  myTaskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  myTaskTitle: {
    color: c.text,
    fontSize: 15,
    fontWeight: '500',
  },
  myTaskTitleDone: {
    textDecorationLine: 'line-through',
    color: c.textSoft,
  },
  myTaskTimer: {
    color: c.textMuted,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  myTaskTimerOld: { color: c.danger },
  myTaskEstimate: {
    color: c.textSoft,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  myTaskEstimateOver: { color: c.dangerMuted },
  myTaskDoneLabel: { color: c.success, fontSize: 12 },
  myDoneBtn: {
    borderRadius: 7,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: 6,
    paddingHorizontal: sp.md,
  },
  myDoneBtnText: {
    color: c.text,
    fontSize: 12,
    fontWeight: '500',
  },
  addTaskBtn: {
    borderRadius: r.sm,
    borderWidth: 1,
    borderColor: c.border,
    borderStyle: 'dashed',
    paddingVertical: sp.md,
    alignItems: 'center',
    marginTop: 4,
  },
  addTaskBtnText: { color: c.textDim, fontSize: 14 },
  completedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginTop: sp.sm,
    borderTopWidth: 1,
    borderTopColor: c.borderInner,
  },
  completedToggleText: {
    color: c.textDim,
    fontSize: 13,
    fontWeight: '500',
  },
  completedToggleChevron: {
    color: c.textFaint,
    fontSize: 10,
  },


  // Extend overlay
  extendOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.backdropHeavy,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
    paddingHorizontal: sp.xxl,
  },
  extendCard: {
    width: '100%',
    backgroundColor: c.surfaceRaised,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.border,
    padding: 28,
    gap: sp.md,
    alignItems: 'center',
  },
  extendTitle: {
    color: c.text,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  extendSubtitle: {
    color: c.textSoft,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  extendBtns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sp.sm,
    marginTop: sp.xs,
    justifyContent: 'center',
  },
  extendChip: {
    backgroundColor: c.surface,
    borderRadius: r.sm,
    borderWidth: 1,
    borderColor: c.accent,
    paddingVertical: sp.md,
    paddingHorizontal: sp.gutter,
  },
  extendChipDisabled: { opacity: 0.4 },
  extendChipText: {
    color: c.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  extendEndBtn: {
    backgroundColor: 'transparent',
    borderRadius: r.sm,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: sp.md,
    alignItems: 'center',
    marginTop: sp.xs,
  },
  extendEndBtnText: {
    color: c.textSoft,
    fontSize: 14,
  },

  // Add task modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.backdropModal,
  },
  modalSheet: {
    backgroundColor: c.surfaceRaised,
    borderTopLeftRadius: r.xl,
    borderTopRightRadius: r.xl,
    paddingHorizontal: sp.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    paddingTop: sp.lg,
    borderWidth: 1,
    borderColor: c.border,
  },
  modalHandle: {
    width: 36,
    height: sp.xs,
    backgroundColor: c.borderStrong,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: c.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: sp.lg,
  },
  modalSubtitle: {
    color: c.textSoft,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: c.surface,
    color: c.text,
    borderRadius: r.sm,
    paddingHorizontal: sp.lg,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: sp.lg,
    minHeight: 52,
  },
  estimateLabel: {
    color: c.textSoft,
    fontSize: 13,
    marginBottom: 10,
    marginTop: sp.xs,
  },
  estimateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sp.sm,
    marginBottom: sp.lg,
  },
  estimateChip: {
    borderRadius: sp.sm,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  estimateChipSelected: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  estimateChipText: {
    color: c.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  estimateChipTextSelected: {
    color: c.primaryText,
  },
  modalAddBtn: {
    backgroundColor: c.primary,
    borderRadius: r.sm,
    paddingVertical: 15,
    alignItems: 'center',
  },
  modalAddBtnDisabled: { opacity: 0.3 },
  modalAddBtnText: {
    color: c.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
  modalCloseBtn: {
    backgroundColor: c.surface,
    borderRadius: r.sm,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.border,
  },
  modalCloseBtnText: {
    color: c.text,
    fontSize: 15,
    fontWeight: '500',
  },

  // Reaction picker
  reactionSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: c.surfaceRaised,
    borderTopLeftRadius: r.xl,
    borderTopRightRadius: r.xl,
    paddingHorizontal: sp.xl,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    paddingTop: sp.xl,
    borderWidth: 1,
    borderColor: c.border,
    gap: 10,
  },
  reactionTitle: {
    color: c.text,
    fontSize: 18,
    fontWeight: '600',
  },
  reactionMeta: { color: c.textSoft, fontSize: 13, marginBottom: sp.xs },
  reactionOptions: { gap: sp.sm },
  reactionBtn: {
    backgroundColor: c.surface,
    borderRadius: r.sm,
    paddingVertical: 13,
    paddingHorizontal: sp.lg,
    borderWidth: 1,
    borderColor: c.border,
  },
  reactionBtnText: {
    color: c.text,
    fontSize: 15,
    fontWeight: '500',
  },
  reactionCloseBtn: {
    backgroundColor: c.surface,
    borderRadius: r.sm,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.border,
  },
  reactionCloseBtnText: { color: c.textSoft, fontSize: 14 },

  // Join request popup
  joinPopupOverlay: {
    position: 'absolute',
    bottom: 100,
    left: sp.lg,
    right: sp.lg,
    zIndex: 200,
  },
  joinPopupCard: {
    backgroundColor: c.surface,
    borderRadius: r.lg,
    borderWidth: 1.5,
    borderColor: c.accent,
    padding: 18,
    gap: 10,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: sp.sm },
    shadowOpacity: 0.5,
    shadowRadius: sp.lg,
    elevation: sp.md,
  },
  joinPopupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
  },
  joinPopupDot: {
    width: sp.sm,
    height: sp.sm,
    borderRadius: sp.xs,
    backgroundColor: c.accent,
  },
  joinPopupName: {
    color: c.text,
    fontSize: 16,
    fontWeight: '700',
  },
  joinPopupLabel: {
    color: c.textMuted,
    fontSize: 14,
  },
  joinPopupMeta: {
    color: c.textSoft,
    fontSize: 13,
    paddingLeft: sp.lg,
  },
  joinPopupBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: sp.xs,
  },
  joinDenyBtn: {
    flex: 1,
    borderRadius: r.sm,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: sp.md,
    alignItems: 'center',
  },
  joinDenyBtnText: {
    color: c.textSoft,
    fontSize: 14,
    fontWeight: '500',
  },
  joinApproveBtn: {
    flex: 2,
    borderRadius: r.sm,
    backgroundColor: c.accent,
    paddingVertical: sp.md,
    alignItems: 'center',
  },
  joinApproveBtnText: {
    color: c.onAccent,
    fontSize: 14,
    fontWeight: '600',
  },
  joinBtnDisabled: {
    opacity: 0.5,
  },

  // Session ended
  endedOverlay: {
    flex: 1,
    paddingHorizontal: sp.xxl,
    paddingTop: 60,
    gap: sp.md,
  },
  endedTitle: {
    color: c.text,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  endedSubtitle: {
    color: c.textSoft,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: sp.sm,
  },
  endedTask: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  endedTaskMark: {
    color: c.success,
    fontSize: 14,
    fontWeight: '600',
  },
  endedTaskTitle: { color: c.textMuted, fontSize: 14, flex: 1 },
  endedBackBtn: {
    backgroundColor: c.primary,
    borderRadius: r.md,
    paddingVertical: sp.lg,
    alignItems: 'center',
    marginTop: 32,
  },
  endedBackBtnText: {
    color: c.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
});
