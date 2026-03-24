import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppScaffold } from '../components/Layout';
import { EmptyCard, ErrorCard, LoadingCard } from '../components/Feedback';
import { Button, Card, Pill, SectionTitle } from '../components/Primitives';
import { fetchJobStatus, type ApiFailure, type JobStatusResponse } from '../lib/api';
import { formatDate, titleCase } from '../lib/format';
import { theme } from '../lib/theme';
import { useApp } from '../state/AppContext';
import type { StatusScreenProps } from '../navigation';

export function StatusScreen({ navigation, route }: StatusScreenProps) {
  const { activeJob, selectedRole, setActiveJob } = useApp();
  const jobId = route.params?.jobId ?? activeJob?.jobId ?? null;
  const fileName = route.params?.fileName ?? activeJob?.fileName ?? null;
  const [status, setStatus] = useState<JobStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiFailure | null>(null);
  const [refreshSeed, setRefreshSeed] = useState(0);

  useEffect(() => {
    if (!jobId) {
      return;
    }

    let mounted = true;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const poll = async () => {
      try {
        if (mounted) {
          setLoading(true);
          setError(null);
        }

        const response = await fetchJobStatus(selectedRole, jobId);
        if (!mounted) {
          return;
        }

        setStatus(response);
        setActiveJob({
          fileId: response.file_id,
          fileName: fileName ?? activeJob?.fileName,
          jobId: response.job_id,
          uploadUrl: activeJob?.uploadUrl,
        });

        if (response.status === 'COMPLETED' || response.status === 'FAILED') {
          if (intervalId) {
            clearInterval(intervalId);
          }
        }
      } catch (failure) {
        if (mounted) {
          setError(failure as ApiFailure);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    poll();
    intervalId = setInterval(poll, 3000);

    return () => {
      mounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [activeJob?.fileName, activeJob?.uploadUrl, fileName, jobId, refreshSeed, selectedRole, setActiveJob]);

  const progress = Math.max(status?.progress ?? 0, status ? 8 : 0);
  const statusTone = status?.status === 'COMPLETED' ? 'success' : status?.status === 'FAILED' ? 'danger' : 'warning';

  return (
    <AppScaffold onBack={navigation.goBack} subtitle={fileName || 'Track the current document review.'} title="Processing Status">
      {!jobId ? (
        <EmptyCard detail="Upload a document first to start a review." title="No active job" action={<Button label="Go to upload" onPress={() => navigation.replace('UploadDocuments')} />} />
      ) : (
        <>
          <Card style={styles.heroCard}>
            <SectionTitle detail={jobId} eyebrow="Current status" title={status ? titleCase(status.status) : 'Checking status'} />
            <Pill label={status ? titleCase(status.status) : 'Checking'} tone={statusTone} />
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressLabel}>{status?.progress ?? 0}% complete</Text>
            {status?.error_message ? <Text style={styles.errorCopy}>{status.error_message}</Text> : null}
          </Card>

          {loading && !status ? <LoadingCard label="Refreshing status..." /> : null}
          {error ? <ErrorCard message={error.message} onRetry={() => setRefreshSeed((value) => value + 1)} title="Status unavailable" /> : null}

          {status ? (
            <Card>
              <SectionTitle detail={fileName || 'Current document'} eyebrow="Timeline" title="Processing details" />
              <View style={styles.timelineRow}>
                <Text style={styles.timelineLabel}>Created</Text>
                <Text style={styles.timelineValue}>{formatDate(status.created_at)}</Text>
              </View>
              <View style={styles.timelineRow}>
                <Text style={styles.timelineLabel}>Started</Text>
                <Text style={styles.timelineValue}>{formatDate(status.started_at)}</Text>
              </View>
              <View style={styles.timelineRow}>
                <Text style={styles.timelineLabel}>Completed</Text>
                <Text style={styles.timelineValue}>{formatDate(status.completed_at)}</Text>
              </View>
              <View style={styles.buttonRow}>
                <Button label="Refresh" onPress={() => setRefreshSeed((value) => value + 1)} variant="secondary" />
                <Button disabled={status.status !== 'COMPLETED'} label="Open summary" onPress={() => navigation.navigate('ResultScreen', { jobId })} />
              </View>
            </Card>
          ) : null}
        </>
      )}
    </AppScaffold>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: theme.spacing.md,
  },
  progressTrack: {
    height: 14,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAccent,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
  },
  progressLabel: {
    ...theme.typography.bodyStrong,
    color: theme.colors.text,
  },
  errorCopy: {
    ...theme.typography.caption,
    color: theme.colors.danger,
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  timelineLabel: {
    ...theme.typography.body,
    color: theme.colors.textSoft,
  },
  timelineValue: {
    ...theme.typography.bodyStrong,
    color: theme.colors.text,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
    marginTop: theme.spacing.md,
  },
});
