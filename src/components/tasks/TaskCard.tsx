import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  type ViewStyle,
} from 'react-native';
import type { Task } from '../../types/Task';
import { useTheme } from '../../theme/ThemeContext';
import { formatElapsed } from '../../utils/formatElapsed';
import { TimerEstimateBlock } from './TimerEstimateBlock';

export type TaskCardProps = {
  task: Task;
  now: number;
  onComplete: () => void;
  onDelete: () => void;
  onEdit?: () => void;
  style?: ViewStyle;
};

export function TaskCard({ task, now, onComplete, onDelete, onEdit, style }: TaskCardProps) {
  const { colors: c, spacing: sp, radius: r } = useTheme();
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
      style={[
        styles.card,
        {
          backgroundColor: c.surface,
          borderRadius: r.md,
          borderColor: overEstimate ? c.borderDanger : c.border,
          borderWidth: overEstimate ? 1.5 : 1,
        },
        style,
      ]}
      onLongPress={handleLongPress}
      activeOpacity={1}>
      <View style={[styles.cardLeft, { marginRight: sp.md }]}>
        <Text style={[styles.cardTitle, { color: c.text, marginBottom: 6 }]} numberOfLines={2}>
          {task.title}
        </Text>
        <View style={styles.cardMeta}>
          <TimerEstimateBlock
            elapsedLabel={formatElapsed(elapsed)}
            secondaryLabel={
              task.estimatedMs !== null
                ? overEstimate
                  ? `over by ${formatElapsed(elapsed - task.estimatedMs)}`
                  : `est. ${formatElapsed(task.estimatedMs)}`
                : null
            }
            isOverEstimate={Boolean(overEstimate && task.estimatedMs !== null)}
            density="queue"
            elapsedColor={isOld || overEstimate ? c.danger : c.textMuted}
            secondaryMutedColor={overEstimate ? c.dangerMuted : c.textSoft}
            overdueSecondaryColor={c.dangerMuted}
          />
        </View>
      </View>
      <View style={[styles.cardActions, { gap: sp.sm }]}>
        {onEdit !== undefined && (
          <TouchableOpacity
            style={[styles.editBtn, { borderColor: c.border }]}
            onPress={onEdit}
            hitSlop={12}>
            <Text style={[styles.editBtnText, { color: c.textMuted }]}>✎</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.doneBtn, { borderColor: c.border }]}
          onPress={onComplete}
          hitSlop={12}>
          <Text style={[styles.doneBtnText, { color: c.text }]}>Done</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardLeft: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '500' },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  cardActions: { flexDirection: 'row', alignItems: 'center' },
  editBtn: {
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  editBtnText: { fontSize: 15 },
  doneBtn: {
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  doneBtnText: { fontSize: 13, fontWeight: '500' },
});
