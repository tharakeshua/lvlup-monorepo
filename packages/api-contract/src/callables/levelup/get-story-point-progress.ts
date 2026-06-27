/**
 * v1.levelup.getStoryPointProgress — per-item progress detail (lastEvaluation/
 * attempts projected by released/own-data policy server-side).
 */
import { z } from "zod";
import { defineCallable } from "./_shared.js";
import { StoryPointProgressDocViewSchema } from "./_shared.js";

export const GetStoryPointProgressRequestSchema = z
  .object({ spaceId: z.string(), storyPointId: z.string(), userId: z.string().optional() })
  .strict();
export type GetStoryPointProgressRequest = z.infer<typeof GetStoryPointProgressRequestSchema>;

export const GetStoryPointProgressResponseSchema = z
  .object({ progress: StoryPointProgressDocViewSchema.nullable() })
  .strict();
export type GetStoryPointProgressResponse = z.infer<typeof GetStoryPointProgressResponseSchema>;

export const getStoryPointProgressDef = defineCallable<
  GetStoryPointProgressRequest,
  GetStoryPointProgressResponse
>({
  name: "v1.levelup.getStoryPointProgress",
  module: "levelup",
  requestSchema: GetStoryPointProgressRequestSchema,
  responseSchema: GetStoryPointProgressResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
