/**
 * v1.levelup.saveRubricPreset — upsert a tenant RubricPreset. The rubric's
 * `modelAnswer`/`evaluatorGuidance` are ⚷ authoring-only → authoritySensitive.
 */
import { z } from "zod";
import { zRubricPresetCategory } from "@levelup/domain";
import { defineCallable } from "./_shared.js";
import { SaveOrDeleteResponseSchema, UnifiedRubricSchema, zQuestionType } from "./_shared.js";

export const SaveRubricPresetDataSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    rubric: UnifiedRubricSchema,
    category: zRubricPresetCategory,
    questionTypes: z.array(zQuestionType).optional(),
    isDefault: z.boolean().optional(),
    deleted: z.boolean().optional(),
  })
  .strict();

export const SaveRubricPresetRequestSchema = z
  .object({
    id: z.string().optional(),
    data: SaveRubricPresetDataSchema,
  })
  .strict();
export type SaveRubricPresetRequest = z.infer<typeof SaveRubricPresetRequestSchema>;

export const SaveRubricPresetResponseSchema = SaveOrDeleteResponseSchema;
export type SaveRubricPresetResponse = z.infer<typeof SaveRubricPresetResponseSchema>;

export const saveRubricPresetDef = defineCallable<
  SaveRubricPresetRequest,
  SaveRubricPresetResponse
>({
  name: "v1.levelup.saveRubricPreset",
  module: "levelup",
  requestSchema: SaveRubricPresetRequestSchema,
  responseSchema: SaveRubricPresetResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["rubricPresets"],
  authoritySensitive: true,
});
