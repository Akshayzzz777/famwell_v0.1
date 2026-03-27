import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomNav } from '../components/BottomNav';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { InputField } from '../components/InputField';
import { LoadingDots } from '../components/LoadingDots';
import { PrimaryButton } from '../components/PrimaryButton';
import { SectionContainer } from '../components/SectionContainer';
import { useRole } from '../context/RoleContext';
import { mainNavItems } from '../navigation/mainNavItems';
import type { ConnectionsScreenProps, MainRouteName } from '../navigation/types';
import {
  fetchConnections,
  fetchPendingRequests,
  respondToFollowRequest,
  sendFollowRequest,
  type ConnectionItem,
} from '../services/api';
import { theme } from '../styles/theme';

export function ConnectionsScreen({ navigation }: ConnectionsScreenProps) {
  const { selectedRole } = useRole();
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ConnectionItem[]>([]);
  const [healthIdInput, setHealthIdInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [connectionsData, pendingData] = await Promise.all([
        fetchConnections(selectedRole).catch(() => ({ connections: [] })),
        fetchPendingRequests(selectedRole).catch(() => ({ requests: [] })),
      ]);
      setConnections(connectionsData.connections);
      setPendingRequests(pendingData.requests);
    } finally {
      setLoading(false);
    }
  }, [selectedRole]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSendRequest = async () => {
    const hid = healthIdInput.trim().toUpperCase();
    if (!hid) return;

    try {
      setSending(true);
      await sendFollowRequest(selectedRole, hid);
      setHealthIdInput('');
      Alert.alert('Success', 'Follow request sent!');
      await loadData();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to send follow request');
    } finally {
      setSending(false);
    }
  };

  const handleAction = async (connectionId: string, action: 'accepted' | 'rejected') => {
    try {
      setActionLoading(connectionId);
      await respondToFollowRequest(selectedRole, connectionId, action);
      await loadData();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to process request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleNavigate = (route: MainRouteName) => {
    navigation.navigate(route);
  };

  const acceptedConnections = connections.filter((c) => c.status === 'accepted');
  const pendingOutgoing = connections.filter((c) => c.status === 'pending');

  return (
    <View style={styles.screen}>
      <Header backLabel="<" onBack={navigation.goBack} title="Connections" />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Search by Health ID */}
        <Card style={styles.searchCard}>
          <Text style={styles.searchTitle}>Connect by Health ID</Text>
          <InputField
            label="Health ID"
            placeholder="e.g. HW-A1B2C3D4"
            value={healthIdInput}
            onChangeText={setHealthIdInput}
          />
          <PrimaryButton
            label="Send Follow Request"
            onPress={handleSendRequest}
            loading={sending}
            disabled={!healthIdInput.trim() || sending}
          />
        </Card>

        {loading ? (
          <View style={styles.loadingContainer}>
            <LoadingDots />
          </View>
        ) : (
          <>
            {/* Pending Incoming Requests */}
            {pendingRequests.length > 0 && (
              <SectionContainer title={`Pending Requests (${pendingRequests.length})`}>
                {pendingRequests.map((req) => (
                  <Card key={req.connection_id} style={styles.requestCard}>
                    <View style={styles.requestInfo}>
                      <View style={styles.requestAvatar}>
                        <Text style={styles.requestAvatarText}>
                          {(req.user.full_name || req.user.email || '--').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.requestDetails}>
                        <Text style={styles.requestName}>
                          {req.user.full_name || req.user.email}
                        </Text>
                        <Text style={styles.requestId}>{req.user.health_id}</Text>
                      </View>
                    </View>
                    <View style={styles.requestActions}>
                      <PrimaryButton
                        label="Accept"
                        onPress={() => handleAction(req.connection_id, 'accepted')}
                        loading={actionLoading === req.connection_id}
                        disabled={actionLoading === req.connection_id}
                      />
                      <PrimaryButton
                        label="Reject"
                        variant="secondary"
                        onPress={() => handleAction(req.connection_id, 'rejected')}
                        disabled={actionLoading === req.connection_id}
                      />
                    </View>
                  </Card>
                ))}
              </SectionContainer>
            )}

            {/* Accepted Connections */}
            <SectionContainer title={`Connected (${acceptedConnections.length})`}>
              {acceptedConnections.length === 0 ? (
                <Text style={styles.emptyText}>No accepted connections yet.</Text>
              ) : (
                acceptedConnections.map((conn) => (
                  <Card key={conn.connection_id} style={styles.connectionCard}>
                    <View style={styles.connectionRow}>
                      <View style={styles.connectionAvatar}>
                        <Text style={styles.connectionAvatarText}>
                          {(conn.user.full_name || conn.user.email || '--').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.connectionInfo}>
                        <Text style={styles.connectionName}>
                          {conn.user.full_name || conn.user.email}
                        </Text>
                        <Text style={styles.connectionId}>
                          {conn.user.health_id} · {conn.user.role === 'USER' ? 'Patient' : 'Doctor'}
                        </Text>
                      </View>
                      <View style={styles.statusBadge}>
                        <Text style={styles.statusText}>Connected</Text>
                      </View>
                    </View>
                  </Card>
                ))
              )}
            </SectionContainer>

            {/* Pending Outgoing */}
            {pendingOutgoing.length > 0 && (
              <SectionContainer title={`Pending Sent (${pendingOutgoing.length})`}>
                {pendingOutgoing.map((conn) => (
                  <Card key={conn.connection_id} style={styles.connectionCard}>
                    <View style={styles.connectionRow}>
                      <View style={[styles.connectionAvatar, styles.pendingAvatar]}>
                        <Text style={styles.connectionAvatarText}>
                          {(conn.user.full_name || conn.user.email || '--').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.connectionInfo}>
                        <Text style={styles.connectionName}>
                          {conn.user.full_name || conn.user.email}
                        </Text>
                        <Text style={styles.connectionId}>{conn.user.health_id}</Text>
                      </View>
                      <View style={[styles.statusBadge, styles.pendingBadge]}>
                        <Text style={[styles.statusText, styles.pendingText]}>Pending</Text>
                      </View>
                    </View>
                  </Card>
                ))}
              </SectionContainer>
            )}
          </>
        )}
      </ScrollView>

      <BottomNav activeRoute="ConnectionsScreen" items={mainNavItems} onNavigate={handleNavigate} />
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
  loadingContainer: {
    paddingTop: theme.spacing[8],
    alignItems: 'center',
  },
  searchCard: {
    gap: theme.spacing[4],
    backgroundColor: theme.colors.brand.blue50,
    borderColor: theme.colors.brand.blue100,
  },
  searchTitle: {
    ...theme.typography.subheading,
    color: theme.colors.neutrals.textPrimary,
  },
  requestCard: {
    gap: theme.spacing[3],
    marginBottom: theme.spacing[3],
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
  },
  requestAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.accent.amberSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestAvatarText: {
    ...theme.typography.caption,
    color: '#D97706',
  },
  requestDetails: {
    flex: 1,
  },
  requestName: {
    ...theme.typography.label,
    color: theme.colors.neutrals.textPrimary,
  },
  requestId: {
    ...theme.typography.caption,
    color: theme.colors.neutrals.textMuted,
  },
  requestActions: {
    flexDirection: 'row',
    gap: theme.spacing[3],
  },
  connectionCard: {
    marginBottom: theme.spacing[3],
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
  },
  connectionAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.brand.teal100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectionAvatarText: {
    ...theme.typography.caption,
    color: theme.colors.brand.teal700,
  },
  connectionInfo: {
    flex: 1,
  },
  connectionName: {
    ...theme.typography.label,
    color: theme.colors.neutrals.textPrimary,
  },
  connectionId: {
    ...theme.typography.caption,
    color: theme.colors.neutrals.textMuted,
    marginTop: theme.spacing[1],
  },
  statusBadge: {
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.brand.teal50,
  },
  statusText: {
    ...theme.typography.caption,
    color: theme.colors.brand.teal700,
  },
  pendingAvatar: {
    backgroundColor: theme.colors.accent.amberSoft,
  },
  pendingBadge: {
    backgroundColor: theme.colors.accent.amberSoft,
  },
  pendingText: {
    color: '#D97706',
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.neutrals.textMuted,
    textAlign: 'center',
    paddingVertical: theme.spacing[4],
  },
});
