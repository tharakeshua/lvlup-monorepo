/**
 * `examAnalyticsRepo` ⊕ — read-only VIEW repo (SDK-LAYERS-PLAN §4.1, domain plan
 * autograde.md). Lives under `src/views/**` — the only sanctioned composition
 * surface (R6 exception, asserted by repo-isolation.static.test.ts).
 *
 *   get(examId) → ExamAnalyticsView — over getExamAnalytics
 *   Shaping: turns `questionAnalytics`/`classBreakdown` Record-maps into sorted
 *   arrays for chart rendering; computes grade-distribution percentages. NEVER
 *   written here (analytics-fn authors the doc; this is a read-side projection).
 *
 * Calls the injected api-client directly (a single shaped read) — it never
 * imports sibling repo modules.
 */
import type { ApiClient, ExamAnalyticsView } from "../autograde/api-types.js";

/** A `questionAnalytics`/`classBreakdown` map entry hoisted to a sortable row. */
export interface AnalyticsRow {
  key: string;
  value: Record<string, unknown>;
}

/** A grade-distribution slice with its computed share of the cohort. */
export interface GradeDistributionSlice {
  grade: string;
  count: number;
  pct: number;
}

export interface ExamAnalyticsRepo {
  get(examId: string): Promise<ExamAnalyticsView>;

  // derived shaping (computed once; no wire call)
  computeRows(map: Record<string, unknown> | null | undefined): AnalyticsRow[];
  computeGradeDistribution(
    map: Record<string, number> | null | undefined
  ): GradeDistributionSlice[];
}

export function createExamAnalyticsRepo(api: ApiClient): ExamAnalyticsRepo {
  const ag = api.autograde;

  return {
    get: (examId) => ag.getExamAnalytics({ examId: examId as never }),

    computeRows: (map) => {
      if (!map) return [];
      return Object.entries(map)
        .map(([key, value]) => ({ key, value: value as Record<string, unknown> }))
        .sort((a, b) => a.key.localeCompare(b.key));
    },

    computeGradeDistribution: (map) => {
      if (!map) return [];
      const entries = Object.entries(map);
      const total = entries.reduce((sum, [, count]) => sum + (count ?? 0), 0);
      return entries
        .map(([grade, count]) => ({
          grade,
          count: count ?? 0,
          pct: total > 0 ? Math.round(((count ?? 0) / total) * 100) : 0,
        }))
        .sort((a, b) => a.grade.localeCompare(b.grade));
    },
  };
}
