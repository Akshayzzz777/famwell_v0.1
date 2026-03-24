import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { theme } from '../lib/theme';
import { Card, Button } from './Primitives';

export function LoadingCard({ label }: { label: string }) {
  return (
    <Card style={styles.centerCard}>
      <ActivityIndicator color={theme.colors.primary} />
      <Text style={styles.bodyText}>{label}</Text>
    </Card>
  );
}

export function EmptyCard({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return (
    <Card style={styles.centerCard}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.bodyText}>{detail}</Text>
      {action}
    </Card>
  );
}

export function ErrorCard({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Card style={styles.errorCard}>
      <Text style={styles.errorTitle}>{title}</Text>
      <Text style={styles.bodyText}>{message}</Text>
      {onRetry ? <Button label="Retry" onPress={onRetry} variant="secondary" /> : null}
    </Card>
  );
}

export function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centerCard: {
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  title: {
    ...theme.typography.subheading,
    color: theme.colors.text,
  },
  bodyText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  errorCard: {
    gap: theme.spacing.md,
    borderColor: theme.colors.danger,
    backgroundColor: theme.colors.dangerSoft,
  },
  errorTitle: {
    ...theme.typography.subheading,
    color: theme.colors.danger,
  },
  stat: {
    minWidth: 92,
    gap: 2,
  },
  statValue: {
    ...theme.typography.heading,
    color: theme.colors.text,
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSoft,
  },
});
