/**
 * v1.levelup.getSpaceProgress — aggregate + storyPoint summaries for a learner.
 * `userId` honored only for teacher/parent reading another learner (server gates).
 */
import { z } from "zod";
import { defineCallable } from "./_shared.js";
import { SpaceProgressViewSchema } from "./_shared.js";

export const GetSpaceProgressRequestSchema = z
  .object({ spaceId: z.string(), userId: z.string().optional() })
  .strict();
export type GetSpaceProgressRequest = z.infer<typeof GetSpaceProgressRequestSchema>;

export const GetSpaceProgressResponseSchema = z
  .object({ progress: SpaceProgressViewSchema.nullable() })
  .strict();
export type GetSpaceProgressResponse = z.infer<typeof GetSpaceProgressResponseSchema>;

export const getSpaceProgressDef = defineCallable<
  GetSpaceProgressRequest,
  GetSpaceProgressResponse
>({
  name: "v1.levelup.getSpaceProgress",
  module: "levelup",
  requestSchema: GetSpaceProgressRequestSchema,
  responseSchema: GetSpaceProgressResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
