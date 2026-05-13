import React from 'react';
import { Platform, Pressable, Text, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export type ScreenHeaderBackButtonProps = {
  onPress: () => void;
  /** Screen reader label; default is neutral “Go back”. */
  accessibilityLabel?: string;
};

/**
 * Arrow-only back control for {@link ScreenHeader} `leading`.
 * Matches header title scale and stays vertically centered with the title row.
 */
export function ScreenHeaderBackButton({
  onPress,
  accessibilityLabel = 'Go back',
}: ScreenHeaderBackButtonProps) {
  const { colors: c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 12 }}
      style={({ pressed }) => [styles.hit, pressed && styles.pressed]}>
      <View style={styles.glyphWrap}>
        <Text style={[styles.glyph, { color: c.text }]} allowFontScaling={false}>
          ←
        </Text>
      </View>
    </Pressable>
  );
}

/** Match header title cap height (~28); keeps arrow visually centered with the word, not floating low. */
const GLYPH_SIZE = 30;
const TITLE_LINE = 32;

const styles = StyleSheet.create({
  hit: {
    minWidth: 44,
    /** Same vertical span as {@link ScreenHeader} title line — centers tap target on the heading. */
    minHeight: TITLE_LINE,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 0,
  },
  pressed: { opacity: 0.55 },
  glyphWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    height: TITLE_LINE,
    overflow: 'visible',
  },
  glyph: {
    fontSize: GLYPH_SIZE,
    fontWeight: '600',
    lineHeight: TITLE_LINE,
    textAlign: 'center',
    includeFontPadding: false,
    /** ~1px higher than prior nudge. */
    transform: [{ translateY: Platform.OS === 'android' ? -7 : -6 }],
  },
});
