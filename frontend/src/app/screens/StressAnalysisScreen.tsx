import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useQuery, useMutation } from '@tanstack/react-query';

import { BottomNav } from '../components/Layout';
import { ErrorCard } from '../components/Feedback';
import {
  type AskAiResponse,
  type HealthAnalysis,
  type HistoryEntry,
  type MetricDetail,
  askAiInsight,
  fetchHealthHistory,
  fetchLatestHealthInsights,
} from '../lib/api';
import { formatDate } from '../lib/format';
import { theme } from '../lib/theme';
import { useApp } from '../state/AppContext';
import type { StressAnalysisProps } from '../navigation';

// ── Helpers ──

function getMetricValue(
  metrics: Record<string, MetricDetail | string | number> | undefined,
  key: string,
): MetricDetail | null {
  if (!metrics) return null;
  const m = metrics[key];
  if (!m) return null;
  if (typeof m === 'object' && 'value' in m) return m as MetricDetail;
  return { value: m } as MetricDetail;
}

function statusColor(status?: string) {
  if (status === 'abnormal') return '#E34B55';
  if (status === 'borderline') return '#D97706';
  return theme.colors.primary;
}

function trendIcon(trend: string) {
  if (trend === 'improving') return 'trending-down';
  if (trend === 'worsening') return 'trending-up';
  return 'trending-flat';
}

function trendColor(trend: string) {
  if (trend === 'improving') return theme.colors.primary;
  if (trend === 'worsening') return '#E34B55';
  return '#D97706';
}

function stressLabel(score: number | null) {
  if (score == null) return 'No data';
  if (score <= 30) return 'Low';
  if (score <= 60) return 'Moderate';
  return 'High';
}

function stressColor(score: number | null) {
  if (score == null) return theme.colors.textMuted;
  if (score <= 30) return theme.colors.primary;
  if (score <= 60) return '#D97706';
  return '#E34B55';
}

// ── Mini bar chart component for historical data ──

