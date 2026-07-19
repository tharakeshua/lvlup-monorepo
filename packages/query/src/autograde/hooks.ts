/**
 * autograde React Query hooks (domain plan sdk-plan/domains/autograde.md §Query hooks).
 *
 * Every hook is thin: reads call `repos.*` through `useApi()`; mutations are built
 * with `defineMutation` so invalidation flows through the single
 * `INVALIDATION_GRAPH` entrypoint. **Conservative optimistic allow-list: NONE of
 * autograde's mutations qualify** — grading, publish/lifecycle, release, and
 * upload are ALL authority-sensitive (§ authority boundary ⚷). Every mutation
 * round-trips and invalidates; there are **no optimistic recipes** in this domain
 * (spec §5.5). Passing `optimistic` to any of these would throw at construction.
 *
 * Arg/return types are derived directly from the REAL repo method signatures
 * (`@levelup/repositories`' `AutogradeRepos`) via `Parameters`/`ReturnType`, so a
 * repo signature change surfaces here at typecheck time (no drift).
 */
import {
  useInfiniteQuery,
  useQuery,
  type UseInfiniteQueryResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import type { StorageRepo } from "@levelup/repositories";
import { useApi } from "../provider/useApi.js";
import { defineMutation } from "../mutation/define-mutation.js";
import { autogradeKeys } from "./keys.js";
import { autogradeRepos, type AutogradeReposSlice } from "./repos.js";

// ── method-type helpers (derive from the real repo seams) ───────────────────
type R = AutogradeReposSlice;
type Arg0<F> = F extends (a: infer A, ...rest: never[]) => unknown ? A : never;
type Ret<F> = F extends (...a: never[]) => Promise<infer T> ? T : never;

/** A `PageResponse`-shaped page (items + opaque cursor sentinel). */
interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
}

function withPageCursor<T extends object | undefined>(
  filter: T,
  pageParam: unknown
): (T extends undefined ? Record<string, never> : NonNullable<T>) & { cursor?: string } {
  const req = { ...((filter ?? {}) as object) } as (T extends undefined
    ? Record<string, never>
    : NonNullable<T>) & { cursor?: string };
  if (typeof pageParam === "string") req.cursor = pageParam;
  return req;
}

// ===========================================================================
// Exams
// ===========================================================================

