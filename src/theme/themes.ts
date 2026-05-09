import type { TextStyle } from 'react-native';

/**
 * Color contract: each visual theme (midnight, future light, etc.) provides
 * the same keys with different values. `createAppTheme` turns a palette into
 * spacing, radius, and typography.
 */
export type ThemeColorPalette = {
  background: string;
  surface: string;
  surfaceSoft: string;
  border: string;
  text: string;
  textMuted: string;
  textSoft: string;
  textDim: string;
  textFaint: string;
  textSecondary: string;
  primary: string;
  primaryText: string;
  accent: string;
  accentMuted: string;
  accentLight: string;
  accentSurface: string;
  accentSurfaceBorder: string;
  danger: string;
  dangerMuted: string;
  warning: string;
  success: string;
  borderDanger: string;
  surfaceRaised: string;
  surfaceInset: string;
  borderInner: string;
  borderStrong: string;
  onAccent: string;
  shadow: string;
  backdrop: string;
  backdropHeavy: string;
  backdropModal: string;
};

export type ThemeSpacing = {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
  /** Default horizontal inset for main layouts (replaces repeated 20). */
  gutter: number;
};

export type ThemeRadius = {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  pill: number;
};

export type ThemeTypography = {
  title: TextStyle;
  subtitle: TextStyle;
  heading: TextStyle;
  body: TextStyle;
  small: TextStyle;
  tiny: TextStyle;
};

export type AppTheme = {
  colors: ThemeColorPalette;
  spacing: ThemeSpacing;
  radius: ThemeRadius;
  typography: ThemeTypography;
};

export const midnightMinimalPalette: ThemeColorPalette = {
  background: '#0d0d0d',
  surface: '#1a1a1a',
  surfaceSoft: '#1f1f1f',
  border: '#2a2a2a',
  text: '#f5f5f5',
  textMuted: '#888888',
  textSoft: '#555555',
  textDim: '#444444',
  textFaint: '#333333',
  textSecondary: '#666666',
  primary: '#f5f5f5',
  primaryText: '#0d0d0d',
  accent: '#6366f1',
  accentMuted: '#c7c8ff',
  accentLight: '#8b8cf4',
  accentSurface: '#13132a',
  accentSurfaceBorder: '#2a2a4a',
  danger: '#c0392b',
  dangerMuted: '#8b2e2e',
  warning: '#d4a017',
  success: '#2e6b3e',
  borderDanger: '#3d1a1a',
  surfaceRaised: '#141414',
  surfaceInset: '#111111',
  borderInner: '#222222',
  borderStrong: '#333333',
  onAccent: '#ffffff',
  shadow: '#000000',
  backdrop: 'rgba(0,0,0,0.6)',
  backdropHeavy: 'rgba(0,0,0,0.82)',
  backdropModal: 'rgba(0,0,0,0.65)',
};

const midnightSpacing: ThemeSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 28,
  gutter: 20,
};

const midnightRadius: ThemeRadius = {
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 9999,
};

export function createAppTheme(
  palette: ThemeColorPalette,
  spacing: ThemeSpacing = midnightSpacing,
  radius: ThemeRadius = midnightRadius,
): AppTheme {
  const colors = palette;
  return {
    colors,
    spacing,
    radius,
    typography: {
      title: {
        fontSize: 36,
        fontWeight: '700',
        letterSpacing: -1,
        color: colors.text,
      },
      subtitle: {
        fontSize: 15,
        color: colors.textMuted,
      },
      heading: {
        fontSize: 32,
        fontWeight: '700',
        letterSpacing: -0.5,
        color: colors.text,
      },
      body: {
        fontSize: 16,
        lineHeight: 24,
        color: colors.textMuted,
      },
      small: {
        fontSize: 14,
        color: colors.textMuted,
      },
      tiny: {
        fontSize: 12,
        color: colors.textSoft,
      },
    },
  };
}

/** Registered themes. Add `lightMinimal` here when the light palette is ready. */
export const themes = {
  midnightMinimal: createAppTheme(midnightMinimalPalette),
} as const;

export type ThemeId = keyof typeof themes;

export const theme = themes.midnightMinimal;

/** Future hook for switching: resolveTheme(id: ThemeId) => AppTheme */