function TrendChart({
  data,
  valueKey,
  maxVal,
}: {
  data: { date: string; value: number | null }[];
  valueKey: string;
  maxVal: number;
}) {
  if (data.length === 0) {
    return (
      <View style={s.emptyChart}>
        <Text style={s.emptyChartText}>No historical data available</Text>
      </View>
    );
  }

  const barData = data.slice().reverse(); // oldest → newest
  const safeMax = maxVal > 0 ? maxVal : 100;

  return (
    <View>
      <View style={s.chartBars}>
        {barData.map((item, idx) => {
          const val = item.value ?? 0;
          const height = Math.max(4, (val / safeMax) * 100);
          const isLast = idx === barData.length - 1;
          return (
            <View key={idx} style={s.chartBarTrack}>
              <View
                style={[
                  s.chartBar,
                  {
                    height: `${Math.round(height)}%`,
                    backgroundColor: isLast
                      ? stressColor(val)
                      : `${stressColor(val)}33`,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={s.chartLabels}>
        {barData.map((item, idx) => (
          <Text key={idx} style={s.chartLabel} numberOfLines={1}>
            {item.date
              ? new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
              : '—'}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ── Main Screen ──

export function StressAnalysisScreen({ navigation, route }: StressAnalysisProps) {
  const parameter = route.params?.parameter ?? 'stress_score';
  const { selectedRole } = useApp();
  const insets = useSafeAreaInsets();
  const [aiExpanded, setAiExpanded] = useState(false);

  const displayName = useMemo(() => {
    const names: Record<string, string> = {
      stress_score: 'Stress Score',
      heart_rate: 'Heart Rate',
      systolic_bp: 'Systolic BP',
      diastolic_bp: 'Diastolic BP',
      blood_pressure: 'Blood Pressure',
      glucose: 'Glucose',
      cholesterol: 'Cholesterol',
      hemoglobin: 'Hemoglobin',
      health_score: 'Health Score',
    };
    return names[parameter] ?? parameter.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }, [parameter]);

  // Fetch current analysis
  const {
    data: analysis,
    isLoading: loadingCurrent,
    error: currentError,
    refetch: refetchCurrent,
  } = useQuery<HealthAnalysis>({
    queryKey: ['healthData', selectedRole, 'latest'],
    queryFn: () => fetchLatestHealthInsights(selectedRole),
    enabled: Boolean(selectedRole),
  });

  // Fetch history
  const {
    data: historyPayload,
    isLoading: loadingHistory,
  } = useQuery({
    queryKey: ['healthHistory', selectedRole],
    queryFn: () => fetchHealthHistory(selectedRole, 10),
    enabled: Boolean(selectedRole),
  });

  // Ask AI mutation
  const askAi = useMutation({
    mutationFn: () => askAiInsight(selectedRole, parameter),
  });

  const handleAskAi = useCallback(() => {
    setAiExpanded(true);
    askAi.mutate();
  }, [askAi]);

  const handleAskAiInChat = useCallback(() => {
    navigation.navigate('ConsultationChat', {
      initialMessage: `Analyze my ${displayName} data with historical trends and give me detailed recommendations.`,
    });
  }, [navigation, displayName]);

  // Derive current values
  const currentMetric = useMemo(() => {
    if (parameter === 'stress_score') {
      return {
        value: analysis?.stress_score,
        unit: '/100',
        status: analysis?.stress_score != null
          ? analysis.stress_score <= 30 ? 'normal' : analysis.stress_score <= 60 ? 'borderline' : 'abnormal'
          : undefined,
      };
    }
    if (parameter === 'health_score') {
      return {
        value: analysis?.health_score,
        unit: '/100',
        status: analysis?.health_score != null
          ? analysis.health_score >= 70 ? 'normal' : analysis.health_score >= 40 ? 'borderline' : 'abnormal'
          : undefined,
      };
    }
    const m = getMetricValue(analysis?.metrics, parameter);
    return m ?? { value: null, unit: '', status: undefined };
  }, [analysis, parameter]);

  // Build history chart data
  const historyChartData = useMemo(() => {
    const entries = historyPayload?.history ?? [];
    return entries.map((entry: HistoryEntry) => {
      let val: number | null = null;
      if (parameter === 'stress_score') {
        val = entry.stress_score;
      } else if (parameter === 'health_score') {
        val = entry.health_score;
      } else {
        const m = getMetricValue(entry.metrics, parameter);
        if (m) {
          const parsed = typeof m.value === 'number' ? m.value : parseFloat(String(m.value));
          val = isNaN(parsed) ? null : parsed;
        }
      }
      return { date: entry.upload_date ?? '', value: val };
    });
  }, [historyPayload, parameter]);

  const chartMax = useMemo(() => {
    if (parameter === 'stress_score' || parameter === 'health_score') return 100;
    const vals = historyChartData.map((d) => d.value).filter((v): v is number => v != null);
    return vals.length > 0 ? Math.ceil(Math.max(...vals) * 1.2) : 100;
  }, [historyChartData, parameter]);

  // Derive comparison with previous
  const comparison = useMemo(() => {
    if (historyChartData.length < 2) return null;
    const current = historyChartData[0]?.value;
    const previous = historyChartData[1]?.value;
    if (current == null || previous == null) return null;
    const diff = current - previous;
    const pct = previous !== 0 ? Math.abs(diff / previous) * 100 : 0;
    return { diff, pct: Math.round(pct), direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat' as const };
  }, [historyChartData]);

  const loading = loadingCurrent || loadingHistory;
  const error = currentError ? { message: (currentError as Error).message } : null;
  const topBarHeight = insets.top + 56;

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={[s.topBar, { height: topBarHeight, paddingTop: insets.top + 8 }]}>
        <Pressable style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
        </Pressable>
        <Text style={s.topBarTitle}>{displayName} Analysis</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: topBarHeight + 16,
          paddingBottom: insets.bottom + 118,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={theme.colors.primary} size="large" />
            <Text style={s.loadingText}>Loading analysis...</Text>
          </View>
        ) : error ? (
          <ErrorCard message={error.message} onRetry={refetchCurrent} title="Unable to load data" />
        ) : (
          <>
            {/* Current Value Hero */}
            <View style={s.heroCard}>
              <View style={s.heroPattern}>
                <View style={s.heroIconCircle}>
                  <Ionicons
                    name={parameter === 'stress_score' ? 'pulse-outline' : parameter === 'health_score' ? 'analytics-outline' : 'heart-outline'}
                    size={28}
                    color={statusColor(currentMetric.status)}
                  />
                </View>
              </View>
              <View style={s.heroBody}>
                <View style={s.heroMetaRow}>
                  <MaterialIcons name="stars" size={14} color={statusColor(currentMetric.status)} />
                  <Text style={[s.heroMeta, { color: statusColor(currentMetric.status) }]}>
                    {currentMetric.status === 'normal' ? 'Healthy Range' : currentMetric.status === 'borderline' ? 'Borderline' : currentMetric.status === 'abnormal' ? 'Needs Attention' : 'Current Value'}
                  </Text>
                </View>
                <View style={s.heroValueRow}>
                  <Text style={[s.heroValue, { color: statusColor(currentMetric.status) }]}>
                    {currentMetric.value != null ? String(currentMetric.value) : '--'}
                    {currentMetric.unit ? (
                      <Text style={s.heroUnit}>{' '}{typeof currentMetric === 'object' && 'unit' in currentMetric ? (currentMetric as MetricDetail).unit ?? currentMetric.unit : currentMetric.unit}</Text>
                    ) : null}
                  </Text>
                  {comparison ? (
                    <View style={[s.changeBadge, { backgroundColor: comparison.direction === 'down' && (parameter === 'stress_score') ? `${theme.colors.primary}15` : comparison.direction === 'up' && (parameter === 'stress_score') ? '#E34B5515' : `${theme.colors.primary}15` }]}>
                      <MaterialIcons
                        name={comparison.direction === 'up' ? 'arrow-upward' : comparison.direction === 'down' ? 'arrow-downward' : 'remove'}
                        size={14}
                        color={
                          parameter === 'stress_score'
                            ? comparison.direction === 'down' ? theme.colors.primary : '#E34B55'
                            : comparison.direction === 'up' ? theme.colors.primary : '#E34B55'
                        }
                      />
                      <Text style={[s.changeText, {
                        color: parameter === 'stress_score'
                          ? comparison.direction === 'down' ? theme.colors.primary : '#E34B55'
                          : comparison.direction === 'up' ? theme.colors.primary : '#E34B55',
                      }]}>
                        {comparison.pct}%
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={s.heroLabel}>{displayName}</Text>
                {parameter === 'stress_score' && currentMetric.value != null ? (
                  <>
                    <View style={s.stressBarTrack}>
                      <View
                        style={[
                          s.stressBarFill,
                          {
                            width: `${currentMetric.value as number}%`,
                            backgroundColor: stressColor(currentMetric.value as number),
                          },
                        ]}
                      />
                    </View>
                    <Text style={[s.stressLevelText, { color: stressColor(currentMetric.value as number) }]}>
                      {stressLabel(currentMetric.value as number)} stress
                    </Text>
                  </>
                ) : null}
              </View>
            </View>

            {/* AI Insights from current analysis */}
            {analysis?.insights && analysis.insights.length > 0 ? (
              <View style={s.sectionCard}>
                <View style={s.sectionHeader}>
                  <Ionicons name="bulb-outline" size={18} color={theme.colors.primary} />
                  <Text style={s.sectionTitle}>AI Insights</Text>
                </View>
                {analysis.insights.map((insight, idx) => (
                  <View key={idx} style={s.insightRow}>
                    <View style={s.insightDot} />
                    <Text style={s.insightText}>{insight}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Historical Trend Chart */}
            <View style={s.sectionCard}>
              <View style={s.sectionHeader}>
                <Ionicons name="bar-chart-outline" size={18} color={theme.colors.primary} />
                <Text style={s.sectionTitle}>Historical Trend</Text>
                <Text style={s.sectionSubtitle}>{historyChartData.length} records</Text>
              </View>
              <TrendChart
                data={historyChartData}
                valueKey={parameter}
                maxVal={chartMax}
              />
            </View>

            {/* Past Records */}
            {(historyPayload?.history ?? []).length > 0 ? (
              <View style={s.sectionCard}>
                <View style={s.sectionHeader}>
                  <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
                  <Text style={s.sectionTitle}>Past Records</Text>
                </View>
                {(historyPayload?.history ?? []).slice(0, 5).map((entry, idx) => {
                  let val: string = '--';
                  if (parameter === 'stress_score') val = entry.stress_score != null ? String(entry.stress_score) : '--';
                  else if (parameter === 'health_score') val = entry.health_score != null ? String(entry.health_score) : '--';
                  else {
                    const m = getMetricValue(entry.metrics, parameter);
                    val = m?.value != null ? String(m.value) : '--';
                  }
                  const isCurrent = idx === 0;
                  return (
                    <View key={entry.record_id} style={[s.historyRow, isCurrent && s.historyRowCurrent]}>
                      <View style={s.historyLeft}>
                        <Text style={s.historyDate}>{formatDate(entry.upload_date)}</Text>
                        {entry.file_name ? <Text style={s.historyFile} numberOfLines={1}>{entry.file_name}</Text> : null}
                      </View>
                      <View style={s.historyRight}>
                        <Text style={[s.historyValue, isCurrent && { fontWeight: '700' }]}>{val}</Text>
                        {isCurrent ? (
                          <View style={s.currentBadge}>
                            <Text style={s.currentBadgeText}>Current</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {/* Recommendations */}
            {analysis?.recommendations && analysis.recommendations.length > 0 ? (
              <View style={s.sectionCard}>
                <View style={s.sectionHeader}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#D97706" />
                  <Text style={s.sectionTitle}>Recommendations</Text>
                </View>
                {analysis.recommendations.map((rec, idx) => (
                  <View key={idx} style={s.recRow}>
                    <View style={s.recNumber}>
                      <Text style={s.recNumberText}>{idx + 1}</Text>
                    </View>
                    <Text style={s.recText}>{rec}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Ask AI Section */}
            <View style={s.askAiCard}>
              <View style={s.sectionHeader}>
                <Ionicons name="sparkles-outline" size={18} color={theme.colors.primary} />
                <Text style={s.sectionTitle}>Deeper Analysis</Text>
              </View>
              <Text style={s.askAiDesc}>
                Get a personalized AI analysis of your {displayName} trend with contextual recommendations.
              </Text>
              <View style={s.askAiButtons}>
                <Pressable style={s.askAiBtn} onPress={handleAskAi} disabled={askAi.isPending}>
                  {askAi.isPending ? (
                    <ActivityIndicator color={theme.colors.white} size="small" />
                  ) : (
                    <Ionicons name="sparkles" size={16} color={theme.colors.white} />
                  )}
                  <Text style={s.askAiBtnText}>
                    {askAi.isPending ? 'Analyzing...' : 'Ask AI'}
                  </Text>
                </Pressable>
                <Pressable style={s.chatBtn} onPress={handleAskAiInChat}>
                  <Ionicons name="chatbubble-ellipses" size={16} color={theme.colors.primary} />
                  <Text style={s.chatBtnText}>Discuss in Chat</Text>
                </Pressable>
              </View>

              {/* AI Response Expandable */}
              {aiExpanded && askAi.data ? (
                <AiResponseSection response={askAi.data} />
              ) : null}
              {aiExpanded && askAi.isError ? (
                <View style={s.aiErrorWrap}>
                  <Text style={s.aiErrorText}>
                    {(askAi.error as Error)?.message ?? 'Unable to get AI response. Please try again.'}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Risks */}
            {analysis?.risks && analysis.risks.length > 0 ? (
              <View style={[s.sectionCard, { borderColor: '#E34B5520' }]}>
                <View style={s.sectionHeader}>
                  <Ionicons name="warning-outline" size={18} color="#E34B55" />
                  <Text style={[s.sectionTitle, { color: '#E34B55' }]}>Risk Factors</Text>
                </View>
                {analysis.risks.map((risk, idx) => (
                  <View key={idx} style={s.riskRow}>
                    <Ionicons name="alert-circle" size={14} color="#E34B55" />
                    <Text style={s.riskText}>{risk}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <BottomNav activeRoute="AIInsights" insetsBottom={insets.bottom} onNavigate={(route) => navigation.navigate(route as any)} />
    </View>
  );
}

// ── AI Response Sub-component ──

function AiResponseSection({ response }: { response: AskAiResponse }) {
  return (
    <View style={s.aiResponse}>
      {/* Trend Badge */}
      <View style={s.aiTrendRow}>
        <MaterialIcons
          name={trendIcon(response.trend)}
          size={20}
          color={trendColor(response.trend)}
        />
        <Text style={[s.aiTrendText, { color: trendColor(response.trend) }]}>
          {response.trend === 'improving' ? 'Improving' : response.trend === 'worsening' ? 'Worsening' : response.trend === 'stable' ? 'Stable' : 'Insufficient Data'}
        </Text>
        <View style={[s.confidenceBadge, { backgroundColor: response.confidence === 'high' ? `${theme.colors.primary}15` : response.confidence === 'medium' ? '#D9770615' : '#E34B5515' }]}>
          <Text style={[s.confidenceText, { color: response.confidence === 'high' ? theme.colors.primary : response.confidence === 'medium' ? '#D97706' : '#E34B55' }]}>
            {response.confidence} confidence
          </Text>
        </View>
      </View>

      {/* Explanation */}
      <Text style={s.aiExplanation}>{response.explanation}</Text>

      {/* Trend Summary */}
      {response.trend_summary ? (
        <View style={s.aiTrendSummaryWrap}>
          <Ionicons name="analytics-outline" size={14} color={theme.colors.textMuted} />
          <Text style={s.aiTrendSummary}>{response.trend_summary}</Text>
        </View>
      ) : null}

      {/* AI Recommendations */}
      {response.recommendations.length > 0 ? (
        <View style={s.aiRecSection}>
          <Text style={s.aiRecTitle}>Personalized Recommendations</Text>
          {response.recommendations.map((rec, idx) => (
            <View key={idx} style={s.aiRecRow}>
              <Ionicons name="checkmark-circle" size={14} color={theme.colors.primary} />
              <Text style={s.aiRecText}>{rec}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* AI Risks */}
      {response.risks.length > 0 ? (
        <View style={s.aiRiskSection}>
          {response.risks.map((risk, idx) => (
            <View key={idx} style={s.aiRiskRow}>
              <Ionicons name="alert-circle-outline" size={14} color="#E34B55" />
              <Text style={s.aiRiskText}>{risk}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ── Styles ──

const s = StyleSheet.create({
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
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F6F8F6',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(47,127,49,0.08)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F170F',
    textAlign: 'center',
    flex: 1,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 16,
  },
  loadingText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },

  // Hero card
  heroCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(47,127,49,0.08)',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  heroPattern: {
    width: '100%',
    aspectRatio: 21 / 9,
    backgroundColor: 'rgba(47,127,49,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  heroBody: {
    padding: 20,
    gap: 6,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroMeta: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  heroValue: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -1,
  },
  heroUnit: {
    fontSize: 14,
    fontWeight: '400',
    color: '#637068',
  },
  heroLabel: {
    fontSize: 13,
    color: '#637068',
    marginTop: 2,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  stressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginTop: 8,
  },
  stressBarFill: {
    height: 8,
    borderRadius: 4,
  },
  stressLevelText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },

  // Section cards
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(47,127,49,0.08)',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F170F',
    flex: 1,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },

  // Insights
  insightRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  insightDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
    marginTop: 7,
  },
  insightText: {
    ...theme.typography.body,
    color: '#5B675F',
    flex: 1,
    lineHeight: 20,
  },

  // Chart
  chartBars: {
    height: 100,
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
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    minHeight: 4,
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
    color: '#7E8A83',
    letterSpacing: 0.3,
  },
  emptyChart: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyChartText: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },

  // History rows
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  historyRowCurrent: {
    backgroundColor: 'rgba(47,127,49,0.04)',
    marginHorizontal: -18,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderBottomWidth: 0,
    marginBottom: 4,
  },
  historyLeft: {
    flex: 1,
    gap: 2,
  },
  historyDate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F170F',
  },
  historyFile: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  historyRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0F170F',
  },
  currentBadge: {
    backgroundColor: `${theme.colors.primary}15`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.primary,
    textTransform: 'uppercase',
  },

  // Recommendations
  recRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  recNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#D9770615',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recNumberText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  recText: {
    ...theme.typography.body,
    color: '#5B675F',
    flex: 1,
    lineHeight: 20,
  },

  // Ask AI
  askAiCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(47,127,49,0.12)',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  askAiDesc: {
    fontSize: 13,
    color: '#5B675F',
    lineHeight: 18,
    marginBottom: 14,
  },
  askAiButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  askAiBtn: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    height: 42,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  askAiBtnText: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  chatBtn: {
    flex: 1,
    backgroundColor: `${theme.colors.primary}10`,
    height: 42,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: `${theme.colors.primary}25`,
  },
  chatBtnText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },

  // AI Response
  aiResponse: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(47,127,49,0.08)',
    gap: 12,
  },
  aiTrendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiTrendText: {
    fontSize: 14,
    fontWeight: '700',
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  aiExplanation: {
    fontSize: 14,
    color: '#3A4A3E',
    lineHeight: 21,
  },
  aiTrendSummaryWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(47,127,49,0.04)',
    padding: 12,
    borderRadius: 12,
  },
  aiTrendSummary: {
    fontSize: 13,
    color: '#5B675F',
    lineHeight: 18,
    flex: 1,
  },
  aiRecSection: {
    gap: 8,
  },
  aiRecTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F170F',
    marginBottom: 4,
  },
  aiRecRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  aiRecText: {
    fontSize: 13,
    color: '#5B675F',
    lineHeight: 18,
    flex: 1,
  },
  aiRiskSection: {
    gap: 8,
    padding: 12,
    backgroundColor: '#E34B5508',
    borderRadius: 12,
  },
  aiRiskRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  aiRiskText: {
    fontSize: 13,
    color: '#9A3A3A',
    lineHeight: 18,
    flex: 1,
  },
  aiErrorWrap: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
  },
  aiErrorText: {
    fontSize: 13,
    color: '#E34B55',
    lineHeight: 18,
  },

  // Risks
  riskRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  riskText: {
    fontSize: 13,
    color: '#9A3A3A',
    lineHeight: 18,
    flex: 1,
  },
});
