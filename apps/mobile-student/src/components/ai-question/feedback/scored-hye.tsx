/**
 * Scored "How you'll be evaluated" strip — the loop closes here. These are the
 * SAME criterion / dimension identities the student saw up front on the answer
 * page, re-rendered with their scored state so the coaching contract visibly
 * pays off. Criterion chips carry a score; dimension chips carry a state dot
 * (no fabricated number — the per-dimension score is the pending-D3 slot).
 */
import { Text, View } from "react-native";

import { Icon } from "../../Icon";
import { stateTone, tone, type ScoreState } from "./tone";
import type { ScoredChipView } from "./adapter";

const STATE_ICON: Record<ScoreState, string> = {
  ok: "check-circle",
  mid: "circle-dot",
  low: "alert-circle",
};

function CriterionChip({ chip }: { chip: ScoredChipView }) {
  const t = stateTone(chip.state);
  return (
    <View
      accessibilityLabel={`${chip.label}${chip.scoreLabel ? `, scored ${chip.scoreLabel}` : ""}`}
      style={{ backgroundColor: t.subtle }}
      className="rounded-pill flex-row items-center gap-1.5 px-2.5 py-1"
    >
      <Icon name={STATE_ICON[chip.state]} size={13} color={t.fg} />
      <Text style={{ color: t.fg }} className="font-ui text-2xs font-medium">
        {chip.label}
      </Text>
      {chip.scoreLabel ? (
        <Text style={{ color: t.fg }} className="text-2xs font-mono font-semibold">
          {chip.scoreLabel}
        </Text>
      ) : null}
    </View>
  );
}

function DimensionChip({ chip }: { chip: ScoredChipView }) {
  const t = stateTone(chip.state);
  return (
    <View
      accessibilityLabel={`${chip.label} dimension${chip.scoreLabel ? `, ${chip.scoreLabel}` : ""}`}
      className="bg-surface-sunken rounded-pill flex-row items-center gap-1.5 px-2.5 py-1"
    >
      <View style={{ backgroundColor: t.fg }} className="h-1.5 w-1.5 rounded-full" />
      <Text className="font-ui text-text-secondary text-2xs font-medium">{chip.label}</Text>
      {chip.scoreLabel ? (
        <Text className="text-text-secondary text-2xs font-mono font-semibold">
          {chip.scoreLabel}
        </Text>
      ) : null}
    </View>
  );
}

export function ScoredHyeStrip({ chips }: { chips: ScoredChipView[] }) {
  if (!chips.length) return null;
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-1.5">
        <Icon name="git-compare" size={13} color={tone.brand} />
        <Text className="font-ui text-text-secondary text-xs font-semibold">
          What you were graded on
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-1.5">
        {chips.map((chip) =>
          chip.kind === "criterion" ? (
            <CriterionChip key={chip.key} chip={chip} />
          ) : (
            <DimensionChip key={chip.key} chip={chip} />
          )
        )}
      </View>
    </View>
  );
}
