/**
 * v1.analytics.getSpaceAnalytics — canonical teacher-facing progress and
 * engagement projection for one Space. The server batches the roster and
 * spaceProgress reads so clients never fan out per student.
 */
import { z } from "zod";
import { zObject, zSpaceId, zStudentId, zTimestamp } from "@levelup/domain";
import { defineCallable } from "../../callable-def.js";

export const SpaceAnalyticsStatusSchema = z.enum(["not_started", "in_progress", "completed"]);

export const SpaceAnalyticsStudentSchema = zObject({
  studentId: zStudentId,
  name: z.string(),
  classIds: z.array(z.string()),
  status: SpaceAnalyticsStatusSchema,
  completionPct: z.number().min(0).max(100),
  completedItems: z.number().int().nonnegative(),
  totalItems: z.number().int().nonnegative(),
  pointsEarned: z.number().nonnegative(),
  totalPoints: z.number().nonnegative(),
  timeSpentSeconds: z.number().nonnegative(),
  attempts: z.number().int().nonnegative(),
  lastActivityAt: zTimestamp.nullable(),
});
export type SpaceAnalyticsStudent = z.infer<typeof SpaceAnalyticsStudentSchema>;

export const SpaceAnalyticsSummarySchema = zObject({
  totalStudents: z.number().int().nonnegative(),
  startedStudents: z.number().int().nonnegative(),
  completedStudents: z.number().int().nonnegative(),
  activeStudents7d: z.number().int().nonnegative(),
  avgCompletionPct: z.number().min(0).max(100),
  avgTimeSpentSeconds: z.number().nonnegative(),
  totalAttempts: z.number().int().nonnegative(),
});
export type SpaceAnalyticsSummary = z.infer<typeof SpaceAnalyticsSummarySchema>;

export const GetSpaceAnalyticsRequestSchema = zObject({
  spaceId: zSpaceId,
});
export type GetSpaceAnalyticsRequest = z.infer<typeof GetSpaceAnalyticsRequestSchema>;

export const GetSpaceAnalyticsResponseSchema = zObject({
  spaceId: zSpaceId,
  generatedAt: zTimestamp,
  summary: SpaceAnalyticsSummarySchema,
  students: z.array(SpaceAnalyticsStudentSchema),
});
export type GetSpaceAnalyticsResponse = z.infer<typeof GetSpaceAnalyticsResponseSchema>;

export const getSpaceAnalytics = defineCallable({
  name: "v1.analytics.getSpaceAnalytics",
  module: "analytics",
  requestSchema: GetSpaceAnalyticsRequestSchema,
  responseSchema: GetSpaceAnalyticsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
