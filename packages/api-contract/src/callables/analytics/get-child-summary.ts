/**
 * v1.analytics.getChildSummary — parent read. `studentId` must be in caller's
 * `studentIds` claim (D10, enforced server-side). One round-trip vs getSummary +
 * listInsights. Plan: §2.6 L92, common-api §156.
 */
import { z } from "zod";
import {
  zObject,
  zStudentId,
  StudentProgressSummarySchema,
  LearningInsightSchema,
} from "@levelup/domain";
import { defineCallable } from "../../callable-def.js";

export const GetChildSummaryRequestSchema = zObject({
  studentId: zStudentId,
});
export type GetChildSummaryRequest = z.infer<typeof GetChildSummaryRequestSchema>;

export const GetChildSummaryResponseSchema = zObject({
  studentSummary: StudentProgressSummarySchema,
  recentInsights: z.array(LearningInsightSchema),
});
export type GetChildSummaryResponse = z.infer<typeof GetChildSummaryResponseSchema>;

export const getChildSummary = defineCallable({
  name: "v1.analytics.getChildSummary",
  module: "analytics",
  requestSchema: GetChildSummaryRequestSchema,
  responseSchema: GetChildSummaryResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
