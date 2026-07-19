/**
 * `@levelup/query` — analytics domain hooks (domain plan analytics.md §Query
 * hooks, SDK-LAYERS-PLAN §4.2/§4.3/§4.4).
 *
 * The dashboard read hooks (student/class/platform/health summaries, exam
 * analytics, insights, cost, trends, parent dashboards, leaderboard) plus the two
 * write hooks: `useDismissInsight` (✅ conservative optimistic — mark-read class,
 * remove-from-list / set `dismissedAt`, rollback on error) and `useGenerateReport`
 * (❌ NEVER optimistic — returns a signed `{ pdfUrl, expiresAt }`). Reports,
 * summaries, analytics, cost, trends are authoritative/derived: never optimistic.
 *
 * Hooks are THIN: reads call `repos.*` via `useApi`; the mutation is built with
 * `defineMutation` (one invalidation path, one optimistic guard). Imports NO
 * `firebase/*` and never touches the transport directly — repos + transport are
 * injected by `<ApiProvider>` (query-infra.md §2/§3).
 */
import {
  useInfiniteQuery,
  useQuery,
  type UseInfiniteQueryResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import type {
  ClassId,
  ClassProgressSummary,
  DailyCostSummary,
  ExamAnalytics,
  ExamId,
  InsightId,
  LearningInsight,
  MonthlyCostSummary,
  StudentId,
  StudentProgressSummary,
} from "@levelup/domain";
import { useApi } from "../provider/useApi.js";
import { defineMutation } from "../mutation/define-mutation.js";
import { useSubscription, type UseSubscriptionResult } from "../realtime/useSubscription.js";
import { analyticsQueryKeys } from "./keys.js";
import {
  analyticsRepos,
  type ChildSummaryRow,
  type CostFilter,
  type CostGranularity,
  type DismissInsightResponse,
  type GenerateReportResponse,
  type GetChildSummaryResponse,
  type GetLeaderboardRequest,
  type GetLeaderboardResponse,
  type GetPerformanceTrendsRequest,
  type GetSpaceAnalyticsResponse,
  type HealthSummary,
  type ListInsightsRequest,
  type ListLinkedChildrenRequest,
  type PageResponse,
  type PerformanceTrendPoint,
  type PlatformSummary,
} from "./repos.js";

// ===========================================================================
// READ HOOKS — summaries
// ===========================================================================

/** Student progress summary (learner/teacher/parent dashboards). Read-only. */
export function useStudentSummary(studentId: StudentId): UseQueryResult<StudentProgressSummary> {
  const { repos } = useApi();
  return useQuery({
    queryKey: analyticsQueryKeys.studentSummary(String(studentId)),
    queryFn: () => analyticsRepos(repos).summaryRepo.getStudent(studentId),
    enabled: Boolean(studentId),
  });
}

/** Class progress summary (teacher/admin). Read-only. */
export function useClassSummary(classId: ClassId): UseQueryResult<ClassProgressSummary> {
  const { repos } = useApi();
  return useQuery({
    queryKey: analyticsQueryKeys.classSummary(String(classId)),
    queryFn: () => analyticsRepos(repos).summaryRepo.getClass(classId),
    enabled: Boolean(classId),
  });
}

/** Platform summary (super-admin). Read-only. */
export function usePlatformSummary(): UseQueryResult<PlatformSummary> {
  const { repos } = useApi();
  return useQuery({
    queryKey: analyticsQueryKeys.platformSummary(),
    queryFn: () => analyticsRepos(repos).summaryRepo.getPlatform(),
  });
}

/** Health summary (super-admin). Read-only. */
export function useHealthSummary(): UseQueryResult<HealthSummary> {
  const { repos } = useApi();
  return useQuery({
    queryKey: analyticsQueryKeys.healthSummary(),
    queryFn: () => analyticsRepos(repos).summaryRepo.getHealth(),
  });
}

// ===========================================================================
// READ HOOKS — exam analytics, insights, cost, trends
// ===========================================================================

/** One exam's analytics. Read-only. */
export function useExamAnalytics(examId: ExamId): UseQueryResult<ExamAnalytics> {
  const { repos } = useApi();
  return useQuery({
    queryKey: analyticsQueryKeys.examAnalytics(String(examId)),
    queryFn: () => analyticsRepos(repos).examAnalyticsRepo.get(examId),
    enabled: Boolean(examId),
  });
}

/** Canonical per-space completion and engagement projection (teacher/admin). */
export function useSpaceAnalytics(spaceId: string): UseQueryResult<GetSpaceAnalyticsResponse> {
  const { repos } = useApi();
  return useQuery({
    queryKey: analyticsQueryKeys.spaceAnalytics(spaceId),
    queryFn: () => analyticsRepos(repos).spaceAnalyticsRepo.get(spaceId),
    enabled: Boolean(spaceId),
  });
}

/** Paginated learning-insight stream for a student (infinite read). */
export function useInsights(
  studentId: StudentId,
  opts: Omit<ListInsightsRequest, "studentId"> = {}
): UseInfiniteQueryResult<LearningInsight> {
  const { repos } = useApi();
  const filter: ListInsightsRequest = { ...opts, studentId };
  return useInfiniteQuery({
    queryKey: analyticsQueryKeys.insightList(filter),
    queryFn: ({ pageParam }) =>
      analyticsRepos(repos).insightRepo.list({
        ...filter,
        cursor: pageParam as string | undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: PageResponse<LearningInsight>) => last.nextCursor ?? undefined,
    enabled: Boolean(studentId),
  });
}

/** Cost summaries (admin) — daily or monthly. Read-only. */
export function useCostSummary(
  granularity: CostGranularity,
  filter: CostFilter = {}
): UseQueryResult<DailyCostSummary[] | MonthlyCostSummary[]> {
  const { repos } = useApi();
  return useQuery({
    queryKey: analyticsQueryKeys.costList({ granularity, ...filter }),
    queryFn: (): Promise<DailyCostSummary[] | MonthlyCostSummary[]> =>
      granularity === "monthly"
        ? analyticsRepos(repos).costRepo.listMonthly(filter)
        : analyticsRepos(repos).costRepo.listDaily(filter),
  });
}

/** Performance-trend points (server already aggregated). Read-only. */
export function usePerformanceTrends(
  filter: GetPerformanceTrendsRequest
): UseQueryResult<PerformanceTrendPoint[]> {
  const { repos } = useApi();
  return useQuery({
    queryKey: analyticsQueryKeys.trends(filter as object),
    queryFn: () => analyticsRepos(repos).trendsRepo.get(filter),
    enabled: Boolean(filter.granularity),
  });
}

// ===========================================================================
// READ HOOKS — parent dashboards (N+1-collapsed)
// ===========================================================================

/** Linked children for the signed-in parent (one batched read). Read-only. */
export function useLinkedChildren(
  filter: ListLinkedChildrenRequest = {}
): UseQueryResult<PageResponse<ChildSummaryRow>> {
  const { repos } = useApi();
  return useQuery({
    queryKey: analyticsQueryKeys.linkedChildren(filter as object),
    queryFn: () => analyticsRepos(repos).parentRepo.listChildren(filter),
  });
}

/** One linked child's summary + recent insights (parent). Read-only. */
export function useChildSummary(studentId: StudentId): UseQueryResult<GetChildSummaryResponse> {
  const { repos } = useApi();
  return useQuery({
    queryKey: analyticsQueryKeys.childSummary(String(studentId)),
    queryFn: () => analyticsRepos(repos).parentRepo.getChildSummary(studentId),
    enabled: Boolean(studentId),
  });
}

// ===========================================================================
// READ HOOKS — leaderboard (snapshot + live)
// ===========================================================================

/** Leaderboard snapshot (read-only). Pair with `useLeaderboardLive` for streams. */
export function useLeaderboard(
  filter: GetLeaderboardRequest
): UseQueryResult<GetLeaderboardResponse> {
  const { repos } = useApi();
  return useQuery({
    queryKey: analyticsQueryKeys.leaderboard(filter as object),
    queryFn: () => analyticsRepos(repos).leaderboardRepo.get(filter),
    enabled: Boolean(filter.scope),
  });
}

/** Live leaderboard (RTDB-backed subscription). Reconciles into the snapshot key. */
export function useLeaderboardLive(filter: GetLeaderboardRequest): UseSubscriptionResult {
  return useSubscription("v1.levelup.leaderboardLive", filter as never);
}

/** Live notification badge (server-authoritative; produced identically web + RN). */
export function useNotificationBadge(): UseSubscriptionResult {
  return useSubscription("v1.notification.badge", {} as never);
}

// ===========================================================================
// MUTATION HOOKS
// ===========================================================================

/**
 * Dismiss a learning insight. ✅ CONSERVATIVE optimistic (mark-read class): set
 * `dismissedAt` on the targeted insight in the cached infinite list; rollback on
 * error; `onSettled` reconciles the insights root via the invalidation graph.
 */
export const useDismissInsight = defineMutation<{ insightId: InsightId }, DismissInsightResponse>({
  callable: "v1.analytics.dismissInsight",
  run: (repos, vars) => analyticsRepos(repos).insightRepo.recordDismiss(vars.insightId),
  optimistic: {
    apply: (qc, vars) => {
      const key = analyticsQueryKeys.insightList();
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

/**
 * Generate a report PDF. ❌ NEVER optimistic — the mutation returns a signed
 * `{ pdfUrl, expiresAt }`; there is nothing to invalidate (graph rule = `[]`).
 * `kind` picks the report; the caller passes the matching scope ids.
 */
export const useGenerateReport = defineMutation<
  | { kind: "exam"; examId: ExamId; studentId?: StudentId }
  | { kind: "progress"; studentId: StudentId }
  | { kind: "class"; classId: ClassId },
  GenerateReportResponse
>({
  callable: "v1.analytics.generateReport",
  run: (repos, vars) => {
    const r = analyticsRepos(repos).reportRepo;
    switch (vars.kind) {
      case "exam":
        return r.getExamReport({ examId: vars.examId, studentId: vars.studentId });
      case "progress":
        return r.getProgressReport({ studentId: vars.studentId });
      case "class":
        return r.getClassReport({ classId: vars.classId });
    }
  },
});
