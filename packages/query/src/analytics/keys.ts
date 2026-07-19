/**
 * analytics query-key helpers (domain plan analytics.md §Query hooks,
 * SDK-LAYERS-PLAN §4.2).
 *
 * A thin, domain-shaped facade over the shared `@levelup/query` key factories
 * (`summaryKeys`/`examAnalyticsKeys`/`insightKeys`/`costKeys`/`trendsKeys`/
 * `leaderboardKeys`/`analyticsKeys` from the registry). The factories own the
 * hierarchical `[domain, kind, …]` convention; these helpers name the specific
 * sub-keys this domain reads so the hooks reference ONE place:
 *
 *   student summary  → summaryKeys.sub('scope', 'student', { studentId })
 *   class summary    → summaryKeys.sub('scope', 'class',   { classId })
 *   platform summary → summaryKeys.detail('platform')
 *   health summary   → summaryKeys.detail('health')
 *   exam analytics   → examAnalyticsKeys.detail(examId)
 *   insights list    → insightKeys.infinite({ studentId, … })
 *   cost summary     → costKeys.list({ granularity, … })
 *   trends           → trendsKeys.list(filter)
 *   linked children  → analyticsKeys.sub('parent', 'children')
 *   child summary    → analyticsKeys.sub('parent', 'child', { studentId })
 *   leaderboard      → leaderboardKeys.list(filter)
 */
import {
  analyticsKeys,
  costKeys,
  examAnalyticsKeys,
  insightKeys,
  leaderboardKeys,
  summaryKeys,
  trendsKeys,
} from "../keys/registry.js";

/** Drop `undefined` fields → a stable, additive params object. */
function params(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out;
}

export const analyticsQueryKeys = {
  // ── summaries (one callable, scope-discriminated) ────────────────────────
  studentSummary: (studentId: string) =>
    summaryKeys.sub("scope", "student", params({ studentId: String(studentId) })),
  classSummary: (classId: string) =>
    summaryKeys.sub("scope", "class", params({ classId: String(classId) })),
  platformSummary: () => summaryKeys.detail("platform"),
  healthSummary: () => summaryKeys.detail("health"),

  // ── exam analytics ───────────────────────────────────────────────────────
  examAnalytics: (examId: string) => examAnalyticsKeys.detail(String(examId)),

  // ── insights (paginated) ─────────────────────────────────────────────────
  insightList: (filter?: object) => insightKeys.infinite(filter ?? {}),

  // ── cost (admin) ─────────────────────────────────────────────────────────
  costList: (filter?: object) => costKeys.list(filter ?? {}),

  // ── performance trends ───────────────────────────────────────────────────
  trends: (filter?: object) => trendsKeys.list(filter ?? {}),

  // ── parent dashboards (keyed under the analytics root) ───────────────────
  linkedChildren: (filter?: object) => analyticsKeys.sub("parent", "children", filter ?? {}),
  childSummary: (studentId: string) =>
    analyticsKeys.sub("parent", "child", params({ studentId: String(studentId) })),

  // ── leaderboard snapshot ─────────────────────────────────────────────────
  leaderboard: (filter?: object) => leaderboardKeys.list(filter ?? {}),
  spaceAnalytics: (spaceId: string) =>
    analyticsKeys.sub("space", "progress", { spaceId: String(spaceId) }),
} as const;

export {
  analyticsKeys,
  costKeys,
  examAnalyticsKeys,
  insightKeys,
  leaderboardKeys,
  summaryKeys,
  trendsKeys,
};
