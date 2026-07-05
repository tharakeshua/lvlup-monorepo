/**
 * v1.levelup.spaceProgressLive — live slim mirror of a student's space progress.
 *
 * RTDB projection node `spaceProgressLive/{t}/{userId}/{spaceId}` written by the
 * progressUpdater via the AD-12 RTDB-projection pattern (U2.6 — the legacy
 * unprefixed Firestore live doc is retired). SLIM mirror: bounded per-story-point
 * numerics only — no per-item answers, no stored evaluations, no answer-key.
 * Reconciled into the `progress.detail` cache.
 *
 * `params` carry `{spaceId, userId}`; `userId` is the projection subject
 * (== auth uid, AD-9) the RTDB rules gate on the path segment — it is NOT a
 * tenant id, so the no-tenantId rule holds.
 *
 * Plan: SDK-LAYERS-PLAN §3.3 (spaceProgressLive row) / api-contract-core §7.2.
 */
import { z } from "zod";
import { zObject, zProgressStatus } from "@levelup/domain";
import { defineSubscription } from "../../subscriptions/subscription-def.js";

/**
 * Per-story-point bounded numeric slice (no item-level detail, no ⚷).
 * Item COUNTS are deliberately absent: the single progress writer's rollup is
 * score-derived; item-count detail belongs to the callable read path.
 */
export const StoryPointProgressLiveSchema = zObject({
  storyPointId: z.string(),
  status: zProgressStatus,
  pointsEarned: z.number(),
  totalPoints: z.number(),
  percentage: z.number(),
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
  // RTDB drops empty objects at rest — an entry-less rollup arrives keyless.
  storyPoints: z.record(z.string(), StoryPointProgressLiveSchema).default({}),
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
  source: "rtdb-node",
  params: SpaceProgressLiveParamsSchema,
  payload: SpaceProgressLiveSchema,
});
