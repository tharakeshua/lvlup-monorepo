/**
 * `v1.autograde.listQuestionSubmissions` — per-question grading results for a
 * submission. Released-gate + answer-key projection (⚷): `evaluation` is returned
 * ONLY when the result is visible; the answer key is NEVER returned and cost
 * telemetry inside `evaluation` is stripped server-side. No `tenantId` (D2). Read tier.
 */
import { z } from "zod";
import { zObject, zSubmissionId } from "@levelup/domain";
import type { CallableDef } from "../../callable-def.js";
import { QuestionSubmissionViewSchema } from "./_shared.js";

export const ListQuestionSubmissionsRequestSchema = zObject({
  submissionId: zSubmissionId,
});
export type ListQuestionSubmissionsRequest = z.infer<typeof ListQuestionSubmissionsRequestSchema>;

export const ListQuestionSubmissionsResponseSchema = zObject({
  questionSubmissions: z.array(QuestionSubmissionViewSchema),
});
export type ListQuestionSubmissionsResponse = z.infer<typeof ListQuestionSubmissionsResponseSchema>;

export const listQuestionSubmissionsDef = {
  name: "v1.autograde.listQuestionSubmissions",
  module: "autograde",
  requestSchema: ListQuestionSubmissionsRequestSchema,
  responseSchema: ListQuestionSubmissionsResponseSchema,
  authMode: "authed",
  rateTier: "read",
} as const satisfies CallableDef<ListQuestionSubmissionsRequest, ListQuestionSubmissionsResponse>;
