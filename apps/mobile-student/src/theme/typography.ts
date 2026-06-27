/**
 * Lyceum type scale + font families, mirroring tailwind.config.js fontSize/fontFamily.
 *
 * Display = Fraunces (serif, headings), UI = Schibsted Grotesk (body/labels),
 * Mono = Spline Sans Mono (code). Fonts must be loaded by the shell lane via
 * expo-font; until then these family names fall back to the platform default.
 */

export const fontFamily = {
  display: "Fraunces",
  ui: "Schibsted Grotesk",
  mono: "Spline Sans Mono",
} as const;

/** [fontSize, lineHeight] in px — matches the NativeWind fontSize scale. */
export const fontSize = {
  "2xs": { size: 11, line: 16 },
  xs: { size: 12, line: 18 },
  sm: { size: 13, line: 20 },
  base: { size: 16, line: 24 },
  lg: { size: 20, line: 28 },
  xl: { size: 25, line: 32 },
  "2xl": { size: 31, line: 38 },
  "3xl": { size: 39, line: 46 },
} as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

export type FontSizeToken = keyof typeof fontSize;
