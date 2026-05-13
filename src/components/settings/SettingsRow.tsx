import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { SettingsInfoIcon } from './SettingsInfoIcon';

export type SettingsRowProps = {
  title: string;
  description?: string;
  right?: React.ReactNode;
  /** When false, omits bottom divider (use on last row in a card). */
  showDivider?: boolean;
  style?: ViewStyle;
  /** When set, the whole row is tappable (e.g. time pickers). */
  onPress?: () => void;
  /** Optional (i) modal with longer explanation next to the title. */
  infoHint?: { title: string; body: string };
};

export function SettingsRow({
  title,
  description,
  right,
  showDivider = true,
  style,
  onPress,
  infoHint,
}: SettingsRowProps) {
  const { colors: c, spacing: sp } = useTheme();
  const inner = (
    <>
      <View style={styles.left}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: c.text }]}>{title}</Text>
          {infoHint ? (
            <SettingsInfoIcon hintTitle={infoHint.title} hintBody={infoHint.body} />
          ) : null}
        </View>
        {description ? (
          <Text style={[styles.description, { color: c.textSoft }]}>{description}</Text>
        ) : null}
      </View>
      {right != null ? <View style={styles.right}>{right}</View> : null}
    </>
  );
  const shellStyle = [
    styles.row,
    {
      paddingVertical: sp.md,
      paddingHorizontal: sp.lg,
      borderBottomWidth: showDivider ? StyleSheet.hairlineWidth : 0,
      borderBottomColor: c.border,
    },
    style,
  ];
  if (onPress) {
    return (
      <TouchableOpacity
        style={shellStyle}
        onPress={onPress}
        activeOpacity={0.65}
        accessibilityRole="button">
        {inner}
      </TouchableOpacity>
    );
  }
  return <View style={shellStyle}>{inner}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  left: { flex: 1, minWidth: 0 },
  right: { flexShrink: 0, justifyContent: 'center' },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 8,
    rowGap: 4,
  },
  title: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  description: { fontSize: 13, lineHeight: 18, marginTop: 4 },
});
