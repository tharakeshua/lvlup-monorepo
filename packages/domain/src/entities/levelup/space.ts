/**
 * Space — learning space. Single `archivedAt` soft-delete (REVIEW D5). Stores both
 * `defaultRubric` snapshot + `defaultRubricId` source ref. `stats`/`ratingAggregate`
 * are ⚷ denormalized.
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import {
  zSpaceId,
  zTenantId,
  zClassId,
  zSectionId,
  zUserId,
  zTeacherId,
  zAgentId,
  zEvaluationSettingsId,
  zRubricPresetId,
  zAcademicSessionId,
} from "../../primitives/branded-id.zod.js";
import { zTimestamp } from "../../primitives/timestamp.zod.js";
import { zMoney } from "../../primitives/money.zod.js";
import { zSpaceStatus, zSpaceType, zSpaceAccessType } from "../../enums/space.js";
import { UnifiedRubricSchema } from "../content/rubric.js";

export const SpaceStatsSchema = zObject({
  storyPointCount: z.number().int().nonnegative().default(0),
  itemCount: z.number().int().nonnegative().default(0),
  enrolledCount: z.number().int().nonnegative().default(0),
  completionCount: z.number().int().nonnegative().default(0),
});
export type SpaceStats = z.infer<typeof SpaceStatsSchema>;

export const SpaceRatingAggregateSchema = zObject({
  averageRating: z.number().min(0).max(5),
  totalReviews: z.number().int().nonnegative(),
  distribution: z.record(z.string(), z.number().int().nonnegative()),
});
export type SpaceRatingAggregate = z.infer<typeof SpaceRatingAggregateSchema>;

export const SpaceSchema = zObject({
  id: zSpaceId,
  tenantId: zTenantId,
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  slug: z.string().optional(),
  type: zSpaceType,
  subject: z.string().optional(),
  labels: z.array(z.string()).optional(),
  classIds: z.array(zClassId).default([]),
  sectionIds: z.array(zSectionId).optional(),
  teacherIds: z.array(zTeacherId).default([]),
  accessType: zSpaceAccessType,
  academicSessionId: zAcademicSessionId.optional(),
  defaultEvaluatorAgentId: zAgentId.optional(),
  defaultTutorAgentId: zAgentId.optional(),
  defaultRubric: UnifiedRubricSchema.optional(),
  defaultRubricId: zRubricPresetId.optional(),
  // Space-level evaluation-settings ref (AI-EVALUATION-CORE-PLAN.md D3):
  // shared tenant pool; resolution space → tenant default.
  evaluationSettingsId: zEvaluationSettingsId.optional(),
  // assessment defaults (space-level, applied to timed_test/quiz story points)
  allowRetakes: z.boolean().optional(),
  maxRetakes: z.number().int().nonnegative().optional(),
  defaultTimeLimitMinutes: z.number().int().nonnegative().optional(),
  showCorrectAnswers: z.boolean().optional(),
  // store fields
  price: zMoney.optional(),
  publishedToStore: z.boolean().optional(),
  storeDescription: z.string().optional(),
  storeThumbnailUrl: z.string().optional(),
  // lifecycle
  status: zSpaceStatus,
  publishedAt: zTimestamp.nullable(),
  // ⚷ denormalized
  stats: SpaceStatsSchema.optional(),
  ratingAggregate: SpaceRatingAggregateSchema.optional(),
  version: z.number().int().optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
  archivedAt: zTimestamp.nullable(),
});
export type Space = z.infer<typeof SpaceSchema>;
