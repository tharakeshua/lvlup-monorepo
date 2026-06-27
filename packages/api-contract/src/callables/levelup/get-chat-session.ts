/**
 * v1.levelup.getChatSession — full ChatSessionView with messages (systemPrompt ⚷).
 */
import { z } from "zod";
import { defineCallable } from "./_shared.js";
import { ChatSessionViewSchema } from "./_shared.js";

export const GetChatSessionRequestSchema = z.object({ sessionId: z.string() }).strict();
export type GetChatSessionRequest = z.infer<typeof GetChatSessionRequestSchema>;

export const GetChatSessionResponseSchema = z.object({ session: ChatSessionViewSchema }).strict();
export type GetChatSessionResponse = z.infer<typeof GetChatSessionResponseSchema>;

export const getChatSessionDef = defineCallable<GetChatSessionRequest, GetChatSessionResponse>({
  name: "v1.levelup.getChatSession",
  module: "levelup",
  requestSchema: GetChatSessionRequestSchema,
  responseSchema: GetChatSessionResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
