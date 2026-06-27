/**
 * `v1.autograde.saveEvaluationSettings` — upsert tenant evaluation settings. The
 * server enforces the single-default invariant and that thresholds
 * (`confidenceConfig`) + dimension `promptGuidance` are writable by authoring roles
 * only (⚷). No `tenantId` (D2). Idempotent.
 */
import { z } from "zod";
import {
  zObject,
  zEvaluationSettingsId,
  EvaluationDimensionSchema,
  EvaluationDisplaySettingsSchema,
  EvaluationConfidenceConfigSchema,
  UsageQuotaConfigSchema,
} from "@levelup/domain";
import type { CallableDef } from "../../callable-def.js";
import { SaveEvaluationSettingsResponseSchema } from "./_shared.js";
import type { SaveEvaluationSettingsResponse } from "./_shared.js";

export const SaveEvaluationSettingsDataSchema = zObject({
  name: z.string().optional(),
  description: z.string().optional(),
  isDefault: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  enabledDimensions: z.array(EvaluationDimensionSchema).optional(),
  displaySettings: EvaluationDisplaySettingsSchema.optional(),
  confidenceConfig: EvaluationConfidenceConfigSchema.optional(),
  usageQuota: UsageQuotaConfigSchema.optional(),
});
export type SaveEvaluationSettingsData = z.infer<typeof SaveEvaluationSettingsDataSchema>;

export const SaveEvaluationSettingsRequestSchema = zObject({
  id: zEvaluationSettingsId.optional(),
  data: SaveEvaluationSettingsDataSchema,
});
export type SaveEvaluationSettingsRequest = z.infer<typeof SaveEvaluationSettingsRequestSchema>;

export const saveEvaluationSettingsDef = {
  name: "v1.autograde.saveEvaluationSettings",
  module: "autograde",
  requestSchema: SaveEvaluationSettingsRequestSchema,
  responseSchema: SaveEvaluationSettingsResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  // ⚷ confidence thresholds + promptGuidance are authoring-role-only secrets.
  authoritySensitive: true,
  invalidates: ["evaluationSettings"],
} as const satisfies CallableDef<SaveEvaluationSettingsRequest, SaveEvaluationSettingsResponse>;
