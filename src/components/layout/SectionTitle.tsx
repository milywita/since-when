import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { theme } from '../../theme/themes';

export type SectionTitleProps = {
  title: string;
  subtitle?: string;
  style?: ViewStyle;
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
};

export function SectionTitle({
  title,
  subtitle,
  style,
  titleStyle,
  subtitleStyle,
}: SectionTitleProps) {
  return (
    <View style={[styles.wrap, style]}>
      <Text style={[styles.title, titleStyle]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, subtitleStyle]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const c = theme.colors;
const sp = theme.spacing;

const styles = StyleSheet.create({
  wrap: {
    gap: sp.sm,
    marginBottom: sp.sm,
  },
  title: {
    color: c.text,
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    color: c.textSoft,
    fontSize: 14,
    lineHeight: 20,
  },
});
