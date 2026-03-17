import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { theme } from '../styles/theme';

export function LoadingDots() {
  const first = useRef(new Animated.Value(0.4)).current;
  const second = useRef(new Animated.Value(0.4)).current;
  const third = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animateDot = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 450,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0.4,
            duration: 450,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

    const animations = [animateDot(first, 0), animateDot(second, 150), animateDot(third, 300)];
    animations.forEach((animation) => animation.start());

    return () => {
      animations.forEach((animation) => animation.stop());
    };
  }, [first, second, third]);

  return (
    <View style={styles.row}>
      {[first, second, third].map((value, index) => (
        <Animated.View
          key={String(index)}
          style={[
            styles.dot,
            {
              opacity: value,
              transform: [
                {
                  translateY: value.interpolate({
                    inputRange: [0.4, 1],
                    outputRange: [0, -6],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: theme.spacing[2],
  },
  dot: {
    width: theme.spacing[2],
    height: theme.spacing[2],
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.brand.blue500,
  },
});
