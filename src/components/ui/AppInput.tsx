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
  const { colors: c, radius: r, spacing: sp, typography: t } = useTheme();
  const { color: _bodyColor, ...bodyType } = t.body;

  const base: TextStyle = {
    ...bodyType,
    color: c.text,
    fontWeight: '400',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    letterSpacing: 3,
    backgroundColor: c.surface,
    borderRadius: r.sm,
    paddingHorizontal: sp.lg,
    paddingVertical: 14,
    marginBottom: sp.md,
    borderWidth: 1,
    borderColor: c.border,
  };

  if (Platform.OS === 'android') {
    base.includeFontPadding = false;
  }

  return (
    <TextInput
      placeholderTextColor={placeholderTextColor ?? c.textSecondary}
      style={[base, style]}
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
