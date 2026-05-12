import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Reaction } from '../../types/Session';
import { theme } from '../../theme/themes';

function formatRelativeTime(ts: number, now: number): string {
  const secs = Math.floor((now - ts) / 1000);
  if (secs < 60) {
    return 'just now';
  }
  const mins = Math.floor(secs / 60);
  if (mins < 60) {
    return `${mins}m ago`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
}

export type TaskReactionsProps = {
  reactions: Reaction[];
  now: number;
};

/**
 * Expandable list of reactions sent to a task (session Together mode).
 */
export function TaskReactions({ reactions, now }: TaskReactionsProps) {
  const [expanded, setExpanded] = useState(false);
  if (reactions.length === 0) {
    return null;
  }
  const sorted = [...reactions].sort((a, b) => b.sentAt - a.sentAt);

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.toggle}
        onPress={() => setExpanded(e => !e)}
        hitSlop={8}>
        <Text style={styles.count}>
          {reactions.length} {reactions.length === 1 ? 'reaction' : 'reactions'}{' '}
          <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
        </Text>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.list}>
          {sorted.map(r => (
            <View key={r.id} style={styles.item}>
              <Text style={styles.quote}>"{r.text}"</Text>
              <Text style={styles.time}>{formatRelativeTime(r.sentAt, now)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const c = theme.colors;
const sp = theme.spacing;

const styles = StyleSheet.create({
  wrap: {
    marginTop: sp.sm,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  count: {
    color: c.accent,
    fontSize: 11,
    fontWeight: '500',
  },
  chevron: {
    fontSize: 9,
    color: c.accent,
  },
  list: {
    marginTop: 5,
    gap: 5,
    paddingLeft: 4,
    borderLeftWidth: 1,
    borderLeftColor: c.accentSurfaceBorder,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sp.sm,
  },
  quote: {
    color: c.accentLight,
    fontSize: 12,
    fontStyle: 'italic',
    flex: 1,
  },
  time: {
    color: c.textFaint,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
});
