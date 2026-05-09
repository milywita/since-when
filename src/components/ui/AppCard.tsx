import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { theme } from '../../theme/themes';

export type AppCardProps = {
  children: React.ReactNode;
  style?: ViewStyle;
};

/**
 * Bordered surface card for grouped content (matches common Home / session panels).
 */
export function AppCard({ children, style }: AppCardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
  },
});
