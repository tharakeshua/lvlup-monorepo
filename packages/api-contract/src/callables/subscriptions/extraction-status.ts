/**
 * v1.autograde.extractionStatus — live question-extraction + rubric-generation
 * progress for one exam.
 *
 * SINGLE slim RTDB node `extractionProgress/{t}/exam/{examId}/status`, written by
 * the extractQuestions service as it runs its two passes (AD-12 RTDB-projection
 * pattern; mirrors `examGrading`). Teacher/staff/tenantAdmin dashboards subscribe
 * to one node and watch the phase advance.
 *
 * SLIM + ⚷-safe: counters + phase only. NEVER question text, rubric content,
 * modelAnswer, evaluatorGuidance, or cost — those are refetched (role-filtered)
 * via `v1.autograde.listQuestions`. Per-question rubric state lives on the
 * question docs as `rubricStatus`, not here.
 *
 * Plan: docs/autograde-extraction/ARCHITECTURE-PLAN.md §2.2.
 */
import { z } from "zod";
import { zObject, zExamId } from "@levelup/domain";
import { defineSubscription } from "../../subscriptions/subscription-def.js";

export const EXTRACTION_PHASES = [
  "extracting_questions",
  "questions_extracted",
  "generating_rubrics",
  "complete",
  "failed",
] as const;

/** Slim per-exam extraction progress — counters + phase, no ⚷ content. */
export const ExtractionStatusSchema = zObject({
  examId: zExamId,
  phase: z.enum(EXTRACTION_PHASES),
  /** 0 until Pass 1 lands; then the total question count. */
  totalQuestions: z.number().int().min(0),
  /** How many questions have a generated rubric so far. */
  rubricsGenerated: z.number().int().min(0),
  mode: z.enum(["full", "single", "rubrics"]).optional(),
  /** Present only on `failed` — a message, never a stack. */
  error: z.string().optional(),
  failedPhase: z.enum(["questions", "rubrics"]).optional(),
  updatedAt: z.string(),
});
export type ExtractionStatus = z.infer<typeof ExtractionStatusSchema>;

export const ExtractionStatusParamsSchema = zObject({ examId: zExamId });
export type ExtractionStatusParams = z.infer<typeof ExtractionStatusParamsSchema>;

export const extractionStatus = defineSubscription({
  name: "v1.autograde.extractionStatus",
  module: "autograde",
  source: "rtdb-node",
  params: ExtractionStatusParamsSchema,
  payload: ExtractionStatusSchema,
});
