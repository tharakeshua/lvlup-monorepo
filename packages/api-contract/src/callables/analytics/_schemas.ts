/**
 * Shared analytics response/value-object schemas referenced by multiple callable
 * defs in this module. These are *wire* shapes (response shaping) that the plan
 * pins to the analytics domain but that have no standalone entity in `@levelup/domain`:
 * `PlatformSummary` (C29), `ParentAlert` (C18), `PerformanceTrendPoint`, the
 * `getSummary{scope:'class'}` `tenantRollup` + `masteryDistribution` shaping (C6),
 * and the `ChildRow` / `LinkedChild` parent list row.
 *
 * Every object is `.strict()` (via `zObject`). ISO-8601 `Timestamp`. Branded IDs on
 * persisted shapes. No `tenantId` field (claim-derived server-side).
 *
 * Plan refs: SDK-LAYERS-PLAN.md §2.6, §9 (C6/C18/C25/C29), domains/analytics.md.
 */
import { z } from "zod";
import {
  zObject,
  zStudentId,
  zClassId,
  zTenantId,
  zTimestamp,
  zAtRiskReason,
  type StudentProgressSummary,
  type ClassProgressSummary,
  type LearningInsight,
  type HealthSnapshot,
  StudentProgressSummarySchema,
  ClassProgressSummarySchema,
  LearningInsightSchema,
  HealthSnapshotSchema,
} from "@levelup/domain";

// ---------------------------------------------------------------------------
// PerformanceTrendPoint (new entity backing getPerformanceTrends — domains/analytics.md L54)
// ---------------------------------------------------------------------------
export const PerformanceTrendPointSchema = zObject({
  periodStart: zTimestamp,
  periodEnd: zTimestamp,
  avgPercentage: z.number(),
  examCount: z.number().int(),
  completionPct: z.number(),
  overallScore: z.number(),
});
export type PerformanceTrendPoint = z.infer<typeof PerformanceTrendPointSchema>;

export const TREND_GRANULARITIES = ["week", "month", "term"] as const;
export const zTrendGranularity = z.enum(TREND_GRANULARITIES);
export type TrendGranularity = (typeof TREND_GRANULARITIES)[number];

/** Optional `{from,to}` ISO window for trend/cost range queries. */
export const TimeRangeSchema = zObject({
  from: zTimestamp,
  to: zTimestamp,
});
export type TimeRange = z.infer<typeof TimeRangeSchema>;

// ---------------------------------------------------------------------------
// getSummary{scope:'class'} rollup shaping (C6 — §9.2)
// ---------------------------------------------------------------------------
export const PerClassRollupRowSchema = zObject({
  classId: zClassId,
  name: z.string(),
  avg: z.number(),
  atRisk: z.number().int(),
});
export type PerClassRollupRow = z.infer<typeof PerClassRollupRowSchema>;

export const TenantRollupSchema = zObject({
  academyAvg: z.number(),
  perClass: z.array(PerClassRollupRowSchema),
});
export type TenantRollup = z.infer<typeof TenantRollupSchema>;

/** (notStarted / inProgress / mastered) buckets — C6 + GAP-2. */
export const MasteryDistributionSchema = zObject({
  notStarted: z.number().int(),
  inProgress: z.number().int(),
  mastered: z.number().int(),
});
export type MasteryDistribution = z.infer<typeof MasteryDistributionSchema>;

/** Class-scope summary response = the domain entity + the server-aggregated rollups. */
export const ClassSummaryViewSchema = zObject({
  ...ClassProgressSummarySchema.shape,
  tenantRollup: TenantRollupSchema,
  masteryDistribution: MasteryDistributionSchema,
});
export type ClassSummaryView = z.infer<typeof ClassSummaryViewSchema>;

// ---------------------------------------------------------------------------
// PlatformSummary shaping (C29 — §9.3 / web-super-admin G5)
// ---------------------------------------------------------------------------
export const PlatformKpisSchema = zObject({
  tenantCount: z.number().int(),
  userCount: z.number().int(),
  examCount: z.number().int(),
  activeTenantCount: z.number().int(),
});
export type PlatformKpis = z.infer<typeof PlatformKpisSchema>;

