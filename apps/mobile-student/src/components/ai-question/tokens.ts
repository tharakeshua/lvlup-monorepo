/**
 * ai-question/tokens — the ONE shared motion + action palette for the AI-question
 * feature (Surfaces A–J). Every AIQ worker (composer, feedback, media, chat,
 * discuss) draws from this so uploading, recording, attaching, submitting,
 * discussing, and receiving feedback all feel like members of the same crafted
 * system (docs/design/ai-questions/08-experience-and-motion.md §3).
 *
 * Colors already live as NativeWind classes (tailwind.config.js) and JS hex
 * (../../theme/colors). This module adds what those don't carry: the motion
 * vocabulary (durations, easings, spring presets), the action-accent gradient,
 * the spark glow, and a reduced-motion gate. Reach for NativeWind classes first;
 * use these tokens for Reanimated / SVG / gradient work.
 */
import { Easing, ReduceMotion } from "react-native-reanimated";

import { colors, palette } from "../../theme";

/* ── Durations (ms) — mobile-ai token set (--dur-*) ─────────────────────── */
export const DURATION = {
  instant: 100,
  fast: 160,
  base: 220,
  slow: 320,
  page: 420,
  /** the ~8s designed evaluating wait; taking-longer copy shifts at `longer`. */
  evalLonger: 12000,
} as const;

/* ── Easings (--ease-*) as Reanimated bezier curves ─────────────────────── */
export const EASE = {
  standard: Easing.bezier(0.2, 0, 0, 1),
  entrance: Easing.bezier(0.05, 0.7, 0.1, 1),
  exit: Easing.bezier(0.3, 0, 0.8, 0.15),
} as const;

/** Physical spring for "flies in" moves (part-cards, bubbles, focus expand). */
export const SPRING = {
  gentle: { damping: 18, stiffness: 180, mass: 1 },
  snappy: { damping: 22, stiffness: 260, mass: 0.9 },
} as const;

/** Shared timing config helpers so every enter/fill reads identically. */
export const timing = {
  enter: { duration: DURATION.base, easing: EASE.entrance },
  exit: { duration: DURATION.fast, easing: EASE.exit },
  /** eased 0→value fill for bars/rings (~600–900ms). */
  fill: { duration: 720, easing: EASE.standard },
  collapse: { duration: DURATION.base, easing: EASE.standard },
} as const;

/**
 * The action palette (§3). brand indigo = commit/primary (submit, send);
 * spark/marigold = capture/create (record, camera, add) + celebration accents.
 */
export const ACTION = {
  commit: colors.brand,
  commitHover: colors.brandHover,
  capture: colors.spark,
  captureHover: palette.marigold[600],
  /** action-accent gradient stops (indigo → indigo-400), reused across capture
   *  affordances, progress fills, and the evaluating aurora. */
  accentGradient: [palette.indigo[600], palette.indigo[400]] as const,
  /** optional marigold spark stop for celebration / capture emphasis. */
  sparkStop: palette.marigold[500],
} as const;

/** Warm spark glow for hero capture/CTA surfaces (--glow-spark). */
export const GLOW_SPARK = {
  shadowColor: "#E8972B",
  shadowOpacity: 0.3,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 6 },
  elevation: 8,
} as const;

/** Soft indigo glow that confirms an upload / attach success. */
export const GLOW_BRAND = {
  shadowColor: "#564BA6",
  shadowOpacity: 0.28,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 4 },
  elevation: 6,
} as const;

/** Reanimated ReduceMotion.System — pass to entering/exiting so motion respects
 *  the OS "reduce motion" setting automatically (calm cross-fade fallback). */
export const REDUCE_MOTION = ReduceMotion.System;

export { colors, palette };
