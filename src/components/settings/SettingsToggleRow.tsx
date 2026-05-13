import React from 'react';
import { Switch } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { SettingsRow } from './SettingsRow';

export type SettingsToggleRowProps = {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  showDivider?: boolean;
  /** TODO: Wire to real settings store / notification permissions. */
  accessibilityLabel?: string;
  /** Optional (i) modal with longer explanation next to the title. */
  infoHint?: { title: string; body: string };
};

export function SettingsToggleRow({
  title,
  description,
  value,
  onValueChange,
  showDivider = true,
  accessibilityLabel,
  infoHint,
}: SettingsToggleRowProps) {
  const { colors: c } = useTheme();
  return (
    <SettingsRow
      title={title}
      description={description}
      infoHint={infoHint}
      showDivider={showDivider}
      right={
        <Switch
          accessibilityLabel={accessibilityLabel ?? title}
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: c.borderStrong, true: c.accent }}
          thumbColor={c.surfaceRaised}
          ios_backgroundColor={c.borderStrong}
        />
      }
    />
  );
}
