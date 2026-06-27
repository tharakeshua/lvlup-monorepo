/**
 * `v1.autograde.listQuestions` — questions for an exam. The server STRIPS rubric
 * guidance (`modelAnswer`/`evaluatorGuidance`/dimension `promptGuidance`) for
 * non-authoring roles (⚷ projection). No `tenantId` (D2). Read tier.
 */
import { z } from "zod";
import { zObject, zExamId } from "@levelup/domain";
import type { CallableDef } from "../../callable-def.js";
import { ExamQuestionViewSchema } from "./_shared.js";

export const ListQuestionsRequestSchema = zObject({
  examId: zExamId,
});
export type ListQuestionsRequest = z.infer<typeof ListQuestionsRequestSchema>;

export const ListQuestionsResponseSchema = zObject({
  questions: z.array(ExamQuestionViewSchema),
});
export type ListQuestionsResponse = z.infer<typeof ListQuestionsResponseSchema>;

export const listQuestionsDef = {
  name: "v1.autograde.listQuestions",
  module: "autograde",
  requestSchema: ListQuestionsRequestSchema,
  responseSchema: ListQuestionsResponseSchema,
  authMode: "authed",
  rateTier: "read",
} as const satisfies CallableDef<ListQuestionsRequest, ListQuestionsResponse>;
