/**
 * v1.levelup.chatStream — chat-session bump signal (CHAT-1 / AD-12 addendum).
 *
 * RTDB bump node `chatBump/{t}/{uid}/{sessionId}` written by the chat write path
 * (`sendChatMessage` → `projectChatBump`): `{rev, lastMessageAt}` ONLY. Message
 * CONTENT never rides RTDB — each bump tells the client to (debounced) refetch
 * `getChatSession`, which stays the single authoritative read
 * (signal-over-RTDB, data-over-callable).
 *
 * Plan: DATA-MODEL-FIX-PLAN.md §10 AD-12 addendum / SDK-LAYERS-PLAN §3.3
 * (chatStream row) / api-contract-core §7.2.
 */
import { z } from "zod";
import { zObject } from "@levelup/domain";
import { defineSubscription } from "../../subscriptions/subscription-def.js";

export const ChatStreamParamsSchema = zObject({ sessionId: z.string() });
export type ChatStreamParams = z.infer<typeof ChatStreamParamsSchema>;

/** The minimal bump payload — a refetch signal, never chat content. */
export const ChatBumpSchema = zObject({
  /** Monotonic per-session revision (server-side atomic increment). */
  rev: z.number(),
  /** ISO timestamp of the message that triggered the bump. */
  lastMessageAt: z.string(),
});
export type ChatBump = z.infer<typeof ChatBumpSchema>;

export const chatStream = defineSubscription({
  name: "v1.levelup.chatStream",
  module: "levelup",
  source: "rtdb-node",
  params: ChatStreamParamsSchema,
  payload: ChatBumpSchema,
});
