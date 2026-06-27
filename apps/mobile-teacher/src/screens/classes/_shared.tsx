/**
 * Shared helpers for the CLASSES lane (classes · roster · students · assign ·
 * student-detail). NOT a screen — the coordinator never imports from here.
 *
 * Everything is DEFENSIVE: `@levelup/query` reads come back as `unknown`, the
 * teacher callables are only partially live (GATE-B), and a fresh tenant has no
 * derived analytics yet. So every field read guards with `?.`/`??`, every list
 * coerces from the several shapes a repo `list` can take, and missing analytics
 * render as a muted "—" (NEVER a false-green zero).
 */
import { Pressable, Text, View } from "react-native";
import { AlertTriangle, Check, ChevronRight, Moon } from "lucide-react-native";

import { Avatar, Badge, Card, ProgressBar } from "../../components";

// ── theme hex (icon strokes + ring/colour overrides only) ────────────────────
export const C = {
  brand: "#423A82",
  brandSubtle: "#EDEBF7",
  spark: "#E8972B",
  success: "#2F7D5B",
  warning: "#B7791F",
  error: "#B23A36",
  muted: "#756E61",
  secondary: "#565046",
  ink: "#2A2620",
} as const;

// ── loose record reading ─────────────────────────────────────────────────────
export type Rec = Record<string, unknown>;
export const rec = (v: unknown): Rec => (v && typeof v === "object" ? (v as Rec) : {});

/** First defined string among the given keys. */
export function str(v: unknown, ...keys: string[]): string | undefined {
  const o = rec(v);
  for (const k of keys) {
    const x = o[k];
    if (typeof x === "string" && x.length > 0) return x;
    if (typeof x === "number") return String(x);
  }
  return undefined;
}

/** First finite number among the given keys, or undefined. */
export function numOf(v: unknown, ...keys: string[]): number | undefined {
  const o = rec(v);
  for (const k of keys) {
    const x = o[k];
    if (typeof x === "number" && Number.isFinite(x)) return x;
  }
  return undefined;
}

/** Coerce any repo `list` shape → a flat array. Handles `[]`, `{items}`,
 *  `{data}`, `{results}`, and the infinite `{pages:[{items}]}` shape. */
export function asArray<T = unknown>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const o = rec(data);
  if (Array.isArray(o.items)) return o.items as T[];
  if (Array.isArray(o.data)) return o.data as T[];
  if (Array.isArray(o.results)) return o.results as T[];
  if (Array.isArray(o.students)) return o.students as T[];
  if (Array.isArray(o.classes)) return o.classes as T[];
  if (Array.isArray(o.pages)) {
    return (o.pages as unknown[]).flatMap((p) => {
      const pr = rec(p);
      return Array.isArray(pr.items) ? (pr.items as T[]) : [];
    });
  }
  return [];
}

// ── formatters ───────────────────────────────────────────────────────────────
export const pct = (n: number | undefined | null): string =>
  n == null || !Number.isFinite(n) ? "—" : `${Math.round(n)}%`;
export const numFmt = (n: number | undefined | null): string =>
  n == null || !Number.isFinite(n) ? "—" : Math.round(n).toLocaleString("en-US");

