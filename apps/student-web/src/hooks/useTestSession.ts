import { useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  useTestSessions as useTestSessionsQuery,
  useTestSession as useTestSessionQuery,
  useStartTestSession,
  useSubmitTestSession,
  useApiClient,
} from "@levelup/query";
import { asSpaceId, asStoryPointId, asUserId, asTestSessionId } from "@levelup/domain";
import type { DigitalTestSession } from "@levelup/shared-types";

/**
 * Timed-test session hooks — migrated from direct Firestore reads + the
 * `callStartTestSession`/`callSubmitTestSession` shared-services callables to
 * `@levelup/query`. Exported signatures + return shapes are PRESERVED so the
 * page consumers (`TimedTestPage`, `TestAnalyticsPage`) keep working unchanged.
 */

/** Minimal shape of the autograde/levelup api-client surface we reach for the
 *  `saveTestAnswer` callable (no `@levelup/query` hook exists for it — see
 *  `useSaveAnswer`). */
type SaveTestAnswerClient = {
  levelup: {
    saveTestAnswer: (req: {
      sessionId: string;
      itemId: string;
      answer: unknown;
      markedForReview?: boolean;
      timeSpentSeconds?: number;
    }) => Promise<{ saved: true; answeredQuestions: number }>;
  };
};

/**
 * List a learner's test sessions for a (space, storyPoint). Wraps the infinite
 * `useTestSessions` query and FLATTENS pages back into the flat
 * `DigitalTestSession[]` the legacy hook returned.
 */
export function useTestSessions(
  tenantId: string | null,
  userId: string | null,
  spaceId: string | null,
  storyPointId: string | null
) {
  const enabled = !!tenantId && !!userId && !!spaceId && !!storyPointId;
  const query = useTestSessionsQuery({
    spaceId: spaceId ? asSpaceId(spaceId) : undefined,
    storyPointId: storyPointId ? asStoryPointId(storyPointId) : undefined,
    userId: userId ? asUserId(userId) : undefined,
  });

  const data = useMemo<DigitalTestSession[]>(() => {
    if (!enabled) return [];
    const pages = (query.data as { pages?: Array<{ items?: unknown[] }> } | undefined)?.pages ?? [];
    return pages.flatMap((p) => p.items ?? []) as DigitalTestSession[];
  }, [query.data, enabled]);

  return {
    data,
    isLoading: enabled ? query.isLoading : false,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Read a single test session by id (polling preserved via the query layer). */
export function useTestSession(tenantId: string | null, sessionId: string | null) {
  const query = useTestSessionQuery(asTestSessionId(sessionId ?? ""));
  return {
    data: ((query.data as DigitalTestSession | undefined) ?? null) as DigitalTestSession | null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Start (or resume) a test session. Unwraps the contract envelope
 * `{ session, resuming }` to the `DigitalTestSession` so callers keep reading
 * `result.sectionMapping` / `result.lastVisitedIndex` directly.
 */
export function useStartTest() {
  const mutation = useStartTestSession();

  const mutateAsync = async (params: {
    tenantId: string;
    spaceId: string;
    storyPointId: string;
  }): Promise<DigitalTestSession> => {
    const result = await mutation.mutateAsync({
      spaceId: asSpaceId(params.spaceId),
      storyPointId: asStoryPointId(params.storyPointId),
    });
    return (result as { session: unknown }).session as DigitalTestSession;
  };

  return { ...mutation, mutateAsync };
}

/**
 * Submit a test session for grading. The new contract no longer accepts an
 * inline `submissions` payload — per-question answers are write-through-persisted
 * during the session via `useSaveAnswer` — so `submissions` is accepted for
 * signature compat but not forwarded.
 */
export function useSubmitTest() {
  const mutation = useSubmitTestSession();

  const mutateAsync = async (params: {
    tenantId: string;
    sessionId: string;
    submissions?: Record<string, unknown>;
    autoSubmitted?: boolean;
  }) => {
    return mutation.mutateAsync({
      sessionId: asTestSessionId(params.sessionId),
      autoSubmitted: params.autoSubmitted,
    });
  };

  return { ...mutation, mutateAsync };
}

/**
 * useSaveAnswer — write-through a single in-progress answer during a timed test
 * session (crash-resume safety) via the `v1.levelup.saveTestAnswer` callable.
 *
 * PARITY GAP: `@levelup/query` exposes no hook (and `@levelup/repositories` no
 * method) for `saveTestAnswer`, so this reaches the callable through the injected
 * api-client (`useApiClient`) — the sanctioned escape hatch — instead of the old
 * direct `httpsCallable(recordItemAttempt)` session-contract path.
 */
export function useSaveAnswer() {
  const api = useApiClient() as unknown as SaveTestAnswerClient;

  return useMutation({
    mutationFn: async (params: {
      tenantId: string;
      sessionId: string;
      itemId: string;
      answer: unknown;
      timeSpentSeconds: number;
    }) => {
      return api.levelup.saveTestAnswer({
        sessionId: params.sessionId,
        itemId: params.itemId,
        answer: params.answer,
        timeSpentSeconds: params.timeSpentSeconds,
      });
    },
  });
}
