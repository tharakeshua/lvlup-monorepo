/**
 * v1.levelup.spaceProgressLive — live slim mirror of a student's space progress.
 *
 * Projection doc `.../spaceProgress/{userId}_{spaceId}/live` written by the
 * progressUpdater (which verifies `userId ∈ ctx.studentIds` / self at write time).
 * SLIM mirror: bounded per-story-point numerics only — no per-item answers, no
 * stored evaluations, no answer-key. Reconciled into the `progress.detail` cache.
 *
 * `params` carry `{spaceId, userId}`; `userId` is the projection subject the
 * server access-checks — it is NOT a tenant id, so the no-tenantId rule holds.
 *
 * Plan: SDK-LAYERS-PLAN §3.3 (spaceProgressLive row) / api-contract-core §7.2.
 */
import { z } from "zod";
import { zObject, zProgressStatus } from "@levelup/domain";
import { defineSubscription } from "../../subscriptions/subscription-def.js";

/** Per-story-point bounded numeric slice (no item-level detail, no ⚷). */
export const StoryPointProgressLiveSchema = zObject({
  storyPointId: z.string(),
  status: zProgressStatus,
  pointsEarned: z.number(),
  totalPoints: z.number(),
  percentage: z.number(),
  completedItems: z.number().int(),
  totalItems: z.number().int(),
});
export type StoryPointProgressLive = z.infer<typeof StoryPointProgressLiveSchema>;

/** `SpaceProgressLive` slim mirror — bounded per-story-point numerics. */
export const SpaceProgressLiveSchema = zObject({
  spaceId: z.string(),
  userId: z.string(),
  status: zProgressStatus,
  pointsEarned: z.number(),
  totalPoints: z.number(),
  percentage: z.number(),
  storyPoints: z.record(z.string(), StoryPointProgressLiveSchema),
  updatedAt: z.string(),
});
export type SpaceProgressLive = z.infer<typeof SpaceProgressLiveSchema>;

export const SpaceProgressLiveParamsSchema = zObject({
  spaceId: z.string(),
  userId: z.string(),
});
export type SpaceProgressLiveParams = z.infer<typeof SpaceProgressLiveParamsSchema>;

export const spaceProgressLive = defineSubscription({
  name: "v1.levelup.spaceProgressLive",
  module: "levelup",
  source: "firestore-doc",
  params: SpaceProgressLiveParamsSchema,
  payload: SpaceProgressLiveSchema,
});
