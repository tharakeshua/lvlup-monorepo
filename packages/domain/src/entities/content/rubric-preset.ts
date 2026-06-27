/**
 * RubricPreset — no live schema (REVIEW §4 gap, ADD).
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import { zRubricPresetId, zTenantId } from "../../primitives/branded-id.zod.js";
import { zTimestamp } from "../../primitives/timestamp.zod.js";
import { zRubricPresetCategory, zQuestionType } from "../../enums/content.js";
import { UnifiedRubricSchema } from "./rubric.js";

export const RubricPresetSchema = zObject({
  id: zRubricPresetId,
  tenantId: zTenantId,
  name: z.string(),
  description: z.string().optional(),
  rubric: UnifiedRubricSchema,
  category: zRubricPresetCategory,
  questionTypes: z.array(zQuestionType).optional(),
  isDefault: z.boolean(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
export type RubricPreset = z.infer<typeof RubricPresetSchema>;
