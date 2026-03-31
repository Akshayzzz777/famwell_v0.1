import React, { useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { BottomNav } from '../components/Layout';
import { theme } from '../lib/theme';
import {
  fetchRecommendedDoctors,
  searchDoctors,
  followByHealthId,
  type ApiFailure,
  type DoctorItem,
} from '../lib/api';
import { useApp } from '../state/AppContext';
import type { FindDoctorProps, MainRouteName } from '../navigation';

type SearchTab = 'specialty' | 'healthId';

export function FindDoctorScreen({ navigation }: FindDoctorProps) {
  const { selectedRole } = useApp();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<SearchTab>('specialty');
  const [searchQuery, setSearchQuery] = useState('');
  const [healthId, setHealthId] = useState('');
  const [connectMsg, setConnectMsg] = useState<string | null>(null);
  const [connectErr, setConnectErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Recommended doctors
  const {
    data: recommended,
    isLoading: recLoading,
    refetch: refetchRec,
  } = useQuery({
    queryKey: ['doctors', 'recommended'],
    queryFn: () => fetchRecommendedDoctors(selectedRole),
    staleTime: 5 * 60_000,
    enabled: !!selectedRole,
  });

  // Search results (specialty/name)
  const {
    data: searchResult,
    isFetching: searching,
  } = useQuery({
    queryKey: ['doctors', 'search', searchQuery],
    queryFn: () => searchDoctors(selectedRole, searchQuery),
    enabled: activeTab === 'specialty' && searchQuery.trim().length >= 2,
    staleTime: 60_000,
  });

  // Health ID real-time search
  const {
    data: healthIdResult,
    isFetching: healthIdSearching,
  } = useQuery({
    queryKey: ['doctors', 'search', 'healthId', healthId],
    queryFn: () => searchDoctors(selectedRole, healthId.trim()),
    enabled: activeTab === 'healthId' && healthId.trim().length >= 3,
    staleTime: 60_000,
  });

  const doctors: DoctorItem[] =
    activeTab === 'healthId' && healthId.trim().length >= 3
      ? healthIdResult?.doctors ?? []
      : activeTab === 'specialty' && searchQuery.trim().length >= 2
        ? searchResult?.doctors ?? []
        : recommended?.doctors ?? [];

  const showingSearch =
    (activeTab === 'specialty' && searchQuery.trim().length >= 2) ||
    (activeTab === 'healthId' && healthId.trim().length >= 3);

  const handleConnect = async () => {
    if (!healthId.trim()) return;
    try {
      setSubmitting(true);
      setConnectErr(null);
      setConnectMsg(null);
      const conn = await followByHealthId(selectedRole, healthId);
      setHealthId('');
      setConnectMsg(`Connected with ${conn.user.full_name || conn.user.email}`);
    } catch (err) {
      setConnectErr((err as ApiFailure).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNavigate = (route: MainRouteName) => navigation.navigate(route);

  const renderDoctorCard = ({ item }: { item: DoctorItem }) => (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        {/* Avatar */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.name
              .replace(/^Dr\.\s*/i, '')
              .split(' ')
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </Text>
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.doctorName} numberOfLines={1}>
              {item.name}
            </Text>
            <MaterialIcons name="verified" size={16} color={theme.colors.primary} />
          </View>
          <Text style={styles.specialization}>{item.specialization}</Text>
          {item.reason ? (
            <View style={styles.reasonBadge}>
              <MaterialIcons name="auto-awesome" size={12} color={theme.colors.accent} />
              <Text style={styles.reasonText}>{item.reason}</Text>
            </View>
          ) : null}
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{item.experience}</Text>
            <View style={styles.ratingBadge}>
              <MaterialIcons name="star" size={14} color="#f5a623" />
              <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
            </View>
          </View>
        </View>

        {/* Book button */}
        <Pressable
          style={styles.bookButton}
          onPress={() => {
            followByHealthId(selectedRole, item.health_id)
              .then(() => refetchRec())
              .catch(() => {});
          }}
        >
          <Text style={styles.bookButtonText}>Book</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={navigation.goBack} style={styles.backBtn} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={22} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Find a Doctor</Text>
      </View>

      {/* Search Tabs */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, activeTab === 'specialty' && styles.tabActive]}
          onPress={() => setActiveTab('specialty')}
        >
          <MaterialIcons
            name="search"
            size={18}
            color={activeTab === 'specialty' ? '#fff' : theme.colors.textMuted}
          />
          <Text
            style={[styles.tabLabel, activeTab === 'specialty' && styles.tabLabelActive]}
          >
            Specialty / Name
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'healthId' && styles.tabActive]}
          onPress={() => setActiveTab('healthId')}
        >
          <MaterialIcons
            name="badge"
            size={18}
            color={activeTab === 'healthId' ? '#fff' : theme.colors.textMuted}
          />
          <Text
            style={[styles.tabLabel, activeTab === 'healthId' && styles.tabLabelActive]}
          >
            Health ID
          </Text>
        </Pressable>
      </View>

      {/* Search / Health ID Input */}
      <View style={styles.inputWrapper}>
        {activeTab === 'specialty' ? (
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={20} color={theme.colors.textSoft} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by specialty or name..."
              placeholderTextColor={theme.colors.textSoft}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <MaterialIcons name="close" size={18} color={theme.colors.textSoft} />
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.healthIdRow}>
            <View style={[styles.searchBox, { flex: 1 }]}>
              <MaterialIcons name="badge" size={20} color={theme.colors.textSoft} />
              <TextInput
                style={styles.searchInput}
                placeholder="Enter Health ID (e.g. DOC105)"
                placeholderTextColor={theme.colors.textSoft}
                value={healthId}
                onChangeText={(t) => {
                  setHealthId(t);
                  setConnectMsg(null);
                  setConnectErr(null);
                }}
                autoCapitalize="characters"
                returnKeyType="done"
                onSubmitEditing={handleConnect}
              />
            </View>
            <Pressable
              style={[styles.connectBtn, (!healthId.trim() || submitting) && styles.connectBtnDisabled]}
              onPress={handleConnect}
              disabled={!healthId.trim() || submitting}
            >
              <Text style={styles.connectBtnText}>{submitting ? '...' : 'Connect'}</Text>
            </Pressable>
          </View>
        )}
        {connectMsg ? <Text style={styles.successText}>{connectMsg}</Text> : null}
        {connectErr ? <Text style={styles.errorText}>{connectErr}</Text> : null}
      </View>

      {/* Section Title */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {showingSearch
            ? activeTab === 'healthId'
              ? 'Health ID Results'
              : 'Search Results'
            : 'Recommended Doctors'}
        </Text>
        {(searching || healthIdSearching) && (
          <Text style={styles.loadingText}>Searching...</Text>
        )}
      </View>

      {/* Doctor List */}
      {recLoading && !showingSearch ? (
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Finding doctors...</Text>
        </View>
      ) : doctors.length === 0 ? (
        <View style={styles.centered}>
          <MaterialIcons name="search-off" size={40} color={theme.colors.textSoft} />
          <Text style={styles.emptyText}>
            {showingSearch ? 'No doctors match your search.' : 'No recommendations yet.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={doctors}
          keyExtractor={(item) => item.id}
          renderItem={renderDoctorCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Bottom Nav */}
      <BottomNav
        activeRoute="FindDoctor"
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
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tabActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  tabLabel: {
    ...theme.typography.label,
    color: theme.colors.textMuted,
  },
  tabLabelActive: {
    color: '#fff',
  },
  inputWrapper: {
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
  healthIdRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  connectBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: theme.radius.sm,
  },
  connectBtnDisabled: {
    opacity: 0.5,
  },
  connectBtnText: {
    ...theme.typography.label,
    color: '#fff',
  },
  successText: {
    ...theme.typography.caption,
    color: theme.colors.success,
    marginTop: theme.spacing.xs,
  },
  errorText: {
    ...theme.typography.caption,
    color: theme.colors.danger,
    marginTop: theme.spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    ...theme.typography.subheading,
    color: theme.colors.text,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 100,
    gap: theme.spacing.sm,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...theme.typography.label,
    color: theme.colors.primaryDark,
    fontSize: 16,
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  doctorName: {
    ...theme.typography.bodyStrong,
    color: theme.colors.text,
  },
  specialization: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  reasonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  reasonText: {
    ...theme.typography.caption,
    color: theme.colors.accent,
    fontSize: 11,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: 4,
  },
  metaText: {
    ...theme.typography.caption,
    color: theme.colors.textSoft,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    ...theme.typography.caption,
    color: theme.colors.text,
    fontWeight: '600',
  },
  bookButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
  },
  bookButtonText: {
    ...theme.typography.label,
    color: '#fff',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: theme.spacing.sm,
  },
  loadingText: {
    ...theme.typography.body,
    color: theme.colors.textSoft,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.textSoft,
    textAlign: 'center',
  },
});
