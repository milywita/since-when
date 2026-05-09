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
  Animated,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { Screen } from '../components/ui/Screen';
import { theme } from '../theme/themes';
import { EmptyState } from '../components/layout/EmptyState';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { TaskCard } from '../components/tasks/TaskCard';
import { useTasks } from '../hooks/useTasks';
import type { Task } from '../types/Task';
import type { AppScreenProps } from '../navigation/types';
import { formatElapsed } from '../utils/formatElapsed';

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
  const duration = (task.completedAt ?? 0) - task.createdAt;
  const beatEstimate =
    task.estimatedMs !== null && duration <= task.estimatedMs;
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
            History{completedTasks.length > 0 ? ` (${completedTasks.length})` : ''}
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
            <EmptyState
              title="No completed tasks yet."
              subtitle="Finish something first."
            />
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

  // Completed row
  completedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.surface,
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
});
