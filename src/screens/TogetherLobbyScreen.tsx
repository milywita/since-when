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
  Platform,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import {
  createSession,
  findActiveSessionByInviteCode,
  addTaskToSession,
  requestToJoin,
  completeJoin,
  subscribeToJoinRequest,
} from '../services/sessionService';
import { subscribeToUserProfile } from '../services/userService';
import { useTasks } from '../hooks/useTasks';
import { SESSION_DURATION_PRESETS } from '../types/Session';
import type { SessionTask, JoinRequest } from '../types/Session';
import type { UserProfile, SessionPartner } from '../types/User';
import type { Task } from '../types/Task';
import type { AppScreenProps } from '../navigation/types';

type Props = AppScreenProps<'TogetherLobby'>;

type Mode = 'pick' | 'task-selection' | 'waiting-approval';
type PendingCreate = { kind: 'create'; sessionId: string; durationMs: number };
type PendingJoin   = { kind: 'join';   sessionId: string; durationMs: number; hostUsername: string };
type Pending = PendingCreate | PendingJoin;

// ─── Elapsed helper ───────────────────────────────────────────────────────────

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
  subtitle: string;
  onToggle: (id: string) => void;
  onConfirm: () => void;
  confirming: boolean;
  onBack: () => void;
  now: number;
};

function TaskSelection({
  activeTasks,
  tasksLoading,
  selectedIds,
  subtitle,
  onToggle,
  onConfirm,
  confirming,
  onBack,
  now,
}: TaskSelectionProps) {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerTitle}>Together</Text>
          <View style={styles.modeBadge}>
            <Text style={styles.modeBadgeText}>{subtitle}</Text>
          </View>
        </View>
      </View>

      <View style={styles.selectionContainer}>
        <Text style={styles.selectionTitle}>Bring tasks into the session</Text>
        <Text style={styles.selectionSubtitle}>
          Pick up to 6 tasks from your Solo list. Anything you don't complete stays in Solo.
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
                  ? `Start with ${selectedIds.size} task${selectedIds.size !== 1 ? 's' : ''}`
                  : 'Start without tasks'}
              </Text>
            )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Partner history row ──────────────────────────────────────────────────────

type PartnerRowProps = {
  partner: SessionPartner;
  onJoin: () => void;
  joining: boolean;
};

