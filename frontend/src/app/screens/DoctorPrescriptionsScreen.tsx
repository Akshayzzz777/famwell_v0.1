import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
import {
  createPrescription,
  fetchDoctorPatients,
  fetchPrescriptions,
  updatePrescriptionStatus,
  type ApiFailure,
  type DoctorPatient,
  type PrescriptionItem,
} from '../lib/api';
import { theme } from '../lib/theme';
import { useApp } from '../state/AppContext';
import type { DoctorPrescriptionsProps } from '../navigation';

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

type NewPrescription = {
  patient_id: string;
  medication: string;
  dosage: string;
  duration: string;
  notes: string;
};

const EMPTY_FORM: NewPrescription = {
  patient_id: '',
  medication: '',
  dosage: '',
  duration: '',
  notes: '',
};

export function DoctorPrescriptionsScreen({ navigation }: DoctorPrescriptionsProps) {
  const insets = useSafeAreaInsets();
  const { selectedRole } = useApp();
  const [loading, setLoading] = useState(true);
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);
  const [patients, setPatients] = useState<DoctorPatient[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<NewPrescription>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [rxData, patData] = await Promise.all([
        fetchPrescriptions(selectedRole, filter ?? undefined),
        fetchDoctorPatients(selectedRole).catch(() => ({ patients: [] })),
      ]);
      setPrescriptions(rxData.prescriptions);
      setPatients(patData.patients);
    } catch (e) {
      setError((e as ApiFailure)?.message || 'Failed to load prescriptions');
    } finally {
      setLoading(false);
    }
  }, [selectedRole, filter]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleCreate = async () => {
    if (!form.patient_id || !form.medication || !form.dosage || !form.duration) return;
    try {
      setCreating(true);
      await createPrescription(selectedRole, {
        patient_id: form.patient_id,
        medication: form.medication,
        dosage: form.dosage,
        duration: form.duration,
        notes: form.notes || undefined,
      });
      setModalVisible(false);
      setForm(EMPTY_FORM);
      await loadData();
    } catch (e) {
      setError((e as ApiFailure)?.message || 'Failed to create prescription');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (rxId: string, newStatus: string) => {
    try {
      await updatePrescriptionStatus(selectedRole, rxId, newStatus);
      await loadData();
    } catch (e) {
      setError((e as ApiFailure)?.message || 'Failed to update status');
    }
  };

  const filtered = search.trim()
    ? prescriptions.filter(
        (rx) =>
          rx.medication.toLowerCase().includes(search.toLowerCase()) ||
          rx.patient_name?.toLowerCase().includes(search.toLowerCase())
      )
    : prescriptions;

  const filters = [null, 'Active', 'Completed'];

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
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Prescriptions</Text>
            <Text style={styles.subtitle}>Manage and track patient medication history</Text>
          </View>
          <Pressable onPress={() => setModalVisible(true)} style={styles.addBtn}>
            <MaterialIcons name="add" size={18} color="#fff" />
            <Text style={styles.addBtnText}>New Prescription</Text>
          </Pressable>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={20} color={theme.colors.textMuted} />
          <TextInput
            placeholder="Search prescriptions..."
            placeholderTextColor={theme.colors.textSoft}
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterRow}>
          {filters.map((f) => (
            <Pressable
              key={f ?? 'all'}
              onPress={() => setFilter(f)}
              style={[styles.filterTab, filter === f && styles.filterTabActive]}
            >
              <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
                {f ?? 'All'}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={theme.colors.primary} size="large" style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={styles.errorCard}>
            <MaterialIcons name="error-outline" size={20} color={theme.colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : filtered.length > 0 ? (
          filtered.map((rx) => (
            <View key={rx.prescription_id} style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="pill" size={18} color={theme.colors.primary} />
                <Text style={styles.cardTitle}>{rx.medication}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    rx.status === 'Active' ? styles.statusActive : styles.statusCompleted,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      rx.status === 'Active'
                        ? { color: theme.colors.primary }
                        : { color: theme.colors.textMuted },
                    ]}
                  >
                    {rx.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.patientLabel}>
                {rx.patient_name ?? 'Unknown'} {rx.patient_health_id ? `· ${rx.patient_health_id}` : ''}
              </Text>
              <View style={styles.detailRow}>
                <DetailChip label="Dosage" value={rx.dosage} />
                <DetailChip label="Duration" value={rx.duration} />
              </View>
              <Text style={styles.dateText}>{formatDate(rx.created_at)}</Text>
              {rx.status === 'Active' && (
                <Pressable
                  onPress={() => handleStatusChange(rx.prescription_id, 'Completed')}
                  style={styles.completeBtn}
                >
                  <Text style={styles.completeBtnText}>Mark Completed</Text>
                </Pressable>
              )}
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No prescriptions found</Text>
        )}
      </ScrollView>

      {/* New Prescription Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Prescription</Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={theme.colors.text} />
              </Pressable>
            </View>

            {/* Patient Picker (simple dropdown-like list) */}
            <Text style={styles.fieldLabel}>Patient</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 44 }}>
              {patients.map((p) => (
                <Pressable
                  key={p.user_id}
                  onPress={() => setForm({ ...form, patient_id: p.user_id })}
                  style={[
                    styles.patientChip,
                    form.patient_id === p.user_id && styles.patientChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.patientChipText,
                      form.patient_id === p.user_id && styles.patientChipTextActive,
                    ]}
                  >
                    {p.full_name || p.email}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Medication</Text>
            <TextInput
              placeholder="e.g. Amoxicillin"
              placeholderTextColor={theme.colors.textSoft}
              style={styles.input}
              value={form.medication}
              onChangeText={(v) => setForm({ ...form, medication: v })}
            />

            <Text style={styles.fieldLabel}>Dosage</Text>
            <TextInput
              placeholder="e.g. 500mg twice daily"
              placeholderTextColor={theme.colors.textSoft}
              style={styles.input}
              value={form.dosage}
              onChangeText={(v) => setForm({ ...form, dosage: v })}
            />

            <Text style={styles.fieldLabel}>Duration</Text>
            <TextInput
              placeholder="e.g. 7 days"
              placeholderTextColor={theme.colors.textSoft}
              style={styles.input}
              value={form.duration}
              onChangeText={(v) => setForm({ ...form, duration: v })}
            />

            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput
              placeholder="Additional notes..."
              placeholderTextColor={theme.colors.textSoft}
              style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
              value={form.notes}
              onChangeText={(v) => setForm({ ...form, notes: v })}
              multiline
            />

            <Pressable
              onPress={handleCreate}
              style={[
                styles.submitBtn,
                (!form.patient_id || !form.medication || !form.dosage || !form.duration) &&
                  styles.submitBtnDisabled,
              ]}
              disabled={creating || !form.patient_id || !form.medication || !form.dosage || !form.duration}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Create Prescription</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      <BottomNav
        activeRoute="DoctorPrescriptions"
        insetsBottom={insets.bottom}
        onNavigate={(route) => navigation.navigate(route as any)}
      />
    </View>
  );
}

function DetailChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailChip}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F8F6' },
  scrollContent: { flexGrow: 1, paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.md },
  title: { ...theme.typography.title, color: theme.colors.text },
  subtitle: { ...theme.typography.body, color: theme.colors.textMuted },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderRadius: theme.radius.pill,
  },
  addBtnText: { ...theme.typography.label, color: '#fff' },
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
    gap: theme.spacing.xs,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  cardTitle: { ...theme.typography.bodyStrong, color: theme.colors.text, flex: 1 },
  patientLabel: { ...theme.typography.caption, color: theme.colors.textMuted },
  detailRow: { flexDirection: 'row', gap: theme.spacing.sm },
  detailChip: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAccent,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
  },
  detailLabel: { ...theme.typography.caption, color: theme.colors.textMuted },
  detailValue: { ...theme.typography.bodyStrong, color: theme.colors.text },
  dateText: { ...theme.typography.caption, color: theme.colors.textSoft },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
  },
  statusActive: { backgroundColor: theme.colors.successSoft },
  statusCompleted: { backgroundColor: theme.colors.surfaceAccent },
  statusText: { ...theme.typography.caption, fontWeight: '600' },
  completeBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radius.pill,
    marginTop: theme.spacing.xs,
  },
  completeBtnText: { ...theme.typography.caption, color: theme.colors.primary, fontWeight: '700' },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
    paddingVertical: theme.spacing.xl,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.dangerSoft,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
  },
  errorText: { ...theme.typography.body, color: theme.colors.danger, flex: 1 },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  modalTitle: { ...theme.typography.heading, color: theme.colors.text },
  fieldLabel: { ...theme.typography.label, color: theme.colors.textMuted, marginTop: theme.spacing.xs },
  input: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    ...theme.typography.body,
    color: theme.colors.text,
  },
  patientChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAccent,
    marginRight: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  patientChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  patientChipText: { ...theme.typography.label, color: theme.colors.textMuted },
  patientChipTextActive: { color: '#fff' },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { ...theme.typography.bodyStrong, color: '#fff' },
});
