/**
 * ContentVersion — change-log entry for space/storyPoint/item.
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import { zContentVersionId, zUserId } from "../../primitives/branded-id.zod.js";
import { zTimestamp } from "../../primitives/timestamp.zod.js";
import { zContentVersionEntityType, zContentChangeType } from "../../enums/content.js";

export const ContentVersionSchema = zObject({
  id: zContentVersionId,
  version: z.number().int(),
  entityType: zContentVersionEntityType,
  entityId: z.string(),
  changeType: zContentChangeType,
  changeSummary: z.string(),
  changedBy: zUserId,
  changedAt: zTimestamp,
});
export type ContentVersion = z.infer<typeof ContentVersionSchema>;
