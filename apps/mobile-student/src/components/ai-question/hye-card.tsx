/**
 * ai-question/hye-card — "How you'll be evaluated" (Surface A zone 2 / doc 09).
 * A glanceable icon row of objectives + rubric criteria + enabled dimensions,
 * expandable to descriptions + the score ladder + passing bar. Present on every
 * AI surface; the SAME chips reappear scored on the feedback surface (W2).
 *
 * DATA (student-safe only): objectives from the item payload
 * (publicLearningObjectives / typeData.objectives); criteria + dimensions +
 * passing bar from the getEvaluationConfig student projection, falling back to
 * the item's resolved `rubric` snapshot. We NEVER read holisticGuidance /
 * modelAnswer / evaluatorGuidance / promptGuidance (stripped server-side, G13 —
 * and never referenced here regardless). Dimension chips come from
 * settings.enabledDimensions[] (the feedback-bearing set, Layer-2), not
 * rubric.dimensions[]. The per-dimension ring is the pending-D3 placeholder.
 */
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { colors } from "../../theme";
import { cx } from "../cx";
import { Icon } from "../Icon";
import { REDUCE_MOTION } from "./tokens";

/* ── model ───────────────────────────────────────────────────────────────── */
export interface HyeLadderStep {
  label: string;
  description?: string;
  score: number;
}
export interface HyeCriterion {
  id?: string;
  name: string;
  description?: string;
  maxScore?: number;
  levels?: HyeLadderStep[];
}
export interface HyeDimension {
  id: string;
  name: string;
  description?: string;
  priority?: "HIGH" | "MEDIUM" | "LOW" | string;
}
export interface HyeModel {
  scoringMode?: string;
  holistic: boolean;
  maxScore?: number;
  passingPercentage?: number;
  objectives: string[];
  criteria: HyeCriterion[];
  dimensions: HyeDimension[];
}

type Dict = Record<string, unknown>;
const isDict = (v: unknown): v is Dict => !!v && typeof v === "object" && !Array.isArray(v);
const asStr = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v : undefined;
const asNum = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

/** Objective labels from a payload field that may be strings or {id,label}. */
function objectiveLabels(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((o) =>
      typeof o === "string"
        ? o
        : isDict(o)
          ? (asStr(o.label) ?? asStr(o.text) ?? asStr(o.description))
          : undefined
    )
    .filter((s): s is string => !!s);
}

function readCriteria(rubric?: Dict): HyeCriterion[] {
  const arr = Array.isArray(rubric?.criteria) ? (rubric!.criteria as unknown[]) : [];
  return arr.filter(isDict).map((c) => ({
    id: asStr(c.id),
    name: asStr(c.name) ?? "Criterion",
    description: asStr(c.description),
    maxScore: asNum(c.maxScore) ?? asNum(c.maxPoints),
    levels: (Array.isArray(c.levels) ? (c.levels as unknown[]) : []).filter(isDict).map((l) => ({
      label: asStr(l.label) ?? "",
      description: asStr(l.description),
      score: asNum(l.score) ?? 0,
    })),
  }));
}

function readDimensions(source: unknown): HyeDimension[] {
  const arr = Array.isArray(source) ? source : [];
  return arr.filter(isDict).map((d) => ({
    id: asStr(d.id) ?? asStr(d.name) ?? "dim",
    name: asStr(d.name) ?? "Dimension",
    description: asStr(d.description),
    priority: asStr(d.priority),
  }));
}

/**
 * Build the HYE model from (optional) getEvaluationConfig view + the item.
 * Config takes precedence; item.rubric / payload objectives are the fallback.
 */
