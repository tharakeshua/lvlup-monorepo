/**
 * @levelup/api-contract — levelup (content + testsession) callable barrel.
 *
 * Exports the named record `LEVELUP_CONTENT_CALLABLES` that the api-contract CORE
 * agent spreads into the flat `CALLABLES` registry. Each def lives in its own file
 * (schema + type colocated). Sibling agents own the gamification / insights folds
 * under the same `v1.levelup.*` namespace; those are spread separately by core.
 *
 * No request schema here declares `tenantId` (claim-derived). `idempotencyKey` is
 * absent from every request schema except the documented `recordItemAttempt`
 * carve-out (SDK-LAYERS §3.2).
 */

// ── writes / mutations ────────────────────────────────────────────────────
export * from "./save-space.js";
export * from "./duplicate-space.js";
export * from "./save-story-point.js";
export * from "./save-item.js";
export * from "./import-from-bank.js";
export * from "./save-agent.js";
export * from "./save-rubric-preset.js";
export * from "./save-question-bank-item.js";
export * from "./start-test-session.js";
export * from "./submit-test-session.js";
export * from "./save-test-answer.js";
export * from "./evaluate-answer.js";
export * from "./record-item-attempt.js";
export * from "./send-chat-message.js";
export * from "./save-space-review.js";
export * from "./purchase-space.js";
export * from "./assign-content.js";
export * from "./generate-content.js";
export * from "./start-conversation.js";
export * from "./send-conversation-turn.js";
export * from "./finish-conversation.js";
export * from "./abandon-conversation.js";

// ── reads ─────────────────────────────────────────────────────────────────
export * from "./list-spaces.js";
export * from "./get-space.js";
export * from "./get-evaluation-config.js";
export * from "./list-story-points.js";
export * from "./get-story-point.js";
export * from "./list-items.js";
export * from "./get-item-for-edit.js";
export * from "./list-versions.js";
export * from "./list-question-bank.js";
export * from "./list-rubric-presets.js";
export * from "./list-agents.js";
export * from "./list-chat-sessions.js";
export * from "./get-chat-session.js";
export * from "./list-space-reviews.js";
export * from "./list-store-spaces.js";
export * from "./get-store-space.js";
export * from "./get-space-progress.js";
export * from "./get-story-point-progress.js";
export * from "./list-space-progress-for-user.js";
export * from "./get-test-session.js";
export * from "./list-test-sessions.js";
export * from "./get-conversation.js";
export * from "./list-conversations.js";

// ── shared view/response fragments ────────────────────────────────────────
export * from "./_shared.js";
export * from "./_conversation-shared.js";

import type { CallableDef } from "../../callable-def.js";

import { saveSpaceDef } from "./save-space.js";
import { duplicateSpaceDef } from "./duplicate-space.js";
import { saveStoryPointDef } from "./save-story-point.js";
import { saveItemDef } from "./save-item.js";
import { importFromBankDef } from "./import-from-bank.js";
import { saveAgentDef } from "./save-agent.js";
import { saveRubricPresetDef } from "./save-rubric-preset.js";
import { saveQuestionBankItemDef } from "./save-question-bank-item.js";
import { startTestSessionDef } from "./start-test-session.js";
import { submitTestSessionDef } from "./submit-test-session.js";
import { saveTestAnswerDef } from "./save-test-answer.js";
import { evaluateAnswerDef } from "./evaluate-answer.js";
import { recordItemAttemptDef } from "./record-item-attempt.js";
import { sendChatMessageDef } from "./send-chat-message.js";
import { saveSpaceReviewDef } from "./save-space-review.js";
import { purchaseSpaceDef } from "./purchase-space.js";
import { assignContentDef } from "./assign-content.js";
import { generateContentDef } from "./generate-content.js";
import { startConversationDef } from "./start-conversation.js";
import { sendConversationTurnDef } from "./send-conversation-turn.js";
import { finishConversationDef } from "./finish-conversation.js";
import { abandonConversationDef } from "./abandon-conversation.js";
import { listSpacesDef } from "./list-spaces.js";
import { getSpaceDef } from "./get-space.js";
import { getEvaluationConfigDef } from "./get-evaluation-config.js";
import { listStoryPointsDef } from "./list-story-points.js";
import { getStoryPointDef } from "./get-story-point.js";
import { listItemsDef } from "./list-items.js";
import { getItemForEditDef } from "./get-item-for-edit.js";
import { listVersionsDef } from "./list-versions.js";
import { listQuestionBankDef } from "./list-question-bank.js";
import { listRubricPresetsDef } from "./list-rubric-presets.js";
import { listAgentsDef } from "./list-agents.js";
import { listChatSessionsDef } from "./list-chat-sessions.js";
import { getChatSessionDef } from "./get-chat-session.js";
import { listSpaceReviewsDef } from "./list-space-reviews.js";
import { listStoreSpacesDef } from "./list-store-spaces.js";
import { getStoreSpaceDef } from "./get-store-space.js";
import { getSpaceProgressDef } from "./get-space-progress.js";
import { getStoryPointProgressDef } from "./get-story-point-progress.js";
import { listSpaceProgressForUserDef } from "./list-space-progress-for-user.js";
import { getTestSessionDef } from "./get-test-session.js";
import { listTestSessionsDef } from "./list-test-sessions.js";
import { getConversationDef } from "./get-conversation.js";
import { listConversationsDef } from "./list-conversations.js";

