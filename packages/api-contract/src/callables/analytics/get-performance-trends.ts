/**
 * v1.analytics.getPerformanceTrends — server-aggregated trend series bucketed by
 * granularity. studentId (parent/teacher), classId, subjectId are optional scopes;
 * no `tenantId` (claim-derived). Plan: §2.6 L91, common-api §156.
 */
import { z } from "zod";
import { zObject, zStudentId, zClassId } from "@levelup/domain";
import { defineCallable } from "../../callable-def.js";
import { PerformanceTrendPointSchema, zTrendGranularity, TimeRangeSchema } from "./_schemas.js";

export const GetPerformanceTrendsRequestSchema = zObject({
  subjectId: z.string().optional(),
  studentId: zStudentId.optional(),
  classId: zClassId.optional(),
  granularity: zTrendGranularity,
  range: TimeRangeSchema.optional(),
});
export type GetPerformanceTrendsRequest = z.infer<typeof GetPerformanceTrendsRequestSchema>;

export const GetPerformanceTrendsResponseSchema = zObject({
  points: z.array(PerformanceTrendPointSchema),
});
export type GetPerformanceTrendsResponse = z.infer<typeof GetPerformanceTrendsResponseSchema>;

export const getPerformanceTrends = defineCallable({
  name: "v1.analytics.getPerformanceTrends",
  module: "analytics",
  requestSchema: GetPerformanceTrendsRequestSchema,
  responseSchema: GetPerformanceTrendsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