export const GrowthSeriesPointSchema = zObject({
  date: zTimestamp,
  tenants: z.number().int(),
  users: z.number().int(),
});
export type GrowthSeriesPoint = z.infer<typeof GrowthSeriesPointSchema>;

export const TopTenantRowSchema = zObject({
  tenantId: zTenantId,
  name: z.string(),
  users: z.number().int(),
  exams: z.number().int(),
});
export type TopTenantRow = z.infer<typeof TopTenantRowSchema>;

export const TenantComparisonRowSchema = zObject({
  tenantId: zTenantId,
  name: z.string(),
  users: z.number().int(),
  exams: z.number().int(),
  growthPct: z.number(),
});
export type TenantComparisonRow = z.infer<typeof TenantComparisonRowSchema>;

export const PlatformSummarySchema = zObject({
  kpis: PlatformKpisSchema,
  growthSeries: z.array(GrowthSeriesPointSchema),
  planDistribution: z.record(z.string(), z.number().int()),
  topTenants: z.array(TopTenantRowSchema),
  tenantComparison: z.array(TenantComparisonRowSchema),
});
export type PlatformSummary = z.infer<typeof PlatformSummarySchema>;

// ---------------------------------------------------------------------------
// Health-scope summary (super-admin) — wraps the HealthSnapshot projection
// ---------------------------------------------------------------------------
export const HealthSummarySchema = zObject({
  snapshot: HealthSnapshotSchema,
});
export type HealthSummary = z.infer<typeof HealthSummarySchema>;

// ---------------------------------------------------------------------------
// ParentAlert (C18 — §9.2) + linked-children list row
// ---------------------------------------------------------------------------
export const PARENT_ALERT_KINDS = ["at_risk", "low_score", "low_streak"] as const;
export const zParentAlertKind = z.enum(PARENT_ALERT_KINDS);
export type ParentAlertKind = (typeof PARENT_ALERT_KINDS)[number];

export const ParentAlertSchema = zObject({
  studentId: zStudentId,
  name: z.string(),
  kind: zParentAlertKind,
  detail: z.string(),
  createdAt: zTimestamp,
});
export type ParentAlert = z.infer<typeof ParentAlertSchema>;

/** Row for `listLinkedChildren` (parent dashboard). */
export const LinkedChildRowSchema = zObject({
  studentId: zStudentId,
  name: z.string(),
  classNames: z.array(z.string()),
  overallScore: z.number(),
  isAtRisk: z.boolean(),
  atRiskReasons: z.array(zAtRiskReason).default([]),
});
export type LinkedChildRow = z.infer<typeof LinkedChildRowSchema>;

// ---------------------------------------------------------------------------
// getAssignmentMatrix projection (C12 optional tracker — §9.2)
// ---------------------------------------------------------------------------
export const ASSIGNMENT_MATRIX_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
  "overdue",
] as const;
export const zAssignmentMatrixStatus = z.enum(ASSIGNMENT_MATRIX_STATUSES);
export type AssignmentMatrixStatus = (typeof ASSIGNMENT_MATRIX_STATUSES)[number];

export const AssignmentMatrixCellSchema = zObject({
  studentId: zStudentId,
  status: zAssignmentMatrixStatus,
  completionPct: z.number(),
});
export type AssignmentMatrixCell = z.infer<typeof AssignmentMatrixCellSchema>;

export const AssignmentMatrixRowSchema = zObject({
  contentId: z.string(),
  contentTitle: z.string(),
  contentType: z.enum(["space", "exam"]),
  dueAt: zTimestamp.nullable(),
  cells: z.array(AssignmentMatrixCellSchema),
});
export type AssignmentMatrixRow = z.infer<typeof AssignmentMatrixRowSchema>;

export const AssignmentMatrixSchema = zObject({
  classId: zClassId,
  students: z.array(zObject({ studentId: zStudentId, name: z.string() })),
  rows: z.array(AssignmentMatrixRowSchema),
});
export type AssignmentMatrix = z.infer<typeof AssignmentMatrixSchema>;

// Re-export domain types referenced by callable response unions for convenience.
export type { StudentProgressSummary, ClassProgressSummary, LearningInsight, HealthSnapshot };
export { StudentProgressSummarySchema, LearningInsightSchema, ClassProgressSummarySchema };
