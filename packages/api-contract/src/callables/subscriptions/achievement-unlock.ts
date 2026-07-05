/**
 * v1.levelup.achievementUnlock — live stream of freshly-unlocked achievements.
 *
 * RTDB projection node `achievementUnlocks/{t}/{uid}/latest` written by
 * awardAchievements via the AD-12 RTDB-projection pattern (U2.6 — the legacy
 * unprefixed Firestore `seen=false` query is retired; the node holds the LATEST
 * unlock event, last-write-wins, and is cleared on markAchievementsSeen).
 * `params: {}` — the subject is `auth.currentUser`. The payload is the domain
 * `StudentAchievement` (the unlock event, carrying a denormalized `achievement`
 * snapshot for display + the `seen` flag; no ⚷).
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
  source: "rtdb-node",
  params: AchievementUnlockParamsSchema,
  payload: AchievementUnlockSchema,
});
