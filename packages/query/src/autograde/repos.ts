/**
 * Typed accessor for the autograde repos off the shared `Repositories` bag
 * (domain plan §Repositories).
 *
 * The root `createRepositories(api)` bag folds every domain factory into one flat
 * record. This module re-uses the REAL `AutogradeRepos` type exported by
 * `@levelup/repositories` (no re-stated seam — the type is already public), and
 * narrows the open bag to that slice with one cast, here. NO `firebase`/transport
 * import; repos are injected (query-infra.md §2).
 */
import type { AutogradeRepos } from "@levelup/repositories";

/** The autograde slice of the repo bag the hooks reach for. */
export type AutogradeReposSlice = AutogradeRepos;

/** Narrow the open repo bag to the autograde seams (one cast, here). */
export function autogradeRepos(repos: unknown): AutogradeReposSlice {
  return repos as AutogradeReposSlice;
}

export type {
  ExamRepo,
  ExamQuestionRepo,
  SubmissionRepo,
  QuestionSubmissionRepo,
  EvaluationSettingsRepo,
  DeadLetterRepo,
  ExamAnalyticsRepo,
  GradingReviewRepo,
} from "@levelup/repositories";
