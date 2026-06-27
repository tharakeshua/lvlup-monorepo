/**
 * `examAnalyticsRepo` — VIEW repo for per-exam analytics + charting shapes
 * (SDK-LAYERS-PLAN §4.1, analytics.md §examAnalyticsRepo). Under
 * `src/analytics/views/**` (R6 exception).
 *
 * `ExamAnalytics` is server-derived from grading outputs and gated on
 * `resultsReleased` (⚷). The SDK reads via `v1.analytics.getExamAnalytics` and
 * the repo turns the bounded record-maps into sorted arrays for the dashboard —
 * filtering out stub/zero fields (`discriminationIndex`/`difficultyIndex` only
 * surfaced when the server computed them; never a `0` placeholder).
 *
 * Composes only `api` (never sibling repos) — declared view repo.
 */
import type {
  ClassBreakdownEntry,
  ExamAnalytics,
  ExamId,
  QuestionAnalyticsEntry,
} from "@levelup/domain";
import type { ApiClient } from "../api-types.js";

/** A sorted-by-difficulty question row (stub fields omitted). */
export interface QuestionRow {
  questionId: string;
  avgScore: number;
  maxScore: number;
  attemptCount: number;
  difficultyIndex?: number;
  discriminationIndex?: number;
}

/** A per-class breakdown row. */
export interface ClassRow {
  classId: string;
  avgScore: number;
  avgPercentage: number;
  submissionCount: number;
}

/** A score-distribution bucket for charting. */
export interface DistributionBucket {
  label: string;
  count: number;
}

export interface ExamAnalyticsRepo {
  get(examId: ExamId): Promise<ExamAnalytics>;
  /** `questionAnalytics` record-map → array sorted by difficulty (derived). */
  computeQuestionRows(analytics: ExamAnalytics): QuestionRow[];
  /** `classBreakdown` record-map → array (derived). */
  computeClassRows(analytics: ExamAnalytics): ClassRow[];
  /** `scoreDistribution.buckets` → chart buckets (derived). */
  computeDistributionBuckets(analytics: ExamAnalytics): DistributionBucket[];
}

function toQuestionRow(entry: QuestionAnalyticsEntry): QuestionRow {
  const row: QuestionRow = {
    questionId: entry.questionId,
    avgScore: entry.avgScore,
    maxScore: entry.maxScore,
    attemptCount: entry.attemptCount,
  };
  // Only surface the indices the server actually computed (no `0` stubs).
  if (entry.difficultyIndex !== undefined) row.difficultyIndex = entry.difficultyIndex;
  if (entry.discriminationIndex !== undefined) row.discriminationIndex = entry.discriminationIndex;
  return row;
}

function toClassRow(entry: ClassBreakdownEntry): ClassRow {
  return {
    classId: entry.classId,
    avgScore: entry.avgScore,
    avgPercentage: entry.avgPercentage,
    submissionCount: entry.submissionCount,
  };
}

export function createExamAnalyticsRepo(api: ApiClient): ExamAnalyticsRepo {
  return {
    get: (examId) => api.analytics.getExamAnalytics({ examId }),

    computeQuestionRows: (analytics) =>
      Object.values(analytics.questionAnalytics)
        .map(toQuestionRow)
        // Easiest → hardest where computed; undefined difficulty sorts last.
        .sort((a, b) => (a.difficultyIndex ?? Infinity) - (b.difficultyIndex ?? Infinity)),

    computeClassRows: (analytics) =>
      Object.values(analytics.classBreakdown)
        .map(toClassRow)
        .sort((a, b) => b.avgPercentage - a.avgPercentage),

    computeDistributionBuckets: (analytics) =>
      analytics.scoreDistribution.buckets.map((b) => ({ label: b.label, count: b.count })),
  };
}
