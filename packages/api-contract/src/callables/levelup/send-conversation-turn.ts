/** v1.levelup.sendConversationTurn — claim, persist, and execute one learner turn. */
import { z } from "zod";
import { zConversationSessionId } from "@levelup/domain";
import { defineCallable } from "./_shared.js";
import {
  ConversationMediaInputSchema,
  ConversationMessageViewSchema,
  ConversationSessionViewSchema,
  ConversationTurnViewSchema,
  QuestionHelpDraftSnapshotSchema,
} from "./_conversation-shared.js";

export const SendConversationTurnInputSchema = z
  .object({
    text: z.string().min(1),
    media: z.array(ConversationMediaInputSchema).optional(),
    questionHelpDraft: QuestionHelpDraftSnapshotSchema.optional(),
  })
  .strict();
export type SendConversationTurnInput = z.infer<typeof SendConversationTurnInputSchema>;

export const SendConversationTurnRequestSchema = z
  .object({
    sessionId: zConversationSessionId,
    clientMessageId: z.string().uuid(),
    input: SendConversationTurnInputSchema,
  })
  .strict();
export type SendConversationTurnRequest = z.infer<typeof SendConversationTurnRequestSchema>;

export const SendConversationTurnResponseSchema = z
  .object({
    session: ConversationSessionViewSchema,
    acceptedMessage: ConversationMessageViewSchema,
    assistantMessages: z.array(ConversationMessageViewSchema),
    turn: ConversationTurnViewSchema,
    replayed: z.boolean(),
  })
  .strict();
export type SendConversationTurnResponse = z.infer<typeof SendConversationTurnResponseSchema>;

export const sendConversationTurnDef = defineCallable<
  SendConversationTurnRequest,
  SendConversationTurnResponse
>({
  name: "v1.levelup.sendConversationTurn",
  module: "levelup",
  requestSchema: SendConversationTurnRequestSchema,
  responseSchema: SendConversationTurnResponseSchema,
  authMode: "authed",
  rateTier: "ai",
  idempotent: true,
  idempotencyKey: "transport",
  invalidates: ["conversations"],
});
