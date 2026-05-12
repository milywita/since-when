import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { EmptyState } from '../components/layout/EmptyState';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { SectionTitle } from '../components/layout/SectionTitle';
import { Screen } from '../components/ui/Screen';
import { useTheme } from '../theme/ThemeContext';
import type { AppTheme } from '../theme/themes';
import { formatElapsed } from '../utils/formatElapsed';
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

// ─── Task selection ───────────────────────────────────────────────────────────

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
  const thm = useTheme();
  const s = useMemo(() => buildStyles(thm), [thm]);
  const { colors: c } = thm;

  return (
    <Screen safeArea edges={['top', 'bottom']}>
      <ScreenHeader
        leading={
          <TouchableOpacity style={s.backBtn} onPress={onBack}>
            <Text style={[s.backBtnText, { color: c.textSoft }]}>← Back</Text>
          </TouchableOpacity>
        }
        title="Together"
        badge={{ text: subtitle, variant: 'accent' }}
      />

      <View style={s.selectionContainer}>
        <SectionTitle
          title="Bring tasks into the session"
          subtitle="Pick up to 6 tasks from your Solo list. Anything you don't complete stays in Solo."
          titleStyle={s.selectionSectionTitle}
          subtitleStyle={s.selectionSectionSubtitle}
        />

        {tasksLoading && (
          <ActivityIndicator color={c.text} style={s.selectionLoader} />
        )}

        {!tasksLoading && activeTasks.length === 0 && (
          <EmptyState
            title="No active Solo tasks yet."
            subtitle="You can still add tasks once the session starts."
            style={s.selectionEmpty}
          />
        )}

        {!tasksLoading && activeTasks.length > 0 && (
          <FlatList
            data={activeTasks}
            keyExtractor={t => t.id}
            style={s.selectionList}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const checked = selectedIds.has(item.id);
              const elapsed = now - item.createdAt;
              const atLimit = selectedIds.size >= 6 && !checked;
              return (
                <TouchableOpacity
                  style={[
                    s.selectionRow,
                    checked && s.selectionRowChecked,
                    atLimit && s.selectionRowDisabled,
                  ]}
                  onPress={() => !atLimit && onToggle(item.id)}
                  activeOpacity={atLimit ? 1 : 0.7}>
                  <View style={[s.checkbox, checked && s.checkboxChecked]}>
                    {checked && <Text style={s.checkmark}>✓</Text>}
                  </View>
                  <View style={s.selectionTaskInfo}>
                    <Text
                      style={[s.selectionTaskTitle, atLimit && s.selectionTaskTitleDim]}
                      numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={s.selectionTaskTimer}>{formatElapsed(elapsed)}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}

        <TouchableOpacity
          style={[s.actionBtn, confirming && s.actionBtnDisabled]}
          onPress={onConfirm}
          disabled={confirming}>
          {confirming
            ? <ActivityIndicator color={c.primaryText} />
            : (
              <Text style={s.actionBtnText}>
                {selectedIds.size > 0
                  ? `Start with ${selectedIds.size} task${selectedIds.size !== 1 ? 's' : ''}`
                  : 'Start without tasks'}
              </Text>
            )}
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

// ─── Partner history row ──────────────────────────────────────────────────────

type PartnerRowProps = {
  partner: SessionPartner;
  onJoin: () => void;
  joining: boolean;
};

function PartnerRow({ partner, onJoin, joining }: PartnerRowProps) {
  const thm = useTheme();
  const s = useMemo(() => buildStyles(thm), [thm]);
  const { colors: c } = thm;
  const elapsed = Date.now() - partner.lastSessionAt;
  const label = elapsed < 60000
    ? 'just now'
    : elapsed < 3600000
      ? `${Math.floor(elapsed / 60000)}m ago`
      : elapsed < 86400000
        ? `${Math.floor(elapsed / 3600000)}h ago`
        : `${Math.floor(elapsed / 86400000)}d ago`;

  return (
    <View style={s.partnerRow}>
      <View style={s.partnerInfo}>
        <Text style={[s.partnerName, { color: c.text }]}>{partner.username}</Text>
        <Text style={[s.partnerMeta, { color: c.textDim }]}>Last session {label}</Text>
      </View>
      <TouchableOpacity
        style={[s.joinPartnerBtn, joining && s.joinPartnerBtnDisabled]}
        onPress={onJoin}
        disabled={joining}>
        {joining
          ? <ActivityIndicator color={c.accent} size="small" />
          : <Text style={[s.joinPartnerBtnText, { color: c.accent }]}>Join</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function TogetherLobbyScreen({ navigation }: Props) {
  const thm = useTheme();
  const s = useMemo(() => buildStyles(thm), [thm]);
  const { colors: c } = thm;
  const user = auth().currentUser!;

  const { activeTasks, loading: tasksLoading } = useTasks();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [mode, setMode] = useState<Mode>('pick');
  const [pending, setPending] = useState<Pending | null>(null);
  const [selectedDurationMs, setSelectedDurationMs] = useState(SESSION_DURATION_PRESETS[0].ms);
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [joiningPartnerId, setJoiningPartnerId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
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

  async function handleJoinPartner(partner: SessionPartner) {
    setJoiningPartnerId(partner.userId);
    try {
      const partnerProfile = await import('../services/userService').then(m => m.getUserProfile(partner.userId));
      if (!partnerProfile?.activeSessionId) {
        Alert.alert('No active session', `${partner.username} isn't in a session right now.`);
        return;
      }
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

  async function handleConfirmTasks() {
    if (!pending) { return; }
    const tasks = buildSessionTasks();
    setConfirming(true);
    try {
      if (pending.kind === 'create') {
        for (const task of tasks) {
          await addTaskToSession(pending.sessionId, user.uid, task);
        }
        navigation.replace('Session', { sessionId: pending.sessionId });
      } else {
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
      <Screen safeArea edges={['top', 'bottom']}>
        <ScreenHeader
          title="Together"
          badge={{ text: 'WAITING', variant: 'accent' }}
        />
        <View style={s.waitingContainer}>
          <View style={s.waitingCard}>
            <Animated.View style={[s.waitingDot, { opacity: dotOpacity }]} />
            <Text style={[s.waitingTitle, { color: c.text }]}>
              Waiting for {pending.hostUsername} to let you in…
            </Text>
            <Text style={[s.waitingSubtitle, { color: c.textSoft }]}>
              They'll see a notification asking to approve your request.
            </Text>
          </View>
          <TouchableOpacity style={s.withdrawBtn} onPress={handleWithdrawRequest}>
            <Text style={[s.withdrawBtnText, { color: c.textFaint }]}>Cancel request</Text>
          </TouchableOpacity>
        </View>
      </Screen>
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
    <Screen safeArea edges={['top', 'bottom']}>
      <ScreenHeader
        leading={
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Text style={[s.backBtnText, { color: c.textSoft }]}>← Back</Text>
          </TouchableOpacity>
        }
        title="Together"
        badge={{ text: 'TOGETHER', variant: 'accent' }}
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* ── Host a session ── */}
        <View style={s.section}>
          <SectionTitle
            title="Start a session"
            subtitle="Pick a duration. Your session starts immediately."
          />
          {(() => {
            const isCustom = !SESSION_DURATION_PRESETS.some(p => p.ms === selectedDurationMs);
            return (
              <View style={s.presetRow}>
                {SESSION_DURATION_PRESETS.map(p => (
                  <TouchableOpacity
                    key={p.ms}
                    style={[
                      s.presetChip,
                      selectedDurationMs === p.ms && s.presetChipSelected,
                    ]}
                    onPress={() => setSelectedDurationMs(p.ms)}>
                    <Text style={[
                      s.presetChipText,
                      selectedDurationMs === p.ms && s.presetChipTextSelected,
                    ]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[s.presetChip, isCustom && s.presetChipSelected]}
                  onPress={() => setCustomModalVisible(true)}>
                  <Text style={[s.presetChipText, isCustom && s.presetChipTextSelected]}>
                    {isCustom ? `${Math.round(selectedDurationMs / 60000)}m` : 'Custom'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })()}
          <TouchableOpacity
            style={[s.actionBtn, loading && s.actionBtnDisabled]}
            onPress={handleHost}
            disabled={loading}>
            {loading
              ? <ActivityIndicator color={c.primaryText} />
              : <Text style={s.actionBtnText}>Start session</Text>}
          </TouchableOpacity>
        </View>

        {/* ── Custom duration modal ── */}
        <Modal
          visible={customModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setCustomModalVisible(false)}>
          <KeyboardAvoidingView
            style={s.customModalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <TouchableOpacity
              style={s.customModalBackdrop}
              activeOpacity={1}
              onPress={() => setCustomModalVisible(false)}
            />
            <View style={s.customModalSheet}>
              <View style={s.customModalHandle} />
              <Text style={[s.customModalTitle, { color: c.text }]}>Custom duration</Text>
              <Text style={[s.customModalSubtitle, { color: c.textSoft }]}>How many minutes?</Text>
              <TextInput
                style={s.customModalInput}
                placeholder="e.g. 45"
                placeholderTextColor={c.textSoft}
                value={customInput}
                onChangeText={v => setCustomInput(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                autoFocus
                maxLength={4}
              />
              <TouchableOpacity
                style={[
                  s.actionBtn,
                  (!customInput || parseInt(customInput, 10) < 1) && s.actionBtnDisabled,
                ]}
                disabled={!customInput || parseInt(customInput, 10) < 1}
                onPress={() => {
                  const mins = parseInt(customInput, 10);
                  if (mins >= 1) {
                    setSelectedDurationMs(mins * 60 * 1000);
                    setCustomModalVisible(false);
                    setCustomInput('');
                  }
                }}>
                <Text style={s.actionBtnText}>Set duration</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <View style={s.divider}>
          <View style={s.dividerLine} />
          <Text style={[s.dividerText, { color: c.textFaint }]}>or join</Text>
          <View style={s.dividerLine} />
        </View>

        {/* ── Join by code ── */}
        <View style={s.section}>
          <SectionTitle
            title="Enter a code"
            subtitle="Type your partner's 6-character invite code."
          />
          <TextInput
            style={s.codeInput}
            placeholder="e.g. ABC123"
            placeholderTextColor={c.textDim}
            value={joinCode}
            onChangeText={v => setJoinCode(v.toUpperCase())}
            autoCapitalize="characters"
            maxLength={6}
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[
              s.actionBtn,
              s.actionBtnSecondary,
              (loading || joinCode.trim().length < 6) && s.actionBtnDisabled,
            ]}
            onPress={handleJoinFind}
            disabled={loading || joinCode.trim().length < 6}>
            <Text style={[s.actionBtnText, s.actionBtnTextSecondary]}>
              Find session
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Partner history ── */}
        {partners.length > 0 && (
          <>
            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Text style={[s.dividerText, { color: c.textFaint }]}>or pick someone</Text>
              <View style={s.dividerLine} />
            </View>

            <View style={s.section}>
              <SectionTitle
                title="Recent partners"
                subtitle="Tap to jump straight into their active session."
              />
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
    </Screen>
  );
}

// ─── Style factory ────────────────────────────────────────────────────────────

function buildStyles(thm: AppTheme) {
  const { colors: c, spacing: sp, radius: r } = thm;
  return StyleSheet.create({
    backBtn: { paddingVertical: sp.xs, marginTop: sp.xs },
    backBtnText: { fontSize: 14 },

    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: sp.gutter, paddingBottom: 40, gap: 0 },

    section: { gap: sp.md, marginBottom: sp.sm },
    presetRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: sp.sm,
      marginTop: sp.xs,
      marginBottom: sp.xs,
    },
    presetChip: {
      flexGrow: 1,
      flexBasis: '22%',
      minWidth: 72,
      borderRadius: sp.sm,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: sp.sm,
      paddingHorizontal: sp.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    presetChipSelected: { backgroundColor: c.accent, borderColor: c.accent },
    presetChipText: { color: c.textMuted, fontSize: 14, fontWeight: '500', textAlign: 'center' },
    presetChipTextSelected: { color: c.onAccent },

    customModalOverlay: { flex: 1, justifyContent: 'flex-end' },
    customModalBackdrop: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: c.backdrop,
    },
    customModalSheet: {
      backgroundColor: c.surfaceRaised,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 24,
      paddingBottom: Platform.OS === 'ios' ? 40 : 28,
      paddingTop: 16,
      borderWidth: 1,
      borderColor: c.border,
      gap: 12,
    },
    customModalHandle: {
      width: 36, height: 4, backgroundColor: c.borderStrong,
      borderRadius: 2, alignSelf: 'center', marginBottom: 8,
    },
    customModalTitle: { fontSize: 18, fontWeight: '600' },
    customModalSubtitle: { fontSize: 14, marginTop: -4 },
    customModalInput: {
      backgroundColor: c.surface,
      color: c.text,
      borderRadius: r.sm,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 28,
      fontWeight: '600',
      borderWidth: 1,
      borderColor: c.border,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },

    actionBtn: {
      backgroundColor: c.primary,
      borderRadius: r.sm,
      paddingVertical: 15,
      alignItems: 'center',
      marginTop: sp.xs,
    },
    actionBtnSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.border },
    actionBtnDisabled: { opacity: 0.35 },
    actionBtnText: { color: c.primaryText, fontSize: 15, fontWeight: '600' },
    actionBtnTextSecondary: { color: c.text },

    divider: { flexDirection: 'row', alignItems: 'center', marginVertical: sp.xl, gap: sp.md },
    dividerLine: { flex: 1, height: 1, backgroundColor: c.surface },
    dividerText: { fontSize: 13 },

    codeInput: {
      backgroundColor: c.surface,
      color: c.text,
      borderRadius: r.sm,
      paddingHorizontal: sp.lg,
      paddingVertical: Platform.OS === 'ios' ? 14 : sp.md,
      fontSize: 20,
      fontWeight: '700',
      letterSpacing: 6,
      borderWidth: 1,
      borderColor: c.border,
      textAlign: 'center',
    },

    // Partner history
    partnerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      gap: sp.md,
    },
    partnerInfo: { flex: 1, gap: 3 },
    partnerName: { fontSize: 15, fontWeight: '600' },
    partnerMeta: { fontSize: 12 },
    joinPartnerBtn: {
      borderRadius: sp.sm,
      borderWidth: 1,
      borderColor: c.accent,
      paddingVertical: 7,
      paddingHorizontal: sp.lg,
      minWidth: 60,
      alignItems: 'center',
    },
    joinPartnerBtnDisabled: { opacity: 0.5 },
    joinPartnerBtnText: { fontSize: 13, fontWeight: '600' },

    // Waiting
    waitingContainer: { flex: 1, paddingHorizontal: sp.gutter, paddingTop: 40, gap: 20 },
    waitingCard: {
      backgroundColor: c.accentSurface,
      borderRadius: r.lg,
      borderWidth: 1,
      borderColor: c.accentSurfaceBorder,
      padding: 28,
      alignItems: 'center',
      gap: 14,
    },
    waitingDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: c.accent },
    waitingTitle: { fontSize: 18, fontWeight: '600', textAlign: 'center', lineHeight: 26 },
    waitingSubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
    withdrawBtn: { alignItems: 'center', paddingVertical: 14 },
    withdrawBtnText: { fontSize: 14 },

    // Task selection
    selectionContainer: { flex: 1, paddingHorizontal: sp.gutter, paddingTop: sp.xs },
    selectionSectionTitle: { fontSize: 20, fontWeight: '600' },
    selectionSectionSubtitle: { marginBottom: 20 },
    selectionLoader: { marginTop: 40 },
    selectionEmpty: { flex: 1, marginBottom: 60 },
    selectionList: { flex: 1, marginBottom: sp.lg },
    selectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      marginBottom: sp.sm,
      gap: sp.md,
    },
    selectionRowChecked: { borderColor: c.accent, backgroundColor: c.accentSurface },
    selectionRowDisabled: { opacity: 0.4 },
    checkbox: {
      width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
      borderColor: c.borderStrong, justifyContent: 'center', alignItems: 'center', flexShrink: 0,
    },
    checkboxChecked: { backgroundColor: c.accent, borderColor: c.accent },
    checkmark: { color: c.onAccent, fontSize: 13, fontWeight: '700', lineHeight: 15 },
    selectionTaskInfo: { flex: 1, gap: 3 },
    selectionTaskTitle: { color: c.text, fontSize: 15, fontWeight: '500' },
    selectionTaskTitleDim: { color: c.textDim },
    selectionTaskTimer: { color: c.textSoft, fontSize: 12, fontVariant: ['tabular-nums'] },
  });
}
