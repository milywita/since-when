import React from 'react';
import { View, type ViewStyle } from 'react-native';
import {
  SafeAreaView,
  type Edge,
} from 'react-native-safe-area-context';
import { theme } from '../../theme/themes';

export type ScreenProps = {
  children: React.ReactNode;
  /** Outer container style (background is applied by default). */
  style?: ViewStyle;
  /** When true, wraps children in SafeAreaView with optional edges. */
  safeArea?: boolean;
  edges?: Edge[];
};

/**
 * Full-screen wrapper with theme background. Optional safe area insets.
 */
export function Screen({
  children,
  style,
  safeArea,
  edges = ['top', 'bottom'],
}: ScreenProps) {
  const base: ViewStyle = {
    flex: 1,
    backgroundColor: theme.colors.background,
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
