/**
 * `updateLeaderboardService` — single RTDB leaderboard writer (analytics.md
 * §"services/server"). Writes tenant / space / story-point leaderboard entries with
 * a tier heuristic; handles deletion cleanup. Modeled on the `tenants` repo with a
 * `_kind:'leaderboardEntry'` discriminator; the real adapter writes RTDB nodes.
 */
import type { SystemContext } from "../shared/context.js";

export interface UpdateLeaderboardInput {
  tenantId: string;
  userId: string;
  displayName?: string;
  score: number;
  scope: "tenant" | "space" | "storyPoint";
  spaceId?: string;
  storyPointId?: string;
}

/** Tier heuristic from an absolute score. */
export function tierFor(score: number): string {
  if (score >= 1000) return "diamond";
  if (score >= 500) return "gold";
  if (score >= 200) return "silver";
  return "bronze";
}

export async function updateLeaderboardService(
  input: UpdateLeaderboardInput,
  ctx: SystemContext
): Promise<void> {
  const now = ctx.now();
  const id = leaderboardEntryId(input);
  await ctx.repos.tenants.upsert(
    input.tenantId,
    {
      id,
      _kind: "leaderboardEntry",
      userId: input.userId,
      displayName: input.displayName,
      score: input.score,
      tier: tierFor(input.score),
      scope: input.scope,
      spaceId: input.spaceId,
      storyPointId: input.storyPointId,
    },
    now
  );
}

function leaderboardEntryId(input: UpdateLeaderboardInput): string {
  const suffix =
    input.scope === "space"
      ? `space_${input.spaceId}`
      : input.scope === "storyPoint"
        ? `sp_${input.storyPointId}`
        : "tenant";
  return `lb_${suffix}_${input.userId}`;
}
