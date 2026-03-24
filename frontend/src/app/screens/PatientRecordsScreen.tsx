import React, { startTransition, useCallback, useDeferredValue, useMemo, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import {
  Pressable,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav } from '../components/Layout';
import { fetchRecords, uploadPdf, type ApiFailure, type RecordItem } from '../lib/api';
import { formatDate, jsonPreview, titleCase } from '../lib/format';
import { theme } from '../lib/theme';
import { useApp } from '../state/AppContext';
import type { PatientRecordsProps } from '../navigation';

type FilterKey = 'all' | 'lab' | 'imaging' | 'vaccines';

type DisplayRecord = {
  id: string;
  title: string;
  subtitle: string;
  preview: string;
  status: {
    label: string;
    bg: string;
    fg: string;
  };
  accent: {
    bg: string;
    fg: string;
    icon: string;
    family: 'MaterialIcons' | 'MaterialCommunityIcons';
  };
  highlighted?: boolean;
  onView?: () => void;
  isSynthetic?: boolean;
  raw?: RecordItem;
};

function mapFilter(recordType: string): FilterKey {
  const value = recordType.toLowerCase();
  if (value.includes('lab') || value.includes('blood') || value.includes('test')) {
    return 'lab';
  }
  if (value.includes('xray') || value.includes('x-ray') || value.includes('scan') || value.includes('imaging') || value.includes('radiology')) {
    return 'imaging';
  }
  if (value.includes('vaccine') || value.includes('vaccin') || value.includes('immun')) {
    return 'vaccines';
  }
  return 'all';
}

function recordAccent(recordType: string) {
  const value = recordType.toLowerCase();
  if (value.includes('lab') || value.includes('blood') || value.includes('test')) {
    return {
      bg: '#D6EED7',
      fg: theme.colors.primary,
      icon: 'bloodtype',
      family: 'MaterialIcons' as const,
    };
  }
  if (value.includes('xray') || value.includes('x-ray') || value.includes('scan') || value.includes('imaging') || value.includes('radiology')) {
    return {
      bg: '#FFD9E2',
      fg: '#953359',
      icon: 'x-ray',
      family: 'MaterialCommunityIcons' as const,
    };
  }
  if (value.includes('vaccine') || value.includes('vaccin') || value.includes('immun')) {
    return {
      bg: '#C6E9BD',
      fg: '#476643',
      icon: 'vaccines',
      family: 'MaterialIcons' as const,
    };
  }
  if (value.includes('prescription') || value.includes('med')) {
    return {
      bg: '#FFFFFF',
      fg: theme.colors.primary,
      icon: 'prescriptions',
      family: 'MaterialCommunityIcons' as const,
    };
  }
  return {
    bg: '#D6EED7',
    fg: theme.colors.primary,
    icon: 'description',
    family: 'MaterialIcons' as const,
  };
}

function recordStatus(recordType: string) {
  const value = recordType.toLowerCase();
  if (value.includes('prescription')) {
    return { label: 'New', bg: theme.colors.primary, fg: theme.colors.white };
  }
  if (value.includes('imaging') || value.includes('xray') || value.includes('x-ray')) {
    return { label: 'Pending Review', bg: '#FCE9B1', fg: '#8A5A00' };
  }
  if (value.includes('vaccine') || value.includes('immun')) {
    return { label: 'Archived', bg: '#E2E8F0', fg: '#64748B' };
  }
  if (value.includes('uploaded_pdf')) {
    return { label: 'Uploaded', bg: '#DCFCE7', fg: '#166534' };
  }
  return { label: 'Processed', bg: '#DCFCE7', fg: '#166534' };
}

function providerText(record: RecordItem) {
  const data = record.data as Record<string, unknown>;
  return String(data.provider || data.doctor || data.hospital || data.source || 'FamWell Records');
}

export function PatientRecordsScreen({ navigation }: PatientRecordsProps) {
  const { activeJob, currentUser, pendingUpload, selectedRole, setActiveJob, setPendingUpload } = useApp();
  const insets = useSafeAreaInsets();
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<ApiFailure | null>(null);
  const [query, setQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterKey>('all');
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [hiddenRecordIds, setHiddenRecordIds] = useState<string[]>([]);
  const deferredQuery = useDeferredValue(query);

  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const payload = await fetchRecords(selectedRole);
      setRecords(payload.records ?? []);
    } catch (failure) {
      setError(failure as ApiFailure);
    } finally {
      setLoading(false);
    }
  }, [selectedRole]);

  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, [loadRecords])
  );

  const handleDirectUpload = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: 'application/pdf',
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const asset = result.assets[0] as DocumentPicker.DocumentPickerAsset & { file?: File | null };
    const pickedFile = {
      file: asset.file ?? null,
      mimeType: asset.mimeType || 'application/pdf',
      name: asset.name,
      size: asset.size,
      uri: asset.uri,
    };

    setPendingUpload(pickedFile);

    try {
      setUploading(true);
      setError(null);
      const response = await uploadPdf(selectedRole, pickedFile);
      setPendingUpload(null);
      setActiveJob({
        fileId: response.file_id,
        fileName: response.filename,
        jobId: response.job_id,
        uploadUrl: response.upload_url,
      });
    } catch (failure) {
      setError(failure as ApiFailure);
    } finally {
      setUploading(false);
    }
  }, [selectedRole, setActiveJob, setPendingUpload]);

  const tryOpenUrl = useCallback(async (url?: string | null) => {
    if (!url) {
      return false;
    }

    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        return false;
      }
      await Linking.openURL(url);
      return true;
    } catch {
      return false;
    }
  }, []);

  const handleOpenUploadedPdf = useCallback(async () => {
    if (activeJob?.uploadUrl) {
      const opened = await tryOpenUrl(activeJob.uploadUrl);
      if (opened) {
        return;
      }
    }

    if (pendingUpload?.uri) {
      const opened = await tryOpenUrl(pendingUpload.uri);
      if (opened) {
        return;
      }
    }

    if (activeJob?.jobId) {
      navigation.navigate('StatusScreen', { fileName: activeJob.fileName, jobId: activeJob.jobId });
    }
  }, [activeJob?.fileName, activeJob?.jobId, activeJob?.uploadUrl, navigation, pendingUpload?.uri, tryOpenUrl]);

  const filteredRecords = useMemo(() => {
    const search = deferredQuery.trim().toLowerCase();
    return records.filter((record) => {
      if (hiddenRecordIds.includes(record.record_id)) {
        return false;
      }

      if (selectedFilter !== 'all' && mapFilter(record.record_type) !== selectedFilter) {
        return false;
      }

      if (!search) {
        return true;
      }

      const haystack = `${record.record_type} ${JSON.stringify(record.data)}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [deferredQuery, hiddenRecordIds, records, selectedFilter]);

  const displayRecords = useMemo<DisplayRecord[]>(() => {
    const items: DisplayRecord[] = [];

    if (pendingUpload && !activeJob?.jobId && !hiddenRecordIds.includes(`pending-${pendingUpload.name}`)) {
      items.push({
        id: `pending-${pendingUpload.name}`,
        title: pendingUpload.name || 'Selected PDF',
        subtitle: 'Just selected from device',
        preview: 'Your PDF has been selected on this phone and is being prepared for upload.',
        status: { label: uploading ? 'Uploading' : 'Selected', bg: '#E2E8F0', fg: '#475569' },
        accent: {
          bg: '#D6EED7',
          fg: theme.colors.primary,
          icon: 'upload-file',
          family: 'MaterialIcons',
        },
        highlighted: true,
        isSynthetic: true,
        onView: () => {
          void handleOpenUploadedPdf();
        },
      });
    }

    if (activeJob?.jobId && !hiddenRecordIds.includes(activeJob.jobId)) {
      items.push({
        id: activeJob.jobId,
        title: activeJob.fileName || 'Uploaded PDF',
        subtitle: 'Today � Uploaded from device',
        preview: 'Your uploaded PDF is queued in the current session and ready for processing status checks.',
        status: recordStatus('uploaded_pdf'),
        accent: {
          bg: '#D6EED7',
          fg: theme.colors.primary,
          icon: 'upload-file',
          family: 'MaterialIcons',
        },
        highlighted: true,
        isSynthetic: true,
        onView: () => {
          void handleOpenUploadedPdf();
        },
      });
    }

    filteredRecords.forEach((record) => {
      items.push({
        id: record.record_id,
        title: titleCase(record.record_type),
        subtitle: `${formatDate(record.updated_at)} � ${providerText(record)}`,
        preview: jsonPreview(record.data, expandedRecordId === record.record_id ? 500 : 90),
        status: recordStatus(record.record_type),
        accent: recordAccent(record.record_type),
        highlighted: record.record_type.toLowerCase().includes('prescription'),
        raw: record,
      });
    });

    return items;
  }, [activeJob, expandedRecordId, filteredRecords, handleOpenUploadedPdf, hiddenRecordIds, navigation, pendingUpload, uploading]);

  const filterItems: Array<{ key: FilterKey; label: string }> = [
    { key: 'all', label: 'All Files' },
    { key: 'lab', label: 'Lab Reports' },
    { key: 'imaging', label: 'Imaging' },
    { key: 'vaccines', label: 'Vaccines' },
  ];

  const handleDeleteRecord = useCallback(
    (record: DisplayRecord) => {
      setHiddenRecordIds((current) => (current.includes(record.id) ? current : [...current, record.id]));
      if (record.isSynthetic) {
        if (record.id === activeJob?.jobId) {
          setActiveJob(null);
        }
        if (record.id === `pending-${pendingUpload?.name}`) {
          setPendingUpload(null);
        }
      } else if (record.raw) {
        setRecords((current) => current.filter((item) => item.record_id !== record.raw?.record_id));
      }
    },
    [activeJob?.jobId, pendingUpload?.name, setActiveJob, setPendingUpload]
  );

  const topBarHeight = insets.top + 74;

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { height: topBarHeight, paddingTop: insets.top + 10 }]}> 
        <View style={styles.brandWrap}>
          <View style={styles.brandAvatar}>
            <Text style={styles.brandAvatarText}>{(currentUser?.fullName || currentUser?.email || 'F').trim().charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.brandTitle}>FamWell</Text>
        </View>
        <Pressable style={styles.iconButton}>
          <MaterialIcons color={theme.colors.textMuted} name="notifications-none" size={20} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: topBarHeight + 26,
          paddingBottom: insets.bottom + 118,
          paddingHorizontal: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <Text style={styles.eyebrow}>Health Repository</Text>
          <Text style={styles.title}>Medical Records</Text>
        </View>

        <View style={styles.searchWrap}>
          <MaterialIcons color="#707A6C" name="search" size={18} style={styles.searchIcon} />
          <TextInput
            onChangeText={(value) => startTransition(() => setQuery(value))}
            placeholder="Search by test or doctor"
            placeholderTextColor="#8B9489"
            style={styles.searchInput}
            value={query}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {filterItems.map((item) => {
            const active = item.key === selectedFilter;
            return (
              <Pressable
                key={item.key}
                onPress={() => setSelectedFilter(item.key)}
                style={[styles.filterChip, active ? styles.filterChipActive : styles.filterChipIdle]}
              >
                <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : styles.filterChipTextIdle]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.uploadCta}>
          <Text style={styles.uploadCtaTitle}>Add records with PDF uploads only</Text>
          <Text style={styles.uploadCtaText}>Choose a PDF directly from your phone to add a new medical record.</Text>
          <Pressable disabled={uploading} onPress={handleDirectUpload} style={[styles.uploadCtaButton, uploading && styles.uploadButtonDisabled]}>
            <Text style={styles.uploadCtaButtonText}>{uploading ? 'Uploading...' : 'Upload PDF'}</Text>
          </Pressable>
        </View>

        <View style={styles.recordList}>
          {loading ? (
            <Text style={styles.emptyText}>Loading records...</Text>
          ) : displayRecords.length === 0 ? (
            <Text style={styles.emptyText}>No data found</Text>
          ) : (
            displayRecords.map((record) => {
              const expanded = expandedRecordId === record.id;
              return (
                <View key={record.id} style={[styles.recordCard, record.highlighted && styles.recordCardHighlight]}>
                  <View style={styles.recordCardHeader}>
                    <View style={styles.recordMainInfo}>
                      <View style={[styles.recordIconWrap, { backgroundColor: record.accent.bg }]}> 
                        {record.accent.family === 'MaterialCommunityIcons' ? (
                          <MaterialCommunityIcons color={record.accent.fg} name={record.accent.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']} size={22} />
                        ) : (
                          <MaterialIcons color={record.accent.fg} name={record.accent.icon as React.ComponentProps<typeof MaterialIcons>['name']} size={22} />
                        )}
                      </View>
                      <View style={styles.recordTextWrap}>
                        <Text style={styles.recordTitle}>{record.title}</Text>
                        <Text style={styles.recordMeta}>{record.subtitle}</Text>
                      </View>
                    </View>
                    <View style={styles.recordHeaderActions}>
                      <View style={[styles.statusBadge, { backgroundColor: record.status.bg }]}> 
                        <Text style={[styles.statusText, { color: record.status.fg }]}>{record.status.label}</Text>
                      </View>
                      <Pressable onPress={() => handleDeleteRecord(record)} style={styles.deleteButton}>
                        <MaterialIcons color="#5C665B" name="delete-outline" size={16} />
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.recordFooter}>
                    <Text numberOfLines={expanded ? undefined : 1} style={[styles.recordPreview, expanded && styles.recordPreviewExpanded]}>
                      {record.preview}
                    </Text>
                    <Pressable
                      onPress={() => {
                        if (record.onView) {
                          record.onView();
                          return;
                        }
                        setExpandedRecordId(expanded ? null : record.id);
                      }}
                      style={[styles.viewButton, expanded ? styles.viewButtonGhost : styles.viewButtonSolid]}
                    >
                      <Text style={[styles.viewButtonText, expanded ? styles.viewButtonTextGhost : styles.viewButtonTextSolid]}>
                        {record.onView ? 'Open' : expanded ? 'Close' : 'View'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <BottomNav activeRoute="PatientRecords" insetsBottom={insets.bottom} onNavigate={(route) => navigation.navigate(route)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F6F8F6',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F6F8F6',
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  brandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    backgroundColor: '#FCE7DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#40493D',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#16532D',
  },
  iconButton: {
    padding: 8,
    borderRadius: 999,
  },
  heroSection: {
    gap: 6,
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: theme.colors.primary,
  },
  title: {
    fontSize: 31,
    lineHeight: 37,
    fontWeight: '700',
    color: '#0F170F',
  },
  searchWrap: {
    position: 'relative',
    marginBottom: 18,
  },
  searchIcon: {
    position: 'absolute',
    left: 16,
    top: 17,
    zIndex: 2,
  },
  searchInput: {
    height: 52,
    borderRadius: 18,
    backgroundColor: theme.colors.white,
    paddingLeft: 46,
    paddingRight: 16,
    fontSize: 14,
    color: '#0F170F',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  filterRow: {
    gap: 8,
    paddingBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
  },
  filterChipIdle: {
    backgroundColor: '#C6E9BD',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: theme.colors.white,
  },
  filterChipTextIdle: {
    color: '#072107',
  },
  uploadCta: {
    marginTop: 18,
    borderRadius: 18,
    backgroundColor: '#F1F5F1',
    padding: 18,
    gap: 10,
  },
  uploadCtaTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: '#0F170F',
  },
  uploadCtaText: {
    fontSize: 12,
    lineHeight: 17,
    color: '#5C665B',
  },
  uploadCtaButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  uploadCtaButtonText: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  recordList: {
    marginTop: 18,
    gap: 16,
  },
  recordCard: {
    backgroundColor: '#F1F5F1',
    borderRadius: 18,
    padding: 18,
    gap: 14,
  },
  recordCardHighlight: {
    backgroundColor: 'rgba(214,238,215,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(47,127,49,0.1)',
  },
  recordCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  recordMainInfo: {
    flexDirection: 'row',
    flex: 1,
    gap: 14,
  },
  recordHeaderActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordTextWrap: {
    flex: 1,
    gap: 4,
    paddingTop: 2,
  },
  recordTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: '#0F170F',
  },
  recordMeta: {
    fontSize: 12,
    lineHeight: 16,
    color: '#5C665B',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 92,
  },
  statusText: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  recordFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(112,122,108,0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  recordPreview: {
    flex: 1,
    fontSize: 10,
    lineHeight: 14,
    color: '#5C665B',
  },
  recordPreviewExpanded: {
    fontSize: 12,
    lineHeight: 18,
  },
  viewButton: {
    minWidth: 78,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 9,
    alignItems: 'center',
  },
  viewButtonSolid: {
    backgroundColor: theme.colors.primary,
  },
  viewButtonGhost: {
    backgroundColor: 'rgba(47,127,49,0.1)',
  },
  viewButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  viewButtonTextSolid: {
    color: theme.colors.white,
  },
  viewButtonTextGhost: {
    color: theme.colors.primary,
  },
  emptyText: {
    color: '#98A2A0',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 36,
    marginBottom: 18,
  },
});






