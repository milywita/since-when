import React, { useRef } from 'react';
import {
  Animated,
  PanResponder,
  View,
  StyleSheet,
  Dimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DELETE_THRESHOLD = SCREEN_WIDTH * 0.35;

type Props = {
  children: React.ReactNode;
  onDelete: () => void;
  /**
   * Should match the card's own borderRadius so the red background's
   * corners align with the card when it is revealed.
   */
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

export function SwipeableRow({ children, onDelete, borderRadius = 12, style }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      // Only claim the gesture for clear leftward horizontal moves.
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        dx < -8 && Math.abs(dx) > Math.abs(dy) * 1.5,
      onPanResponderGrant: () => {
        translateX.stopAnimation();
      },
      onPanResponderMove: (_, { dx }) => {
        if (dx < 0) { translateX.setValue(dx); }
      },
      onPanResponderRelease: (_, { dx, vx }) => {
        if (dx < -DELETE_THRESHOLD || vx < -0.8) {
          // Swiped far enough or fast enough → fly off and delete.
          Animated.timing(translateX, {
            toValue: -SCREEN_WIDTH,
            duration: 180,
            useNativeDriver: true,
          }).start(() => onDelete());
        } else {
          // Snap back.
          Animated.spring(translateX, {
            toValue: 0,
            tension: 80,
            friction: 12,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  return (
    // No overflow:hidden — combining it with borderRadius on Android causes
    // absolutely-positioned children to ignore clipping and appear on screen.
    // The card's own solid background colour fully covers the red layer at rest;
    // swiping left slides the card away and physically reveals the red beneath.
    <View style={style}>
      {/* ── Red reveal layer — always behind the card ── */}
      <View style={[styles.background, { borderRadius }]} pointerEvents="none">
        <TrashIcon />
      </View>

      {/* ── Card — rendered after background → naturally on top ── */}
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

// ─── Trash-can icon (pure Views, no library needed) ────────────────────────

function TrashIcon() {
  return (
    <View style={icon.wrap}>
      <View style={icon.handle} />
      <View style={icon.lid} />
      <View style={icon.body}>
        <View style={icon.line} />
        <View style={icon.line} />
        <View style={icon.line} />
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  background: {
    // absoluteFillObject covers the same space as the card above it.
    // It is rendered FIRST in JSX so it sits below the card in z-order.
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#c0392b',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 22,
  },
});

const icon = StyleSheet.create({
  wrap: {
    width: 22,
    alignItems: 'center',
    rowGap: 2,
  },
  handle: {
    width: 8,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#fff',
  },
  lid: {
    width: 18,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#fff',
  },
  body: {
    width: 16,
    height: 14,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingTop: 2,
  },
  line: {
    width: 2,
    height: 8,
    borderRadius: 1,
    backgroundColor: '#fff',
  },
});
