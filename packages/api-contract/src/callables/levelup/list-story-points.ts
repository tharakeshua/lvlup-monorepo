/**
 * v1.levelup.listStoryPoints — all StoryPointViews for a space (ordered).
 */
import { z } from "zod";
import { defineCallable } from "./_shared.js";
import { StoryPointViewSchema } from "./_shared.js";

export const ListStoryPointsRequestSchema = z.object({ spaceId: z.string() }).strict();
export type ListStoryPointsRequest = z.infer<typeof ListStoryPointsRequestSchema>;

export const ListStoryPointsResponseSchema = z
  .object({ items: z.array(StoryPointViewSchema) })
  .strict();
export type ListStoryPointsResponse = z.infer<typeof ListStoryPointsResponseSchema>;

export const listStoryPointsDef = defineCallable<ListStoryPointsRequest, ListStoryPointsResponse>({
  name: "v1.levelup.listStoryPoints",
  module: "levelup",
  requestSchema: ListStoryPointsRequestSchema,
  responseSchema: ListStoryPointsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
