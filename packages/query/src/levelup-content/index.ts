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
} from "./mutations.js";

// ── subscription hooks ────────────────────────────────────────────────────────
export { useChatStream, useServerTime, type ServerTime } from "./subscriptions.js";
