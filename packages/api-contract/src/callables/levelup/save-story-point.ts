/**
 * v1.levelup.saveStoryPoint — upsert a StoryPoint under a Space.
 */
import { z } from "zod";
import {
  AssessmentConfigSchema,
  StoryPointSectionSchema,
  zStoryPointType,
  zDifficulty,
} from "@levelup/domain";
import { defineCallable } from "./_shared.js";
import { SaveOrDeleteResponseSchema } from "./_shared.js";

export const SaveStoryPointDataSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().optional(),
    orderIndex: z.number().int().optional(),
    type: zStoryPointType,
    sections: z.array(StoryPointSectionSchema).optional(),
    assessmentConfig: AssessmentConfigSchema.optional(),
    defaultRubricId: z.string().optional(),
    difficulty: zDifficulty.optional(),
    estimatedTimeMinutes: z.number().int().optional(),
    deleted: z.boolean().optional(),
  })
  .strict();

export const SaveStoryPointRequestSchema = z
  .object({
    id: z.string().optional(),
    spaceId: z.string(),
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
