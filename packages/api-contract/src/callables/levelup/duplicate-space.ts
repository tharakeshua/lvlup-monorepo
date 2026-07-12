/**
 * v1.levelup.duplicateSpace — server-side deep copy of a Space with all its
 * StoryPoints and Items (including AnswerKeys). Returns the new draft Space id.
 * Teacher/tenantAdmin gated, write-rate-limited.
 */
import { z } from "zod";
import { defineCallable } from "./_shared.js";
import { SaveResponseSchema } from "./_shared.js";

export const DuplicateSpaceRequestSchema = z
  .object({
    spaceId: z.string().min(1),
  })
  .strict();
export type DuplicateSpaceRequest = z.infer<typeof DuplicateSpaceRequestSchema>;

export const DuplicateSpaceResponseSchema = SaveResponseSchema;
export type DuplicateSpaceResponse = z.infer<typeof DuplicateSpaceResponseSchema>;

export const duplicateSpaceDef = defineCallable<DuplicateSpaceRequest, DuplicateSpaceResponse>({
  name: "v1.levelup.duplicateSpace",
  module: "levelup",
  requestSchema: DuplicateSpaceRequestSchema,
  responseSchema: DuplicateSpaceResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["spaces"],
  authoritySensitive: false,
});
