/**
 * v1.levelup.sendChatMessage — AI tutor turn. Creates the session lazily when
 * `sessionId` is absent. Returns the concrete appended ChatMessage (not `unknown`).
 * ai tier; ✅ optimistic (user message append only).
 */
import { z } from "zod";
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

export const SendChatMessageResponseSchema = z
  .object({
    sessionId: z.string(),
    message: ChatMessageSchema,
    tokensUsed: z.number().int().optional(),
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
