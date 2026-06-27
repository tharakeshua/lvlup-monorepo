/**
 * v1.levelup.achievementUnlock — live stream of freshly-unlocked achievements.
 *
 * Firestore-query over `.../students/{uid}/achievements?seen=false` written by
 * awardAchievements. `params: {}` — the subject is `auth.currentUser`. The payload
 * is the domain `StudentAchievement` (the unlock event, carrying a denormalized
 * `achievement` snapshot for display + the `seen` flag; no ⚷).
 *
 * Plan: SDK-LAYERS-PLAN §3.3 (achievementUnlock row) / api-contract-core §7.2.
 */
import type { z } from "zod";
import { zObject, StudentAchievementSchema } from "@levelup/domain";
import { defineSubscription } from "../../subscriptions/subscription-def.js";

/** The unlock-event payload is the domain `StudentAchievement` (no ⚷). */
export const AchievementUnlockSchema = StudentAchievementSchema;
export type AchievementUnlock = z.infer<typeof AchievementUnlockSchema>;

export const AchievementUnlockParamsSchema = zObject({});
export type AchievementUnlockParams = z.infer<typeof AchievementUnlockParamsSchema>;

export const achievementUnlock = defineSubscription({
  name: "v1.levelup.achievementUnlock",
  module: "levelup",
  source: "firestore-query",
  params: AchievementUnlockParamsSchema,
  payload: AchievementUnlockSchema,
});