export function buildHyeModel(
  config: unknown,
  item: unknown,
  questionData?: unknown
): HyeModel | null {
  const cfg = isDict(config)
    ? isDict(config.config)
      ? (config.config as Dict)
      : config
    : undefined;
  const it = isDict(item) ? item : undefined;
  const data = isDict(questionData)
    ? questionData
    : isDict(it?.payload)
      ? (it!.payload as Dict)
      : undefined;

  const rubric =
    (isDict(cfg?.rubric) ? (cfg!.rubric as Dict) : undefined) ??
    (isDict(it?.rubric) ? (it!.rubric as Dict) : undefined);
  const settings = isDict(cfg?.settings) ? (cfg!.settings as Dict) : undefined;

  const scoringMode = asStr(rubric?.scoringMode);
  const holistic = scoringMode === "holistic";

  // objectives: item payload publicLearningObjectives / typeData.objectives
  const typeData = isDict(data?.typeData) ? (data!.typeData as Dict) : undefined;
  const objectives = [
    ...objectiveLabels(data?.publicLearningObjectives),
    ...objectiveLabels(typeData?.objectives ?? data?.objectives),
  ];

  // dimensions: enabledDimensions is the feedback-bearing SSOT (Layer-2). It
  // lives ONLY on EvaluationSettings (getEvaluationConfig), never on the item
  // rubric — so without the config the chips are honestly dropped rather than
  // faked from rubric.dimensions (the scoring rubric, which may not match the
  // set that lights up on the result surface).
  const dimensions = readDimensions(settings?.enabledDimensions);

  const criteria = holistic ? [] : readCriteria(rubric);
  const maxScore =
    asNum(rubric?.holisticMaxScore) ??
    (criteria.length ? criteria.reduce((s, c) => s + (c.maxScore ?? 0), 0) : undefined);
  const passingPercentage = asNum(rubric?.passingPercentage);

  // nothing student-safe to show → no card
  if (
    !objectives.length &&
    !criteria.length &&
    !dimensions.length &&
    passingPercentage == null &&
    !holistic
  )
    return null;

  return { scoringMode, holistic, maxScore, passingPercentage, objectives, criteria, dimensions };
}

/* ── chips ───────────────────────────────────────────────────────────────── */
const DIM_ICON: Record<string, string> = {
  correctness: "check-circle",
  clarity: "lightbulb",
  depth: "layers",
  fluency: "lightbulb",
  efficiency: "layers",
};
function dimIcon(name: string): string {
  const key = name.toLowerCase();
  for (const k of Object.keys(DIM_ICON)) if (key.includes(k)) return DIM_ICON[k];
  return "sparkles";
}

