export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
} as const;

export const radius = {
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999,
  full: 9999,
} as const;

export const layout = {
  screenPadding: spacing[6],
  cardPadding: spacing[4],
  sectionGap: spacing[8],
  contentGap: spacing[6],
  maxWidth: 420,
  bottomNavHeight: 88,
} as const;

export type SpacingTokens = typeof spacing;
