/**
 * `v1.autograde.gradeQuestion` — combined grading command discriminated by `mode`:
 *   - `manual`: teacher writes a `ManualOverride` (score + feedback) for one question.
 *   - `retry`:  re-enqueue failed question(s) for the AI pipeline.
 *   - `ai`:     run AI grading for one question.
 *
 * Score authority is ⚷ server-only — the client never writes a `QuestionSubmission`
 * score directly; this command asks the server to compute/override it. No `tenantId`
 * (D2). AI rate tier, NOT idempotent (api-client-core §3.5 inventory). Modeled as a
 * discriminated union so each branch is independently `.strict()` and required fields
 * are enforced per mode.
 */
import { z } from "zod";
import {
  zObject,
  zExamId,
  zExamQuestionId,
  zSubmissionId,
  zQuestionGradingStatus,
} from "@levelup/domain";
import type { CallableDef } from "../../callable-def.js";

export const GRADE_QUESTION_MODES = ["manual", "retry", "ai"] as const;

const ManualBranchSchema = zObject({
  mode: z.literal("manual"),
  submissionId: zSubmissionId,
  questionId: zExamQuestionId,
  score: z.number(),
  feedback: z.string().optional(),
});

const RetryBranchSchema = zObject({
  mode: z.literal("retry"),
  submissionId: zSubmissionId,
  examId: zExamId.optional(),
  questionIds: z.array(zExamQuestionId).optional(),
});

const AiBranchSchema = zObject({
  mode: z.literal("ai"),
  submissionId: zSubmissionId,
  questionId: zExamQuestionId,
});

export const GradeQuestionRequestSchema = z.discriminatedUnion("mode", [
  ManualBranchSchema,
  RetryBranchSchema,
  AiBranchSchema,
]);
export type GradeQuestionRequest = z.infer<typeof GradeQuestionRequestSchema>;

export const GradeQuestionResponseSchema = zObject({
  success: z.boolean(),
  updatedScore: z.number().optional(),
  gradingStatus: zQuestionGradingStatus.optional(),
  retriedCount: z.number().int().optional(),
});
export type GradeQuestionResponse = z.infer<typeof GradeQuestionResponseSchema>;

export const gradeQuestionDef = {
  name: "v1.autograde.gradeQuestion",
  module: "autograde",
  requestSchema: GradeQuestionRequestSchema,
  responseSchema: GradeQuestionResponseSchema,
  authMode: "authed",
  rateTier: "ai",
  // NOT idempotent (api-client-core §3.5 inventory): gradeQuestion (manual/retry/ai)
  // is a non-idempotent write — no UUIDv7 key on the wire, bypasses the offline
  // queue, and is never auto-retried.
  // ⚷ score authority — the client never writes its own score.
  authoritySensitive: true,
  invalidates: ["submissions"],
} as const satisfies CallableDef<GradeQuestionRequest, GradeQuestionResponse>;
