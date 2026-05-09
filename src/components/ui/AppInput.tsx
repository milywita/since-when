import React from 'react';
import {
  Platform,
  StyleSheet,
  TextInput,
  type TextInputProps,
  type TextStyle,
} from 'react-native';
import { theme } from '../../theme/themes';

export type AppInputProps = TextInputProps & {
  /** Merged after themed input styles. */
  style?: TextStyle;
};

/**
 * Text field styled like auth screens. Supports all TextInput props and style overrides.
 */
export function AppInput({ style, placeholderTextColor, ...rest }: AppInputProps) {
  return (
    <TextInput
      placeholderTextColor={
        placeholderTextColor ?? theme.colors.textSecondary
      }
      style={[baseInputStyles.input, style]}
      {...rest}
    />
  );
}

const baseInputStyles = StyleSheet.create({
  input: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
});

/** Username setup uses slightly larger type and vertical padding on iOS. */
export function usernameInputStyle(): TextStyle {
  return {
    borderRadius: theme.radius.md,
    paddingVertical: Platform.OS === 'ios' ? theme.spacing.lg : 13,
    fontSize: 18,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.sm,
  };
}
