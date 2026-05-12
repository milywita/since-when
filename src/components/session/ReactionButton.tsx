import React from 'react';
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export type ReactionButtonVariant = 'default' | 'focus';

export type ReactionButtonProps = {
  onPress: () => void;
  label?: string;
  variant?: ReactionButtonVariant;
  disabled?: boolean;
  hitSlop?: number;
  style?: StyleProp<ViewStyle>;
};

export function ReactionButton({
  onPress,
  label = 'React',
  variant = 'default',
  disabled,
  hitSlop = 8,
  style,
}: ReactionButtonProps) {
  const { colors: c, spacing: sp } = useTheme();
  const isFocus = variant === 'focus';

  return (
    <TouchableOpacity
      style={[
        styles.base,
        isFocus
          ? { borderColor: c.accentSurfaceBorder, paddingHorizontal: 10, paddingVertical: sp.xs }
          : { borderColor: c.border, paddingHorizontal: 10, paddingVertical: 5, marginTop: 2 },
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}>
      <Text style={[styles.text, { color: isFocus ? c.accent : c.textSoft }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: 6, borderWidth: 1 },
  text: { fontSize: 12 },
});
