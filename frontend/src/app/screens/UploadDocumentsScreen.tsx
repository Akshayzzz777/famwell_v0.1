import React from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { StyleSheet, Text, View } from 'react-native';

import { AppScaffold } from '../components/Layout';
import { Button, Card, SectionTitle } from '../components/Primitives';
import { theme } from '../lib/theme';
import { useApp } from '../state/AppContext';
import type { UploadDocumentsProps } from '../navigation';

export function UploadDocumentsScreen({ navigation }: UploadDocumentsProps) {
  const { activeJob, pendingUpload, setPendingUpload } = useApp();

  const handlePick = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: 'application/pdf',
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const asset = result.assets[0] as DocumentPicker.DocumentPickerAsset & { file?: File | null };
    setPendingUpload({
      file: asset.file ?? null,
      mimeType: asset.mimeType || 'application/pdf',
      name: asset.name,
      size: asset.size,
      uri: asset.uri,
    });
    navigation.navigate('UploadDocumentsUpdated');
  };

  return (
    <AppScaffold activeRoute="UploadDocuments" onBack={navigation.goBack} onNavigate={(route) => navigation.navigate(route)} subtitle="Choose a PDF and send it for review." title="Upload Documents">
      <Card style={styles.heroCard}>
        <SectionTitle detail="Select a prescription or supporting document to continue." eyebrow="Step 1" title="Choose a PDF" />
        <Text style={styles.bodyText}>Your file stays attached to the guided upload flow and can be reviewed before sending.</Text>
        <Button label="Select PDF" onPress={handlePick} />
      </Card>

      {pendingUpload ? (
        <Card>
          <SectionTitle detail="A document is ready to review." eyebrow="Selected" title={pendingUpload.name} />
          <Text style={styles.bodyText}>{pendingUpload.size ? `${Math.round(pendingUpload.size / 1024)} KB` : 'Size unavailable'}</Text>
          <Button label="Review selected file" onPress={() => navigation.navigate('UploadDocumentsUpdated')} variant="secondary" />
        </Card>
      ) : null}

      {activeJob ? (
        <Card>
          <SectionTitle detail={activeJob.fileName || 'A recent upload is still in progress.'} eyebrow="In progress" title="Resume processing" />
          <View style={styles.actionRow}>
            <Button label="Check status" onPress={() => navigation.navigate('StatusScreen', { fileName: activeJob.fileName, jobId: activeJob.jobId })} />
            <Button label="Open summary" onPress={() => navigation.navigate('ResultScreen', { jobId: activeJob.jobId })} variant="secondary" />
          </View>
        </Card>
      ) : null}
    </AppScaffold>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: theme.spacing.md,
  },
  bodyText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  actionRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
});
