import { colors } from './colors';
import { fontManifest, fontSizes, fontWeights, letterSpacing, lineHeights, typography } from './typography';
import { layout, radius, spacing } from './spacing';

export const shadows = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
  button: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 4,
  },
  floating: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6,
  },
} as const;

export const screenAccents = {
  splash: colors.brand.blue500,
  auth: colors.brand.blue500,
  dashboard: colors.brand.teal500,
  profile: colors.brand.sky500,
  utility: colors.brand.indigo600,
} as const;

export const componentTokens = {
  card: {
    backgroundColor: colors.neutrals.surface,
    borderColor: colors.neutrals.borderSoft,
    borderRadius: radius.lg,
    padding: layout.cardPadding,
  },
  input: {
    backgroundColor: colors.neutrals.surfaceMuted,
    borderColor: colors.neutrals.border,
    borderRadius: radius.md,
    minHeight: 52,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  button: {
    minHeight: 56,
    borderRadius: radius.md,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
  },
  header: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[12],
    paddingBottom: spacing[6],
  },
} as const;

export const designManifest = {
  sourceDirectory: 'stitch/',
  sourceScreens: [
    'splash-screen',
    'login-screen',
    'signup-screen',
    'home-dashboard',
    'family-member-profile',
    'emergency-contacts',
    'medication-reminders',
    'settings-page',
    'onboarding-screens',
  ],
  extractedSystem: {
    foundations: {
      baseBackground: colors.neutrals.background,
      primarySurface: colors.neutrals.surface,
      primaryText: colors.neutrals.textPrimary,
      secondaryText: colors.neutrals.textMuted,
      mainAccentFamilies: ['blue', 'teal', 'sky', 'sage', 'indigo'],
    },
    typography: {
      intendedFamily: fontManifest.intendedPrimaryFamily,
      runtimeFallback: fontManifest.runtimeFallbackFamily,
      localFontAssetPresent: fontManifest.localFontAssetPresent,
      sizes: fontSizes,
      weights: fontWeights,
      lineHeights,
      letterSpacing,
    },
    spacing,
    radius,
    shadows,
    repeatedPatterns: [
      'Centered auth cards on soft slate backgrounds',
      'White cards with soft borders and low-elevation shadows',
      'Rounded inputs and CTA buttons with 16px corners',
      'Feature cards using 24px to 32px radii',
      'Bottom navigation with compact uppercase or bold 10px labels',
      'Screen headers with generous 24px horizontal padding and 48px top inset',
    ],
  },
} as const;

export const theme = {
  colors,
  spacing,
  radius,
  layout,
  typography,
  shadows,
  componentTokens,
  screenAccents,
  designManifest,
} as const;

export type Theme = typeof theme;
