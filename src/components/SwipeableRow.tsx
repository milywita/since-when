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
import { useTheme } from '../theme/ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DELETE_THRESHOLD = SCREEN_WIDTH * 0.35;

type Props = {
  children: React.ReactNode;
  onDelete: () => void;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

export function SwipeableRow({ children, onDelete, borderRadius = 12, style }: Props) {
  const { colors: c } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;

  /** Hide danger layer at rest so layout gaps / radius mismatch never flash red. */
  const deleteBgOpacity = translateX.interpolate({
    inputRange: [-SCREEN_WIDTH, -10, 0],
    outputRange: [1, 1, 0],
    extrapolate: 'clamp',
  });

  const panResponder = useRef(
    PanResponder.create({
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
          Animated.timing(translateX, {
            toValue: -SCREEN_WIDTH,
            duration: 180,
            useNativeDriver: true,
          }).start(() => onDelete());
        } else {
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
    <View style={[styles.root, { borderRadius }, style]}>
      <Animated.View
        style={[
          styles.background,
          { borderRadius, backgroundColor: c.danger, opacity: deleteBgOpacity },
        ]}
        pointerEvents="none">
        <TrashIcon color={c.onAccent} />
      </Animated.View>
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

function TrashIcon({ color }: { color: string }) {
  return (
    <View style={icon.wrap}>
      <View style={[icon.handle, { backgroundColor: color }]} />
      <View style={[icon.lid, { backgroundColor: color }]} />
      <View style={[icon.body, { borderColor: color }]}>
        <View style={[icon.line, { backgroundColor: color }]} />
        <View style={[icon.line, { backgroundColor: color }]} />
        <View style={[icon.line, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 22,
  },
});

const icon = StyleSheet.create({
  wrap: { width: 22, alignItems: 'center', rowGap: 2 },
  handle: { width: 8, height: 3, borderRadius: 1.5 },
  lid: { width: 18, height: 3, borderRadius: 1.5 },
  body: {
    width: 16,
    height: 14,
    borderRadius: 2,
    borderWidth: 2,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingTop: 2,
  },
  line: { width: 2, height: 8, borderRadius: 1 },
});
