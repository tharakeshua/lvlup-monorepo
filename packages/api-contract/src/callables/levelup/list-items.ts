/**
 * v1.levelup.listItems — paginated, ANSWER-STRIPPED ItemViews for a story point.
 * Answer-bearing payload fields are zeroed server-side (extracted to AnswerKey).
 */
import { z } from "zod";
import { defineCallable } from "./_shared.js";
import { withPaging, pageResponse } from "./_shared.js";

import { ItemViewSchema } from "./_shared.js";

export const ListItemsRequestSchema = withPaging(
  z.object({ spaceId: z.string(), storyPointId: z.string() }).strict()
);
export type ListItemsRequest = z.infer<typeof ListItemsRequestSchema>;

export const ListItemsResponseSchema = pageResponse(ItemViewSchema);
export type ListItemsResponse = z.infer<typeof ListItemsResponseSchema>;

export const listItemsDef = defineCallable<ListItemsRequest, ListItemsResponse>({
  name: "v1.levelup.listItems",
  module: "levelup",
  requestSchema: ListItemsRequestSchema,
  responseSchema: ListItemsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
