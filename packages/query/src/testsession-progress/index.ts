/**
 * `@levelup/query` — testsession-progress domain public surface.
 *
 * Per-domain hooks authored ON TOP of the query infrastructure (key factories +
 * `defineMutation` + the realtime seam), per SDK-LAYERS-PLAN §4.2/§4.3/§4.4 and
 * the testsession-progress domain plan §Query hooks.
 */
export {
  // reads
  useSpaceProgress,
  useStoryPointProgress,
  useTestSession,
  useTestSessions,
  useLearningInsights,
  useStudentSummary,
  // round-trip mutations (NOT optimistic — lifecycle/grading authority)
  useStartTestSession,
  useSubmitTestSession,
  useEvaluateAnswer,
  // the TWO ✅ optimistic surfaces
  useRecordItemAttempt,
  makeRecordItemAttemptMutation,
  useDismissInsight,
  // realtime
  useTestSessionDeadline,
} from "./hooks.js";

export { testSessionProgressKeys } from "./keys.js";
export {
  testSessionProgressRepos,
  type TestSessionProgressRepos,
  type StartTestSessionInput,
  type SubmitTestSessionInput,
  type EvaluateAnswerInput,
  type RecordItemAttemptInput,
  type ListTestSessionsFilter,
  type ListLearningInsightsFilter,
} from "./repos.js";
