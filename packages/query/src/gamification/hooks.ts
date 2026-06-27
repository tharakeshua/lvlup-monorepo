/**
 * `@levelup/query` — gamification domain hooks (domain plan gamification.md
 * §Query hooks, SDK-LAYERS-PLAN §4.2/§4.3/§4.4).
 *
 * Gamification is DERIVED, server-authoritative state: levels/XP, unlocks,
 * leaderboard ranks and streaks are projections the SDK only reads. The only
 * genuine client writes are study-goal CRUD and the mark-seen acknowledgement.
 *
 * Read hooks (level / catalog / earned / leaderboard / goals / sessions / the
 * composed `summary`) call `repos.*` via `useApi`. The realtime hooks bind the
 * RTDB/Firestore streams through `useSubscription` (server wins into the cache).
 *
 * Mutation surfaces:
 *   • `useMarkAchievementsSeen` — ✅ CONSERVATIVE OPTIMISTIC (mark-read class):
 *     flip `seen=true` on the targeted unlock(s) in the earned list AND decrement
 *     the `unseenCount` on the composed summary; rollback on error; `onSettled`
 *     reconciles `achievements` + `gamification` roots via the invalidation graph.
 *   • `useSaveStudyGoal` / `useArchiveStudyGoal` — ❌ NEVER optimistic
 *     (`currentCount/completed/completedAt` are server-derived; an optimistic
 *     create would show wrong progress).
 *   • `useSaveAchievementDefinition` (admin) — ❌ NEVER optimistic
 *     (authoring/lifecycle-adjacent; `criteria`/`pointsReward` are authority).
 *
 * Leaderboard, level, and achievement *unlock* are NEVER optimistic — they are
 * §4-⚷ derived/authoritative values; only `markSeen` qualifies (gamification.md
 * §Authority boundary). All optimistic recipes route through `defineMutation`, so
 * the runtime guard + the `no-optimistic-on-authority` lint confirm
 * `markAchievementsSeen` is allow-listed. Imports NO `firebase/*` and never
 * touches the transport directly — repos + transport are injected by
 * `<ApiProvider>` (query-infra.md §2/§3).
 */
