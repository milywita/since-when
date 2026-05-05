import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import { useTasks } from '../hooks/useTasks';
import type { Task } from '../types/Task';

// ─── Elapsed time helpers ────────────────────────────────────────────────────

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

// ─── Task card ────────────────────────────────────────────────────────────────

type TaskCardProps = {
  task: Task;
  now: number;
  onComplete: () => void;
  onDelete: () => void;
};

function TaskCard({ task, now, onComplete, onDelete }: TaskCardProps) {
  const elapsed = now - task.createdAt;
  const overEstimate = task.estimatedMs !== null && elapsed > task.estimatedMs;
  const isOld = elapsed > 86400 * 1000;

  function handleLongPress() {
    Alert.alert(
      task.title,
      'What would you like to do?',
      [
        { text: 'Mark complete', onPress: onComplete },
        { text: 'Delete task', style: 'destructive', onPress: onDelete },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }

  return (
    <TouchableOpacity
      style={[styles.card, overEstimate && styles.cardOverdue]}
      onLongPress={handleLongPress}
      activeOpacity={0.75}>
      <View style={styles.cardLeft}>
        <Text style={styles.cardTitle} numberOfLines={2}>{task.title}</Text>
        <View style={styles.cardMeta}>
          <Text style={[styles.cardTimer, (isOld || overEstimate) && styles.cardTimerOld]}>
            {formatElapsed(elapsed)}
          </Text>
          {task.estimatedMs !== null && (
            <Text style={[styles.cardEstimate, overEstimate && styles.cardEstimateOver]}>
              {overEstimate ? '— over by ' : '— est. '}
              {overEstimate
                ? formatElapsed(elapsed - task.estimatedMs)
                : formatElapsed(task.estimatedMs)}
            </Text>
          )}
        </View>
      </View>
      <TouchableOpacity style={styles.doneBtn} onPress={onComplete} hitSlop={12}>
        <Text style={styles.doneBtnText}>Done</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── Completed task row ───────────────────────────────────────────────────────

type CompletedRowProps = { task: Task };

function CompletedRow({ task }: CompletedRowProps) {
  const duration = (task.completedAt ?? 0) - task.createdAt;
  const beatEstimate = task.estimatedMs !== null && duration <= task.estimatedMs;
  return (
    <View style={styles.completedRow}>
      <Text style={styles.completedTitle} numberOfLines={1}>{task.title}</Text>
      <View style={styles.completedRight}>
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
              ? <ActivityIndicator color="#0d0d0d" />
              : <Text style={styles.modalAddBtnText}>Start the clock</Text>}
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

export default function HomeScreen() {
  const { activeTasks, completedTasks, loading, error, addTask, completeTask, deleteTask } = useTasks();
  const [modalVisible, setModalVisible] = useState(false);
  const [tab, setTab] = useState<ActiveTab>('active');
  const now = useNow();
  const { opacity: flashOpacity, message: flashMessage, flash } = useDoneFlash();

  async function handleComplete(task: Task) {
    await completeTask(task.id);
    const duration = Date.now() - task.createdAt;
    flash(`You did it. It took ${formatElapsed(duration)} but you did it.`);
  }

  async function handleDelete(task: Task) {
    await deleteTask(task.id);
  }

  if (loading) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color="#f5f5f5" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingRoot}>
        <Text style={styles.errorText}>Firestore error:</Text>
        <Text style={styles.errorDetail}>{error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* ── Flash banner ─────────────────────────────── */}
      <Animated.View style={[styles.flashBanner, { opacity: flashOpacity }]} pointerEvents="none">
        <Text style={styles.flashText}>{flashMessage}</Text>
      </Animated.View>

      {/* ── Header ───────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Since When</Text>
          <View style={styles.modeBadge}>
            <Text style={styles.modeBadgeText}>SOLO</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.signOutBtn} onPress={() => auth().signOut()}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

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
            History{completedTasks.length > 0 ? ` (${completedTasks.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Active tasks ─────────────────────────────── */}
      {tab === 'active' && (
        <>
          {activeTasks.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Nothing to avoid.</Text>
              <Text style={styles.emptySubtitle}>
                Add a task and let the guilt begin.
              </Text>
            </View>
          ) : (
            <FlatList
              data={activeTasks}
              keyExtractor={t => t.id}
              renderItem={({ item }) => (
                <TaskCard
                  task={item}
                  now={now}
                  onComplete={() => handleComplete(item)}
                  onDelete={() => handleDelete(item)}
                />
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
          {completedTasks.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No completed tasks yet.</Text>
              <Text style={styles.emptySubtitle}>
                Finish something first.
              </Text>
            </View>
          ) : (
            <FlatList
              data={completedTasks}
              keyExtractor={t => t.id}
              renderItem={({ item }) => <CompletedRow task={item} />}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            />
          )}
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
  },
  errorText: {
    color: '#c0392b',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorDetail: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Flash banner
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
    color: '#555',
    letterSpacing: 1.5,
  },
  signOutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  signOutText: {
    color: '#555',
    fontSize: 13,
  },

  // Tabs
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 8,
    gap: 4,
  },
  tab: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#1a1a1a',
  },
  tabText: {
    color: '#555',
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#f5f5f5',
  },

  // List
  list: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    gap: 10,
  },

  // Task card
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardOverdue: {
    borderColor: '#3d1a1a',
  },
  cardLeft: {
    flex: 1,
    marginRight: 12,
  },
  cardTitle: {
    color: '#f5f5f5',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 6,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  cardTimer: {
    color: '#888',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  cardTimerOld: {
    color: '#c0392b',
  },
  cardEstimate: {
    color: '#555',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  cardEstimateOver: {
    color: '#8b2e2e',
  },

  doneBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  doneBtnText: {
    color: '#f5f5f5',
    fontSize: 13,
    fontWeight: '500',
  },

  // Completed row
  completedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  completedTitle: {
    color: '#555',
    fontSize: 15,
    flex: 1,
    marginRight: 12,
    textDecorationLine: 'line-through',
  },
  completedRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  completedDuration: {
    color: '#444',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  completedEstLabel: {
    fontSize: 10,
    color: '#8b2e2e',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  completedEstLabelBeat: {
    color: '#2e6b3e',
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#f5f5f5',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#555',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 36,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    color: '#0d0d0d',
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
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
  modalInput: {
    backgroundColor: '#1a1a1a',
    color: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginBottom: 14,
    minHeight: 52,
  },
  estimateLabel: {
    color: '#555',
    fontSize: 13,
    marginBottom: 10,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  presetChipSelected: {
    backgroundColor: '#f5f5f5',
    borderColor: '#f5f5f5',
  },
  presetChipText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '500',
  },
  presetChipTextSelected: {
    color: '#0d0d0d',
  },

  modalAddBtn: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  modalAddBtnDisabled: {
    opacity: 0.3,
  },
  modalAddBtnText: {
    color: '#0d0d0d',
    fontSize: 16,
    fontWeight: '600',
  },
});
