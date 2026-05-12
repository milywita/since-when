import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export type AppCardProps = {
  children: React.ReactNode;
  style?: ViewStyle;
};

export function AppCard({ children, style }: AppCardProps) {
  const { colors: c, radius: r, spacing: sp } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderRadius: r.md,
          borderWidth: 1,
          borderColor: c.border,
          padding: sp.lg,
        },
        style,
      ]}>
      {children}
    </View>
  );
}
