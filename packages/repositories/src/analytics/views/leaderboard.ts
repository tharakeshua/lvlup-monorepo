/**
 * `leaderboardRepo` — VIEW repo, realtime-backed (SDK-LAYERS-PLAN §4.1,
 * analytics.md §leaderboardRepo). Under `src/analytics/views/**` (R6 exception).
 *
 * The leaderboard is an RTDB read-model (⚷ — single-writer `updateLeaderboard`
 * service). This repo:
 *   • `get({scope,...})` → ONE `v1.analytics.getLeaderboard` snapshot read
 *     (entries + the caller's `myEntry`).
 *   • `subscribe({scope,...}, cb)` → the realtime seam (`v1.analytics.leaderboard`
 *     RTDB live node) via the injected `api.subscribe` pass-through; returns an
 *     unsubscribe handle.
 *   • `computeRankWithTier(entries)` → derives the tier band + rank gaps once.
 *
 * Composes only `api` (never sibling repos) — declared view repo.
 */
import type { LeaderboardEntry } from "@levelup/domain";
import type {
  ApiClient,
  GetLeaderboardRequest,
  GetLeaderboardResponse,
  LeaderboardScope,
  SubscriptionHandle,
} from "../api-types.js";

/** A ranked entry enriched with the gap to the entry above (derived). */
export interface RankedEntry {
  entry: LeaderboardEntry;
  rank: number;
  gapToAbove: number;
}

/** Realtime subscription params (mirrors `v1.analytics.leaderboard`). */
export interface LeaderboardSubParams {
  scope: LeaderboardScope;
  spaceId?: string;
  storyPointId?: string;
}

export interface LeaderboardRepo {
  get(filter: GetLeaderboardRequest): Promise<GetLeaderboardResponse>;
  /**
   * Realtime seam — subscribe to the RTDB leaderboard live node, returning an
   * unsubscribe handle. Named `getLive` (the `get*` verb) to satisfy the
   * build-time method-naming convention while the contract subscription is
   * `v1.analytics.leaderboard`; the query/realtime layer wraps this in
   * `useLeaderboardLive`.
   */
  getLive(
    params: LeaderboardSubParams,
    cb: (payload: GetLeaderboardResponse) => void
  ): SubscriptionHandle;
  /** Derive tier band + rank gaps once (derived, no wire call). */
  computeRankWithTier(entries: readonly LeaderboardEntry[]): RankedEntry[];
}

export function createLeaderboardRepo(api: ApiClient): LeaderboardRepo {
  return {
    get: (filter) => api.analytics.getLeaderboard(filter),

    getLive: (params, cb) => {
      if (!api.subscribe) {
        // No realtime transport wired — return a no-op handle (offline/SSR safe).
        return { unsubscribe: () => undefined, id: "noop", active: false };
      }
      return api.subscribe(
        "v1.analytics.leaderboard",
        params as unknown as Record<string, unknown>,
        (payload) => cb(payload as GetLeaderboardResponse)
      );
    },

    computeRankWithTier: (entries) => {
      // Server provides `rank`; order defensively by it, then derive the gap.
      const sorted = [...entries].sort((a, b) => a.rank - b.rank);
      return sorted.map((entry, i) => ({
        entry,
        rank: entry.rank,
        gapToAbove: i === 0 ? 0 : sorted[i - 1]!.score - entry.score,
      }));
    },
  };
}
