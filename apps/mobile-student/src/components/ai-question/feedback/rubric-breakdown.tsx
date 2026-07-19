/**
 * Rubric breakdown — the SCORED per-criterion rows (rubricBreakdown[]). Each row
 * shows name + score/max + a score bar, an optional grader comment, and — when
 * the config carried a criterion level ladder — the ladder with the achieved
 * step marked, so the student sees exactly which rung they landed on.
 */
import { Text, View } from "react-native";

import { FeedbackCard } from "./section";
import { ScoreBar } from "./score-bar";
import { stateTone, tone } from "./tone";
import type { RubricRowView } from "./adapter";

function LevelLadder({ levels }: { levels: RubricRowView["levels"] }) {
  if (levels.length < 2) return null;
  return (
    <View className="mt-2 flex-row flex-wrap gap-1">
      {levels.map((l, i) => {
        const active = l.achieved;
        return (
          <View
            key={`${l.label}-${i}`}
            accessibilityLabel={`${l.label}${active ? " — achieved" : ""}`}
            style={
              active
                ? { backgroundColor: tone.brand }
                : { borderWidth: 1, borderColor: tone.brandSubtle }
            }
            className="flex-row items-center gap-1 rounded-md px-2 py-0.5"
          >
            <Text
              className="font-ui text-2xs font-medium"
              style={{ color: active ? tone.spark : tone.brand }}
            >
              {l.label}
            </Text>
            <Text
              className="text-2xs font-mono"
              style={{ color: active ? "#FFFDFA" : tone.brand, opacity: active ? 0.9 : 0.55 }}
            >
              {l.score}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function RubricRow({ row, last }: { row: RubricRowView; last: boolean }) {
  const t = stateTone(row.state);
  return (
    <View className={last ? "pt-3" : "border-border-subtle border-b pb-3 pt-3"}>
      <View className="flex-row items-baseline gap-2">
        <Text className="font-ui text-text-primary flex-1 text-sm font-medium">{row.name}</Text>
        {row.score != null && row.maxScore != null ? (
          <Text style={{ color: t.fg }} className="font-mono text-xs font-semibold">
            {row.score} / {row.maxScore}
          </Text>
        ) : null}
      </View>
      {row.comment ? (
        <Text className="font-ui text-text-muted mb-2 mt-1 text-xs leading-5">{row.comment}</Text>
      ) : (
        <View className="h-2" />
      )}
      <ScoreBar pct={row.pct} state={row.state} />
      <LevelLadder levels={row.levels} />
    </View>
  );
}

export function RubricBreakdown({
  rows,
  score,
  maxScore,
}: {
  rows: RubricRowView[];
  score: number | null;
  maxScore: number | null;
}) {
  if (!rows.length) return null;
  return (
    <FeedbackCard
      icon="list-checks"
      title="Rubric"
      trailing={
        score != null && maxScore != null ? (
          <Text className="text-text-secondary font-mono text-xs">
            {score} / {maxScore}
          </Text>
        ) : undefined
      }
    >
      {rows.map((row, i) => (
        <RubricRow key={row.key} row={row} last={i === rows.length - 1} />
      ))}
    </FeedbackCard>
  );
}
