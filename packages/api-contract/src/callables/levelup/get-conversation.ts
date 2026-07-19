/** v1.levelup.getConversation — paged learner-safe transcript and lifecycle projection. */
import { z } from "zod";
import { zConversationSessionId } from "@levelup/domain";
import { defineCallable } from "./_shared.js";
import {
  ConversationMessageViewSchema,
  ConversationSessionViewSchema,
  ConversationTurnViewSchema,
} from "./_conversation-shared.js";

export const GetConversationRequestSchema = z
  .object({
    sessionId: zConversationSessionId,
    messageCursor: z.string().min(1).optional(),
    messageLimit: z.number().int().min(1).max(100).optional(),
  })
  .strict();
export type GetConversationRequest = z.infer<typeof GetConversationRequestSchema>;

export const GetConversationResponseSchema = z
  .object({
    session: ConversationSessionViewSchema,
    messages: z.array(ConversationMessageViewSchema),
    nextMessageCursor: z.string().nullable(),
    activeTurn: ConversationTurnViewSchema.optional(),
  })
  .strict();
export type GetConversationResponse = z.infer<typeof GetConversationResponseSchema>;

export const getConversationDef = defineCallable<GetConversationRequest, GetConversationResponse>({
  name: "v1.levelup.getConversation",
  module: "levelup",
  requestSchema: GetConversationRequestSchema,
  responseSchema: GetConversationResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
