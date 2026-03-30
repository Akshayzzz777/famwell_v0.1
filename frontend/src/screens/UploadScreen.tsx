import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

import { BottomNav } from '../components/BottomNav';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { LoadingDots } from '../components/LoadingDots';
import { PrimaryButton } from '../components/PrimaryButton';
import { SectionContainer } from '../components/SectionContainer';
import { useRole } from '../context/RoleContext';
import { mainNavItems } from '../navigation/mainNavItems';
import type { UploadScreenProps } from '../navigation/types';
import {
  analyzeMedicalRecord,
  fetchMedicalRecords,
  uploadMedicalRecord,
  type HealthAnalysis,
  type MedicalRecordItem,
} from '../services/api';
import { theme } from '../styles/theme';

export function UploadScreen({ navigation }: UploadScreenProps) {
  const { selectedRole } = useRole();
  const [uploading, setUploading] = useState(false);
  const [records, setRecords] = useState<MedicalRecordItem[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<HealthAnalysis | null>(null);

  const loadRecords = useCallback(async () => {
    try {
      setLoadingRecords(true);
      const data = await fetchMedicalRecords(selectedRole);
      setRecords(data.records);
    } catch {
      // Ignore
    } finally {
      setLoadingRecords(false);
    }
  }, [selectedRole]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handlePickAndUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      setUploading(true);

      await uploadMedicalRecord(
        selectedRole,
        { name: asset.name, type: asset.mimeType || 'application/pdf', uri: asset.uri },
        'general',
      );

      Alert.alert('Success', 'Document uploaded successfully.');
      await loadRecords();
    } catch (err: any) {
      Alert.alert('Upload Failed', err?.message || 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyze = async (recordId: string) => {
    try {
      setAnalyzingId(recordId);
      setAnalysisResult(null);
      const analysis = await analyzeMedicalRecord(selectedRole, recordId);
      setAnalysisResult(analysis);
    } catch (err: any) {
      Alert.alert('Analysis Failed', err?.message || 'Failed to analyze record.');
    } finally {
      setAnalyzingId(null);
    }
  };

  return (
    <View style={styles.screen}>
      <Header backLabel="<" onBack={navigation.goBack} title="Upload Documents" />

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.heroCard}>
          <Text style={styles.heroTitle}>Upload Medical Document</Text>
          <Text style={styles.heroText}>
            Select a PDF from your device. FamWell stores the file and can analyze it on demand using AI.
          </Text>
          <PrimaryButton
            label="Choose PDF & Upload"
            onPress={handlePickAndUpload}
            loading={uploading}
            disabled={uploading}
          />
        </Card>

        {/* Analysis Result */}
        {analysisResult && (
          <Card style={styles.analysisCard}>
            <Text style={styles.analysisTitle}>Health Analysis</Text>
            {analysisResult.health_score != null && (
              <Text style={styles.healthScore}>
                Health Score: {analysisResult.health_score}/100
              </Text>
            )}
            {analysisResult.insights.length > 0 && (
              <View style={styles.analysisSection}>
                <Text style={styles.analysisSectionTitle}>Insights</Text>
                {analysisResult.insights.map((insight, i) => (
                  <Text key={i} style={styles.analysisBullet}>• {typeof insight === 'object' && 'description' in insight ? insight.description : String(insight)}</Text>
                ))}
              </View>
            )}
            {analysisResult.risks.length > 0 && (
              <View style={styles.analysisSection}>
                <Text style={styles.analysisSectionTitle}>Risks</Text>
                {analysisResult.risks.map((risk, i) => (
                  <Text key={i} style={styles.analysisBullet}>• {risk}</Text>
                ))}
              </View>
            )}
            {analysisResult.recommendations.length > 0 && (
              <View style={styles.analysisSection}>
                <Text style={styles.analysisSectionTitle}>Recommendations</Text>
                {analysisResult.recommendations.map((rec, i) => (
                  <Text key={i} style={styles.analysisBullet}>• {typeof rec === 'object' && 'description' in rec ? rec.description : String(rec)}</Text>
                ))}
              </View>
            )}
          </Card>
        )}

        {/* Records List */}
        <SectionContainer title={`Your Records (${records.length})`}>
          {loadingRecords ? (
            <View style={styles.loadingContainer}>
              <LoadingDots />
            </View>
          ) : records.length === 0 ? (
            <Text style={styles.emptyText}>No uploaded records yet.</Text>
          ) : (
            records.map((record) => (
              <Card key={record.medical_record_id} style={styles.recordCard}>
                <View style={styles.recordRow}>
                  <View style={styles.recordInfo}>
                    <Text style={styles.recordName} numberOfLines={1}>
                      {record.file_name}
                    </Text>
                    <Text style={styles.recordMeta}>
                      {record.record_type} · {new Date(record.upload_date).toLocaleDateString()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.analyzeButton, analyzingId === record.medical_record_id && styles.analyzingButton]}
                    onPress={() => handleAnalyze(record.medical_record_id)}
                    disabled={analyzingId === record.medical_record_id}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.analyzeButtonText}>
                      {analyzingId === record.medical_record_id ? 'Analyzing...' : 'Analyze'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))
          )}
        </SectionContainer>
      </ScrollView>

      <BottomNav activeRoute="UploadScreen" items={mainNavItems} onNavigate={(route) => navigation.navigate(route)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.neutrals.background,
  },
  content: {
    paddingHorizontal: theme.spacing[4],
    paddingTop: theme.spacing[4],
    paddingBottom: theme.spacing[20] + theme.spacing[4],
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
  loadingContainer: {
    paddingTop: theme.spacing[6],
    alignItems: 'center',
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.neutrals.textMuted,
    textAlign: 'center',
    paddingTop: theme.spacing[4],
  },
  recordCard: {
    marginBottom: theme.spacing[3],
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
  },
  recordInfo: {
    flex: 1,
  },
  recordName: {
    ...theme.typography.label,
    color: theme.colors.neutrals.textPrimary,
  },
  recordMeta: {
    ...theme.typography.caption,
    color: theme.colors.neutrals.textMuted,
    marginTop: theme.spacing[1],
  },
  analyzeButton: {
    backgroundColor: theme.colors.brand.teal500,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
  },
  analyzingButton: {
    opacity: 0.5,
  },
  analyzeButtonText: {
    ...theme.typography.caption,
    color: theme.colors.white,
  },
  analysisCard: {
    gap: theme.spacing[3],
    backgroundColor: theme.colors.brand.teal50,
    borderColor: theme.colors.brand.teal100,
  },
  analysisTitle: {
    ...theme.typography.subheading,
    color: theme.colors.neutrals.textPrimary,
  },
  healthScore: {
    ...theme.typography.heading,
    color: theme.colors.brand.teal700,
  },
  analysisSection: {
    gap: theme.spacing[1],
  },
  analysisSectionTitle: {
    ...theme.typography.label,
    color: theme.colors.neutrals.textPrimary,
  },
  analysisBullet: {
    ...theme.typography.body,
    color: theme.colors.neutrals.textMuted,
    paddingLeft: theme.spacing[2],
  },
});

