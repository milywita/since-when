import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { Screen } from '../components/ui/Screen';
import { theme } from '../theme/themes';
import { EmptyState } from '../components/layout/EmptyState';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { TaskCard } from '../components/tasks/TaskCard';
import { useTasks } from '../hooks/useTasks';
import { useSessionHistory } from '../hooks/useSessionHistory';
import { SwipeableRow } from '../components/SwipeableRow';
import type { Task } from '../types/Task';
import type { SessionHistoryRecord } from '../types/Session';
import type { AppScreenProps } from '../navigation/types';
import { formatElapsed } from '../utils/formatElapsed';
import { subscribeToUserProfile, setActiveSession } from '../services/userService';
import { getSessionOnce } from '../services/sessionService';

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// ─── Time preset helpers ──────────────────────────────────────────────────────

const TIME_PRESETS: { label: string; ms: number }[] = [
  { label: '15m',  ms: 15 * 60 * 1000 },
  { label: '30m',  ms: 30 * 60 * 1000 },
  { label: '1h',   ms: 60 * 60 * 1000 },
  { label: '2h',   ms: 2 * 60 * 60 * 1000 },
  { label: '4h',   ms: 4 * 60 * 60 * 1000 },
  { label: '1 day', ms: 24 * 60 * 60 * 1000 },
];

// ─── Completed task row ───────────────────────────────────────────────────────

type CompletedRowProps = { task: Task };

