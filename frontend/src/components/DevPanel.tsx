import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRole, type DevScenario } from '../context/RoleContext';
import { fetchRecords, followByHealthId, healthCheck, type UiRole } from '../services/api';
import { theme } from '../styles/theme';

export function DevPanel({ onAfterRoleChange }: { onAfterRoleChange: () => void }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const { clearSessionError, currentUser, devScenario, selectedRole, setDevScenario, setSelectedRole } = useRole();

  useEffect(() => {
    healthCheck()
      .then((result) => {
        console.log('[dev] health result', result);
      })
      .catch((error) => {
        console.log('[dev] health error', error);
      });
  }, []);

  const applyRole = async (role: UiRole) => {
    clearSessionError();
    setSelectedRole(role);
    onAfterRoleChange();
  };

  const runRecordsCheck = async () => {
    try {
      const result = await fetchRecords(selectedRole);
      console.log('[dev] records result', result);
    } catch (error) {
      console.log('[dev] records error', error);
    }
  };

  const runFollowCheck = async () => {
    try {
      const result = await followByHealthId(selectedRole, currentUser?.healthId ?? 'HW-TEST000');
      console.log('[dev] follow result', result);
    } catch (error) {
      console.log('[dev] follow error', error);
    }
  };

  const toggleScenario = (scenario: DevScenario) => {
    setDevScenario(devScenario === scenario ? 'live' : scenario);
  };

  return (
    <View style={[styles.container, { top: insets.top + theme.spacing[4] }]}> 
      <TouchableOpacity activeOpacity={0.9} onPress={() => setOpen((value) => !value)} style={styles.toggle}>
        <Text style={styles.toggleLabel}>{open ? 'Close DEV' : 'DEV'}</Text>
      </TouchableOpacity>

      {open ? (
        <View style={styles.panel}>
          <Text style={styles.statusLabel}>Scenario: {devScenario}</Text>
          <TouchableOpacity activeOpacity={0.9} onPress={runRecordsCheck} style={styles.actionButton}>
            <Text style={styles.actionLabel}>Test Records API</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.9} onPress={runFollowCheck} style={styles.actionButton}>
            <Text style={styles.actionLabel}>Test Follow API</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.9} onPress={() => toggleScenario('empty')} style={styles.actionButton}>
            <Text style={styles.actionLabel}>Simulate Empty State</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.9} onPress={() => toggleScenario('error')} style={styles.actionButton}>
            <Text style={styles.actionLabel}>Simulate Error State</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.9} onPress={() => applyRole('DOCTOR')} style={styles.actionButton}>
            <Text style={styles.actionLabel}>As Doctor</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.9} onPress={() => applyRole('PATIENT')} style={styles.actionButton}>
            <Text style={styles.actionLabel}>As Patient</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: theme.spacing[4],
    zIndex: 20,
    alignItems: 'flex-end',
  },
  toggle: {
    backgroundColor: theme.colors.neutrals.textPrimary,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
  },
  toggleLabel: {
    ...theme.typography.label,
    color: theme.colors.white,
  },
  panel: {
    marginTop: theme.spacing[2],
    minWidth: 160,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.neutrals.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing[3],
    gap: theme.spacing[2],
    ...theme.shadows.card,
  },
  statusLabel: {
    ...theme.typography.caption,
    color: theme.colors.neutrals.textMuted,
    textAlign: 'center',
  },
  actionButton: {
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.neutrals.surfaceSoft,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[3],
  },
  actionLabel: {
    ...theme.typography.label,
    color: theme.colors.neutrals.textBody,
    textAlign: 'center',
  },
});
