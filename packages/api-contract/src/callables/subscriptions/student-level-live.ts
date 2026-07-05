/**
 * v1.levelup.studentLevelLive — live level/XP for the calling student (self only).
 *
 * RTDB projection node `studentLevelLive/{t}/{uid}` written by awardAchievements
 * via the AD-12 RTDB-projection pattern (U2.6 — the legacy unprefixed Firestore
 * doc is retired). `params: {}` — the subject is `auth.currentUser` (resolved by
 * the transport `__uid__` placeholder), never a body field. Payload is the domain
 * `StudentLevel` (level / XP slim shape; carries no ⚷).
 *
 * Plan: SDK-LAYERS-PLAN §3.3 (studentLevelLive row) / api-contract-core §7.2.
 */
import type { z } from "zod";
import { zObject, StudentLevelSchema } from "@levelup/domain";
import { defineSubscription } from "../../subscriptions/subscription-def.js";

export const StudentLevelLiveParamsSchema = zObject({});
export type StudentLevelLiveParams = z.infer<typeof StudentLevelLiveParamsSchema>;

export const studentLevelLive = defineSubscription({
  name: "v1.levelup.studentLevelLive",
  module: "levelup",
  source: "rtdb-node",
  params: StudentLevelLiveParamsSchema,
  payload: StudentLevelSchema,
});
