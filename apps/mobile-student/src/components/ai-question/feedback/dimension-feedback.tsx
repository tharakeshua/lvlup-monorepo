/**
 * Per-dimension structured feedback — QUALITATIVE only (structuredFeedback). Each
 * dimension is echoed by name (the same dimension the student saw up front), with
 * its severity-tagged items and actionable suggestions. The dim ring is the
 * pending-D3 numeric slot: the shell always renders; a number appears ONLY when
 * dimensionBreakdown supplies one (no fabricated score).
 */
import { Text, View } from "react-native";

import { Icon } from "../../Icon";
import { FeedbackCard } from "./section";
import { SeverityTag } from "./chips";
import { stateTone, tone } from "./tone";
import type { DimensionGroupView } from "./adapter";

function DimRing({ group }: { group: DimensionGroupView }) {
  const t = stateTone(
    group.worstSeverity === "critical" ? "low" : group.worstSeverity === "major" ? "mid" : "ok"
  );
  const hasScore = group.score != null && group.scale != null;
  return (
    <View
      accessibilityLabel={
        hasScore ? `${group.score} out of ${group.scale}` : "Dimension score pending"
      }
      style={{ borderColor: t.fg, backgroundColor: hasScore ? t.subtle : "transparent" }}
      className="h-9 w-9 items-center justify-center rounded-full border"
    >
      {hasScore ? (
        <Text style={{ color: t.fg }} className="text-2xs font-mono font-semibold">
          {group.score}/{group.scale}
        </Text>
      ) : (
        // D3 slot — a quiet dash placeholder keeps the ring's meaning ("scored
        // per dimension") without inventing a number.
        <View style={{ backgroundColor: t.fg }} className="h-1 w-2.5 rounded-full opacity-50" />
      )}
    </View>
  );
}

function DimensionGroup({ group, last }: { group: DimensionGroupView; last: boolean }) {
  return (
    <View className={last ? "pt-3" : "border-border-subtle border-b pb-3 pt-3"}>
      <View className="flex-row items-center gap-2">
        <Text className="font-ui text-text-primary flex-1 text-sm font-medium">{group.name}</Text>
        <SeverityTag severity={group.worstSeverity} />
        <DimRing group={group} />
      </View>
      {group.items.map((it, i) => (
        <View key={i} className="mt-2 gap-2">
          <Text className="font-ui text-text-primary text-sm leading-5">{it.message}</Text>
          {it.suggestion ? (
            <View
              style={{ backgroundColor: tone.sparkSubtle }}
              className="flex-row gap-2 rounded-md px-3 py-2"
            >
              <Icon name="lightbulb" size={14} color={tone.sparkHover} />
              <Text className="font-ui text-text-secondary flex-1 text-xs leading-5">
                {it.suggestion}
              </Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export function DimensionFeedback({ groups }: { groups: DimensionGroupView[] }) {
  if (!groups.length) return null;
  return (
    <FeedbackCard icon="sparkles" title="By dimension">
      {groups.map((g, i) => (
        <DimensionGroup key={g.key} group={g} last={i === groups.length - 1} />
      ))}
    </FeedbackCard>
  );
}
