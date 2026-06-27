/**
 * `v1.autograde.getExamAnalytics` — read-only exam analytics (analytics-fn-owned
 * source; SDK reads, never writes). Teacher/admin only, class-breakdown scoped
 * server-side. No `tenantId` (D2). Read tier.
 */
import { z } from "zod";
import { zObject, zExamId } from "@levelup/domain";
import type { CallableDef } from "../../callable-def.js";
import { ExamAnalyticsViewSchema } from "./_shared.js";

export const GetExamAnalyticsRequestSchema = zObject({
  examId: zExamId,
});
export type GetExamAnalyticsRequest = z.infer<typeof GetExamAnalyticsRequestSchema>;

export const GetExamAnalyticsResponseSchema = ExamAnalyticsViewSchema;
export type GetExamAnalyticsResponse = z.infer<typeof GetExamAnalyticsResponseSchema>;

export const getExamAnalyticsDef = {
  name: "v1.autograde.getExamAnalytics",
  module: "autograde",
  requestSchema: GetExamAnalyticsRequestSchema,
  responseSchema: GetExamAnalyticsResponseSchema,
  authMode: "authed",
  rateTier: "read",
} as const satisfies CallableDef<GetExamAnalyticsRequest, GetExamAnalyticsResponse>;
