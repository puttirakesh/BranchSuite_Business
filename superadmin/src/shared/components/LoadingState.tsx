import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { radius } from '../../theme/tokens';

/** Pulsing placeholder block used by skeleton layouts. */
export function Skeleton({ height = 80, style }: { height?: number; style?: object }) {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[styles.skeleton, { height, opacity }, style]} />;
}

/** Stack of skeleton cards shown while a list loads. */
export function LoadingList({ rows = 3, height = 82 }: { rows?: number; height?: number }) {
  return (
    <View accessibilityLabel="Loading" accessibilityRole="progressbar" style={{ gap: 10 }}>
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} height={height} />)}
    </View>
  );
}

/** Alias matching the original project naming. */
export const LoadingState = LoadingList;

const styles = StyleSheet.create({ skeleton: { backgroundColor: '#ECE9F6', borderRadius: radius.card } });
