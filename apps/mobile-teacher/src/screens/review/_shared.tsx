/**
 * Shared helpers for the REVIEW / grading lane (src/screens/review/*).
 *
 * Pure presentational helpers + status maps + defensive normalizers. NOT screen
 * modules — the registry (`src/lib/screens.tsx`) only imports the `*Screen`
 * files; this is internal to the lane. Everything here is built on the EXPORTED
 * base components only (`../../components`) so the lane compiles regardless of
 * how far the M-teacher-components lane has fleshed out the teacher-specific
 * components. Swap the inline helpers (ConfidenceBadge, ScoreBar, DistRows…)
 * for the barrel versions once they're exported.
 *
 * Every read here is defensive: `@levelup/query` reads THROW on not-found and
 * the deployed teacher callables are only partially live (GATE-B), so screens
 * must render loading / empty / error gracefully and never index into a
 * possibly-undefined object.
 */
import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { Badge, Button, Card, Icon, Screen, Skeleton, type BadgeVariant } from "../../components";

// ───────────────────────────────────────────────────────────────────────────
// infinite-query flattening (useExams / useSubmissions return { pages:[{items}] })
// ───────────────────────────────────────────────────────────────────────────
interface PagesLike<T> {
  pages?: Array<{ items?: T[] } | undefined>;
}
/** Flatten a (possibly undefined) infinite-query `data` into a flat item list. */
export function flattenPages<T>(data: unknown): T[] {
  const d = data as PagesLike<T> | undefined;
  return d?.pages?.flatMap((p) => p?.items ?? []) ?? [];
}

// ───────────────────────────────────────────────────────────────────────────
// number / format helpers (all NaN-safe)
// ───────────────────────────────────────────────────────────────────────────
export function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
/** Round a 0–100 percentage to a whole number; `—` when null/undefined. */
export function pct(v: unknown): string {
  return typeof v === "number" && Number.isFinite(v) ? `${Math.round(v)}%` : "—";
}
/** "8 / 10" style score; the earned half is `—` when null. */
export function scoreFrac(earned: unknown, max: unknown): string {
  const e = typeof earned === "number" && Number.isFinite(earned) ? round1(earned) : "—";
  const m = typeof max === "number" && Number.isFinite(max) ? round1(max) : "—";
  return `${e} / ${m}`;
}
export function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

// ───────────────────────────────────────────────────────────────────────────
// exam status → label + badge variant
// ───────────────────────────────────────────────────────────────────────────
const EXAM_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  draft: { label: "Draft", variant: "neutral" },
  question_paper_uploaded: { label: "Paper uploaded", variant: "info" },
  question_paper_extracted: { label: "Extracted", variant: "info" },
  published: { label: "Collecting", variant: "info" },
  grading: { label: "Grading", variant: "warning" },
  results_released: { label: "Released", variant: "success" },
  archived: { label: "Archived", variant: "neutral" },
};
export function examStatus(status: unknown): { label: string; variant: BadgeVariant } {
  return EXAM_STATUS[String(status)] ?? { label: String(status ?? "—"), variant: "neutral" };
}

// ───────────────────────────────────────────────────────────────────────────
// submission pipeline status → label + variant + "needs human" routing
// ───────────────────────────────────────────────────────────────────────────
const SUB_STATUS: Record<
  string,
  { label: string; variant: BadgeVariant; needsReview?: boolean; failed?: boolean }
