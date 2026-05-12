import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export type EmptyStateProps = {
  title: string;
  subtitle: string;
  style?: ViewStyle;
};

export function EmptyState({ title, subtitle, style }: EmptyStateProps) {
  const { colors: c, spacing: sp } = useTheme();
  return (
    <View style={[styles.wrap, style]}>
      <Text style={[styles.title, { color: c.text, marginBottom: sp.sm }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: c.textSoft }]}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
