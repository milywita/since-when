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
  /** Shown beside the title, e.g. status (Work in progress). */
  titleNote?: string;
  style?: ViewStyle;
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
  titleNoteStyle?: TextStyle;
};

export function SectionTitle({
  title,
  subtitle,
  titleNote,
  style,
  titleStyle,
  subtitleStyle,
  titleNoteStyle,
}: SectionTitleProps) {
  const { colors: c, spacing: sp } = useTheme();
  return (
    <View style={[{ gap: sp.sm, marginBottom: sp.sm }, style]}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: c.text }, titleStyle]}>{title}</Text>
        {titleNote ? (
          <Text style={[styles.titleNote, { color: c.textSoft }, titleNoteStyle]}>({titleNote})</Text>
        ) : null}
      </View>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: c.textSoft }, subtitleStyle]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: 6,
    rowGap: 2,
  },
  title: { fontSize: 18, fontWeight: '600' },
  titleNote: { fontSize: 14, fontWeight: '500', fontStyle: 'italic' },
  subtitle: { fontSize: 14, lineHeight: 20 },
});
