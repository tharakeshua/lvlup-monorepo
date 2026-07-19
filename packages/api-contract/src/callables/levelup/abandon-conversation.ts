/** v1.levelup.abandonConversation — abandon a resumable session without client-side state authority. */
import { z } from "zod";
import { zConversationSessionId } from "@levelup/domain";
import { defineCallable } from "./_shared.js";
import { ConversationSessionViewSchema } from "./_conversation-shared.js";

export const AbandonConversationRequestSchema = z
  .object({
    sessionId: zConversationSessionId,
    clientRequestId: z.string().uuid(),
  })
  .strict();
export type AbandonConversationRequest = z.infer<typeof AbandonConversationRequestSchema>;

export const AbandonConversationResponseSchema = z
  .object({
    session: ConversationSessionViewSchema,
    replayed: z.boolean(),
  })
  .strict();
export type AbandonConversationResponse = z.infer<typeof AbandonConversationResponseSchema>;

export const abandonConversationDef = defineCallable<
  AbandonConversationRequest,
  AbandonConversationResponse
>({
  name: "v1.levelup.abandonConversation",
  module: "levelup",
  requestSchema: AbandonConversationRequestSchema,
  responseSchema: AbandonConversationResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  invalidates: ["conversations"],
  authoritySensitive: true,
});
