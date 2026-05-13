import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export type SettingsPillOptionProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Stretch to parent width and center label (e.g. equal-width grid cells). */
  fillCell?: boolean;
  /** Tighter padding and type for dense grids (e.g. tone picker). */
  compact?: boolean;
};

/** Compact selectable chip (e.g. sarcasm level). */
export function SettingsPillOption({
  label,
  selected,
  onPress,
  fillCell,
  compact,
}: SettingsPillOptionProps) {
  const { colors: c, radius: r } = useTheme();
  const dense = Boolean(fillCell && compact);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.pill,
        fillCell && (dense ? styles.pillFillCellCompact : styles.pillFillCell),
        {
          borderRadius: r.sm,
          borderColor: selected ? c.primary : c.border,
          backgroundColor: selected ? c.primary : 'transparent',
          paddingVertical: dense ? 6 : fillCell ? 10 : 7,
          paddingHorizontal: dense ? 6 : fillCell ? 10 : 13,
        },
      ]}
      activeOpacity={0.75}>
      <Text
        style={[
          styles.label,
          dense && styles.labelCompact,
          fillCell && styles.labelFillCell,
          { color: selected ? c.primaryText : c.textMuted, fontWeight: selected ? '600' : '500' },
        ]}
        numberOfLines={dense ? 1 : 2}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: { borderWidth: 1 },
  pillFillCell: {
    width: '100%',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillFillCellCompact: {
    width: '100%',
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 13 },
  labelCompact: { fontSize: 12 },
  labelFillCell: { textAlign: 'center' },
});
