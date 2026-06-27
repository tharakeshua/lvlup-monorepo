/**
 * v1.analytics.getLeaderboard — snapshot shaping over the RTDB leaderboard node.
 * scope: tenant | space | storyPoint. Returns ranked entries + the caller's own
 * entry (myEntry?). Plan: §2.6 L95.
 */
import { z } from "zod";
import { zObject, zSpaceId, zStoryPointId, LeaderboardEntrySchema } from "@levelup/domain";
import { defineCallable } from "../../callable-def.js";

export const LEADERBOARD_SCOPES = ["tenant", "space", "storyPoint"] as const;
export const zLeaderboardScope = z.enum(LEADERBOARD_SCOPES);
export type LeaderboardScope = (typeof LEADERBOARD_SCOPES)[number];

export const GetLeaderboardRequestSchema = zObject({
  scope: zLeaderboardScope,
  spaceId: zSpaceId.optional(),
  storyPointId: zStoryPointId.optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
export type GetLeaderboardRequest = z.infer<typeof GetLeaderboardRequestSchema>;

export const GetLeaderboardResponseSchema = zObject({
  entries: z.array(LeaderboardEntrySchema),
  myEntry: LeaderboardEntrySchema.optional(),
});
export type GetLeaderboardResponse = z.infer<typeof GetLeaderboardResponseSchema>;

export const getLeaderboard = defineCallable({
  name: "v1.analytics.getLeaderboard",
  module: "analytics",
  requestSchema: GetLeaderboardRequestSchema,
  responseSchema: GetLeaderboardResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
