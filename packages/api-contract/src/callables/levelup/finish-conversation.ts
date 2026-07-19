/** v1.levelup.finishConversation — request finalization; server owns grading/progress. */
import { z } from "zod";
import { StoredEvaluationSchema, zConversationSessionId } from "@levelup/domain";
import { defineCallable } from "./_shared.js";
import { ConversationSessionViewSchema, ItemSubmissionViewSchema } from "./_conversation-shared.js";

export const FinishConversationRequestSchema = z
  .object({
    sessionId: zConversationSessionId,
    clientRequestId: z.string().uuid(),
    reason: z.literal("learner_requested"),
    earlyFinishConfirmed: z.boolean().optional(),
  })
  .strict();
export type FinishConversationRequest = z.infer<typeof FinishConversationRequestSchema>;

export const FinishConversationResultSchema = z.discriminatedUnion("status", [
  z
    .object({ status: z.literal("completed"), evaluation: StoredEvaluationSchema.optional() })
    .strict(),
  z
    .object({ status: z.literal("grading_pending"), retryAfterMs: z.number().int().positive() })
    .strict(),
  z
    .object({
      status: z.literal("grading_failed"),
      retryable: z.boolean(),
      retryAfterMs: z.number().int().positive().optional(),
    })
    .strict(),
]);
export type FinishConversationResult = z.infer<typeof FinishConversationResultSchema>;

export const FinishConversationResponseSchema = z
  .object({
    session: ConversationSessionViewSchema,
    submission: ItemSubmissionViewSchema.optional(),
    result: FinishConversationResultSchema,
    replayed: z.boolean(),
  })
  .strict();
export type FinishConversationResponse = z.infer<typeof FinishConversationResponseSchema>;

export const finishConversationDef = defineCallable<
  FinishConversationRequest,
  FinishConversationResponse
>({
  name: "v1.levelup.finishConversation",
  module: "levelup",
  requestSchema: FinishConversationRequestSchema,
  responseSchema: FinishConversationResponseSchema,
  authMode: "authed",
  rateTier: "ai",
  idempotent: true,
  idempotencyKey: "transport",
  invalidates: ["conversations", "progress"],
  authoritySensitive: true,
});