> = {
  uploaded: { label: "Uploaded", variant: "neutral" },
  scouting: { label: "Scouting", variant: "info" },
  scouting_failed: { label: "Scout failed", variant: "error", failed: true },
  scouting_complete: { label: "Scouted", variant: "info" },
  grading: { label: "Grading", variant: "warning" },
  grading_partial: { label: "Partly graded", variant: "warning", needsReview: true },
  grading_failed: { label: "Grade failed", variant: "error", failed: true },
  grading_complete: { label: "Graded", variant: "success" },
  finalization_failed: { label: "Finalize failed", variant: "error", failed: true },
  ready_for_review: { label: "Needs review", variant: "warning", needsReview: true },
  reviewed: { label: "Reviewed", variant: "success" },
  failed: { label: "Failed", variant: "error", failed: true },
  manual_review_needed: { label: "Needs review", variant: "warning", needsReview: true },
};
export function subStatus(status: unknown): {
  label: string;
  variant: BadgeVariant;
  needsReview: boolean;
  failed: boolean;
} {
  const s = SUB_STATUS[String(status)] ?? {
    label: String(status ?? "—"),
    variant: "neutral" as BadgeVariant,
  };
  return {
    label: s.label,
    variant: s.variant,
    needsReview: Boolean(s.needsReview),
    failed: Boolean(s.failed),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// confidence band ('low' | 'mid' | 'high') from a 0–1 score or band string
// ───────────────────────────────────────────────────────────────────────────
export type Band = "low" | "mid" | "high";
export function bandOf(score: unknown): Band {
  if (typeof score !== "number" || !Number.isFinite(score)) return "low";
  if (score >= 0.9) return "high";
  if (score >= 0.7) return "mid";
  return "low";
}
const BAND_META: Record<Band, { label: string; variant: BadgeVariant; icon: string }> = {
  high: { label: "High", variant: "success", icon: "shield-check" },
  mid: { label: "Medium", variant: "warning", icon: "shield-alert" },
  low: { label: "Low", variant: "error", icon: "shield-x" },
};

/** Inline confidence badge (stand-in for the barrel `ConfidenceBadge`). */
export function ConfidenceBadge({
  band,
  score,
  hidePercent,
}: {
  band?: Band;
  score?: number;
  hidePercent?: boolean;
}) {
  const b = band ?? bandOf(score);
  const m = BAND_META[b];
  const showPct = !hidePercent && typeof score === "number" && Number.isFinite(score);
  return (
    <Badge variant={m.variant} icon={<Icon name={m.icon} size={12} />}>
      {m.label}
      {showPct ? ` · ${Math.round(score! * 100)}%` : ""}
    </Badge>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// inline mini charts (pure RN <View> widths — no chart dep)
// ───────────────────────────────────────────────────────────────────────────
const RAMP = ["#2F7D5B", "#5C8A4A", "#B7791F", "#C2603E", "#B23A36"];

/** A simple 0–100 score bar. */
export function ScoreBar({
  value,
  tone = "#423A82",
  height = 8,
}: {
  value: number;
  tone?: string;
  height?: number;
}) {
  const w = Math.max(0, Math.min(100, num(value)));
  return (
    <View className="rounded-pill bg-surface-sunken overflow-hidden" style={{ height }}>
      <View style={{ width: `${w}%`, height, backgroundColor: tone }} />
    </View>
  );
}

/** Labelled horizontal bars (distribution / per-topic / per-question). */
export function DistRows({
  rows,
  showValue = true,
}: {
  rows: Array<{ label: ReactNode; value: number; max?: number; color?: string }>;
  showValue?: boolean;
}) {
  const peak = Math.max(1, ...rows.map((r) => num(r.max ?? r.value)));
  return (
    <View className="gap-2.5">
      {rows.map((r, i) => {
        const w = Math.max(2, Math.min(100, (num(r.value) / peak) * 100));
        return (
          <View key={i} className="gap-1">
            <View className="flex-row items-center justify-between">
              <Text className="text-text-secondary text-xs" numberOfLines={1}>
                {r.label}
              </Text>
              {showValue ? (
                <Text className="text-2xs text-text-muted font-mono">{round1(num(r.value))}</Text>
              ) : null}
            </View>
            <View className="rounded-pill bg-surface-sunken overflow-hidden" style={{ height: 8 }}>
              <View
                style={{
                  width: `${w}%`,
                  height: 8,
                  backgroundColor: r.color ?? RAMP[i % RAMP.length],
                }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** A single stacked distribution bar (e.g. grade A/B/C/D/F counts). */
export function StackedBar({
  segments,
  height = 12,
}: {
  segments: Array<{ value: number; color?: string }>;
  height?: number;
}) {
  const total = Math.max(
    1,
    segments.reduce((s, x) => s + num(x.value), 0)
  );
  return (
    <View className="rounded-pill bg-surface-sunken flex-row overflow-hidden" style={{ height }}>
      {segments.map((s, i) =>
        num(s.value) > 0 ? (
          <View
            key={i}
            style={{
              flex: num(s.value) / total,
              backgroundColor: s.color ?? RAMP[i % RAMP.length],
            }}
          />
        ) : null
      )}
    </View>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// section card wrapper + stat tiles row
// ───────────────────────────────────────────────────────────────────────────
export function Section({
  title,
  right,
  children,
  className,
}: {
  title?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <View className={`gap-3 ${className ?? ""}`}>
      {title != null ? (
        <View className="flex-row items-center justify-between">
          <Text className="font-display text-text-primary text-base">{title}</Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** Small KPI tile (label + value + optional caption). */
export function Kpi({
  label,
  value,
  caption,
  tone = "text-text-primary",
}: {
  label: ReactNode;
  value: ReactNode;
  caption?: ReactNode;
  tone?: string;
}) {
  return (
    <Card className="min-w-[44%] flex-1 gap-1 py-3">
      <Text className="text-2xs text-text-muted uppercase tracking-wide">{label}</Text>
      <Text className={`font-display text-xl ${tone}`}>{value}</Text>
      {caption != null ? <Text className="text-2xs text-text-muted">{caption}</Text> : null}
    </Card>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// loading / empty / error states
// ───────────────────────────────────────────────────────────────────────────
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Screen className="bg-canvas" contentClassName="gap-3 p-4">
      <Skeleton height={64} radius={14} />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={84} radius={14} />
      ))}
    </Screen>
  );
}

export function ErrorCard({ onRetry }: { onRetry?: () => void }) {
  return (
    <Screen className="bg-canvas" contentClassName="p-5">
      <View className="py-12">
        <Card className="items-center gap-3 py-8">
          <Icon name="cloud-off" size={28} color="#756E61" />
          <Text className="font-display text-text-primary text-base">Couldn’t load this</Text>
          <Text className="text-text-muted px-6 text-center text-sm">
            Something didn’t load right — this one’s on us. Give it another go.
          </Text>
          {onRetry ? (
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<Icon name="rotate-cw" size={15} />}
              onPress={onRetry}
            >
              Try again
            </Button>
          ) : null}
        </Card>
      </View>
    </Screen>
  );
}

/** Friendly "nothing here yet" card (the GATE-B / fresh-account default). */
export function MissingParam({ what }: { what: string }) {
  return (
    <Screen className="bg-canvas" contentClassName="p-5">
      <View className="py-12">
        <Card className="items-center gap-2 py-8">
          <Icon name="link-2-off" size={26} color="#756E61" />
          <Text className="font-display text-text-primary text-base">Missing {what}</Text>
          <Text className="text-text-muted px-6 text-center text-sm">
            Open this screen from an exam or submission to see its details.
          </Text>
        </Card>
      </View>
    </Screen>
  );
}
