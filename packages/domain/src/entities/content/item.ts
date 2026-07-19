/**
 * UnifiedItem — the content item with a REAL two-level discriminated `payload`
 * union, a resolved-rubric snapshot + source rubricId, and an optional cross-domain
 * `linkedQuestionId: ExamQuestionId`.
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import {
  zItemId,
  zSpaceId,
  zStoryPointId,
  zSectionId,
  zTenantId,
  zRubricPresetId,
  zExamQuestionId,
  zUserId,
} from "../../primitives/branded-id.zod.js";
import { zTimestamp } from "../../primitives/timestamp.zod.js";
import { zItemType, zItemAttachmentType } from "../../enums/content.js";
import { zDifficulty } from "../../enums/grading.js";
import { ItemPayloadSchema } from "./item-payload.js";
import { ItemMetadataSchema, ItemAnalyticsSchema } from "./item-metadata.js";
import { UnifiedRubricSchema } from "./rubric.js";

export const ItemAttachmentSchema = zObject({
  id: z.string().optional(),
  type: zItemAttachmentType,
  url: z.string().min(1),
  name: z.string().optional(),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
});
export type ItemAttachment = z.infer<typeof ItemAttachmentSchema>;

export const UnifiedItemSchema = zObject({
  id: zItemId,
  spaceId: zSpaceId,
  storyPointId: zStoryPointId,
  sectionId: zSectionId.optional(),
  tenantId: zTenantId,
  type: zItemType,
  payload: ItemPayloadSchema,
  title: z.string().optional(),
  content: z.string().optional(),
  difficulty: zDifficulty.optional(),
  topics: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
  orderIndex: z.number().int(),
  meta: ItemMetadataSchema.optional(),
  analytics: ItemAnalyticsSchema.optional(),
  // Resolved snapshot + source ref (REVIEW open-Q resolution).
  rubric: UnifiedRubricSchema.optional(),
  rubricId: zRubricPresetId.optional(),
  linkedQuestionId: zExamQuestionId.optional(),
  attachments: z.array(ItemAttachmentSchema).optional(),
  version: z.number().int().optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
  archivedAt: zTimestamp.nullable(),
});
export type UnifiedItem = z.infer<typeof UnifiedItemSchema>;
