/**
 * Lyceum theme barrel for the mobile-student app.
 *
 * Token source of truth for NativeWind classes lives in tailwind.config.js; this
 * module re-exposes the same tokens as JS values for the cases NativeWind can't
 * reach (SVG colors, ActivityIndicator, reanimated values, inline styles).
 */
export { colors, palette, type SemanticColor } from "./colors";
export { fontFamily, fontSize, fontWeight, type FontSizeToken } from "./typography";
export { radius, spacing, type RadiusToken, type SpacingToken } from "./spacing";

import { colors, palette } from "./colors";
import { fontFamily, fontSize, fontWeight } from "./typography";
import { radius, spacing } from "./spacing";

/** Convenience aggregate for `import { theme } from '../theme'`. */
export const theme = {
  colors,
  palette,
  fontFamily,
  fontSize,
  fontWeight,
  radius,
  spacing,
} as const;

export type Theme = typeof theme;
