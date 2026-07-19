/** Server-owned conversation feature, input, and mode policy. */
import type {
  ConversationMode,
  ConversationToolName,
  StartConversationContext,
} from "@levelup/domain";
import { fail } from "../shared/context.js";

/** Kept structural so services remain usable while contract barrels are rebuilt. */
export type ConversationTurnInput = {
  text: string;
  media?: Array<{ mediaKind: "image"; storagePath: string; mimeType: string; altText?: string }>;
  questionHelpDraft?: { revision: number; answer: unknown };
};

export const CONVERSATION_LIMITS = {
  maxInputTextChars: 4_000,
  maxDraftSnapshotBytes: 32 * 1024,
  maxMediaItems: 3,
  maxModelStepsPerTurn: 4,
  maxToolCallsPerTurn: 6,
  maxToolResultBytes: 8 * 1024,
  maxAllToolResultsBytes: 32 * 1024,
  toolTimeoutMs: 5_000,
  turnLeaseMs: 10 * 60_000,
  finalizationLeaseMs: 10 * 60_000,
  evaluationLeaseMs: 10 * 60_000,
  maxTurnAttempts: 3,
  maxEvaluationAttempts: 3,
  assessmentMinTurnsFloor: 1,
  assessmentMaxTurnsCeiling: 12,
  tutorMaxLearnerTurns: 24,
  questionHelpMaxLearnerTurns: 20,
} as const;

export function maxLearnerTurnsFor(mode: ConversationMode, assessmentMax?: number): number {
  if (mode === "tutor") return CONVERSATION_LIMITS.tutorMaxLearnerTurns;
  if (mode === "question_help") return CONVERSATION_LIMITS.questionHelpMaxLearnerTurns;
  return assessmentMax ?? CONVERSATION_LIMITS.assessmentMaxTurnsCeiling;
}

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export const MODE_POLICY: Record<
  ConversationMode,
  {
    feature: "conversationTutor" | "conversationQuestionHelp" | "conversationAssessment";
    promptKey: "conversationTutor" | "conversationQuestionHelp" | "conversationAssessment";
    promptVersion: string;
    toolsetId: string;
    toolsetVersion: string;
    toolNames: readonly ConversationToolName[];
    defaultModelPolicyId: "conversation.fast" | "conversation.quality";
  }
> = {
  tutor: {
    feature: "conversationTutor",
    promptKey: "conversationTutor",
    promptVersion: "conversationTutor:1",
    toolsetId: "conversation.tutor",
    toolsetVersion: "conversation.tutor:1",
    toolNames: [
      "retrieve_scope_context",
      "get_learner_visible_progress_summary",
      "recommend_learning_content",
    ],
    defaultModelPolicyId: "conversation.fast",
  },
  question_help: {
    feature: "conversationQuestionHelp",
    promptKey: "conversationQuestionHelp",
    promptVersion: "conversationQuestionHelp:1",
    toolsetId: "conversation.question_help",
    toolsetVersion: "conversation.question_help:1",
    toolNames: ["retrieve_scope_context", "retrieve_item_context", "record_hint_usage"],
    defaultModelPolicyId: "conversation.fast",
  },
  agent_assessment: {
    feature: "conversationAssessment",
    promptKey: "conversationAssessment",
    promptVersion: "conversationAssessment:1",
    toolsetId: "conversation.assessment",
    toolsetVersion: "conversation.assessment:1",
    toolNames: ["record_evidence", "recommend_completion"],
    defaultModelPolicyId: "conversation.quality",
  },
};

type TenantFeatures = {
  conversations?: unknown;
  conversationTutor?: unknown;
  conversationQuestionHelp?: unknown;
  conversationAssessment?: unknown;
};

/** Missing flags are intentionally disabled; rollout never has an implicit-on mode. */
export function isConversationModeEnabled(
  tenant: Record<string, unknown> | null,
  mode: ConversationMode
): boolean {
  const features = (tenant?.["features"] ?? {}) as TenantFeatures;
  return features.conversations === true && features[MODE_POLICY[mode].feature] === true;
}

export function assertConversationModeEnabled(
  tenant: Record<string, unknown> | null,
  mode: ConversationMode
): void {
  if (!isConversationModeEnabled(tenant, mode)) {
    fail("FEATURE_DISABLED", "This conversation mode is not enabled for this tenant");
  }
}

export function assertStartContextMode(
  mode: ConversationMode,
  context: StartConversationContext
): void {
  if (mode !== context.kind) fail("VALIDATION_ERROR", "mode must match context.kind");
}

export function assertConversationTurnInput(
  input: ConversationTurnInput,
  mode: ConversationMode,
  tenantId: string
): void {
  if (input.text.length > CONVERSATION_LIMITS.maxInputTextChars) {
    fail("VALIDATION_ERROR", "Conversation messages are limited to 4,000 characters");
  }
  if (input.media && input.media.length > CONVERSATION_LIMITS.maxMediaItems) {
    fail("VALIDATION_ERROR", "Too many conversation images");
  }
  for (const media of input.media ?? []) {
    if (media.mediaKind !== "image" || !IMAGE_MIME_TYPES.has(media.mimeType.toLowerCase())) {
      fail("VALIDATION_ERROR", "Only supported image attachments are accepted");
    }
    if (!media.storagePath.startsWith(`tenants/${tenantId}/`)) {
      fail("PERMISSION_DENIED", "Conversation media must be scoped to the active tenant");
    }
  }
  if (input.questionHelpDraft !== undefined) {
    if (mode !== "question_help") {
      fail("VALIDATION_ERROR", "questionHelpDraft is only allowed for question-help conversations");
    }
    const bytes = Buffer.byteLength(JSON.stringify(input.questionHelpDraft), "utf8");
    if (bytes > CONVERSATION_LIMITS.maxDraftSnapshotBytes) {
      fail("VALIDATION_ERROR", "Question-help draft snapshot is too large");
    }
  }
}

export function isConversationToolAllowed(
  mode: ConversationMode,
  toolName: string
): toolName is ConversationToolName {
  return (MODE_POLICY[mode].toolNames as readonly string[]).includes(toolName);
}
