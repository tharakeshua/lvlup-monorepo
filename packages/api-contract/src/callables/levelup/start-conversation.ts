/** v1.levelup.startConversation — create or resume a server-authoritative session. */
import { z } from "zod";
import { defineCallable } from "./_shared.js";
import {
  ConversationMessageViewSchema,
  ConversationSessionViewSchema,
  StartConversationContextSchema,
  zConversationMode,
} from "./_conversation-shared.js";

export const StartConversationRequestSchema = z
  .object({
    clientRequestId: z.string().uuid(),
    mode: zConversationMode,
    context: StartConversationContextSchema,
    locale: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((request, ctx) => {
    if (request.mode !== request.context.kind) {
      ctx.addIssue({
        code: "custom",
        message: "mode must match context.kind",
        path: ["mode"],
      });
    }
  });
export type StartConversationRequest = z.infer<typeof StartConversationRequestSchema>;

export const StartConversationResponseSchema = z
  .object({
    session: ConversationSessionViewSchema,
    messages: z.array(ConversationMessageViewSchema),
    resumed: z.boolean(),
  })
  .strict();
export type StartConversationResponse = z.infer<typeof StartConversationResponseSchema>;

export const startConversationDef = defineCallable<
  StartConversationRequest,
  StartConversationResponse
>({
  name: "v1.levelup.startConversation",
  module: "levelup",
  requestSchema: StartConversationRequestSchema,
  responseSchema: StartConversationResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  invalidates: ["conversations"],
});
