/**
 * v1.levelup.getStoryPoint — single StoryPointView (the test-landing gate needs one
 * SP's assessmentConfig without the whole list; web-student G1).
 */
import { z } from "zod";
import { defineCallable } from "./_shared.js";
import { StoryPointViewSchema } from "./_shared.js";

export const GetStoryPointRequestSchema = z
  .object({ spaceId: z.string(), storyPointId: z.string() })
  .strict();
export type GetStoryPointRequest = z.infer<typeof GetStoryPointRequestSchema>;

export const GetStoryPointResponseSchema = z.object({ storyPoint: StoryPointViewSchema }).strict();
export type GetStoryPointResponse = z.infer<typeof GetStoryPointResponseSchema>;

export const getStoryPointDef = defineCallable<GetStoryPointRequest, GetStoryPointResponse>({
  name: "v1.levelup.getStoryPoint",
  module: "levelup",
  requestSchema: GetStoryPointRequestSchema,
  responseSchema: GetStoryPointResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
