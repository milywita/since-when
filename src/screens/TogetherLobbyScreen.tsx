import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import {
  createSession,
  joinSession,
  startSession,
  findSessionByCode,
  subscribeToSession,
  subscribeToMembers,
} from '../services/sessionService';
import { useTasks } from '../hooks/useTasks';
import type { Session, SessionMember, SessionTask } from '../types/Session';
import { SESSION_DURATION_PRESETS } from '../types/Session';
import type { Task } from '../types/Task';
import type { AppScreenProps } from '../navigation/types';

type Props = AppScreenProps<'TogetherLobby'>;

type Mode = 'pick' | 'task-selection' | 'hosting' | 'joining';

// Tracks what the user chose before task selection
type PendingCreate = { kind: 'create'; durationMs: number };
type PendingJoin   = { kind: 'join'; sessionId: string; durationMs: number };
type Pending = PendingCreate | PendingJoin;

// ─── Elapsed time helper (shared with solo) ───────────────────────────────────

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

// ─── Task selection screen ────────────────────────────────────────────────────

type TaskSelectionProps = {
  activeTasks: Task[];
  tasksLoading: boolean;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onConfirm: () => void;
  confirming: boolean;
  now: number;
};

function TaskSelection({
  activeTasks,
  tasksLoading,
  selectedIds,
  onToggle,
  onConfirm,
  confirming,
  now,
}: TaskSelectionProps) {
  return (
    <View style={styles.selectionContainer}>
      <Text style={styles.selectionTitle}>Bring tasks into the session</Text>
      <Text style={styles.selectionSubtitle}>
        Pick up to 6 tasks from your Solo list to work on together.
        Anything you don't complete will stay in Solo mode.
      </Text>

      {tasksLoading && (
        <ActivityIndicator color="#f5f5f5" style={styles.selectionLoader} />
      )}

      {!tasksLoading && activeTasks.length === 0 && (
        <View style={styles.selectionEmpty}>
          <Text style={styles.selectionEmptyText}>No active Solo tasks yet.</Text>
          <Text style={styles.selectionEmptyHint}>
            You can still add tasks once the session starts.
          </Text>
        </View>
      )}

      {!tasksLoading && activeTasks.length > 0 && (
        <FlatList
          data={activeTasks}
          keyExtractor={t => t.id}
          style={styles.selectionList}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const checked = selectedIds.has(item.id);
            const elapsed = now - item.createdAt;
            const atLimit = selectedIds.size >= 6 && !checked;
            return (
              <TouchableOpacity
                style={[
                  styles.selectionRow,
                  checked && styles.selectionRowChecked,
                  atLimit && styles.selectionRowDisabled,
                ]}
                onPress={() => !atLimit && onToggle(item.id)}
                activeOpacity={atLimit ? 1 : 0.7}>
                <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                  {checked && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <View style={styles.selectionTaskInfo}>
                  <Text
                    style={[styles.selectionTaskTitle, atLimit && styles.selectionTaskTitleDim]}
                    numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.selectionTaskTimer}>{formatElapsed(elapsed)}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <TouchableOpacity
        style={[styles.actionBtn, confirming && styles.actionBtnDisabled]}
        onPress={onConfirm}
        disabled={confirming}>
        {confirming
          ? <ActivityIndicator color="#0d0d0d" />
          : (
            <Text style={styles.actionBtnText}>
              {selectedIds.size > 0
                ? `Continue with ${selectedIds.size} task${selectedIds.size !== 1 ? 's' : ''}`
                : 'Continue without tasks'}
            </Text>
          )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Lobby waiting room ───────────────────────────────────────────────────────

type LobbyWaitProps = {
  session: Session;
  members: SessionMember[];
  isHost: boolean;
  onStart: () => Promise<void>;
  onLeave: () => void;
};

function LobbyWaitingRoom({ session, members, isHost, onStart, onLeave }: LobbyWaitProps) {
  const [starting, setStarting] = useState(false);
  const dotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [dotAnim]);

  const dotOpacity = dotAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const canStart = members.length >= 2;
  const durationLabel =
    SESSION_DURATION_PRESETS.find(p => p.ms === session.durationMs)?.label ??
    `${Math.round(session.durationMs / 60000)} min`;

  async function handleStart() {
    setStarting(true);
    try {
      await onStart();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not start session.');
      setStarting(false);
    }
  }

  return (
    <View style={styles.lobbyContainer}>
      <View style={styles.lobbyCard}>
        <Text style={styles.lobbyLabel}>INVITE CODE</Text>
        <Text style={styles.inviteCode}>{session.inviteCode}</Text>
        <Text style={styles.lobbyMeta}>{durationLabel} session</Text>
      </View>

      <View style={styles.lobbyParticipants}>
        <Text style={styles.lobbyParticipantsLabel}>
          {members.length} {members.length === 1 ? 'person' : 'people'} in the room
        </Text>
        {members.map(m => (
          <View key={m.userId} style={styles.participantRow}>
            <View style={styles.participantDot} />
            <Text style={styles.participantName}>{m.displayName}</Text>
            <Text style={styles.participantTaskCount}>
              {m.tasks.length > 0 ? `${m.tasks.length} task${m.tasks.length !== 1 ? 's' : ''}` : ''}
            </Text>
          </View>
        ))}
        {!canStart && (
          <View style={styles.waitingRow}>
            <Animated.View style={[styles.waitingDot, { opacity: dotOpacity }]} />
            <Text style={styles.waitingText}>Waiting for someone to join…</Text>
          </View>
        )}
      </View>

      {isHost ? (
        <TouchableOpacity
          style={[styles.startBtn, !canStart && styles.startBtnDisabled]}
          onPress={handleStart}
          disabled={!canStart || starting}>
          {starting
            ? <ActivityIndicator color="#0d0d0d" />
            : <Text style={styles.startBtnText}>Start session</Text>}
        </TouchableOpacity>
      ) : (
        <View style={styles.guestWait}>
          <Text style={styles.guestWaitText}>Waiting for the host to start…</Text>
        </View>
      )}

      <TouchableOpacity style={styles.leaveBtn} onPress={onLeave}>
        <Text style={styles.leaveBtnText}>Leave</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function TogetherLobbyScreen({ navigation }: Props) {
  const user = auth().currentUser!;
  const displayName = user.displayName ?? user.email?.split('@')[0] ?? 'Anonymous';

  const { activeTasks, loading: tasksLoading } = useTasks();

  const [mode, setMode] = useState<Mode>('pick');
  const [pending, setPending] = useState<Pending | null>(null);
  const [selectedDurationMs, setSelectedDurationMs] = useState(SESSION_DURATION_PRESETS[0].ms);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Checked task IDs in the selection step
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Live ticker for elapsed times in selection list
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  // Lobby state after creation/join
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [liveSession, setLiveSession] = useState<Session | null>(null);
  const [liveMembers, setLiveMembers] = useState<SessionMember[]>([]);

  useEffect(() => {
    if (!sessionId) { return; }
    const unsubS = subscribeToSession(sessionId, s => setLiveSession(s));
    const unsubM = subscribeToMembers(sessionId, m => setLiveMembers(m));
    return () => { unsubS(); unsubM(); };
  }, [sessionId]);

  // Navigate once host starts
  useEffect(() => {
    if (liveSession?.status === 'active' && sessionId) {
      navigation.replace('Session', { sessionId });
    }
  }, [liveSession, sessionId, navigation]);

  function toggleTask(id: string) {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function buildSessionTasks(): SessionTask[] {
    return activeTasks
      .filter(t => selectedTaskIds.has(t.id))
      .map(t => ({
        taskId: t.id,
        sourceSoloTaskId: t.id,
        title: t.title,
        createdAt: t.createdAt,
        completedAt: null,
      }));
  }

  // ── Step 1 handlers ───────────────────────────────────
  async function handleHost() {
    setLoading(true);
    try {
      // Create session early so we have an invite code to show in the lobby.
      // Tasks will be applied in the confirmation step.
      const id = await createSession(user.uid, displayName, selectedDurationMs, []);
      setSessionId(id);
      setPending({ kind: 'create', durationMs: selectedDurationMs });
      setSelectedTaskIds(new Set());
      setMode('task-selection');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not create session.');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinFind() {
    const code = joinCode.trim();
    if (code.length < 6) {
      Alert.alert('Invalid code', 'Please enter the full 6-character invite code.');
      return;
    }
    setLoading(true);
    try {
      const result = await findSessionByCode(code);
      if (!result) {
        Alert.alert('Not found', 'No open session with that code. Check the code and try again.');
        return;
      }
      setPending({ kind: 'join', sessionId: result.sessionId, durationMs: result.durationMs });
      setSelectedTaskIds(new Set());
      setMode('task-selection');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not find session.');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2 (task selection) confirmation ──────────────
  async function handleConfirmTasks() {
    if (!pending) { return; }
    const tasks = buildSessionTasks();
    setConfirming(true);
    try {
      if (pending.kind === 'create') {
        // Session was already created; update the member doc with chosen tasks
        // by re-using addTaskToSession calls — or simpler: patch member doc directly.
        // We leverage the fact that the member doc was set with tasks:[] on creation.
        // updateMemberTasks is not exported, so we re-set member via joinSession pattern.
        // Easiest: call addTaskToSession for each task.
        const { addTaskToSession } = await import('../services/sessionService');
        for (const task of tasks) {
          await addTaskToSession(sessionId!, user.uid, task);
        }
        setMode('hosting');
      } else {
        // Join the session with the chosen tasks
        await joinSession(pending.sessionId, user.uid, displayName, tasks);
        setSessionId(pending.sessionId);
        setMode('joining');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Something went wrong.');
    } finally {
      setConfirming(false);
    }
  }

  function handleLeave() {
    setSessionId(null);
    setLiveSession(null);
    setLiveMembers([]);
    setPending(null);
    setMode('pick');
  }

  // ── Render: lobby ─────────────────────────────────────
  if ((mode === 'hosting' || mode === 'joining') && liveSession && sessionId) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Together</Text>
          <View style={styles.modeBadge}>
            <Text style={styles.modeBadgeText}>WAITING</Text>
          </View>
        </View>
        <LobbyWaitingRoom
          session={liveSession}
          members={liveMembers}
          isHost={liveSession.createdBy === user.uid}
          onStart={() => startSession(sessionId, liveSession.durationMs)}
          onLeave={handleLeave}
        />
      </SafeAreaView>
    );
  }

  // ── Render: task selection ────────────────────────────
  if (mode === 'task-selection') {
    const subtitle = pending?.kind === 'join'
      ? `${Math.round((pending.durationMs) / 60000)} min session`
      : pending?.kind === 'create'
        ? `${Math.round((pending.durationMs) / 60000)} min session`
        : '';
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={handleLeave}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>Together</Text>
            <View style={styles.modeBadge}>
              <Text style={styles.modeBadgeText}>{subtitle}</Text>
            </View>
          </View>
        </View>
        <TaskSelection
          activeTasks={activeTasks}
          tasksLoading={tasksLoading}
          selectedIds={selectedTaskIds}
          onToggle={toggleTask}
          onConfirm={handleConfirmTasks}
          confirming={confirming}
          now={now}
        />
      </SafeAreaView>
    );
  }

  // ── Render: pick (create or join) ─────────────────────
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerTitle}>Together</Text>
          <View style={styles.modeBadge}>
            <Text style={styles.modeBadgeText}>TOGETHER</Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        {/* ── Host ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Host a session</Text>
          <Text style={styles.sectionSubtitle}>
            Pick a duration, get a code, share it with your partner.
          </Text>
          <View style={styles.presetRow}>
            {SESSION_DURATION_PRESETS.map(p => (
              <TouchableOpacity
                key={p.ms}
                style={[
                  styles.presetChip,
                  selectedDurationMs === p.ms && styles.presetChipSelected,
                ]}
                onPress={() => setSelectedDurationMs(p.ms)}>
                <Text
                  style={[
                    styles.presetChipText,
                    selectedDurationMs === p.ms && styles.presetChipTextSelected,
                  ]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.actionBtn, loading && styles.actionBtnDisabled]}
            onPress={handleHost}
            disabled={loading}>
            {loading
              ? <ActivityIndicator color="#0d0d0d" />
              : <Text style={styles.actionBtnText}>Create session</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* ── Join ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Join a session</Text>
          <Text style={styles.sectionSubtitle}>
            Enter the 6-character code your partner shared.
          </Text>
          <TextInput
            style={styles.codeInput}
            placeholder="e.g. ABC123"
            placeholderTextColor="#444"
            value={joinCode}
            onChangeText={v => setJoinCode(v.toUpperCase())}
            autoCapitalize="characters"
            maxLength={6}
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[
              styles.actionBtn,
              styles.actionBtnSecondary,
              (loading || joinCode.trim().length < 6) && styles.actionBtnDisabled,
            ]}
            onPress={handleJoinFind}
            disabled={loading || joinCode.trim().length < 6}>
            <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>
              Find session
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
  },
  backBtn: {
    paddingVertical: 4,
    marginTop: 4,
  },
  backBtnText: {
    color: '#555',
    fontSize: 14,
  },
  headerTitleGroup: {
    flex: 1,
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

  // Pick (create / join)
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: '#f5f5f5',
    fontSize: 18,
    fontWeight: '600',
  },
  sectionSubtitle: {
    color: '#555',
    fontSize: 14,
    lineHeight: 20,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  presetChip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  presetChipSelected: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  presetChipText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  presetChipTextSelected: {
    color: '#fff',
  },
  actionBtn: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  actionBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  actionBtnDisabled: {
    opacity: 0.35,
  },
  actionBtnText: {
    color: '#0d0d0d',
    fontSize: 15,
    fontWeight: '600',
  },
  actionBtnTextSecondary: {
    color: '#f5f5f5',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 28,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1a1a1a',
  },
  dividerText: {
    color: '#333',
    fontSize: 13,
  },
  codeInput: {
    backgroundColor: '#1a1a1a',
    color: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 6,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    textAlign: 'center',
  },

  // Task selection
  selectionContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  selectionTitle: {
    color: '#f5f5f5',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  selectionSubtitle: {
    color: '#555',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  selectionLoader: {
    marginTop: 40,
  },
  selectionEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 60,
  },
  selectionEmptyText: {
    color: '#f5f5f5',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  selectionEmptyHint: {
    color: '#444',
    fontSize: 14,
    textAlign: 'center',
  },
  selectionList: {
    flex: 1,
    marginBottom: 16,
  },
  selectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  selectionRowChecked: {
    borderColor: '#6366f1',
    backgroundColor: '#13132a',
  },
  selectionRowDisabled: {
    opacity: 0.4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  checkmark: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 15,
  },
  selectionTaskInfo: {
    flex: 1,
    gap: 3,
  },
  selectionTaskTitle: {
    color: '#f5f5f5',
    fontSize: 15,
    fontWeight: '500',
  },
  selectionTaskTitleDim: {
    color: '#444',
  },
  selectionTaskTimer: {
    color: '#555',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },

  // Lobby waiting room
  lobbyContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  lobbyCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  lobbyLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#555',
    letterSpacing: 2,
  },
  inviteCode: {
    fontSize: 42,
    fontWeight: '700',
    color: '#f5f5f5',
    letterSpacing: 8,
  },
  lobbyMeta: {
    fontSize: 13,
    color: '#555',
    marginTop: 4,
  },
  lobbyParticipants: {
    marginTop: 24,
    gap: 10,
  },
  lobbyParticipantsLabel: {
    color: '#555',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  participantDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2e6b3e',
  },
  participantName: {
    color: '#f5f5f5',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  participantTaskCount: {
    color: '#333',
    fontSize: 12,
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  waitingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366f1',
  },
  waitingText: {
    color: '#555',
    fontSize: 14,
  },
  startBtn: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 36,
  },
  startBtnDisabled: {
    opacity: 0.3,
  },
  startBtnText: {
    color: '#0d0d0d',
    fontSize: 16,
    fontWeight: '600',
  },
  guestWait: {
    marginTop: 36,
    alignItems: 'center',
  },
  guestWaitText: {
    color: '#555',
    fontSize: 14,
  },
  leaveBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
  leaveBtnText: {
    color: '#333',
    fontSize: 14,
  },
});