function Chip({
  icon,
  label,
  hi,
  dim,
}: {
  icon: string;
  label: string;
  hi?: boolean;
  dim?: boolean;
}) {
  return (
    <View
      className={cx(
        "rounded-pill flex-row items-center gap-1.5 px-2.5 py-1",
        hi ? "bg-brand-subtle" : "bg-surface-sunken"
      )}
    >
      <Icon name={icon} size={13} color={hi ? colors.brand : dim ? colors.info : colors.brand} />
      <Text
        className={cx("text-2xs font-medium", hi ? "text-brand" : "text-text-secondary")}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

/* ── the card ────────────────────────────────────────────────────────────── */
export function HowYoullBeEvaluated({ model }: { model: HyeModel }) {
  const [expanded, setExpanded] = useState(false);
  const critCount = model.criteria.length;

  return (
    <View className="border-border-subtle bg-surface rounded-lg border px-4 py-3">
      {/* head */}
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel="How you'll be evaluated"
        className="flex-row items-center gap-2"
      >
        <Icon name="compass" size={16} color={colors.brand} />
        <Text className="text-text-primary flex-1 text-sm font-semibold">
          How you'll be evaluated
        </Text>
        {!expanded && critCount > 0 ? (
          <Text className="text-text-muted text-2xs font-mono">
            {critCount} {critCount === 1 ? "criterion" : "criteria"}
          </Text>
        ) : null}
        <Icon name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
      </Pressable>

      {!expanded ? (
        // collapsed: glanceable chip row
        <View className="mt-3 flex-row flex-wrap gap-2">
          {model.objectives.slice(0, 2).map((o, i) => (
            <Chip key={`o${i}`} icon="target" label={o} />
          ))}
          {model.dimensions.map((d, i) => (
            <Chip
              key={`d${i}`}
              icon={dimIcon(d.name)}
              label={d.name}
              dim
              hi={d.priority === "HIGH"}
            />
          ))}
          {model.objectives.length === 0 && model.dimensions.length === 0
            ? model.criteria
                .slice(0, 3)
                .map((c, i) => <Chip key={`c${i}`} icon="target" label={c.name} />)
            : null}
        </View>
      ) : (
        <Animated.View
          entering={FadeIn.duration(320).reduceMotion(REDUCE_MOTION)}
          className="mt-4 gap-4"
        >
          {/* objectives */}
          {model.objectives.length > 0 ? (
            <View className="gap-2">
              <SectionKey icon="target" label="Objectives" />
              <View className="flex-row flex-wrap gap-2">
                {model.objectives.map((o, i) => (
                  <Chip key={i} icon="target" label={o} />
                ))}
              </View>
            </View>
          ) : null}

          {/* rubric criteria + ladder (analytic only) */}
          {model.criteria.length > 0 ? (
            <View className="gap-2">
              <SectionKey
                icon="list-checks"
                label={`Rubric${model.maxScore != null ? ` · ${model.maxScore} pts` : ""}`}
              />
              {model.criteria.map((c, i) => (
                <View key={c.id ?? i} className="gap-2">
                  <View className="flex-row items-baseline gap-2">
                    <Text className="text-text-primary text-sm font-medium">{c.name}</Text>
                    <Text className="text-text-muted flex-1 text-xs" numberOfLines={2}>
                      {c.description ?? ""}
                    </Text>
                    {c.maxScore != null ? (
                      <Text className="text-text-secondary font-mono text-xs">/{c.maxScore}</Text>
                    ) : null}
                  </View>
                  {c.levels && c.levels.length > 0 ? (
                    <View className="flex-row gap-2">
                      {/* ascending by score so the ladder reads low→high; the
                          HIGHEST-score rung is the marigold "aim for this" (levels
                          may be authored in either order). */}
                      {[...c.levels]
                        .sort((a, b) => a.score - b.score)
                        .map((l, li, sorted) => {
                          const aim = li === sorted.length - 1;
                          return (
                            <View
                              key={li}
                              className={cx(
                                "flex-1 items-center rounded-md border p-2",
                                aim ? "border-marigold-500 bg-marigold-50" : "border-border-subtle"
                              )}
                            >
                              <Text
                                className={cx(
                                  "font-mono text-sm font-semibold",
                                  aim ? "text-marigold-600" : "text-brand"
                                )}
                              >
                                {l.score}
                              </Text>
                              <Text
                                className="text-text-muted text-2xs text-center"
                                numberOfLines={2}
                              >
                                {l.label}
                              </Text>
                            </View>
                          );
                        })}
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          {/* holistic: mode + max + pass only */}
          {model.holistic ? (
            <View className="gap-1">
              <SectionKey icon="list-checks" label="Holistic scoring" />
              <Text className="text-text-secondary text-xs">
                Judged as a whole{model.maxScore != null ? ` · out of ${model.maxScore}` : ""}.
              </Text>
            </View>
          ) : null}

          {/* dimensions (enabledDimensions) — ring is the D3 placeholder */}
          {model.dimensions.length > 0 ? (
            <View className="gap-2">
              <SectionKey icon="sparkles" label="Dimensions" />
              <View className="flex-row flex-wrap gap-2">
                {model.dimensions.map((d, i) => (
                  <Chip
                    key={d.id ?? i}
                    icon={dimIcon(d.name)}
                    label={d.priority === "HIGH" ? `${d.name} · high` : d.name}
                    dim
                    hi={d.priority === "HIGH"}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {/* passing bar */}
          {model.passingPercentage != null ? (
            <View className="flex-row items-center gap-2">
              <Icon name="flag" size={13} color={colors.success} />
              <Text className="text-text-muted text-xs">
                Passing bar · {model.passingPercentage}%
              </Text>
            </View>
          ) : null}
        </Animated.View>
      )}
    </View>
  );
}

function SectionKey({ icon, label }: { icon: string; label: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <Icon name={icon} size={12} color={colors.brand} />
      <Text className="text-text-muted text-2xs tracking-caps font-mono uppercase">{label}</Text>
    </View>
  );
}
