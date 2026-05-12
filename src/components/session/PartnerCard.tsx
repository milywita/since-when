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
  const activeTask = member.tasks.find(
    t => t.taskId === member.activeTaskId && !t.completedAt,
  );
  const otherTasks = member.tasks.filter(t => t.taskId !== member.activeTaskId);

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

      {activeTask && (
        <View
          style={[
            styles.partnerFocusTask,
            {
              backgroundColor: c.accentSurface,
              borderRadius: r.sm,
              borderColor: c.accentSurfaceBorder,
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
                { color: now - activeTask.createdAt > 86400 * 1000 ? c.dangerMuted : c.accentLight },
              ]}>
              {formatElapsed(now - activeTask.createdAt)}
            </Text>
            {activeTask.estimatedMs != null && (
              <Text
                style={[
                  styles.partnerEstimate,
                  {
                    color:
                      now - activeTask.createdAt > activeTask.estimatedMs
                        ? c.danger
                        : c.textMuted,
                  },
                ]}>
                {now - activeTask.createdAt > activeTask.estimatedMs
                  ? `over by ${formatElapsed((now - activeTask.createdAt) - activeTask.estimatedMs)}`
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
      )}

      {otherTasks.map(task => {
        const elapsed = now - task.createdAt;
        const isDone = task.completedAt !== null;
        const taskReactions = recentReactions.filter(rx => rx.taskId === task.taskId);
        return (
          <PartnerTaskRow
            key={task.taskId}
            task={task}
            elapsed={elapsed}
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
            Done in {formatElapsed((task.completedAt ?? 0) - task.createdAt)}
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
  partnerFocusTask: { borderWidth: 1 },
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
