import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SessionMember, SessionTask, Reaction } from '../../types/Session';
import { theme } from '../../theme/themes';
import { formatElapsed } from '../../utils/formatElapsed';
import { PulsingDot } from './PulsingDot';
import { ReactionButton } from './ReactionButton';

export type PartnerCardProps = {
  member: SessionMember;
  now: number;
  recentReactions: Reaction[];
  onReact: (taskId: string) => void;
};

export function PartnerCard({
  member,
  now,
  recentReactions,
  onReact,
}: PartnerCardProps) {
  const activeTask = member.tasks.find(
    t => t.taskId === member.activeTaskId && !t.completedAt,
  );
  const otherTasks = member.tasks.filter(t => t.taskId !== member.activeTaskId);

  return (
    <View style={styles.partnerCard}>
      <View style={styles.partnerHeader}>
        <View style={styles.partnerOnlineDot} />
        <Text style={styles.partnerName}>{member.displayName}</Text>
        <Text style={styles.partnerTaskCount}>
          {member.tasks.filter(t => !t.completedAt).length} active
        </Text>
      </View>

      {member.tasks.length === 0 && (
        <Text style={styles.partnerEmpty}>No tasks added yet.</Text>
      )}

      {activeTask && (
        <View style={styles.partnerFocusTask}>
          <View style={styles.partnerFocusHeader}>
            <PulsingDot />
            <Text style={styles.partnerFocusLabel}>FOCUS</Text>
          </View>
          <Text style={styles.partnerFocusTitle} numberOfLines={2}>
            {activeTask.title}
          </Text>
          <View style={styles.partnerFocusMeta}>
            <Text
              style={[
                styles.partnerFocusTimer,
                now - activeTask.createdAt > 86400 * 1000 && styles.partnerTaskTimerOld,
              ]}>
              {formatElapsed(now - activeTask.createdAt)}
            </Text>
            {activeTask.estimatedMs != null && (
              <Text
                style={[
                  styles.partnerEstimate,
                  now - activeTask.createdAt > activeTask.estimatedMs &&
                    styles.partnerEstimateOver,
                ]}>
                {now - activeTask.createdAt > activeTask.estimatedMs
                  ? `over by ${formatElapsed(
                      (now - activeTask.createdAt) - activeTask.estimatedMs,
                    )}`
                  : `est. ${formatElapsed(activeTask.estimatedMs)}`}
              </Text>
            )}
            <ReactionButton
              variant="focus"
              onPress={() => onReact(activeTask.taskId)}
            />
          </View>
          {recentReactions.find(r => r.taskId === activeTask.taskId) && (
            <Text style={styles.partnerReactionBubble}>
              "{recentReactions.find(r => r.taskId === activeTask.taskId)!.text}"
            </Text>
          )}
        </View>
      )}

      {otherTasks.map(task => {
        const elapsed = now - task.createdAt;
        const isDone = task.completedAt !== null;
        const latestReaction = recentReactions.find(r => r.taskId === task.taskId);

        return (
          <PartnerTaskRow
            key={task.taskId}
            task={task}
            elapsed={elapsed}
            isDone={isDone}
            latestReaction={latestReaction}
            onReact={() => onReact(task.taskId)}
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
  latestReaction?: Reaction;
  onReact: () => void;
};

function PartnerTaskRow({
  task,
  elapsed,
  isDone,
  latestReaction,
  onReact,
}: PartnerTaskRowProps) {
  return (
    <View style={[styles.partnerTask, isDone && styles.partnerTaskDone]}>
      <View style={styles.partnerTaskLeft}>
        <Text
          style={[styles.partnerTaskTitle, isDone && styles.partnerTaskTitleDone]}
          numberOfLines={2}>
          {task.title}
        </Text>
        {!isDone && (
          <Text
            style={[
              styles.partnerTaskTimer,
              elapsed > 86400 * 1000 && styles.partnerTaskTimerOld,
            ]}>
            {formatElapsed(elapsed)}
          </Text>
        )}
        {!isDone && task.estimatedMs != null && (
          <Text
            style={[
              styles.partnerEstimate,
              elapsed > task.estimatedMs && styles.partnerEstimateOver,
            ]}>
            {elapsed > task.estimatedMs
              ? `over by ${formatElapsed(elapsed - task.estimatedMs)}`
              : `est. ${formatElapsed(task.estimatedMs)}`}
          </Text>
        )}
        {isDone && (
          <Text style={styles.partnerTaskDoneLabel}>
            Done in {formatElapsed((task.completedAt ?? 0) - task.createdAt)}
          </Text>
        )}
        {latestReaction && (
          <Text style={styles.partnerReactionBubble}>"{latestReaction.text}"</Text>
        )}
      </View>
      {!isDone && <ReactionButton onPress={onReact} />}
    </View>
  );
}

const c = theme.colors;
const sp = theme.spacing;
const r = theme.radius;

const styles = StyleSheet.create({
  partnerCard: {
    backgroundColor: c.surfaceInset,
    borderRadius: r.md,
    borderWidth: 1,
    borderColor: c.surfaceSoft,
    padding: 14,
    gap: sp.sm,
  },
  partnerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
  },
  partnerOnlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: c.success,
  },
  partnerName: {
    color: c.text,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  partnerTaskCount: { color: c.textFaint, fontSize: 12 },
  partnerEmpty: { color: c.textFaint, fontSize: 13 },

  partnerFocusTask: {
    backgroundColor: c.accentSurface,
    borderRadius: r.sm,
    borderWidth: 1,
    borderColor: c.accentSurfaceBorder,
    padding: sp.md,
    gap: sp.xs,
  },
  partnerFocusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  partnerFocusLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: c.accent,
    letterSpacing: 1.5,
  },
  partnerFocusTitle: {
    color: c.text,
    fontSize: 15,
    fontWeight: '500',
  },
  partnerFocusMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  partnerFocusTimer: {
    color: c.accentLight,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  partnerTaskTimerOld: { color: c.dangerMuted },

  partnerTask: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: sp.sm,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderInner,
    padding: 10,
    gap: sp.sm,
  },
  partnerTaskDone: { opacity: 0.4 },
  partnerTaskLeft: { flex: 1, gap: 3 },
  partnerTaskTitle: {
    color: c.text,
    fontSize: 14,
    fontWeight: '500',
  },
  partnerTaskTitleDone: {
    textDecorationLine: 'line-through',
    color: c.textDim,
  },
  partnerTaskTimer: {
    color: c.textSecondary,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  partnerTaskDoneLabel: { color: c.success, fontSize: 12 },
  partnerEstimate: { color: c.textMuted, fontSize: 11 },
  partnerEstimateOver: { color: c.danger },
  partnerReactionBubble: {
    color: c.accent,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
});
