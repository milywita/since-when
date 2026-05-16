import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SessionMember, SessionTask, Reaction } from '../../types/Session';
import { useTheme } from '../../theme/ThemeContext';
import { formatElapsed } from '../../utils/formatElapsed';
import { TimerEstimateBlock } from '../tasks/TimerEstimateBlock';
import { PulsingDot } from './PulsingDot';
import { ReactionButton } from './ReactionButton';
import { TaskReactions } from './TaskReactions';

export type PartnerCardProps = {
  member: SessionMember;
  now: number;
  recentReactions: Reaction[];
  onReact: (taskId: string, completed: boolean) => void;
};

export function PartnerCard({
  member,
  now,
  recentReactions,
  onReact,
}: PartnerCardProps) {
  const { colors: c, spacing: sp, radius: r } = useTheme();
  // The focus task is always position #1 among active tasks.
  const focusTask = member.tasks.find(t => t.position === 1 && t.completedAt === null);
  const otherTasks = member.tasks
    .filter(t => t.taskId !== focusTask?.taskId)
    .sort((a, b) => {
      const aActive = a.completedAt === null;
      const bActive = b.completedAt === null;
      if (aActive !== bActive) { return aActive ? -1 : 1; }
      return (a.position ?? 0) - (b.position ?? 0);
    });

  return (
    <View
      style={[
        styles.partnerCard,
        {
          backgroundColor: c.surfaceInset,
          borderRadius: r.md,
          borderColor: c.surfaceSoft,
          gap: sp.sm,
        },
      ]}>
      <View style={[styles.partnerHeader, { gap: sp.sm }]}>
        <View style={[styles.partnerOnlineDot, { backgroundColor: c.success }]} />
        <Text style={[styles.partnerName, { color: c.text }]}>{member.displayName}</Text>
        <Text style={[styles.partnerTaskCount, { color: c.textFaint }]}>
          {member.tasks.filter(t => !t.completedAt).length} active
        </Text>
      </View>

      {member.tasks.length === 0 && (
        <Text style={[styles.partnerEmpty, { color: c.textFaint }]}>No tasks added yet.</Text>
      )}

      {focusTask && (() => {
        const focusLiveSecs = focusTask.timerStartedAt !== null
          ? Math.max(0, Math.floor((now - focusTask.timerStartedAt) / 1000))
          : 0;
        const focusFocusMs = ((focusTask.accumulatedSeconds ?? 0) + focusLiveSecs) * 1000;
        const focusOver = focusTask.estimatedMs != null && focusFocusMs > focusTask.estimatedMs;
        return (
          <View
            style={[
              styles.partnerFocusTask,
              {
                backgroundColor: c.accentSurface,
                borderRadius: r.sm,
                borderColor: c.accent,
                padding: sp.md,
                gap: sp.xs,
              },
            ]}>
            <View style={styles.partnerFocusHeader}>
              <PulsingDot />
              <Text style={[styles.partnerFocusLabel, { color: c.accent }]}>FOCUS</Text>
            </View>
            <Text style={[styles.partnerFocusTitle, { color: c.text }]} numberOfLines={2}>
              {focusTask.title}
            </Text>
            <View
              style={[styles.partnerFocusMeta, { marginTop: 2, gap: sp.sm, alignItems: 'flex-start' }]}>
              <View style={{ flex: 1, minWidth: 0, marginRight: sp.sm }}>
                <TimerEstimateBlock
                  elapsedLabel={formatElapsed(focusFocusMs)}
                  secondaryLabel={
                    focusTask.estimatedMs != null
                      ? focusOver
                        ? `over by ${formatElapsed(focusFocusMs - focusTask.estimatedMs)}`
                        : `est. ${formatElapsed(focusTask.estimatedMs)}`
                      : null
                  }
                  isOverEstimate={focusOver}
                  density="partnerFocus"
                  elapsedColor={focusFocusMs > 86400 * 1000 ? c.dangerMuted : c.accent}
                  secondaryMutedColor={focusOver ? c.danger : c.textMuted}
                  overdueSecondaryColor={c.danger}
                />
              </View>
              <ReactionButton
                variant="focus"
                onPress={() => onReact(focusTask.taskId, false)}
              />
            </View>
            <TaskReactions
              reactions={recentReactions.filter(rx => rx.taskId === focusTask.taskId)}
              now={now}
            />
          </View>
        );
      })()}

      {otherTasks.map(task => {
        const liveSecs = task.timerStartedAt !== null
          ? Math.max(0, Math.floor((now - task.timerStartedAt) / 1000))
          : 0;
        const focusMs = ((task.accumulatedSeconds ?? 0) + liveSecs) * 1000;
        const isDone = task.completedAt !== null;
        const taskReactions = recentReactions.filter(rx => rx.taskId === task.taskId);
        return (
          <PartnerTaskRow
            key={task.taskId}
            task={task}
            elapsed={focusMs}
            isDone={isDone}
            taskReactions={taskReactions}
            now={now}
            onReact={() => onReact(task.taskId, isDone)}
          />
        );
      })}
    </View>
  );
}

