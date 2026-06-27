/**
 * SpaceReview, StoreSpaceListing (B2C projection), PurchaseRecord (levelup write).
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import {
  zSpaceReviewId,
  zSpaceId,
  zTenantId,
  zUserId,
  zPurchaseId,
} from "../../primitives/branded-id.zod.js";
import { zTimestamp } from "../../primitives/timestamp.zod.js";
import { zMoney } from "../../primitives/money.zod.js";
import { zSpaceAccessType } from "../../enums/space.js";
import { zPurchaseStatus } from "../../enums/content.js";
import { SpaceRatingAggregateSchema } from "./space.js";

export const SpaceReviewSchema = zObject({
  id: zSpaceReviewId,
  spaceId: zSpaceId,
  tenantId: zTenantId,
  userId: zUserId,
  userName: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
});
export type SpaceReview = z.infer<typeof SpaceReviewSchema>;

export const StoreSpaceListingSchema = zObject({
  id: zSpaceId,
  sourceTenantId: zTenantId,
  title: z.string(),
  price: zMoney,
  accessType: zSpaceAccessType,
  storeDescription: z.string().optional(),
  storeThumbnailUrl: z.string().optional(),
  ratingAggregate: SpaceRatingAggregateSchema.optional(),
});
export type StoreSpaceListing = z.infer<typeof StoreSpaceListingSchema>;

export const SpacePurchaseRecordSchema = zObject({
  id: zPurchaseId,
  userId: zUserId,
  spaceId: zSpaceId,
  sourceTenantId: zTenantId,
  amount: zMoney,
  transactionId: z.string(),
  gateway: z.string(),
  status: zPurchaseStatus,
  purchasedAt: zTimestamp,
});
export type SpacePurchaseRecord = z.infer<typeof SpacePurchaseRecordSchema>;
