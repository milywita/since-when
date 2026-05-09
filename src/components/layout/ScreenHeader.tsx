import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { theme } from '../../theme/themes';
import { TaskStatusBadge } from '../tasks/TaskStatusBadge';

export type ScreenHeaderProps = {
  title: string;
  /** Shown in the small pill under the title when provided. */
  badge?: { text: string; variant?: 'muted' | 'accent' };
  /** Left slot (e.g. back button). */
  leading?: React.ReactNode;
  /** Right slot (e.g. sign out). */
  trailing?: React.ReactNode;
  style?: ViewStyle;
};

/**
 * Top screen bar: optional leading control, title + optional badge, optional trailing actions.
 */
export function ScreenHeader({
  title,
  badge,
  leading,
  trailing,
  style,
}: ScreenHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      {leading != null ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.center}>
        <Text style={styles.title}>{title}</Text>
        {badge ? (
          <TaskStatusBadge label={badge.text} variant={badge.variant ?? 'muted'} />
        ) : null}
      </View>
      {trailing != null ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const c = theme.colors;
const sp = theme.spacing;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: sp.gutter,
    paddingTop: sp.lg,
    paddingBottom: sp.sm,
  },
  leading: {
    marginRight: sp.md,
  },
  center: {
    flex: 1,
    minWidth: 0,
  },
  trailing: {
    marginLeft: sp.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: c.text,
    letterSpacing: -0.5,
  },
});
