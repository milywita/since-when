import React from 'react';
import { View, Text, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

/** Keep two-line overdue stacks from shrinking when digits change. */
const TWO_LINE_MIN_HEIGHT_QUEUE = 40;
const TWO_LINE_MIN_HEIGHT_COMPACT = 38;
const TWO_LINE_MIN_HEIGHT_FOCUS = 52;

export type TimerEstimateDensity = 'queue' | 'sessionSq' | 'focusHero' | 'partnerFocus' | 'partnerRow';

export type TimerEstimateBlockProps = {
  elapsedLabel: string;
  /** Includes `est.` or `over by` prefix; `null` hides the estimate line. */
  secondaryLabel: string | null;
  isOverEstimate: boolean;
  density: TimerEstimateDensity;
  elapsedColor: string;
  secondaryMutedColor: string;
  overdueSecondaryColor: string;
};

const densityStyles = StyleSheet.create({
  queueElapsed: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  queueSecondary: { fontSize: 12, fontVariant: ['tabular-nums'] },
  sessionElapsed: { fontSize: 12, fontWeight: '500', fontVariant: ['tabular-nums'] },
  sessionSecondary: { fontSize: 11, fontVariant: ['tabular-nums'] },
  focusElapsed: { fontSize: 16, fontWeight: '500', fontVariant: ['tabular-nums'] },
  focusSecondary: { fontSize: 12, fontVariant: ['tabular-nums'] },
  partnerFocusElapsed: { fontSize: 13, fontVariant: ['tabular-nums'] },
  partnerFocusSecondary: { fontSize: 11, fontVariant: ['tabular-nums'] },
  partnerRowElapsed: { fontSize: 12, fontVariant: ['tabular-nums'] },
  partnerRowSecondary: { fontSize: 11, fontVariant: ['tabular-nums'] },
  rowWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    flexWrap: 'nowrap',
  },
  overdueStackQueue: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    minHeight: TWO_LINE_MIN_HEIGHT_QUEUE,
    gap: 2,
    alignSelf: 'flex-start',
  },
  overdueStackCompact: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    minHeight: TWO_LINE_MIN_HEIGHT_COMPACT,
    gap: 2,
    alignSelf: 'flex-start',
  },
  overdueStackFocus: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    minHeight: TWO_LINE_MIN_HEIGHT_FOCUS,
    gap: 4,
    alignSelf: 'flex-start',
  },
});

function pickDense(density: TimerEstimateDensity): {
  elapsed: TextStyle;
  secondary: TextStyle;
  row: ViewStyle;
  overdueStack: ViewStyle;
} {
  switch (density) {
    case 'sessionSq':
      return {
        elapsed: densityStyles.sessionElapsed,
        secondary: densityStyles.sessionSecondary,
        row: densityStyles.rowWrap,
        overdueStack: densityStyles.overdueStackCompact,
      };
    case 'focusHero':
      return {
        elapsed: densityStyles.focusElapsed,
        secondary: densityStyles.focusSecondary,
        row: densityStyles.rowWrap,
        overdueStack: densityStyles.overdueStackFocus,
      };
    case 'partnerFocus':
      return {
        elapsed: densityStyles.partnerFocusElapsed,
        secondary: densityStyles.partnerFocusSecondary,
        row: densityStyles.rowWrap,
        overdueStack: densityStyles.overdueStackCompact,
      };
    case 'partnerRow':
      return {
        elapsed: densityStyles.partnerRowElapsed,
        secondary: densityStyles.partnerRowSecondary,
        row: densityStyles.rowWrap,
        overdueStack: densityStyles.overdueStackCompact,
      };
    case 'queue':
    default:
      return {
        elapsed: densityStyles.queueElapsed,
        secondary: densityStyles.queueSecondary,
        row: densityStyles.rowWrap,
        overdueStack: densityStyles.overdueStackQueue,
      };
  }
}

/**
 * Stable timer row: overdue state uses a fixed-height two-line stack so seconds updates
 * do not collapse/expand card height when text length changes.
 */
export function TimerEstimateBlock({
  elapsedLabel,
  secondaryLabel,
  isOverEstimate,
  density,
  elapsedColor,
  secondaryMutedColor,
  overdueSecondaryColor,
}: TimerEstimateBlockProps) {
  const d = pickDense(density);

  if (secondaryLabel === null) {
    return (
      <Text style={[d.elapsed, { color: elapsedColor }]} numberOfLines={1}>
        {elapsedLabel}
      </Text>
    );
  }

  if (isOverEstimate) {
    return (
      <View style={d.overdueStack}>
        <Text style={[d.elapsed, { color: elapsedColor }]} numberOfLines={1}>
          {elapsedLabel}
        </Text>
        <Text
          style={[d.secondary, { color: overdueSecondaryColor }]}
          numberOfLines={1}>
          {secondaryLabel}
        </Text>
      </View>
    );
  }

  return (
    <View style={d.row}>
      <Text style={[d.elapsed, { color: elapsedColor }]} numberOfLines={1}>
        {elapsedLabel}
      </Text>
      <Text style={[d.secondary, { color: secondaryMutedColor }]} numberOfLines={1}>
        {secondaryLabel}
      </Text>
    </View>
  );
}
