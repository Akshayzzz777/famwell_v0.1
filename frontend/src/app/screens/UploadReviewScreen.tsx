import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { AppScaffold } from '../components/Layout';
import { EmptyCard, ErrorCard } from '../components/Feedback';
import { Button, Card, SectionTitle } from '../components/Primitives';
import { uploadPdf, type ApiFailure } from '../lib/api';
import { theme } from '../lib/theme';
import { useApp } from '../state/AppContext';
import type { UploadReviewProps } from '../navigation';
import { Alert } from 'react-native';

export function UploadReviewScreen({ navigation }: UploadReviewProps) {
  const { pendingUpload, selectedRole, setPendingUpload } = useApp();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiFailure | null>(null);

  const handleUpload = async () => {
    if (!pendingUpload) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const response = await uploadPdf(selectedRole, pendingUpload);
      setPendingUpload(null);

      // Invalidate all cached health data so insights refetch with the new record
      queryClient.invalidateQueries({ queryKey: ['healthData'] });

      Alert.alert(
        'Upload Successful',
        `"${response.file_name}" uploaded. Your health insights are being analyzed — they'll be ready in a moment.`,
        [
          { text: 'View Insights', onPress: () => navigation.replace('AIInsights') },
          { text: 'Upload More', onPress: () => navigation.replace('UploadDocuments') },
        ],
      );
    } catch (failure) {
      console.error('[UploadReview] upload failed:', JSON.stringify(failure));
      setError(failure as ApiFailure);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppScaffold  subtitle="Review the selected file before sending it." title="Upload Documents">
      {!pendingUpload ? (
        <EmptyCard detail="Choose a document from the upload screen to continue." title="No file selected" action={<Button label="Back to upload" onPress={() => navigation.replace('UploadDocuments')} />} />
      ) : (
        <>
          <Card style={styles.summaryCard}>
            <SectionTitle detail="Confirm the selected file and continue when youre ready." eyebrow="Step 2" title={pendingUpload.name} />
            <View style={styles.detailRow}>
              <SectionTitle eyebrow="Format" title="PDF" />
              <SectionTitle eyebrow="Size" title={pendingUpload.size ? `${Math.round(pendingUpload.size / 1024)} KB` : 'Unavailable'} />
            </View>
            <View style={styles.buttonRow}>
              <Button label="Replace file" onPress={() => navigation.replace('UploadDocuments')} variant="secondary" disabled={submitting} />
              <Button label={submitting ? 'Uploading & Analyzing...' : 'Upload now'} loading={submitting} onPress={handleUpload} disabled={submitting} />
            </View>
          </Card>

          {error ? <ErrorCard message={error.message} onRetry={handleUpload} title="Upload failed" /> : null}
        </>
      )}
    </AppScaffold>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    gap: theme.spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    flexWrap: 'wrap',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
});
