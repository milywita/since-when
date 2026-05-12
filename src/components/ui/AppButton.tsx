import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  type StyleProp,
  type TextStyle,
  type TouchableOpacityProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export type AppButtonProps = Omit<
  TouchableOpacityProps,
  'style' | 'children'
> & {
  title: string;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: TextStyle;
  indicatorColor?: string;
};

export function AppButton({
  title,
  loading,
  disabled,
  style,
  textStyle,
  indicatorColor,
  ...rest
}: AppButtonProps) {
  const { colors: c, radius: r, spacing: sp } = useTheme();
  const resolvedIndicator = indicatorColor ?? c.primaryText;

  return (
    <TouchableOpacity
      style={[
        {
          backgroundColor: c.primary,
          borderRadius: r.sm,
          paddingVertical: 15,
          alignItems: 'center' as const,
          marginTop: sp.xs,
          marginBottom: sp.lg,
        },
        style,
      ]}
      disabled={disabled || loading}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={resolvedIndicator} />
      ) : (
        <Text style={[{ color: c.primaryText, fontSize: 16, fontWeight: '600' as const }, textStyle]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// Keep a static StyleSheet for any consumers that only need the shape (no colors).
export const appButtonBase = StyleSheet.create({
  button: { alignItems: 'center' },
});
