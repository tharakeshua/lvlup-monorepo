/**
 * `v1.autograde.extractQuestions` — AI extraction of questions + resolved rubric
 * snapshot from the uploaded question paper. Combined-mode discriminator
 * (`mode: 'full' | 'single'`) kept per the plan; `'single'` re-extracts one
 * question by number. No `tenantId` (D2). AI rate tier; idempotent.
 */
import { z } from "zod";
import { zObject, zExamId } from "@levelup/domain";
import type { CallableDef } from "../../callable-def.js";
import { ExtractedQuestionSchema } from "./_shared.js";

// "rubrics" = resume path: skip Pass 1, run Pass-2 rubric generation ONLY for
// questions whose rubricStatus is still "pending" (partial-failure recovery).
export const EXTRACT_QUESTIONS_MODES = ["full", "single", "rubrics"] as const;

export const ExtractQuestionsRequestSchema = zObject({
  examId: zExamId,
  mode: z.enum(EXTRACT_QUESTIONS_MODES).optional(),
  questionNumber: z.string().optional(),
});
export type ExtractQuestionsRequest = z.infer<typeof ExtractQuestionsRequestSchema>;

export const ExtractQuestionsMetadataSchema = zObject({
  questionCount: z.number().int(),
  tokensUsed: z.number(),
  cost: z.number(),
  extractedAt: z.string(),
  imageQualityAcceptable: z.boolean(),
  mode: z.enum(EXTRACT_QUESTIONS_MODES).optional(),
});
export type ExtractQuestionsMetadata = z.infer<typeof ExtractQuestionsMetadataSchema>;

export const ExtractQuestionsResponseSchema = zObject({
  success: z.boolean(),
  questions: z.array(ExtractedQuestionSchema),
  warnings: z.array(z.string()),
  metadata: ExtractQuestionsMetadataSchema,
});
export type ExtractQuestionsResponse = z.infer<typeof ExtractQuestionsResponseSchema>;

export const extractQuestionsDef = {
  name: "v1.autograde.extractQuestions",
  module: "autograde",
  requestSchema: ExtractQuestionsRequestSchema,
  responseSchema: ExtractQuestionsResponseSchema,
  authMode: "authed",
  rateTier: "ai",
  idempotent: true,
  idempotencyKey: "transport",
  // ⚷ AI call + cost rollup + rubric-snapshot write are server-authoritative.
  authoritySensitive: true,
  invalidates: ["exams"],
} as const satisfies CallableDef<ExtractQuestionsRequest, ExtractQuestionsResponse>;
