import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { SessionTask } from '../../types/Session';
import { useTheme } from '../../theme/ThemeContext';
import { formatElapsed } from '../../utils/formatElapsed';
import { PulsingDot } from './PulsingDot';

export type SessionTimerCardProps = {
  task: SessionTask;
  now: number;
  onComplete: () => void;
  onClearFocus: () => void;
};

export function SessionTimerCard({
  task,
  now,
  onComplete,
  onClearFocus,
}: SessionTimerCardProps) {
  const { colors: c, spacing: sp, radius: r } = useTheme();
  // Live focused time: accumulated seconds + any ongoing session since timerStartedAt.
  const liveSecs = task.timerStartedAt !== null
    ? Math.max(0, Math.floor((now - task.timerStartedAt) / 1000))
    : 0;
  const focusSecs = (task.accumulatedSeconds ?? 0) + liveSecs;
  const elapsed = focusSecs * 1000;
  const isOld = elapsed > 86400 * 1000;
  const overEstimate = task.estimatedMs != null && elapsed > task.estimatedMs;

  return (
    <View
      style={[
        styles.focusCard,
        {
          backgroundColor: c.accentSurface,
          borderColor: c.accent,
          borderRadius: r.sm,
        },
      ]}>
      <View style={styles.focusHeader}>
        <PulsingDot />
        <Text style={[styles.focusLabel, { color: c.accent }]}>FOCUS</Text>
      </View>
      <Text style={[styles.focusTitle, { color: c.text }]}>{task.title}</Text>
      <View style={[styles.focusTimerRow, { gap: sp.sm }]}>
        <Text
          style={[
            styles.focusTimer,
            { color: (isOld || overEstimate) ? c.danger : c.accentLight },
          ]}>
          {formatElapsed(elapsed)}
        </Text>
        {task.estimatedMs != null && (
          <Text style={[styles.focusEstimate, { color: overEstimate ? c.dangerMuted : c.textSoft }]}>
            {overEstimate
              ? `over by ${formatElapsed(elapsed - task.estimatedMs)}`
              : `est. ${formatElapsed(task.estimatedMs)}`}
          </Text>
        )}
      </View>
      <View style={[styles.focusActions, { gap: sp.sm }]}>
        <TouchableOpacity
          style={[styles.focusDoneBtn, { backgroundColor: c.accent }]}
          onPress={onComplete}>
          <Text style={[styles.focusDoneBtnText, { color: c.onAccent }]}>Mark done</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.focusClearBtn, { borderColor: c.accentSurfaceBorder, paddingHorizontal: sp.lg }]}
          onPress={onClearFocus}>
          <Text style={[styles.focusClearBtnText, { color: c.textSoft }]}>Clear focus</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  focusCard: {
    borderWidth: 1.5,
    padding: 18,
    gap: 6,
  },
  focusHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 2 },
  focusLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  focusTitle: { fontSize: 20, fontWeight: '600', lineHeight: 26 },
  focusTimerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  focusTimer: { fontSize: 16, fontWeight: '500', fontVariant: ['tabular-nums'] },
  focusEstimate: { fontSize: 12, fontVariant: ['tabular-nums'] },
  focusActions: { flexDirection: 'row', marginTop: 6 },
  focusDoneBtn: { flex: 1, borderRadius: 9, paddingVertical: 11, alignItems: 'center' },
  focusDoneBtnText: { fontSize: 14, fontWeight: '600' },
  focusClearBtn: { borderRadius: 9, borderWidth: 1, paddingVertical: 11 },
  focusClearBtnText: { fontSize: 14 },
});
