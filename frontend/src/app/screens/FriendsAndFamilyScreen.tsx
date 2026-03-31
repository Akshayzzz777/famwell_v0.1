import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { BottomNav } from '../components/Layout';
import { theme } from '../lib/theme';
import {
  fetchConnections,
  fetchPendingRequests,
  followByHealthId,
  searchUserByHealthId,
  actionConnection,
  type ApiFailure,
  type ConnectionItem,
  type UserSearchItem,
} from '../lib/api';
import { useApp } from '../state/AppContext';
import type { FriendsAndFamilyProps, MainRouteName } from '../navigation';

type SectionType =
  | { type: 'sectionHeader'; title: string; count?: number }
  | { type: 'searchResult'; item: UserSearchItem }
  | { type: 'pending'; item: ConnectionItem }
  | { type: 'connection'; item: ConnectionItem }
  | { type: 'empty'; message: string };

export function FriendsAndFamilyScreen({ navigation }: FriendsAndFamilyProps) {
  const { selectedRole } = useApp();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [searchId, setSearchId] = useState('');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Real-time user search by health ID
  const {
    data: searchData,
    isFetching: isSearching,
  } = useQuery({
    queryKey: ['users', 'search', searchId],
    queryFn: () => searchUserByHealthId(selectedRole, searchId),
    enabled: searchId.trim().length >= 3,
    staleTime: 30_000,
  });

  // Current connections
  const {
    data: connectionsData,
    isLoading: connectionsLoading,
    refetch: refetchConnections,
  } = useQuery({
    queryKey: ['connections'],
    queryFn: () => fetchConnections(selectedRole),
    staleTime: 60_000,
    enabled: !!selectedRole,
  });

  // Pending incoming requests
  const {
    data: pendingData,
    isLoading: pendingLoading,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ['connections', 'pending'],
    queryFn: () => fetchPendingRequests(selectedRole),
    staleTime: 30_000,
    enabled: !!selectedRole,
  });

  const connections = connectionsData?.connections ?? [];
  const pending = pendingData?.connections ?? [];
  const searchResults = searchData?.users ?? [];

  const handleRefresh = useCallback(() => {
    refetchConnections();
    refetchPending();
  }, [refetchConnections, refetchPending]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['connections'] });
    queryClient.invalidateQueries({ queryKey: ['users', 'search'] });
  };

  const handleSendRequest = async (healthId: string) => {
    try {
      setActionInProgress(healthId);
      setFeedbackMsg(null);
      const result = await followByHealthId(selectedRole, healthId);
      setFeedbackMsg({ text: `Request sent to ${result.user.full_name || result.user.email}`, type: 'success' });
      invalidateAll();
    } catch (err) {
      setFeedbackMsg({ text: (err as ApiFailure).message, type: 'error' });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleAction = async (connectionId: string, action: 'accepted' | 'rejected') => {
    try {
      setActionInProgress(connectionId);
      setFeedbackMsg(null);
      await actionConnection(selectedRole, connectionId, action);
      setFeedbackMsg({
        text: action === 'accepted' ? 'Connection accepted!' : 'Request declined.',
        type: action === 'accepted' ? 'success' : 'error',
      });
      invalidateAll();
    } catch (err) {
      setFeedbackMsg({ text: (err as ApiFailure).message, type: 'error' });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleNavigate = (route: MainRouteName) => navigation.navigate(route);

  // Build flat list sections
  const sections: SectionType[] = [];

  // Search results
  if (searchId.trim().length >= 3) {
    sections.push({ type: 'sectionHeader', title: 'Search Results', count: searchResults.length });
    if (searchResults.length > 0) {
      searchResults.forEach((item) => sections.push({ type: 'searchResult', item }));
    } else if (!isSearching) {
      sections.push({ type: 'empty', message: 'No users found for this Health ID' });
    }
  }

  // Pending requests
  if (pending.length > 0) {
    sections.push({ type: 'sectionHeader', title: 'Incoming Requests', count: pending.length });
    pending.forEach((item) => sections.push({ type: 'pending', item }));
  }

  // Connections
  sections.push({ type: 'sectionHeader', title: 'My Connections', count: connections.length });
  if (connections.length > 0) {
    connections.forEach((item) => sections.push({ type: 'connection', item }));
  } else if (!connectionsLoading) {
    sections.push({ type: 'empty', message: 'No connections yet. Search by Health ID above!' });
  }

  const getInitials = (name?: string | null, email?: string) => {
    if (name) {
      return name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    }
    return (email ?? '??').slice(0, 2).toUpperCase();
  };

  const renderItem = ({ item }: { item: SectionType }) => {
    switch (item.type) {
      case 'sectionHeader':
        return (
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>{item.title}</Text>
            {item.count !== undefined && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{item.count}</Text>
              </View>
            )}
          </View>
        );

      case 'searchResult': {
        const u = item.item;
        const busy = actionInProgress === u.health_id;
        return (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <View style={[styles.avatar, u.role === 'DOCTOR' && styles.avatarDoctor]}>
                <Text style={styles.avatarText}>{getInitials(u.full_name, u.health_id ?? undefined)}</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.userName} numberOfLines={1}>
                  {u.full_name || u.health_id || 'Unknown'}
                </Text>
                <Text style={styles.healthIdLabel}>{u.health_id}</Text>
                <Text style={styles.roleLabel}>{u.role}</Text>
              </View>
              {u.connection_status === 'none' ? (
                <Pressable
                  style={[styles.actionBtn, styles.addBtn]}
                  onPress={() => u.health_id && handleSendRequest(u.health_id)}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <MaterialIcons name="person-add" size={16} color="#fff" />
                      <Text style={styles.actionBtnText}>Add</Text>
                    </>
                  )}
                </Pressable>
              ) : u.connection_status === 'pending' ? (
                <View style={[styles.actionBtn, styles.pendingBtn]}>
                  <MaterialIcons name="schedule" size={16} color={theme.colors.accent} />
                  <Text style={[styles.actionBtnText, { color: theme.colors.accent }]}>Pending</Text>
                </View>
              ) : u.connection_status === 'accepted' ? (
                <View style={[styles.actionBtn, styles.connectedBtn]}>
                  <MaterialIcons name="check-circle" size={16} color={theme.colors.success} />
                  <Text style={[styles.actionBtnText, { color: theme.colors.success }]}>Connected</Text>
                </View>
              ) : null}
            </View>
          </View>
        );
      }

      case 'pending': {
        const c = item.item;
        const busy = actionInProgress === c.connection_id;
        return (
          <View style={[styles.card, styles.pendingCard]}>
            <View style={styles.cardRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(c.user.full_name, c.user.email)}</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.userName} numberOfLines={1}>
                  {c.user.full_name || c.user.email}
                </Text>
                <Text style={styles.healthIdLabel}>{c.user.health_id ?? '—'}</Text>
              </View>
              <View style={styles.pendingActions}>
                <Pressable
                  style={[styles.smallBtn, styles.acceptBtn]}
                  onPress={() => handleAction(c.connection_id, 'accepted')}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <MaterialIcons name="check" size={18} color="#fff" />
                  )}
                </Pressable>
                <Pressable
                  style={[styles.smallBtn, styles.rejectBtn]}
                  onPress={() => handleAction(c.connection_id, 'rejected')}
                  disabled={busy}
                >
                  <MaterialIcons name="close" size={18} color={theme.colors.danger} />
                </Pressable>
              </View>
            </View>
          </View>
        );
      }

      case 'connection': {
        const c = item.item;
        return (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <View style={[styles.avatar, styles.avatarConnected]}>
                <Text style={styles.avatarText}>{getInitials(c.user.full_name, c.user.email)}</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.userName} numberOfLines={1}>
                  {c.user.full_name || c.user.email}
                </Text>
                <Text style={styles.healthIdLabel}>{c.user.health_id ?? '—'}</Text>
                <Text style={styles.roleLabel}>{c.user.role}</Text>
              </View>
              <View style={[styles.actionBtn, styles.connectedBtn]}>
                <MaterialIcons name="check-circle" size={16} color={theme.colors.success} />
                <Text style={[styles.actionBtnText, { color: theme.colors.success }]}>Connected</Text>
              </View>
            </View>
          </View>
        );
      }

      case 'empty':
        return (
          <View style={styles.emptyRow}>
            <MaterialIcons name="people-outline" size={24} color={theme.colors.textSoft} />
            <Text style={styles.emptyText}>{item.message}</Text>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={navigation.goBack} style={styles.backBtn} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={22} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Friends & Family</Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchBox}>
          <MaterialIcons name="badge" size={20} color={theme.colors.textSoft} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by Health ID (e.g. HW-A3F2B1C0)"
            placeholderTextColor={theme.colors.textSoft}
            value={searchId}
            onChangeText={(t) => {
              setSearchId(t);
              setFeedbackMsg(null);
            }}
            autoCapitalize="characters"
            returnKeyType="search"
          />
          {searchId.length > 0 && (
            <Pressable onPress={() => setSearchId('')} hitSlop={8}>
              <MaterialIcons name="close" size={18} color={theme.colors.textSoft} />
            </Pressable>
          )}
          {isSearching && <ActivityIndicator size="small" color={theme.colors.primary} />}
        </View>
        {feedbackMsg && (
          <Text style={[styles.feedbackText, feedbackMsg.type === 'error' && styles.feedbackError]}>
            {feedbackMsg.text}
          </Text>
        )}
      </View>

      {/* Content */}
      {connectionsLoading && pendingLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading connections...</Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item, index) => {
            if (item.type === 'sectionHeader') return `sh-${item.title}`;
            if (item.type === 'searchResult') return `sr-${item.item.user_id}`;
            if (item.type === 'pending') return `p-${item.item.connection_id}`;
            if (item.type === 'connection') return `c-${item.item.connection_id}`;
            return `e-${index}`;
          }}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
            />
          }
        />
      )}

      {/* Bottom Nav */}
      <BottomNav
        activeRoute="FriendsAndFamily"
        insetsBottom={insets.bottom}
        onNavigate={handleNavigate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  backBtn: {
    marginRight: theme.spacing.md,
  },
  headerTitle: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  searchWrapper: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.text,
    padding: 0,
  },
  feedbackText: {
    ...theme.typography.caption,
    color: theme.colors.success,
    marginTop: theme.spacing.xs,
  },
  feedbackError: {
    color: theme.colors.danger,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    ...theme.typography.subheading,
    color: theme.colors.text,
  },
  countBadge: {
    backgroundColor: theme.colors.primarySoft,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  pendingCard: {
    borderColor: theme.colors.accent,
    borderWidth: 1.5,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarDoctor: {
    backgroundColor: '#e8f5e9',
  },
  avatarConnected: {
    backgroundColor: '#e3f2fd',
  },
  avatarText: {
    ...theme.typography.label,
    color: theme.colors.primaryDark,
    fontSize: 15,
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    ...theme.typography.bodyStrong,
    color: theme.colors.text,
  },
  healthIdLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontFamily: 'monospace',
  },
  roleLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSoft,
    fontSize: 11,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
  },
  addBtn: {
    backgroundColor: theme.colors.primary,
  },
  pendingBtn: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  connectedBtn: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.success,
  },
  actionBtnText: {
    ...theme.typography.label,
    color: '#fff',
    fontSize: 13,
  },
  pendingActions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  smallBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: {
    backgroundColor: theme.colors.success,
  },
  rejectBtn: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.danger,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.lg,
    justifyContent: 'center',
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.textSoft,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  loadingText: {
    ...theme.typography.body,
    color: theme.colors.textSoft,
  },
});
