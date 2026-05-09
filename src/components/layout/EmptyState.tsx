import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { theme } from '../../theme/themes';

export type EmptyStateProps = {
  title: string;
  subtitle: string;
  style?: ViewStyle;
};

export function EmptyState({ title, subtitle, style }: EmptyStateProps) {
  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const c = theme.colors;
const sp = theme.spacing;

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  title: {
    color: c.text,
    fontSize: 20,
    fontWeight: '600',
    marginBottom: sp.sm,
    textAlign: 'center',
  },
  subtitle: {
    color: c.textSoft,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
