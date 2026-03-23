import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BottomNav } from '../components/BottomNav';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProfileCard } from '../components/ProfileCard';
import { useRole } from '../context/RoleContext';
import { useInsights } from '../hooks/useInsights';
import { useRecords } from '../hooks/useRecords';
import { mainNavItems } from '../navigation/mainNavItems';
import type { FriendProfileProps, MainRouteName } from '../navigation/types';
import { theme } from '../styles/theme';

export function FriendProfileScreen({ navigation }: FriendProfileProps) {
  const { currentUser, selectedRole } = useRole();
  const { insights, loading: insightsLoading, error: insightsError, refresh: refreshInsights } = useInsights();
  const { records, loading: recordsLoading, error: recordsError, refresh: refreshRecords } = useRecords();
  const visibleRecords = records.slice(0, 3);

  const navItems = mainNavItems.map((item) => {
    if (item.route === 'FamilyProfileScreen') {
      return { label: 'Doctor', route: 'FriendProfileScreen' as MainRouteName };
    }

    return item;
  });

  return (
    <View style={styles.screen}>
      <Header backLabel="<" onBack={navigation.goBack} rightLabel={currentUser?.healthId ?? 'Doctor'} title="Friend Profile" />

      <ScrollView contentContainerStyle={styles.content}>
        <ProfileCard
          accentColor={theme.colors.accent.rose}
          fallbackLabel={(currentUser?.fullName || currentUser?.email || '--').slice(0, 2).toUpperCase()}
          name={currentUser?.fullName || 'Doctor View'}
          subtitle={currentUser?.email || 'Authenticated doctor account'}
        />

        <Card>
          <Text style={styles.sectionTitle}>Insights</Text>
          <Text style={styles.notes}>
            {selectedRole !== 'DOCTOR'
              ? 'Switch to Doctor to view this screen.'
              : insightsLoading
                ? 'Loading insights...'
                : insights?.message || 'No insights returned.'}
          </Text>
          {insightsError ? (
            <View style={styles.retryWrap}>
              <Text style={styles.errorText}>{insightsError.message}</Text>
              {insightsError.retryable ? <PrimaryButton label="Retry" onPress={refreshInsights} variant="secondary" /> : null}
            </View>
          ) : null}
        </Card>

        {selectedRole === 'DOCTOR' ? (
          <View style={styles.actions}>
            {visibleRecords.map((record) => (
              <TouchableOpacity key={record.record_id} activeOpacity={1}>
                <Card style={styles.actionCard}>
                  <View style={styles.actionBadge}>
                    <Text style={styles.actionBadgeText}>{record.record_type.slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={styles.actionCopy}>
                    <Text style={styles.actionText}>{record.record_type}</Text>
                    <Text style={styles.actionMeta}>{new Date(record.updated_at).toLocaleDateString()}</Text>
                  </View>
                  <Text style={styles.chevron}>{'>'}</Text>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {selectedRole === 'DOCTOR' && !recordsLoading && records.length === 0 ? (
          <Card>
            <Text style={styles.sectionTitle}>Records</Text>
            <Text style={styles.notes}>No records are available for this account yet.</Text>
          </Card>
        ) : null}

        {recordsError ? (
          <Card>
            <Text style={styles.sectionTitle}>Records Error</Text>
            <Text style={styles.errorText}>{recordsError.message}</Text>
            {recordsError.retryable ? (
              <View style={styles.retryWrap}>
                <PrimaryButton label="Retry" onPress={refreshRecords} variant="secondary" />
              </View>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>

      <BottomNav activeRoute="FriendProfileScreen" items={navItems} onNavigate={(route) => navigation.navigate(route)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.brand.sage50,
  },
  content: {
    paddingHorizontal: theme.spacing[6],
    paddingTop: theme.spacing[6],
    paddingBottom: theme.layout.bottomNavHeight + theme.spacing[6],
    gap: theme.spacing[6],
  },
  sectionTitle: {
    ...theme.typography.bodyStrong,
    color: theme.colors.neutrals.textBody,
    marginBottom: theme.spacing[3],
  },
  notes: {
    ...theme.typography.body,
    color: theme.colors.neutrals.textMuted,
  },
  actions: {
    gap: theme.spacing[3],
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[4],
  },
  actionBadge: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.accent.redSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBadgeText: {
    ...theme.typography.label,
    color: theme.colors.accent.rose,
  },
  actionCopy: {
    flex: 1,
  },
  actionText: {
    ...theme.typography.bodyStrong,
    color: theme.colors.neutrals.textBody,
  },
  actionMeta: {
    ...theme.typography.label,
    color: theme.colors.neutrals.textMuted,
    marginTop: theme.spacing[1],
  },
  chevron: {
    ...theme.typography.bodyStrong,
    color: theme.colors.neutrals.textSubtle,
  },
  errorText: {
    ...theme.typography.body,
    color: theme.colors.accent.rose,
  },
  retryWrap: {
    marginTop: theme.spacing[4],
    gap: theme.spacing[3],
  },
});
