import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  type DimensionValue,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { theme } from '../lib/theme';
import HeroSecureSvg from '../../assets/images/Hero Illustration Container_margin.svg';

/* eslint-disable @typescript-eslint/no-require-imports */
const imgMargin1 = require('../../assets/images/Margin-1.png');
const imgMargin2 = require('../../assets/images/Margin-2.png');
const imgMargin = require('../../assets/images/Margin.png');
/* eslint-enable @typescript-eslint/no-require-imports */

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/* ───────── slide data ───────── */

type Slide = {
  key: string;
  label?: string;
  title: string;
  titleAccent?: string;
  subtitle: string;
  illustration: React.ReactNode;
};

/* ──── illustrations (pure RN) ──── */

function ChartBar({ height, accent }: { height: DimensionValue; accent?: boolean }) {
  return (
    <View
      style={[
        styles.chartBar,
        { height },
        accent ? styles.chartBarAccent : styles.chartBarDefault,
      ]}
    />
  );
}

function AIInsightsIllustration() {
  return (
    <View style={styles.illustrationContainer}>
      <View style={styles.decorativeOrb} />
      {/* Main chart card */}
      <View style={[styles.glassCard, styles.chartCard]}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={styles.chartLabel}>VITALITY INDEX</Text>
            <Text style={styles.chartValue}>94.2%</Text>
          </View>
          <View style={styles.chartIcon}>
            <Text style={styles.chartIconText}>📊</Text>
          </View>
        </View>
        <View style={styles.chartBars}>
          <ChartBar height="40%" />
          <ChartBar height="60%" />
          <ChartBar height="55%" />
          <ChartBar height="85%" />
          <ChartBar height="100%" accent />
          <ChartBar height="70%" />
          <ChartBar height="50%" />
        </View>
        <View style={styles.chartDays}>
          <Text style={styles.chartDay}>MON</Text>
          <Text style={styles.chartDay}>TUE</Text>
          <Text style={styles.chartDay}>WED</Text>
          <Text style={styles.chartDay}>THU</Text>
          <Text style={[styles.chartDay, styles.chartDayAccent]}>FRI</Text>
          <Text style={styles.chartDay}>SAT</Text>
          <Text style={styles.chartDay}>SUN</Text>
        </View>
      </View>
      {/* AI insight bubble */}
      <View style={[styles.glassCard, styles.insightBubble]}>
        <View style={styles.insightIcon}>
          <Text style={{ fontSize: 14 }}>💡</Text>
        </View>
        <View style={styles.insightContent}>
          <Text style={styles.insightLabel}>AI INSIGHT</Text>
          <Text style={styles.insightText}>
            Your recovery is 12% faster this week. Keep it up!
          </Text>
        </View>
      </View>
    </View>
  );
}

function TrackVitalsIllustration() {
  return (
    <View style={styles.illustrationContainer}>
      <View style={styles.decorativeOrb} />
      {/* Heart rate card */}
      <View style={[styles.glassCard, styles.vitalCard, { alignSelf: 'flex-end', marginRight: 20 }]}>
        <View style={styles.vitalHeader}>
          <Text style={{ fontSize: 12 }}>❤️</Text>
          <Text style={styles.vitalLabel}>HEART RATE</Text>
        </View>
        <Text style={styles.vitalValue}>72</Text>
        <Text style={styles.vitalUnit}>bpm</Text>
        <View style={styles.vitalBars}>
          <View style={[styles.vitalBar, { height: 16 }]} />
          <View style={[styles.vitalBar, { height: 24 }]} />
          <View style={[styles.vitalBar, { height: 12 }]} />
          <View style={[styles.vitalBar, { height: 28 }]} />
          <View style={[styles.vitalBar, styles.vitalBarAccent, { height: 20 }]} />
        </View>
      </View>
      {/* Blood pressure card */}
      <View style={[styles.glassCard, styles.vitalCard, { alignSelf: 'flex-start', marginLeft: 20, marginTop: -20 }]}>
        <View style={styles.vitalHeader}>
          <View style={styles.bpDot} />
          <Text style={styles.vitalLabel}>BLOOD PRESSURE</Text>
        </View>
        <Text style={styles.vitalValue}>120/80</Text>
        <View style={styles.bpRange}>
          <View style={styles.bpRangeBar} />
        </View>
        <Text style={styles.bpRangeText}>Optimal Range</Text>
      </View>
    </View>
  );
}

