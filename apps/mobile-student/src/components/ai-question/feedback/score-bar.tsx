/**
 * The two feedback bars: the headline PercentBar that fills to the overall score
 * (with an optional passing-bar tick), and the compact ScoreBar used per rubric
 * criterion (success ≥67% / warning ≥34% / error below).
 *
 * The fill is a plain static View with a percentage width so it renders reliably
 * at rest on both native and react-native-web. The surface's "draw" feel is
 * carried by the section-level Reveal cascade (see feedback-result.tsx) rather
 * than an animated width, which is unreliable on web.
 */
import { View } from "react-native";

import { stateTone, tone, type ScoreState } from "./tone";

const clampPct = (pct: number | null) => Math.max(0, Math.min(100, pct ?? 0));

/**
 * The overall percentage bar. `correct` fills solid success-green; other tones
 * fill brand indigo (a flat stand-in for the brand→indigo-400 gradient — no
 * gradient dependency). A passing-bar tick marks the pass threshold when known.
 */
export function PercentBar({
  percentage,
  correct = false,
  passingPercentage = null,
}: {
  percentage: number | null;
  correct?: boolean;
  passingPercentage?: number | null;
}) {
  const fill = correct ? tone.success : tone.brand;
  const tick = passingPercentage != null ? clampPct(passingPercentage) : null;
  return (
    <View className="bg-surface-sunken rounded-pill relative h-2 w-full overflow-hidden">
      <View
        style={{ width: `${clampPct(percentage)}%`, backgroundColor: fill }}
        className="rounded-pill h-full"
      />
      {tick != null ? (
        <View
          accessibilityLabel={`Passing bar at ${Math.round(tick)} percent`}
          style={{ left: `${tick}%`, backgroundColor: tone.sparkHover }}
          className="absolute top-0 h-full w-0.5 opacity-70"
        />
      ) : null}
    </View>
  );
}

const SCOREBAR_H = { height: 6 } as const;

/** The small per-criterion bar. */
export function ScoreBar({ pct, state }: { pct: number | null; state: ScoreState }) {
  const { fg } = stateTone(state);
  return (
    <View style={SCOREBAR_H} className="bg-surface-sunken rounded-pill w-full overflow-hidden">
      <View
        style={{ width: `${clampPct(pct)}%`, backgroundColor: fg }}
        className="rounded-pill h-full"
      />
    </View>
  );
}
