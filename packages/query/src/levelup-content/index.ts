/**
 * `levelup-content` domain hooks barrel (domains/levelup-content.md "Query hooks").
 *
 * The CONTENT slice of the domain (spaces · story points · items · agents ·
 * question bank · rubric presets · store/reviews · chat · versions · the
 * space-detail view), authored ON TOP of the `@levelup/query` infrastructure
 * (provider/keys/invalidation/mutation/realtime). Re-exported from the package
 * barrel so apps import from `@levelup/query`. (Learning progress + test sessions
 * are the sibling `testsession-progress` domain.)
 */

// ── read hooks ────────────────────────────────────────────────────────────────
export {
  useSpaces,
  useSpace,
  useSpaceDetailView,
  useStoryPoints,
  useItems,
  useItemForEdit,
  useVersions,
  useQuestionBank,
  useRubricPresets,
  useAgents,
  useStoreSpaces,
  useStoreSpace,
  useSpaceReviews,
  useChatSessions,
  useChatSession,
} from "./queries.js";

// ── mutation hooks ────────────────────────────────────────────────────────────
export {
  useSaveSpace,
  useSaveStoryPoint,
  useSaveItem,
  useImportFromBank,
  useSaveAgent,
  useSaveRubricPreset,
  useSaveQuestionBankItem,
  useSendChatMessage,
  useSaveSpaceReview,
  usePurchaseSpace,
  useGenerateContent,
} from "./mutations.js";

// ── duplicate hook ────────────────────────────────────────────────────────────
export { useDuplicateSpace } from "./duplicate.js";

// ── subscription hooks ────────────────────────────────────────────────────────
export { useChatStream, useServerTime, type ServerTime } from "./subscriptions.js";

// ── question form helpers (pure TS, RN-safe) ─────────────────────────────────
export {
  QUESTION_TYPES,
  initialQuestionPayload,
  validateQuestionPayload,
  // MCQ / MCAQ option ops
  qfAddOption,
  qfRemoveOption,
  qfUpdateOption,
  qfMoveOptionUp,
  qfMoveOptionDown,
  // fill-blanks ops
  qfAddBlank,
  qfRemoveBlank,
  qfUpdateBlank,
  // fill-blanks-dd ops
  qfAddBlankDd,
  qfRemoveBlankDd,
  qfAddPoolOption,
  qfRemovePoolOption,
  qfUpdatePoolOption,
  // matching ops
  qfAddPair,
  qfRemovePair,
  qfUpdatePair,
  qfMovePairUp,
  qfMovePairDown,
  // jumbled ops
  qfAddToken,
  qfRemoveToken,
  qfUpdateToken,
  qfMoveTokenUp,
  qfMoveTokenDown,
  // group-options ops
  qfAddGroup,
  qfRemoveGroup,
  qfRenameGroup,
  qfAddGroupItem,
  qfRemoveGroupItem,
  qfUpdateGroupItem,
  // code test case ops
  qfAddTestCase,
  qfRemoveTestCase,
  qfUpdateTestCase,
} from "./question-forms.js";
export type { QuestionType, QuestionFormError } from "./question-forms.js";
