/**
 * `leaderboardRepo` — cross-entity VIEW repo (SDK-LAYERS-PLAN §4.1,
 * gamification.md §Repositories — "marked VIEW").
 *
 * Leaderboards are server-authoritative projections (RTDB nodes written by
 * progress triggers; client never writes — §6.9). The board is served two ways:
 * a REST first-paint snapshot (`getLeaderboard`) and a live RTDB subscription
 * (`leaderboardLive`). This view repo collapses both into one coherent list:
 *
 *   • `getPage(scope, opts)` → paginate `getLeaderboard`, ALWAYS exposing the
 *     caller's own row (`callerEntry`) even when it's off the visible page.
 *   • `assignRanks(entries, startOffset)` — dense rank across pages (1-based;
 *     ties share a rank, next rank skips — standard competition ranking).
 *   • `mergeLive(snapshotPage, rtdbPayload)` — reconcile the REST first-paint
 *     with the realtime stream so the UI renders ONE list (one read + one
 *     subscription, never per-row fetches — the N+1 collapse).
 *   • Transition pre-checks: none (no client lifecycle).
 *
 * Lives under `src/views/**` — the only sanctioned cross-domain composition
 * surface (R6 exception). Composes the injected `api` directly, never a sibling
 * repo module.
 */
import type { LeaderboardEntry, LeaderboardScope } from "@levelup/domain";
import type {
  ApiClient,
  GetLeaderboardRequest,
  GetLeaderboardResponse,
} from "../gamification/api-types.js";
import { paginate, type PageBag } from "../gamification/paginate.js";

/** Options for a leaderboard page request (scope-specific ids + paging). */
export interface LeaderboardPageOpts {
  spaceId?: GetLeaderboardRequest["spaceId"];
  storyPointId?: GetLeaderboardRequest["storyPointId"];
  cursor?: string;
  limit?: number;
}

/** The realtime payload shape (mirror of `v1.levelup.leaderboardLive`). */
export interface LeaderboardLivePayload {
  entries: LeaderboardEntry[];
  callerRank: number | null;
}

/** A page of board rows plus the always-present caller row + cursor walker. */
export interface LeaderboardPage extends PageBag<LeaderboardEntry> {
  callerEntry: LeaderboardEntry | null;
}

export interface LeaderboardRepo {
  /** Paginated REST snapshot; always surfaces the caller's own row + rank. */
  getPage(scope: LeaderboardScope, opts?: LeaderboardPageOpts): Promise<LeaderboardPage>;
  /** Dense competition rank across pages (1-based; ties share, then skip). */
  assignRanks(entries: readonly LeaderboardEntry[], startOffset?: number): LeaderboardEntry[];
  /** Reconcile the REST first-paint with the live RTDB stream → one list. */
  mergeLive(snapshotPage: LeaderboardPage, rtdbPayload: LeaderboardLivePayload): LeaderboardPage;
}

/** Sort by `score` desc (the RTDB rank key), stable on `userId`. */
function byScoreDesc(a: LeaderboardEntry, b: LeaderboardEntry): number {
  if (b.score !== a.score) return b.score - a.score;
  return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
}

function denseRank(entries: readonly LeaderboardEntry[], startOffset: number): LeaderboardEntry[] {
  let prevScore: number | null = null;
  let rank = startOffset;
  let seen = startOffset;
  return entries.map((e) => {
    seen += 1;
    if (prevScore === null || e.score !== prevScore) {
      rank = seen; // competition ranking: next distinct score takes the position
      prevScore = e.score;
    }
    return { ...e, rank };
  });
}

export function createLeaderboardRepo(api: ApiClient): LeaderboardRepo {
  return {
    getPage: async (scope, opts) => {
      const filter: GetLeaderboardRequest = {
        scope,
        spaceId: opts?.spaceId,
        storyPointId: opts?.storyPointId,
        cursor: opts?.cursor,
        limit: opts?.limit,
      };
      // paginate() drives the cursor; we wrap each page to keep `callerEntry`.
      let captured: LeaderboardEntry | null = null;
      const bag = await paginate<GetLeaderboardRequest, LeaderboardEntry>(async (req) => {
        const res: GetLeaderboardResponse = await api.levelup.getLeaderboard(req);
        captured = res.callerEntry;
        return {
          items: res.items,
          nextCursor: res.nextCursor,
          total: res.total,
        };
      }, filter);
      return { ...bag, callerEntry: captured };
    },

    assignRanks: (entries, startOffset = 0) =>
      denseRank([...entries].sort(byScoreDesc), startOffset),

    mergeLive: (snapshotPage, rtdbPayload) => {
      // Live RTDB rows are authoritative over the (older) REST snapshot rows.
      // Merge by userId, prefer the live row, re-sort + re-rank the union.
      const merged = new Map<string, LeaderboardEntry>();
      for (const e of snapshotPage.items) merged.set(e.userId, e);
      for (const e of rtdbPayload.entries) merged.set(e.userId, e);

      const ranked = denseRank([...merged.values()].sort(byScoreDesc), 0);

      // Re-resolve the caller row from the merged set (live wins), falling back
      // to the snapshot's caller row, then patch its rank from the live stream.
      const snapCaller = snapshotPage.callerEntry;
      let callerEntry: LeaderboardEntry | null = snapCaller
        ? (merged.get(snapCaller.userId) ?? snapCaller)
        : null;
      if (callerEntry && rtdbPayload.callerRank !== null) {
        callerEntry = { ...callerEntry, rank: rtdbPayload.callerRank };
      }

      return {
        items: ranked,
        nextCursor: snapshotPage.nextCursor,
        total: snapshotPage.total,
        fetchNextPage: snapshotPage.fetchNextPage,
        callerEntry,
      };
    },
  };
}
