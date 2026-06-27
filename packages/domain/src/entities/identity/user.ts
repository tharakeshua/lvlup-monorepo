/**
 * UnifiedUser (+ ConsumerProfile, PurchaseRecord embeds). `authProviders` array
 * (drop singular `authProvider` — REVIEW D/§1). All B2C/consumer fields ⚷
 * server-only.
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import { zUserId, zTenantId, zSpaceId } from "../../primitives/branded-id.zod.js";
import { zTimestamp } from "../../primitives/timestamp.zod.js";
import { zMoney } from "../../primitives/money.zod.js";
import { zAuthProvider } from "../../enums/misc.js";
import { zConsumerPlan, zUserStatus } from "../../enums/tenant.js";

export const PurchaseRecordSchema = zObject({
  spaceId: zSpaceId,
  spaceTitle: z.string(),
  amount: zMoney,
  purchasedAt: zTimestamp,
  transactionId: z.string(),
});
export type PurchaseRecord = z.infer<typeof PurchaseRecordSchema>;

export const ConsumerProfileSchema = zObject({
  plan: zConsumerPlan,
  enrolledSpaceIds: z.array(zSpaceId).default([]),
  purchaseHistory: z.array(PurchaseRecordSchema).default([]),
  totalSpend: zMoney.optional(),
});
export type ConsumerProfile = z.infer<typeof ConsumerProfileSchema>;

export const UserPreferencesSchema = zObject({
  theme: z.string().optional(),
  language: z.string().optional(),
  notificationsEnabled: z.boolean().optional(),
});
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

export const UnifiedUserSchema = zObject({
  uid: zUserId,
  email: z.string().optional(),
  phone: z.string().optional(),
  authProviders: z.array(zAuthProvider).default([]),
  displayName: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  photoURL: z.string().optional(),
  country: z.string().optional(),
  age: z.number().int().optional(),
  grade: z.string().optional(),
  onboardingCompleted: z.boolean().optional(),
  preferences: UserPreferencesSchema.optional(),
  isSuperAdmin: z.boolean(),
  consumerProfile: ConsumerProfileSchema.optional(),
  activeTenantId: zTenantId.optional(),
  status: zUserStatus,
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
  lastLogin: zTimestamp.nullable(),
});
export type UnifiedUser = z.infer<typeof UnifiedUserSchema>;
