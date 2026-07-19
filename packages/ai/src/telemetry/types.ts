import type { AiPurpose, PromptKey } from "../prompts/registry.js";

export type LlmRequestStatus =
  | "reserved"
  | "running"
  | "succeeded"
  | "failed"
  | "rejected_quota"
  | "rejected_moderation"
  | "circuit_open"
  | "cancelled";

export type LlmAttemptStatus = "success" | "error" | "timeout" | "cancelled";

export type LlmFeature =
  | "autograde.question_paper"
  | "autograde.answer_sheet"
  | "levelup.practice"
  | "levelup.timed_test"
  | "levelup.tutor"
  | "levelup.question_help"
  | "levelup.agent_question"
  | "levelup.authoring"
  | "analytics.insights"
  | "other";

export type LlmCanonicalPurpose =
  | "question_extraction"
  | "rubric_generation"
  | "answer_mapping"
  | "answer_grading"
  | "answer_evaluation"
  | "tutor_chat"
  | "agent_chat"
  | "conversation_summarization"
  | "learning_insight_extraction"
  | "content_generation"
  | "analytics_insight_generation"
  | "other";

export interface LlmRelatedResources {
  examId?: string;
  submissionId?: string;
  questionId?: string;
  spaceId?: string;
  storyPointId?: string;
  itemId?: string;
  chatSessionId?: string;
  testSessionId?: string;
  attemptId?: string;
}

/**
 * Server-derived attribution for a logical AI request. Call sites may omit the
 * optional identities only when the authoritative workflow cannot resolve them.
 */
export interface LlmUsageContext {
  actorUserId: string;
  actorRole: string;
  initiatedByUserId?: string;
  subjectUserId?: string;
  billingUserId?: string;
  initiatorRole?: string;
  rootRequestId?: string;
  parentRequestId?: string;
  traceId?: string;
  agentId?: string;
  related?: LlmRelatedResources;
}

export interface CanonicalTokenUsage {
  input: number;
  output: number;
  cachedInput?: number;
  reasoning?: number;
  tool?: number;
  image?: number;
  total: number;
  source: "provider" | "estimated" | "unavailable";
}

export interface LlmAttemptCost {
  inputUsd: number;
  outputUsd: number;
  cachedInputUsd?: number;
  otherUsd?: number;
  estimatedTotalUsd: number;
  reconciledTotalUsd?: number;
  currency: "USD";
  pricingVersion: string;
  pricingFallback?: boolean;
}

export interface SanitizedLlmError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface LlmRequestRecord {
  schemaVersion: 2;
  requestId: string;
  rootRequestId: string;
  parentRequestId?: string;
  traceId: string;
  tenantId: string;
  actorUserId: string;
  initiatedByUserId?: string;
  subjectUserId?: string;
  billingUserId?: string;
  actorRole: string;
  initiatorRole?: string;
  purpose: LlmCanonicalPurpose;
  feature: LlmFeature;
  operation: string;
  promptKey: PromptKey;
  promptVersion: string;
  agentId?: string;
  resourceType: string;
  resourceId: string;
  related: LlmRelatedResources;
  provider: string;
  requestedModel: string;
  credentialOwner: "platform" | "tenant" | "user";
  status: "reserved";
  pricingVersion: string;
  createdAt: string;
}

export interface LlmAttemptRecord extends Omit<
  LlmRequestRecord,
  "status" | "requestedModel" | "credentialOwner" | "pricingVersion" | "createdAt"
> {
  attemptId: string;
  attemptNumber: number;
  model: string;
  providerRequestId?: string;
  status: LlmAttemptStatus;
  retryable: boolean;
  tokens: CanonicalTokenUsage;
  cost: LlmAttemptCost;
  providerUsage?: Record<string, number>;
  providerLatencyMs: number;
  totalAttemptMs: number;
  error?: SanitizedLlmError;
  createdAt: string;
  completedAt: string;
}

export interface LlmRequestFinalization {
  requestId: string;
  status: Exclude<LlmRequestStatus, "reserved" | "running">;
  resolvedModel?: string;
  attemptCount: number;
  successfulAttemptId?: string;
  tokens: CanonicalTokenUsage;
  estimatedCostUsd: number;
  pricingVersion: string;
  latencyMs: number;
  error?: SanitizedLlmError;
  completedAt: string;
}

/**
 * Persistence port owned by the gateway. Implementations must store metadata
 * only: prompts, completions, student answers, and media never cross this seam.
 */
export interface LlmTelemetrySink {
  createRequest(record: LlmRequestRecord): Promise<void>;
  recordAttempt(record: LlmAttemptRecord): Promise<void>;
  finalizeRequest(record: LlmRequestFinalization): Promise<void>;
}

export interface LlmTelemetryWriteError {
  stage: "create_request" | "record_attempt" | "finalize_request" | "legacy_log";
  requestId: string;
  attemptId?: string;
  error: unknown;
}

export function canonicalPurpose(purpose: AiPurpose, promptKey: PromptKey): LlmCanonicalPurpose {
  if (promptKey === "examRubricGeneration") return "rubric_generation";
  if (promptKey === "unifiedEvaluation") return "answer_evaluation";
  if (promptKey === "agentChat") return "agent_chat";
  if (promptKey === "conversationAssessment") return "agent_chat";
  if (purpose === "ai_chat") return "tutor_chat";
  if (purpose === "content_draft") return "content_generation";
  if (purpose === "insights") return "analytics_insight_generation";
  return purpose;
}

export function defaultFeature(promptKey: PromptKey): LlmFeature {
  if (
    promptKey === "questionExtraction" ||
    promptKey === "examQuestionExtraction" ||
    promptKey === "examRubricGeneration"
  ) {
    return "autograde.question_paper";
  }
  if (promptKey === "answerMapping" || promptKey === "answerGrading") {
    return "autograde.answer_sheet";
  }
  if (promptKey === "agentChat") return "levelup.agent_question";
  if (promptKey === "aiChat") return "levelup.tutor";
  if (promptKey === "conversationTutor") return "levelup.tutor";
  if (promptKey === "conversationQuestionHelp") return "levelup.question_help";
  if (promptKey === "conversationAssessment") return "levelup.agent_question";
  if (promptKey === "contentDraft") return "levelup.authoring";
  if (promptKey === "insights") return "analytics.insights";
  return "levelup.practice";
}
