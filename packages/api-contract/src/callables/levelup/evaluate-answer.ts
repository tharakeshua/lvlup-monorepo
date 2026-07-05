/**
 * v1.levelup.evaluateAnswer — single-answer eval (practice/preview). May invoke
 * Gemini (ai tier). Server PERSISTS progress in the same call (be-levelup rec #7 —
 * no second round-trip) and returns the compact StoredEvaluation only (raw cost/
 * internal fields projected out). Idempotent on (uid, spaceId, itemId, answerHash).
 * Server computes the score → authoritySensitive, NOT optimistic.
 */
import { z } from "zod";
import { defineCallable } from "./_shared.js";
import { StoredEvaluationSchema } from "@levelup/domain";

export const EvaluateAnswerRequestSchema = z
  .object({
    spaceId: z.string(),
    storyPointId: z.string().optional(),
    itemId: z.string(),
    answer: z.unknown(),
    mode: z.enum(["practice", "preview"]).optional(),
    // Captured image/audio the learner attached to this answer. These are
    // server-scoped Storage PATHS (e.g. `tenants/{tenantId}/exams/.../x.jpg`),
    // NOT web URLs — the same shape autograde's `imageUrls` carries — so the value
    // is a plain string, never `.url()` (which rejects bare paths). Tenant-scoping
    // is enforced server-side before the paths are attached to the AI grader.
    mediaUrls: z.array(z.string().min(1)).max(20).optional(),
  })
  .strict();
export type EvaluateAnswerRequest = z.infer<typeof EvaluateAnswerRequestSchema>;

export const EvaluateAnswerResponseSchema = z
  .object({
    evaluation: StoredEvaluationSchema,
    progressRecorded: z.boolean(),
  })
  .strict();
export type EvaluateAnswerResponse = z.infer<typeof EvaluateAnswerResponseSchema>;

export const evaluateAnswerDef = defineCallable<EvaluateAnswerRequest, EvaluateAnswerResponse>({
  name: "v1.levelup.evaluateAnswer",
  module: "levelup",
  requestSchema: EvaluateAnswerRequestSchema,
  responseSchema: EvaluateAnswerResponseSchema,
  authMode: "authed",
  rateTier: "ai",
  idempotent: true,
  invalidates: ["storyPoints", "progress"],
  authoritySensitive: true,
});
