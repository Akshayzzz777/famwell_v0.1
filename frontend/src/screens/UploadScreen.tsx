import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomNav } from '../components/BottomNav';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { PrimaryButton } from '../components/PrimaryButton';
import { useFileUpload } from '../hooks/useFileUpload';
import { mainNavItems } from '../navigation/mainNavItems';
import type { UploadScreenProps } from '../navigation/types';
import { theme } from '../styles/theme';

export function UploadScreen({ navigation }: UploadScreenProps) {
  const { uploadFile, loading, error } = useFileUpload();
  const [latestFileName, setLatestFileName] = useState<string | null>(null);

  const handleUpload = async () => {
    try {
      const response = await uploadFile();
      if (!response) {
        return;
      }

      setLatestFileName(response.filename);
      navigation.navigate('StatusScreen', {
        jobId: response.job_id,
        fileName: response.filename,
      });
    } catch {
      // Error state is rendered below.
    }
  };

  return (
    <View style={styles.screen}>
      <Header backLabel="<" onBack={navigation.goBack} title="Upload Documents" />

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.heroCard}>
          <Text style={styles.heroTitle}>Send a document to FamWell</Text>
          <Text style={styles.heroText}>
            This screen is connected to the existing upload API. In Expo development mode the picker returns mock PDF metadata.
          </Text>
          <PrimaryButton label="Upload PDF" loading={loading} onPress={handleUpload} />
        </Card>

        <Card>
          <Text style={styles.sectionLabel}>Endpoint</Text>
          <Text style={styles.endpointValue}>upload</Text>
          <Text style={styles.helperText}>
            The backend integration remains unchanged and still uses the current multipart upload flow.
          </Text>
        </Card>

        <Card>
          <Text style={styles.sectionLabel}>Latest file</Text>
          <Text style={styles.helperText}>{latestFileName ?? 'Placeholder: no file uploaded in this session.'}</Text>
        </Card>

        {error ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorLabel}>Upload error</Text>
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}
      </ScrollView>

      <BottomNav
        activeRoute="UploadScreen"
        items={mainNavItems}
        onNavigate={(route) => navigation.navigate(route)}
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
  heroCard: {
    gap: theme.spacing[4],
    backgroundColor: theme.colors.brand.blue50,
    borderColor: theme.colors.brand.blue100,
  },
  heroTitle: {
    ...theme.typography.heading,
    color: theme.colors.neutrals.textPrimary,
  },
  heroText: {
    ...theme.typography.body,
    color: theme.colors.neutrals.textMuted,
  },
  sectionLabel: {
    ...theme.typography.caption,
    color: theme.colors.neutrals.textMuted,
  },
  endpointValue: {
    ...theme.typography.subheading,
    color: theme.colors.brand.blue500,
    marginTop: theme.spacing[2],
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
