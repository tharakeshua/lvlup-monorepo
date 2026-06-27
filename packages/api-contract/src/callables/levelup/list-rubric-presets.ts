/**
 * v1.levelup.listRubricPresets — tenant rubric presets, optionally filtered.
 */
import { z } from "zod";
import { zRubricPresetCategory } from "@levelup/domain";
import { defineCallable } from "./_shared.js";
import { RubricPresetSchema, zQuestionType } from "./_shared.js";

export const ListRubricPresetsRequestSchema = z
  .object({
    category: zRubricPresetCategory.optional(),
    questionType: zQuestionType.optional(),
  })
  .strict();
export type ListRubricPresetsRequest = z.infer<typeof ListRubricPresetsRequestSchema>;

export const ListRubricPresetsResponseSchema = z
  .object({ items: z.array(RubricPresetSchema) })
  .strict();
export type ListRubricPresetsResponse = z.infer<typeof ListRubricPresetsResponseSchema>;

export const listRubricPresetsDef = defineCallable<
  ListRubricPresetsRequest,
  ListRubricPresetsResponse
>({
  name: "v1.levelup.listRubricPresets",
  module: "levelup",
  requestSchema: ListRubricPresetsRequestSchema,
  responseSchema: ListRubricPresetsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
