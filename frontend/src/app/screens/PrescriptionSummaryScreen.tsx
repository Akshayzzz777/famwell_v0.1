import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { AppScaffold } from '../components/Layout';
import { EmptyCard, ErrorCard, LoadingCard } from '../components/Feedback';
import { Button, Card, Field, SectionTitle } from '../components/Primitives';
import { createRecord, fetchJobResult, type ApiFailure, type JobResultResponse } from '../lib/api';
import { deriveSummaryHighlights, jsonPreview, safePrettyJson } from '../lib/format';
import { theme } from '../lib/theme';
import { useApp } from '../state/AppContext';
import type { ResultScreenProps } from '../navigation';

export function PrescriptionSummaryScreen({ navigation, route }: ResultScreenProps) {
  const { activeJob, selectedRole } = useApp();
  const jobId = route.params?.jobId ?? activeJob?.jobId ?? null;
  const [result, setResult] = useState<JobResultResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiFailure | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [recordType, setRecordType] = useState('prescription_summary');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!jobId) {
      return;
    }

    let mounted = true;

    const loadResult = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetchJobResult(selectedRole, jobId);
        if (mounted) {
          setResult(response);
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

    loadResult();

    return () => {
      mounted = false;
    };
  }, [jobId, selectedRole]);

  const highlights = useMemo(() => deriveSummaryHighlights(result), [result]);
  const summaryText = result?.llm_result?.response || jsonPreview(result?.extracted_data?.data, 240);

  const handleSave = async () => {
    if (!result) {
      return;
    }

    try {
      setSaveState('saving');
      await createRecord(selectedRole, {
        data: {
          job_id: result.job_id,
          note,
          result,
        },
        recordType,
      });
      setSaveState('saved');
    } catch {
      setSaveState('idle');
    }
  };

  return (
    <AppScaffold onBack={navigation.goBack} subtitle={jobId || 'Open a completed review to see the summary.'} title="Prescription Summary">
      {!jobId ? (
        <EmptyCard detail="Upload and review a document first, then return here to view the summary." title="No summary selected" action={<Button label="Go to upload" onPress={() => navigation.replace('UploadDocuments')} />} />
      ) : (
        <>
          {loading ? <LoadingCard label="Loading summary..." /> : null}
          {error ? <ErrorCard message={error.message} title="Summary unavailable" /> : null}

          {result ? (
            <>
              <Card style={styles.heroCard}>
                <SectionTitle detail="A clear readout of the latest document review." eyebrow="Summary" title={summaryText || 'Summary ready'} />
                {highlights.map((item) => (
                  <Card key={item.label} style={styles.highlightItem}>
                    <Text style={styles.highlightLabel}>{item.label}</Text>
                    <Text style={styles.highlightValue}>{item.value}</Text>
                  </Card>
                ))}
              </Card>

              <Card>
                <SectionTitle detail="Add this summary to the record list for later review." eyebrow="Save" title="Add to records" />
                <Field label="Record type" onChangeText={setRecordType} value={recordType} />
                <Field label="Care note" multiline onChangeText={setNote} placeholder="Add context for future review" value={note} />
                <Button label={saveState === 'saved' ? 'Saved to records' : 'Save summary'} loading={saveState === 'saving'} onPress={handleSave} />
              </Card>

              <Card>
                <SectionTitle detail="Structured extracted details." eyebrow="Document details" title="Extracted data" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <Text style={styles.codeBlock}>{safePrettyJson(result.extracted_data?.data ?? {})}</Text>
                </ScrollView>
              </Card>

              <Card>
                <SectionTitle detail="The narrative summary is ready to review." eyebrow="Clinical narrative" title="Summary notes" />
                <Text style={styles.bodyText}>{result.llm_result?.response || 'No summary notes were returned.'}</Text>
              </Card>
            </>
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
  highlightItem: {
    backgroundColor: theme.colors.surfaceAccent,
    gap: 2,
  },
  highlightLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSoft,
  },
  highlightValue: {
    ...theme.typography.bodyStrong,
    color: theme.colors.text,
  },
  bodyText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.md,
  },
  codeBlock: {
    ...theme.typography.caption,
    color: theme.colors.text,
    fontFamily: 'Courier New',
    marginTop: theme.spacing.md,
  },
});
