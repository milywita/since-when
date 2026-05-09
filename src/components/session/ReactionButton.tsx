import React from 'react';
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { theme } from '../../theme/themes';

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
  const isFocus = variant === 'focus';
  return (
    <TouchableOpacity
      style={[isFocus ? styles.focus : styles.default, style]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}>
      <Text style={isFocus ? styles.textFocus : styles.textDefault}>{label}</Text>
    </TouchableOpacity>
  );
}

const c = theme.colors;
const sp = theme.spacing;

const styles = StyleSheet.create({
  default: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginTop: 2,
  },
  textDefault: {
    color: c.textSoft,
    fontSize: 12,
  },
  focus: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: c.accentSurfaceBorder,
    paddingVertical: sp.xs,
    paddingHorizontal: 10,
  },
  textFocus: {
    color: c.accent,
    fontSize: 12,
  },
});
