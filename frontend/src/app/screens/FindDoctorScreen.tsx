import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { AppScaffold } from '../components/Layout';
import { EmptyCard, ErrorCard, LoadingCard } from '../components/Feedback';
import { Button, Card, Field, SectionTitle } from '../components/Primitives';
import { fetchConnections, followByHealthId, type ApiFailure, type ConnectionItem } from '../lib/api';
import { initialLetters } from '../lib/format';
import { theme } from '../lib/theme';
import { useApp } from '../state/AppContext';
import type { FindDoctorProps } from '../navigation';

export function FindDoctorScreen({ navigation }: FindDoctorProps) {
  const { selectedRole } = useApp();
  const [healthId, setHealthId] = useState('');
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiFailure | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  const handleFollow = async () => {
    try {
      setSubmitting(true);
      setError(null);
      setSuccessMessage(null);
      const connection = await followByHealthId(selectedRole, healthId);
      setHealthId('');
      setSuccessMessage(`Connected with ${connection.user.full_name || connection.user.email}.`);
      await loadConnections();
    } catch (failure) {
      setError(failure as ApiFailure);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppScaffold activeRoute="HomeDashboard" onBack={navigation.goBack} onNavigate={(route) => navigation.navigate(route)} subtitle="Use an existing health ID to add a doctor to your care network." title="Find Doctor">
      <Card style={styles.heroCard}>
        <SectionTitle detail="Accepted format: AB-1234 or a longer issued ID." eyebrow="Connections" title="Connect a care professional" />
        <Field autoCapitalize="characters" label="Doctor health ID" onChangeText={setHealthId} placeholder="AB-1234" value={healthId} />
        <Button disabled={!healthId.trim() || selectedRole !== 'PATIENT'} label="Connect doctor" loading={submitting} onPress={handleFollow} />
        {selectedRole !== 'PATIENT' ? <Text style={styles.helperText}>Only patient accounts can create doctor connections.</Text> : null}
        {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
      </Card>

      {loading ? <LoadingCard label="Loading your current care circle..." /> : null}
      {error ? <ErrorCard message={error.message} onRetry={loadConnections} title="Unable to load doctors" /> : null}

      {!loading && !error ? (
        connections.length > 0 ? (
          <Card>
            <SectionTitle detail="Doctors already linked to this patient profile." eyebrow="Care team" title="Connected doctors" />
            <View style={styles.connectionList}>
              {connections.map((connection) => (
                <View key={connection.connection_id} style={styles.connectionItem}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarLabel}>{initialLetters(connection.user.full_name || connection.user.email)}</Text>
                  </View>
                  <View style={styles.connectionCopy}>
                    <Text style={styles.connectionName}>{connection.user.full_name || connection.user.email}</Text>
                    <Text style={styles.connectionMeta}>{connection.user.health_id || 'Health ID unavailable'}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        ) : (
          <EmptyCard detail="Once you add a doctor by health ID, they’ll appear here for quick access and care sharing." title="No doctors connected yet" />
        )
      ) : null}
    </AppScaffold>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: theme.spacing.md,
  },
  helperText: {
    ...theme.typography.caption,
    color: theme.colors.textSoft,
  },
  successText: {
    ...theme.typography.caption,
    color: theme.colors.success,
  },
  connectionList: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  connectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
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
