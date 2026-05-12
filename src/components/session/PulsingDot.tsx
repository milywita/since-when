import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export function PulsingDot() {
  const { colors: c, spacing: sp } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.5, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale, opacity]);

  return (
    <Animated.View
      style={[
        {
          width: sp.sm,
          height: sp.sm,
          borderRadius: sp.xs,
          backgroundColor: c.accent,
        },
        { transform: [{ scale }], opacity },
      ]}
    />
  );
}
