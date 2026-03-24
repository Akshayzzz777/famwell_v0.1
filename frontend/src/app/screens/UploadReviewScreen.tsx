import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppScaffold } from '../components/Layout';
import { EmptyCard, ErrorCard } from '../components/Feedback';
import { Button, Card, SectionTitle } from '../components/Primitives';
import { uploadPdf, type ApiFailure } from '../lib/api';
import { theme } from '../lib/theme';
import { useApp } from '../state/AppContext';
import type { UploadReviewProps } from '../navigation';

export function UploadReviewScreen({ navigation }: UploadReviewProps) {
  const { pendingUpload, selectedRole, setActiveJob, setPendingUpload } = useApp();
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
      setActiveJob({
        fileId: response.file_id,
        fileName: response.filename,
        jobId: response.job_id,
        uploadUrl: response.upload_url,
      });
      setPendingUpload(null);
      navigation.replace('StatusScreen', { fileName: response.filename, jobId: response.job_id });
    } catch (failure) {
      setError(failure as ApiFailure);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppScaffold onBack={navigation.goBack} subtitle="Review the selected file before sending it." title="Upload Documents Updated">
      {!pendingUpload ? (
        <EmptyCard detail="Choose a document from the upload screen to continue." title="No file selected" action={<Button label="Back to upload" onPress={() => navigation.replace('UploadDocuments')} />} />
      ) : (
        <>
          <Card style={styles.summaryCard}>
            <SectionTitle detail="Confirm the selected file and continue when you’re ready." eyebrow="Step 2" title={pendingUpload.name} />
            <View style={styles.detailRow}>
              <SectionTitle eyebrow="Format" title="PDF" />
              <SectionTitle eyebrow="Size" title={pendingUpload.size ? `${Math.round(pendingUpload.size / 1024)} KB` : 'Unavailable'} />
            </View>
            <View style={styles.buttonRow}>
              <Button label="Replace file" onPress={() => navigation.replace('UploadDocuments')} variant="secondary" />
              <Button label="Upload now" loading={submitting} onPress={handleUpload} />
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
