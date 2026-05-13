import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { TaskStatusBadge } from '../tasks/TaskStatusBadge';

export type ScreenHeaderProps = {
  title: string;
  badge?: { text: string; variant?: 'muted' | 'accent' };
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  style?: ViewStyle;
};

export function ScreenHeader({
  title,
  badge,
  leading,
  trailing,
  style,
}: ScreenHeaderProps) {
  const { colors: c, spacing: sp } = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'flex-start',
          paddingHorizontal: sp.gutter,
          paddingTop: sp.lg,
          paddingBottom: sp.sm,
        },
        style,
      ]}>
      {leading != null ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.center}>
        <Text style={[styles.title, { color: c.text }]}>{title}</Text>
        {badge ? (
          <TaskStatusBadge label={badge.text} variant={badge.variant ?? 'muted'} />
        ) : null}
      </View>
      {trailing != null ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /** Top-align with title line so back is not pulled down when a badge sits under the title. */
  leading: { marginRight: 8, justifyContent: 'flex-start' },
  center: { flex: 1, minWidth: 0 },
  trailing: { marginLeft: 12, justifyContent: 'center' },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 32,
    paddingTop: 0,
    includeFontPadding: false,
  },
});
