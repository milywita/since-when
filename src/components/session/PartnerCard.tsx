import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SessionMember, SessionTask, Reaction } from '../../types/Session';
import { useTheme } from '../../theme/ThemeContext';
import { formatElapsed } from '../../utils/formatElapsed';
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
  // #1 active task is the focused task (activeTaskId is kept in sync with position 1).
  const activeTask = member.tasks.find(
    t => t.taskId === member.activeTaskId && !t.completedAt,
  );
  const otherTasks = member.tasks
    .filter(t => t.taskId !== member.activeTaskId)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

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

      {activeTask && (() => {
        const activeLiveSecs = activeTask.timerStartedAt !== null
          ? Math.max(0, Math.floor((now - activeTask.timerStartedAt) / 1000))
          : 0;
        const activeFocusMs = ((activeTask.accumulatedSeconds ?? 0) + activeLiveSecs) * 1000;
        const activeOver = activeTask.estimatedMs != null && activeFocusMs > activeTask.estimatedMs;
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
              {activeTask.title}
            </Text>
            <View style={styles.partnerFocusMeta}>
              <Text
                style={[
                  styles.partnerFocusTimer,
                  { color: activeFocusMs > 86400 * 1000 ? c.dangerMuted : c.accent },
                ]}>
                {formatElapsed(activeFocusMs)}
              </Text>
              {activeTask.estimatedMs != null && (
                <Text style={[styles.partnerEstimate, { color: activeOver ? c.danger : c.textMuted }]}>
                  {activeOver
                    ? `over by ${formatElapsed(activeFocusMs - activeTask.estimatedMs)}`
                    : `est. ${formatElapsed(activeTask.estimatedMs)}`}
                </Text>
              )}
              <ReactionButton
                variant="focus"
                onPress={() => onReact(activeTask.taskId, false)}
              />
            </View>
            <TaskReactions
              reactions={recentReactions.filter(rx => rx.taskId === activeTask.taskId)}
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
          <Text
            style={[
              styles.partnerTaskTimer,
              { color: elapsed > 86400 * 1000 ? c.dangerMuted : c.textSecondary },
            ]}>
            {formatElapsed(elapsed)}
          </Text>
        )}
        {!isDone && task.estimatedMs != null && (
          <Text
            style={[
              styles.partnerEstimate,
              { color: elapsed > task.estimatedMs ? c.danger : c.textMuted },
            ]}>
            {elapsed > task.estimatedMs
              ? `over by ${formatElapsed(elapsed - task.estimatedMs)}`
              : `est. ${formatElapsed(task.estimatedMs)}`}
          </Text>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  partnerFocusTimer: { fontSize: 13, fontVariant: ['tabular-nums'] },
  partnerTask: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  partnerTaskLeft: { flex: 1 },
  partnerTaskTitle: { fontSize: 14, fontWeight: '500' },
  partnerTaskTimer: { fontSize: 12, fontVariant: ['tabular-nums'] },
  partnerTaskDoneLabel: { fontSize: 12 },
  partnerEstimate: { fontSize: 11 },
});
