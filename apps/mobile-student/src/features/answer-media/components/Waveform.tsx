/**
 * Waveform — the static / live level-bar motif from `mobile-ai.css` (`.wave`,
 * `.wave--live`). Static bars use the muted-indigo pattern (40/85/60/25 %);
 * the live variant tints to spark and can be driven by a 0..1 `level` so the
 * D2 recording state shows a real level meter (never the meter alone — the
 * caller pairs it with the timer + text, per a11y note in 04-audio.md).
 */
import { useMemo } from "react";
import { View } from "react-native";

import { colors } from "../../../theme";

const STATIC_PATTERN = [40, 85, 60, 25];
const MUTED_INDIGO = "#564BA6"; // ≈ --brand-muted

export interface WaveformProps {
  bars?: number;
  height?: number;
  /** Live tint (spark) + reactive amplitude when a `level` is supplied. */
  live?: boolean;
  /** 0..1 input level (live meter). When set, jitters bar heights around it. */
  level?: number;
  color?: string;
}

export function Waveform({ bars = 20, height = 24, live = false, level, color }: WaveformProps) {
  const tint = color ?? (live ? colors.spark : MUTED_INDIGO);
  const heights = useMemo(() => {
    return Array.from({ length: bars }, (_, i) => {
      if (live && typeof level === "number") {
        // Deterministic per-bar variation around the live level (no RNG).
        const wobble = STATIC_PATTERN[i % STATIC_PATTERN.length] / 100;
        const pct = Math.max(0.12, Math.min(1, level * (0.55 + wobble * 0.75)));
        return pct;
      }
      return STATIC_PATTERN[i % STATIC_PATTERN.length] / 100;
    });
  }, [bars, live, level]);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: "row", alignItems: "center", gap: 2, height }}
    >
      {heights.map((h, i) => (
        <View
          key={i}
          style={{
            width: 3,
            borderRadius: 999,
            backgroundColor: tint,
            height: Math.max(2, Math.round(height * h)),
          }}
        />
      ))}
    </View>
  );
}
