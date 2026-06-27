/**
 * v1.analytics.getExamAnalytics — replaces the direct `examAnalytics/{examId}`
 * Firestore read (D13). Read tier, not idempotent. Plan: §2.6 L88.
 */
import { z } from "zod";
import { zObject, zExamId, ExamAnalyticsSchema } from "@levelup/domain";
import { defineCallable } from "../../callable-def.js";

export const GetExamAnalyticsRequestSchema = zObject({
  examId: zExamId,
});
export type GetExamAnalyticsRequest = z.infer<typeof GetExamAnalyticsRequestSchema>;

export const GetExamAnalyticsResponseSchema = ExamAnalyticsSchema;
export type GetExamAnalyticsResponse = z.infer<typeof GetExamAnalyticsResponseSchema>;

export const getExamAnalytics = defineCallable({
  name: "v1.analytics.getExamAnalytics",
  module: "analytics",
  requestSchema: GetExamAnalyticsRequestSchema,
  responseSchema: GetExamAnalyticsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
