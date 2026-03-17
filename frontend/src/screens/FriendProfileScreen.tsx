import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BottomNav } from '../components/BottomNav';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { ProfileCard } from '../components/ProfileCard';
import { friendProfile } from '../data/mockData';
import { mainNavItems } from '../navigation/mainNavItems';
import type { FriendProfileProps } from '../navigation/types';
import { theme } from '../styles/theme';

export function FriendProfileScreen({ navigation }: FriendProfileProps) {
  return (
    <View style={styles.screen}>
      <Header backLabel="<" onBack={navigation.goBack} rightLabel="Share" title="Friend Profile" />

      <ScrollView contentContainerStyle={styles.content}>
        <ProfileCard
          accentColor={theme.colors.accent.rose}
          fallbackLabel="AR"
          imageUri={friendProfile.imageUri}
          name={friendProfile.name}
          showMockTag
          subtitle={friendProfile.subtitle}
        />

        <Card>
          <Text style={styles.sectionTitle}>Friend Notes</Text>
          <Text style={styles.notes}>{friendProfile.notes}</Text>
        </Card>

        <View style={styles.actions}>
          {friendProfile.actions.map((action) => (
            <TouchableOpacity key={action} activeOpacity={0.9}>
              <Card style={styles.actionCard}>
                <View style={styles.actionBadge}>
                  <Text style={styles.actionBadgeText}>{action.slice(0, 2).toUpperCase()}</Text>
                </View>
                <Text style={styles.actionText}>{action}</Text>
                <Text style={styles.chevron}>{'>'}</Text>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <BottomNav
        activeRoute="FamilyProfileScreen"
        items={mainNavItems}
        onNavigate={(route) => navigation.navigate(route)}
      />
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
  actionText: {
    ...theme.typography.bodyStrong,
    color: theme.colors.neutrals.textBody,
    flex: 1,
  },
  chevron: {
    ...theme.typography.bodyStrong,
    color: theme.colors.neutrals.textSubtle,
  },
});