import {
  useInfiniteQuery,
  useQuery,
  type UseInfiniteQueryResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import type {
  GamificationSummary,
  StudentAchievement,
  StudentLevel,
  StudyGoal,
  UserId,
} from "@levelup/domain";
import { useApi } from "../provider/useApi.js";
import { defineMutation } from "../mutation/define-mutation.js";
import { patchDetail } from "../mutation/recipes/patch-detail.js";
import { incrementCounter } from "../mutation/recipes/increment-counter.js";
import { useSubscription, type UseSubscriptionResult } from "../realtime/useSubscription.js";
import { gamificationQueryKeys } from "./keys.js";
import {
  gamificationRepos,
  type AchievementWithEarnedState,
  type GetLeaderboardRequest,
  type GetLeaderboardResponse,
  type ListAchievementsRequest,
  type ListStudentAchievementsRequest,
  type ListStudyGoalsRequest,
  type ListStudySessionsRequest,
  type ListStudySessionsResponse,
  type MarkAchievementsSeenRequest,
  type MarkAchievementsSeenResponse,
  type PageResponse,
  type SaveAchievementDefinitionRequest,
  type SaveResponse,
  type SaveStudyGoalRequest,
} from "./repos.js";

const str = (v: unknown): string | undefined =>
  v === undefined || v === null ? undefined : String(v);

// ===========================================================================
// READ HOOKS — composed home + level
// ===========================================================================

/**
 * The composed student "gamification home" (level + recent achievements +
 * unseen count + streak + tenant rank + active goals) in ONE server-aggregated
 * round-trip (collapses 5 reads → 1). Omit `userId` ⇒ self; parent/teacher may
 * pass a child/student id (server authorizes). Read-only.
 */
export function useGamificationSummary(userId?: UserId): UseQueryResult<GamificationSummary> {
  const { repos } = useApi();
  return useQuery({
    queryKey: gamificationQueryKeys.summary(str(userId)),
    queryFn: () => gamificationRepos(repos).gamificationViewRepo.getSummary(userId),
  });
}

/** Student level / XP summary (server-authoritative). Read-only. */
export function useStudentLevel(userId?: UserId): UseQueryResult<StudentLevel> {
  const { repos } = useApi();
  return useQuery({
    queryKey: gamificationQueryKeys.level(str(userId)),
    queryFn: () => gamificationRepos(repos).studentLevelRepo.get(userId),
  });
}

// ===========================================================================
// READ HOOKS — achievements (catalog + earned), paginated
// ===========================================================================

/** Achievement-definition catalog joined with caller earned-state (infinite). */
export function useAchievementCatalog(
  filter: ListAchievementsRequest = {}
): UseInfiniteQueryResult<AchievementWithEarnedState> {
  const { repos } = useApi();
  return useInfiniteQuery({
    queryKey: gamificationQueryKeys.catalog(filter as object),
    queryFn: ({ pageParam }) =>
      gamificationRepos(repos).achievementRepo.listCatalog({
        ...filter,
        cursor: pageParam as string | undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: PageResponse<AchievementWithEarnedState>) =>
      last.nextCursor ?? undefined,
  });
}

/** The caller's (or a child's) unlock records (infinite). */
export function useStudentAchievements(
  opts: ListStudentAchievementsRequest = {}
): UseInfiniteQueryResult<StudentAchievement> {
  const { repos } = useApi();
  return useInfiniteQuery({
    queryKey: gamificationQueryKeys.earned(str(opts.userId), opts.unseenOnly),
    queryFn: ({ pageParam }) =>
      gamificationRepos(repos).achievementRepo.listEarned({
        ...opts,
        cursor: pageParam as string | undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: PageResponse<StudentAchievement>) => last.nextCursor ?? undefined,
  });
}

// ===========================================================================
// READ HOOKS — leaderboard / goals / sessions
// ===========================================================================

/**
 * Leaderboard snapshot (point-in-time projection; always carries `callerEntry`).
 * Pair with `useGamificationLeaderboardLive` for the realtime stream. Read-only.
 */
export function useLeaderboardSnapshot(
  filter: GetLeaderboardRequest
): UseQueryResult<GetLeaderboardResponse> {
  const { repos } = useApi();
  return useQuery({
    queryKey: gamificationQueryKeys.leaderboard(filter as object),
    queryFn: () => gamificationRepos(repos).leaderboardRepo.getPage(filter),
    enabled: Boolean(filter.scope),
  });
}

/** Study-goal planner list (infinite). Read-only. */
export function useStudyGoals(opts: ListStudyGoalsRequest = {}): UseInfiniteQueryResult<StudyGoal> {
  const { repos } = useApi();
  return useInfiniteQuery({
    queryKey: gamificationQueryKeys.goals(opts as object),
    queryFn: ({ pageParam }) =>
      gamificationRepos(repos).studyGoalRepo.list({
        ...opts,
        cursor: pageParam as string | undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: PageResponse<StudyGoal>) => last.nextCursor ?? undefined,
  });
}

/** Study-session heatmap/streak feed (server pre-computes streaks). Read-only. */
export function useStudySessions(
  range: ListStudySessionsRequest = {}
): UseQueryResult<ListStudySessionsResponse> {
  const { repos } = useApi();
  return useQuery({
    queryKey: gamificationQueryKeys.sessions(range as object),
    queryFn: () => gamificationRepos(repos).studySessionRepo.list(range),
  });
}

// ===========================================================================
// REALTIME HOOKS (server-authoritative streams → cache write)
// ===========================================================================

/**
 * Live leaderboard (RTDB-backed). Reconciles into the leaderboard snapshot key
 * (the default writer in `useSubscription`; `leaderboardRepo.mergeLive` shaping
 * happens app-side over the cached page).
 */
export function useGamificationLeaderboardLive(
  filter: GetLeaderboardRequest
): UseSubscriptionResult {
  return useSubscription("v1.levelup.leaderboardLive", filter as never);
}

/**
 * Live unlock stream for the signed-in student. On payload, invalidate the
 * earned list + the composed summary so the badge wall + home reflect the new
 * unlock (the toast/confetti is an app concern; this only refreshes the cache).
 */
export function useAchievementUnlockStream(): UseSubscriptionResult {
  return useSubscription("v1.levelup.achievementUnlock", {} as never, (_payload, qc) => {
    void qc.invalidateQueries({ queryKey: gamificationQueryKeys.earned() });
    void qc.invalidateQueries({ queryKey: gamificationQueryKeys.summary() });
  });
}

/** Live XP-bar update on `studentLevels/{self}` (writes payload into the level key). */
export function useStudentLevelLive(): UseSubscriptionResult {
  return useSubscription("v1.levelup.studentLevelLive", {} as never, (payload, qc) => {
    qc.setQueryData(gamificationQueryKeys.level(), payload);
  });
}

// ===========================================================================
// MUTATION HOOKS
// ===========================================================================

/**
 * Mark achievement unlock(s) seen. ✅ CONSERVATIVE OPTIMISTIC (mark-read class):
 * flip `seen=true` on the targeted unlock(s) in the earned infinite list AND
 * decrement the `unseenCount` counter on the composed summary; both roll back on
 * error. `onSettled` reconciles `achievements` + `gamification` roots via the
 * invalidation graph. `markAchievementsSeen` is on the closed OPTIMISTIC_ALLOWLIST
 * (the build-time guard + lint confirm it).
 */
export const useMarkAchievementsSeen = defineMutation<
  MarkAchievementsSeenRequest,
  MarkAchievementsSeenResponse
>({
  callable: "v1.levelup.markAchievementsSeen",
  run: (repos, vars) => gamificationRepos(repos).achievementRepo.markSeen(vars),
  optimistic: {
    apply: (qc, vars, keys) => {
      // 1. flip `seen` on the earned list (all matching pages/items).
      const earnedKey = keys.achievements.sub("me", "earned", {
        userId: "self",
        unseenOnly: false,
      });
      const earnedAllUnseen = keys.achievements.sub("me", "earned", {
        userId: "self",
        unseenOnly: true,
      });
      const markAll = "all" in vars && vars.all === true;
      const ids = !markAll && "achievementIds" in vars ? vars.achievementIds.map(String) : [];
      const patchPages = (prev: unknown): unknown => {
        const p = prev as { pages?: Array<{ items?: Array<{ id?: string; seen?: boolean }> }> };
        if (!p?.pages) return prev;
        return {
          ...p,
          pages: p.pages.map((page) => ({
            ...page,
            items: (page.items ?? []).map((it) =>
              markAll || (it.id !== undefined && ids.includes(String(it.id)))
                ? { ...it, seen: true }
                : it
            ),
          })),
        };
      };
      const listPatch = patchDetail<MarkAchievementsSeenRequest, unknown, unknown>(
        earnedKey,
        (prev) => patchPages(prev)
      );
      const listUnseenPatch = patchDetail<MarkAchievementsSeenRequest, unknown, unknown>(
        earnedAllUnseen,
        (prev) => patchPages(prev)
      );
      // 2. decrement `unseenCount` on the composed summary (allow-listed counter).
      const summaryKey = keys.gamification.sub("home", "summary", { userId: "self" });
      const delta = markAll ? -1_000_000 : -ids.length; // clamp ≥ 0 in the recipe
      const badge = incrementCounter<MarkAchievementsSeenRequest, unknown>(
        summaryKey,
        delta,
        "unseenCount"
      );
      return {
        listCtx: listPatch.apply(qc, vars, keys),
        listUnseenCtx: listUnseenPatch.apply(qc, vars, keys),
        badgeCtx: badge.apply(qc, vars, keys),
        earnedKey,
        earnedAllUnseen,
        summaryKey,
      };
    },
    rollback: (qc, ctx) => {
      const c = ctx as {
        listCtx: never;
        listUnseenCtx: never;
        badgeCtx: never;
        earnedKey: readonly unknown[];
        earnedAllUnseen: readonly unknown[];
        summaryKey: readonly unknown[];
      };
      patchDetail(c.earnedKey, (p) => p).rollback(qc, c.listCtx);
      patchDetail(c.earnedAllUnseen, (p) => p).rollback(qc, c.listUnseenCtx);
      incrementCounter(c.summaryKey, 0, "unseenCount").rollback(qc, c.badgeCtx);
    },
  },
});

/**
 * Save/upsert a study goal (no id ⇒ create). ❌ NEVER optimistic — the server
 * derives `currentCount/completed/completedAt`, so an optimistic create would
 * show wrong progress. `onSettled` invalidates `studyGoals` + `gamification`.
 */
export const useSaveStudyGoal = defineMutation<SaveStudyGoalRequest, SaveResponse<StudyGoal["id"]>>(
  {
    callable: "v1.levelup.saveStudyGoal",
    run: (repos, vars) => gamificationRepos(repos).studyGoalRepo.save(vars),
  }
);

/** Archive (soft-delete) a study goal — thin over `save({deleted:true})`. ❌ never optimistic. */
export const useArchiveStudyGoal = defineMutation<StudyGoal, SaveResponse<StudyGoal["id"]>>({
  callable: "v1.levelup.saveStudyGoal",
  run: (repos, goal) => gamificationRepos(repos).studyGoalRepo.archive(goal),
});

/**
 * Save/upsert an achievement *definition* (tenant-admin authoring). ❌ NEVER
 * optimistic — authoring/lifecycle-adjacent; `criteria`/`pointsReward` are
 * scoring authority. Invalidates the `achievements` root via the graph.
 */
export const useSaveAchievementDefinition = defineMutation<
  SaveAchievementDefinitionRequest,
  SaveResponse<AchievementWithEarnedState["id"]>
>({
  callable: "v1.levelup.saveAchievementDefinition",
  run: (repos, vars) => gamificationRepos(repos).achievementRepo.saveDefinition(vars),
});
