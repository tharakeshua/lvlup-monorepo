/**
 * v1.levelup.sendChatMessage — AI tutor turn. Creates the session lazily when
 * `sessionId` is absent. Returns the concrete appended ChatMessage (not `unknown`).
 * ai tier; ✅ optimistic (user message append only).
 */
import { z } from "zod";
import { StoredEvaluationSchema } from "@levelup/domain";
import { defineCallable } from "./_shared.js";
import { ChatMessageSchema } from "./_shared.js";

export const SendChatMessageRequestSchema = z
  .object({
    sessionId: z.string().optional(),
    spaceId: z.string(),
    storyPointId: z.string(),
    itemId: z.string(),
    text: z.string().min(1),
    mediaUrls: z.array(z.string().url()).optional(),
    language: z.string().optional(),
  })
  .strict();
export type SendChatMessageRequest = z.infer<typeof SendChatMessageRequestSchema>;

/** One rolling-scorecard observation the chat agent recorded (learner-visible). */
export const AgentObservationViewSchema = z
  .object({
    dimensionId: z.string(),
    evidence: z.string(),
    provisionalScore: z.number().optional(),
  })
  .strict();
export type AgentObservationView = z.infer<typeof AgentObservationViewSchema>;

export const SendChatMessageResponseSchema = z
  .object({
    sessionId: z.string(),
    message: ChatMessageSchema,
    tokensUsed: z.number().int().optional(),
    // Chat-agent questions only (AI-EVALUATION-CORE-PLAN.md Phase 4):
    /** Rolling per-dimension scorecard accumulated so far (visible mid-conversation). */
    observations: z.array(AgentObservationViewSchema).optional(),
    /** True when this turn ended the conversation (agent tool or turn budget). */
    conversationEnded: z.boolean().optional(),
    /** Final evaluation over the transcript (present when grading succeeded). */
    evaluation: StoredEvaluationSchema.optional(),
  })
  .strict();
export type SendChatMessageResponse = z.infer<typeof SendChatMessageResponseSchema>;

export const sendChatMessageDef = defineCallable<SendChatMessageRequest, SendChatMessageResponse>({
  name: "v1.levelup.sendChatMessage",
  module: "levelup",
  requestSchema: SendChatMessageRequestSchema,
  responseSchema: SendChatMessageResponseSchema,
  authMode: "authed",
  rateTier: "ai",
  invalidates: ["chat"],
});
