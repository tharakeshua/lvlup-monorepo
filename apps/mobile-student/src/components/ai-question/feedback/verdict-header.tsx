/**
 * Verdict header — the payoff's first landing. Three growth-framed tones:
 * Got it! (success) · You're close (warning) · Not quite yet (indigo sprout,
 * never red-alarm). A one-shot spark shimmer sweeps the "Got it!" icon.
 */
import { Animated, Text, View } from "react-native";

import { Icon } from "../../Icon";
import { useShimmer } from "./motion";
import { tone } from "./tone";
import type { Verdict } from "./types";

const VERDICT_META: Record<Verdict, { title: string; icon: string; fg: string; bg: string }> = {
  correct: { title: "Got it!", icon: "check", fg: tone.success, bg: tone.successSubtle },
  partial: { title: "You're close", icon: "trending-up", fg: tone.warning, bg: tone.warningSubtle },
  incorrect: { title: "Not quite yet", icon: "sprout", fg: tone.brand, bg: tone.brandSubtle },
};

export function VerdictHeader({
  verdict,
  score,
  maxScore,
  isBestAttempt = false,
}: {
  verdict: Verdict;
  score: number | null;
  maxScore: number | null;
  isBestAttempt?: boolean;
}) {
  const m = VERDICT_META[verdict];
  const shimmer = useShimmer(verdict === "correct");
  return (
    <View
      accessibilityRole="header"
      accessibilityLabel={`${m.title}${score != null && maxScore != null ? `, ${score} of ${maxScore} points` : ""}`}
      className="flex-row items-center gap-3"
    >
      <View
        style={{ backgroundColor: m.bg }}
        className="h-12 w-12 items-center justify-center overflow-hidden rounded-full"
      >
        <Icon name={m.icon} size={22} color={m.fg} strokeWidth={2.2} />
        {/* celebratory sweep — only rendered for the correct verdict */}
        <Animated.View
          pointerEvents="none"
          style={{ opacity: shimmer, backgroundColor: tone.spark }}
          className="absolute inset-0"
        />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text style={{ color: m.fg }} className="font-display text-xl leading-7">
            {m.title}
          </Text>
          {isBestAttempt ? (
            <View
              style={{ backgroundColor: tone.sparkSubtle }}
              className="rounded-pill flex-row items-center gap-1 px-2 py-0.5"
            >
              <Icon name="award" size={11} color={tone.sparkHover} />
              <Text style={{ color: tone.sparkHover }} className="font-ui text-2xs font-semibold">
                Best yet
              </Text>
            </View>
          ) : null}
        </View>
        {score != null && maxScore != null ? (
          <Text className="text-text-secondary mt-0.5 font-mono text-sm">
            {score} / {maxScore} pts
          </Text>
        ) : null}
      </View>
    </View>
  );
}
