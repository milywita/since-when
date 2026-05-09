import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { SessionTask } from '../../types/Session';
import { theme } from '../../theme/themes';
import { formatElapsed } from '../../utils/formatElapsed';
import { PulsingDot } from './PulsingDot';

export type SessionTimerCardProps = {
  task: SessionTask;
  now: number;
  onComplete: () => void;
  onClearFocus: () => void;
};

/**
 * Large “focus” card for the active session task (timer, estimates, actions).
 */
export function SessionTimerCard({
  task,
  now,
  onComplete,
  onClearFocus,
}: SessionTimerCardProps) {
  const elapsed = now - task.createdAt;
  const isOld = elapsed > 86400 * 1000;
  const overEstimate = task.estimatedMs != null && elapsed > task.estimatedMs;

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
        <TouchableOpacity style={styles.focusClearBtn} onPress={onClearFocus}>
          <Text style={styles.focusClearBtnText}>Clear focus</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const c = theme.colors;
const sp = theme.spacing;

const styles = StyleSheet.create({
  focusCard: {
    backgroundColor: c.accentSurface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: c.accent,
    padding: 18,
    marginBottom: sp.sm,
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
    color: c.accent,
    letterSpacing: 2,
  },
  focusTitle: {
    color: c.text,
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
  },
  focusTimerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: sp.sm,
    flexWrap: 'wrap',
    marginBottom: sp.xs,
  },
  focusTimer: {
    color: c.accentLight,
    fontSize: 16,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  focusTimerOld: {
    color: c.danger,
  },
  focusEstimate: {
    color: c.textSoft,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  focusEstimateOver: {
    color: c.dangerMuted,
  },
  focusActions: {
    flexDirection: 'row',
    gap: sp.sm,
    marginTop: 6,
  },
  focusDoneBtn: {
    flex: 1,
    backgroundColor: c.accent,
    borderRadius: 9,
    paddingVertical: 11,
    alignItems: 'center',
  },
  focusDoneBtnText: {
    color: c.onAccent,
    fontSize: 14,
    fontWeight: '600',
  },
  focusClearBtn: {
    borderRadius: 9,
    borderWidth: 1,
    borderColor: c.accentSurfaceBorder,
    paddingVertical: 11,
    paddingHorizontal: sp.lg,
  },
  focusClearBtnText: {
    color: c.textSoft,
    fontSize: 14,
  },
});
