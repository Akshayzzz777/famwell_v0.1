import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav } from '../components/Layout';
import { computeHealthScore, formatDate, initialLetters, titleCase } from '../lib/format';
import {
  healthCheck,
  fetchConnections,
  fetchInsights,
  fetchRecords,
  type ApiFailure,
  type ConnectionItem,
  type HealthPayload,
  type InsightsPayload,
  type RecordItem,
} from '../lib/api';
import { theme } from '../lib/theme';
import { useApp } from '../state/AppContext';
import type { HomeDashboardProps } from '../navigation';

type FamilyMember = {
  key: string;
  name: string;
  shortLabel: string;
  initial: string;
  accent: string;
  fill: string;
  border: string;
  active?: boolean;
};

type RecentActivityItem = {
  key: string;
  title: string;
  detail: string;
  icon: keyof typeof MaterialIcons.glyphMap | keyof typeof MaterialCommunityIcons.glyphMap;
  family: 'MaterialIcons' | 'MaterialCommunityIcons';
  accent: string;
  fill: string;
};

const BAR_LEVELS = [0.5, 0.75, 0.67, 1, 0.8, 0.5, 0.9];
const MEMBER_COLORS = [
  { accent: theme.colors.primary, fill: 'rgba(47,127,49,0.12)', border: 'rgba(47,127,49,0.22)' },
  { accent: '#5B7CE2', fill: '#E9F0FF', border: '#D8E3FF' },
  { accent: '#9B6EF3', fill: '#F1E9FF', border: '#E4D6FF' },
  { accent: '#D78838', fill: '#FFF0E2', border: '#F7DEC4' },
];
const FALLBACK_MEMBERS = ['Rajesh', 'Sunita', 'Aarav'];

function firstName(value?: string | null) {
  if (!value) {
    return 'Akshay';
  }

  const clean = value.trim();
  if (!clean) {
    return 'Akshay';
  }

  return clean.split(/\s+/)[0];
}

