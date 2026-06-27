/**
 * v1.levelup.getSpace — single SpaceView (rubric snapshot only; evaluatorGuidance/
 * modelAnswer projected out for non-authoring roles server-side).
 */
import { z } from "zod";
import { defineCallable } from "./_shared.js";
import { SpaceViewSchema } from "./_shared.js";

export const GetSpaceRequestSchema = z.object({ spaceId: z.string() }).strict();
export type GetSpaceRequest = z.infer<typeof GetSpaceRequestSchema>;

export const GetSpaceResponseSchema = z.object({ space: SpaceViewSchema }).strict();
export type GetSpaceResponse = z.infer<typeof GetSpaceResponseSchema>;

export const getSpaceDef = defineCallable<GetSpaceRequest, GetSpaceResponse>({
  name: "v1.levelup.getSpace",
  module: "levelup",
  requestSchema: GetSpaceRequestSchema,
  responseSchema: GetSpaceResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
