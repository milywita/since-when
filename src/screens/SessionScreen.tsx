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
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import { useSession } from '../hooks/useSession';
import { SwipeableRow } from '../components/SwipeableRow';
import { subscribeToUserProfile } from '../services/userService';
import {
  subscribeToJoinRequests,
  approveJoinRequest,
  denyJoinRequest,
} from '../services/sessionService';
import type { SessionMember, SessionTask, Reaction, JoinRequest } from '../types/Session';
import { REACTION_OPTIONS_ACTIVE, REACTION_OPTIONS_COMPLETED, EXTEND_PRESETS } from '../types/Session';
import type { UserProfile } from '../types/User';
import type { AppScreenProps } from '../navigation/types';
import {
  requestNotificationPermissions,
  ensureNotificationChannel,
  scheduleSessionTimerNotification,
  cancelSessionTimerNotification,
  showSessionTimerNotificationNow,
} from '../services/notificationService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) { return `${days}d ${hours}h ${mins}m`; }
  if (hours > 0) { return `${hours}h ${mins}m ${secs}s`; }
  if (mins > 0) { return `${mins}m ${secs}s`; }
  return `${secs}s`;
}

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

function formatRelativeTime(ts: number, now: number): string {
  const secs = Math.floor((now - ts) / 1000);
  if (secs < 60) { return 'just now'; }
  const mins = Math.floor(secs / 60);
  if (mins < 60) { return `${mins}m ago`; }
  const hours = Math.floor(mins / 60);
  if (hours < 24) { return `${hours}h ago`; }
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── Expandable per-task reaction list ───────────────────────────────────────

type TaskReactionsProps = { reactions: Reaction[]; now: number };

function TaskReactions({ reactions, now }: TaskReactionsProps) {
  const [expanded, setExpanded] = useState(false);
  if (reactions.length === 0) { return null; }
  const sorted = [...reactions].sort((a, b) => b.sentAt - a.sentAt);
  return (
    <View style={styles.taskReactions}>
      <TouchableOpacity
        style={styles.taskReactionsToggle}
        onPress={() => setExpanded(e => !e)}
        hitSlop={8}>
        <Text style={styles.taskReactionsCount}>
          {reactions.length} {reactions.length === 1 ? 'reaction' : 'reactions'}{' '}
          <Text style={styles.taskReactionsChevron}>{expanded ? '▲' : '▼'}</Text>
        </Text>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.taskReactionsList}>
          {sorted.map(r => (
            <View key={r.id} style={styles.taskReactionItem}>
              <Text style={styles.taskReactionText}>"{r.text}"</Text>
              <Text style={styles.taskReactionTime}>{formatRelativeTime(r.sentAt, now)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Pulsing dot for the active/focus indicator ───────────────────────────────

function PulsingDot() {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.5, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale, opacity]);

  return (
    <Animated.View
      style={[styles.pulsingDot, { transform: [{ scale }], opacity }]}
    />
  );
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
};

function AddTaskModal({ visible, onClose, onAdd }: AddTaskModalProps) {
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
          <Text style={styles.modalTitle}>What are you working on?</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="e.g. Fix the login bug"
            placeholderTextColor="#555"
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
              ? <ActivityIndicator color="#0d0d0d" />
              : <Text style={styles.modalAddBtnText}>Add to session</Text>}
          </TouchableOpacity>
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
};

function ExtendOverlay({ isHost, hostName, onExtend, onCustomExtend, onEnd }: ExtendOverlayProps) {
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
          <Text style={styles.extendSubtitle}>
            Waiting for {hostName} to extend or end the session…
          </Text>
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
      <View style={styles.focusCard}>
        <View style={styles.focusHeader}>
          <PulsingDot />
          <Text style={styles.focusLabel}>FOCUS</Text>
        </View>
        <Text style={styles.focusTitle}>{task.title}</Text>
        <View style={styles.focusTimerRow}>
          <Text style={[styles.focusTimer, (isOld || overEstimate) && styles.focusTimerOld]}>
            {formatElapsed(elapsed)}
          </Text>
          {task.estimatedMs != null && (
            <Text style={[styles.focusEstimate, overEstimate && styles.focusEstimateOver]}>
              {overEstimate
                ? `over by ${formatElapsed(elapsed - task.estimatedMs)}`
                : `est. ${formatElapsed(task.estimatedMs)}`}
            </Text>
          )}
        </View>
        <View style={styles.focusActions}>
          <TouchableOpacity style={styles.focusDoneBtn} onPress={onComplete}>
            <Text style={styles.focusDoneBtnText}>Mark done</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.focusClearBtn} onPress={onClearActive}>
            <Text style={styles.focusClearBtnText}>Clear focus</Text>
          </TouchableOpacity>
        </View>
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

// ─── Partner member card ──────────────────────────────────────────────────────

type PartnerCardProps = {
  member: SessionMember;
  now: number;
  sentReactions: Reaction[];
  onReact: (taskId: string, completed: boolean) => void;
};

function PartnerCard({ member, now, sentReactions, onReact }: PartnerCardProps) {
  const activeTask = member.tasks.find(t => t.taskId === member.activeTaskId && !t.completedAt);
  const otherTasks = member.tasks.filter(t => t.taskId !== member.activeTaskId);

  return (
    <View style={styles.partnerCard}>
      <View style={styles.partnerHeader}>
        <View style={styles.partnerOnlineDot} />
        <Text style={styles.partnerName}>{member.displayName}</Text>
        <Text style={styles.partnerTaskCount}>
          {member.tasks.filter(t => !t.completedAt).length} active
        </Text>
      </View>

      {member.tasks.length === 0 && (
        <Text style={styles.partnerEmpty}>No tasks added yet.</Text>
      )}

      {/* Active/focus task shown first and highlighted */}
      {activeTask && (
        <View style={styles.partnerFocusTask}>
          <View style={styles.partnerFocusHeader}>
            <PulsingDot />
            <Text style={styles.partnerFocusLabel}>FOCUS</Text>
          </View>
          <Text style={styles.partnerFocusTitle} numberOfLines={2}>{activeTask.title}</Text>
          <View style={styles.partnerFocusMeta}>
            <Text style={[
              styles.partnerFocusTimer,
              now - activeTask.createdAt > 86400 * 1000 && styles.partnerTaskTimerOld,
            ]}>
              {formatElapsed(now - activeTask.createdAt)}
            </Text>
            {activeTask.estimatedMs != null && (
              <Text style={[
                styles.partnerEstimate,
                now - activeTask.createdAt > activeTask.estimatedMs && styles.partnerEstimateOver,
              ]}>
                {now - activeTask.createdAt > activeTask.estimatedMs
                  ? `over by ${formatElapsed((now - activeTask.createdAt) - activeTask.estimatedMs)}`
                  : `est. ${formatElapsed(activeTask.estimatedMs)}`}
              </Text>
            )}
            <TouchableOpacity
              style={styles.reactBtnFocus}
              onPress={() => onReact(activeTask.taskId, false)}
              hitSlop={8}>
              <Text style={styles.reactBtnFocusText}>React</Text>
            </TouchableOpacity>
          </View>
          <TaskReactions
            reactions={sentReactions.filter(r => r.taskId === activeTask.taskId)}
            now={now}
          />
        </View>
      )}

      {/* Remaining tasks */}
      {otherTasks.map(task => {
        const elapsed = now - task.createdAt;
        const isDone = task.completedAt !== null;
        const taskReactions = sentReactions.filter(r => r.taskId === task.taskId);

        return (
          <View key={task.taskId} style={[styles.partnerTask, isDone && styles.partnerTaskDone]}>
            <View style={styles.partnerTaskLeft}>
              <Text
                style={[styles.partnerTaskTitle, isDone && styles.partnerTaskTitleDone]}
                numberOfLines={2}>
                {task.title}
              </Text>
              {!isDone && (
                <Text style={[styles.partnerTaskTimer, elapsed > 86400 * 1000 && styles.partnerTaskTimerOld]}>
                  {formatElapsed(elapsed)}
                </Text>
              )}
              {!isDone && task.estimatedMs != null && (
                <Text style={[
                  styles.partnerEstimate,
                  elapsed > task.estimatedMs && styles.partnerEstimateOver,
                ]}>
                  {elapsed > task.estimatedMs
                    ? `over by ${formatElapsed(elapsed - task.estimatedMs)}`
                    : `est. ${formatElapsed(task.estimatedMs)}`}
                </Text>
              )}
              {isDone && (
                <Text style={styles.partnerTaskDoneLabel}>
                  Done in {formatElapsed((task.completedAt ?? 0) - task.createdAt)}
                </Text>
              )}
              <TaskReactions reactions={taskReactions} now={now} />
            </View>
            <TouchableOpacity
              style={[styles.reactBtn, isDone && styles.reactBtnCompleted]}
              onPress={() => onReact(task.taskId, isDone)}
              hitSlop={8}>
              <Text style={[styles.reactBtnText, isDone && styles.reactBtnCompletedText]}>
                {isDone ? '🎉' : 'React'}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}
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
              ? <ActivityIndicator color="#fff" size="small" />
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
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color="#f5f5f5" />
      </View>
    );
  }

  if (error || !session) {
    return (
      <View style={styles.loadingRoot}>
        <Text style={styles.errorText}>{error ?? 'Session not found.'}</Text>
        <TouchableOpacity style={styles.errorBackBtn} onPress={() => navigation.popToTop()}>
          <Text style={styles.errorBackBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (sessionEnded) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <EndedOverlay myMember={myMember} onBack={() => navigation.popToTop()} />
      </SafeAreaView>
    );
  }

  const isTimerWarning = timeLeft !== null && timeLeft < 5 * 60 * 1000 && !timerExpired;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
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
              sentReactions={reactions.filter(r => r.fromUserId === userId && r.toUserId === member.userId)}
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
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  loadingRoot: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  errorText: {
    color: '#c0392b',
    fontSize: 15,
    textAlign: 'center',
  },
  errorBackBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  errorBackBtnText: {
    color: '#555',
    fontSize: 14,
  },

  // Flash
  flashBanner: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 100,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  flashText: {
    color: '#f5f5f5',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f5f5f5',
    letterSpacing: -0.5,
  },
  modeBadge: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#1a1a1a',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6366f1',
    letterSpacing: 1.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  countdown: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f5f5f5',
    fontVariant: ['tabular-nums'],
  },
  countdownWarning: {
    color: '#c0392b',
  },
  countdownExpired: {
    color: '#555',
    fontSize: 14,
    fontWeight: '500',
  },
  // Invite card (shown in scroll body while no one has joined)
  inviteCard: {
    backgroundColor: '#13132a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  inviteCardLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6366f1',
    letterSpacing: 2,
  },
  inviteCardCode: {
    fontSize: 36,
    fontWeight: '700',
    color: '#f5f5f5',
    letterSpacing: 8,
    fontVariant: ['tabular-nums'],
  },
  inviteCardHint: {
    fontSize: 11,
    color: '#444',
    marginTop: 2,
  },
  endBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  endBtnText: {
    color: '#555',
    fontSize: 13,
  },
  leaveBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#3d1a1a',
  },
  leaveBtnText: {
    color: '#c0392b',
    fontSize: 13,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 60,
    gap: 24,
    paddingTop: 8,
  },

  // Sections
  section: {},
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#f5f5f5',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionMeta: {
    color: '#333',
    fontSize: 12,
  },
  emptyMy: {
    color: '#333',
    fontSize: 14,
    marginBottom: 8,
  },
  waitingPartner: {
    color: '#333',
    fontSize: 14,
  },

  // Focus hint
  focusHint: {
    backgroundColor: '#13132a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  focusHintText: {
    color: '#6366f1',
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.8,
  },

  // Pulsing dot
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366f1',
  },

  // Focus card (my active task, prominent)
  focusCard: {
    backgroundColor: '#13132a',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#6366f1',
    padding: 18,
    gap: 6,
  },
  focusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 2,
  },
  focusLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6366f1',
    letterSpacing: 2,
  },
  focusTitle: {
    color: '#f5f5f5',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
  },
  focusTimerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  focusTimer: {
    color: '#8b8cf4',
    fontSize: 16,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  focusTimerOld: {
    color: '#c0392b',
  },
  focusEstimate: {
    color: '#555',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  focusEstimateOver: {
    color: '#8b2e2e',
  },
  focusActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  focusDoneBtn: {
    flex: 1,
    backgroundColor: '#6366f1',
    borderRadius: 9,
    paddingVertical: 11,
    alignItems: 'center',
  },
  focusDoneBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  focusClearBtn: {
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  focusClearBtnText: {
    color: '#555',
    fontSize: 14,
  },

  taskGap: {
    gap: 8,
  },
  // Regular my-task row
  myTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 12,
    gap: 10,
  },
  myTaskRowDone: { opacity: 0.45 },
  activeDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2a2a2a',
  },
  myTaskInfo: { flex: 1, gap: 2 },
  myTaskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  myTaskTitle: {
    color: '#f5f5f5',
    fontSize: 15,
    fontWeight: '500',
  },
  myTaskTitleDone: {
    textDecorationLine: 'line-through',
    color: '#555',
  },
  myTaskTimer: {
    color: '#888',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  myTaskTimerOld: { color: '#c0392b' },
  myTaskEstimate: {
    color: '#555',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  myTaskEstimateOver: { color: '#8b2e2e' },
  myTaskDoneLabel: { color: '#2e6b3e', fontSize: 12 },
  myDoneBtn: {
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  myDoneBtnText: {
    color: '#f5f5f5',
    fontSize: 12,
    fontWeight: '500',
  },
  addTaskBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderStyle: 'dashed',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  addTaskBtnText: { color: '#444', fontSize: 14 },
  completedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  completedToggleText: {
    color: '#444',
    fontSize: 13,
    fontWeight: '500',
  },
  completedToggleChevron: {
    color: '#333',
    fontSize: 10,
  },

  // Partner card
  partnerCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f1f1f',
    padding: 14,
    gap: 8,
  },
  partnerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  partnerOnlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#2e6b3e',
  },
  partnerName: {
    color: '#f5f5f5',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  partnerTaskCount: { color: '#333', fontSize: 12 },
  partnerEmpty: { color: '#333', fontSize: 13 },

  // Partner focus task
  partnerFocusTask: {
    backgroundColor: '#13132a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    padding: 12,
    gap: 4,
  },
  partnerFocusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  partnerFocusLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6366f1',
    letterSpacing: 1.5,
  },
  partnerFocusTitle: {
    color: '#f5f5f5',
    fontSize: 15,
    fontWeight: '500',
  },
  partnerFocusMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  partnerFocusTimer: {
    color: '#8b8cf4',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  reactBtnFocus: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  reactBtnFocusText: { color: '#6366f1', fontSize: 12 },

  // Partner regular task
  partnerTask: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#222',
    padding: 10,
    gap: 8,
  },
  partnerTaskDone: { opacity: 0.4 },
  partnerTaskLeft: { flex: 1, gap: 3 },
  partnerTaskTitle: {
    color: '#f5f5f5',
    fontSize: 14,
    fontWeight: '500',
  },
  partnerTaskTitleDone: {
    textDecorationLine: 'line-through',
    color: '#444',
  },
  partnerTaskTimer: {
    color: '#666',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  partnerTaskTimerOld: { color: '#8b2e2e' },
  partnerTaskDoneLabel: { color: '#2e6b3e', fontSize: 12 },
  partnerEstimate: { color: '#888', fontSize: 11 },
  partnerEstimateOver: { color: '#c0392b' },
  reactBtn: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginTop: 2,
  },
  reactBtnText: { color: '#555', fontSize: 12 },
  reactBtnCompleted: {
    borderColor: '#2a2a3a',
    backgroundColor: '#13132a',
  },
  reactBtnCompletedText: {
    fontSize: 14,
  },

  // Per-task expandable reaction list
  taskReactions: {
    marginTop: 6,
  },
  taskReactionsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskReactionsCount: {
    color: '#6366f1',
    fontSize: 11,
    fontWeight: '500',
  },
  taskReactionsChevron: {
    fontSize: 9,
    color: '#6366f1',
  },
  taskReactionsList: {
    marginTop: 5,
    gap: 5,
    paddingLeft: 4,
    borderLeftWidth: 1,
    borderLeftColor: '#2a2a4a',
  },
  taskReactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  taskReactionText: {
    color: '#8888cc',
    fontSize: 12,
    fontStyle: 'italic',
    flex: 1,
  },
  taskReactionTime: {
    color: '#333',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },

  // Extend overlay
  extendOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
    paddingHorizontal: 28,
  },
  extendCard: {
    width: '100%',
    backgroundColor: '#141414',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 28,
    gap: 12,
    alignItems: 'center',
  },
  extendTitle: {
    color: '#f5f5f5',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  extendSubtitle: {
    color: '#555',
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  extendBtns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    justifyContent: 'center',
  },
  extendChip: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  extendChipDisabled: { opacity: 0.4 },
  extendChipText: {
    color: '#6366f1',
    fontSize: 15,
    fontWeight: '600',
  },
  extendEndBtn: {
    backgroundColor: 'transparent',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  extendEndBtnText: {
    color: '#555',
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
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  modalSheet: {
    backgroundColor: '#141414',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    paddingTop: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#f5f5f5',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  modalSubtitle: {
    color: '#555',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: '#1a1a1a',
    color: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginBottom: 16,
    minHeight: 52,
  },
  estimateLabel: {
    color: '#555',
    fontSize: 13,
    marginBottom: 10,
    marginTop: 4,
  },
  estimateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  estimateChip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  estimateChipSelected: {
    backgroundColor: '#f5f5f5',
    borderColor: '#f5f5f5',
  },
  estimateChipText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '500',
  },
  estimateChipTextSelected: {
    color: '#0d0d0d',
  },
  modalAddBtn: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  modalAddBtnDisabled: { opacity: 0.3 },
  modalAddBtnText: {
    color: '#0d0d0d',
    fontSize: 16,
    fontWeight: '600',
  },
  modalCloseBtn: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  modalCloseBtnText: {
    color: '#f5f5f5',
    fontSize: 15,
    fontWeight: '500',
  },

  // Reaction picker
  reactionSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#141414',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    paddingTop: 24,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    gap: 10,
  },
  reactionTitle: {
    color: '#f5f5f5',
    fontSize: 18,
    fontWeight: '600',
  },
  reactionMeta: { color: '#555', fontSize: 13, marginBottom: 4 },
  reactionOptions: { gap: 8 },
  reactionBtn: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  reactionBtnText: {
    color: '#f5f5f5',
    fontSize: 15,
    fontWeight: '500',
  },
  reactionCloseBtn: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  reactionCloseBtnText: { color: '#555', fontSize: 14 },

  // Join request popup
  joinPopupOverlay: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    zIndex: 200,
  },
  joinPopupCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#6366f1',
    padding: 18,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  joinPopupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  joinPopupDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366f1',
  },
  joinPopupName: {
    color: '#f5f5f5',
    fontSize: 16,
    fontWeight: '700',
  },
  joinPopupLabel: {
    color: '#888',
    fontSize: 14,
  },
  joinPopupMeta: {
    color: '#555',
    fontSize: 13,
    paddingLeft: 16,
  },
  joinPopupBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  joinDenyBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingVertical: 12,
    alignItems: 'center',
  },
  joinDenyBtnText: {
    color: '#555',
    fontSize: 14,
    fontWeight: '500',
  },
  joinApproveBtn: {
    flex: 2,
    borderRadius: 10,
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    alignItems: 'center',
  },
  joinApproveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  joinBtnDisabled: {
    opacity: 0.5,
  },

  // Session ended
  endedOverlay: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 60,
    gap: 12,
  },
  endedTitle: {
    color: '#f5f5f5',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  endedSubtitle: {
    color: '#555',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 8,
  },
  endedTask: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  endedTaskMark: {
    color: '#2e6b3e',
    fontSize: 14,
    fontWeight: '600',
  },
  endedTaskTitle: { color: '#888', fontSize: 14, flex: 1 },
  endedBackBtn: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  endedBackBtnText: {
    color: '#0d0d0d',
    fontSize: 16,
    fontWeight: '600',
  },
});
