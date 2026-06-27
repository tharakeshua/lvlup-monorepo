/**
 * v1.levelup.listChatSessions — paginated ChatSessionSummary list (no message body).
 */
import { z } from "zod";
import { defineCallable } from "./_shared.js";
import { withPaging, pageResponse } from "./_shared.js";

import { ChatSessionSummarySchema } from "./_shared.js";

export const ListChatSessionsRequestSchema = withPaging(
  z.object({ spaceId: z.string().optional(), itemId: z.string().optional() }).strict()
);
export type ListChatSessionsRequest = z.infer<typeof ListChatSessionsRequestSchema>;

export const ListChatSessionsResponseSchema = pageResponse(ChatSessionSummarySchema);
export type ListChatSessionsResponse = z.infer<typeof ListChatSessionsResponseSchema>;

export const listChatSessionsDef = defineCallable<
  ListChatSessionsRequest,
  ListChatSessionsResponse
>({
  name: "v1.levelup.listChatSessions",
  module: "levelup",
  requestSchema: ListChatSessionsRequestSchema,
  responseSchema: ListChatSessionsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
