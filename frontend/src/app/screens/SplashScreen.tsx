import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../lib/theme';

export function SplashScreen({ onFinished }: { onFinished: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onFinished, 1400);
    return () => clearTimeout(timer);
  }, [onFinished]);

  return (
    <View style={styles.screen}>
      <View style={styles.heroOrb} />
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Prescription Summary</Text>
        <Text style={styles.title}>FamWell</Text>
        <Text style={styles.subtitle}>Care coordination, records, uploads, and insights in one calm mobile workspace.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  heroOrb: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: theme.colors.primarySoft,
    top: 90,
    opacity: 0.9,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.xxl,
    gap: theme.spacing.sm,
  },
  eyebrow: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    textTransform: 'uppercase',
  },
  title: {
    ...theme.typography.display,
    color: theme.colors.text,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
});
