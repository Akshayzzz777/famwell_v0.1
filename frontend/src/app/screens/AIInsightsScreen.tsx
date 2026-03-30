import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

import { BottomNav } from '../components/Layout';
import { ErrorCard } from '../components/Feedback';
import { InsightsSkeleton } from '../components/Skeleton';
import { type MetricDetail, type InsightItem, type StructuredInsight } from '../lib/api';
import { theme } from '../lib/theme';
import { useApp } from '../state/AppContext';
import { useHealthData } from '../hooks/useHealthData';
import type { AIInsightsProps } from '../navigation';

const DEFAULT_BARS = [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3];

export function AIInsightsScreen({ navigation }: AIInsightsProps) {
  const { currentUser, selectedRole } = useApp();
  const insets = useSafeAreaInsets();
  const { data: analysis, isLoading: loading, error: queryError, refetch } = useHealthData();

  const error = queryError ? { message: (queryError as Error).message } : null;
  const loadInsights = refetch;

  const scoreDisplay = analysis?.health_score != null ? `${analysis.health_score}/100` : '--/100';
  const stressScore = analysis?.stress_score;

  const weekBars = useMemo(() => {
    if (!analysis?.health_score) return DEFAULT_BARS;
    const base = analysis.health_score / 100;
    return DEFAULT_BARS.map((_, i) => Math.max(0.15, Math.min(1, base + (i - 3) * 0.06)));
  }, [analysis?.health_score]);

  function metricString(key: string): string {
    if (!analysis?.metrics) return '--';
    const m = analysis.metrics[key];
    if (!m) return '--';
    if (typeof m === 'string' || typeof m === 'number') return String(m);
    const detail = m as MetricDetail;
    const unit = detail.unit ? ` ${detail.unit}` : '';
    return `${detail.value}${unit}`;
  }

  function metricDetail(key: string): MetricDetail | null {
    if (!analysis?.metrics) return null;
    const m = analysis.metrics[key];
    if (!m) return null;
    if (typeof m === 'object' && 'value' in m) return m as MetricDetail;
    return null;
  }

  const bpDisplay = metricString('blood_pressure') !== '--'
    ? metricString('blood_pressure')
    : metricString('systolic_bp') !== '--'
      ? `${metricString('systolic_bp')}/${metricString('diastolic_bp')}`
      : '--';

  // Map insight/recommendation text to a relevant parameter (fallback for plain strings)
  const PARAM_KEYWORDS: [string, string[]][] = [
    ['glucose', ['glucose', 'sugar', 'fasting', 'diabetes', 'hba1c', 'insulin', 'glyc']],
    ['cholesterol', ['cholesterol', 'ldl', 'hdl', 'lipid', 'triglyceride', 'statin']],
    ['hemoglobin', ['hemoglobin', 'hb', 'anemia', 'iron', 'blood count', 'hematocrit']],
    ['heart_rate', ['heart rate', 'pulse', 'bpm', 'tachycardia', 'bradycardia']],
    ['blood_pressure', ['blood pressure', 'bp', 'systolic', 'diastolic', 'hypertension', 'mmhg']],
    ['stress_score', ['stress', 'cortisol', 'anxiety', 'relaxation', 'sleep', 'mental']],
  ];

  function detectParameterFromText(text: string): string {
    const lower = text.toLowerCase();
    for (const [param, keywords] of PARAM_KEYWORDS) {
      if (keywords.some((kw) => lower.includes(kw))) return param;
    }
    return 'health_score';
  }

  // Normalize insight items: structured objects pass through, plain strings get keyword-detected category
  function normalizeInsight(item: InsightItem, fallbackId: string): StructuredInsight {
    if (typeof item === 'object' && 'id' in item && 'category' in item) {
      return item;
    }
    const text = typeof item === 'string' ? item : String(item);
    return {
      id: fallbackId,
      title: text.length > 50 ? text.slice(0, 50) + '...' : text,
      description: text,
      category: detectParameterFromText(text),
    };
  }

  // Build individual metric cards from analysis.metrics
  const metricCards = useMemo(() => {
    if (!analysis?.metrics) return [];
    const METRIC_LABELS: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
      heart_rate: { label: 'Heart Rate', icon: 'heart-outline' },
      glucose: { label: 'Fasting Glucose', icon: 'water-outline' },
      cholesterol: { label: 'Cholesterol', icon: 'fitness-outline' },
      hemoglobin: { label: 'Hemoglobin', icon: 'flask-outline' },
    };
    const skipKeys = new Set(['blood_pressure', 'systolic_bp', 'diastolic_bp']);
    return Object.keys(analysis.metrics)
      .filter((key) => !skipKeys.has(key))
      .map((key) => {
        const d = metricDetail(key);
        if (!d || d.value == null || d.value === '' || d.value === 'null') return null;
        const info = METRIC_LABELS[key] ?? {
          label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          icon: 'analytics-outline' as keyof typeof Ionicons.glyphMap,
        };
        const sColor =
          d.status === 'abnormal' ? '#E34B55' : d.status === 'borderline' ? '#D97706' : theme.colors.primary;
        return { key, ...info, detail: d, statusColor: sColor };
      })
      .filter(Boolean) as { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; detail: MetricDetail; statusColor: string }[];
  }, [analysis?.metrics]);

  const cards = useMemo(() => {
    const insightItems = (analysis?.insights ?? []).map((item, i) =>
      normalizeInsight(item, `insight_${i}`),
    );
    const recItemsRaw = analysis?.recommendations?.length
      ? analysis.recommendations
      : ['No specific recommendations — keep maintaining a healthy lifestyle.'];
    const recItems = recItemsRaw.map((item, i) =>
      normalizeInsight(item, `rec_${i}`),
    );
    const all = [
      ...insightItems.map((si, i) => ({
        id: si.id,
        title: si.title,
        subtitle: si.description,
        tag: 'Insight',
        accent: i === 0 ? theme.colors.primary : '#4A90E2',
        badge: 'Details',
        stripe: i % 2 === 1,
        pill: false,
        parameter: si.category,
      })),
      ...recItems.map((si) => ({
        id: si.id,
        title: si.title,
        subtitle: si.description,
        tag: 'Recommendation',
        accent: '#D97706',
        badge: 'Action',
        stripe: false,
        pill: true,
        parameter: si.category,
      })),
    ];
    return all.slice(0, 5);
  }, [analysis?.insights, analysis?.recommendations]);

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

        {loading ? <InsightsSkeleton /> : null}
        {error ? <ErrorCard message={error.message} onRetry={loadInsights} title="Insights unavailable" /> : null}

        {!loading && !error && !analysis?.health_score ? (
          <View style={styles.chartCard}>
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Ionicons name="document-text-outline" size={48} color={theme.colors.textMuted} />
              <Text style={[styles.chartTitle, { marginTop: 16, textAlign: 'center' }]}>No Health Data Yet</Text>
              <Text style={[styles.chartLabel, { marginTop: 8, textAlign: 'center', fontSize: 13, lineHeight: 18 }]}>
                Upload a medical report PDF to get AI-powered health insights, scores, and personalized recommendations.
              </Text>
              <Pressable
                style={[styles.chatButton, { marginTop: 20, paddingHorizontal: 24, paddingVertical: 10 }]}
                onPress={() => navigation.navigate('UploadDocuments')}
              >
                <Text style={styles.chatButtonText}>Upload Report</Text>
                <Ionicons color={theme.colors.white} name="cloud-upload-outline" size={16} />
              </Pressable>
            </View>
          </View>
        ) : null}

        {!loading && !error && analysis?.health_score ? (
          <>
            <Pressable style={styles.chartCard} onPress={() => navigation.navigate('StressAnalysis', { parameter: 'health_score' })}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>Weekly Health Score</Text>
                <View style={styles.scoreContainer}>
                  <Text style={styles.chartScore}>{scoreDisplay}</Text>
                  <Ionicons name="analytics-outline" size={18} style={styles.chartIcon} />
                </View>
              </View>

              <View style={styles.chartBars}>
                {weekBars.map((level, idx) => (
                  <View key={idx} style={styles.chartBarTrack}>
                    <View
                      style={[
                        styles.chartBar,
                        {
                          height: `${Math.round(level * 100)}%`,
                          backgroundColor: idx === weekBars.length - 1 ? theme.colors.primary : 'rgba(47,127,49,0.2)',
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
            </Pressable>

            <View style={styles.metricCard}>
              <View style={styles.metricRow}>
                <MaterialIcons color={theme.colors.primary} name="favorite" size={20} />
                <Text style={styles.metricValue}>
                  {bpDisplay} {bpDisplay !== '--' ? <Text style={styles.metricUnit}>mmHg</Text> : null}
                </Text>
                <Pressable style={styles.chatButton} onPress={() => navigation.navigate('StressAnalysis', { parameter: 'blood_pressure' })}>
                  <Text style={styles.chatButtonText}>Details</Text>
                  <Ionicons color={theme.colors.white} name="analytics-outline" size={16} />
                </Pressable>
              </View>
            </View>

            <Pressable style={styles.stressCard} onPress={() => navigation.navigate('StressAnalysis', { parameter: 'stress_score' })}>
              <View style={styles.stressHeader}>
                <Ionicons name="pulse-outline" size={18} color={stressScore != null && stressScore > 60 ? '#E34B55' : stressScore != null && stressScore > 30 ? '#D97706' : theme.colors.primary} />
                <Text style={styles.stressTitle}>Stress Score</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} style={{ marginLeft: 'auto' }} />
              </View>
              <Text style={styles.stressScore}>{stressScore != null ? stressScore : '--'}<Text style={styles.stressUnit}>/100</Text></Text>
              <View style={styles.stressBarTrack}>
                <View style={[styles.stressBarFill, { width: `${stressScore ?? 0}%`, backgroundColor: stressScore != null && stressScore > 60 ? '#E34B55' : stressScore != null && stressScore > 30 ? '#D97706' : theme.colors.primary }]} />
              </View>
              <Text style={styles.stressLabel}>{stressScore != null ? (stressScore <= 30 ? 'Low stress — keep it up!' : stressScore <= 60 ? 'Moderate stress — consider relaxation techniques.' : 'High stress — prioritize self-care.') : 'Upload a report to see your stress level.'}</Text>
            </Pressable>

            {/* Individual Metric Cards */}
            {metricCards.length > 0 ? (
              <View style={styles.metricsSection}>
                <Text style={styles.metricsSectionTitle}>Health Metrics</Text>
                {metricCards.map((mc) => (
                  <Pressable
                    key={mc.key}
                    style={styles.metricCardRow}
                    onPress={() => navigation.navigate('StressAnalysis', { parameter: mc.key })}
                  >
                    <View style={[styles.metricIconCircle, { backgroundColor: `${mc.statusColor}15` }]}>
                      <Ionicons name={mc.icon} size={18} color={mc.statusColor} />
                    </View>
                    <View style={styles.metricCardInfo}>
                      <Text style={styles.metricCardLabel}>{mc.label}</Text>
                      <Text style={styles.metricCardValue}>
                        {String(mc.detail.value)}
                        {mc.detail.unit ? <Text style={styles.metricCardUnit}> {mc.detail.unit}</Text> : null}
                      </Text>
                    </View>
                    <View style={[styles.metricStatusBadge, { backgroundColor: `${mc.statusColor}15` }]}>
                      <Text style={[styles.metricStatusText, { color: mc.statusColor }]}>
                        {mc.detail.status === 'abnormal' ? 'Abnormal' : mc.detail.status === 'borderline' ? 'Borderline' : 'Normal'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            ) : null}

            {cards.map((card) => (
              <Pressable
                key={card.id}
                style={[styles.insightCard, card.stripe && styles.insightStripe, card.pill && styles.insightPill]}
                onPress={() => navigation.navigate('StressAnalysis', {
                  parameter: card.parameter,
                  highlightTitle: card.title,
                  highlightDescription: card.subtitle,
                  highlightTag: card.tag,
                })}
              >
                <View style={styles.cardBody}>
                  <View style={styles.cardMetaRow}>
                    <MaterialIcons color={card.accent} name="stars" size={14} />
                    <Text style={[styles.cardMeta, { color: card.accent }]}>{card.tag}</Text>
                  </View>
                  <Text style={styles.cardTitle}>{card.title}</Text>
                  <View style={styles.cardFooter}>
                    <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
                    <View
                      style={[styles.cardChip, { backgroundColor: card.accent }]}
                    >
                      <Text style={styles.cardChipText}>{card.badge}</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
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
  stressCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(47,127,49,0.08)',
  },
  stressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  stressTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F170F',
  },
  stressScore: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F170F',
    marginBottom: 8,
  },
  stressUnit: {
    fontSize: 14,
    fontWeight: '400',
    color: '#637068',
  },
  stressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginBottom: 8,
  },
  stressBarFill: {
    height: 6,
    borderRadius: 3,
  },
  stressLabel: {
    fontSize: 12,
    color: '#637068',
    lineHeight: 16,
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
  metricsSection: {
    marginBottom: 12,
    gap: 8,
  },
  metricsSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F170F',
    marginBottom: 4,
  },
  metricCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(47,127,49,0.08)',
  },
  metricIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricCardInfo: {
    flex: 1,
    gap: 2,
  },
  metricCardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F170F',
  },
  metricCardValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F170F',
  },
  metricCardUnit: {
    fontSize: 11,
    fontWeight: '400',
    color: '#637068',
  },
  metricStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  metricStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
