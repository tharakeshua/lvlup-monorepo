/**
 * StoryPoint (+ StoryPointSection, AssessmentConfig embeds). StoryPointType collapsed
 * to standard|timed_test|quiz|practice — synonym `test` dropped (be-levelup §4.2).
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import {
  zStoryPointId,
  zSpaceId,
  zTenantId,
  zSectionId,
  zUserId,
  zRubricPresetId,
} from "../../primitives/branded-id.zod.js";
import { zTimestamp } from "../../primitives/timestamp.zod.js";
import { zStoryPointType } from "../../enums/content.js";
import { zDifficulty } from "../../enums/grading.js";
import { UnifiedRubricSchema } from "../content/rubric.js";

export const StoryPointSectionSchema = zObject({
  id: zSectionId,
  title: z.string(),
  description: z.string().optional(),
  orderIndex: z.number().int(),
});
export type StoryPointSection = z.infer<typeof StoryPointSectionSchema>;

export const AssessmentScheduleSchema = zObject({
  opensAt: zTimestamp.nullable(),
  closesAt: zTimestamp.nullable(),
}).refine(({ opensAt, closesAt }) => opensAt === null || closesAt === null || opensAt < closesAt, {
  message: "closesAt must be later than opensAt",
  path: ["closesAt"],
});
export type AssessmentSchedule = z.infer<typeof AssessmentScheduleSchema>;

export const RetryConfigSchema = zObject({
  cooldownMinutes: z.number().int().nonnegative().optional(),
  lockAfterPassing: z.boolean().optional(),
});
export type RetryConfig = z.infer<typeof RetryConfigSchema>;

export const AdaptiveConfigSchema = zObject({
  enabled: z.boolean(),
  startingDifficulty: zDifficulty.optional(),
  stepUpThreshold: z.number().int().positive().optional(),
  stepDownThreshold: z.number().int().positive().optional(),
});
export type AdaptiveConfig = z.infer<typeof AdaptiveConfigSchema>;

export const AssessmentConfigSchema = zObject({
  durationMinutes: z.number().int().positive().optional(),
  maxAttempts: z.number().int().positive().optional(),
  shuffle: z.boolean().optional(),
  passingPercentage: z.number().min(0).max(100).optional(),
  adaptiveConfig: AdaptiveConfigSchema.optional(),
  schedule: AssessmentScheduleSchema.optional(),
  retryConfig: RetryConfigSchema.optional(),
});
export type AssessmentConfig = z.infer<typeof AssessmentConfigSchema>;

export const StoryPointStatsSchema = zObject({
  itemCount: z.number().int().nonnegative().default(0),
  completionCount: z.number().int().nonnegative().default(0),
});
export type StoryPointStats = z.infer<typeof StoryPointStatsSchema>;

export const StoryPointSchema = zObject({
  id: zStoryPointId,
  spaceId: zSpaceId,
  tenantId: zTenantId,
  title: z.string(),
  description: z.string().optional(),
  orderIndex: z.number().int(),
  type: zStoryPointType,
  sections: z.array(StoryPointSectionSchema).default([]),
  assessmentConfig: AssessmentConfigSchema.optional(),
  defaultRubric: UnifiedRubricSchema.optional(),
  defaultRubricId: zRubricPresetId.optional(),
  difficulty: zDifficulty.optional(),
  estimatedTimeMinutes: z.number().int().nonnegative().optional(),
  stats: StoryPointStatsSchema.optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
  archivedAt: zTimestamp.nullable(),
});
export type StoryPoint = z.infer<typeof StoryPointSchema>;

/** Product term — user-facing "Module"; storage/API fields remain `storyPoint*`. */
export type Module = StoryPoint;
export type ModuleSection = StoryPointSection;
export type ModuleStats = StoryPointStats;
