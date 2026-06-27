/**
 * v1.levelup.chatStream — live append-only stream of chat messages.
 *
 * Firestore-query over the always-subcollection `.../chatSessions/{id}/messages`
 * written by sendChatMessage. The payload is the domain `ChatMessage` (carries no
 * ⚷ fields — `systemPrompt`/`messageCount` live on the parent ChatSession, never
 * on a message).
 *
 * Plan: SDK-LAYERS-PLAN §3.3 (chatStream row) / api-contract-core §7.2.
 */
import { z } from "zod";
import { zObject, ChatMessageSchema } from "@levelup/domain";
import { defineSubscription } from "../../subscriptions/subscription-def.js";

export const ChatStreamParamsSchema = zObject({ sessionId: z.string() });
export type ChatStreamParams = z.infer<typeof ChatStreamParamsSchema>;

export const chatStream = defineSubscription({
  name: "v1.levelup.chatStream",
  module: "levelup",
  source: "firestore-query",
  params: ChatStreamParamsSchema,
  payload: ChatMessageSchema,
});