function SecureRecordsIllustration() {
  return (
    <View style={styles.illustrationContainer}>
      <View style={styles.decorativeOrb} />
      <HeroSecureSvg width={280} height={280} />
    </View>
  );
}

function FamilyMonitoringIllustration() {
  return (
    <View style={styles.illustrationContainer}>
      <View style={styles.decorativeOrb} />
      {/* Primary member (Margin.png - mom with child, circular) */}
      <View style={styles.familyPrimary}>
        <Image source={imgMargin} style={styles.avatarImageLarge} resizeMode="contain" />
        <Text style={styles.familyRole}>PRIMARY MEMBER</Text>
        <Text style={styles.familyName}>Aisha Patel</Text>
        <Text style={styles.familyVital}>Heart Rate: 72 BPM • Stable</Text>
      </View>
      {/* Children row */}
      <View style={styles.familyChildren}>
        <View style={styles.childCard}>
          <Image source={imgMargin1} style={styles.avatarImageSmall} resizeMode="contain" />
          <Text style={styles.childName}>Leo</Text>
        </View>
        <View style={styles.childCard}>
          <Image source={imgMargin2} style={styles.avatarImageSmall} resizeMode="contain" />
          <Text style={styles.childName}>David</Text>
        </View>
      </View>
      {/* Privacy badge */}
      <View style={[styles.glassCard, styles.privacyBadge]}>
        <View style={[styles.badgeDot, { backgroundColor: theme.colors.primary }]} />
        <Text style={styles.badgeText}>PRIVACY ENCRYPTED</Text>
      </View>
    </View>
  );
}

const SLIDES: Slide[] = [
  {
    key: 'ai-insights',
    title: 'Get personalized insights\n',
    titleAccent: 'powered by AI.',
    subtitle:
      'Unlock deep patterns in your health data with our advanced intelligence system.',
    illustration: <AIInsightsIllustration />,
  },
  {
    key: 'track-vitals',
    title: 'Track Vitals with Ease.',
    subtitle:
      'Keep an eye on heart rate, blood pressure, and more with our simple, intuitive tracking tools.',
    illustration: <TrackVitalsIllustration />,
  },
  {
    key: 'secure-records',
    label: 'SAFETY FIRST',
    title: 'Secure Records',
    subtitle:
      "Your data is safe and easily accessible. We use medical-grade encryption to ensure your family's health history remains private.",
    illustration: <SecureRecordsIllustration />,
  },
  {
    key: 'family-monitoring',
    title: 'Watch over your loved ones.',
    subtitle:
      'Easily monitor the health and vitals of your entire family from a single, secure dashboard.',
    illustration: <FamilyMonitoringIllustration />,
  },
];

