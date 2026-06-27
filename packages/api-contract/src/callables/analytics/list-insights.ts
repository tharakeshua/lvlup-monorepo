/**
 * v1.analytics.listInsights — paginated learning insights for a student.
 * Replaces direct `insights` read (D13). Read tier. Plan: §2.6 L89.
 */
import { z } from "zod";
import { zObject, zStudentId, LearningInsightSchema } from "@levelup/domain";
import { defineCallable } from "../../callable-def.js";
import { PageRequest, pageResponse } from "../../pagination.js";

export const ListInsightsRequestSchema = zObject({
  studentId: zStudentId,
  includeDismissed: z.boolean().optional(),
  ...PageRequest.shape,
});
export type ListInsightsRequest = z.infer<typeof ListInsightsRequestSchema>;

export const ListInsightsResponseSchema = pageResponse(LearningInsightSchema);
export type ListInsightsResponse = z.infer<typeof ListInsightsResponseSchema>;

export const listInsights = defineCallable({
  name: "v1.analytics.listInsights",
  module: "analytics",
  requestSchema: ListInsightsRequestSchema,
  responseSchema: ListInsightsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
