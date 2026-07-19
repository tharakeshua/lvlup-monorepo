/** v1.levelup.listConversations — cursor-paged session history, optionally exact-context scoped. */
import { z } from "zod";
import { defineCallable } from "./_shared.js";
import {
  ConversationSessionSummaryViewSchema,
  StartConversationContextSchema,
  zConversationMode,
  zConversationSessionStatus,
} from "./_conversation-shared.js";

export const ListConversationsRequestSchema = z
  .object({
    mode: zConversationMode.optional(),
    status: zConversationSessionStatus.optional(),
    context: StartConversationContextSchema.optional(),
    cursor: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  })
  .strict()
  .superRefine((request, ctx) => {
    if (
      request.mode !== undefined &&
      request.context !== undefined &&
      request.mode !== request.context.kind
    ) {
      ctx.addIssue({
        code: "custom",
        message: "mode must match context.kind when both are supplied",
        path: ["mode"],
      });
    }
  });
export type ListConversationsRequest = z.infer<typeof ListConversationsRequestSchema>;

export const ListConversationsResponseSchema = z
  .object({
    items: z.array(ConversationSessionSummaryViewSchema),
    nextCursor: z.string().nullable(),
  })
  .strict();
export type ListConversationsResponse = z.infer<typeof ListConversationsResponseSchema>;

export const listConversationsDef = defineCallable<
  ListConversationsRequest,
  ListConversationsResponse
>({
  name: "v1.levelup.listConversations",
  module: "levelup",
  requestSchema: ListConversationsRequestSchema,
  responseSchema: ListConversationsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
