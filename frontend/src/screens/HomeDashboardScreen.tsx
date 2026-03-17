import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav } from '../components/BottomNav';
import { Card } from '../components/Card';
import { SectionContainer } from '../components/SectionContainer';
import { dashboardActions, familyMembers } from '../data/mockData';
import { mainNavItems } from '../navigation/mainNavItems';
import type { HomeDashboardProps, MainRouteName } from '../navigation/types';
import { theme } from '../styles/theme';

const accentStyles = {
  blue: { backgroundColor: theme.colors.accent.blueSoft, textColor: theme.colors.brand.blue500 },
  purple: { backgroundColor: theme.colors.accent.purpleSoft, textColor: theme.colors.brand.indigo600 },
  red: { backgroundColor: theme.colors.accent.redSoft, textColor: theme.colors.accent.rose },
  amber: { backgroundColor: theme.colors.accent.amberSoft, textColor: '#D97706' },
  teal: { backgroundColor: theme.colors.brand.teal50, textColor: theme.colors.brand.teal700 },
} as const;

export function HomeDashboardScreen({ navigation }: HomeDashboardProps) {
  const insets = useSafeAreaInsets();

  const handleNavigate = (route: MainRouteName) => {
    navigation.navigate(route);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + theme.spacing[6],
            paddingBottom: theme.layout.bottomNavHeight + insets.bottom + theme.spacing[6],
          },
        ]}
      >
        <View style={styles.hero}>
          <View>
            <Text style={styles.heroTitle}>Hello, Family</Text>
            <Text style={styles.heroSubtitle}>Keep everyone healthy today</Text>
          </View>
          <View style={styles.heroAction}>
            <Text style={styles.heroActionLabel}>AL</Text>
          </View>
        </View>

        <SectionContainer actionLabel="Manage" title="Family Members">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.memberRow}>
              {familyMembers.map((member) => (
                <View key={member.id} style={styles.memberItem}>
                  <View style={styles.memberAvatarFrame}>
                    <Image source={{ uri: member.imageUri }} style={styles.memberAvatar} />
                  </View>
                  <Text style={styles.memberName}>{member.name}</Text>
                </View>
              ))}
              <View style={styles.memberItem}>
                <TouchableOpacity activeOpacity={0.85} style={styles.addMemberButton}>
                  <Text style={styles.addMemberLabel}>+</Text>
                </TouchableOpacity>
                <Text style={styles.memberName}>Add</Text>
              </View>
            </View>
          </ScrollView>
        </SectionContainer>

        <SectionContainer title="Quick Actions">
          <View style={styles.quickGrid}>
            {dashboardActions.slice(0, 4).map((action) => {
              const accent = accentStyles[action.accent];

              return (
                <TouchableOpacity
                  key={action.route}
                  activeOpacity={0.92}
                  onPress={() => handleNavigate(action.route)}
                  style={styles.quickCell}
                >
                  <Card style={styles.quickCard}>
                    <View style={[styles.quickBadge, { backgroundColor: accent.backgroundColor }]}>
                      <Text style={[styles.quickBadgeText, { color: accent.textColor }]}>{action.badge}</Text>
                    </View>
                    <Text style={styles.quickLabel}>{action.label}</Text>
                  </Card>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => handleNavigate('ResultScreen')}
            style={styles.fullWidthAction}
          >
            <Card style={styles.resultStrip}>
              <View style={[styles.quickBadge, { backgroundColor: theme.colors.brand.teal50 }]}>
                <Text style={[styles.quickBadgeText, { color: theme.colors.brand.teal700 }]}>RS</Text>
              </View>
              <View style={styles.resultStripText}>
                <Text style={styles.resultStripTitle}>Results</Text>
                <Text style={styles.resultStripSubtitle}>Review extracted summaries and placeholder insights</Text>
              </View>
            </Card>
          </TouchableOpacity>
        </SectionContainer>

        <Card style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>Family Status</Text>
            <View style={styles.livePill}>
              <Text style={styles.livePillText}>Live Now</Text>
            </View>
          </View>

          <View style={styles.statusBody}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>OK</Text>
            </View>
            <View>
              <Text style={styles.statusSubtitle}>All vitals are normal</Text>
              <Text style={styles.statusScore}>Health Score: 94%</Text>
            </View>
          </View>
        </Card>
      </ScrollView>

      <BottomNav activeRoute="HomeDashboard" items={mainNavItems} onNavigate={handleNavigate} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.neutrals.background,
  },
  content: {
    paddingHorizontal: theme.spacing[6],
    gap: theme.spacing[8],
  },
  hero: {
    backgroundColor: theme.colors.brand.teal100,
    borderRadius: theme.radius.xl,
    padding: theme.spacing[6],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroTitle: {
    ...theme.typography.title,
    color: theme.colors.neutrals.textPrimary,
  },
  heroSubtitle: {
    ...theme.typography.label,
    color: theme.colors.neutrals.textMuted,
    marginTop: theme.spacing[1],
  },
  heroAction: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
  heroActionLabel: {
    ...theme.typography.caption,
    color: theme.colors.brand.teal500,
    textTransform: 'none',
    letterSpacing: 0,
  },
  memberRow: {
    flexDirection: 'row',
    gap: theme.spacing[4],
    paddingRight: theme.spacing[4],
  },
  memberItem: {
    alignItems: 'center',
    gap: theme.spacing[2],
  },
  memberAvatarFrame: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.colors.white,
    backgroundColor: theme.colors.brand.teal50,
    ...theme.shadows.card,
  },
  memberAvatar: {
    width: '100%',
    height: '100%',
  },
  memberName: {
    ...theme.typography.label,
    color: theme.colors.neutrals.textBody,
  },
  addMemberButton: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.colors.brand.teal200,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMemberLabel: {
    ...theme.typography.heading,
    color: theme.colors.brand.teal500,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing[4],
  },
  quickCell: {
    width: '47%',
  },
  quickCard: {
    minHeight: 140,
    justifyContent: 'space-between',
  },
  quickBadge: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickBadgeText: {
    ...theme.typography.label,
  },
  quickLabel: {
    ...theme.typography.bodyStrong,
    color: theme.colors.neutrals.textBody,
    lineHeight: theme.typography.bodyStrong.lineHeight,
  },
  fullWidthAction: {
    marginTop: theme.spacing[1],
  },
  resultStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[4],
  },
  resultStripText: {
    flex: 1,
    gap: theme.spacing[1],
  },
  resultStripTitle: {
    ...theme.typography.bodyStrong,
    color: theme.colors.neutrals.textPrimary,
  },
  resultStripSubtitle: {
    ...theme.typography.label,
    color: theme.colors.neutrals.textMuted,
  },
  statusCard: {
    backgroundColor: theme.colors.brand.teal500,
    borderColor: theme.colors.brand.teal500,
    borderRadius: 28,
    padding: theme.spacing[5],
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusTitle: {
    ...theme.typography.subheading,
    color: theme.colors.white,
  },
  livePill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
  },
  livePillText: {
    ...theme.typography.caption,
    color: theme.colors.white,
  },
  statusBody: {
    marginTop: theme.spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[4],
  },
  statusBadge: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadgeText: {
    ...theme.typography.bodyStrong,
    color: theme.colors.white,
  },
  statusSubtitle: {
    ...theme.typography.label,
    color: 'rgba(255,255,255,0.8)',
  },
  statusScore: {
    ...theme.typography.heading,
    color: theme.colors.white,
    marginTop: theme.spacing[1],
  },
});
