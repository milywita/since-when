import React from 'react';
import { Text, View, StyleSheet, type ViewStyle } from 'react-native';
import { theme } from '../../theme/themes';

export type TaskStatusBadgeVariant = 'muted' | 'accent';

export type TaskStatusBadgeProps = {
  label: string;
  variant?: TaskStatusBadgeVariant;
  style?: ViewStyle;
};

/**
 * Small pill label (SOLO / TOGETHER / session mode indicators).
 */
export function TaskStatusBadge({
  label,
  variant = 'muted',
  style,
}: TaskStatusBadgeProps) {
  const isAccent = variant === 'accent';
  return (
    <View style={[styles.wrap, style]}>
      <Text style={[styles.text, isAccent ? styles.textAccent : styles.textMuted]}>
        {label}
      </Text>
    </View>
  );
}

const c = theme.colors;
const sp = theme.spacing;

const styles = StyleSheet.create({
  wrap: {
    marginTop: sp.xs,
    alignSelf: 'flex-start',
    backgroundColor: c.surface,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  textMuted: {
    color: c.textSoft,
  },
  textAccent: {
    color: c.accent,
  },
});
