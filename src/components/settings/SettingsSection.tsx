import React from 'react';
import { View } from 'react-native';
import { SectionTitle } from '../layout/SectionTitle';
import { AppCard } from '../ui/AppCard';
import { useTheme } from '../../theme/ThemeContext';

export type SettingsSectionProps = {
  title: string;
  description?: string;
  /** Shown in the header next to the title (e.g. work-in-progress). */
  titleNote?: string;
  children: React.ReactNode;
};

/**
 * Groups settings rows inside a card with a section heading.
 * TODO: Replace local section copy with i18n keys if the app adds translations.
 */
export function SettingsSection({ title, description, titleNote, children }: SettingsSectionProps) {
  const { spacing: sp } = useTheme();
  return (
    <View style={{ marginBottom: sp.lg, paddingHorizontal: sp.gutter }}>
      <SectionTitle
        title={title}
        titleNote={titleNote}
        subtitle={description}
        style={{ marginBottom: sp.md }}
      />
      <AppCard style={{ padding: 0, overflow: 'hidden' }}>{children}</AppCard>
    </View>
  );
}
