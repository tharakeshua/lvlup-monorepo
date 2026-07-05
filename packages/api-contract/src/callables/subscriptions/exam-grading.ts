/**
 * v1.autograde.examGrading — live exam-wide grading progress aggregate.
 *
 * SINGLE aggregate RTDB node `gradingProgress/{t}/exam/{examId}/agg` written O(1) per
 * tick by the pipeline (advancePipeline / finalizeSubmission) via the AD-12
 * RTDB-projection pattern — the counts are reduced from the exam's own `_index`
 * node, NEVER an O(submissions) Firestore fan-in query. Teacher dashboards subscribe
 * to one node.
 *
 * SLIM: counts + phase only; no per-student scores, no answer-key.
 *
 * Plan: SDK-LAYERS-PLAN §3.3 (examGrading row) / api-contract-core §7.2.
 */
import { z } from "zod";
import { zObject, zSubmissionPipelineStatus } from "@levelup/domain";
import { defineSubscription } from "../../subscriptions/subscription-def.js";

/** Single O(1)/tick aggregate — bounded counts + a coarse phase + cursor. */
export const ExamGradingProgressSchema = zObject({
  examId: z.string(),
  totalSubmissions: z.number().int().min(0),
  gradedSubmissions: z.number().int().min(0),
  failedSubmissions: z.number().int().min(0),
  pendingSubmissions: z.number().int().min(0),
  /** Coarse exam-wide phase (reuses the per-submission pipeline vocabulary). */
  phase: zSubmissionPipelineStatus.optional(),
  updatedAt: z.string(),
});
export type ExamGradingProgress = z.infer<typeof ExamGradingProgressSchema>;

export const ExamGradingParamsSchema = zObject({ examId: z.string() });
export type ExamGradingParams = z.infer<typeof ExamGradingParamsSchema>;

export const examGrading = defineSubscription({
  name: "v1.autograde.examGrading",
  module: "autograde",
  source: "rtdb-node",
  params: ExamGradingParamsSchema,
  payload: ExamGradingProgressSchema,
});
