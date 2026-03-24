import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { AppScaffold } from '../components/Layout';
import { EmptyCard, ErrorCard, LoadingCard } from '../components/Feedback';
import { Button, Card, SectionTitle } from '../components/Primitives';
import { fetchConnections, type ApiFailure, type ConnectionItem } from '../lib/api';
import { initialLetters } from '../lib/format';
import { theme } from '../lib/theme';
import { useApp } from '../state/AppContext';
import type { FamilyProfilesProps } from '../navigation';

export function FamilyProfilesScreen({ navigation }: FamilyProfilesProps) {
  const { currentUser, logout, selectedRole } = useApp();
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiFailure | null>(null);

  const loadConnections = useCallback(async () => {
    if (selectedRole !== 'PATIENT') {
      setConnections([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const payload = await fetchConnections(selectedRole);
      setConnections(payload.connections ?? []);
    } catch (failure) {
      setError(failure as ApiFailure);
    } finally {
      setLoading(false);
    }
  }, [selectedRole]);

  useFocusEffect(
    useCallback(() => {
      loadConnections();
    }, [loadConnections])
  );

  return (
    <AppScaffold
      activeRoute="FamilyProfiles"
      onBack={navigation.goBack}
      onNavigate={(route) => navigation.navigate(route)}
      rightAction={<Button label="Log out" onPress={logout} variant="secondary" />}
      subtitle={selectedRole === 'PATIENT' ? 'Manage your shared care circle and connected profiles.' : 'Review your account details and workspace access.'}
      title="Family Profiles"
    >
      <Card style={styles.profileCard}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarLabel}>{initialLetters(currentUser?.fullName || currentUser?.email)}</Text>
        </View>
        <SectionTitle detail={currentUser?.healthId || currentUser?.email || 'Active account'} eyebrow="Profile" title={currentUser?.fullName || 'FamWell user'} />
        <Text style={styles.bodyText}>{selectedRole === 'DOCTOR' ? 'Doctor accounts can review uploads, summaries, records, and AI insights from the shared workspace.' : 'Patient accounts can keep doctors and family relationships in sync from this profile view.'}</Text>
      </Card>

      {loading ? <LoadingCard label="Loading connected profiles..." /> : null}
      {error ? <ErrorCard message={error.message} onRetry={loadConnections} title="Profiles unavailable" /> : null}

      {!loading && !error ? (
        selectedRole === 'PATIENT' ? (
          connections.length > 0 ? (
            connections.map((connection) => (
              <Card key={connection.connection_id} style={styles.connectionCard}>
                <View style={styles.connectionAvatar}>
                  <Text style={styles.connectionAvatarLabel}>{initialLetters(connection.user.full_name || connection.user.email)}</Text>
                </View>
                <View style={styles.connectionCopy}>
                  <Text style={styles.connectionName}>{connection.user.full_name || connection.user.email}</Text>
                  <Text style={styles.connectionMeta}>{connection.user.health_id || 'Health ID unavailable'}</Text>
                </View>
              </Card>
            ))
          ) : (
            <EmptyCard detail="Add doctors from the Find Doctor screen to build your care circle here." title="No linked profiles yet" action={<Button label="Find a doctor" onPress={() => navigation.navigate('FindDoctor')} />} />
          )
        ) : (
          <Card>
            <SectionTitle detail="Your doctor profile is ready for consultations, uploads, and summaries." eyebrow="Doctor view" title="Workspace access" />
            <Text style={styles.bodyText}>Use the dashboard shortcuts to move between records, uploads, consultations, and AI insights.</Text>
          </Card>
        )
      ) : null}
    </AppScaffold>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    gap: theme.spacing.md,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarLabel: {
    ...theme.typography.bodyStrong,
    color: theme.colors.primaryDark,
  },
  bodyText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  connectionCard: {
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  connectionAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.surfaceAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectionAvatarLabel: {
    ...theme.typography.label,
    color: theme.colors.primaryDark,
  },
  connectionCopy: {
    flex: 1,
  },
  connectionName: {
    ...theme.typography.bodyStrong,
    color: theme.colors.text,
  },
  connectionMeta: {
    ...theme.typography.caption,
    color: theme.colors.textSoft,
  },
});
