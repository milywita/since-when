import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
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
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import auth from '@react-native-firebase/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../components/ui/Screen';
import { PartnerCard } from '../components/session/PartnerCard';
import { useTheme } from '../theme/ThemeContext';
import type { AppTheme } from '../theme/themes';
import { useSession } from '../hooks/useSession';
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
import { SwipeableRow } from '../components/SwipeableRow';
import { formatElapsed } from '../utils/formatElapsed';
import { presetChipLabelFromMs } from '../utils/taskEstimatePresetLabel';
import { SETTINGS_DEFAULTS } from '../types/settingsPreferences';
import type { TaskEstimatePreset } from '../types/TaskEstimatePreset';
import { TaskFormBottomSheet, type TaskFormCommitPayload } from '../components/tasks/TaskFormBottomSheet';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCountdown(ms: number): string {
  if (ms <= 0) { return '0:00'; }
  const totalSec = Math.ceil(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatSeconds(totalSec: number): string {
  if (totalSec < 60) { return `${totalSec}s`; }
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) { return `${h}h ${m}m`; }
  return `${m}m ${String(s).padStart(2, '0')}s`;
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

const SESSION_TIME_PRESET_MS = [
  15 * 60 * 1000,
  30 * 60 * 1000,
  60 * 60 * 1000,
  2 * 60 * 60 * 1000,
  4 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
] as const;

const SESSION_TASK_ESTIMATE_PRESETS: TaskEstimatePreset[] = SESSION_TIME_PRESET_MS.map(ms => ({
  ms,
  label: presetChipLabelFromMs(ms),
}));

// ─── Style factory type ───────────────────────────────────────────────────────

type S = ReturnType<typeof buildStyles>;


// ─── Reaction picker ──────────────────────────────────────────────────────────

type ReactionPickerProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (text: string) => Promise<void>;
  canReact: boolean;
  reactionCount: number;
  isCompleted: boolean;
  c: AppTheme['colors'];
  s: S;
};

function ReactionPicker({ visible, onClose, onSelect, canReact, reactionCount, isCompleted, c, s }: ReactionPickerProps) {
  const [sending, setSending] = useState(false);
  const options = isCompleted ? REACTION_OPTIONS_COMPLETED : REACTION_OPTIONS_ACTIVE;
  const title = isCompleted ? 'Celebrate the win' : 'Send a reaction';
  const remaining = 3 - reactionCount;

  async function handleSelect(text: string) {
    setSending(true);
    try { await onSelect(text); onClose(); } finally { setSending(false); }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.popupBackdrop} activeOpacity={1} onPress={onClose} />
      <View style={s.reactionSheet}>
        {canReact ? (
          <>
            <Text style={[s.reactionTitle, { color: c.text }]}>{title}</Text>
            <Text style={[s.reactionMeta, { color: c.textSoft }]}>
              {remaining} {remaining === 1 ? 'reaction' : 'reactions'} left for this task
            </Text>
            <View style={s.reactionOptions}>
              {options.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={s.reactionBtn}
                  onPress={() => handleSelect(opt)}
                  disabled={sending}>
                  <Text style={[s.reactionBtnText, { color: c.text }]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={[s.reactionTitle, { color: c.text }]}>Reaction limit reached</Text>
            <Text style={[s.reactionMeta, { color: c.textSoft }]}>3 reactions per task per session.</Text>
            <TouchableOpacity style={s.reactionCloseBtn} onPress={onClose}>
              <Text style={[s.reactionCloseBtnText, { color: c.textSoft }]}>OK</Text>
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
  c: AppTheme['colors'];
  s: S;
};

function ExtendOverlay({ isHost, hostName, onExtend, onCustomExtend, onEnd, onLeave, c, s }: ExtendOverlayProps) {
  const insets = useSafeAreaInsets();
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
    if (Number.isNaN(minutes) || minutes < 1) { return; }
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
    <View style={s.extendOverlay}>
      <View style={s.extendCard}>
        <Text style={[s.extendTitle, { color: c.text }]}>Time's up.</Text>
        {isHost ? (
          <>
            <Text style={[s.extendSubtitle, { color: c.textSoft }]}>Keep going or call it done?</Text>
            <View style={s.extendBtns}>
              {EXTEND_PRESETS.map(p => (
                <TouchableOpacity
                  key={p.ms}
                  style={[s.extendChip, busy && s.extendChipDisabled]}
                  onPress={() => handleExtend(p.ms)}
                  disabled={busy}>
                  <Text style={s.extendChipText}>{p.label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[s.extendChip, busy && s.extendChipDisabled]}
                onPress={() => setCustomModalVisible(true)}
                disabled={busy}>
                <Text style={s.extendChipText}>Custom</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[s.extendEndBtn, busy && s.extendChipDisabled]}
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
              <Text style={[s.extendEndBtnText, { color: c.textSoft }]}>End session</Text>
            </TouchableOpacity>

            <Modal
              visible={customModalVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setCustomModalVisible(false)}>
              <KeyboardAvoidingView
                style={s.popupHost}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <TouchableOpacity
                  style={s.popupBackdrop}
                  activeOpacity={1}
                  onPress={() => setCustomModalVisible(false)}
                />
                <View style={[s.popupCard, { marginBottom: insets.bottom + 100, backgroundColor: c.surfaceRaised, borderColor: c.border }]}>
                  <ScrollView
                    bounces={false}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={s.popupScroll}>
                    <Text style={[s.popupTitle, { color: c.text }]}>Extend session</Text>
                    <Text style={[s.modalSubtitle, { color: c.textSoft }]}>Enter minutes to add</Text>
                    <TextInput
                      style={s.modalInput}
                      placeholder="e.g. 35"
                      placeholderTextColor={c.textSoft}
                      value={customInput}
                      onChangeText={v => setCustomInput(v.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      autoFocus
                      maxLength={4}
                    />
                    <TouchableOpacity
                      style={[
                        s.modalAddBtn,
                        (!customInput || parseInt(customInput, 10) < 1 || busy) && s.modalAddBtnDisabled,
                      ]}
                      disabled={!customInput || parseInt(customInput, 10) < 1 || busy}
                      onPress={handleCustomExtend}>
                      {busy
                        ? <ActivityIndicator color={c.primaryText} />
                        : <Text style={[s.modalAddBtnText, { color: c.primaryText }]}>Add time</Text>}
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </KeyboardAvoidingView>
            </Modal>
          </>
        ) : (
          <>
            <Text style={[s.extendSubtitle, { color: c.textSoft }]}>
              Waiting for {hostName} to extend or end the session…
            </Text>
            <TouchableOpacity
              style={s.extendEndBtn}
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
              <Text style={[s.extendEndBtnText, { color: c.textSoft }]}>Leave session</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Session queue task row ───────────────────────────────────────────────────

type SessionQueueTaskRowProps = {
  task: SessionTask;
  position: number;
  now: number;
  receivedReactions: Reaction[];
  onComplete: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onLongPress: () => void;
  onTogglePin: () => void;
  drag: () => void;
  isActive: boolean; // dragging active, not focus-active
  c: AppTheme['colors'];
  s: S;
};

function SessionQueueTaskRow({
  task, position, now, receivedReactions,
  onComplete, onDelete, onEdit, onLongPress, onTogglePin,
  drag, isActive, c, s,
}: SessionQueueTaskRowProps) {
  const isFirst = position === 1;
  const isPinned = task.isPinned ?? false;
  const isTimerRunning = isFirst || isPinned;

  const liveSeconds = isTimerRunning
    ? (task.accumulatedSeconds ?? 0) +
      (task.timerStartedAt !== null ? Math.max(0, Math.floor((now - task.timerStartedAt) / 1000)) : 0)
    : (task.accumulatedSeconds ?? 0);

  const hasFocusTime = liveSeconds > 0;
  const estimatedSec = task.estimatedMs !== null ? task.estimatedMs / 1000 : null;
  const isOverEstimate = estimatedSec !== null && liveSeconds > estimatedSec;

  /** #1 or pinned: timer runs; same selected row styling as Solo. */
  const isFocusedRow = isFirst || isPinned;

  const rowBackground = isActive
    ? c.surfaceRaised
    : isFocusedRow
      ? c.accentSurface
      : c.surface;

  const rowBorderColor = isFocusedRow ? c.accent : c.border;
  const rowBorderWidth = isFocusedRow ? 1.5 : 1;
  const doneBtnStyle = isFocusedRow
    ? { backgroundColor: c.accent, borderColor: c.accent, borderWidth: 1 }
    : { backgroundColor: c.surfaceRaised, borderColor: c.borderStrong, borderWidth: 1 };
  const doneLabelColor = isFocusedRow ? c.onAccent : c.text;

  return (
    <View
      style={[
        s.sqRow,
        {
          backgroundColor: rowBackground,
          borderColor: rowBorderColor,
          borderWidth: rowBorderWidth,
          opacity: isActive ? 0.95 : 1,
        },
      ]}>
      {/* drag handle */}
      <TouchableOpacity onPressIn={drag} style={s.sqDragHandle} hitSlop={8}>
        <Text style={[s.sqDragHandleText, { color: c.textDim }]}>⠿</Text>
      </TouchableOpacity>

      {/* position badge — tap to toggle pin */}
      <Pressable
        onPress={isFirst ? undefined : onTogglePin}
        hitSlop={6}
        style={({ pressed }) => [
          s.sqBadge,
          {
            backgroundColor: isFocusedRow ? c.accent : c.surfaceSoft,
            opacity: pressed && !isFirst ? 0.88 : pressed && isFirst ? 0.92 : 1,
          },
        ]}>
        <Text style={[s.sqBadgeText, { color: isFocusedRow ? c.onAccent : c.textMuted }]}>
          {position}
        </Text>
      </Pressable>

      {/* content */}
      <TouchableOpacity style={s.sqContent} onLongPress={onLongPress} activeOpacity={1}>
        <Text style={[s.sqTitle, { color: c.text }]} numberOfLines={2}>{task.title}</Text>

        {isTimerRunning ? (
          <View style={s.sqTimerRow}>
            <Text
              style={[
                s.sqTimer,
                {
                  color: isOverEstimate
                    ? c.danger
                    : isFocusedRow
                      ? c.accent
                      : c.textMuted,
                },
              ]}>
              {formatSeconds(liveSeconds)}
            </Text>
            {estimatedSec !== null && (
              <Text style={[s.sqEstimate, { color: isOverEstimate ? c.dangerMuted : c.textSoft }]}>
                {isOverEstimate
                  ? `over by ${formatSeconds(liveSeconds - estimatedSec)}`
                  : `est. ${formatSeconds(estimatedSec)}`}
              </Text>
            )}
          </View>
        ) : hasFocusTime ? (
          <View style={s.sqTimerRow}>
            <Text style={[s.sqTimer, { color: c.textMuted }]}>{formatSeconds(liveSeconds)}</Text>
            {estimatedSec !== null && (
              <Text style={[s.sqEstimate, { color: c.textSoft }]}>est. {formatSeconds(estimatedSec)}</Text>
            )}
          </View>
        ) : (
          <View style={s.sqTimerRow}>
            <Text style={[s.sqMeta, { color: c.textMuted }]}>Added just now</Text>
            {estimatedSec !== null && (
              <Text style={[s.sqEstimate, { color: c.textSoft }]}>est. {formatSeconds(estimatedSec)}</Text>
            )}
          </View>
        )}

        {receivedReactions.length > 0 && (
          <TaskReactions reactions={receivedReactions} now={now} />
        )}
      </TouchableOpacity>

      <View style={s.sqRowActions}>
        <TouchableOpacity
          style={[s.sqEditBtn, { borderColor: c.border, backgroundColor: c.surface }]}
          onPress={onEdit}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Edit task">
          <Text style={[s.sqEditBtnIcon, { color: c.textMuted }]}>✎</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.sqDoneBtn, doneBtnStyle]}
          onPress={onComplete}
          hitSlop={12}
          activeOpacity={0.85}>
          <Text style={[s.sqDoneBtnText, { color: doneLabelColor }]}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Session task action sheet ────────────────────────────────────────────────

type SessionActionSheetProps = {
  task: SessionTask | null;
  onClose: () => void;
  onEdit: () => void;
  onComplete: () => void;
  onDelete: () => void;
  c: AppTheme['colors'];
  s: S;
  insetBottom: number;
};

function SessionActionSheet({ task, onClose, onEdit, onComplete, onDelete, c, s, insetBottom }: SessionActionSheetProps) {
  if (!task) { return null; }
  function act(fn: () => void) { onClose(); setTimeout(fn, 120); }
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.sqPopupHost}>
        <TouchableOpacity style={s.sqPopupBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={[s.sqActionSheet, { marginBottom: insetBottom + 100, backgroundColor: c.surfaceRaised, borderColor: c.border }]}>
          <Text style={[s.sqActionTitle, { color: c.textMuted }]} numberOfLines={2}>{task.title}</Text>
          <View style={[s.sqActionDivider, { backgroundColor: c.border }]} />
          <TouchableOpacity style={s.sqActionRow} onPress={() => act(onEdit)}>
            <Text style={[s.sqActionRowText, { color: c.text }]}>Edit task</Text>
          </TouchableOpacity>
          <View style={[s.sqActionDivider, { backgroundColor: c.borderInner }]} />
          <TouchableOpacity style={s.sqActionRow} onPress={() => act(onComplete)}>
            <Text style={[s.sqActionRowText, { color: c.success }]}>Mark as done</Text>
          </TouchableOpacity>
          <View style={[s.sqActionDivider, { backgroundColor: c.borderInner }]} />
          <TouchableOpacity style={s.sqActionRow} onPress={() => act(onDelete)}>
            <Text style={[s.sqActionRowText, { color: c.danger }]}>Delete task</Text>
          </TouchableOpacity>
          <View style={[s.sqActionDivider, { backgroundColor: c.border }]} />
          <TouchableOpacity style={s.sqActionRow} onPress={onClose}>
            <Text style={[s.sqActionRowText, { color: c.textMuted }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Join request popup ───────────────────────────────────────────────────────

type JoinRequestPopupProps = {
  request: JoinRequest;
  onApprove: () => void;
  onDeny: () => void;
  busy: boolean;
  c: AppTheme['colors'];
  s: S;
};

function JoinRequestPopup({ request, onApprove, onDeny, busy, c, s }: JoinRequestPopupProps) {
  return (
    <View style={s.joinPopupOverlay} pointerEvents="box-none">
      <View style={s.joinPopupCard}>
        <View style={s.joinPopupHeader}>
          <View style={[s.joinPopupDot, { backgroundColor: c.accent }]} />
          <Text style={[s.joinPopupName, { color: c.text }]}>{request.displayName}</Text>
          <Text style={[s.joinPopupLabel, { color: c.textMuted }]}>wants to join</Text>
        </View>
        {request.tasks.length > 0 && (
          <Text style={[s.joinPopupMeta, { color: c.textSoft }]}>
            Bringing {request.tasks.length} task{request.tasks.length !== 1 ? 's' : ''}
          </Text>
        )}
        <View style={s.joinPopupBtns}>
          <TouchableOpacity
            style={[s.joinDenyBtn, busy && s.joinBtnDisabled]}
            onPress={onDeny}
            disabled={busy}>
            <Text style={[s.joinDenyBtnText, { color: c.textSoft }]}>Not now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.joinApproveBtn, busy && s.joinBtnDisabled]}
            onPress={onApprove}
            disabled={busy}>
            {busy
              ? <ActivityIndicator color={c.onAccent} size="small" />
              : <Text style={[s.joinApproveBtnText, { color: c.onAccent }]}>Let them in</Text>}
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
  c: AppTheme['colors'];
  s: S;
};

function EndedOverlay({ onBack, myMember, c, s }: EndedOverlayProps) {
  const completed = myMember?.tasks.filter(t => t.completedAt !== null) ?? [];
  const total = myMember?.tasks.length ?? 0;
  return (
    <View style={s.endedOverlay}>
      <Text style={[s.endedTitle, { color: c.text }]}>Session over.</Text>
      <Text style={[s.endedSubtitle, { color: c.textSoft }]}>
        {completed.length > 0
          ? `You completed ${completed.length} of ${total} task${total !== 1 ? 's' : ''}.`
          : 'No tasks completed this session. Remaining ones are still in Solo.'}
      </Text>
      {completed.map(t => (
        <View key={t.taskId} style={s.endedTask}>
          <Text style={[s.endedTaskMark, { color: c.success }]}>✓</Text>
          <Text style={[s.endedTaskTitle, { color: c.textMuted }]}>{t.title}</Text>
        </View>
      ))}
      <TouchableOpacity style={s.endedBackBtn} onPress={onBack}>
        <Text style={[s.endedBackBtnText, { color: c.primaryText }]}>Back to Solo</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

type Props = AppScreenProps<'Session'>;

export default function SessionScreen({ route, navigation }: Props) {
  const thm = useTheme();
  const { colors: c, radius: r } = thm;
  const s = useMemo(() => buildStyles(thm), [thm]);

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
    reorderTasks,
    pinTask,
    unpinTask,
    updateTaskFields,
    sendReaction,
    finalizeSession,
  } = useSession(sessionId);

  const now = useNow();
  const { opacity: flashOpacity, message: flashMessage, flash } = useDoneFlash();
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editingSessionTask, setEditingSessionTask] = useState<SessionTask | null>(null);
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [actionSheetTask, setActionSheetTask] = useState<SessionTask | null>(null);
  const insets = useSafeAreaInsets();
  const [reactionTarget, setReactionTarget] = useState<{
    toUserId: string;
    taskId: string;
    completed: boolean;
  } | null>(null);

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const currentUser = auth().currentUser;
  useEffect(() => {
    if (!currentUser?.uid) { return; }
    const unsub = subscribeToUserProfile(currentUser.uid, setUserProfile);
    return unsub;
  }, [currentUser?.uid]);

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

  const myActiveTasks = (myMember?.tasks.filter(t => t.completedAt === null) ?? [])
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const myCompletedTasks = myMember?.tasks.filter(t => t.completedAt !== null) ?? [];

  const timeLeft = session?.endsAt ? Math.max(0, session.endsAt - now) : null;
  const timerExpired = timeLeft !== null && timeLeft <= 0 && session?.status === 'active';
  const sessionEnded = session?.status === 'ended';
  const timerNotificationFiredRef = useRef(false);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      const granted = await requestNotificationPermissions();
      if (!granted || !alive) { return; }
      await ensureNotificationChannel();
    };
    run().catch(console.error);
    return () => { alive = false; };
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

  const syncedOnEndRef = useRef(false);
  useEffect(() => {
    if (sessionEnded && !syncedOnEndRef.current) {
      syncedOnEndRef.current = true;
      clearActiveSession().catch(console.error);
      finalizeSession().catch(console.error);
    }
  }, [sessionEnded, clearActiveSession, finalizeSession]);

  const hostMember = members.find(m => m.userId === session?.createdBy);
  const hostName = hostMember?.displayName ?? 'the host';

  const sessionTaskLimitReached = (myMember?.tasks.length ?? 0) >= MAX_SESSION_TASKS;

  async function handleCommitNewSessionTask(payload: TaskFormCommitPayload) {
    const newTask: SessionTask = {
      taskId: `${userId}-${Date.now()}`,
      title: payload.title,
      createdAt: Date.now(),
      completedAt: null,
      estimatedMs: payload.estimatedMs,
      position: (myActiveTasks.length ?? 0) + 1, // service will overwrite this correctly
      isPinned: false,
      accumulatedSeconds: 0,
      timerStartedAt: null,
    };
    await addTask(newTask);
  }

  async function handleCommitEditSessionTask(payload: TaskFormCommitPayload) {
    if (!editingSessionTask) { return; }
    await updateTaskFields(editingSessionTask.taskId, {
      title: payload.title,
      estimatedMs: payload.estimatedMs,
    });
  }

  async function handleLeave() {
    await finalizeSession().catch(console.error);
    leaveSession().catch(console.error);
    navigation.popToTop();
  }

  async function handleCompleteTask(task: SessionTask) {
    await completeTask(task);
    const focusSecs = task.accumulatedSeconds ?? 0;
    const focusMs = focusSecs > 0 ? focusSecs * 1000 : null;
    flash(`Done! "${task.title}"${focusMs ? ` in ${formatElapsed(focusMs)}` : ''}`);
  }

  async function handleRemoveTask(task: SessionTask) {
    await removeTask(task.taskId);
  }

  async function handleReorder(orderedActive: SessionTask[]) {
    const previousFirstId = myActiveTasks[0]?.taskId ?? null;
    await reorderTasks(orderedActive, previousFirstId);
  }

  async function handleTogglePin(task: SessionTask) {
    if (task.isPinned ?? false) {
      await unpinTask(task.taskId);
    } else {
      await pinTask(task.taskId);
    }
  }

  async function handleSendReaction(text: string) {
    if (!reactionTarget) { return; }
    await sendReaction(reactionTarget.toUserId, reactionTarget.taskId, text);
    flash(`Sent: "${text}"`);
  }

  if (loading) {
    return (
      <Screen>
        <View style={s.loadingRoot}>
          <ActivityIndicator size="large" color={c.text} />
        </View>
      </Screen>
    );
  }

  if (error || !session) {
    return (
      <Screen>
        <View style={s.loadingRoot}>
          <Text style={[s.errorText, { color: c.danger }]}>{error ?? 'Session not found.'}</Text>
          <TouchableOpacity style={s.errorBackBtn} onPress={() => navigation.popToTop()}>
            <Text style={[s.errorBackBtnText, { color: c.textSoft }]}>Go back</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  if (sessionEnded) {
    return (
      <Screen safeArea edges={['top', 'bottom']}>
        <EndedOverlay myMember={myMember} onBack={() => navigation.popToTop()} c={c} s={s} />
      </Screen>
    );
  }

  const isTimerWarning = timeLeft !== null && timeLeft < 5 * 60 * 1000 && !timerExpired;

  return (
    <Screen safeArea edges={['top']}>
      {/* Flash banner */}
      <Animated.View style={[s.flashBanner, { opacity: flashOpacity }]} pointerEvents="none">
        <Text style={[s.flashText, { color: c.text }]}>{flashMessage}</Text>
      </Animated.View>

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={[s.headerTitle, { color: c.text }]}>Since When</Text>
          <View style={s.modeBadge}>
            <Text style={[s.modeBadgeText, { color: c.accent }]}>TOGETHER</Text>
          </View>
        </View>
        <View style={s.headerRight}>
          {timeLeft !== null && (
            <Text style={[
              s.countdown,
              { color: timerExpired ? c.textSoft : isTimerWarning ? c.danger : c.text },
              timerExpired && s.countdownExpired,
            ]}>
              {timerExpired ? 'Time up' : formatCountdown(timeLeft)}
            </Text>
          )}
          {isHost && !timerExpired && (
            <TouchableOpacity
              style={s.endBtn}
              onPress={() =>
                Alert.alert('End session?', 'This will end the session for everyone.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'End', style: 'destructive', onPress: () =>
                      endSession().catch((err: any) =>
                        Alert.alert('Error', err?.message ?? 'Could not end session.'),
                      ),
                  },
                ])
              }>
              <Text style={[s.endBtnText, { color: c.textSoft }]}>End</Text>
            </TouchableOpacity>
          )}
          {!isHost && (
            <TouchableOpacity
              style={s.leaveBtn}
              onPress={() =>
                Alert.alert('Leave session?', 'You can rejoin later using the host\'s invite code.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Leave', style: 'destructive', onPress: handleLeave },
                ])
              }>
              <Text style={[s.leaveBtnText, { color: c.danger }]}>Leave</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Time-expired overlay */}
      {timerExpired && (
        <ExtendOverlay
          isHost={isHost}
          hostName={hostName}
          onExtend={extendSession}
          onCustomExtend={async minutes => extendSession(minutes * 60 * 1000)}
          onEnd={endSession}
          onLeave={isHost ? undefined : handleLeave}
          c={c}
          s={s}
        />
      )}

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* My tasks */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: c.text }]}>Your tasks</Text>

          {myActiveTasks.length === 0 && myCompletedTasks.length === 0 && (
            <Text style={[s.emptyMy, { color: c.textFaint }]}>Add tasks you're working on this session.</Text>
          )}

          {myActiveTasks.length > 0 && (
            <View style={{ minHeight: myActiveTasks.length * 72 }}>
              <DraggableFlatList
                data={myActiveTasks}
                keyExtractor={t => t.taskId}
                renderItem={({ item, getIndex, drag, isActive: dragActive }: RenderItemParams<SessionTask>) => (
                  <ScaleDecorator>
                    <SwipeableRow
                      borderRadius={r.md}
                      onDelete={() => handleRemoveTask(item)}
                      dragHandleReserveWidth={56}>
                      <SessionQueueTaskRow
                        task={item}
                        position={(getIndex() ?? 0) + 1}
                        now={now}
                        receivedReactions={reactions.filter(r => r.taskId === item.taskId && r.toUserId === userId)}
                        onComplete={() => handleCompleteTask(item)}
                        onDelete={() => handleRemoveTask(item)}
                        onEdit={() => setEditingSessionTask(item)}
                        onLongPress={() => setActionSheetTask(item)}
                        onTogglePin={() => handleTogglePin(item)}
                        drag={drag}
                        isActive={dragActive}
                        c={c}
                        s={s}
                      />
                    </SwipeableRow>
                  </ScaleDecorator>
                )}
                onDragEnd={({ data }) => handleReorder(data)}
                scrollEnabled={false}
              />
            </View>
          )}

          <TouchableOpacity
            style={s.addTaskBtn}
            onPress={() => setAddModalVisible(true)}>
            <Text style={[s.addTaskBtnText, { color: c.textDim }]}>+ Add task</Text>
          </TouchableOpacity>

          {myCompletedTasks.length > 0 && (
            <>
              <TouchableOpacity
                style={s.completedToggle}
                onPress={() => setCompletedExpanded(e => !e)}
                activeOpacity={0.7}>
                <Text style={[s.completedToggleText, { color: c.textDim }]}>
                  Done this session ({myCompletedTasks.length})
                </Text>
                <Text style={[s.completedToggleChevron, { color: c.textFaint }]}>
                  {completedExpanded ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>

              {completedExpanded && (
                <View style={s.taskGap}>
                  {myCompletedTasks.map(task => {
                    const focusSecs = task.accumulatedSeconds ?? 0;
                    return (
                      <View key={task.taskId} style={[s.sqCompletedRow, { backgroundColor: c.surface, borderColor: c.border }]}>
                        <Text style={[s.sqCompletedTitle, { color: c.textSoft }]} numberOfLines={1}>{task.title}</Text>
                        <Text style={[s.sqCompletedTime, { color: c.success }]}>
                          {focusSecs > 0 ? `Done in ${formatSeconds(focusSecs)}` : 'Done'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </View>

        {/* Pin hint */}
        {myActiveTasks.length > 1 && (
          <View style={s.focusHint}>
            <Text style={[s.focusHintText, { color: c.text }]}>
              #1 is your focus. Tap a number badge to pin a task and run its timer in parallel.
            </Text>
          </View>
        )}

        {/* Invite code */}
        {otherMembers.length === 0 && userProfile?.personalInviteCode && (
          <TouchableOpacity
            style={s.inviteCard}
            onPress={() => Share.share({ message: userProfile.personalInviteCode })}
            activeOpacity={0.7}>
            <Text style={[s.inviteCardLabel, { color: c.accent }]}>YOUR INVITE CODE</Text>
            <Text style={[s.inviteCardCode, { color: c.text }]}>{userProfile.personalInviteCode}</Text>
            <Text style={[s.inviteCardHint, { color: c.textSecondary }]}>Tap to share · disappears when someone joins</Text>
          </TouchableOpacity>
        )}

        {/* Partner tasks */}
        {otherMembers.length === 0 && (
          <View style={s.section}>
            <Text style={[s.waitingPartner, { color: c.textFaint }]}>Waiting for your partner to join…</Text>
          </View>
        )}

        {otherMembers.map(member => (
          <View key={member.userId} style={s.section}>
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

      {/* Join request popup */}
      {pendingRequest && (
        <JoinRequestPopup
          request={pendingRequest}
          onApprove={() => handleApproveRequest(pendingRequest)}
          onDeny={() => handleDenyRequest(pendingRequest)}
          busy={handlingRequest}
          c={c}
          s={s}
        />
      )}

      {/* Modals */}
      <TaskFormBottomSheet
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        mode="create"
        syncKey={addModalVisible ? 'session-add' : undefined}
        sheetTitle="What are you working on?"
        titlePlaceholder="e.g. Fix the login bug"
        estimatePrompt="How long will it take?"
        submitLabel="Add to session"
        timePresets={SESSION_TASK_ESTIMATE_PRESETS}
        lockedBody={
          sessionTaskLimitReached
            ? `You can bring up to ${MAX_SESSION_TASKS} tasks into a session.`
            : null
        }
        onCommit={handleCommitNewSessionTask}
      />

      <TaskFormBottomSheet
        visible={editingSessionTask !== null}
        onClose={() => setEditingSessionTask(null)}
        mode="edit"
        syncKey={editingSessionTask?.taskId}
        sheetTitle="Edit task"
        titlePlaceholder="Task title"
        estimatePrompt="How long will it take?"
        submitLabel="Save changes"
        timePresets={SESSION_TASK_ESTIMATE_PRESETS}
        initial={
          editingSessionTask
            ? {
                title: editingSessionTask.title,
                estimatedMs: editingSessionTask.estimatedMs,
                reminderPreset: SETTINGS_DEFAULTS.reminderPreset,
                togetherVisibility: SETTINGS_DEFAULTS.togetherVisibility,
              }
            : undefined
        }
        onCommit={handleCommitEditSessionTask}
      />

      {reactionTarget !== null && (
        <ReactionPicker
          visible
          onClose={() => setReactionTarget(null)}
          onSelect={handleSendReaction}
          canReact={canReact(reactionTarget.taskId)}
          reactionCount={myReactionCountForTask(reactionTarget.taskId)}
          isCompleted={reactionTarget.completed}
          c={c}
          s={s}
        />
      )}

      <SessionActionSheet
        task={actionSheetTask}
        onClose={() => setActionSheetTask(null)}
        onEdit={() => {
          const t = actionSheetTask;
          setActionSheetTask(null);
          if (t) { setEditingSessionTask(t); }
        }}
        onComplete={() => actionSheetTask && handleCompleteTask(actionSheetTask)}
        onDelete={() => actionSheetTask && handleRemoveTask(actionSheetTask)}
        c={c}
        s={s}
        insetBottom={insets.bottom}
      />
    </Screen>
  );
}

// ─── Style factory ────────────────────────────────────────────────────────────

function buildStyles(thm: AppTheme) {
  const { colors: c, spacing: sp, radius: r } = thm;
  return StyleSheet.create({
    loadingRoot: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: sp.xl + sp.sm, gap: sp.lg },
    errorText: { fontSize: 15, textAlign: 'center' },
    errorBackBtn: { paddingVertical: 10, paddingHorizontal: sp.gutter },
    errorBackBtnText: { fontSize: 14 },

    flashBanner: {
      position: 'absolute', top: 60, left: sp.gutter, right: sp.gutter, zIndex: 100,
      backgroundColor: c.surface, borderRadius: r.md, borderWidth: 1, borderColor: c.border,
      paddingVertical: 14, paddingHorizontal: 18,
    },
    flashText: { fontSize: 14, fontWeight: '500', textAlign: 'center' },

    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
      paddingHorizontal: sp.gutter, paddingTop: sp.lg, paddingBottom: sp.sm,
    },
    headerTitle: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
    modeBadge: {
      marginTop: sp.xs, alignSelf: 'flex-start', backgroundColor: c.surface,
      borderRadius: 5, borderWidth: 1, borderColor: c.border, paddingHorizontal: 7, paddingVertical: 2,
    },
    modeBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: sp.md, marginTop: sp.xs },
    countdown: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
    countdownExpired: { fontSize: 14, fontWeight: '500' },

    inviteCard: {
      backgroundColor: c.accentSurface, borderRadius: 14, borderWidth: 1,
      borderColor: c.accentSurfaceBorder, padding: sp.gutter, alignItems: 'center', gap: 6,
    },
    inviteCardLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 2 },
    inviteCardCode: { fontSize: 36, fontWeight: '700', letterSpacing: 8, fontVariant: ['tabular-nums'] },
    inviteCardHint: { fontSize: 11, marginTop: 2 },

    endBtn: { paddingVertical: 6, paddingHorizontal: sp.md, borderRadius: 7, borderWidth: 1, borderColor: c.border },
    endBtnText: { fontSize: 13 },
    leaveBtn: { paddingVertical: 6, paddingHorizontal: sp.md, borderRadius: 7, borderWidth: 1, borderColor: c.borderDanger },
    leaveBtnText: { fontSize: 13 },

    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: sp.gutter, paddingBottom: 60, gap: sp.xl, paddingTop: sp.sm },

    section: {},
    sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
    emptyMy: { fontSize: 14, marginBottom: sp.sm },
    waitingPartner: { fontSize: 14 },

    focusHint: {
      backgroundColor: c.accentSurface, borderRadius: r.sm, borderWidth: 1,
      borderColor: c.accent, paddingVertical: sp.md, paddingHorizontal: 14,
    },
    focusHintText: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
    focusWrap: { gap: sp.sm },
    taskGap: { gap: sp.sm },

    myTaskRow: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface,
      borderRadius: r.sm, borderWidth: 1, borderColor: c.border,
      padding: sp.md, gap: 10,
    },
    myTaskRowDone: { opacity: 0.45 },
    activeDot: {
      width: 22, height: 22, borderRadius: 11, borderWidth: 1,
      borderColor: c.borderStrong, justifyContent: 'center', alignItems: 'center',
    },
    activeDotInner: { width: 10, height: 10, borderRadius: 5 },
    myTaskInfo: { flex: 1, gap: 2 },
    myTaskMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
    myTaskTitle: { fontSize: 15, fontWeight: '500' },
    myTaskTimer: { fontSize: 12, fontVariant: ['tabular-nums'] },
    myTaskEstimate: { fontSize: 12, fontVariant: ['tabular-nums'] },
    myTaskDoneLabel: { fontSize: 12 },
    myDoneBtn: { borderRadius: 7, borderWidth: 1, borderColor: c.border, paddingVertical: 6, paddingHorizontal: sp.md },
    myDoneBtnText: { fontSize: 12, fontWeight: '500' },

    // ── Session queue rows ──────────────────────────────────────────────────
    sqRow: {
      flexDirection: 'row', alignItems: 'center',
      borderRadius: 12, borderWidth: 1,
      marginBottom: 8, overflow: 'hidden',
    },
    sqDragHandle: { paddingHorizontal: 10, paddingVertical: 14, justifyContent: 'center', alignItems: 'center' },
    sqDragHandleText: { fontSize: 18 },
    sqBadge: {
      width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
      marginLeft: 2, marginRight: 6, flexShrink: 0,
    },
    sqBadgeText: { fontSize: 13, fontWeight: '700' },
    sqContent: { flex: 1, paddingVertical: 12, paddingRight: 6, gap: 3 },
    sqTitle: { fontSize: 15, fontWeight: '500', lineHeight: 20 },
    sqTimerRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
    sqTimer: { fontSize: 12, fontWeight: '500', fontVariant: ['tabular-nums' as const] },
    sqEstimate: { fontSize: 11, fontVariant: ['tabular-nums' as const] },
    sqMeta: { fontSize: 12 },
    sqRowActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginRight: 10,
      flexShrink: 0,
    },
    sqEditBtn: {
      borderRadius: 7,
      borderWidth: 1,
      paddingVertical: 6,
      paddingHorizontal: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sqEditBtnIcon: { fontSize: 15, fontWeight: '500', lineHeight: 18 },
    sqDoneBtn: {
      borderRadius: 7, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 11,
    },
    sqDoneBtnText: { fontSize: 12, fontWeight: '600' },
    sqCompletedRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      borderRadius: 8, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12, opacity: 0.6,
    },
    sqCompletedTitle: { flex: 1, fontSize: 13, textDecorationLine: 'line-through' as const },
    sqCompletedTime: { fontSize: 12, fontWeight: '500' },

    // ── Session action sheet ────────────────────────────────────────────────
    sqPopupHost: { flex: 1, justifyContent: 'flex-end' },
    sqPopupBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    sqActionSheet: {
      marginHorizontal: sp.lg, borderRadius: 20, borderWidth: 1,
      overflow: 'hidden' as const,
      shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18, shadowRadius: 24, elevation: 12,
    },
    sqActionTitle: {
      fontSize: 13, fontWeight: '600', letterSpacing: 0.2, textAlign: 'center' as const,
      paddingVertical: 14, paddingHorizontal: sp.xl,
    },
    sqActionDivider: { height: StyleSheet.hairlineWidth },
    sqActionRow: { paddingVertical: 17, paddingHorizontal: sp.xl, alignItems: 'center' as const },
    sqActionRowText: { fontSize: 17, fontWeight: '400' },

    addTaskBtn: {
      borderRadius: r.sm, borderWidth: 1, borderColor: c.border,
      borderStyle: 'dashed', paddingVertical: sp.md, alignItems: 'center', marginTop: 4,
    },
    addTaskBtnText: { fontSize: 14 },

    completedToggle: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 10, marginTop: sp.sm, borderTopWidth: 1, borderTopColor: c.borderInner,
    },
    completedToggleText: { fontSize: 13, fontWeight: '500' },
    completedToggleChevron: { fontSize: 10 },

    // Extend overlay
    extendOverlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: c.backdropHeavy, justifyContent: 'center',
      alignItems: 'center', zIndex: 50, paddingHorizontal: sp.xxl,
    },
    extendCard: {
      width: '100%',
      backgroundColor: c.surfaceRaised,
      borderRadius: r.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: sp.xl,
      gap: sp.md,
      alignItems: 'center',
    },
    extendTitle: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
    extendSubtitle: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
    extendBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm, marginTop: sp.xs, justifyContent: 'center' },
    extendChip: {
      borderRadius: sp.sm,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 7,
      paddingHorizontal: 13,
    },
    extendChipDisabled: { opacity: 0.4 },
    extendChipText: { fontSize: 13, fontWeight: '500', color: c.textMuted },
    extendEndBtn: {
      backgroundColor: 'transparent', borderRadius: r.sm, borderWidth: 1,
      borderColor: c.border, paddingVertical: sp.md, alignItems: 'center', marginTop: sp.xs,
      width: '100%',
    },
    extendEndBtnText: { fontSize: 14 },

    // Floating popup card (same style as HomeScreen)
    popupHost: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    popupBackdrop: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'transparent',
    },
    popupCard: {
      marginHorizontal: sp.lg,
      borderRadius: 20,
      borderWidth: 1,
      maxHeight: '80%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 24,
      elevation: 12,
    },
    popupScroll: {
      padding: sp.xl,
      gap: 14,
    },
    popupTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
    modalSubtitle: { fontSize: 14, lineHeight: 20 },
    modalInput: {
      backgroundColor: c.surface, color: c.text, borderRadius: r.sm,
      paddingHorizontal: sp.lg, paddingVertical: 14, fontSize: 16,
      borderWidth: 1, borderColor: c.border, minHeight: 52,
    },
    estimateLabel: { fontSize: 13 },
    estimateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm },
    estimateChip: { borderRadius: sp.sm, borderWidth: 1, borderColor: c.border, paddingVertical: 7, paddingHorizontal: 13 },
    estimateChipSelected: { backgroundColor: c.primary, borderColor: c.primary },
    estimateChipText: { color: c.textMuted, fontSize: 13, fontWeight: '500' },
    estimateChipTextSelected: { color: c.primaryText },
    advancedToggleRow: {
      marginTop: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    advancedToggleLabel: { fontSize: 13, fontWeight: '600' },
    advancedToggleChevron: { fontSize: 11, fontWeight: '700' },
    advancedCard: {
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      paddingHorizontal: sp.md,
      paddingVertical: sp.md,
      gap: sp.xs,
    },
    advancedGroupTitle: { marginTop: sp.xs, marginBottom: 6, fontSize: 12, fontWeight: '600' },
    advancedChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs, marginBottom: 8 },
    advancedChip: {
      borderRadius: sp.sm,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 6,
      paddingHorizontal: 10,
      backgroundColor: c.surfaceRaised,
    },
    advancedChipSelected: { backgroundColor: c.primary, borderColor: c.primary },
    advancedChipContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    advancedChipText: { fontSize: 12, fontWeight: '500' },
    modalAddBtn: { backgroundColor: c.primary, borderRadius: r.sm, paddingVertical: 15, alignItems: 'center' },
    modalAddBtnDisabled: { opacity: 0.3 },
    modalAddBtnText: { fontSize: 16, fontWeight: '600' },
    modalCloseBtn: { backgroundColor: c.surface, borderRadius: r.sm, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: c.border },
    modalCloseBtnText: { fontSize: 15, fontWeight: '500' },

    // Reaction picker
    reactionSheet: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: c.surfaceRaised, borderTopLeftRadius: r.xl, borderTopRightRadius: r.xl,
      paddingHorizontal: sp.xl, paddingBottom: Platform.OS === 'ios' ? 44 : 28,
      paddingTop: sp.xl, borderWidth: 1, borderColor: c.border, gap: 10,
    },
    reactionTitle: { fontSize: 18, fontWeight: '600' },
    reactionMeta: { fontSize: 13, marginBottom: sp.xs },
    reactionOptions: { gap: sp.sm },
    reactionBtn: { backgroundColor: c.surface, borderRadius: r.sm, paddingVertical: 13, paddingHorizontal: sp.lg, borderWidth: 1, borderColor: c.border },
    reactionBtnText: { fontSize: 15, fontWeight: '500' },
    reactionCloseBtn: { backgroundColor: c.surface, borderRadius: r.sm, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: c.border },
    reactionCloseBtnText: { fontSize: 14 },

    // Join request popup
    joinPopupOverlay: { position: 'absolute', bottom: 100, left: sp.lg, right: sp.lg, zIndex: 200 },
    joinPopupCard: {
      backgroundColor: c.surface, borderRadius: r.lg, borderWidth: 1.5, borderColor: c.accent,
      padding: 18, gap: 10,
      shadowColor: c.shadow, shadowOffset: { width: 0, height: sp.sm },
      shadowOpacity: 0.5, shadowRadius: sp.lg, elevation: sp.md,
    },
    joinPopupHeader: { flexDirection: 'row', alignItems: 'center', gap: sp.sm },
    joinPopupDot: { width: sp.sm, height: sp.sm, borderRadius: sp.xs },
    joinPopupName: { fontSize: 16, fontWeight: '700' },
    joinPopupLabel: { fontSize: 14 },
    joinPopupMeta: { fontSize: 13, paddingLeft: sp.lg },
    joinPopupBtns: { flexDirection: 'row', gap: 10, marginTop: sp.xs },
    joinDenyBtn: { flex: 1, borderRadius: r.sm, borderWidth: 1, borderColor: c.border, paddingVertical: sp.md, alignItems: 'center' },
    joinDenyBtnText: { fontSize: 14, fontWeight: '500' },
    joinApproveBtn: { flex: 2, borderRadius: r.sm, backgroundColor: c.accent, paddingVertical: sp.md, alignItems: 'center' },
    joinApproveBtnText: { fontSize: 14, fontWeight: '600' },
    joinBtnDisabled: { opacity: 0.5 },

    // Session ended
    endedOverlay: { flex: 1, paddingHorizontal: sp.xxl, paddingTop: 60, gap: sp.md },
    endedTitle: { fontSize: 32, fontWeight: '700', letterSpacing: -0.5 },
    endedSubtitle: { fontSize: 16, lineHeight: 22, marginBottom: sp.sm },
    endedTask: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    endedTaskMark: { fontSize: 14, fontWeight: '600' },
    endedTaskTitle: { fontSize: 14, flex: 1 },
    endedBackBtn: { backgroundColor: c.primary, borderRadius: r.md, paddingVertical: sp.lg, alignItems: 'center', marginTop: 32 },
    endedBackBtnText: { fontSize: 16, fontWeight: '600' },
  });
}