function PartnerRow({ partner, onJoin, joining }: PartnerRowProps) {
  const elapsed = Date.now() - partner.lastSessionAt;
  const label = elapsed < 60000
    ? 'just now'
    : elapsed < 3600000
      ? `${Math.floor(elapsed / 60000)}m ago`
      : elapsed < 86400000
        ? `${Math.floor(elapsed / 3600000)}h ago`
        : `${Math.floor(elapsed / 86400000)}d ago`;

  return (
    <View style={styles.partnerRow}>
      <View style={styles.partnerInfo}>
        <Text style={styles.partnerName}>{partner.username}</Text>
        <Text style={styles.partnerMeta}>Last session {label}</Text>
      </View>
      <TouchableOpacity
        style={[styles.joinPartnerBtn, joining && styles.joinPartnerBtnDisabled]}
        onPress={onJoin}
        disabled={joining}>
        {joining
          ? <ActivityIndicator color="#6366f1" size="small" />
          : <Text style={styles.joinPartnerBtnText}>Join</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function TogetherLobbyScreen({ navigation }: Props) {
  const user = auth().currentUser!;

  const { activeTasks, loading: tasksLoading } = useTasks();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [mode, setMode] = useState<Mode>('pick');
  const [pending, setPending] = useState<Pending | null>(null);
  const [selectedDurationMs, setSelectedDurationMs] = useState(SESSION_DURATION_PRESETS[0].ms);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [joiningPartnerId, setJoiningPartnerId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  // Join request waiting state
  const [joinRequestId, setJoinRequestId] = useState<string | null>(null);
  const [joinRequestSessionId, setJoinRequestSessionId] = useState<string | null>(null);
  const dotAnim = useRef(new Animated.Value(0)).current;

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const unsub = subscribeToUserProfile(user.uid, setUserProfile);
    return unsub;
  }, [user.uid]);

  // Pulsing dot animation for waiting screen
  useEffect(() => {
    if (mode !== 'waiting-approval') { return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [mode, dotAnim]);

  // Subscribe to join request status changes
  useEffect(() => {
    if (!joinRequestId || !joinRequestSessionId) { return; }
    const unsub = subscribeToJoinRequest(
      joinRequestSessionId,
      joinRequestId,
      async (req: JoinRequest | null) => {
        if (!req) { return; }
        if (req.status === 'approved') {
          try {
            await completeJoin(joinRequestSessionId, req);
            navigation.replace('Session', { sessionId: joinRequestSessionId });
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Could not complete joining.');
            setMode('pick');
            setJoinRequestId(null);
            setJoinRequestSessionId(null);
          }
        } else if (req.status === 'denied') {
          Alert.alert('Not this time', 'The host didn\'t let you in. Try again later.');
          setMode('pick');
          setJoinRequestId(null);
          setJoinRequestSessionId(null);
        }
      },
    );
    return unsub;
  }, [joinRequestId, joinRequestSessionId, navigation]);

  const displayName = userProfile?.username ?? user.displayName ?? user.email?.split('@')[0] ?? 'Anonymous';

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
        estimatedMs: t.estimatedMs ?? null,
      }));
  }

  // ── Step 1: Host ───────────────────────────────────────
  async function handleHost() {
    setLoading(true);
    try {
      const sessionId = await createSession(user.uid, displayName, selectedDurationMs, []);
      setPending({ kind: 'create', sessionId, durationMs: selectedDurationMs });
      setSelectedTaskIds(new Set());
      setMode('task-selection');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not create session.');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 1: Join by code ───────────────────────────────
  async function handleJoinFind() {
    const code = joinCode.trim();
    if (code.length < 6) {
      Alert.alert('Invalid code', 'Please enter the full 6-character invite code.');
      return;
    }
    setLoading(true);
    try {
      const result = await findActiveSessionByInviteCode(code);
      if (!result) {
        Alert.alert('Not found', 'No active session found for that code. Ask your partner to start a session first.');
        return;
      }
      setPending({ kind: 'join', sessionId: result.sessionId, durationMs: result.durationMs, hostUsername: result.hostUsername });
      setSelectedTaskIds(new Set());
      setMode('task-selection');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not find session.');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 1: Join from partner history ─────────────────
  async function handleJoinPartner(partner: SessionPartner) {
    setJoiningPartnerId(partner.userId);
    try {
      const partnerProfile = await import('../services/userService').then(m => m.getUserProfile(partner.userId));
      if (!partnerProfile?.activeSessionId) {
        Alert.alert('No active session', `${partner.username} isn't in a session right now.`);
        return;
      }
      const { findActiveSessionByInviteCode: findByCode } = await import('../services/sessionService');
      const sessionDoc = await import('@react-native-firebase/firestore').then(m =>
        m.default().collection('sessions').doc(partnerProfile.activeSessionId!).get(),
      );
      if (!sessionDoc.exists) {
        Alert.alert('Session ended', 'That session has already ended.');
        return;
      }
      const session = sessionDoc.data() as { status: string; durationMs: number };
      if (session.status !== 'active') {
        Alert.alert('Session ended', 'That session has already ended.');
        return;
      }
      setPending({ kind: 'join', sessionId: partnerProfile.activeSessionId, durationMs: session.durationMs, hostUsername: partner.username });
      setSelectedTaskIds(new Set());
      setMode('task-selection');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not join partner session.');
    } finally {
      setJoiningPartnerId(null);
    }
  }

  // ── Step 2: Confirm task selection ────────────────────
  async function handleConfirmTasks() {
    if (!pending) { return; }
    const tasks = buildSessionTasks();
    setConfirming(true);
    try {
      if (pending.kind === 'create') {
        // Host: add selected tasks to their already-active session
        for (const task of tasks) {
          await addTaskToSession(pending.sessionId, user.uid, task);
        }
        navigation.replace('Session', { sessionId: pending.sessionId });
      } else {
        // Joiner: send a join request and wait for host approval
        const reqId = await requestToJoin(pending.sessionId, user.uid, displayName, tasks);
        setJoinRequestId(reqId);
        setJoinRequestSessionId(pending.sessionId);
        setMode('waiting-approval');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Something went wrong.');
    } finally {
      setConfirming(false);
    }
  }

  function handleWithdrawRequest() {
    if (joinRequestId && joinRequestSessionId) {
      import('../services/sessionService').then(({ denyJoinRequest }) => {
        // Reuse deny to mark the request as denied (withdraw = self-deny)
        // Actually just delete it
      });
      import('@react-native-firebase/firestore').then(m => {
        m.default()
          .collection('sessions')
          .doc(joinRequestSessionId)
          .collection('joinRequests')
          .doc(joinRequestId)
          .delete()
          .catch(console.error);
      });
    }
    setMode('pick');
    setJoinRequestId(null);
    setJoinRequestSessionId(null);
  }

  function handleBack() {
    setPending(null);
    setMode('pick');
  }

  // ── Render: waiting for host approval ─────────────────
  if (mode === 'waiting-approval' && pending && pending.kind === 'join') {
    const dotOpacity = dotAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>Together</Text>
            <View style={styles.modeBadge}>
              <Text style={styles.modeBadgeText}>WAITING</Text>
            </View>
          </View>
        </View>
        <View style={styles.waitingContainer}>
          <View style={styles.waitingCard}>
            <Animated.View style={[styles.waitingDot, { opacity: dotOpacity }]} />
            <Text style={styles.waitingTitle}>
              Waiting for {pending.hostUsername} to let you in…
            </Text>
            <Text style={styles.waitingSubtitle}>
              They'll see a notification asking to approve your request.
            </Text>
          </View>
          <TouchableOpacity style={styles.withdrawBtn} onPress={handleWithdrawRequest}>
            <Text style={styles.withdrawBtnText}>Cancel request</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: task selection ─────────────────────────────
  if (mode === 'task-selection' && pending) {
    const subtitle = `${Math.round(pending.durationMs / 60000)} min session`;
    return (
      <TaskSelection
        activeTasks={activeTasks}
        tasksLoading={tasksLoading}
        selectedIds={selectedTaskIds}
        subtitle={subtitle}
        onToggle={toggleTask}
        onConfirm={handleConfirmTasks}
        confirming={confirming}
        onBack={handleBack}
        now={now}
      />
    );
  }

  // ── Render: pick ──────────────────────────────────────
  const partners = userProfile?.partners ?? [];

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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* ── Your invite code ── */}
        <View style={styles.yourCodeCard}>
          <Text style={styles.yourCodeLabel}>YOUR INVITE CODE</Text>
          <Text style={styles.yourCode}>
            {userProfile?.personalInviteCode ?? '------'}
          </Text>
          <Text style={styles.yourCodeHint}>
            Share this code so others can join your session.
          </Text>
        </View>

        {/* ── Host a session ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Start a session</Text>
          <Text style={styles.sectionSubtitle}>
            Pick a duration. Your session starts immediately.
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
              : <Text style={styles.actionBtnText}>Start session</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or join</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* ── Join by code ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Enter a code</Text>
          <Text style={styles.sectionSubtitle}>
            Type your partner's 6-character invite code.
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

        {/* ── Partner history ── */}
        {partners.length > 0 && (
          <>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or pick someone</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent partners</Text>
              <Text style={styles.sectionSubtitle}>
                Tap to jump straight into their active session.
              </Text>
              {partners.map(p => (
                <PartnerRow
                  key={p.userId}
                  partner={p}
                  onJoin={() => handleJoinPartner(p)}
                  joining={joiningPartnerId === p.userId}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
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

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 0,
  },

  // Your invite code card
  yourCodeCard: {
    backgroundColor: '#13132a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    padding: 24,
    alignItems: 'center',
    gap: 6,
    marginBottom: 28,
  },
  yourCodeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6366f1',
    letterSpacing: 2,
  },
  yourCode: {
    fontSize: 40,
    fontWeight: '700',
    color: '#f5f5f5',
    letterSpacing: 8,
    fontVariant: ['tabular-nums'],
  },
  yourCodeHint: {
    fontSize: 13,
    color: '#555',
    marginTop: 2,
  },

  section: {
    gap: 10,
    marginBottom: 8,
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
    marginVertical: 24,
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

  // Partner history
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 14,
    gap: 12,
  },
  partnerInfo: {
    flex: 1,
    gap: 3,
  },
  partnerName: {
    color: '#f5f5f5',
    fontSize: 15,
    fontWeight: '600',
  },
  partnerMeta: {
    color: '#444',
    fontSize: 12,
  },
  joinPartnerBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6366f1',
    paddingVertical: 7,
    paddingHorizontal: 16,
    minWidth: 60,
    alignItems: 'center',
  },
  joinPartnerBtnDisabled: {
    opacity: 0.5,
  },
  joinPartnerBtnText: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '600',
  },

  // Waiting for approval
  waitingContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
    gap: 20,
  },
  waitingCard: {
    backgroundColor: '#13132a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    padding: 28,
    alignItems: 'center',
    gap: 14,
  },
  waitingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6366f1',
  },
  waitingTitle: {
    color: '#f5f5f5',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 26,
  },
  waitingSubtitle: {
    color: '#555',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  withdrawBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  withdrawBtnText: {
    color: '#333',
    fontSize: 14,
  },

  // Task selection (inline view)
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
});
