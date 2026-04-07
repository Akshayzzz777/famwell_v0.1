import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav } from '../components/Layout';
import {
  fetchDoctorDashboard,
  type ApiFailure,
  type DoctorAppointment,
  type DoctorDashboardPayload,
  type DoctorPatient,
} from '../lib/api';
import { theme } from '../lib/theme';
import { useApp } from '../state/AppContext';
import type { DoctorDashboardProps } from '../navigation';

function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

export function DoctorDashboardScreen({ navigation }: DoctorDashboardProps) {
  const insets = useSafeAreaInsets();
  const { currentUser, selectedRole } = useApp();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DoctorDashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          setLoading(true);
          setError(null);
          const result = await fetchDoctorDashboard(selectedRole);
          if (active) setData(result);
        } catch (e) {
          if (active) setError((e as ApiFailure)?.message || 'Failed to load dashboard');
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => { active = false; };
    }, [selectedRole])
  );

  const doctorName = currentUser?.fullName || 'Doctor';

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
        <View style={styles.header}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials(doctorName)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.doctorName}>Dr. {doctorName}</Text>
          </View>
          <Pressable onPress={() => navigation.navigate('Notifications')} style={styles.iconBtn}>
            <MaterialIcons name="notifications-none" size={24} color={theme.colors.text} />
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.colors.primary} size="large" style={{ marginTop: 60 }} />
        ) : error ? (
          <View style={styles.errorCard}>
            <MaterialIcons name="error-outline" size={20} color={theme.colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <>
            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: theme.colors.primarySoft }]}>
                <Text style={styles.statValue}>{data?.stats.total_patients ?? 0}</Text>
                <Text style={styles.statLabel}>Patients</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: theme.colors.accentSoft }]}>
                <Text style={styles.statValue}>{data?.stats.completed_appointments ?? 0}</Text>
                <Text style={styles.statLabel}>Completed</Text>
              </View>
            </View>

            {/* Upcoming Appointments */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
              {data?.appointments && data.appointments.length > 0 ? (
                data.appointments.map((appt) => (
                  <AppointmentCard key={appt.appointment_id} appointment={appt} />
                ))
              ) : (
                <Text style={styles.emptyText}>No upcoming appointments</Text>
              )}
            </View>

            {/* Patients You Follow */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Your Patients</Text>
                <Pressable onPress={() => navigation.navigate('DoctorPatients')}>
                  <Text style={styles.seeAll}>See All</Text>
                </Pressable>
              </View>
              {data?.patients && data.patients.length > 0 ? (
                data.patients.slice(0, 5).map((patient) => (
                  <PatientCard
                    key={patient.user_id}
                    patient={patient}
                    onViewRecords={() =>
                      navigation.navigate('DoctorPatientRecords', {
                        patientId: patient.user_id,
                        patientName: patient.full_name ?? undefined,
                        patientHealthId: patient.health_id ?? undefined,
                      })
                    }
                  />
                ))
              ) : (
                <Text style={styles.emptyText}>No connected patients yet</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <BottomNav
        activeRoute="DoctorDashboard"
        insetsBottom={insets.bottom}
        onNavigate={(route) => navigation.navigate(route as any)}
      />
    </View>
  );
}

function AppointmentCard({ appointment }: { appointment: DoctorAppointment }) {
  const typeColor = appointment.type === 'Video Call' ? '#5B7CE2' : theme.colors.primary;
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={[styles.typeTag, { backgroundColor: typeColor + '18' }]}>
          <MaterialCommunityIcons
            name={appointment.type === 'Video Call' ? 'video-outline' : 'hospital-building'}
            size={14}
            color={typeColor}
          />
          <Text style={[styles.typeText, { color: typeColor }]}>{appointment.type}</Text>
        </View>
        <View style={[styles.statusBadge, appointment.status === 'accepted' ? styles.statusAccepted : styles.statusPending]}>
          <Text style={styles.statusText}>{appointment.status}</Text>
        </View>
      </View>
      <Text style={styles.cardTitle}>{appointment.patient_name ?? 'Unknown Patient'}</Text>
      <View style={styles.cardRow}>
        <MaterialIcons name="schedule" size={14} color={theme.colors.textMuted} />
        <Text style={styles.cardDetail}>
          {formatDate(appointment.date)} · {appointment.time}
        </Text>
      </View>
    </View>
  );
}

function PatientCard({
  patient,
  onViewRecords,
}: {
  patient: DoctorPatient;
  onViewRecords: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.patientAvatar}>
          <Text style={styles.patientAvatarText}>{initials(patient.full_name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{patient.full_name || patient.email}</Text>
          {patient.health_id ? (
            <Text style={styles.cardDetail}>{patient.health_id}</Text>
          ) : null}
        </View>
        <Pressable onPress={onViewRecords} style={styles.viewRecordsBtn}>
          <Text style={styles.viewRecordsBtnText}>View Records</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F8F6' },
  scrollContent: { flexGrow: 1, paddingHorizontal: theme.spacing.lg, gap: theme.spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  greeting: { ...theme.typography.body, color: theme.colors.textMuted },
  doctorName: { ...theme.typography.heading, color: theme.colors.text },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: { flexDirection: 'row', gap: theme.spacing.md },
  statCard: {
    flex: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { ...theme.typography.title, color: theme.colors.text },
  statLabel: { ...theme.typography.caption, color: theme.colors.textMuted },
  section: { gap: theme.spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { ...theme.typography.subheading, color: theme.colors.text },
  seeAll: { ...theme.typography.label, color: theme.colors.primary },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.xs,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  cardTitle: { ...theme.typography.bodyStrong, color: theme.colors.text },
  cardDetail: { ...theme.typography.caption, color: theme.colors.textMuted },
  typeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  typeText: { ...theme.typography.caption, fontWeight: '600' },
  statusBadge: {
    marginLeft: 'auto',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
  },
  statusAccepted: { backgroundColor: theme.colors.successSoft },
  statusPending: { backgroundColor: theme.colors.accentSoft },
  statusText: { ...theme.typography.caption, fontWeight: '600', color: theme.colors.text },
  patientAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientAvatarText: { ...theme.typography.caption, color: theme.colors.primary, fontWeight: '700' },
  viewRecordsBtn: {
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
  },
  viewRecordsBtnText: { ...theme.typography.caption, color: theme.colors.primary, fontWeight: '700' },
  emptyText: { ...theme.typography.body, color: theme.colors.textMuted, textAlign: 'center', paddingVertical: theme.spacing.lg },
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
