/**
 * v1.levelup.saveStoryPoint — upsert a StoryPoint under a Space.
 */
import { z } from "zod";
import { StoryPointSchema } from "@levelup/domain";
import { defineCallable } from "./_shared.js";
import { SaveOrDeleteResponseSchema } from "./_shared.js";

/**
 * Partial by design: one callable owns create, edit, reorder, and soft-delete.
 * The service requires title/type for create. Inline defaultRubric is persisted as
 * the resolved snapshot alongside the optional preset provenance id.
 */
export const SaveStoryPointDataSchema = StoryPointSchema.pick({
  title: true,
  description: true,
  orderIndex: true,
  type: true,
  sections: true,
  assessmentConfig: true,
  defaultRubric: true,
  defaultRubricId: true,
  difficulty: true,
  estimatedTimeMinutes: true,
})
  .partial()
  .extend({
    deleted: z.boolean().optional(),
  })
  .strict();

export const SaveStoryPointRequestSchema = z
  .object({
    id: StoryPointSchema.shape.id.optional(),
    spaceId: StoryPointSchema.shape.spaceId,
    data: SaveStoryPointDataSchema,
  })
  .strict();
export type SaveStoryPointRequest = z.infer<typeof SaveStoryPointRequestSchema>;

export const SaveStoryPointResponseSchema = SaveOrDeleteResponseSchema;
export type SaveStoryPointResponse = z.infer<typeof SaveStoryPointResponseSchema>;

export const saveStoryPointDef = defineCallable<SaveStoryPointRequest, SaveStoryPointResponse>({
  name: "v1.levelup.saveStoryPoint",
  module: "levelup",
  requestSchema: SaveStoryPointRequestSchema,
  responseSchema: SaveStoryPointResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["storyPoints", "spaces"],
  authoritySensitive: true,
});
