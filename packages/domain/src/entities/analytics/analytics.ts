/**
 * Analytics read-side entities: ExamAnalytics, DailyCostSummary, MonthlyCostSummary,
 * LlmCallLog, HealthSnapshot, PlatformActivityLog. All trigger/aggregator-maintained
 * (⚷ server-only write). Cost-summary path normalized to costSummaries/{daily|monthly}.
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import {
  zExamAnalyticsId,
  zTenantId,
  zExamId,
  zClassId,
  zExamQuestionId,
  zLlmCallLogId,
  zCostSummaryId,
  zHealthSnapshotId,
  zPlatformActivityLogId,
  zUserId,
  zSpaceId,
} from "../../primitives/branded-id.zod.js";
import { zTimestamp } from "../../primitives/timestamp.zod.js";
import { zIsoDate } from "../../primitives/iso-date.zod.js";
import {
  zLlmCallStatus,
  zDayHealthStatus,
  zPlatformActivityAction,
} from "../../enums/analytics.js";

export const QuestionAnalyticsEntrySchema = zObject({
  questionId: zExamQuestionId,
  avgScore: z.number(),
  maxScore: z.number(),
  attemptCount: z.number().int(),
  difficultyIndex: z.number().optional(),
  discriminationIndex: z.number().optional(),
});
export type QuestionAnalyticsEntry = z.infer<typeof QuestionAnalyticsEntrySchema>;

export const ClassBreakdownEntrySchema = zObject({
  classId: zClassId,
  avgScore: z.number(),
  avgPercentage: z.number(),
  submissionCount: z.number().int(),
});
export type ClassBreakdownEntry = z.infer<typeof ClassBreakdownEntrySchema>;

export const TopicPerformanceEntrySchema = zObject({
  topic: z.string(),
  avgPercentage: z.number(),
  questionCount: z.number().int(),
});
export type TopicPerformanceEntry = z.infer<typeof TopicPerformanceEntrySchema>;

export const ScoreDistributionSchema = zObject({
  buckets: z.array(z.object({ label: z.string(), count: z.number().int() }).strict()),
  gradeDistribution: z.record(z.string(), z.number().int()).optional(),
});
export type ScoreDistribution = z.infer<typeof ScoreDistributionSchema>;

export const ExamAnalyticsSchema = zObject({
  id: zExamAnalyticsId,
  tenantId: zTenantId,
  examId: zExamId,
  totalSubmissions: z.number().int(),
  gradedSubmissions: z.number().int(),
  avgScore: z.number(),
  avgPercentage: z.number(),
  passRate: z.number(),
  medianScore: z.number(),
  scoreDistribution: ScoreDistributionSchema,
  questionAnalytics: z.record(z.string(), QuestionAnalyticsEntrySchema),
  classBreakdown: z.record(z.string(), ClassBreakdownEntrySchema),
  topicPerformance: z.record(z.string(), TopicPerformanceEntrySchema),
  computedAt: zTimestamp,
  lastUpdatedAt: zTimestamp,
});
export type ExamAnalytics = z.infer<typeof ExamAnalyticsSchema>;

export const CostBucketSchema = zObject({
  calls: z.number().int(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  costUsd: z.number(),
});
export type CostBucket = z.infer<typeof CostBucketSchema>;

const costSummaryShape = {
  totalCalls: z.number().int(),
  totalInputTokens: z.number().int(),
  totalOutputTokens: z.number().int(),
  totalCostUsd: z.number(),
  byPurpose: z.record(z.string(), CostBucketSchema),
  byModel: z.record(z.string(), CostBucketSchema),
  budgetLimitUsd: z.number().optional(),
  budgetUsedPercent: z.number().optional(),
  budgetAlertSent: z.boolean().optional(),
  computedAt: zTimestamp,
} as const;

export const DailyCostSummarySchema = zObject({
  id: zCostSummaryId,
  tenantId: zTenantId,
  date: zIsoDate,
  ...costSummaryShape,
});
export type DailyCostSummary = z.infer<typeof DailyCostSummarySchema>;

export const MonthlyCostSummarySchema = zObject({
  id: zCostSummaryId,
  tenantId: zTenantId,
  // YYYY-MM
  month: z.string().regex(/^\d{4}-\d{2}$/),
  ...costSummaryShape,
});
export type MonthlyCostSummary = z.infer<typeof MonthlyCostSummarySchema>;

export const LlmCallLogSchema = zObject({
  id: zLlmCallLogId,
  tenantId: zTenantId,
  functionName: z.string(),
  model: z.string(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  totalTokens: z.number().int(),
  costUSD: z.number(),
  latencyMs: z.number().int(),
  status: zLlmCallStatus,
  errorMessage: z.string().optional(),
  userId: zUserId.optional(),
  examId: zExamId.optional(),
  spaceId: zSpaceId.optional(),
  createdAt: zTimestamp,
});
export type LlmCallLog = z.infer<typeof LlmCallLogSchema>;

export const HealthSnapshotSchema = zObject({
  id: zHealthSnapshotId,
  date: zIsoDate,
  status: zDayHealthStatus,
  services: z.record(
    z.string(),
    z.object({ status: zDayHealthStatus, latencyMs: z.number().optional() }).strict()
  ),
  checkedAt: zTimestamp,
});
export type HealthSnapshot = z.infer<typeof HealthSnapshotSchema>;

export const PlatformActivityLogSchema = zObject({
  id: zPlatformActivityLogId,
  action: zPlatformActivityAction,
  actorUid: zUserId,
  actorEmail: z.string(),
  tenantId: zTenantId.optional(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: zTimestamp,
});
export type PlatformActivityLog = z.infer<typeof PlatformActivityLogSchema>;