/**
 * The named record of levelup CONTENT + TESTSESSION CallableDefs (this agent's
 * scope). The gamification / insights `v1.levelup.*` name-segment defs are authored
 * by a sibling agent under the same folder; the `callables/core` aggregator merges
 * both into `levelupCallables` before the CORE registry spreads it into `CALLABLES`.
 *
 * Keyed by the versioned callable name (`def.name` MUST equal its key — asserted by
 * `registry-integrity` / `registry-completeness`).
 */
export const LEVELUP_CONTENT_CALLABLES = {
  "v1.levelup.saveSpace": saveSpaceDef,
  "v1.levelup.duplicateSpace": duplicateSpaceDef,
  "v1.levelup.saveStoryPoint": saveStoryPointDef,
  "v1.levelup.saveItem": saveItemDef,
  "v1.levelup.importFromBank": importFromBankDef,
  "v1.levelup.saveAgent": saveAgentDef,
  "v1.levelup.saveRubricPreset": saveRubricPresetDef,
  "v1.levelup.saveQuestionBankItem": saveQuestionBankItemDef,
  "v1.levelup.startTestSession": startTestSessionDef,
  "v1.levelup.submitTestSession": submitTestSessionDef,
  "v1.levelup.saveTestAnswer": saveTestAnswerDef,
  "v1.levelup.evaluateAnswer": evaluateAnswerDef,
  "v1.levelup.recordItemAttempt": recordItemAttemptDef,
  "v1.levelup.sendChatMessage": sendChatMessageDef,
  "v1.levelup.saveSpaceReview": saveSpaceReviewDef,
  "v1.levelup.purchaseSpace": purchaseSpaceDef,
  "v1.levelup.assignContent": assignContentDef,
  "v1.levelup.generateContent": generateContentDef,
  "v1.levelup.startConversation": startConversationDef,
  "v1.levelup.sendConversationTurn": sendConversationTurnDef,
  "v1.levelup.finishConversation": finishConversationDef,
  "v1.levelup.abandonConversation": abandonConversationDef,
  "v1.levelup.listSpaces": listSpacesDef,
  "v1.levelup.getSpace": getSpaceDef,
  "v1.levelup.getEvaluationConfig": getEvaluationConfigDef,
  "v1.levelup.listStoryPoints": listStoryPointsDef,
  "v1.levelup.getStoryPoint": getStoryPointDef,
  "v1.levelup.listItems": listItemsDef,
  "v1.levelup.getItemForEdit": getItemForEditDef,
  "v1.levelup.listVersions": listVersionsDef,
  "v1.levelup.listQuestionBank": listQuestionBankDef,
  "v1.levelup.listRubricPresets": listRubricPresetsDef,
  "v1.levelup.listAgents": listAgentsDef,
  "v1.levelup.listChatSessions": listChatSessionsDef,
  "v1.levelup.getChatSession": getChatSessionDef,
  "v1.levelup.listSpaceReviews": listSpaceReviewsDef,
  "v1.levelup.listStoreSpaces": listStoreSpacesDef,
  "v1.levelup.getStoreSpace": getStoreSpaceDef,
  "v1.levelup.getSpaceProgress": getSpaceProgressDef,
  "v1.levelup.getStoryPointProgress": getStoryPointProgressDef,
  "v1.levelup.listSpaceProgressForUser": listSpaceProgressForUserDef,
  "v1.levelup.getTestSession": getTestSessionDef,
  "v1.levelup.listTestSessions": listTestSessionsDef,
  "v1.levelup.getConversation": getConversationDef,
  "v1.levelup.listConversations": listConversationsDef,
} as const satisfies Record<string, CallableDef>;

/** The fully-qualified `v1.levelup.*` content/testsession names this agent defines. */
export const LEVELUP_CONTENT_CALLABLE_NAMES = Object.values(LEVELUP_CONTENT_CALLABLES).map(
  (d) => d.name
) as readonly string[];
