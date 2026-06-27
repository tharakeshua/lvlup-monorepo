/**
 * autograde query-key helpers (domain plan sdk-plan/domains/autograde.md §Query hooks).
 *
 * Thin, domain-shaped facade over the shared `@levelup/query` key factories
 * (`examKeys`/`questionKeys`/`submissionKeys`/… from the registry). The factories
 * own the hierarchical `[domain, kind, …]` convention; these helpers name the
 * exact sub-keys this domain reads/writes so the hooks AND the invalidation
 * targets reference ONE place:
 *
 *   exam list/detail        → examKeys.infinite(filter) / examKeys.detail(examId)
 *   exam questions          → questionKeys.list({ examId })
 *   submissions list/detail → submissionKeys.infinite(filter) / submissionKeys.detail(id)
 *   question submissions    → questionSubmissionKeys.list({ submissionId })
 *   evaluation settings     → evaluationSettingsKeys.list({ includePublic })
 *   dead-letter queue       → deadLetterKeys.infinite(filter)
 *   exam analytics          → examAnalyticsKeys.detail(examId)
 *   grading review bundle   → gradingReviewKeys.detail(submissionId)
 *   exam grading overview   → gradingReviewKeys.sub(examId, 'overview')
 */
import {
  deadLetterKeys,
  evaluationSettingsKeys,
  examAnalyticsKeys,
  examKeys,
  gradingReviewKeys,
  questionKeys,
  questionSubmissionKeys,
  submissionKeys,
} from "../keys/registry.js";

const str = (v: unknown): string => (typeof v === "string" ? v : String(v ?? ""));

export const autogradeKeys = {
  /** Paginated exam list (infinite). */
  examList: (filter?: object) => examKeys.infinite(filter ?? {}),
  /** One exam detail. */
  exam: (examId: string) => examKeys.detail(str(examId)),

  /** An exam's extracted questions. */
  examQuestions: (examId: string) => questionKeys.list({ examId: str(examId) }),

  /** Paginated submissions list (infinite, scoped by examId via filter). */
  submissionList: (filter?: object) => submissionKeys.infinite(filter ?? {}),
  /** One submission detail. */
  submission: (submissionId: string) => submissionKeys.detail(str(submissionId)),

  /** A submission's per-question grading results. */
  questionSubmissions: (submissionId: string) =>
    questionSubmissionKeys.list({ submissionId: str(submissionId) }),

  /** Evaluation-settings presets list. */
  evaluationSettings: (includePublic?: boolean) =>
    evaluationSettingsKeys.list({ includePublic: includePublic ?? false }),

  /** Paginated grading dead-letter queue (infinite). */
  deadLetterList: (filter?: object) => deadLetterKeys.infinite(filter ?? {}),

  /** Read-only per-exam analytics projection. */
  examAnalytics: (examId: string) => examAnalyticsKeys.detail(str(examId)),

  /** Cross-entity grading-review bundle (one submission). */
  gradingReviewBundle: (submissionId: string) => gradingReviewKeys.detail(str(submissionId)),
  /** Cross-entity per-exam grading overview dashboard. */
  examGradingOverview: (examId: string) => gradingReviewKeys.sub(str(examId), "overview"),
} as const;

export {
  deadLetterKeys,
  evaluationSettingsKeys,
  examAnalyticsKeys,
  examKeys,
  gradingReviewKeys,
  questionKeys,
  questionSubmissionKeys,
  submissionKeys,
};
