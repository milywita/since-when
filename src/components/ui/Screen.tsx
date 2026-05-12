import React from 'react';
import { View, type ViewStyle } from 'react-native';
import {
  SafeAreaView,
  type Edge,
} from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';

export type ScreenProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  safeArea?: boolean;
  edges?: Edge[];
};

export function Screen({
  children,
  style,
  safeArea,
  edges = ['top', 'bottom'],
}: ScreenProps) {
  const { colors: c } = useTheme();
  const base: ViewStyle = {
    flex: 1,
    backgroundColor: c.background,
  };

  if (safeArea) {
    return (
      <SafeAreaView style={[base, style]} edges={edges}>
        {children}
      </SafeAreaView>
    );
  }

  return <View style={[base, style]}>{children}</View>;
}
