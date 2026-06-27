/**
 * Shared defensive readers + formatters for the Insights lane
 * (AnalyticsScreen / ReportsScreen / AiUsageCostScreen).
 *
 * Lane-local (lives under src/screens/insights/, owned by M-admin-home-insights).
 * Response shapes from the deploying admin/analytics callables may drift from the
 * TS types, so EVERY field read here is optional + guarded.
 */

/** A learning-insight row as rendered by the insights/reports feeds. */
export interface InsightRow {
  id?: string;
  type?: string;
  priority?: "high" | "medium" | "low" | string;
  title?: string;
  description?: string;
  actionType?: string;
  actionEntityTitle?: string;
  createdAt?: string;
  dismissedAt?: string | null;
}

/** A daily/monthly cost summary row (shared cost shape). */
export interface CostRow {
  id?: string;
  date?: string;
  month?: string;
  totalCalls?: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  totalCostUsd?: number;
  byPurpose?: Record<string, CostBucket | undefined>;
  byModel?: Record<string, CostBucket | undefined>;
  budgetLimitUsd?: number;
  budgetUsedPercent?: number;
  computedAt?: string;
}

export interface CostBucket {
  calls?: number;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  [k: string]: unknown;
}

/** A server-aggregated performance-trend point. */
export interface TrendPoint {
  date?: string;
  value?: number;
  label?: string;
  [k: string]: unknown;
}

/** Flatten an infinite-query result (`{ pages: [{ items }] }`) to a flat list. */
export function flattenPages<T = Record<string, unknown>>(data: unknown): T[] {
  const pages = (data as { pages?: unknown[] } | undefined)?.pages;
  if (!Array.isArray(pages)) return [];
  const out: T[] = [];
  for (const p of pages) {
    const items = (p as { items?: unknown[] } | null)?.items;
    if (Array.isArray(items)) out.push(...(items as T[]));
  }
  return out;
}

/** Normalize a plain-array OR `{ items }` response to a flat list. */
export function listOf<T = Record<string, unknown>>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const items = (res as { items?: unknown[] } | undefined)?.items;
  return Array.isArray(items) ? (items as T[]) : [];
}

/** Most-recent cost row by date/month string (lexicographic on ISO works). */
export function pickLatestCost(rows: unknown): CostRow | null {
  const arr = Array.isArray(rows) ? (rows as CostRow[]) : [];
  if (arr.length === 0) return null;
  return arr.reduce((best, cur) => {
    const bk = best.date ?? best.month ?? "";
    const ck = cur.date ?? cur.month ?? "";
    return ck >= bk ? cur : best;
  });
}

// ── formatters ──────────────────────────────────────────────────────────────
export const groupInt = (n: number): string =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export const fmtUsd = (n?: number | null): string =>
  n == null || Number.isNaN(n) ? "—" : `$${n.toFixed(2)}`;

export const fmtInt = (n?: number | null): string =>
  n == null || Number.isNaN(n) ? "—" : groupInt(n);

/** Compact token/count display: 42_118_940 → "42.1M". */
export const fmtCompact = (n?: number | null): string => {
  if (n == null || Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return groupInt(n);
};

/** "weak_topic_recommendation" → "Weak topic recommendation". */
export const humanize = (v?: string): string => {
  if (!v) return "";
  const s = v.replace(/[_-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Insight priority → Badge variant (icon+tone, never colour-alone upstream). */
export function priorityVariant(p?: string): "error" | "warning" | "neutral" {
  if (p === "high") return "error";
  if (p === "medium") return "warning";
  return "neutral";
}

/** Short relative-ish date label from an ISO string (defensive parse). */
export function shortDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
