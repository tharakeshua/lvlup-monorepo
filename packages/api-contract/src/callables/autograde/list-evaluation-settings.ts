/**
 * `v1.autograde.listEvaluationSettings` — tenant evaluation settings. Thresholds
 * (`confidenceConfig`) + dimension `promptGuidance` are visible to authoring roles
 * only (⚷ projection). `includePublic` opts in shared public presets. No `tenantId`
 * (D2). Read tier.
 */
import { z } from "zod";
import { zObject } from "@levelup/domain";
import type { CallableDef } from "../../callable-def.js";
import { EvaluationSettingsViewSchema } from "./_shared.js";

export const ListEvaluationSettingsRequestSchema = zObject({
  includePublic: z.boolean().optional(),
});
export type ListEvaluationSettingsRequest = z.infer<typeof ListEvaluationSettingsRequestSchema>;

export const ListEvaluationSettingsResponseSchema = zObject({
  settings: z.array(EvaluationSettingsViewSchema),
});
export type ListEvaluationSettingsResponse = z.infer<typeof ListEvaluationSettingsResponseSchema>;

export const listEvaluationSettingsDef = {
  name: "v1.autograde.listEvaluationSettings",
  module: "autograde",
  requestSchema: ListEvaluationSettingsRequestSchema,
  responseSchema: ListEvaluationSettingsResponseSchema,
  authMode: "authed",
  rateTier: "read",
} as const satisfies CallableDef<ListEvaluationSettingsRequest, ListEvaluationSettingsResponse>;
