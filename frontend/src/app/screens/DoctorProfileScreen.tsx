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
import {
  fetchDoctorProfile,
  updateDoctorProfile,
  type ApiFailure,
  type DoctorProfilePayload,
} from '../lib/api';
import { theme } from '../lib/theme';
import { useApp } from '../state/AppContext';
import type { DoctorProfileProps } from '../navigation';

function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export function DoctorProfileScreen({ navigation }: DoctorProfileProps) {
  const insets = useSafeAreaInsets();
  const { selectedRole, logout } = useApp();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<DoctorProfilePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    specialization: '',
    experience: '',
    hospital_affiliation: '',
    education: '',
  });
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchDoctorProfile(selectedRole);
      setProfile(data);
      setEditForm({
        specialization: data.specialization || '',
        experience: data.experience || '',
        hospital_affiliation: data.hospital_affiliation || '',
        education: data.education || '',
      });
    } catch (e) {
      setError((e as ApiFailure)?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [selectedRole]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateDoctorProfile(selectedRole, {
        specialization: editForm.specialization || undefined,
        experience: editForm.experience || undefined,
        hospital_affiliation: editForm.hospital_affiliation || undefined,
        education: editForm.education || undefined,
      });
      setEditing(false);
      await loadProfile();
    } catch (e) {
      setError((e as ApiFailure)?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + theme.spacing.lg, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={theme.colors.primary} size="large" style={{ marginTop: 60 }} />
        ) : error ? (
          <View style={styles.errorCard}>
            <MaterialIcons name="error-outline" size={20} color={theme.colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : profile ? (
          <>
            {/* Profile Header */}
            <View style={styles.profileHeader}>
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarLargeText}>{initials(profile.full_name)}</Text>
              </View>
              <Text style={styles.profileName}>{profile.full_name || 'Doctor'}</Text>
              <Text style={styles.profileSpecialty}>
                {profile.specialization || 'Medical Professional'}
              </Text>
              <View style={styles.verifiedRow}>
                <MaterialIcons name="verified" size={16} color={theme.colors.primary} />
                <Text style={styles.verifiedText}>Verified Medical Practitioner</Text>
              </View>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profile.patient_count}</Text>
                <Text style={styles.statLabel}>Patients</Text>
              </View>
              <View style={[styles.statItem, styles.statDivider]}>
                <Text style={styles.statValue}>{profile.experience || '-'}</Text>
                <Text style={styles.statLabel}>Experience</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profile.rating > 0 ? profile.rating.toFixed(1) : '-'}</Text>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
            </View>

            {/* Health ID */}
            {profile.health_id && (
              <View style={styles.healthIdCard}>
                <MaterialCommunityIcons name="card-account-details-outline" size={20} color={theme.colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.healthIdLabel}>Medical Practitioner ID</Text>
                  <Text style={styles.healthIdValue}>{profile.health_id}</Text>
                </View>
              </View>
            )}

            {/* Professional Profile */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Professional Profile</Text>
                <Pressable onPress={() => setEditing(!editing)}>
                  <Text style={styles.editText}>{editing ? 'Cancel' : 'Edit'}</Text>
                </Pressable>
              </View>

              {editing ? (
                <View style={styles.editForm}>
                  <Text style={styles.fieldLabel}>Specialization</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.specialization}
                    onChangeText={(v) => setEditForm({ ...editForm, specialization: v })}
                    placeholder="e.g. Cardiology"
                    placeholderTextColor={theme.colors.textSoft}
                  />
                  <Text style={styles.fieldLabel}>Experience</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.experience}
                    onChangeText={(v) => setEditForm({ ...editForm, experience: v })}
                    placeholder="e.g. 12 years"
                    placeholderTextColor={theme.colors.textSoft}
                  />
                  <Text style={styles.fieldLabel}>Hospital Affiliation</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.hospital_affiliation}
                    onChangeText={(v) => setEditForm({ ...editForm, hospital_affiliation: v })}
                    placeholder="e.g. City Hospital"
                    placeholderTextColor={theme.colors.textSoft}
                  />
                  <Text style={styles.fieldLabel}>Education</Text>
                  <TextInput
                    style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                    value={editForm.education}
                    onChangeText={(v) => setEditForm({ ...editForm, education: v })}
                    placeholder="e.g. MBBS, MD Cardiology"
                    placeholderTextColor={theme.colors.textSoft}
                    multiline
                  />
                  <Pressable onPress={handleSave} style={styles.saveBtn} disabled={saving}>
                    {saving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.saveBtnText}>Save Changes</Text>
                    )}
                  </Pressable>
                </View>
              ) : (
                <View style={styles.infoList}>
                  <InfoRow
                    icon="school"
                    label="Education"
                    value={profile.education || 'Not specified'}
                  />
                  <InfoRow
                    icon="local-hospital"
                    label="Hospital"
                    value={profile.hospital_affiliation || 'Not specified'}
                  />
                  <InfoRow
                    icon="work-outline"
                    label="Experience"
                    value={profile.experience || 'Not specified'}
                  />
                  <InfoRow
                    icon="category"
                    label="Specialization"
                    value={profile.specialization || 'Not specified'}
                  />
                </View>
              )}
            </View>

            {/* Account & Privacy */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Account & Privacy</Text>
              <View style={styles.menuList}>
                <MenuRow icon="email" label={profile.email} />
                {profile.phone_number && <MenuRow icon="phone" label={profile.phone_number} />}
                <Pressable style={styles.menuRow} onPress={logout}>
                  <MaterialIcons name="logout" size={20} color={theme.colors.danger} />
                  <Text style={[styles.menuLabel, { color: theme.colors.danger }]}>Logout</Text>
                </Pressable>
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>

      <BottomNav
        activeRoute="DoctorProfile"
        insetsBottom={insets.bottom}
        onNavigate={(route) => navigation.navigate(route as any)}
      />
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <MaterialIcons name={icon as any} size={18} color={theme.colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function MenuRow({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.menuRow}>
      <MaterialIcons name={icon as any} size={20} color={theme.colors.textMuted} />
      <Text style={styles.menuLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F8F6' },
  scrollContent: { flexGrow: 1, paddingHorizontal: theme.spacing.lg, gap: theme.spacing.lg },
  profileHeader: { alignItems: 'center', gap: theme.spacing.xs },
  avatarLarge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
  avatarLargeText: { color: '#fff', fontWeight: '700', fontSize: 32 },
  profileName: { ...theme.typography.title, color: theme.colors.text },
  profileSpecialty: { ...theme.typography.body, color: theme.colors.textMuted },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedText: { ...theme.typography.caption, color: theme.colors.primary },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.lg,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: theme.colors.border,
  },
  statValue: { ...theme.typography.heading, color: theme.colors.text },
  statLabel: { ...theme.typography.caption, color: theme.colors.textMuted },
  healthIdCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
  },
  healthIdLabel: { ...theme.typography.caption, color: theme.colors.textMuted },
  healthIdValue: { ...theme.typography.bodyStrong, color: theme.colors.primary },
  section: { gap: theme.spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { ...theme.typography.subheading, color: theme.colors.text },
  editText: { ...theme.typography.label, color: theme.colors.primary },
  infoList: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  infoLabel: { ...theme.typography.caption, color: theme.colors.textMuted },
  infoValue: { ...theme.typography.body, color: theme.colors.text },
  menuList: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  menuLabel: { ...theme.typography.body, color: theme.colors.text },
  editForm: { gap: theme.spacing.sm },
  fieldLabel: { ...theme.typography.label, color: theme.colors.textMuted },
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
  saveBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  saveBtnText: { ...theme.typography.bodyStrong, color: '#fff' },
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
