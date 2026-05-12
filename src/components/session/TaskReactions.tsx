import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Reaction } from '../../types/Session';
import { useTheme } from '../../theme/ThemeContext';

function formatRelativeTime(ts: number, now: number): string {
  const secs = Math.floor((now - ts) / 1000);
  if (secs < 60) { return 'just now'; }
  const mins = Math.floor(secs / 60);
  if (mins < 60) { return `${mins}m ago`; }
  const hours = Math.floor(mins / 60);
  if (hours < 24) { return `${hours}h ago`; }
  return `${Math.floor(hours / 24)}d ago`;
}

export type TaskReactionsProps = {
  reactions: Reaction[];
  now: number;
};

export function TaskReactions({ reactions, now }: TaskReactionsProps) {
  const { colors: c, spacing: sp } = useTheme();
  const [expanded, setExpanded] = useState(false);
  if (reactions.length === 0) { return null; }
  const sorted = [...reactions].sort((a, b) => b.sentAt - a.sentAt);

  return (
    <View style={[styles.wrap, { marginTop: sp.sm }]}>
      <TouchableOpacity
        style={styles.toggle}
        onPress={() => setExpanded(e => !e)}
        hitSlop={8}>
        <Text style={[styles.count, { color: c.accent }]}>
          {reactions.length} {reactions.length === 1 ? 'reaction' : 'reactions'}{' '}
          <Text style={[styles.chevron, { color: c.accent }]}>{expanded ? '▲' : '▼'}</Text>
        </Text>
      </TouchableOpacity>
      {expanded && (
        <View style={[styles.list, { borderLeftColor: c.accentSurfaceBorder }]}>
          {sorted.map(r => (
            <View key={r.id} style={[styles.item, { gap: sp.sm }]}>
              <Text style={[styles.quote, { color: c.accentLight }]}>"{r.text}"</Text>
              <Text style={[styles.time, { color: c.textFaint }]}>{formatRelativeTime(r.sentAt, now)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  toggle: { flexDirection: 'row', alignItems: 'center' },
  count: { fontSize: 11, fontWeight: '500' },
  chevron: { fontSize: 9 },
  list: {
    marginTop: 5,
    gap: 5,
    paddingLeft: 4,
    borderLeftWidth: 1,
  },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quote: { fontSize: 12, fontStyle: 'italic', flex: 1 },
  time: { fontSize: 11, fontVariant: ['tabular-nums'] },
});
