import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomNav } from '../components/BottomNav';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { PrimaryButton } from '../components/PrimaryButton';
import { useJobResult } from '../hooks/useJobResult';
import { mainNavItems } from '../navigation/mainNavItems';
import type { ResultScreenProps } from '../navigation/types';
import { theme } from '../styles/theme';

function buildResultPreview(result: any) {
  if (!result) {
    return [] as string[];
  }

  const preview: string[] = [];

  if (result.extracted_data?.data?.document_type) {
    preview.push(`Document type: ${result.extracted_data.data.document_type}`);
  }

  if (result.llm_result?.model_used) {
    preview.push(`Model: ${result.llm_result.model_used}`);
  }

  if (result.status) {
    preview.push(`Status: ${result.status}`);
  }

  return preview;
}

export function ResultScreen({ navigation, route }: ResultScreenProps) {
  const jobId = route.params?.jobId;
  const { result, loading, error, getResult } = useJobResult();

  useEffect(() => {
    if (!jobId) {
      return;
    }

    getResult(jobId).catch(() => {
      return null;
    });
  }, [getResult, jobId]);

  const previewLines = buildResultPreview(result);
  const summaryText = result?.llm_result?.response ?? null;

  return (
    <View style={styles.screen}>
      <Header backLabel="<" onBack={navigation.goBack} subtitle={jobId ?? 'No job selected'} title="Results" />

      <ScrollView contentContainerStyle={styles.content}>
        {!jobId ? (
          <Card>
            <Text style={styles.sectionLabel}>Empty state</Text>
            <Text style={styles.helperText}>No job ID was provided to the result screen.</Text>
          </Card>
        ) : null}

        {jobId ? (
          <Card style={styles.heroCard}>
            <Text style={styles.heroLabel}>Result endpoint</Text>
            <Text style={styles.heroTitle}>{result ? 'Live result ready' : 'Waiting for result'}</Text>
            <Text style={styles.heroText}>{summaryText ?? 'No result payload has been returned yet.'}</Text>
          </Card>
        ) : null}

        {result && previewLines.length > 0 ? (
          <Card>
            <Text style={styles.sectionLabel}>Preview</Text>
            <View style={styles.previewList}>
              {previewLines.map((line) => (
                <Text key={line} style={styles.previewLine}>
                  {line}
                </Text>
              ))}
            </View>
          </Card>
        ) : null}

        {jobId && !loading && !error && !result ? (
          <Card>
            <Text style={styles.sectionLabel}>Empty state</Text>
            <Text style={styles.helperText}>The result endpoint returned no body for this job.</Text>
          </Card>
        ) : null}

        {result ? (
          <Card>
            <Text style={styles.sectionLabel}>Raw summary</Text>
            <Text style={styles.rawText}>{JSON.stringify(result, null, 2)}</Text>
          </Card>
        ) : null}

        {error ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorLabel}>Result error</Text>
            <Text style={styles.errorText}>{error.message}</Text>
            {error.retryable ? (
              <View style={styles.retryWrap}>
                <PrimaryButton
                  label="Retry"
                  onPress={() => {
                    if (jobId) {
                      getResult(jobId).catch(() => {
                        return null;
                      });
                    }
                  }}
                  variant="secondary"
                />
              </View>
            ) : null}
          </Card>
        ) : null}

        <PrimaryButton
          disabled={!jobId}
          label="Refresh Result"
          loading={loading}
          onPress={() => {
            if (jobId) {
              getResult(jobId).catch(() => {
                return null;
              });
            }
          }}
        />
      </ScrollView>

      <BottomNav activeRoute="ResultScreen" items={mainNavItems} onNavigate={(target) => navigation.navigate(target)} />
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
  heroCard: {
    backgroundColor: theme.colors.brand.blue50,
    borderColor: theme.colors.brand.blue100,
  },
  heroLabel: {
    ...theme.typography.caption,
    color: theme.colors.brand.blue500,
  },
  heroTitle: {
    ...theme.typography.heading,
    color: theme.colors.neutrals.textPrimary,
    marginTop: theme.spacing[3],
  },
  heroText: {
    ...theme.typography.body,
    color: theme.colors.neutrals.textMuted,
    marginTop: theme.spacing[2],
  },
  sectionLabel: {
    ...theme.typography.caption,
    color: theme.colors.neutrals.textMuted,
  },
  helperText: {
    ...theme.typography.body,
    color: theme.colors.neutrals.textMuted,
    marginTop: theme.spacing[3],
  },
  previewList: {
    marginTop: theme.spacing[3],
    gap: theme.spacing[3],
  },
  previewLine: {
    ...theme.typography.body,
    color: theme.colors.neutrals.textBody,
  },
  rawText: {
    ...theme.typography.label,
    color: theme.colors.neutrals.textMuted,
    marginTop: theme.spacing[3],
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
  retryWrap: {
    marginTop: theme.spacing[4],
  },
});
