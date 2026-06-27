/**
 * @levelup/repositories — `testsession-progress` domain factory
 * (SDK-LAYERS-PLAN §4.1, §2.3, domain plan testsession-progress.md).
 *
 * The root `createRepositories(api)` assembly (src/index.ts) is owned by the
 * 'identity' agent; this domain exports `createTestSessionProgressRepos(api)` —
 * the plan-specified per-domain factory the root assembler folds in.
 *
 * Per-entity repos: testSessionRepo, progressRepo, learningInsightRepo,
 * evaluationRepo. The cross-domain `studentSummaryRepo` is a VIEW repo (under
 * src/views/**) returned alongside so the assembler can place it in the bag.
 *
 * Every repo imports `@levelup/api-client` (via the `ApiClient` view) +
 * `@levelup/domain` ONLY — never a sibling repo (R6).
 */
import type { ApiClient } from "./api-types.js";
import { createTestSessionRepo, type TestSessionRepo } from "./test-session.js";
import { createProgressRepo, type ProgressRepo } from "./progress.js";
import { createLearningInsightRepo, type LearningInsightRepo } from "./insight.js";
import { createEvaluationRepo, type EvaluationRepo } from "./evaluation.js";
import { createStudentSummaryRepo, type StudentSummaryRepo } from "../views/student-summary.js";

export interface TestSessionProgressRepos {
  testSessionRepo: TestSessionRepo;
  progressRepo: ProgressRepo;
  learningInsightRepo: LearningInsightRepo;
  evaluationRepo: EvaluationRepo;
  /** Cross-domain VIEW repo (src/views/**) — surfaced here for the dashboards. */
  studentSummaryRepo: StudentSummaryRepo;
}

export function createTestSessionProgressRepos(api: ApiClient): TestSessionProgressRepos {
  return {
    testSessionRepo: createTestSessionRepo(api),
    progressRepo: createProgressRepo(api),
    learningInsightRepo: createLearningInsightRepo(api),
    evaluationRepo: createEvaluationRepo(api),
    studentSummaryRepo: createStudentSummaryRepo(api),
  };
}

// Public re-exports (types + sub-factories) for the root assembler + apps.
export type {
  ApiClient,
  PageRequest,
  PageResponse,
  DigitalTestSessionView,
  DigitalTestSessionSummary,
  SpaceProgressView,
  StoryPointProgressDocView,
  ItemProgressView,
} from "./api-types.js";
export { createTestSessionRepo, type TestSessionRepo } from "./test-session.js";
export { createProgressRepo, type ProgressRepo } from "./progress.js";
export { createLearningInsightRepo, type LearningInsightRepo } from "./insight.js";
export { createEvaluationRepo, type EvaluationRepo } from "./evaluation.js";
export { createStudentSummaryRepo, type StudentSummaryRepo } from "../views/student-summary.js";
export { storyPointTypeToSessionType } from "./story-point-type.js";
export { paginate, listOnce, type PageBag, type Paged } from "./paginate.js";
export type { RuntimeQuestionView, SectionGroup } from "./test-session.js";
export type { StoryPointSummaryView } from "./progress.js";
export type { InsightsByPriority } from "./insight.js";
