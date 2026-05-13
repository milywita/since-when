import React from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export type SettingsOptionRowProps = {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  showDivider?: boolean;
};

/** Single selectable option (e.g. reminder preset). */
export function SettingsOptionRow({
  title,
  description,
  selected,
  onPress,
  showDivider = true,
}: SettingsOptionRowProps) {
  const { colors: c, spacing: sp } = useTheme();
  return (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.row,
        {
          paddingVertical: sp.md,
          paddingHorizontal: sp.lg,
          borderBottomWidth: showDivider ? StyleSheet.hairlineWidth : 0,
          borderBottomColor: c.border,
        },
      ]}>
      <View style={styles.left}>
        <Text style={[styles.title, { color: c.text }]}>{title}</Text>
        {description ? (
          <Text style={[styles.description, { color: c.textSoft }]}>{description}</Text>
        ) : null}
      </View>
      <View
        style={[
          styles.radio,
          {
            borderColor: selected ? c.accent : c.borderStrong,
            backgroundColor: selected ? c.accent : 'transparent',
          },
        ]}>
        {selected ? <View style={[styles.dot, { backgroundColor: c.onAccent }]} /> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  left: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: '600' },
  description: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