function CompletedRow({ task }: CompletedRowProps) {
  const completedAt = task.completedAt ?? 0;
  const duration = completedAt - task.createdAt;
  const beatEstimate = task.estimatedMs !== null && duration <= task.estimatedMs;
  return (
    <View style={styles.completedRow}>
      <View style={styles.completedLeft}>
        <View style={styles.soloModeBadge}>
          <Text style={styles.soloModeBadgeText}>SOLO</Text>
        </View>
        <Text style={styles.completedTitle} numberOfLines={1}>{task.title}</Text>
      </View>
      <View style={styles.completedRight}>
        <Text style={styles.completedTime}>{formatTime(completedAt)}</Text>
        <Text style={styles.completedDuration}>{formatElapsed(duration)}</Text>
        {task.estimatedMs !== null && (
          <Text style={[styles.completedEstLabel, beatEstimate && styles.completedEstLabelBeat]}>
            {beatEstimate ? 'on time' : 'late'}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Together session history card ───────────────────────────────────────────

function formatTime(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m} ${ampm}`;
}

type TogetherHistoryCardProps = { record: SessionHistoryRecord };

function TogetherHistoryCard({ record }: TogetherHistoryCardProps) {
  const [expanded, setExpanded] = useState(false);

  const myCompleted = record.myTasks.filter(t => t.completedAt !== null);
  const myIncomplete = record.myTasks.filter(t => t.completedAt === null);
  const partnerNames = record.partners.map(p => p.displayName).join(', ');
  const sessionDurationMs = record.endedAt - record.startedAt;

  function formatSessionDuration(ms: number): string {
    const mins = Math.floor(ms / 60000);
    if (mins < 60) { return `${mins}m`; }
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  return (
    <TouchableOpacity
      style={styles.togetherCard}
      onPress={() => setExpanded(e => !e)}
      activeOpacity={0.85}>
      {/* Header row */}
      <View style={styles.togetherCardHeader}>
        <View style={styles.togetherCardLeft}>
          <View style={styles.togetherCardBadge}>
            <Text style={styles.togetherCardBadgeText}>TOGETHER</Text>
          </View>
          <Text style={styles.togetherCardPartner} numberOfLines={1}>
            with {partnerNames || 'no partner'}
          </Text>
        </View>
        <View style={styles.togetherCardRight}>
          <Text style={styles.togetherCardTime}>{formatTime(record.startedAt)}</Text>
          <Text style={styles.togetherCardDuration}>{formatSessionDuration(sessionDurationMs)}</Text>
        </View>
      </View>

      {/* Summary line */}
      <Text style={styles.togetherCardSummary}>
        {myCompleted.length > 0
          ? `${myCompleted.length} of ${record.myTasks.length} task${record.myTasks.length !== 1 ? 's' : ''} completed`
          : record.myTasks.length > 0
            ? `${record.myTasks.length} task${record.myTasks.length !== 1 ? 's' : ''} — none completed`
            : 'No tasks'}
        {myIncomplete.length > 0 ? ` · ${myIncomplete.length} back in Solo` : ''}
      </Text>

      {expanded && (
        <View style={styles.togetherCardBody}>
          {/* Your tasks */}
          {record.myTasks.length > 0 && (
            <View style={styles.togetherSection}>
              <Text style={styles.togetherSectionLabel}>Your tasks</Text>
              {record.myTasks.map(task => {
                const isDone = task.completedAt !== null;
                const duration = isDone
                  ? (task.completedAt! - task.createdAt)
                  : null;
                const reactionsForTask = record.reactionsReceived.filter(
                  r => r.taskId === task.taskId,
                );
                return (
                  <View key={task.taskId} style={styles.togetherTaskRow}>
                    <Text style={[
                      styles.togetherTaskMark,
                      isDone ? styles.togetherTaskMarkDone : styles.togetherTaskMarkPending,
                    ]}>
                      {isDone ? '✓' : '○'}
                    </Text>
                    <View style={styles.togetherTaskInfo}>
                      <Text style={[
                        styles.togetherTaskTitle,
                        !isDone && styles.togetherTaskTitlePending,
                      ]} numberOfLines={2}>
                        {task.title}
                      </Text>
                      {isDone && duration !== null && (
                        <Text style={styles.togetherTaskDuration}>
                          {formatElapsed(duration)}
                        </Text>
                      )}
                      {!isDone && (
                        <Text style={styles.togetherTaskSolo}>moved to Solo</Text>
                      )}
                      {reactionsForTask.length > 0 && (
                        <View style={styles.togetherReactionList}>
                          {reactionsForTask.map(r => (
                            <Text key={r.id} style={styles.togetherReactionBubble}>
                              "{r.text}"
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Partner tasks */}
          {record.partners.map(partner => (
            <View key={partner.userId} style={styles.togetherSection}>
              <Text style={styles.togetherSectionLabel}>{partner.displayName}'s tasks</Text>
              {partner.tasks.length === 0 && (
                <Text style={styles.togetherEmptyPartner}>No tasks added.</Text>
              )}
              {partner.tasks.map(task => {
                const isDone = task.completedAt !== null;
                const duration = isDone ? (task.completedAt! - task.createdAt) : null;
                return (
                  <View key={task.taskId} style={styles.togetherTaskRow}>
                    <Text style={[
                      styles.togetherTaskMark,
                      isDone ? styles.togetherTaskMarkDone : styles.togetherTaskMarkPending,
                    ]}>
                      {isDone ? '✓' : '○'}
                    </Text>
                    <View style={styles.togetherTaskInfo}>
                      <Text style={[
                        styles.togetherTaskTitle,
                        !isDone && styles.togetherTaskTitlePending,
                      ]} numberOfLines={2}>
                        {task.title}
                      </Text>
                      {isDone && duration !== null && (
                        <Text style={styles.togetherTaskDuration}>
                          {formatElapsed(duration)}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      )}

      <Text style={styles.togetherCardChevron}>{expanded ? '▲' : '▼'}</Text>
    </TouchableOpacity>
  );
}

// ─── History grouping helpers ─────────────────────────────────────────────────

type HistoryDayItem =
  | { kind: 'soloTask'; task: Task }
  | { kind: 'togetherSession'; record: SessionHistoryRecord };

type HistoryDaySection = {
  dateKey: string;
  dateLabel: string;
  data: HistoryDayItem[];
};

function getDayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) { return 'Today'; }
  if (sameDay(d, yesterday)) { return 'Yesterday'; }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildHistorySections(
  completedTasks: Task[],
  sessionHistory: SessionHistoryRecord[],
): HistoryDaySection[] {
  const buckets = new Map<string, { label: string; ts: number; items: HistoryDayItem[] }>();

  // Always seed today so it's always the first entry, even when empty.
  const todayKey = getDayKey(Date.now());
  buckets.set(todayKey, { label: 'Today', ts: Date.now(), items: [] });

  const ensureBucket = (ts: number) => {
    const key = getDayKey(ts);
    if (!buckets.has(key)) {
      buckets.set(key, { label: getDayLabel(ts), ts, items: [] });
    }
    return buckets.get(key)!;
  };

  for (const task of completedTasks) {
    if (task.sessionId || task.completedInSessionId) { continue; }
    const ts = task.completedAt ?? task.createdAt;
    ensureBucket(ts).items.push({ kind: 'soloTask', task });
  }

  for (const record of sessionHistory) {
    ensureBucket(record.endedAt).items.push({ kind: 'togetherSession', record });
  }

  return Array.from(buckets.entries())
    .sort(([, a], [, b]) => b.ts - a.ts)
    .map(([key, bucket]) => ({
      dateKey: key,
      dateLabel: bucket.label,
      data: bucket.items.sort((a, b) => {
        const tsA = a.kind === 'soloTask'
          ? (a.task.completedAt ?? a.task.createdAt)
          : a.record.endedAt;
        const tsB = b.kind === 'soloTask'
          ? (b.task.completedAt ?? b.task.createdAt)
          : b.record.endedAt;
        return tsB - tsA;
      }),
    }));
}

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
          <Text style={styles.modalTitle}>What have you been avoiding?</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="e.g. Reply to that email"
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

          <Text style={styles.estimateLabel}>How long will it actually take?</Text>
          <View style={styles.presetRow}>
            {TIME_PRESETS.map(p => (
              <TouchableOpacity
                key={p.ms}
                style={[styles.presetChip, selectedMs === p.ms && styles.presetChipSelected]}
                onPress={() => setSelectedMs(prev => prev === p.ms ? null : p.ms)}>
                <Text style={[styles.presetChipText, selectedMs === p.ms && styles.presetChipTextSelected]}>
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
              : <Text style={styles.modalAddBtnText}>Start the clock</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Edit task modal ──────────────────────────────────────────────────────────

type EditTaskModalProps = {
  task: Task | null;
  onClose: () => void;
  onSave: (taskId: string, title: string, estimatedMs: number | null) => Promise<void>;
};

function EditTaskModal({ task, onClose, onSave }: EditTaskModalProps) {
  const [text, setText] = useState('');
  const [selectedMs, setSelectedMs] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setText(task.title);
      setSelectedMs(task.estimatedMs);
    }
  }, [task]);

  async function handleSave() {
    const trimmed = text.trim();
    if (!trimmed || !task) { return; }
    setSaving(true);
    try {
      await onSave(task.id, trimmed, selectedMs);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    onClose();
  }

  return (
    <Modal visible={task !== null} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={handleClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Edit task</Text>
          <TextInput
            style={styles.modalInput}
            placeholderTextColor="#555"
            value={text}
            onChangeText={setText}
            autoFocus
            multiline
            maxLength={120}
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={handleSave}
          />

          <Text style={styles.estimateLabel}>How long will it actually take?</Text>
          <View style={styles.presetRow}>
            {TIME_PRESETS.map(p => (
              <TouchableOpacity
                key={p.ms}
                style={[styles.presetChip, selectedMs === p.ms && styles.presetChipSelected]}
                onPress={() => setSelectedMs(prev => prev === p.ms ? null : p.ms)}>
                <Text style={[styles.presetChipText, selectedMs === p.ms && styles.presetChipTextSelected]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.modalAddBtn, !text.trim() && styles.modalAddBtnDisabled]}
            onPress={handleSave}
            disabled={!text.trim() || saving}>
            {saving
              ? <ActivityIndicator color="#0d0d0d" />
              : <Text style={styles.modalAddBtnText}>Save changes</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Flash banner (confetti substitute) ──────────────────────────────────────

function useDoneFlash() {
  const opacity = useRef(new Animated.Value(0)).current;
  const [message, setMessage] = useState('');

  const flash = useCallback((msg: string) => {
    setMessage(msg);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [opacity]);

  return { opacity, message, flash };
}

// ─── Main screen ──────────────────────────────────────────────────────────────

type ActiveTab = 'active' | 'history';

type Props = AppScreenProps<'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { activeTasks, completedTasks, loading, error, addTask, completeTask, deleteTask, updateTask } = useTasks();
  const { sessionHistory, loading: historyLoading } = useSessionHistory();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [tab, setTab] = useState<ActiveTab>('active');
  const now = useNow();
  const { opacity: flashOpacity, message: flashMessage, flash } = useDoneFlash();

  const [rejoinSessionId, setRejoinSessionId] = useState<string | null>(null);

  useEffect(() => {
    const uid = auth().currentUser?.uid;
    if (!uid) { return; }
    const unsub = subscribeToUserProfile(uid, async profile => {
      const sid = profile.activeSessionId;
      if (!sid) {
        setRejoinSessionId(null);
        return;
      }
      try {
        const session = await getSessionOnce(sid);
        if (session?.status === 'active') {
          setRejoinSessionId(sid);
        } else {
          setRejoinSessionId(null);
          await setActiveSession(uid, null);
        }
      } catch {
        setRejoinSessionId(null);
      }
    });
    return unsub;
  }, []);

  const historySections = useMemo(
    () => buildHistorySections(completedTasks, sessionHistory),
    [completedTasks, sessionHistory],
  );

  const [historyDayIndex, setHistoryDayIndex] = useState(0);

  // Reset to the most recent day whenever the sections change or the tab is opened
  const prevTabRef = useRef(tab);
  useEffect(() => {
    if (tab === 'history' && prevTabRef.current !== 'history') {
      setHistoryDayIndex(0);
    }
    prevTabRef.current = tab;
  }, [tab]);

  useEffect(() => {
    setHistoryDayIndex(0);
  }, [historySections.length]);

  async function handleComplete(task: Task) {
    await completeTask(task.id);
    const duration = Date.now() - task.createdAt;
    flash(`You did it. It took ${formatElapsed(duration)} but you did it.`);
  }

  async function handleDelete(task: Task) {
    await deleteTask(task.id);
  }

  async function handleEdit(taskId: string, title: string, estimatedMs: number | null) {
    await updateTask(taskId, { title, estimatedMs });
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

  if (error) {
    return (
      <Screen>
        <View style={styles.loadingRoot}>
          <Text style={styles.errorText}>Firestore error:</Text>
          <Text style={styles.errorDetail}>{error}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen safeArea edges={['top']}>
      {/* ── Flash banner ─────────────────────────────── */}
      <Animated.View style={[styles.flashBanner, { opacity: flashOpacity }]} pointerEvents="none">
        <Text style={styles.flashText}>{flashMessage}</Text>
      </Animated.View>

      {/* ── Header ───────────────────────────────────── */}
      <ScreenHeader
        title="Since When"
        badge={{ text: 'SOLO', variant: 'muted' }}
        trailing={
          <TouchableOpacity style={styles.signOutBtn} onPress={() => auth().signOut()}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        }
      />

      {/* ── Rejoin active session banner ─────────────── */}
      {rejoinSessionId !== null && (
        <TouchableOpacity
          style={styles.rejoinBanner}
          onPress={() => navigation.navigate('Session', { sessionId: rejoinSessionId! })}
          activeOpacity={0.75}>
          <View style={styles.rejoinBannerLeft}>
            <View style={styles.rejoinDot} />
            <View>
              <Text style={styles.rejoinBannerLabel}>ACTIVE SESSION</Text>
              <Text style={styles.rejoinBannerText}>Tap to rejoin your Together session</Text>
            </View>
          </View>
          <Text style={styles.rejoinBannerArrow}>›</Text>
        </TouchableOpacity>
      )}

      {/* ── Together banner ──────────────────────────── */}
      <TouchableOpacity
        style={styles.togetherBanner}
        onPress={() => navigation.navigate('TogetherLobby')}
        activeOpacity={0.75}>
        <View style={styles.togetherBannerLeft}>
          <Text style={styles.togetherBannerLabel}>TOGETHER</Text>
          <Text style={styles.togetherBannerText}>Work with someone</Text>
        </View>
        <Text style={styles.togetherBannerArrow}>›</Text>
      </TouchableOpacity>

      {/* ── Tabs ─────────────────────────────────────── */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'active' && styles.tabActive]}
          onPress={() => setTab('active')}>
          <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>
            Active{activeTasks.length > 0 ? ` (${activeTasks.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'history' && styles.tabActive]}
          onPress={() => setTab('history')}>
          <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>
            History
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Active tasks ─────────────────────────────── */}
      {tab === 'active' && (
        <>
          {activeTasks.length === 0 ? (
            <EmptyState
              title="Nothing to avoid."
              subtitle="Add a task and let the guilt begin."
            />
          ) : (
            <FlatList
              data={activeTasks}
              keyExtractor={t => t.id}
              renderItem={({ item }) => (
                <SwipeableRow
                  onDelete={() => handleDelete(item)}
                  borderRadius={12}>
                  <TaskCard
                    task={item}
                    now={now}
                    onComplete={() => handleComplete(item)}
                    onDelete={() => handleDelete(item)}
                    onEdit={() => setEditingTask(item)}
                  />
                </SwipeableRow>
              )}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      )}

      {/* ── History tab ──────────────────────────────── */}
      {tab === 'history' && (
        <>
          {(loading || historyLoading) ? (
            <View style={styles.historyLoading}>
              <ActivityIndicator color={theme.colors.textMuted} />
            </View>
          ) : (() => {
            const currentSection = historySections[historyDayIndex];
            const canGoOlder = historyDayIndex < historySections.length - 1;
            const canGoNewer = historyDayIndex > 0;

            return (
              <>
                <View style={styles.dayNav}>
                  <TouchableOpacity
                    onPress={() => setHistoryDayIndex(i => i + 1)}
                    disabled={!canGoOlder}
                    hitSlop={12}
                    style={styles.dayNavArrow}>
                    <Text style={[styles.dayNavArrowText, !canGoOlder && styles.dayNavArrowDisabled]}>
                      ‹
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.dayNavLabel}>{currentSection.dateLabel}</Text>
                  <TouchableOpacity
                    onPress={() => setHistoryDayIndex(i => i - 1)}
                    disabled={!canGoNewer}
                    hitSlop={12}
                    style={styles.dayNavArrow}>
                    <Text style={[styles.dayNavArrowText, !canGoNewer && styles.dayNavArrowDisabled]}>
                      ›
                    </Text>
                  </TouchableOpacity>
                </View>

                <ScrollView
                  contentContainerStyle={styles.historyDayContent}
                  showsVerticalScrollIndicator={false}>

                  {currentSection.data.length === 0 && (
                    <View style={styles.dayEmptyState}>
                      <Text style={styles.dayEmptyTitle}>Nothing done today.</Text>
                      <Text style={styles.dayEmptySubtitle}>
                        The tasks won't do themselves.{'\n'}Allegedly.
                      </Text>
                    </View>
                  )}

                  {currentSection.data.map(item =>
                    item.kind === 'togetherSession' ? (
                      <TogetherHistoryCard key={item.record.sessionId} record={item.record} />
                    ) : (
                      <CompletedRow key={item.task.id} task={item.task} />
                    ),
                  )}

                  <View style={styles.historyBottomPad} />
                </ScrollView>
              </>
            );
          })()}
        </>
      )}

      {/* ── FAB ──────────────────────────────────────── */}
      {tab === 'active' && (
        <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      <AddTaskModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onAdd={(title, estimatedMs) => addTask(title, estimatedMs)}
      />

      <EditTaskModal
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleEdit}
      />
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
  },
  errorText: {
    color: c.danger,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: sp.sm,
    textAlign: 'center',
  },
  errorDetail: {
    color: c.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Flash banner
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

  signOutBtn: {
    paddingVertical: 6,
    paddingHorizontal: sp.md,
    marginTop: sp.xs,
  },
  signOutText: {
    color: c.textSoft,
    fontSize: 13,
  },

  // Rejoin active session banner
  rejoinBanner: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: '#0d1f0d',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e4d1e',
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rejoinBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rejoinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ade80',
  },
  rejoinBannerLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4ade80',
    letterSpacing: 2,
    marginBottom: 2,
  },
  rejoinBannerText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#a7f3c0',
  },
  rejoinBannerArrow: {
    fontSize: 20,
    color: '#4ade80',
    fontWeight: '300',
  },

  // Together banner
  togetherBanner: {
    marginHorizontal: sp.gutter,
    marginBottom: sp.md,
    backgroundColor: c.accentSurface,
    borderRadius: r.sm,
    borderWidth: 1,
    borderColor: c.accentSurfaceBorder,
    paddingVertical: sp.md,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  togetherBannerLeft: {
    gap: 2,
  },
  togetherBannerLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: c.accent,
    letterSpacing: 2,
  },
  togetherBannerText: {
    fontSize: 14,
    fontWeight: '500',
    color: c.accentMuted,
  },
  togetherBannerArrow: {
    fontSize: 20,
    color: c.accent,
    fontWeight: '300',
  },

  // Tabs
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: sp.gutter,
    marginBottom: sp.sm,
    gap: sp.xs,
  },
  tab: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: sp.sm,
  },
  tabActive: {
    backgroundColor: c.surface,
  },
  tabText: {
    color: c.textSoft,
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: c.text,
  },

  // List
  list: {
    paddingHorizontal: sp.gutter,
    paddingBottom: 100,
    gap: sp.md,
  },

  historyLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },

  // Completed row
  completedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.surface,
  },
  completedLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    gap: 8,
  },
  soloModeBadge: {
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  soloModeBadgeText: {
    color: '#444',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  completedTitle: {
    color: c.textSoft,
    fontSize: 15,
    flex: 1,
    marginRight: sp.md,
    textDecorationLine: 'line-through',
  },
  completedRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  completedTime: {
    color: '#555',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  completedDuration: {
    color: c.textDim,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  completedEstLabel: {
    fontSize: 10,
    color: c.dangerMuted,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  completedEstLabelBeat: {
    color: c.success,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 36,
    right: sp.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: c.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: sp.sm,
    elevation: sp.sm,
  },
  fabText: {
    color: c.primaryText,
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 32,
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
    backgroundColor: c.backdrop,
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
    height: 4,
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
  modalInput: {
    backgroundColor: c.surface,
    color: c.text,
    borderRadius: r.sm,
    paddingHorizontal: sp.lg,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: 14,
    minHeight: 52,
  },
  estimateLabel: {
    color: c.textSoft,
    fontSize: 13,
    marginBottom: 10,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sp.sm,
    marginBottom: sp.lg,
  },
  presetChip: {
    borderRadius: sp.sm,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  presetChipSelected: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  presetChipText: {
    color: c.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  presetChipTextSelected: {
    color: c.primaryText,
  },

  modalAddBtn: {
    backgroundColor: c.primary,
    borderRadius: r.sm,
    paddingVertical: 15,
    alignItems: 'center',
  },
  modalAddBtnDisabled: {
    opacity: 0.3,
  },
  modalAddBtnText: {
    color: c.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },

  // Day navigator (← Today →)
  dayNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  dayNavArrow: {
    width: 32,
    alignItems: 'center',
  },
  dayNavArrowText: {
    color: '#f5f5f5',
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 28,
  },
  dayNavArrowDisabled: {
    color: '#2a2a2a',
  },
  dayNavLabel: {
    color: '#f5f5f5',
    fontSize: 15,
    fontWeight: '600',
  },

  // Day content scroll area
  historyDayContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    gap: 0,
  },

  historyBottomPad: {
    height: 20,
  },

  // Empty state for a day with no activity
  dayEmptyState: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  dayEmptyTitle: {
    color: '#f5f5f5',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  dayEmptySubtitle: {
    color: '#555',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Together session history card
  togetherCard: {
    backgroundColor: '#0f0f22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    padding: 14,
    marginBottom: 10,
  },
  togetherCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  togetherCardLeft: {
    flex: 1,
    gap: 3,
    marginRight: 12,
  },
  togetherCardBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#1a1a3a',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  togetherCardBadgeText: {
    color: '#6366f1',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  togetherCardPartner: {
    color: '#c7c8ff',
    fontSize: 15,
    fontWeight: '600',
  },
  togetherCardRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  togetherCardTime: {
    color: '#555',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  togetherCardDuration: {
    color: '#444',
    fontSize: 11,
  },
  togetherCardSummary: {
    color: '#555',
    fontSize: 13,
    marginBottom: 4,
  },
  togetherCardChevron: {
    color: '#333',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 6,
  },
  togetherCardBody: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1a1a3a',
    paddingTop: 10,
    gap: 12,
  },

  // Sections inside the together card
  togetherSection: {
    gap: 6,
  },
  togetherSectionLabel: {
    color: '#6366f1',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  togetherEmptyPartner: {
    color: '#333',
    fontSize: 13,
    fontStyle: 'italic',
  },
  togetherTaskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  togetherTaskMark: {
    fontSize: 13,
    width: 16,
    marginTop: 2,
  },
  togetherTaskMarkDone: {
    color: '#2e6b3e',
  },
  togetherTaskMarkPending: {
    color: '#444',
  },
  togetherTaskInfo: {
    flex: 1,
    gap: 2,
  },
  togetherTaskTitle: {
    color: '#c7c8ff',
    fontSize: 14,
  },
  togetherTaskTitlePending: {
    color: '#444',
  },
  togetherTaskDuration: {
    color: '#555',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  togetherTaskSolo: {
    color: '#444',
    fontSize: 11,
    fontStyle: 'italic',
  },
  togetherReactionList: {
    gap: 3,
    marginTop: 2,
  },
  togetherReactionBubble: {
    color: '#8888cc',
    fontSize: 12,
    fontStyle: 'italic',
  },
});
