import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

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
  const { colors: c, spacing: sp } = useTheme();
  return (
    <View style={[{ gap: sp.sm, marginBottom: sp.sm }, style]}>
      <Text style={[styles.title, { color: c.text }, titleStyle]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: c.textSoft }, subtitleStyle]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '600' },
  subtitle: { fontSize: 14, lineHeight: 20 },
});
