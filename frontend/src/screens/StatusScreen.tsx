import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomNav } from '../components/BottomNav';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { PrimaryButton } from '../components/PrimaryButton';
import { useJobStatus } from '../hooks/useJobStatus';
import { placeholderStatus } from '../data/mockData';
import { mainNavItems } from '../navigation/mainNavItems';
import type { StatusScreenProps } from '../navigation/types';
import { theme } from '../styles/theme';

export function StatusScreen({ navigation, route }: StatusScreenProps) {
  const jobId = route.params?.jobId ?? null;
  const fileName = route.params?.fileName;
  const { status, loading, error } = useJobStatus(jobId);

  const statusLabel = status?.status ?? placeholderStatus.status;
  const progress = status?.progress ?? placeholderStatus.progress;
  const statusNote =
    jobId && status
      ? 'Live data from the status API. Polling continues until the job completes or fails.'
      : placeholderStatus.note;

  return (
    <View style={styles.screen}>
      <Header
        backLabel="<"
        onBack={navigation.goBack}
        subtitle={jobId ?? 'No active job'}
        title="Processing Status"
      />

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.summaryCard}>
          <Text style={styles.statusCaption}>{loading ? 'Refreshing' : 'Current status'}</Text>
          <Text style={styles.statusValue}>{statusLabel}</Text>
          <Text style={styles.statusNote}>{statusNote}</Text>
        </Card>

        <Card>
          <Text style={styles.sectionLabel}>Progress</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(progress, 8)}%` }]} />
          </View>
          <Text style={styles.progressText}>{progress}% complete</Text>
        </Card>

        <Card>
          <Text style={styles.sectionLabel}>Source</Text>
          <Text style={styles.helperText}>status</Text>
          <Text style={styles.helperText}>
            File: {fileName ?? 'Placeholder: no uploaded file linked to this screen yet.'}
          </Text>
        </Card>

        {error ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorLabel}>Status error</Text>
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        <PrimaryButton
          disabled={!jobId}
          label="View Result"
          onPress={() => navigation.navigate('ResultScreen', { jobId: jobId ?? undefined })}
          variant="secondary"
        />
      </ScrollView>

      <BottomNav
        activeRoute="StatusScreen"
        items={mainNavItems}
        onNavigate={(target) => navigation.navigate(target)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.neutrals.background,
  },
  content: {
    paddingHorizontal: theme.spacing[6],
    paddingTop: theme.spacing[6],
    paddingBottom: theme.layout.bottomNavHeight + theme.spacing[6],
    gap: theme.spacing[5],
  },
  summaryCard: {
    backgroundColor: theme.colors.brand.teal50,
    borderColor: theme.colors.brand.teal100,
  },
  statusCaption: {
    ...theme.typography.caption,
    color: theme.colors.brand.teal700,
  },
  statusValue: {
    ...theme.typography.heading,
    color: theme.colors.neutrals.textPrimary,
    marginTop: theme.spacing[3],
  },
  statusNote: {
    ...theme.typography.body,
    color: theme.colors.neutrals.textMuted,
    marginTop: theme.spacing[2],
  },
  sectionLabel: {
    ...theme.typography.caption,
    color: theme.colors.neutrals.textMuted,
  },
  progressTrack: {
    height: 14,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.neutrals.border,
    marginTop: theme.spacing[4],
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.brand.teal500,
  },
  progressText: {
    ...theme.typography.label,
    color: theme.colors.neutrals.textBody,
    marginTop: theme.spacing[3],
  },
  helperText: {
    ...theme.typography.body,
    color: theme.colors.neutrals.textMuted,
    marginTop: theme.spacing[2],
  },
  errorCard: {
    borderColor: theme.colors.accent.rose,
    backgroundColor: theme.colors.accent.redSoft,
  },
  errorLabel: {
    ...theme.typography.bodyStrong,
    color: theme.colors.accent.rose,
  },
  errorText: {
    ...theme.typography.body,
    color: theme.colors.neutrals.textBody,
    marginTop: theme.spacing[2],
  },
});
