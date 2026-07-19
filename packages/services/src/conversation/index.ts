/**
 * Server-authoritative conversational runtime.
 *
 * Finalization/evaluation exports (T-E) are surfaced here now that the durable
 * finish + recovery implementation has landed, so callable/scheduler wiring can
 * consume the explicit public entry points.
 */
export { startConversationService } from "./start.js";
export { sendConversationTurnService } from "./turn.js";
export { getConversationService, listConversationsService } from "./reads.js";
export { abandonConversationService } from "./abandon.js";

// Durable finalization (T-E). `finishConversationService` is the learner-facing
// callable; `resumeConversationFinalizationsService` is the tenant-scoped repair
// worker wired to the five-minute recovery schedule (LLD §13.2).
export {
  finishConversationService,
  continueConversationFinalization,
  type ConversationFinalizationSource,
  type ContinueConversationFinalizationInput,
  type ConversationFinalizationState,
} from "./finalize.js";
export {
  resumeConversationFinalizationsService,
  type ResumeConversationFinalizationsOptions,
  type ResumeConversationFinalizationsReport,
} from "./recovery.js";

export {
  conversationSessionId,
  conversationTurnId,
  learnerMessageId,
  assistantMessageId,
  openingMessageId,
  conversationEvidenceId,
  itemSubmissionId,
  canonicalJson,
  canonicalHash,
  contextBaseKey,
  contextKey,
} from "./ids.js";
export { CONVERSATION_LIMITS, MODE_POLICY } from "./policy.js";
export { buildConversationStartPlan, buildConversationTurnMessages } from "./context-builder.js";
export {
  projectConversationMessage,
  projectConversationSession,
  projectConversationSummary,
  projectConversationTurn,
} from "./projections.js";
export * from "./state-machine.js";
export * from "./tools/index.js";
