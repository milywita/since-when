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
import { theme } from '../../theme/themes';

export type AppButtonProps = Omit<
  TouchableOpacityProps,
  'style' | 'children'
> & {
  title: string;
  loading?: boolean;
  /** Merged after base button styles. */
  style?: StyleProp<ViewStyle>;
  textStyle?: TextStyle;
  indicatorColor?: string;
};

/**
 * Primary filled button matching auth CTAs (light fill on dark background).
 */
export function AppButton({
  title,
  loading,
  disabled,
  style,
  textStyle,
  indicatorColor = theme.colors.primaryText,
  ...rest
}: AppButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, style]}
      disabled={disabled || loading}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={indicatorColor} />
      ) : (
        <Text style={[styles.label, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  label: {
    color: theme.colors.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
});
