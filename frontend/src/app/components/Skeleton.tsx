import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';

function SkeletonPulse({ style }: { style?: ViewStyle }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return <Animated.View style={[styles.bone, style, { opacity }]} />;
}

export function DashboardSkeleton() {
  return (
    <View style={styles.container}>
      {/* Health Score Card */}
      <View style={styles.card}>
        <View style={styles.row}>
          <SkeletonPulse style={{ width: 140, height: 16, borderRadius: 8 }} />
          <SkeletonPulse style={{ width: 50, height: 16, borderRadius: 8 }} />
        </View>
        <View style={[styles.row, { height: 80, marginTop: 12, gap: 6, alignItems: 'flex-end' }]}>
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonPulse key={i} style={{ flex: 1, height: 20 + Math.random() * 50, borderRadius: 6 }} />
          ))}
        </View>
      </View>
      {/* Health Summary Card */}
      <View style={styles.card}>
        <View style={styles.row}>
          <SkeletonPulse style={{ width: 120, height: 14, borderRadius: 7 }} />
          <SkeletonPulse style={{ width: 50, height: 20, borderRadius: 10 }} />
        </View>
        <View style={[styles.row, { marginTop: 16, gap: 16 }]}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 8 }}>
              <SkeletonPulse style={{ width: 20, height: 20, borderRadius: 10 }} />
              <SkeletonPulse style={{ width: 50, height: 10, borderRadius: 5 }} />
              <SkeletonPulse style={{ width: 40, height: 18, borderRadius: 9 }} />
              <SkeletonPulse style={{ width: 50, height: 10, borderRadius: 5 }} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export function InsightsSkeleton() {
  return (
    <View style={styles.container}>
      {/* Chart card */}
      <View style={styles.card}>
        <View style={styles.row}>
          <SkeletonPulse style={{ width: 140, height: 16, borderRadius: 8 }} />
          <SkeletonPulse style={{ width: 60, height: 20, borderRadius: 10 }} />
        </View>
        <View style={[styles.row, { height: 80, marginTop: 12, gap: 6, alignItems: 'flex-end' }]}>
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonPulse key={i} style={{ flex: 1, height: 20 + Math.random() * 50, borderRadius: 6 }} />
          ))}
        </View>
      </View>
      {/* Metric card */}
      <View style={[styles.card, { paddingVertical: 14 }]}>
        <View style={styles.row}>
          <SkeletonPulse style={{ width: 20, height: 20, borderRadius: 10 }} />
          <SkeletonPulse style={{ width: 100, height: 18, borderRadius: 9 }} />
          <SkeletonPulse style={{ width: 80, height: 34, borderRadius: 12, marginLeft: 'auto' }} />
        </View>
      </View>
      {/* Stress card */}
      <View style={styles.card}>
        <SkeletonPulse style={{ width: 100, height: 14, borderRadius: 7 }} />
        <SkeletonPulse style={{ width: 60, height: 28, borderRadius: 14, marginTop: 8 }} />
        <SkeletonPulse style={{ width: '100%', height: 6, borderRadius: 3, marginTop: 8 }} />
        <SkeletonPulse style={{ width: '70%', height: 12, borderRadius: 6, marginTop: 8 }} />
      </View>
      {/* Insight cards */}
      {[1, 2].map((i) => (
        <View key={i} style={styles.card}>
          <SkeletonPulse style={{ width: 60, height: 12, borderRadius: 6 }} />
          <SkeletonPulse style={{ width: '80%', height: 14, borderRadius: 7, marginTop: 8 }} />
          <SkeletonPulse style={{ width: '100%', height: 12, borderRadius: 6, marginTop: 6 }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bone: {
    backgroundColor: '#E8ECE8',
  },
});
