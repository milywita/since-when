import React from 'react';
import { Text, View, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export type TaskStatusBadgeVariant = 'muted' | 'accent';

export type TaskStatusBadgeProps = {
  label: string;
  variant?: TaskStatusBadgeVariant;
  style?: ViewStyle;
};

export function TaskStatusBadge({
  label,
  variant = 'muted',
  style,
}: TaskStatusBadgeProps) {
  const { colors: c, spacing: sp } = useTheme();
  const isAccent = variant === 'accent';
  return (
    <View
      style={[
        {
          marginTop: sp.xs,
          alignSelf: 'flex-start' as const,
          backgroundColor: c.surface,
          borderRadius: 5,
          borderWidth: 1,
          borderColor: c.border,
          paddingHorizontal: 7,
          paddingVertical: 2,
        },
        style,
      ]}>
      <Text style={[styles.text, { color: isAccent ? c.accent : c.textSoft }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
});