/* ───────── main component ───────── */

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const flatListRef = useRef<FlatList<Slide>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [currentIndex, setCurrentIndex] = useState(0);

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false },
  );

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      setCurrentIndex(idx);
    },
    [],
  );

  const goNext = useCallback(() => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
      setCurrentIndex(currentIndex + 1);
    } else {
      onDone();
    }
  }, [currentIndex, onDone]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Slide>) => (
      <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
        {/* Illustration area */}
        <View style={styles.illustrationWrap}>{item.illustration}</View>

        {/* Text content */}
        <View style={styles.textSection}>
          {item.label ? (
            <Text style={styles.eyebrow}>{item.label}</Text>
          ) : null}
          <Text style={styles.slideTitle}>
            {item.title}
            {item.titleAccent ? (
              <Text style={styles.slideTitleAccent}>{item.titleAccent}</Text>
            ) : null}
          </Text>
          <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
        </View>
      </View>
    ),
    [],
  );

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.brand}>
          <Text style={styles.brandIcon}>🌿</Text>
          <Text style={styles.brandName}>FamWell</Text>
        </View>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>
            STEP {currentIndex + 1} OF {SLIDES.length}
          </Text>
        </View>
      </View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        keyExtractor={(s) => s.key}
        renderItem={renderItem}
        onScroll={onScroll}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={16}
      />

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((s, i) => {
          const inputRange = [
            (i - 1) * SCREEN_WIDTH,
            i * SCREEN_WIDTH,
            (i + 1) * SCREEN_WIDTH,
          ];
          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [6, 28, 6],
            extrapolate: 'clamp',
          });
          const dotOpacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View
              key={s.key}
              style={[
                styles.dot,
                { width: dotWidth, opacity: dotOpacity },
              ]}
            />
          );
        })}
      </View>

      {/* Bottom actions */}
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.nextButton, pressed && styles.nextButtonPressed]}
          onPress={goNext}
        >
          <Text style={styles.nextButtonText}>
            {currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          </Text>
          <Text style={styles.nextButtonArrow}>→</Text>
        </Pressable>
        <Pressable onPress={onDone} style={styles.skipButton}>
          <Text style={styles.skipText}>SKIP</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ───────── styles ───────── */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  /* header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 8,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandIcon: { fontSize: 20 },
  brandName: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.primaryDark,
    letterSpacing: -0.3,
  },
  stepBadge: {
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  stepBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.primary,
    letterSpacing: 1,
  },

  /* slide */
  slide: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  illustrationWrap: {
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  textSection: {
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 10,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  slideTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
    textAlign: 'center',
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  slideTitleAccent: {
    color: theme.colors.primary,
  },
  slideSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },

  /* dots */
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
  },

  /* footer */
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 36,
    gap: 12,
  },
  nextButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 999,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  nextButtonPressed: {
    transform: [{ scale: 0.97 }],
  },
  nextButtonText: {
    color: theme.colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  nextButtonArrow: {
    color: theme.colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSoft,
    letterSpacing: 2,
  },

  /* ── illustration shared ── */
  illustrationContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  decorativeOrb: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: theme.colors.primarySoft,
    opacity: 0.5,
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  /* ai insights illustration */
  chartCard: {
    padding: 20,
    width: 250,
    transform: [{ rotate: '-2deg' }],
    zIndex: 1,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  chartLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.textSoft,
    letterSpacing: 1,
    marginBottom: 2,
  },
  chartValue: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
  },
  chartIcon: {
    backgroundColor: 'rgba(47,127,49,0.1)',
    borderRadius: 999,
    padding: 8,
  },
  chartIconText: { fontSize: 18 },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 90,
    marginBottom: 8,
  },
  chartBar: {
    flex: 1,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
  },
  chartBarDefault: {
    backgroundColor: 'rgba(47,127,49,0.2)',
  },
  chartBarAccent: {
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  chartDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartDay: {
    fontSize: 8,
    fontWeight: '700',
    color: theme.colors.textSoft,
    letterSpacing: 0.5,
  },
  chartDayAccent: { color: theme.colors.primary },
  insightBubble: {
    position: 'absolute',
    right: -6,
    bottom: 60,
    padding: 12,
    width: 160,
    flexDirection: 'row',
    gap: 8,
    transform: [{ rotate: '3deg' }],
    zIndex: 2,
  },
  insightIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightContent: { flex: 1 },
  insightLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: theme.colors.accent,
    letterSpacing: 1,
    marginBottom: 2,
  },
  insightText: {
    fontSize: 10,
    lineHeight: 14,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },

  /* track vitals illustration */
  vitalCard: {
    padding: 18,
    width: 180,
    alignItems: 'center',
  },
  vitalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  vitalLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.textSoft,
    letterSpacing: 1,
  },
  vitalValue: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.text,
  },
  vitalUnit: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSoft,
    marginBottom: 8,
  },
  vitalBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 30,
    width: '100%',
  },
  vitalBar: {
    flex: 1,
    backgroundColor: 'rgba(47,127,49,0.2)',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  vitalBarAccent: { backgroundColor: theme.colors.primary },
  bpDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.secondary,
  },
  bpRange: {
    width: '100%',
    height: 6,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  bpRangeBar: {
    width: '65%',
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
  },
  bpRangeText: {
    fontSize: 10,
    color: theme.colors.textSoft,
    fontWeight: '600',
    marginTop: 4,
  },

  /* secure records illustration */
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.secondary,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: 0.5,
  },

  /* family monitoring illustration */
  familyPrimary: {
    alignItems: 'center',
    marginBottom: 16,
    zIndex: 1,
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarImageLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 8,
  },
  avatarImageSmall: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginBottom: 6,
  },
  familyRole: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.primary,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  familyName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 2,
  },
  familyVital: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  familyChildren: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
    zIndex: 1,
  },
  childCard: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    width: 90,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  childName: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    zIndex: 1,
  },
});
