import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

import { BottomNav } from '../components/Layout';
import { ErrorCard, LoadingCard } from '../components/Feedback';
import { fetchInsights, type ApiFailure, type InsightsPayload } from '../lib/api';
import { theme } from '../lib/theme';
import { useApp } from '../state/AppContext';
import type { AIInsightsProps } from '../navigation';

const WEEK_BARS = [0.46, 0.62, 0.58, 0.82, 0.74, 0.46, 0.9];

export function AIInsightsScreen({ navigation }: AIInsightsProps) {
  const { currentUser, selectedRole } = useApp();
  const insets = useSafeAreaInsets();
  const [insights, setInsights] = useState<InsightsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiFailure | null>(null);

  const loadInsights = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const payload = await fetchInsights(selectedRole);
      setInsights(payload);
    } catch (failure) {
      setError(failure as ApiFailure);
    } finally {
      setLoading(false);
    }
  }, [selectedRole]);

  useFocusEffect(
    useCallback(() => {
      loadInsights();
    }, [loadInsights])
  );

  const cards = useMemo(
    () => [
      {
        title: 'Blood Pressure improved',
        subtitle: 'Your BP has stabilized in the healthy range this week. Keep up the consistent sleep schedule!',
        tag: 'Health Milestone',
        accent: theme.colors.primary,
        badge: 'Details',
      },
      {
        title: 'Stay Hydrated',
        subtitle: "You've only had 4 glasses today. Aim for 8 to keep your energy high!",
        tag: 'Daily Goal',
        accent: '#4A90E2',
        badge: 'Log Water',
        stripe: true,
      },
      {
        title: 'Time for a light walk',
        subtitle: 'Your recovery score is high. A 15-minute evening stroll would be perfect today.',
        tag: 'Active Recovery',
        accent: '#D97706',
        badge: 'Plan walk',
        pill: true,
      },
    ],
    []
  );

  const topBarHeight = insets.top + 74;

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { height: topBarHeight, paddingTop: insets.top + 10 }]}>
        <View style={styles.brandWrap}>
          <View style={styles.brandAvatar}>
            <Text style={styles.brandAvatarText}>{(currentUser?.fullName || currentUser?.email || 'F').trim().charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.brandTitle}>FamWell</Text>
        </View>
        <Pressable style={styles.iconButton}>
          <MaterialIcons color={theme.colors.textMuted} name="notifications-none" size={20} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: topBarHeight + 26,
          paddingBottom: insets.bottom + 118,
          paddingHorizontal: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Smart Health Insights</Text>
        </View>

        {loading ? <LoadingCard label="Loading AI insights..." /> : null}
        {error ? <ErrorCard message={error.message} onRetry={loadInsights} title="Insights unavailable" /> : null}

        {!loading && !error ? (
          <>
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>Weekly Health Score</Text>
                <View style={styles.scoreContainer}>
                  <Text style={styles.chartScore}>84/100</Text>
                  <Ionicons name="analytics-outline" size={18} style={styles.chartIcon} />
                </View>
              </View>

              <View style={styles.chartBars}>
                {WEEK_BARS.map((level, idx) => (
                  <View key={idx} style={styles.chartBarTrack}>
                    <View
                      style={[
                        styles.chartBar,
                        {
                          height: `${Math.round(level * 100)}%`,
                          backgroundColor: idx === WEEK_BARS.length - 1 ? theme.colors.primary : 'rgba(47,127,49,0.2)',
                        },
                      ]}
                    />
                  </View>
                ))}
              </View>
              <View style={styles.chartLabels}>
                {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d) => (
                  <Text key={d} style={styles.chartLabel}>
                    {d}
                  </Text>
                ))}
              </View>
            </View>

            <View style={styles.metricCard}>
              <View style={styles.metricRow}>
                <MaterialIcons color={theme.colors.primary} name="favorite" size={20} />
                <Text style={styles.metricValue}>
                  118/75 <Text style={styles.metricUnit}>mmHg</Text>
                </Text>
                <Pressable style={styles.chatButton} onPress={() => navigation.navigate('ConsultationChat')}>
                  <Text style={styles.chatButtonText}>AI Chat</Text>
                  <Ionicons color={theme.colors.white} name="chatbubble-ellipses" size={16} />
                </Pressable>
              </View>
            </View>

            {cards.map((card, idx) => (
              <View
                key={idx}
                style={[styles.insightCard, card.stripe && styles.insightStripe, card.pill && styles.insightPill]}
              >
                {idx === 0 || idx === 1 ? (
                  <View style={styles.banner}>
                    <MaterialIcons color={card.accent} name={idx === 0 ? 'favorite' : 'water-drop'} size={22} />
                  </View>
                ) : null}

                <View style={styles.cardBody}>
                  <View style={styles.cardMetaRow}>
                    <MaterialIcons color={card.accent} name="stars" size={14} />
                    <Text style={[styles.cardMeta, { color: card.accent }]}>{card.tag}</Text>
                  </View>
                  <Text style={styles.cardTitle}>{card.title}</Text>
                  <View style={styles.cardFooter}>
                    <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
                    <Pressable style={[styles.cardChip, { backgroundColor: card.accent }]}>
                      <Text style={styles.cardChipText}>{card.badge}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>

      <BottomNav activeRoute="AIInsights" insetsBottom={insets.bottom} onNavigate={(route) => navigation.navigate(route)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F6F8F6',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F6F8F6',
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  brandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    backgroundColor: '#FCE7DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#40493D',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#16532D',
  },
  iconButton: {
    padding: 8,
    borderRadius: 999,
  },
  body: {
    paddingBottom: 28,
  },
  hero: {
    alignItems: 'flex-start',
    paddingBottom: 12,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F170F',
    textAlign: 'left',
  },
  heroSubtitle: {
    fontSize: 12,
    color: '#6B7A71',
    textAlign: 'center',
  },
  chartCard: {
    marginTop: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(47,127,49,0.08)',
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chartIcon: {
    color: theme.colors.primary,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F170F',
  },
  chartScore: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  chartBars: {
    height: 96,
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
    fontSize: 10,
    color: '#7E8A83',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metricCard: {
    backgroundColor: 'rgba(47,127,49,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F170F',
  },
  metricUnit: {
    fontSize: 12,
    fontWeight: '400',
    color: '#637068',
  },
  chatButton: {
    marginLeft: 'auto',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatButtonText: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  insightCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(47,127,49,0.08)',
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  banner: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    backgroundColor: 'rgba(47,127,49,0.05)',
  },
  insightStripe: {
    backgroundColor: '#EBF4FF',
  },
  insightPill: {
    backgroundColor: '#FFF7E8',
  },
  cardBody: {
    padding: 16,
    gap: 8,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardMeta: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F170F',
    lineHeight: 22,
  },
  cardSubtitle: {
    flex: 1,
    fontSize: 13,
    color: '#5B675F',
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  cardChip: {
    minWidth: 96,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardChipText: {
    color: theme.colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
});
