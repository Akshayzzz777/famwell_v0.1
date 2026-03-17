import { Platform } from 'react-native';

const runtimeSans =
  Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'System',
  }) ?? 'System';

export const fontFamilies = {
  designPrimary: 'Inter',
  runtimePrimary: runtimeSans,
} as const;

export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const fontSizes = {
  caption: 10,
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  title: 30,
  display: 36,
} as const;

export const lineHeights = {
  caption: 14,
  xs: 16,
  sm: 20,
  md: 24,
  lg: 24,
  xl: 28,
  xxl: 32,
  title: 36,
  display: 40,
} as const;

export const letterSpacing = {
  tight: -0.6,
  normal: 0,
  wide: 0.8,
  caps: 1.2,
} as const;

export const typography = {
  display: {
    fontFamily: fontFamilies.runtimePrimary,
    fontSize: fontSizes.display,
    lineHeight: lineHeights.display,
    fontWeight: fontWeights.bold,
    letterSpacing: letterSpacing.tight,
  },
  title: {
    fontFamily: fontFamilies.runtimePrimary,
    fontSize: fontSizes.title,
    lineHeight: lineHeights.title,
    fontWeight: fontWeights.bold,
    letterSpacing: letterSpacing.tight,
  },
  heading: {
    fontFamily: fontFamilies.runtimePrimary,
    fontSize: fontSizes.xxl,
    lineHeight: lineHeights.xxl,
    fontWeight: fontWeights.bold,
  },
  subheading: {
    fontFamily: fontFamilies.runtimePrimary,
    fontSize: fontSizes.lg,
    lineHeight: lineHeights.lg,
    fontWeight: fontWeights.semibold,
  },
  body: {
    fontFamily: fontFamilies.runtimePrimary,
    fontSize: fontSizes.md,
    lineHeight: lineHeights.md,
    fontWeight: fontWeights.regular,
  },
  bodyStrong: {
    fontFamily: fontFamilies.runtimePrimary,
    fontSize: fontSizes.md,
    lineHeight: lineHeights.md,
    fontWeight: fontWeights.semibold,
  },
  label: {
    fontFamily: fontFamilies.runtimePrimary,
    fontSize: fontSizes.sm,
    lineHeight: lineHeights.sm,
    fontWeight: fontWeights.medium,
  },
  caption: {
    fontFamily: fontFamilies.runtimePrimary,
    fontSize: fontSizes.caption,
    lineHeight: lineHeights.caption,
    fontWeight: fontWeights.semibold,
    letterSpacing: letterSpacing.caps,
    textTransform: 'uppercase',
  },
} as const;

export const fontManifest = {
  intendedPrimaryFamily: fontFamilies.designPrimary,
  runtimeFallbackFamily: fontFamilies.runtimePrimary,
  localFontAssetPresent: false,
} as const;

export type TypographyTokens = typeof typography;
