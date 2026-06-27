/**
 * `@levelup/query` — testsession-progress domain hooks (domain plan §Query hooks,
 * SDK-LAYERS-PLAN §4.2/§4.3/§4.4).
 *
 * The learner/parent/teacher-facing query+mutation hooks for the digital-test
 * runtime and learning-progress aggregates. Hooks are THIN: reads call
 * `repos.*` via `useApi`; mutations are built with `defineMutation` (one
 * invalidation path, one optimistic guard). The ONLY optimistic surfaces in this
 * domain are `useRecordItemAttempt` (practice progress, reconciled from the
 * authoritative `{progress}` response — A11/CD13) and `useDismissInsight`
 * (mark-read class). Everything session/grading/lifecycle is round-trip; the
 * `defineMutation` runtime guard + the `no-optimistic-on-authority` lint reject
 * an optimistic recipe on `startTestSession`/`submitTestSession`/`evaluateAnswer`.
 *
 * Imports NO `firebase/*` and never touches the transport directly — repos and
 * transport are injected by `<ApiProvider>` (query-infra.md §2/§3).
 */
import {
  useInfiniteQuery,
  useQuery,
  type UseInfiniteQueryResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import type {
  InsightId,
  ItemId,
  SpaceId,
  StoryPointId,
  TestSessionId,
  UserId,
} from "@levelup/domain";
import { useApi } from "../provider/useApi.js";
import { defineMutation } from "../mutation/define-mutation.js";
import { patchDetail } from "../mutation/recipes/patch-detail.js";
import { useSubscription, type UseSubscriptionResult } from "../realtime/useSubscription.js";
import { testSessionProgressKeys } from "./keys.js";
import {
  testSessionProgressRepos,
  type EvaluateAnswerInput,
  type EvaluateAnswerResult,
  type ListLearningInsightsFilter,
  type ListTestSessionsFilter,
  type PageResponse,
  type RecordItemAttemptInput,
  type RecordItemAttemptResult,
  type StartTestSessionInput,
  type StartTestSessionResult,
  type SubmitTestSessionInput,
  type SubmitTestSessionResult,
} from "./repos.js";

// ===========================================================================
// READ HOOKS
// ===========================================================================

/** Aggregate space progress for one learner (own data when `userId` omitted). */
export function useSpaceProgress(
  spaceId: SpaceId,
  userId?: UserId
): UseQueryResult<unknown | null> {
  const { repos } = useApi();
  return useQuery({
    queryKey: testSessionProgressKeys.space(String(spaceId), userId ? String(userId) : undefined),
    queryFn: () => testSessionProgressRepos(repos).progressRepo.getSpace(spaceId, userId),
    enabled: Boolean(spaceId),
  });
}

/** Item-level story-point progress (own/teacher/parent per server projection). */
export function useStoryPointProgress(
  spaceId: SpaceId,
  storyPointId: StoryPointId,
  userId?: UserId
): UseQueryResult<unknown | null> {
  const { repos } = useApi();
  return useQuery({
    queryKey: testSessionProgressKeys.storyPoint(
      String(spaceId),
      String(storyPointId),
      userId ? String(userId) : undefined
    ),
    queryFn: () =>
      testSessionProgressRepos(repos).progressRepo.getStoryPoint(spaceId, storyPointId, userId),
    enabled: Boolean(spaceId && storyPointId),
  });
}

/** One live/result test-session view (often paired with `useTestSessionDeadline`). */
export function useTestSession(sessionId: TestSessionId): UseQueryResult<unknown> {
  const { repos } = useApi();
  return useQuery({
    queryKey: testSessionProgressKeys.session(String(sessionId)),
    queryFn: () => testSessionProgressRepos(repos).testSessionRepo.get(sessionId),
    enabled: Boolean(sessionId),
  });
}

/** Paginated test-session history (infinite — `fetchNextPage`, never sees the cursor). */
export function useTestSessions(
  filter: ListTestSessionsFilter = {}
): UseInfiniteQueryResult<unknown> {
  const { repos } = useApi();
  return useInfiniteQuery({
    queryKey: testSessionProgressKeys.sessionList(filter),
    queryFn: ({ pageParam }) =>
      testSessionProgressRepos(repos).testSessionRepo.list({
        ...filter,
        cursor: pageParam as string | undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: PageResponse<unknown>) => last.nextCursor ?? undefined,
  });
}

/** Paginated personalised learning-insight stream (infinite). */
export function useLearningInsights(
  filter: ListLearningInsightsFilter = {}
): UseInfiniteQueryResult<unknown> {
  const { repos } = useApi();
  return useInfiniteQuery({
    queryKey: testSessionProgressKeys.insightList(filter),
    queryFn: ({ pageParam }) =>
      testSessionProgressRepos(repos).learningInsightRepo.list({
        ...filter,
        cursor: pageParam as string | undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** Cross-domain student summary (learner/parent dashboards — view repo). */
export function useStudentSummary(studentId: UserId): UseQueryResult<unknown> {
  const { repos } = useApi();
  return useQuery({
    queryKey: testSessionProgressKeys.studentSummary(String(studentId)),
    queryFn: () => testSessionProgressRepos(repos).studentSummaryRepo.get(studentId),
    enabled: Boolean(studentId),
  });
}

// ===========================================================================
// MUTATION HOOKS — session/grading/lifecycle are round-trip (NOT optimistic)
// ===========================================================================

/** Start (or resume) a test session. NOT optimistic — lifecycle/authority (⚷). */
export const useStartTestSession = defineMutation<StartTestSessionInput, StartTestSessionResult>({
  callable: "v1.levelup.startTestSession",
  run: (repos, vars) => testSessionProgressRepos(repos).testSessionRepo.recordStart(vars),
});

/** Submit a test session for grading. NOT optimistic — grading authority (⚷). */
export const useSubmitTestSession = defineMutation<SubmitTestSessionInput, SubmitTestSessionResult>(
  {
    callable: "v1.levelup.submitTestSession",
    run: (repos, vars) => testSessionProgressRepos(repos).testSessionRepo.recordSubmit(vars),
  }
);

/** Evaluate a single practice answer. NOT optimistic — the server computes score (⚷). */
export const useEvaluateAnswer = defineMutation<EvaluateAnswerInput, EvaluateAnswerResult>({
  callable: "v1.levelup.evaluateAnswer",
  run: (repos, vars) => testSessionProgressRepos(repos).testSessionRepo.recordEvaluation(vars),
});

// ===========================================================================
// MUTATION HOOKS — the TWO ✅ optimistic surfaces of this domain
// ===========================================================================

/**
 * Record a practice/standard item attempt. ✅ CONSERVATIVE optimistic
 * (OPTIMISTIC_ALLOWLIST). The optimistic patch bumps the in-flight attempt
 * WITHOUT inventing a score (the client never sends score/correct — CD13);
 * `reconcile` overwrites the cache with the SERVER `{progress}` via
 * `setQueryData` (NOT invalidate-refetch) so the server's recomputed best-score
 * wins (A11). `onSettled` still reconciles the broader progress/summary roots
 * via the invalidation graph fanout.
 */
export function makeRecordItemAttemptMutation(vars: {
  spaceId: SpaceId;
  storyPointId: StoryPointId;
  itemId: ItemId;
}): () => ReturnType<
  ReturnType<typeof defineMutation<RecordItemAttemptInput, RecordItemAttemptResult>>
> {
  const detailKey = testSessionProgressKeys.storyPoint(
    String(vars.spaceId),
    String(vars.storyPointId)
  );
  return defineMutation<RecordItemAttemptInput, RecordItemAttemptResult>({
    callable: "v1.levelup.recordItemAttempt",
    run: (repos, input) => testSessionProgressRepos(repos).progressRepo.recordAttempt(input),
    optimistic: patchDetail<
      RecordItemAttemptInput,
      RecordItemAttemptResult,
      Record<string, unknown>
    >(
      detailKey,
      (prev, input) => {
        const prevItems =
          (prev?.items as Record<string, { attemptsCount?: number }> | undefined) ?? {};
        const itemId = String(input.itemId);
        const prevItem = prevItems[itemId] ?? {};
        return {
          ...prev,
          items: {
            ...prevItems,
            [itemId]: {
              ...prevItem,
              // bump the attempt counter only — NO score/correct (server scores).
              attemptsCount: (prevItem.attemptsCount ?? 0) + 1,
              inFlight: true,
              lastAnswer: input.answer,
            },
          },
        };
      },
      {
        // A11/CD13: trust the authoritative server progress, write it directly.
        reconcile: (qc, data) => {
          qc.setQueryData<Record<string, unknown>>(detailKey, (prev) => {
            const items = (prev?.items as Record<string, unknown> | undefined) ?? {};
            const progress = data.progress;
            return {
              ...prev,
              items: { ...items, [String(progress.itemId)]: progress },
            };
          });
        },
      }
    ),
  });
}

/**
 * The default (key-agnostic) recordItemAttempt hook. Patches the item-progress
 * detail keyed by the mutation variables at call time; reconciles from the
 * authoritative `{progress}` response (A11/CD13).
 */
export const useRecordItemAttempt = defineMutation<RecordItemAttemptInput, RecordItemAttemptResult>(
  {
    callable: "v1.levelup.recordItemAttempt",
    run: (repos, input) => testSessionProgressRepos(repos).progressRepo.recordAttempt(input),
    optimistic: {
      apply: (qc, vars) => {
        const key = testSessionProgressKeys.storyPoint(
          String(vars.spaceId),
          String(vars.storyPointId)
        );
        const prev = qc.getQueryData<Record<string, unknown>>(key);
        const itemId = String(vars.itemId);
        const prevItems = (prev?.items as Record<string, { attemptsCount?: number }>) ?? {};
        const prevItem = prevItems[itemId] ?? {};
        qc.setQueryData<Record<string, unknown>>(key, {
          ...prev,
          items: {
            ...prevItems,
            [itemId]: {
              ...prevItem,
              attemptsCount: (prevItem.attemptsCount ?? 0) + 1,
              inFlight: true,
              lastAnswer: vars.answer,
            },
          },
        });
        return { key, prev } as {
          key: readonly unknown[];
          prev: Record<string, unknown> | undefined;
        };
      },
      rollback: (qc, ctx) => {
        const { key, prev } = ctx as {
          key: readonly unknown[];
          prev: Record<string, unknown> | undefined;
        };
        qc.setQueryData(key, prev);
      },
      reconcile: (qc, data, _vars, ctx) => {
        const { key } = ctx as { key: readonly unknown[]; prev: unknown };
        qc.setQueryData<Record<string, unknown>>(key, (prev) => {
          const items = (prev?.items as Record<string, unknown> | undefined) ?? {};
          return { ...prev, items: { ...items, [String(data.progress.itemId)]: data.progress } };
        });
      },
    },
  }
);

/**
 * Dismiss a learning insight. ✅ optimistic (mark-read class): optimistically set
 * `dismissedAt` in the cached insight list; rollback on error. Invalidate via the
 * graph in `onSettled`.
 */
export const useDismissInsight = defineMutation<
  { insightId: InsightId },
  { id: InsightId; dismissed: true }
>({
  callable: "v1.levelup.dismissInsight",
  run: (repos, vars) =>
    testSessionProgressRepos(repos).learningInsightRepo.recordDismissal(vars.insightId),
  optimistic: {
    apply: (qc, vars) => {
      const key = testSessionProgressKeys.insightList();
      const prev = qc.getQueryData<{ pages?: Array<{ items?: Array<{ id: string }> }> }>(key);
      const now = new Date().toISOString();
      qc.setQueryData<typeof prev>(key, (p) => {
        if (!p?.pages) return p;
        return {
          ...p,
          pages: p.pages.map((page) => ({
            ...page,
            items: (page.items ?? []).map((i) =>
              i.id === String(vars.insightId) ? { ...i, dismissedAt: now } : i
            ),
          })),
        };
      });
      return { key, prev } as { key: readonly unknown[]; prev: typeof prev };
    },
    rollback: (qc, ctx) => {
      const { key, prev } = ctx as { key: readonly unknown[]; prev: unknown };
      qc.setQueryData(key, prev);
    },
  },
});

// ===========================================================================
// REALTIME HOOK — server-authoritative deadline countdown
// ===========================================================================

/**
 * Live, server-authoritative test-session deadline countdown. Wraps
 * `useSubscription('v1.levelup.testSessionDeadline', { sessionId })`; the
 * `serverDeadline` stays server-authoritative (the stream only carries the
 * authoritative value — REVIEW §6 #6). Pair with `useServerTime()` (`@levelup/
 * realtime`) so the countdown never trusts the client clock.
 */
export function useTestSessionDeadline(sessionId: TestSessionId): UseSubscriptionResult {
  return useSubscription("v1.levelup.testSessionDeadline", {
    sessionId: String(sessionId),
  } as never);
}
