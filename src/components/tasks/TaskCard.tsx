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
import { theme } from '../../theme/themes';
import { formatElapsed } from '../../utils/formatElapsed';

export type TaskCardProps = {
  task: Task;
  now: number;
  onComplete: () => void;
  onDelete: () => void;
  style?: ViewStyle;
};

export function TaskCard({ task, now, onComplete, onDelete, style }: TaskCardProps) {
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
      style={[styles.card, overEstimate && styles.cardOverdue, style]}
      onLongPress={handleLongPress}
      activeOpacity={0.75}>
      <View style={styles.cardLeft}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {task.title}
        </Text>
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

const c = theme.colors;
const sp = theme.spacing;
const r = theme.radius;

const styles = StyleSheet.create({
  card: {
    backgroundColor: c.surface,
    borderRadius: r.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: sp.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardOverdue: {
    borderColor: c.borderDanger,
  },
  cardLeft: {
    flex: 1,
    marginRight: sp.md,
  },
  cardTitle: {
    color: c.text,
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
    color: c.textMuted,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  cardTimerOld: {
    color: c.danger,
  },
  cardEstimate: {
    color: c.textSoft,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  cardEstimateOver: {
    color: c.dangerMuted,
  },
  doneBtn: {
    borderRadius: sp.sm,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  doneBtnText: {
    color: c.text,
    fontSize: 13,
    fontWeight: '500',
  },
});
