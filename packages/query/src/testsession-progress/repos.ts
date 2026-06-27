/**
 * Typed accessor for the testsession-progress repos off the shared
 * `Repositories` bag (domain plan §Repositories).
 *
 * The root `createRepositories(api)` bag folds every domain factory into one flat
 * record; this domain's repos (`testSessionRepo`/`progressRepo`/
 * `learningInsightRepo`/`studentSummaryRepo`) are reached through the bag's open
 * `Record<string, Repo>` tail until the typecheck/fix wave widens the bag's named
 * type. This module re-states the repo seams (structurally compatible with
 * `@levelup/repositories`' exports) so the hooks call them with full typing —
 * NO `firebase`/transport import, repos are injected (query-infra.md §2).
 */
import type {
  AttemptRecord,
  ClassProgressSummary,
  InsightId,
  ItemId,
  LearningInsight,
  SpaceId,
  StoredEvaluation,
  StoryPointId,
  StudentProgressSummary,
  TestSessionId,
  UserId,
} from "@levelup/domain";

/** Contract `pageResponse(item)` envelope (read-only here). */
export interface PageResponse<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
}
export interface PageRequest {
  cursor?: string;
  limit?: number;
}

// ── request/response shapes (mirror the repo public surface) ────────────────

export interface StartTestSessionInput {
  spaceId: SpaceId;
  storyPointId: StoryPointId;
}
export interface SubmitTestSessionInput {
  sessionId: TestSessionId;
  autoSubmitted?: boolean;
}
export interface EvaluateAnswerInput {
  spaceId: SpaceId;
  storyPointId?: StoryPointId;
  itemId: ItemId;
  answer: unknown;
  mediaUrls?: string[];
}
export interface RecordItemAttemptInput {
  spaceId: SpaceId;
  storyPointId: StoryPointId;
  itemId: ItemId;
  answer: unknown;
  timeSpent?: number;
}
export interface ListTestSessionsFilter extends PageRequest {
  spaceId?: SpaceId;
  storyPointId?: StoryPointId;
  userId?: UserId;
  status?: string;
  latestOnly?: boolean;
}
export interface ListLearningInsightsFilter extends PageRequest {
  studentId?: UserId;
  type?: string;
  includeDismissed?: boolean;
}

export interface StartTestSessionResult {
  session: unknown;
}
export interface SubmitTestSessionResult {
  session: unknown;
  progressUpdated: boolean;
}
export interface EvaluateAnswerResult {
  evaluation: StoredEvaluation;
  progressRecorded: boolean;
}
/** recordItemAttempt — the AUTHORITATIVE `{progress, completed}` (A11/CD13). */
export interface RecordItemAttemptResult {
  progress: { itemId: ItemId; [k: string]: unknown };
  completed: boolean;
}
export interface DismissInsightResult {
  id: InsightId;
  dismissed: true;
}
export interface GetChildSummaryResult {
  studentSummary: StudentProgressSummary;
  recentInsights: LearningInsight[];
}
export interface GetClassSummaryResult {
  classSummary: ClassProgressSummary;
  members: StudentProgressSummary[];
}

/** Structural seam of `testSessionRepo` (the methods the hooks use). */
export interface TestSessionRepoSeam {
  recordStart(input: StartTestSessionInput): Promise<StartTestSessionResult>;
  recordSubmit(input: SubmitTestSessionInput): Promise<SubmitTestSessionResult>;
  recordEvaluation(input: EvaluateAnswerInput): Promise<EvaluateAnswerResult>;
  get(id: TestSessionId): Promise<unknown>;
  list(filter: ListTestSessionsFilter): Promise<PageResponse<unknown>>;
}

/** Structural seam of `progressRepo`. */
export interface ProgressRepoSeam {
  getSpace(spaceId: SpaceId, userId?: UserId): Promise<unknown | null>;
  getStoryPoint(
    spaceId: SpaceId,
    storyPointId: StoryPointId,
    userId?: UserId
  ): Promise<unknown | null>;
  recordAttempt(input: RecordItemAttemptInput): Promise<RecordItemAttemptResult>;
  computeAttemptHistory(itemProgress: { attempts?: AttemptRecord[] }): AttemptRecord[];
}

/** Structural seam of `learningInsightRepo`. */
export interface LearningInsightRepoSeam {
  list(filter: ListLearningInsightsFilter): Promise<PageResponse<LearningInsight>>;
  recordDismissal(insightId: InsightId): Promise<DismissInsightResult>;
}

/** Structural seam of the cross-domain `studentSummaryRepo` view. */
export interface StudentSummaryRepoSeam {
  get(studentId: UserId): Promise<GetChildSummaryResult>;
  getMany(studentIds: readonly UserId[]): Promise<StudentProgressSummary[]>;
  getClassView(classId: string): Promise<GetClassSummaryResult>;
}

/** The slice of the repo bag this domain reaches for. */
export interface TestSessionProgressRepos {
  testSessionRepo: TestSessionRepoSeam;
  progressRepo: ProgressRepoSeam;
  learningInsightRepo: LearningInsightRepoSeam;
  studentSummaryRepo: StudentSummaryRepoSeam;
}

/** Narrow the open repo bag to this domain's seams (one cast, here). */
export function testSessionProgressRepos(repos: unknown): TestSessionProgressRepos {
  return repos as TestSessionProgressRepos;
}
