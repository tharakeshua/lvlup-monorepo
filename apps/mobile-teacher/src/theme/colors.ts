/**
 * Lyceum ("Modern Scholarly") color tokens as concrete RN hex values.
 *
 * Source of truth mirror: apps/mobile-student/tailwind.config.js (NativeWind theme).
 * RN has no CSS variables, so semantic roles are flattened to hex here for the
 * places that need JS color values (SVG strokes/fills, ActivityIndicator,
 * gradients, status bars). Components prefer NativeWind classes; reach for this
 * only when a raw color string is required.
 */

export const palette = {
  paper: {
    50: "#FBF8F3",
    100: "#F4EEE4",
    200: "#E8DFD0",
    300: "#D6C9B4",
    400: "#B3A487",
    500: "#8A7B5E",
  },
  ink: {
    900: "#1C1A16",
    800: "#2A2620",
    700: "#3D382F",
    600: "#565046",
    500: "#756E61",
    400: "#9A9486",
  },
  indigo: {
    700: "#322C63",
    600: "#423A82",
    500: "#564BA6",
    400: "#7A6FC9",
    200: "#CFC9EC",
    50: "#EEEBF8",
  },
  marigold: {
    600: "#C97A14",
    500: "#E8972B",
    400: "#F4B45A",
    200: "#FBE0B0",
    50: "#FDF4E3",
  },
  green: { 600: "#2F7D5B", 500: "#3EA876", 200: "#BFE6D2" },
  amber: { 600: "#B7791F", 500: "#E0A12E" },
  red: { 600: "#B23A36", 500: "#D85650", 200: "#F3CFCD" },
  sky: { 600: "#2D6E8E", 500: "#3F92B8" },
} as const;

/** Semantic role → hex (light theme). Matches tailwind.config.js semantic roles. */
export const colors = {
  canvas: "#FBF8F3",
  surface: "#FFFDFA",
  surfaceSunken: "#F4EEE4",
  inset: "#F4EEE4",

  textPrimary: "#1C1A16",
  textSecondary: "#565046",
  textMuted: "#756E61",
  textOnAccent: "#FFFDFA",

  borderSubtle: "#E8DFD0",
  borderStrong: "#D6C9B4",

  brand: "#423A82",
  brandHover: "#322C63",
  brandSubtle: "#EEEBF8",
  spark: "#E8972B",

  success: "#2F7D5B",
  warning: "#B7791F",
  error: "#B23A36",
  info: "#2D6E8E",
} as const;

export type SemanticColor = keyof typeof colors;
