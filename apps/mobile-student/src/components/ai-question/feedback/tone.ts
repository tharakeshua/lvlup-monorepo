/**
 * Feedback tone palette — the concrete hex values the feedback surface needs as
 * JS strings (subtle fills, ring/dot accents) that aren't exposed as flat theme
 * roles. Mirrors tokens/lyceum.css: --status-*-subtle, --confidence-*, --spark-*.
 * Foreground roles (success/warning/error/brand/info) come from `src/theme`.
 */
import { palette, colors } from "../../../theme";

export const tone = {
  // foreground accents
  success: colors.success, // #2F7D5B
  warning: colors.warning, // #B7791F
  error: colors.error, // #B23A36
  info: palette.sky[600], // #2D6E8E
  brand: colors.brand, // #423A82
  spark: colors.spark, // #E8972B
  sparkHover: palette.marigold[600], // #C97A14

  // subtle fills
  successSubtle: palette.green[200], // #BFE6D2
  warningSubtle: palette.marigold[50], // #FDF4E3
  errorSubtle: palette.red[200], // #F3CFCD
  infoSubtle: "#DCEAF1",
  brandSubtle: colors.brandSubtle, // #EEEBF8
  sparkSubtle: palette.marigold[50], // #FDF4E3

  // confidence dots
  confHigh: palette.green[500], // #3EA876
  confMed: palette.amber[500], // #E0A12E
  confLow: palette.red[500], // #D85650
} as const;

export type ScoreState = "ok" | "mid" | "low";

/** Foreground + subtle-fill pair for a score/severity state. */
export function stateTone(state: ScoreState): { fg: string; subtle: string } {
  if (state === "ok") return { fg: tone.success, subtle: tone.successSubtle };
  if (state === "mid") return { fg: tone.warning, subtle: tone.warningSubtle };
  return { fg: tone.error, subtle: tone.errorSubtle };
}
