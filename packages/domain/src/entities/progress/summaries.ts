/**
 * StudentProgressSummary, ClassProgressSummary, LearningInsight — trigger-maintained
 * denormalized summaries (⚷ server-only write). `atRiskReasons` typed (not string[]);
 * `streakDays` required computed. `recompute` marker splits the 4-writer fan-out
 * (analytics §RecomputeMarker).
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import { zStudentId, zClassId, zTenantId, zInsightId } from "../../primitives/branded-id.zod.js";
import { zTimestamp } from "../../primitives/timestamp.zod.js";
import {
  zAtRiskReason,
  zInsightType,
  zInsightPriority,
  zInsightActionType,
} from "../../enums/analytics.js";

export const RecomputeMarkerSchema = zObject({
  reason: z.enum(["autograde", "levelup", "storyPoint", "atRisk", "manual"]),
  requestedAt: zTimestamp,
  taskId: z.string().optional(),
});
export type RecomputeMarker = z.infer<typeof RecomputeMarkerSchema>;

export const RecentExamEntrySchema = zObject({
  examId: z.string(),
  examTitle: z.string(),
  score: z.number(),
  percentage: z.number(),
  date: zTimestamp,
});
export type RecentExamEntry = z.infer<typeof RecentExamEntrySchema>;

export const RecentActivityEntrySchema = zObject({
  spaceId: z.string(),
  spaceTitle: z.string(),
  pointsEarned: z.number(),
  date: zTimestamp,
});
export type RecentActivityEntry = z.infer<typeof RecentActivityEntrySchema>;

export const AutogradeSubjectBreakdownSchema = zObject({
  avgScore: z.number(),
  examCount: z.number().int(),
});
export type AutogradeSubjectBreakdown = z.infer<typeof AutogradeSubjectBreakdownSchema>;

export const StudentAutogradeMetricsSchema = zObject({
  totalExams: z.number().int(),
  completedExams: z.number().int(),
  averageScore: z.number(),
  averagePercentage: z.number(),
  totalMarksObtained: z.number(),
  totalMarksAvailable: z.number(),
  subjectBreakdown: z.record(z.string(), AutogradeSubjectBreakdownSchema),
  recentExams: z.array(RecentExamEntrySchema),
});
export type StudentAutogradeMetrics = z.infer<typeof StudentAutogradeMetricsSchema>;

export const StudentLevelupMetricsSchema = zObject({
  totalSpaces: z.number().int(),
  completedSpaces: z.number().int(),
  averageCompletion: z.number(),
  totalPointsEarned: z.number(),
  totalPointsAvailable: z.number(),
  averageAccuracy: z.number(),
  streakDays: z.number().int(),
  subjectBreakdown: z.record(z.string(), z.number()),
  recentActivity: z.array(RecentActivityEntrySchema),
});
export type StudentLevelupMetrics = z.infer<typeof StudentLevelupMetricsSchema>;

export const StudentProgressSummarySchema = zObject({
  id: zStudentId,
  tenantId: zTenantId,
  studentId: zStudentId,
  autograde: StudentAutogradeMetricsSchema,
  levelup: StudentLevelupMetricsSchema,
  overallScore: z.number(),
  strengthAreas: z.array(z.string()).default([]),
  weaknessAreas: z.array(z.string()).default([]),
  isAtRisk: z.boolean(),
  atRiskReasons: z.array(zAtRiskReason).default([]),
  lastUpdatedAt: zTimestamp,
  recompute: RecomputeMarkerSchema.optional(),
});
export type StudentProgressSummary = z.infer<typeof StudentProgressSummarySchema>;

export const ClassAutogradeMetricsSchema = zObject({
  averageScore: z.number(),
  averagePercentage: z.number(),
  examCount: z.number().int(),
  passRate: z.number(),
});
export type ClassAutogradeMetrics = z.infer<typeof ClassAutogradeMetricsSchema>;

export const ClassLevelupMetricsSchema = zObject({
  averageCompletion: z.number(),
  totalPointsEarned: z.number(),
  activeStudents: z.number().int(),
});
export type ClassLevelupMetrics = z.infer<typeof ClassLevelupMetricsSchema>;

export const ClassProgressSummarySchema = zObject({
  id: zClassId,
  tenantId: zTenantId,
  classId: zClassId,
  className: z.string(),
  studentCount: z.number().int(),
  autograde: ClassAutogradeMetricsSchema,
  levelup: ClassLevelupMetricsSchema,
  atRiskStudentIds: z.array(zStudentId).default([]),
  atRiskCount: z.number().int(),
  lastUpdatedAt: zTimestamp,
});
export type ClassProgressSummary = z.infer<typeof ClassProgressSummarySchema>;

export const LearningInsightSchema = zObject({
  id: zInsightId,
  tenantId: zTenantId,
  studentId: zStudentId,
  type: zInsightType,
  priority: zInsightPriority,
  title: z.string(),
  description: z.string(),
  actionType: zInsightActionType,
  actionEntityId: z.string().optional(),
  actionEntityTitle: z.string().optional(),
  createdAt: zTimestamp,
  dismissedAt: zTimestamp.nullable(),
});
export type LearningInsight = z.infer<typeof LearningInsightSchema>;
