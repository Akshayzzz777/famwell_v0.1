import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav } from '../components/BottomNav';
import { Card } from '../components/Card';
import { SectionContainer } from '../components/SectionContainer';
import { useRole } from '../context/RoleContext';
import { dashboardActions } from '../data/mockData';
import { useConnections } from '../hooks/useConnections';
import { useHealthInsights } from '../hooks/useHealthInsights';
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
  const { currentUser, selectedRole } = useRole();
  const { connections, error, loading } = useConnections();
  const { data: healthData, loading: healthLoading } = useHealthInsights();

  const navItems = mainNavItems.map((item) => {
    if (item.route === 'FamilyProfileScreen' && selectedRole === 'DOCTOR') {
      return { label: 'Doctor', route: 'FriendProfileScreen' as MainRouteName };
    }

    return item;
  });

  const handleNavigate = (route: MainRouteName) => {
    navigation.navigate(route);
  };

  const roleLabel = selectedRole === 'DOCTOR' ? 'Doctor' : 'Patient';
  const greeting = currentUser?.fullName || currentUser?.email || roleLabel;
  const visibleConnections = connections.slice(0, 4);

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
            <Text style={styles.heroTitle}>Hello, {greeting}</Text>
            <Text style={styles.heroSubtitle}>{currentUser?.healthId ? `Health ID: ${currentUser.healthId}` : 'Role-gated access is active for this session'}</Text>
          </View>
          <TouchableOpacity
            style={styles.heroAction}
            activeOpacity={0.85}
            onPress={() => handleNavigate('InboxScreen')}
          >
            <Text style={styles.heroActionLabel}>IN</Text>
          </TouchableOpacity>
        </View>

        <SectionContainer title="Family Members">
          {selectedRole === 'PATIENT' ? (
            <>
              <View style={styles.memberRow}>
                {visibleConnections.map((connection) => (
                  <View key={connection.connection_id} style={styles.memberItem}>
                    <View style={styles.memberAvatarFrame}>
                      <Text style={styles.memberPlaceholder}>
                        {(connection.user.full_name || connection.user.email || '--').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <Text numberOfLines={1} style={styles.memberName}>
                      {connection.user.full_name || connection.user.health_id || connection.user.email}
                    </Text>
                  </View>
                ))}
                {visibleConnections.length === 0 && !loading ? (
                  <Text style={styles.inlineNotice}>No connections found for this patient account.</Text>
                ) : null}
                {loading ? <Text style={styles.inlineNotice}>Loading connections...</Text> : null}
              </View>
              <TouchableOpacity activeOpacity={0.92} onPress={() => handleNavigate('ConnectionsScreen')} style={{ marginTop: 8 }}>
                <Text style={{ ...theme.typography.label, color: theme.colors.brand.sky700 }}>Manage Connections →</Text>
              </TouchableOpacity>
              {error ? <Text style={styles.inlineError}>{error.message}</Text> : null}
            </>
          ) : (
            <Text style={styles.inlineNotice}>Connections are available for patient accounts only.</Text>
          )}
        </SectionContainer>

        <SectionContainer title="Quick Actions">
          <View style={styles.quickGrid}>
            {dashboardActions.slice(0, 4).map((action) => {
              const accent = accentStyles[action.accent];
              const enabled = Boolean(selectedRole && (action.roles as readonly string[]).includes(selectedRole) && action.supported);

              return (
                <TouchableOpacity
                  key={action.route}
                  activeOpacity={enabled ? 0.92 : 1}
                  disabled={!enabled}
                  onPress={() => handleNavigate(action.route)}
                  style={styles.quickCell}
                >
                  <Card style={[styles.quickCard, !enabled && styles.quickCardDisabled]}>
                    <View style={[styles.quickBadge, { backgroundColor: accent.backgroundColor }]}>
                      <Text style={[styles.quickBadgeText, { color: accent.textColor }]}>{action.badge}</Text>
                    </View>
                    <View>
                      <Text style={styles.quickLabel}>{action.label}</Text>
                      {!enabled ? <Text style={styles.quickNote}>Not available for this role.</Text> : null}
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity activeOpacity={0.92} onPress={() => handleNavigate('ResultScreen')} style={styles.fullWidthAction}>
            <Card style={styles.resultStrip}>
              <View style={[styles.quickBadge, { backgroundColor: theme.colors.brand.teal50 }]}>
                <Text style={[styles.quickBadgeText, { color: theme.colors.brand.teal700 }]}>RS</Text>
              </View>
              <View style={styles.resultStripText}>
                <Text style={styles.resultStripTitle}>Results</Text>
                <Text style={styles.resultStripSubtitle}>Calls the live result endpoint for the current role and token.</Text>
              </View>
            </Card>
          </TouchableOpacity>
        </SectionContainer>

        <Card style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>Health Score</Text>
            <View style={styles.livePill}>
              <Text style={styles.livePillText}>{roleLabel}</Text>
            </View>
          </View>

          <View style={styles.statusBody}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{healthLoading ? '...' : healthData?.health_score != null ? healthData.health_score : '--'}</Text>
            </View>
            <View>
              <Text style={styles.statusSubtitle}>{currentUser?.email || 'Authenticated session active'}</Text>
              <Text style={styles.statusScore}>{healthData?.insights?.[0] ? (typeof healthData.insights[0] === 'object' && 'title' in healthData.insights[0] ? healthData.insights[0].title : String(healthData.insights[0])) : currentUser?.healthId || 'Upload a report to get insights'}</Text>
            </View>
          </View>
        </Card>
      </ScrollView>

      <BottomNav activeRoute="HomeDashboard" items={navItems} onNavigate={handleNavigate} />
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
    justifyContent: 'space-between',
    gap: theme.spacing[3],
    flexWrap: 'wrap',
  },
  memberItem: {
    alignItems: 'center',
    gap: theme.spacing[2],
    width: '22%',
  },
  memberAvatarFrame: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.md,
    borderWidth: 2,
    borderColor: theme.colors.neutrals.border,
    backgroundColor: theme.colors.neutrals.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberPlaceholder: {
    ...theme.typography.bodyStrong,
    color: theme.colors.neutrals.textSubtle,
  },
  memberName: {
    ...theme.typography.label,
    color: theme.colors.neutrals.textMuted,
    textAlign: 'center',
  },
  inlineNotice: {
    ...theme.typography.label,
    color: theme.colors.neutrals.textMuted,
  },
  inlineError: {
    ...theme.typography.label,
    color: theme.colors.accent.rose,
    marginTop: theme.spacing[3],
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
  quickCardDisabled: {
    opacity: 0.55,
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
  quickNote: {
    ...theme.typography.label,
    color: theme.colors.neutrals.textMuted,
    marginTop: theme.spacing[2],
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