type PartnerTaskRowProps = {
  task: SessionTask;
  elapsed: number;
  isDone: boolean;
  taskReactions: Reaction[];
  now: number;
  onReact: () => void;
};

function PartnerTaskRow({
  task,
  elapsed,
  isDone,
  taskReactions,
  now,
  onReact,
}: PartnerTaskRowProps) {
  const { colors: c, spacing: sp } = useTheme();
  return (
    <View
      style={[
        styles.partnerTask,
        {
          backgroundColor: c.surface,
          borderColor: c.borderInner,
          gap: sp.sm,
          opacity: isDone ? 0.4 : 1,
        },
      ]}>
      <View style={[styles.partnerTaskLeft, { gap: 3 }]}>
        <Text
          style={[
            styles.partnerTaskTitle,
            { color: isDone ? c.textDim : c.text, textDecorationLine: isDone ? 'line-through' : 'none' },
          ]}
          numberOfLines={2}>
          {task.title}
        </Text>
        {!isDone && (
          <TimerEstimateBlock
            elapsedLabel={formatElapsed(elapsed)}
            secondaryLabel={
              task.estimatedMs != null
                ? elapsed > task.estimatedMs
                  ? `over by ${formatElapsed(elapsed - task.estimatedMs)}`
                  : `est. ${formatElapsed(task.estimatedMs)}`
                : null
            }
            isOverEstimate={task.estimatedMs != null && elapsed > task.estimatedMs}
            density="partnerRow"
            elapsedColor={elapsed > 86400 * 1000 ? c.dangerMuted : c.textSecondary}
            secondaryMutedColor={
              task.estimatedMs != null && elapsed > task.estimatedMs ? c.danger : c.textMuted
            }
            overdueSecondaryColor={c.danger}
          />
        )}
        {isDone && (
          <Text style={[styles.partnerTaskDoneLabel, { color: c.success }]}>
            Done in {formatElapsed((task.accumulatedSeconds ?? 0) > 0
              ? (task.accumulatedSeconds ?? 0) * 1000
              : (task.completedAt ?? 0) - task.createdAt)}
          </Text>
        )}
        <TaskReactions reactions={taskReactions} now={now} />
      </View>
      <ReactionButton
        onPress={onReact}
        label={isDone ? '🎉' : 'React'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  partnerCard: { borderWidth: 1, padding: 14 },
  partnerHeader: { flexDirection: 'row', alignItems: 'center' },
  partnerOnlineDot: { width: 7, height: 7, borderRadius: 4 },
  partnerName: { fontSize: 15, fontWeight: '600', flex: 1 },
  partnerTaskCount: { fontSize: 12 },
  partnerEmpty: { fontSize: 13 },
  partnerFocusTask: { borderWidth: 1.5 },
  partnerFocusHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  partnerFocusLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
  partnerFocusTitle: { fontSize: 15, fontWeight: '500' },
  partnerFocusMeta: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
  },
  partnerTask: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  partnerTaskLeft: { flex: 1 },
  partnerTaskTitle: { fontSize: 14, fontWeight: '500' },
  partnerTaskDoneLabel: { fontSize: 12 },
});
