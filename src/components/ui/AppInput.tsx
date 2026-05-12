import React from 'react';
import {
  Platform,
  TextInput,
  type TextInputProps,
  type TextStyle,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { theme as staticTheme } from '../../theme/themes';

export type AppInputProps = TextInputProps & {
  style?: TextStyle;
};

export function AppInput({ style, placeholderTextColor, ...rest }: AppInputProps) {
  const { colors: c, radius: r, spacing: sp } = useTheme();
  return (
    <TextInput
      placeholderTextColor={placeholderTextColor ?? c.textSecondary}
      style={[
        {
          backgroundColor: c.surface,
          color: c.text,
          borderRadius: r.sm,
          paddingHorizontal: sp.lg,
          paddingVertical: 14,
          fontSize: 16,
          marginBottom: sp.md,
          borderWidth: 1,
          borderColor: c.border,
        },
        style,
      ]}
      {...rest}
    />
  );
}

/** Username setup uses slightly larger type; spacing values are theme-agnostic. */
export function usernameInputStyle(): TextStyle {
  const { radius: r, spacing: sp } = staticTheme;
  return {
    borderRadius: r.md,
    paddingVertical: Platform.OS === 'ios' ? sp.lg : 13,
    fontSize: 18,
    marginBottom: sp.md,
    marginTop: sp.sm,
  };
}
