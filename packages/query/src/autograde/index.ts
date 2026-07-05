/**
 * `autograde` domain barrel (@levelup/query).
 *
 * Exams · exam-questions · answer-sheet submissions · the two-stage AI grading
 * pipeline · per-question grading · evaluation settings · the grading dead-letter
 * queue · exam analytics (read) · the cross-entity grading-review dashboards.
 *
 * NONE of autograde's mutations are optimistic — grading/publish/release/upload
 * are all authority-sensitive (⚷), so every mutation round-trips and invalidates
 * through `INVALIDATION_GRAPH` (spec §5.5).
 */
export {
  // exams
  useExams,
  useExam,
  useSaveExam,
  useExtractQuestions,
  useReleaseResults,
  // exam questions
  useExamQuestions,
  useReExtractQuestion,
  // submissions
  useSubmissions,
  useSubmission,
  useUploadAnswerSheets,
  // storage seam (signed-PUT upload)
  useUploadImage,
  // question submissions (grading)
  useQuestionSubmissions,
  useGradeManual,
  useRetryGrading,
  useAiGradeQuestion,
  // evaluation settings
  useEvaluationSettings,
  useSaveEvaluationSettings,
  // dead-letter queue
  useDeadLetterEntries,
  useResolveDeadLetter,
  // read-only views
  useExamAnalytics,
  useGradingReviewBundle,
  useExamGradingOverview,
} from "./hooks.js";

export { useGradingStatus, useExamGradingProgress } from "./realtime.js";

export { autogradeKeys } from "./keys.js";
export { autogradeRepos, type AutogradeReposSlice } from "./repos.js";