/** Initials from a display name (max 2 letters). */
export function initialsOf(name: string | undefined): string {
  if (!name) return "·";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Any timestamp shape → Date|null. Never throws. */
export function toDateSafe(t: unknown): Date | null {
  if (t == null) return null;
  const maybe = t as { toDate?: () => Date; seconds?: number };
  if (typeof maybe.toDate === "function") {
    try {
      const d = maybe.toDate();
      return Number.isNaN(d?.getTime?.()) ? null : d;
    } catch {
      return null;
    }
  }
  if (typeof maybe.seconds === "number") return new Date(maybe.seconds * 1000);
  const d = new Date(t as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Compact "2d ago" / "5h ago" / "just now" relative label (or '' for none). */
export function relTime(t: unknown): string {
  const d = toDateSafe(t);
  if (!d) return "";
  const ms = Date.now() - d.getTime();
  if (ms < 0) return "just now";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  return `${mo}mo ago`;
}

/** Letter grade from a 0–100 score (for the GradePill-style chip). */
export function gradeFor(score: number | undefined | null): string | null {
  if (score == null || !Number.isFinite(score)) return null;
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 55) return "D";
  return "F";
}

export type StudentStatus = "active" | "inactive" | "pending" | "archived";

export function normStatus(s: string | undefined): StudentStatus {
  const v = (s ?? "").toLowerCase();
  if (v === "inactive") return "inactive";
  if (v === "archived") return "archived";
  if (v === "pending" || v === "invited" || v === "draft") return "pending";
  return "active";
}

// ── small shared composites ──────────────────────────────────────────────────

/** Status pill mirroring the web roster/directory design. */
export function StatusBadge({ status }: { status: StudentStatus }) {
  if (status === "inactive")
    return <Badge icon={<Moon size={12} color={C.muted} />}>Inactive</Badge>;
  if (status === "archived") return <Badge>Archived</Badge>;
  if (status === "pending") return <Badge variant="warning">Pending</Badge>;
  return (
    <Badge variant="success" icon={<Check size={12} color={C.success} />}>
      Active
    </Badge>
  );
}

/** Grade + score chip (e.g. "B · 84%"), or a muted "—" when no score yet. */
export function ScorePill({ score }: { score: number | null | undefined }) {
  if (score == null || !Number.isFinite(score)) {
    return <Text className="text-text-muted font-mono text-sm">—</Text>;
  }
  const g = gradeFor(score);
  const tone = score >= 75 ? "success" : score >= 50 ? "warning" : "error";
  return (
    <Badge variant={tone as "success" | "warning" | "error"}>
      {g ? `${g} · ` : ""}
      {pct(score)}
    </Badge>
  );
}

/**
 * One student row — used by the class roster AND the students directory.
 * Composed from base Lyceum primitives (no dependency on the teacher
 * component lane landing first).
 */
export function StudentRow({
  name,
  initials,
  sub,
  score,
  status,
  atRisk,
  lastActive,
  onPress,
}: {
  name: string;
  initials?: string;
  sub?: string;
  score?: number | null;
  status?: StudentStatus;
  atRisk?: boolean;
  lastActive?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${name}`}
      className="border-border-subtle bg-surface active:bg-surface-sunken flex-row items-center gap-3 rounded-lg border px-4 py-3"
    >
      <Avatar initials={initials ?? initialsOf(name)} size="md" />
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text className="font-ui text-text-primary text-sm font-semibold" numberOfLines={1}>
            {name}
          </Text>
          {atRisk ? <AlertTriangle size={13} color={C.error} strokeWidth={2.2} /> : null}
        </View>
        {sub ? (
          <Text className="text-2xs text-text-muted font-mono" numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      <View className="items-end gap-1">
        <ScorePill score={score} />
        {lastActive ? (
          <Text className="text-2xs text-text-muted font-mono">{lastActive}</Text>
        ) : status ? (
          <StatusBadge status={status} />
        ) : null}
      </View>
      <ChevronRight size={16} color={C.muted} />
    </Pressable>
  );
}

/** A KPI tile (label · big value · caption). Muted when value is "—". */
export function MetricTile({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string;
  caption?: string;
  tone?: "brand" | "spark" | "warning" | "success";
}) {
  const accent =
    tone === "spark"
      ? "text-marigold-600"
      : tone === "warning"
        ? "text-warning"
        : tone === "success"
          ? "text-success"
          : "text-text-primary";
  return (
    <View className="border-border-subtle bg-surface min-w-[46%] flex-1 gap-1 rounded-lg border px-4 py-3">
      <Text className="text-2xs font-ui text-text-muted uppercase tracking-wide">{label}</Text>
      <Text className={`font-mono text-2xl leading-none ${accent}`}>{value}</Text>
      {caption ? (
        <Text className="text-2xs font-ui text-text-muted" numberOfLines={1}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

/** A labelled progress row (e.g. a space's completion). */
export function ProgressRow({
  label,
  value,
  meta,
}: {
  label: string;
  value: number | undefined | null;
  meta?: string;
}) {
  const v = value == null || !Number.isFinite(value) ? null : Math.round(value);
  const done = (v ?? 0) >= 100;
  return (
    <Card>
      <View className="gap-2">
        <View className="flex-row items-center justify-between gap-3">
          <Text
            className="font-ui text-text-primary flex-1 text-sm font-semibold"
            numberOfLines={1}
          >
            {label}
          </Text>
          <Text className="text-text-secondary font-mono text-xs">
            {v == null ? "—" : done ? "done ✓" : `${v}%`}
          </Text>
        </View>
        <ProgressBar value={v ?? 0} variant={done ? "success" : "brand"} />
        {meta ? <Text className="text-2xs text-text-muted font-mono">{meta}</Text> : null}
      </View>
    </Card>
  );
}
