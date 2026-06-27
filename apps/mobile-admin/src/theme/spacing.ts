/**
 * Spacing + radius tokens, mirroring tailwind.config.js borderRadius and the
 * Lyceum 4px spacing rhythm. Components prefer NativeWind classes; these JS
 * values exist for SVG sizing, animated values, and inline style needs.
 */

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

/** 4px rhythm. */
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
} as const;

export type RadiusToken = keyof typeof radius;
export type SpacingToken = keyof typeof spacing;
