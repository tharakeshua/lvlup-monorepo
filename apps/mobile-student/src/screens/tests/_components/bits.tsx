/**
 * Tests-lane local composites — the test-domain pieces M-components does NOT own
 * (per the API-LOCKED note: AnswerKeyLock / RubricBreakdown / ConfidenceBadge /
 * InsightCard live in the screen lane). Plus small render helpers (Panel, KPI,
 * DeltaTag, bar rows) shared across the tests screens.
 *
 * Everything here composes the barrel primitives (`Icon`, `Badge`, `Card`,
 * `ProgressBar`) + NativeWind Lyceum tokens — no Firestore, no cross-lane edits.
 */
import { type ReactNode } from "react";
import { Text, View } from "react-native";

import { Badge, Card, Icon, ProgressBar } from "../../../components";
import { pct } from "./format";

export type BadgeVariant = "brand" | "neutral" | "success" | "warning" | "error" | "info" | "spark";

/* ------------------------------------------------------------------ */
/* Panel — a titled surface (the design's <Panel> / <Section>)        */
/* ------------------------------------------------------------------ */
export function Panel({
  title,
  actions,
  children,
  className,
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      {title ? (
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="font-display text-text-primary text-base font-semibold">{title}</Text>
          {actions ? <View>{actions}</View> : null}
        </View>
      ) : null}
      {children}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* AnswerKeyLock — the "answers sealed" reassurance band              */
/* ------------------------------------------------------------------ */
export function AnswerKeyLock({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <View className="border-border-subtle bg-surface-sunken flex-row gap-3 rounded-md border p-3">
      <Icon name="lock" size={16} color="#756E61" />
      <View className="flex-1">
        <Text className="text-text-secondary text-sm font-semibold">{title}</Text>
        {children ? <Text className="text-text-muted mt-0.5 text-sm">{children}</Text> : null}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* ConfidenceBadge — grader confidence / "graded by" provenance       */
/* ------------------------------------------------------------------ */
const CONFIDENCE_META: Record<string, { variant: BadgeVariant; icon: string }> = {
  high: { variant: "success", icon: "shield-check" },
  med: { variant: "info", icon: "gauge" },
  review: { variant: "brand", icon: "user-check" },
  low: { variant: "warning", icon: "compass" },
};

export function ConfidenceBadge({ level, value }: { level: string; value: string }) {
  const m = CONFIDENCE_META[level] ?? CONFIDENCE_META.med;
  return (
    <Badge variant={m.variant} icon={<Icon name={m.icon} size={12} />}>
      {value}
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/* RubricBreakdown — per-criterion score rows                         */
/* ------------------------------------------------------------------ */
export function RubricBreakdown({
  criteria,
}: {
  criteria: { label: string; desc?: string; score: number; max: number }[];
}) {
  return (
    <View className="gap-3">
      {criteria.map((c, i) => {
        const p = pct(c.score, c.max);
        return (
          <View key={i} className="gap-1.5">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-text-primary text-sm font-medium">{c.label}</Text>
                {c.desc ? <Text className="text-text-muted text-xs">{c.desc}</Text> : null}
              </View>
              <Text className="text-text-secondary font-mono text-sm">
                {c.score} / {c.max}
              </Text>
            </View>
            <ProgressBar value={p} variant={p >= 67 ? "success" : p >= 34 ? "warning" : "error"} />
          </View>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* InsightCard — the "what to do next" nudge                          */
/* ------------------------------------------------------------------ */
export function InsightCard({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <View className="border-brand-subtle bg-brand-subtle/40 flex-row gap-3 rounded-lg border p-4">
      <View className="bg-brand-subtle h-9 w-9 items-center justify-center rounded-full">
        <Icon name={icon} size={18} color="#423A82" />
      </View>
      <View className="flex-1">
        <Text className="font-display text-text-primary mb-1 text-base font-semibold">{title}</Text>
        {typeof children === "string" ? (
          <Text className="text-text-secondary text-sm">{children}</Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* DeltaTag — up/down/flat change pill (icon + label, never colour    */
/* alone)                                                             */
/* ------------------------------------------------------------------ */
export interface Delta {
  dir: "up" | "down" | "flat";
  label: string;
  aria: string;
}

export function deltaOf(curr: number, prev: number, unit: string): Delta {
  const d = curr - prev;
  if (d === 0) return { dir: "flat", label: "about the same", aria: "no change" };
  const up = d > 0;
  const mag = Math.abs(d);
  return {
    dir: up ? "up" : "down",
    label: `${up ? "+" : "−"}${mag}${unit}`,
    aria: `${up ? "up " : "down "}${mag} ${unit}`,
  };
}

export function DeltaTag({ d }: { d: Delta }) {
  const icon = d.dir === "up" ? "arrow-up" : d.dir === "down" ? "arrow-down" : "minus";
  const color = d.dir === "up" ? "#2F7D5B" : d.dir === "down" ? "#B23A36" : "#756E61";
  return (
    <View className="flex-row items-center gap-1" accessibilityLabel={d.aria}>
      <Icon name={icon} size={12} color={color} />
      <Text className="text-2xs font-mono" style={{ color }}>
        {d.label}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* KpiCard — a labelled stat tile with optional delta                 */
/* ------------------------------------------------------------------ */
export function KpiCard({
  icon,
  label,
  value,
  sub,
  delta,
  best,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  delta?: Delta;
  best?: boolean;
}) {
  return (
    <View
      className={`min-w-[44%] flex-1 gap-2 rounded-lg border p-3 ${
        best ? "border-success bg-green-200/30" : "border-border-subtle bg-surface"
      }`}
    >
      <View className="flex-row items-center gap-2">
        <Icon name={icon} size={15} color={best ? "#2F7D5B" : "#423A82"} />
        <Text className="text-text-muted text-xs">{label}</Text>
      </View>
      <Text className="text-text-primary font-mono text-xl font-semibold">{value}</Text>
      <View className="flex-row items-center gap-2">
        {delta ? <DeltaTag d={delta} /> : null}
        {sub ? <Text className="text-2xs text-text-muted">{sub}</Text> : null}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* BreakdownRows — labelled progress rows (results breakdown panels)  */
/* ------------------------------------------------------------------ */
export function BreakdownRows({
  rows,
  icon,
  passMark = 70,
}: {
  rows: { label: string; got: number; max: number }[];
  icon: string;
  passMark?: number;
}) {
  if (rows.length === 0) {
    return <Text className="text-text-muted text-sm">No breakdown for this attempt.</Text>;
  }
  return (
    <View className="gap-3">
      {rows.map((r, i) => {
        const p = pct(r.got, r.max);
        return (
          <View key={i} className="gap-1.5">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Icon name={icon} size={14} color="#756E61" />
                <Text className="text-text-primary text-sm">{r.label}</Text>
              </View>
              <Text className="text-text-secondary font-mono text-xs">
                {r.got} / {r.max} · {p}%
              </Text>
            </View>
            <ProgressBar value={p} variant={p >= passMark ? "success" : undefined} />
          </View>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* VerticalBars — a tiny bar chart (score progression / pace trend)   */
/* ------------------------------------------------------------------ */
export function VerticalBars({
  data,
  passLine,
  unit = "%",
  tone = "brand",
  bestValue,
  ariaLabel,
}: {
  data: { label: string; value: number }[];
  passLine?: number;
  unit?: string;
  tone?: "brand" | "spark";
  bestValue?: number;
  ariaLabel?: string;
}) {
  const max = Math.max(100, ...data.map((d) => d.value));
  return (
    <View className="gap-2" accessibilityLabel={ariaLabel}>
      <View className="h-40 flex-row items-end gap-2">
        {data.map((d, i) => {
          const h = Math.max(4, (d.value / max) * 100);
          const isBest = bestValue != null && d.value === bestValue;
          const bg = isBest ? "#2F7D5B" : tone === "spark" ? "#E8972B" : "#564BA6";
          return (
            <View key={i} className="flex-1 items-center justify-end gap-1">
              <Text className="text-2xs text-text-secondary font-mono">
                {d.value}
                {unit}
                {isBest ? " ★" : ""}
              </Text>
              <View
                className="w-full overflow-hidden rounded-sm"
                style={{ height: `${h}%`, backgroundColor: bg }}
              />
              <Text className="text-2xs text-text-muted font-mono">{d.label}</Text>
            </View>
          );
        })}
      </View>
      {passLine != null ? (
        <Text className="text-2xs text-text-muted">
          <Icon name="flag" size={10} color="#756E61" /> Passing {passLine}%
        </Text>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Eyebrow — small uppercased section caption used by the state demos */
/* ------------------------------------------------------------------ */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <Text className="text-2xs text-text-muted font-mono uppercase tracking-wide">{children}</Text>
  );
}
