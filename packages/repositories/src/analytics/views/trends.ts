/**
 * `trendsRepo` — VIEW repo for performance trends (SDK-LAYERS-PLAN §4.1,
 * analytics.md §trendsRepo). Under `src/analytics/views/**` (R6 exception).
 *
 * The server already aggregates `PerformanceTrendPoint[]` (bucketed by
 * granularity); this repo issues ONE `v1.analytics.getPerformanceTrends` read and
 * maps the points to a chart series (derived, computed once — no client-side
 * re-aggregation, no N+1).
 *
 * Composes only `api` (never sibling repos) — declared view repo.
 */
import type { Timestamp } from "@levelup/domain";
import type {
  ApiClient,
  GetPerformanceTrendsRequest,
  PerformanceTrendPoint,
} from "../api-types.js";

/** A single chart-series datum mapped from a trend point. */
export interface TrendSeriesPoint {
  periodStart: Timestamp;
  avgPercentage: number;
  completionPct: number;
  overallScore: number;
  examCount: number;
}

export interface TrendsRepo {
  get(filter: GetPerformanceTrendsRequest): Promise<PerformanceTrendPoint[]>;
  /** Map trend points to a chart series (derived; server already aggregated). */
  computeChartSeries(points: readonly PerformanceTrendPoint[]): TrendSeriesPoint[];
}

export function createTrendsRepo(api: ApiClient): TrendsRepo {
  return {
    get: async (filter) => {
      const res = await api.analytics.getPerformanceTrends(filter);
      return res.points;
    },

    computeChartSeries: (points) =>
      points.map((p) => ({
        periodStart: p.periodStart,
        avgPercentage: p.avgPercentage,
        completionPct: p.completionPct,
        overallScore: p.overallScore,
        examCount: p.examCount,
      })),
  };
}
