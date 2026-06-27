/**
 * v1.levelup.leaderboardLive — live leaderboard snapshot (single canonical name).
 *
 * RTDB node written by the single-writer updateLeaderboardService. The
 * `analytics.leaderboard` subscription is DROPPED in favor of this name
 * (SDK-LAYERS-PLAN §3.3). `module: 'analytics'` — gamification leaderboard
 * derivation is folded into the analytics codebase (api-contract-core §2 fold).
 *
 * Payload `{ entries: LeaderboardEntry[], callerRank: number|null }` — no PII
 * beyond the projection policy already encoded in `LeaderboardEntry`.
 *
 * The `scope` tuple intentionally widens the domain `LEADERBOARD_SCOPES` with
 * `'class'` (per the frozen §7.2 params); it is NOT the domain enum.
 *
 * Plan: SDK-LAYERS-PLAN §3.3 (leaderboardLive row) / api-contract-core §7.2.
 */
import { z } from "zod";
import { zObject, LeaderboardEntrySchema } from "@levelup/domain";
import { defineSubscription } from "../../subscriptions/subscription-def.js";

/** `{ entries, callerRank }` — slim snapshot reconciled into the leaderboard cache. */
export const LeaderboardSnapshotSchema = zObject({
  entries: z.array(LeaderboardEntrySchema),
  callerRank: z.number().int().nullable(),
});
export type LeaderboardSnapshot = z.infer<typeof LeaderboardSnapshotSchema>;

export const LeaderboardLiveParamsSchema = zObject({
  scope: z.enum(["tenant", "class", "space", "storyPoint"]),
  spaceId: z.string().optional(),
  storyPointId: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});
export type LeaderboardLiveParams = z.infer<typeof LeaderboardLiveParamsSchema>;

export const leaderboardLive = defineSubscription({
  name: "v1.levelup.leaderboardLive",
  module: "analytics",
  source: "rtdb-node",
  params: LeaderboardLiveParamsSchema,
  payload: LeaderboardSnapshotSchema,
});
