import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
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
import { fetchRecords, type ApiFailure, type RecordItem } from '../lib/api';
import { theme } from '../lib/theme';
import { useApp } from '../state/AppContext';
import type { DoctorPatientRecordsProps } from '../navigation';

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function recordIcon(recordType: string): { name: string; family: 'MI' | 'MCI' } {
  switch (recordType) {
    case 'uploaded_pdf':
      return { name: 'picture-as-pdf', family: 'MI' };
    case 'prescription':
      return { name: 'pill', family: 'MCI' };
    case 'lab_report':
      return { name: 'science', family: 'MI' };
    case 'imaging':
      return { name: 'image', family: 'MI' };
    default:
      return { name: 'description', family: 'MI' };
  }
}

const FILTER_TABS = ['All Records', 'Reports', 'Imaging', 'Prescriptions'] as const;

export function DoctorPatientRecordsScreen({ navigation, route }: DoctorPatientRecordsProps) {
  const { patientId, patientName, patientHealthId } = route.params;
  const insets = useSafeAreaInsets();
  const { selectedRole } = useApp();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [activeTab, setActiveTab] = useState<(typeof FILTER_TABS)[number]>('All Records');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          setLoading(true);
          setError(null);
          const data = await fetchRecords(selectedRole, patientId);
          if (active) setRecords(data.records);
        } catch (e) {
          if (active) setError((e as ApiFailure)?.message || 'Failed to load records');
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => { active = false; };
    }, [selectedRole, patientId])
  );

  const filteredRecords = records.filter((r) => {
    const matchesTab =
      activeTab === 'All Records' ||
      (activeTab === 'Reports' && (r.record_type === 'lab_report' || r.record_type === 'uploaded_pdf')) ||
      (activeTab === 'Imaging' && r.record_type === 'imaging') ||
      (activeTab === 'Prescriptions' && r.record_type === 'prescription');

    const matchesSearch = search.trim()
      ? r.record_type.toLowerCase().includes(search.toLowerCase()) ||
        JSON.stringify(r.data).toLowerCase().includes(search.toLowerCase())
      : true;

    return matchesTab && matchesSearch;
  });

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + theme.spacing.lg, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={18} color={theme.colors.text} />
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>

        <View style={styles.patientHeader}>
          <Text style={styles.title}>Medical Records</Text>
          <Text style={styles.patientName}>{patientName || 'Patient'}</Text>
          {patientHealthId && <Text style={styles.patientId}>{patientHealthId}</Text>}
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={20} color={theme.colors.textMuted} />
          <TextInput
            placeholder="Search records..."
            placeholderTextColor={theme.colors.textSoft}
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Filter Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterRow}>
            {FILTER_TABS.map((tab) => (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[styles.filterTab, activeTab === tab && styles.filterTabActive]}
              >
                <Text style={[styles.filterTabText, activeTab === tab && styles.filterTabTextActive]}>
                  {tab}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {loading ? (
          <ActivityIndicator color={theme.colors.primary} size="large" style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={styles.errorCard}>
            <MaterialIcons name="error-outline" size={20} color={theme.colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : filteredRecords.length > 0 ? (
          filteredRecords.map((record) => {
            const icon = recordIcon(record.record_type);
            return (
              <View key={record.record_id} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={styles.iconWrap}>
                    {icon.family === 'MCI' ? (
                      <MaterialCommunityIcons name={icon.name as any} size={20} color={theme.colors.primary} />
                    ) : (
                      <MaterialIcons name={icon.name as any} size={20} color={theme.colors.primary} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>
                      {(record.data as any)?.file_name ||
                        (record.data as any)?.title ||
                        record.record_type.replace(/_/g, ' ')}
                    </Text>
                    <Text style={styles.cardSub}>
                      {record.record_type.replace(/_/g, ' ')} · {formatDate(record.created_at)}
                    </Text>
                  </View>
                </View>
                {(record.data as any)?.has_analysis && (
                  <View style={styles.analysisBadge}>
                    <MaterialIcons name="auto-awesome" size={12} color={theme.colors.primary} />
                    <Text style={styles.analysisBadgeText}>AI Analysis Available</Text>
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="file-document-outline" size={48} color={theme.colors.textSoft} />
            <Text style={styles.emptyText}>
              {search || activeTab !== 'All Records'
                ? 'No records match your filter'
                : 'No records found for this patient'}
            </Text>
          </View>
        )}
      </ScrollView>

      <BottomNav
        activeRoute="DoctorPatients"
        insetsBottom={insets.bottom}
        onNavigate={(route) => navigation.navigate(route as any)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F8F6' },
  scrollContent: { flexGrow: 1, paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  backBtnText: { ...theme.typography.label, color: theme.colors.text },
  patientHeader: { gap: 2 },
  title: { ...theme.typography.title, color: theme.colors.text },
  patientName: { ...theme.typography.subheading, color: theme.colors.primary },
  patientId: { ...theme.typography.caption, color: theme.colors.textMuted },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  searchInput: { flex: 1, ...theme.typography.body, color: theme.colors.text, paddingVertical: 12 },
  filterRow: { flexDirection: 'row', gap: theme.spacing.sm },
  filterTab: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterTabActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  filterTabText: { ...theme.typography.label, color: theme.colors.textMuted },
  filterTabTextActive: { color: '#fff' },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { ...theme.typography.bodyStrong, color: theme.colors.text },
  cardSub: { ...theme.typography.caption, color: theme.colors.textMuted },
  analysisBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: theme.colors.surfaceAccent,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
  },
  analysisBadgeText: { ...theme.typography.caption, color: theme.colors.primary, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.xxl },
  emptyText: { ...theme.typography.body, color: theme.colors.textMuted, textAlign: 'center' },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.dangerSoft,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
  },
  errorText: { ...theme.typography.body, color: theme.colors.danger, flex: 1 },
});
