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
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav } from '../components/Layout';
import {
  fetchDoctorPatients,
  fetchPendingRequests,
  actionConnection,
  type ApiFailure,
  type DoctorPatient,
  type ConnectionItem,
} from '../lib/api';
import { theme } from '../lib/theme';
import { useApp } from '../state/AppContext';
import type { DoctorPatientsProps } from '../navigation';

function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export function DoctorPatientsScreen({ navigation }: DoctorPatientsProps) {
  const insets = useSafeAreaInsets();
  const { selectedRole } = useApp();
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<DoctorPatient[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ConnectionItem[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [patientsData, pendingData] = await Promise.all([
        fetchDoctorPatients(selectedRole),
        fetchPendingRequests(selectedRole).catch(() => ({ connections: [] })),
      ]);
      setPatients(patientsData.patients);
      setPendingRequests(pendingData.connections || []);
    } catch (e) {
      setError((e as ApiFailure)?.message || 'Failed to load patients');
    } finally {
      setLoading(false);
    }
  }, [selectedRole]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleAction = async (connectionId: string, action: 'accepted' | 'rejected') => {
    try {
      setActionLoading(connectionId);
      await actionConnection(selectedRole, connectionId, action);
      await loadData();
    } catch (e) {
      setError((e as ApiFailure)?.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = search.trim()
    ? patients.filter(
        (p) =>
          (p.full_name?.toLowerCase().includes(search.toLowerCase())) ||
          (p.health_id?.toLowerCase().includes(search.toLowerCase())) ||
          p.email.toLowerCase().includes(search.toLowerCase())
      )
    : patients;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + theme.spacing.lg, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Patients</Text>
        <Text style={styles.subtitle}>Manage your patient connections</Text>

        {/* Search */}
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={20} color={theme.colors.textMuted} />
          <TextInput
            placeholder="Search patients..."
            placeholderTextColor={theme.colors.textSoft}
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {loading ? (
          <ActivityIndicator color={theme.colors.primary} size="large" style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={styles.errorCard}>
            <MaterialIcons name="error-outline" size={20} color={theme.colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <>
            {/* Pending Requests */}
            {pendingRequests.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Pending Requests ({pendingRequests.length})
                </Text>
                {pendingRequests.map((req) => (
                  <View key={req.connection_id} style={styles.card}>
                    <View style={styles.cardRow}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{initials(req.user.full_name)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardName}>{req.user.full_name || req.user.email}</Text>
                        {req.user.health_id && (
                          <Text style={styles.cardSub}>{req.user.health_id}</Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.actionRow}>
                      <Pressable
                        onPress={() => handleAction(req.connection_id, 'accepted')}
                        style={[styles.actionBtn, styles.acceptBtn]}
                        disabled={actionLoading === req.connection_id}
                      >
                        {actionLoading === req.connection_id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.acceptBtnText}>Accept</Text>
                        )}
                      </Pressable>
                      <Pressable
                        onPress={() => handleAction(req.connection_id, 'rejected')}
                        style={[styles.actionBtn, styles.rejectBtn]}
                        disabled={actionLoading === req.connection_id}
                      >
                        <Text style={styles.rejectBtnText}>Decline</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Connected Patients */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Connected Patients ({filtered.length})
              </Text>
              {filtered.length > 0 ? (
                filtered.map((patient) => (
                  <Pressable
                    key={patient.user_id}
                    style={styles.card}
                    onPress={() =>
                      navigation.navigate('DoctorPatientRecords', {
                        patientId: patient.user_id,
                        patientName: patient.full_name ?? undefined,
                        patientHealthId: patient.health_id ?? undefined,
                      })
                    }
                  >
                    <View style={styles.cardRow}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{initials(patient.full_name)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardName}>{patient.full_name || patient.email}</Text>
                        {patient.health_id && (
                          <Text style={styles.cardSub}>{patient.health_id}</Text>
                        )}
                        {patient.phone_number && (
                          <Text style={styles.cardSub}>{patient.phone_number}</Text>
                        )}
                      </View>
                      <MaterialIcons name="chevron-right" size={22} color={theme.colors.textSoft} />
                    </View>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.emptyText}>
                  {search ? 'No patients match your search' : 'No connected patients yet'}
                </Text>
              )}
            </View>
          </>
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
  title: { ...theme.typography.title, color: theme.colors.text },
  subtitle: { ...theme.typography.body, color: theme.colors.textMuted },
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
  searchInput: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.text,
    paddingVertical: 12,
  },
  section: { gap: theme.spacing.sm },
  sectionTitle: { ...theme.typography.subheading, color: theme.colors.text },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...theme.typography.caption, color: theme.colors.primary, fontWeight: '700' },
  cardName: { ...theme.typography.bodyStrong, color: theme.colors.text },
  cardSub: { ...theme.typography.caption, color: theme.colors.textMuted },
  actionRow: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: { backgroundColor: theme.colors.primary },
  acceptBtnText: { ...theme.typography.label, color: '#fff' },
  rejectBtn: { backgroundColor: theme.colors.dangerSoft },
  rejectBtnText: { ...theme.typography.label, color: theme.colors.danger },
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