/** Paginated exam list (infinite query over `examRepo.list`). */
export function useExams(
  filter?: Arg0<R["examRepo"]["list"]>
): UseInfiniteQueryResult<{ pages: CursorPage<unknown>[]; pageParams: unknown[] }, unknown> {
  const { repos } = useApi();
  const examRepo = autogradeRepos(repos).examRepo;
  return useInfiniteQuery({
    queryKey: autogradeKeys.examList(filter as object),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      examRepo.list(withPageCursor(filter, pageParam) as Arg0<R["examRepo"]["list"]>) as Promise<
        CursorPage<unknown>
      >,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** One exam detail (query over `examRepo.get`). */
export function useExam(id: string): UseQueryResult<Ret<R["examRepo"]["get"]>, unknown> {
  const { repos } = useApi();
  const examRepo = autogradeRepos(repos).examRepo;
  return useQuery({
    queryKey: autogradeKeys.exam(id),
    queryFn: () => examRepo.get(id) as Promise<Ret<R["examRepo"]["get"]>>,
    enabled: Boolean(id),
  });
}

/** Save exam metadata/lifecycle (⚷ — invalidates exams.all + exams.detail). */
export const useSaveExam = defineMutation<Arg0<R["examRepo"]["save"]>, Ret<R["examRepo"]["save"]>>({
  callable: "v1.autograde.saveExam",
  run: (repos, vars) => autogradeRepos(repos).examRepo.save(vars),
});

/** AI question extraction (⚷ — invalidates exam detail + question list). */
export const useExtractQuestions = defineMutation<
  Arg0<R["examRepo"]["recordExtraction"]>,
  Ret<R["examRepo"]["recordExtraction"]>
>({
  callable: "v1.autograde.extractQuestions",
  run: (repos, vars) => autogradeRepos(repos).examRepo.recordExtraction(vars),
});

/** Explicit results-release lifecycle verb (⚷ — invalidates exam detail + submissions). */
export const useReleaseResults = defineMutation<
  Arg0<R["examRepo"]["releaseResults"]>,
  Ret<R["examRepo"]["releaseResults"]>
>({
  callable: "v1.autograde.releaseResults",
  run: (repos, vars) => autogradeRepos(repos).examRepo.releaseResults(vars),
});

/**
 * Teacher action: transform a published exam into a practice Space — one
 * StoryPoint (the exam) + one Item per extracted question (⚷ — invalidates the
 * exam detail, plus spaces/storyPoints/items so the new space appears immediately).
 */
export const useCreateSpaceFromExam = defineMutation<
  Arg0<R["examRepo"]["createSpaceFromExam"]>,
  Ret<R["examRepo"]["createSpaceFromExam"]>
>({
  callable: "v1.autograde.createSpaceFromExam",
  run: (repos, vars) => autogradeRepos(repos).examRepo.createSpaceFromExam(vars),
});

// ===========================================================================
// Exam questions
// ===========================================================================

/** An exam's extracted questions (query over `examQuestionRepo.list`). */
export function useExamQuestions(
  examId: string
): UseQueryResult<Ret<R["examQuestionRepo"]["list"]>, unknown> {
  const { repos } = useApi();
  const examQuestionRepo = autogradeRepos(repos).examQuestionRepo;
  return useQuery({
    queryKey: autogradeKeys.examQuestions(examId),
    queryFn: () => examQuestionRepo.list(examId) as Promise<Ret<R["examQuestionRepo"]["list"]>>,
    enabled: Boolean(examId),
  });
}

/** Save / create / delete an exam question (⚷ — invalidates exam question list). */
export const useSaveExamQuestion = defineMutation<
  Arg0<R["examQuestionRepo"]["saveQuestion"]>,
  Ret<R["examQuestionRepo"]["saveQuestion"]>
>({
  callable: "v1.autograde.saveExamQuestion",
  run: (repos, vars) => autogradeRepos(repos).examQuestionRepo.saveQuestion(vars),
});

/** Re-extract one question (⚷ — invalidates that exam's question list). */
export const useReExtractQuestion = defineMutation<
  { examId: string; questionNumber: string },
  Ret<R["examQuestionRepo"]["recordReExtraction"]>
>({
  callable: "v1.autograde.extractQuestions",
  run: (repos, vars) =>
    autogradeRepos(repos).examQuestionRepo.recordReExtraction(vars.examId, vars.questionNumber),
});

// ===========================================================================
// Submissions
// ===========================================================================

/** Paginated submissions list (infinite query over `submissionRepo.list`). */
export function useSubmissions(
  filter: Arg0<R["submissionRepo"]["list"]>
): UseInfiniteQueryResult<{ pages: CursorPage<unknown>[]; pageParams: unknown[] }, unknown> {
  const { repos } = useApi();
  const submissionRepo = autogradeRepos(repos).submissionRepo;
  return useInfiniteQuery({
    queryKey: autogradeKeys.submissionList(filter as object),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      submissionRepo.list(
        withPageCursor(filter as object, pageParam) as unknown as Arg0<R["submissionRepo"]["list"]>
      ) as Promise<CursorPage<unknown>>,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** One submission detail (query over `submissionRepo.get`). */
export function useSubmission(
  id: string
): UseQueryResult<Ret<R["submissionRepo"]["get"]>, unknown> {
  const { repos } = useApi();
  const submissionRepo = autogradeRepos(repos).submissionRepo;
  return useQuery({
    queryKey: autogradeKeys.submission(id),
    queryFn: () => submissionRepo.get(id) as Promise<Ret<R["submissionRepo"]["get"]>>,
    enabled: Boolean(id),
  });
}

/** Single canonical answer-sheet ingestion (⚷ — invalidates submissions list + exam detail). */
export const useUploadAnswerSheets = defineMutation<
  Arg0<R["submissionRepo"]["upload"]>,
  Ret<R["submissionRepo"]["upload"]>
>({
  callable: "v1.autograde.uploadAnswerSheets",
  run: (repos, vars) => autogradeRepos(repos).submissionRepo.upload(vars),
});

// ===========================================================================
// Storage seam (signed-PUT upload)
// ===========================================================================

/** The `storageRepo` lives in the views-and-storage-auth slice of the bag (not
 * in `AutogradeRepos`); narrow the open bag to just the seam this hook drives. */
type StorageReposSlice = { storageRepo: StorageRepo };

/**
 * Request a scoped signed-PUT URL, upload the bytes, and resolve the
 * SERVER-OWNED storage path (⚷ — the server pins the `tenants/{t}/…` scope via
 * `buildScopedPath`; the client never hand-builds an upload path). This is the
 * sanctioned answer-sheet / question-paper upload mechanism.
 *
 * A signed URL is a transient grant — it persists no state, so this mutation
 * invalidates **nothing**. The returned path is persisted by a *separate*
 * `useSaveExam` (questionPaperImages) / `useUploadAnswerSheets` (imageUrls)
 * mutation, each of which owns its own invalidation.
 */
export const useUploadImage = defineMutation<
  Parameters<StorageRepo["uploadImage"]>[0],
  Awaited<ReturnType<StorageRepo["uploadImage"]>>
>({
  callable: "v1.autograde.requestUploadUrl",
  invalidate: "none",
  run: (repos, vars) => (repos as unknown as StorageReposSlice).storageRepo.uploadImage(vars),
});

// ===========================================================================
// Question submissions (grading)
// ===========================================================================

/** A submission's per-question grading results (query over `questionSubmissionRepo.list`). */
export function useQuestionSubmissions(
  submissionId: string
): UseQueryResult<Ret<R["questionSubmissionRepo"]["list"]>, unknown> {
  const { repos } = useApi();
  const questionSubmissionRepo = autogradeRepos(repos).questionSubmissionRepo;
  return useQuery({
    queryKey: autogradeKeys.questionSubmissions(submissionId),
    queryFn: () =>
      questionSubmissionRepo.list(submissionId) as Promise<
        Ret<R["questionSubmissionRepo"]["list"]>
      >,
    enabled: Boolean(submissionId),
  });
}

/** Manual grade override (⚷ score authority — invalidates qSubmissions + submission + review). */
export const useGradeManual = defineMutation<
  Arg0<R["questionSubmissionRepo"]["recordManualGrade"]>,
  Ret<R["questionSubmissionRepo"]["recordManualGrade"]>
>({
  callable: "v1.autograde.gradeQuestion",
  run: (repos, vars) => autogradeRepos(repos).questionSubmissionRepo.recordManualGrade(vars),
});

/** Retry failed grading (⚷ — same invalidation set). */
export const useRetryGrading = defineMutation<
  Arg0<R["questionSubmissionRepo"]["recordRetryGrade"]>,
  Ret<R["questionSubmissionRepo"]["recordRetryGrade"]>
>({
  callable: "v1.autograde.gradeQuestion",
  run: (repos, vars) => autogradeRepos(repos).questionSubmissionRepo.recordRetryGrade(vars),
});

/** AI-grade one question (⚷ — same invalidation set). */
export const useAiGradeQuestion = defineMutation<
  Arg0<R["questionSubmissionRepo"]["recordAiGrade"]>,
  Ret<R["questionSubmissionRepo"]["recordAiGrade"]>
>({
  callable: "v1.autograde.gradeQuestion",
  run: (repos, vars) => autogradeRepos(repos).questionSubmissionRepo.recordAiGrade(vars),
});

// ===========================================================================
// Evaluation settings
// ===========================================================================

/** Evaluation-settings presets (query over `evaluationSettingsRepo.list`). */
export function useEvaluationSettings(
  includePublic?: boolean
): UseQueryResult<Ret<R["evaluationSettingsRepo"]["list"]>, unknown> {
  const { repos } = useApi();
  const evaluationSettingsRepo = autogradeRepos(repos).evaluationSettingsRepo;
  return useQuery({
    queryKey: autogradeKeys.evaluationSettings(includePublic),
    queryFn: () =>
      evaluationSettingsRepo.list(includePublic) as Promise<
        Ret<R["evaluationSettingsRepo"]["list"]>
      >,
  });
}

/** Save an evaluation-settings preset (⚷ thresholds — invalidates evaluationSettings.all). */
export const useSaveEvaluationSettings = defineMutation<
  Arg0<R["evaluationSettingsRepo"]["save"]>,
  Ret<R["evaluationSettingsRepo"]["save"]>
>({
  callable: "v1.autograde.saveEvaluationSettings",
  run: (repos, vars) => autogradeRepos(repos).evaluationSettingsRepo.save(vars),
});

// ===========================================================================
// Grading dead-letter queue
// ===========================================================================

/** Paginated grading dead-letter queue (infinite query over `deadLetterRepo.list`). */
export function useDeadLetterEntries(
  filter?: Arg0<R["deadLetterRepo"]["list"]>
): UseInfiniteQueryResult<{ pages: CursorPage<unknown>[]; pageParams: unknown[] }, unknown> {
  const { repos } = useApi();
  const deadLetterRepo = autogradeRepos(repos).deadLetterRepo;
  return useInfiniteQuery({
    queryKey: autogradeKeys.deadLetterList(filter as object),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      deadLetterRepo.list({
        ...(filter as object),
        cursor: pageParam,
      } as Arg0<R["deadLetterRepo"]["list"]>) as Promise<CursorPage<unknown>>,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** Resolve a dead-letter entry (⚷ — invalidates dead-letter list + submission detail). */
export const useResolveDeadLetter = defineMutation<
  Arg0<R["deadLetterRepo"]["resolve"]>,
  Ret<R["deadLetterRepo"]["resolve"]>
>({
  callable: "v1.autograde.resolveDeadLetter",
  run: (repos, vars) => autogradeRepos(repos).deadLetterRepo.resolve(vars),
});

// ===========================================================================
// Read-only views (analytics + cross-entity grading dashboards)
// ===========================================================================

/** Read-only per-exam analytics projection (query over `examAnalyticsRepo.get`). */
export function useExamAnalytics(
  examId: string
): UseQueryResult<Ret<R["examAnalyticsRepo"]["get"]>, unknown> {
  const { repos } = useApi();
  const examAnalyticsRepo = autogradeRepos(repos).examAnalyticsRepo;
  return useQuery({
    queryKey: autogradeKeys.examAnalytics(examId),
    queryFn: () => examAnalyticsRepo.get(examId) as Promise<Ret<R["examAnalyticsRepo"]["get"]>>,
    enabled: Boolean(examId),
  });
}

/** ⊕ Cross-entity grading-review bundle for one submission (batched server read). */
export function useGradingReviewBundle(
  submissionId: string
): UseQueryResult<Ret<R["gradingReviewRepo"]["getReviewBundle"]>, unknown> {
  const { repos } = useApi();
  const gradingReviewRepo = autogradeRepos(repos).gradingReviewRepo;
  return useQuery({
    queryKey: autogradeKeys.gradingReviewBundle(submissionId),
    queryFn: () =>
      gradingReviewRepo.getReviewBundle({ submissionId }) as Promise<
        Ret<R["gradingReviewRepo"]["getReviewBundle"]>
      >,
    enabled: Boolean(submissionId),
  });
}

/** ⊕ Cross-entity per-exam grading overview dashboard (batched server read). */
export function useExamGradingOverview(
  examId: string
): UseQueryResult<Ret<R["gradingReviewRepo"]["getExamGradingOverview"]>, unknown> {
  const { repos } = useApi();
  const gradingReviewRepo = autogradeRepos(repos).gradingReviewRepo;
  return useQuery({
    queryKey: autogradeKeys.examGradingOverview(examId),
    queryFn: () =>
      gradingReviewRepo.getExamGradingOverview({ examId }) as Promise<
        Ret<R["gradingReviewRepo"]["getExamGradingOverview"]>
      >,
    enabled: Boolean(examId),
  });
}