export function HomeDashboardScreen({ navigation }: HomeDashboardProps) {
  const { activeJob, currentUser, logout, selectedRole, setHealthScore } = useApp();
  const insets = useSafeAreaInsets();
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [insights, setInsights] = useState<InsightsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiFailure | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!selectedRole) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [healthPayload, recordsPayload, insightsPayload, connectionsPayload] = await Promise.all([
        healthCheck(),
        fetchRecords(selectedRole),
        fetchInsights(selectedRole),
        selectedRole === 'PATIENT' ? fetchConnections(selectedRole) : Promise.resolve({ connections: [] }),
      ]);

      setHealth(healthPayload);
      setRecords(recordsPayload?.records ?? []);
      setInsights(insightsPayload);
      setConnections(connectionsPayload?.connections ?? []);
    } catch (failure) {
      setError(failure as ApiFailure);
    } finally {
      setLoading(false);
    }
  }, [selectedRole]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  const healthScore = useMemo(
    () =>
      computeHealthScore({
        recordsCount: records.length,
        connectionsCount: connections.length,
        hasInsights: Boolean(insights?.message),
        apiHealthy: health?.status === 'healthy',
      }),
    [connections.length, health?.status, insights?.message, records.length]
  );

  useEffect(() => {
    setHealthScore(healthScore);
  }, [healthScore, setHealthScore]);

  const familyMembers = useMemo<FamilyMember[]>(() => {
    const seeds = [
      {
        key: 'me',
        name: currentUser?.fullName || firstName(currentUser?.email),
        shortLabel: 'Me',
        initial: initialLetters(currentUser?.fullName || currentUser?.email).slice(0, 1) || 'A',
        active: true,
      },
      ...connections.slice(0, 3).map((connection, index) => ({
        key: connection.connection_id,
        name: connection.user.full_name || connection.user.email,
        shortLabel: firstName(connection.user.full_name || connection.user.email),
        initial: initialLetters(connection.user.full_name || connection.user.email).slice(0, 1),
        active: false,
        index: index + 1,
      })),
    ];

    while (seeds.length < 4) {
      const fallbackName = FALLBACK_MEMBERS[seeds.length - 1] || `Member ${seeds.length}`;
      seeds.push({
        key: `fallback-${seeds.length}`,
        name: fallbackName,
        shortLabel: fallbackName,
        initial: fallbackName.charAt(0).toUpperCase(),
        active: false,
      });
    }

    return seeds.slice(0, 4).map((member, index) => ({
      key: member.key,
      name: member.name,
      shortLabel: member.shortLabel,
      initial: member.initial || member.name.charAt(0).toUpperCase(),
      accent: MEMBER_COLORS[index].accent,
      fill: MEMBER_COLORS[index].fill,
      border: MEMBER_COLORS[index].border,
      active: Boolean(member.active),
    }));
  }, [connections, currentUser?.email, currentUser?.fullName]);

  const quickActions = useMemo(
    () => [
      {
        key: 'upload',
        label: 'Upload Docs',
        icon: 'upload-file' as const,
        family: 'MaterialIcons' as const,
        onPress: () => navigation.navigate('UploadDocuments'),
      },
      {
        key: 'insights',
        label: 'AI Insights',
        icon: 'auto-awesome' as const,
        family: 'MaterialIcons' as const,
        onPress: () => navigation.navigate('AIInsights'),
      },
      {
        key: 'doctor',
        label: 'Family/Friend',
        icon: 'account-group-outline' as const,
        family: 'MaterialCommunityIcons' as const,
        onPress: () => navigation.navigate('FriendsAndFamily'),
      },
      {
        key: 'consultation',
        label: 'Consultation',
        icon: 'video-call' as const,
        family: 'MaterialIcons' as const,
        onPress: () => navigation.navigate('ConsultationChat'),
      },
    ],
    [navigation]
  );

  const recentActivity = useMemo<RecentActivityItem[]>(() => {
    const lastConnection = connections[0];
    const lastRecord = records[0];
    const reportLabel = activeJob?.fileName || (lastRecord ? titleCase(lastRecord.record_type) : 'Blood Test Results');
    const recordDate = formatDate(lastRecord?.updated_at || lastRecord?.created_at);

    return [
      {
        key: 'consultation',
        title: 'Last consultation',
        detail: lastConnection
          ? `${firstName(lastConnection.user.full_name || lastConnection.user.email)} � ${formatDate(lastConnection.created_at)}`
          : 'Dr. Sarah Johnson � 2 days ago',
        icon: 'medical-services',
        family: 'MaterialIcons',
        accent: '#3B82F6',
        fill: '#E8F0FF',
      },
      {
        key: 'report',
        title: 'Latest report upload',
        detail: `${reportLabel} � ${activeJob?.fileName ? 'Today' : recordDate}`,
        icon: 'description',
        family: 'MaterialIcons',
        accent: '#2F7F31',
        fill: '#E6F4E7',
      },
      {
        key: 'prescription',
        title: 'Prescription update',
        detail: insights?.message ? `${insights.message.slice(0, 26)}${insights.message.length > 26 ? '...' : ''}` : 'Vitamin D3 � 3 days ago',
        icon: 'pill',
        family: 'MaterialCommunityIcons',
        accent: '#D97706',
        fill: '#FFF0DF',
      },
    ];
  }, [activeJob?.fileName, connections, insights?.message, records]);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 110,
          paddingHorizontal: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerIdentity}>
            <View style={styles.profileRing}>
              <View style={styles.profileAvatar}>
                <MaterialIcons color={theme.colors.primary} name="person" size={28} />
              </View>
            </View>
            <View>
              <Text style={styles.headerTitle}>Hello, {firstName(currentUser?.fullName || currentUser?.email)} {'\u{1F44B}'}</Text>
              <Text style={styles.headerSubtitle}>Keep up your healthy habits!</Text>
            </View>
          </View>
          <Pressable onPress={logout} style={styles.notificationButton}>
            <MaterialIcons color={theme.colors.textMuted} name="notifications-none" size={20} />
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Family Members</Text>
          <Pressable onPress={() => navigation.navigate('FindDoctor')}>
            <Text style={styles.linkText}>Add Member</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.familyScroll} contentContainerStyle={styles.familyScrollContent}>
          {familyMembers.map((member) => (
            <Pressable key={member.key} onPress={() => navigation.navigate('FamilyProfiles')} style={styles.memberItem}>
              <View style={[styles.memberRing, { borderColor: member.active ? theme.colors.primary : member.border }]}> 
                <View style={[styles.memberFill, { backgroundColor: member.fill }]}> 
                  <Text style={[styles.memberInitial, { color: member.accent }]}>{member.initial}</Text>
                </View>
              </View>
              <Text style={[styles.memberLabel, member.active && styles.memberLabelActive]} numberOfLines={1}>{member.shortLabel}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Weekly Health Score</Text>
            <Text style={styles.scoreText}>{healthScore}/100</Text>
          </View>
          <View style={styles.chartRow}>
            {BAR_LEVELS.map((level, index) => {
              const active = index === BAR_LEVELS.length - 1;
              return (
                <View key={`bar-${index}`} style={styles.chartBarTrack}>
                  <View
                    style={[
                      styles.chartBar,
                      {
                        height: `${Math.round(level * 100)}%`,
                        backgroundColor: active ? theme.colors.primary : 'rgba(47,127,49,0.2)',
                      },
                    ]}
                  />
                </View>
              );
            })}
          </View>
          <View style={styles.chartLabels}>
            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((label) => (
              <Text key={label} style={styles.chartLabel}>{label}</Text>
            ))}
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Health Summary</Text>
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          </View>
          <View style={styles.summaryGrid}>
            <View style={styles.metricColumn}>
              <MaterialIcons color="#E34B55" name="favorite" size={18} />
              <Text style={styles.metricLabel}>HEART RATE</Text>
              <Text style={styles.metricValue}>72 <Text style={styles.metricUnit}>bpm</Text></Text>
              <Text style={styles.metricHint}>Normal</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricColumn}>
              <MaterialCommunityIcons color="#4A81E1" name="heart-pulse" size={18} />
              <Text style={styles.metricLabel}>BP</Text>
              <Text style={styles.metricValue}>120/80</Text>
              <Text style={styles.metricHint}>Stable</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricColumn}>
              <MaterialCommunityIcons color="#DD8A3E" name="brain" size={18} />
              <Text style={styles.metricLabel}>STRESS</Text>
              <Text style={styles.metricValue}>Low</Text>
              <Text style={styles.metricHint}>Managed</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickGrid}>
            {quickActions.map((action) => (
              <Pressable key={action.key} onPress={action.onPress} style={styles.quickCard}>
                <View style={styles.quickIconWrap}>
                  {action.family === 'MaterialCommunityIcons' ? (
                    <MaterialCommunityIcons color={theme.colors.primary} name={action.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']} size={24} />
                  ) : (
                    <MaterialIcons color={theme.colors.primary} name={action.icon as React.ComponentProps<typeof MaterialIcons>['name']} size={24} />
                  )}
                </View>
                <Text style={styles.quickLabel}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <Pressable onPress={() => navigation.navigate('PatientRecords')}>
            <Text style={styles.linkText}>View All</Text>
          </Pressable>
        </View>

        <View style={styles.activityList}>
          {recentActivity.map((item) => (
            <View key={item.key} style={styles.activityCard}>
              <View style={[styles.activityIconWrap, { backgroundColor: item.fill }]}> 
                {item.family === 'MaterialCommunityIcons' ? (
                  <MaterialCommunityIcons color={item.accent} name={item.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']} size={20} />
                ) : (
                  <MaterialIcons color={item.accent} name={item.icon as React.ComponentProps<typeof MaterialIcons>['name']} size={20} />
                )}
              </View>
              <View style={styles.activityCopy}>
                <Text style={styles.activityTitle}>{item.title}</Text>
                <Text style={styles.activityDetail}>{item.detail}</Text>
              </View>
            </View>
          ))}
        </View>

        {loading ? (
          <View style={styles.noticeCard}>
            <ActivityIndicator color={theme.colors.primary} size="small" />
            <Text style={styles.noticeText}>Refreshing your dashboard...</Text>
          </View>
        ) : null}

        {error ? (
          <Pressable onPress={loadDashboard} style={styles.noticeCard}>
            <MaterialIcons color={theme.colors.danger} name="error-outline" size={18} />
            <Text style={styles.noticeText}>We couldn't refresh the latest details. Tap to try again.</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <BottomNav activeRoute="HomeDashboard" insetsBottom={insets.bottom} onNavigate={(route) => navigation.navigate(route)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F6F8F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 12,
  },
  profileRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(47,127,49,0.2)',
    padding: 2,
  },
  profileAvatar: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(47,127,49,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    color: '#121A13',
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 14,
    color: '#81908A',
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F5F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionBlock: {
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '600',
    color: '#121A13',
  },
  linkText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '500',
    color: theme.colors.primary,
  },
  familyScroll: {
    marginHorizontal: -4,
  },
  familyScrollContent: {
    gap: 18,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  memberItem: {
    alignItems: 'center',
    gap: 8,
    width: 66,
  },
  memberRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    padding: 4,
  },
  memberFill: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitial: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '700',
  },
  memberLabel: {
    fontSize: 11,
    lineHeight: 13,
    color: '#7C8682',
  },
  memberLabelActive: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  card: {
    marginTop: 24,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(47,127,49,0.1)',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: '#121A13',
  },
  scoreText: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  chartRow: {
    height: 84,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  chartBarTrack: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: '100%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  chartLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
    color: '#98A2A0',
    letterSpacing: 0.8,
  },
  summaryCard: {
    marginTop: 24,
    backgroundColor: 'rgba(47,127,49,0.1)',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(47,127,49,0.18)',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  summaryTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  liveBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  liveBadgeText: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '700',
    color: theme.colors.white,
    letterSpacing: 0.8,
  },
  summaryGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  metricColumn: {
    flex: 1,
    gap: 4,
  },
  metricDivider: {
    width: 1,
    backgroundColor: 'rgba(47,127,49,0.18)',
    marginHorizontal: 12,
  },
  metricLabel: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '700',
    color: '#7C8682',
    letterSpacing: 0.7,
  },
  metricValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: '#121A13',
  },
  metricUnit: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '400',
    color: '#121A13',
  },
  metricHint: {
    fontSize: 10,
    lineHeight: 12,
    fontStyle: 'italic',
    color: theme.colors.primary,
  },
  quickGrid: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  quickCard: {
    width: '48%',
    minHeight: 108,
    borderRadius: 16,
    backgroundColor: '#F3F5F3',
    borderWidth: 1,
    borderColor: '#EEF2EE',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 18,
    gap: 10,
  },
  quickIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(47,127,49,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
    color: '#37433C',
    textAlign: 'center',
  },
  activityList: {
    marginTop: 14,
    gap: 14,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1,
    borderColor: '#EEF2EE',
  },
  activityIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityCopy: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    color: '#121A13',
  },
  activityDetail: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 14,
    color: '#7C8682',
  },
  noticeCard: {
    marginTop: 18,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: '#EEF2EE',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#55645D',
  },
});



