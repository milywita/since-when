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
  /** Active / live session green band (rejoin banner). */
  liveSessionBg: string;
  liveSessionBorder: string;
  liveSessionText: string;
  liveSessionTextMuted: string;
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
  /** Brighter periwinkle for borders and controls on dark tint panels. */
  accentLight: '#a3a6ff',
  /** Focus panels — a touch lighter so tint reads as a soft wash, not a heavy block. */
  accentSurface: '#242448',
  accentSurfaceBorder: '#4a4d9e',
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
  liveSessionBg: '#0d1f0d',
  liveSessionBorder: '#1e4d1e',
  liveSessionText: '#4ade80',
  liveSessionTextMuted: '#a7f3c0',
};

/**
 * Pastel light palette — "Lavender Cloud".
 * Soft lavender backgrounds, deep-indigo text, same indigo accent family.
 */
export const pastelLightPalette: ThemeColorPalette = {
  /** Page wash — clearly lavender, not near-white. */
  background: '#e9e3f7',
  /** Cards / panels — soft purple-white instead of pure #fff. */
  surface: '#f5f2fc',
  surfaceSoft: '#ebe4f8',
  border: '#d6cef0',
  text: '#1c1740',
  textMuted: '#5c5688',
  textSoft: '#8a84b0',
  textDim: '#a8a2c8',
  textFaint: '#c4bedc',
  textSecondary: '#6f68a0',
  primary: '#1c1740',
  primaryText: '#f7f6ff',
  /** Same indigo-periwinkle as dark theme — reads bluish, not magenta-purple. */
  accent: '#6366f1',
  accentMuted: '#c7c8ff',
  /** Saturated enough to read on very light lavender surfaces. */
  accentLight: '#6e72f5',
  /** Chips, session focus — airy wash; pair with `accent` borders for separation from page. */
  accentSurface: '#f1edfa',
  accentSurfaceBorder: '#a69fe0',
  /** Classic saturated red on light surfaces (timers, swipe delete, overdue border). */
  danger: '#d32f2f',
  dangerMuted: '#e57373',
  warning: '#c97c00',
  success: '#2e7d52',
  borderDanger: '#c62828',
  surfaceRaised: '#faf8ff',
  surfaceInset: '#e4dcf5',
  borderInner: '#e2daf2',
  borderStrong: '#b4aad8',
  onAccent: '#ffffff',
  shadow: '#c0bce0',
  backdrop: 'rgba(28, 23, 64, 0.11)',
  backdropHeavy: 'rgba(28, 23, 64, 0.34)',
  backdropModal: 'rgba(28, 23, 64, 0.13)',
  liveSessionBg: '#e8fdf0',
  liveSessionBorder: '#a8e6c4',
  liveSessionText: '#1e6e40',
  liveSessionTextMuted: '#2e9058',
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

export const themes = {
  midnightMinimal: createAppTheme(midnightMinimalPalette),
  pastelLight: createAppTheme(pastelLightPalette),
} as const;

export type ThemeId = keyof typeof themes;

/** Fallback static reference kept for non-component usages (spacing / radius lookups). */
export const theme = themes.midnightMinimal;
