/**
 * EvaluationSettings (+ display/confidence/quota embeds) and GradingDeadLetterEntry.
 * `confidenceConfig` thresholds + dimension `promptGuidance` are ⚷ authoring-only.
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import {
  zEvaluationSettingsId,
  zDeadLetterEntryId,
  zSubmissionId,
  zQuestionSubmissionId,
  zUserId,
} from "../../primitives/branded-id.zod.js";
import { zTimestamp } from "../../primitives/timestamp.zod.js";
import { EvaluationDimensionSchema } from "../content/rubric.js";

export const EvaluationDisplaySettingsSchema = zObject({
  showStrengths: z.boolean(),
  showKeyTakeaway: z.boolean(),
  prioritizeByImportance: z.boolean(),
});
export type EvaluationDisplaySettings = z.infer<typeof EvaluationDisplaySettingsSchema>;

export const EvaluationConfidenceConfigSchema = zObject({
  confidenceThreshold: z.number().default(0.7),
  autoApproveThreshold: z.number().default(0.9),
  requireReviewForPartialCredit: z.boolean(),
});
export type EvaluationConfidenceConfig = z.infer<typeof EvaluationConfidenceConfigSchema>;

export const UsageQuotaConfigSchema = zObject({
  monthlyBudgetUsd: z.number(),
  dailyCallLimit: z.number().int(),
  warningThresholdPercent: z.number().default(80),
});
export type UsageQuotaConfig = z.infer<typeof UsageQuotaConfigSchema>;

export const EvaluationSettingsSchema = zObject({
  id: zEvaluationSettingsId,
  name: z.string(),
  description: z.string().optional(),
  isDefault: z.boolean(),
  isPublic: z.boolean().optional(),
  enabledDimensions: z.array(EvaluationDimensionSchema),
  displaySettings: EvaluationDisplaySettingsSchema,
  confidenceConfig: EvaluationConfidenceConfigSchema.optional(),
  usageQuota: UsageQuotaConfigSchema.optional(),
  createdBy: zUserId.optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
export type EvaluationSettings = z.infer<typeof EvaluationSettingsSchema>;

export const GRADING_PIPELINE_STEPS = ["scouting", "grading"] as const;
export const DEAD_LETTER_RESOLUTION_METHODS = [
  "retry_success",
  "manual_grade",
  "dismissed",
] as const;

export const GradingDeadLetterEntrySchema = zObject({
  id: zDeadLetterEntryId,
  submissionId: zSubmissionId,
  questionSubmissionId: zQuestionSubmissionId.optional(),
  pipelineStep: z.enum(GRADING_PIPELINE_STEPS),
  error: z.string(),
  errorStack: z.string().optional(),
  attempts: z.number().int(),
  lastAttemptAt: zTimestamp,
  resolvedAt: zTimestamp.nullable(),
  resolvedBy: zUserId.optional(),
  resolutionMethod: z.enum(DEAD_LETTER_RESOLUTION_METHODS).optional(),
  createdAt: zTimestamp,
});
export type GradingDeadLetterEntry = z.infer<typeof GradingDeadLetterEntrySchema>;
