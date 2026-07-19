/**
 * Canonical conversational-AI domain contracts.
 *
 * These are the durable callable-only documents and the separately allowlisted
 * learner projections used by the conversation runtime. Legacy `chat.ts` remains
 * a compatibility surface; it is intentionally not reused for new sessions.
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import {
  zConversationEvidenceId,
  zConversationMessageId,
  zConversationSessionId,
  zConversationTurnId,
  zItemId,
  zItemSubmissionId,
  zSpaceId,
  zStoryPointId,
  zStudentId,
  zTenantId,
  zUserId,
} from "../../primitives/branded-id.zod.js";
import { zJsonValue } from "../../primitives/json.zod.js";
import { zTimestamp } from "../../primitives/timestamp.zod.js";
import { StoredEvaluationSchema } from "../content/stored-evaluation.js";
import { UnifiedEvaluationResultSchema } from "../content/evaluation-result.js";
import {
  AgentAssessmentAnswerKeyDataSchema,
  AgentAssessmentLearnerAnswerSchema,
  AgentAssessmentPrivateObjectiveSchema,
  AgentAssessmentQuestionPromptSchema,
  ConversationCompletionPolicySchema,
  ConversationPublicLearningObjectiveSchema,
} from "./conversation-assessment.js";

export {
  AgentAssessmentAnswerKeyDataSchema,
  AgentAssessmentLearnerAnswerSchema,
  AgentAssessmentPrivateObjectiveSchema,
  AgentAssessmentQuestionPromptSchema,
  ConversationCompletionPolicySchema,
  ConversationPublicLearningObjectiveSchema,
};
export type {
  AgentAssessmentAnswerKeyData,
  AgentAssessmentLearnerAnswer,
  AgentAssessmentPrivateObjective,
  AgentAssessmentQuestionPrompt,
  ConversationCompletionPolicy,
  ConversationPublicLearningObjective,
} from "./conversation-assessment.js";

// ── Fixed vocabularies ────────────────────────────────────────────────────

export const CONVERSATION_MODES = ["tutor", "question_help", "agent_assessment"] as const;
export const zConversationMode = z.enum(CONVERSATION_MODES);
export type ConversationMode = z.infer<typeof zConversationMode>;

export const CONVERSATION_SESSION_STATUSES = [
  "active",
  "ready_to_finish",
  "finalizing",
  "grading_pending",
  "grading_failed",
  "completed",
  "abandoned",
] as const;
export const zConversationSessionStatus = z.enum(CONVERSATION_SESSION_STATUSES);
export type ConversationSessionStatus = z.infer<typeof zConversationSessionStatus>;

export const CONVERSATION_TURN_STATUSES = [
  "claimed",
  "model_running",
  "tool_running",
  "completed",
  "failed_recoverable",
  "failed_terminal",
] as const;
export const zConversationTurnStatus = z.enum(CONVERSATION_TURN_STATUSES);
export type ConversationTurnStatus = z.infer<typeof zConversationTurnStatus>;

export const SUBMISSION_WORKFLOW_STATUSES = [
  "frozen",
  "grading_pending",
  "grading",
  "grading_failed",
  "evaluated",
  "progress_applied",
] as const;
export const zSubmissionWorkflowStatus = z.enum(SUBMISSION_WORKFLOW_STATUSES);
export type SubmissionWorkflowStatus = z.infer<typeof zSubmissionWorkflowStatus>;

/** Stable gateway policy IDs — never persist provider-specific model names. */
export const MODEL_POLICY_IDS = [
  "conversation.fast",
  "conversation.quality",
  "evaluation.quality",
] as const;
export const zModelPolicyId = z.enum(MODEL_POLICY_IDS);
export type ModelPolicyId = z.infer<typeof zModelPolicyId>;

export const CONVERSATION_TOOL_NAMES = [
  "retrieve_scope_context",
  "get_learner_visible_progress_summary",
  "recommend_learning_content",
  "retrieve_item_context",
  "record_hint_usage",
  "record_evidence",
  "recommend_completion",
] as const;
export const zConversationToolName = z.enum(CONVERSATION_TOOL_NAMES);
export type ConversationToolName = z.infer<typeof zConversationToolName>;

// ── Context, messages, and lifecycle primitives ──────────────────────────

export const TutorSpaceContextSchema = zObject({
  kind: z.literal("tutor"),
  scope: z.literal("space"),
  spaceId: zSpaceId,
});
export const TutorStoryPointContextSchema = zObject({
  kind: z.literal("tutor"),
  scope: z.literal("story_point"),
  spaceId: zSpaceId,
  storyPointId: zStoryPointId,
});
export const TutorItemContextSchema = zObject({
  kind: z.literal("tutor"),
  scope: z.literal("item"),
  spaceId: zSpaceId,
  storyPointId: zStoryPointId,
  itemId: zItemId,
});
export const TutorContextSchema = z.union([
  TutorSpaceContextSchema,
  TutorStoryPointContextSchema,
  TutorItemContextSchema,
]);
export type TutorContext = z.infer<typeof TutorContextSchema>;

export const QuestionHelpContextSchema = zObject({
  kind: z.literal("question_help"),
  spaceId: zSpaceId,
  storyPointId: zStoryPointId,
  itemId: zItemId,
  attemptId: z.string().optional(),
});
export type QuestionHelpContext = z.infer<typeof QuestionHelpContextSchema>;

export const AgentAssessmentContextSchema = zObject({
  kind: z.literal("agent_assessment"),
  spaceId: zSpaceId,
  storyPointId: zStoryPointId,
  itemId: zItemId,
  // Allocated by the server when a non-resumable assessment attempt starts.
  attemptNumber: z.number().int().positive(),
});
export type AgentAssessmentContext = z.infer<typeof AgentAssessmentContextSchema>;

export const ConversationContextSchema = z.union([
  TutorContextSchema,
  QuestionHelpContextSchema,
  AgentAssessmentContextSchema,
]);
export type ConversationContext = z.infer<typeof ConversationContextSchema>;

/** The client start shape intentionally omits server-assigned assessment attempts. */
export const StartConversationContextSchema = z.union([
  TutorContextSchema,
  QuestionHelpContextSchema,
  AgentAssessmentContextSchema.omit({ attemptNumber: true }),
]);
export type StartConversationContext = z.infer<typeof StartConversationContextSchema>;

export const ConversationContentBlockSchema = z.discriminatedUnion("type", [
  zObject({ type: z.literal("text"), text: z.string() }),
  zObject({
    type: z.literal("media"),
    // Phases 1–5 deliberately support only the existing gateway image seam.
    mediaKind: z.literal("image"),
    storagePath: z.string(),
    mimeType: z.string(),
    altText: z.string().optional(),
  }),
  zObject({
    type: z.literal("citation"),
    sourceId: z.string(),
    label: z.string(),
    itemId: zItemId.optional(),
    storyPointId: zStoryPointId.optional(),
  }),
]);
export type ConversationContentBlock = z.infer<typeof ConversationContentBlockSchema>;

export const ConversationLeaseSchema = zObject({
  token: z.string(),
  ownerRequestId: z.string(),
  acquiredAt: zTimestamp,
  expiresAt: zTimestamp,
});
export type ConversationLease = z.infer<typeof ConversationLeaseSchema>;
/** Concise alias used by repository and runtime interfaces. */
export type Lease = ConversationLease;

export const ConversationErrorSchema = zObject({
  // App-error codes live in api-contract; domain deliberately stores only the
  // canonical code string to preserve its no-upward-dependency boundary.
  code: z.string(),
  retryable: z.boolean(),
  safeMessage: z.string(),
});
export type ConversationError = z.infer<typeof ConversationErrorSchema>;

export const ConversationMessageSchema = zObject({
  id: zConversationMessageId,
  sessionId: zConversationSessionId,
  sequence: z.number().int().positive(),
  role: z.enum(["learner", "assistant"]),
  /** Opening messages are explicit; all later messages are attached to a turn. */
  origin: z.enum(["opening", "turn"]),
  content: z.array(ConversationContentBlockSchema),
  turnId: zConversationTurnId.optional(),
  clientMessageId: z.string().optional(),
  deliveryStatus: z.enum(["accepted", "complete"]),
  createdAt: zTimestamp,
  completedAt: zTimestamp.optional(),
  redaction: zObject({
    status: z.enum(["none", "redacted"]),
    reasonCode: z.string().optional(),
  }).optional(),
}).superRefine((message, ctx) => {
  if (message.origin === "opening") {
    if (message.role !== "assistant") {
      ctx.addIssue({
        code: "custom",
        message: "only the deterministic first assistant message may use origin=opening",
        path: ["origin"],
      });
    }
    if (message.turnId !== undefined) {
      ctx.addIssue({
        code: "custom",
        message: "an opening message must not carry a turnId",
        path: ["turnId"],
      });
    }
  }
  if (message.origin === "turn" && message.turnId === undefined) {
    ctx.addIssue({
      code: "custom",
      message: "a turn-origin message must carry its matching turnId",
      path: ["turnId"],
    });
  }
});
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;

export const ConversationToolInvocationSchema = zObject({
  id: z.string(),
  step: z.number().int().nonnegative(),
  ordinal: z.number().int().nonnegative(),
  toolName: zConversationToolName,
  status: z.enum(["requested", "running", "succeeded", "failed"]),
  argsHash: z.string(),
  sanitizedArgs: zJsonValue,
  sanitizedResult: zJsonValue.optional(),
  resultBytes: z.number().int().nonnegative().optional(),
  startedAt: zTimestamp.optional(),
  completedAt: zTimestamp.optional(),
  errorCode: z.string().optional(),
});
export type ConversationToolInvocation = z.infer<typeof ConversationToolInvocationSchema>;

export const ConversationTurnSchema = zObject({
  id: zConversationTurnId,
  sessionId: zConversationSessionId,
  clientMessageId: z.string(),
  learnerMessageId: zConversationMessageId,
  status: zConversationTurnStatus,
  attemptCount: z.number().int().nonnegative(),
  lease: ConversationLeaseSchema.optional(),
  promptVersion: z.string(),
  configurationFingerprint: z.string(),
  toolsetVersion: z.string(),
  modelPolicyId: zModelPolicyId,
  modelRequestIds: z.array(z.string()),
  toolInvocations: z.array(ConversationToolInvocationSchema),
  assistantMessageIds: z.array(zConversationMessageId),
  traceId: z.string(),
  error: ConversationErrorSchema.optional(),
  claimedAt: zTimestamp,
  completedAt: zTimestamp.optional(),
});
export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;

// ── Frozen configuration ──────────────────────────────────────────────────
export const ConversationConfigurationSnapshotSchema = zObject({
  schemaVersion: z.literal(1),
  fingerprint: z.string(),
  mode: zConversationMode,
  locale: z.string(),
  prompt: zObject({
    key: z.enum(["conversationTutor", "conversationQuestionHelp", "conversationAssessment"]),
    version: z.string(),
  }),
  safetyPolicy: zObject({ id: z.string(), version: z.string() }),
  toolset: zObject({
    id: z.string(),
    version: z.string(),
    toolNames: z.array(zConversationToolName),
  }),
  // Runtime and evaluator policies are intentionally distinct. Assessment
  // finalization must never inherit the interviewer/runtime model policy.
  runtimeModelPolicyId: zModelPolicyId,
  runtimeAgent: zObject({
    source: z.enum(["configured", "builtin"]),
    id: z.string(),
    version: z.number().int().nonnegative(),
    type: z.enum(["tutor", "interviewer"]),
    identity: z.string().optional(),
    systemPrompt: z.string().optional(),
    rules: z.array(z.string()),
    openingMessage: z.string().optional(),
  }),
  context: zObject({
    contentVersions: z.array(
      zObject({
        resourceType: z.string(),
        resourceId: z.string(),
        version: z.number().int().nonnegative(),
      })
    ),
    interviewerContext: zJsonValue,
    evaluatorContext: zObject({
      question: zJsonValue,
      answerKey: zJsonValue,
      rubric: zJsonValue,
      evaluationSettings: zJsonValue,
      evaluatorAgent: zJsonValue.optional(),
      evaluatorModelPolicyId: zModelPolicyId,
      evaluatorPromptVersion: z.string(),
    }).optional(),
  }),
  completionPolicy: ConversationCompletionPolicySchema.optional(),
  createdAt: zTimestamp,
});
export type ConversationConfigurationSnapshot = z.infer<
  typeof ConversationConfigurationSnapshotSchema
>;

// ── Durable documents ─────────────────────────────────────────────────────

/**
 * The learner projection deliberately exposes only public source identities.
 * Evaluator agents/settings, answer keys, and private-rubric sources remain
 * exclusively in the callable-only configuration snapshot.
 */
export const ConversationPublicSourceVersionSchema = zObject({
  resourceType: z.enum(["space", "story_point", "item", "interviewer_agent"]),
  resourceId: z.string(),
  version: z.number().int().nonnegative(),
});
export type ConversationPublicSourceVersion = z.infer<typeof ConversationPublicSourceVersionSchema>;

export const ConversationPublicConfigSchema = zObject({
  /** Static/config-derived greeting projected to the learner with the session. */
  openingMessage: z.string().optional(),
  publicLearningObjectives: z.array(ConversationPublicLearningObjectiveSchema).optional(),
  conversationStarters: z.array(z.string()).optional(),
  completionPolicy: ConversationCompletionPolicySchema.optional(),
  configurationFingerprint: z.string(),
  sourceVersions: z.array(ConversationPublicSourceVersionSchema),
});
export type ConversationPublicConfig = z.infer<typeof ConversationPublicConfigSchema>;

export const ConversationCompletionRecommendationSchema = zObject({
  reasonCode: z.enum([
    "objectives_covered",
    "learner_requested",
    "insufficient_new_evidence",
    "hard_limit",
  ]),
  coveredPublicObjectiveIds: z.array(z.string()),
  remainingPublicObjectiveIds: z.array(z.string()),
  hardLimitReached: z.boolean(),
  recommendedAt: zTimestamp,
});
export type ConversationCompletionRecommendation = z.infer<
  typeof ConversationCompletionRecommendationSchema
>;

export const ConversationFinalizationSchema = zObject({
  lease: ConversationLeaseSchema.optional(),
  frozenThroughSequence: z.number().int().nonnegative().optional(),
  frozenRevision: z.number().int().nonnegative().optional(),
  transcriptHash: z.string().optional(),
  submissionId: zItemSubmissionId.optional(),
  requestedReason: z.enum(["learner_requested", "hard_limit"]).optional(),
  earlyFinishConfirmed: z.boolean().optional(),
  startedAt: zTimestamp.optional(),
  completedAt: zTimestamp.optional(),
});
export type ConversationFinalization = z.infer<typeof ConversationFinalizationSchema>;

export const ConversationSafeResultSchema = zObject({
  submissionId: zItemSubmissionId,
  evaluation: StoredEvaluationSchema,
  progressApplied: z.boolean(),
});
export type ConversationSafeResult = z.infer<typeof ConversationSafeResultSchema>;

/** Learner-safe grading state derived from the referenced submission. */
export const ConversationGradingViewSchema = zObject({
  status: z.enum(["pending", "failed"]),
  retryable: z.boolean(),
  retryAfterMs: z.number().int().positive().optional(),
  safeMessage: z.string().optional(),
});
export type ConversationGradingView = z.infer<typeof ConversationGradingViewSchema>;

/**
 * Session-picker preview only. Runtime derives this from learner-safe rendered
 * message content; it must already be whitespace-normalized and bounded.
 */
export const ConversationLastMessagePreviewSchema = z
  .string()
  .max(160)
  .refine((value) => value === value.trim().replace(/\s+/gu, " "), {
    message: "lastMessagePreview must be normalized whitespace",
  });
export type ConversationLastMessagePreview = z.infer<typeof ConversationLastMessagePreviewSchema>;

export const ConversationSessionDocSchema = zObject({
  schemaVersion: z.literal(1),
  id: zConversationSessionId,
  tenantId: zTenantId,
  ownerUid: zUserId,
  learnerStudentId: zStudentId.optional(),
  mode: zConversationMode,
  context: ConversationContextSchema,
  contextBaseKey: z.string(),
  contextKey: z.string(),
  title: z.string(),
  locale: z.string(),
  status: zConversationSessionStatus,
  publicConfig: ConversationPublicConfigSchema,
  configurationSnapshot: ConversationConfigurationSnapshotSchema,
  clientRequestId: z.string(),
  nextSequence: z.number().int().nonnegative(),
  revision: z.number().int().nonnegative(),
  learnerTurnCount: z.number().int().nonnegative(),
  activeTurnId: zConversationTurnId.optional(),
  activeTurnLeaseExpiresAt: zTimestamp.optional(),
  completionRecommendation: ConversationCompletionRecommendationSchema.optional(),
  finalization: ConversationFinalizationSchema.optional(),
  safeResult: ConversationSafeResultSchema.optional(),
  lastMessageAt: zTimestamp.optional(),
  lastMessagePreview: ConversationLastMessagePreviewSchema.optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  completedAt: zTimestamp.optional(),
  abandonedAt: zTimestamp.optional(),
});
export type ConversationSessionDoc = z.infer<typeof ConversationSessionDocSchema>;

export const ConversationSessionKeyDocSchema = zObject({
  schemaVersion: z.literal(1),
  id: z.string(),
  tenantId: zTenantId,
  ownerUid: zUserId,
  mode: zConversationMode,
  contextBaseKey: z.string(),
  activeSessionId: zConversationSessionId.optional(),
  nextAttemptNumber: z.number().int().positive(),
  revision: z.number().int().nonnegative(),
  updatedAt: zTimestamp,
});
export type ConversationSessionKeyDoc = z.infer<typeof ConversationSessionKeyDocSchema>;

export const ConversationTurnDocSchema = ConversationTurnSchema.extend({
  tenantId: zTenantId,
  ownerUid: zUserId,
  sessionRevisionAtClaim: z.number().int().nonnegative(),
  requestInputHash: z.string(),
  inputModeration: zJsonValue.optional(),
  outputModeration: zJsonValue.optional(),
  usageAggregate: zObject({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    cachedInputTokens: z.number().int().nonnegative(),
    costUsd: z.number().nonnegative(),
  }).optional(),
  updatedAt: zTimestamp,
}).strict();
export type ConversationTurnDoc = z.infer<typeof ConversationTurnDocSchema>;

export const ConversationEvidenceDocSchema = zObject({
  schemaVersion: z.literal(1),
  id: zConversationEvidenceId,
  tenantId: zTenantId,
  sessionId: zConversationSessionId,
  turnId: zConversationTurnId,
  objectiveId: z.string(),
  rubricDimensionId: z.string(),
  messageSequences: z.array(z.number().int().positive()),
  note: z.string(),
  confidence: z.number().min(0).max(1),
  recorder: zObject({
    type: z.literal("interviewer_model"),
    promptVersion: z.string(),
    configurationFingerprint: z.string(),
  }),
  createdAt: zTimestamp,
});
export type ConversationEvidenceDoc = z.infer<typeof ConversationEvidenceDocSchema>;

export const ItemSubmissionPayloadSchema = zObject({
  mode: z.literal("agent_assessment"),
  frozenThroughSequence: z.number().int().nonnegative(),
  transcript: z.array(
    zObject({
      sequence: z.number().int().positive(),
      role: z.enum(["learner", "assistant"]),
      content: z.array(ConversationContentBlockSchema),
      createdAt: zTimestamp,
    })
  ),
  transcriptHash: z.string(),
  configurationSnapshot: ConversationConfigurationSnapshotSchema,
  configurationFingerprint: z.string(),
  finalizationReason: z.enum(["learner_requested", "hard_limit"]),
  earlyFinish: z.boolean(),
  frozenAt: zTimestamp,
});
export type ItemSubmissionPayload = z.infer<typeof ItemSubmissionPayloadSchema>;

export const ItemSubmissionWorkflowSchema = zObject({
  status: zSubmissionWorkflowStatus,
  evaluationLease: ConversationLeaseSchema.optional(),
  evaluationAttemptCount: z.number().int().nonnegative(),
  nextRetryAt: zTimestamp.optional(),
  lastError: ConversationErrorSchema.optional(),
  progressAppliedAt: zTimestamp.optional(),
});
export type ItemSubmissionWorkflow = z.infer<typeof ItemSubmissionWorkflowSchema>;

export const ItemSubmissionEvaluationSchema = zObject({
  result: UnifiedEvaluationResultSchema,
  safeResult: StoredEvaluationSchema,
  resultHash: z.string(),
  evaluatorPromptVersion: z.string(),
  // Do not substitute runtimeModelPolicyId here. This is the evaluator policy
  // frozen independently in the assessment configuration snapshot.
  evaluatorModelPolicyId: zModelPolicyId,
  evaluatedAt: zTimestamp,
});
export type ItemSubmissionEvaluation = z.infer<typeof ItemSubmissionEvaluationSchema>;

export const ItemSubmissionDocSchema = zObject({
  schemaVersion: z.literal(1),
  id: zItemSubmissionId,
  tenantId: zTenantId,
  ownerUid: zUserId,
  learnerStudentId: zStudentId.optional(),
  spaceId: zSpaceId,
  storyPointId: zStoryPointId,
  itemId: zItemId,
  sessionId: zConversationSessionId,
  attemptNumber: z.number().int().positive(),
  payload: ItemSubmissionPayloadSchema,
  workflow: ItemSubmissionWorkflowSchema,
  evaluation: ItemSubmissionEvaluationSchema.optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
export type ItemSubmissionDoc = z.infer<typeof ItemSubmissionDocSchema>;

export const ItemSubmissionEvaluationAttemptDocSchema = zObject({
  id: z.string(),
  submissionId: zItemSubmissionId,
  attemptNumber: z.number().int().positive(),
  leaseTokenHash: z.string(),
  status: z.enum(["running", "succeeded", "failed"]),
  gatewayRequestId: z.string().optional(),
  traceId: z.string(),
  errorCode: z.string().optional(),
  retryable: z.boolean().optional(),
  startedAt: zTimestamp,
  completedAt: zTimestamp.optional(),
});
export type ItemSubmissionEvaluationAttemptDoc = z.infer<
  typeof ItemSubmissionEvaluationAttemptDocSchema
>;

export const ProgressApplicationDocSchema = zObject({
  schemaVersion: z.literal(1),
  id: zItemSubmissionId,
  tenantId: zTenantId,
  ownerUid: zUserId,
  spaceId: zSpaceId,
  storyPointId: zStoryPointId,
  itemId: zItemId,
  submissionId: zItemSubmissionId,
  evaluationResultHash: z.string(),
  score: z.number(),
  maxScore: z.number(),
  appliedAt: zTimestamp,
});
export type ProgressApplicationDoc = z.infer<typeof ProgressApplicationDocSchema>;

export const ConversationBumpSchema = zObject({
  rev: z.number().int().nonnegative(),
  lastMessageAt: zTimestamp.optional(),
});
export type ConversationBump = z.infer<typeof ConversationBumpSchema>;

// ── Learner-safe projection allowlists ────────────────────────────────────

export const ConversationSessionViewSchema = zObject({
  id: zConversationSessionId,
  mode: zConversationMode,
  context: ConversationContextSchema,
  contextBaseKey: z.string(),
  contextKey: z.string(),
  title: z.string(),
  locale: z.string(),
  status: zConversationSessionStatus,
  revision: z.number().int().nonnegative(),
  learnerTurnCount: z.number().int().nonnegative(),
  publicConfig: ConversationPublicConfigSchema,
  completionRecommendation: ConversationCompletionRecommendationSchema.optional(),
  activeTurn: zObject({
    id: zConversationTurnId,
    status: z.enum(["running", "failed_recoverable"]),
    clientMessageId: z.string(),
  }).optional(),
  grading: ConversationGradingViewSchema.optional(),
  result: ConversationSafeResultSchema.optional(),
  allowedActions: z.array(z.enum(["send", "finish", "abandon", "retry_turn"])),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  completedAt: zTimestamp.optional(),
});
export type ConversationSessionView = z.infer<typeof ConversationSessionViewSchema>;

export const ConversationMessageViewSchema = zObject({
  id: zConversationMessageId,
  sequence: z.number().int().positive(),
  role: z.enum(["learner", "assistant"]),
  origin: z.enum(["opening", "turn"]),
  content: z.array(ConversationContentBlockSchema),
  clientMessageId: z.string().optional(),
  deliveryStatus: z.enum(["accepted", "complete"]),
  createdAt: zTimestamp,
  completedAt: zTimestamp.optional(),
});
export type ConversationMessageView = z.infer<typeof ConversationMessageViewSchema>;

export const ConversationTurnViewSchema = zObject({
  id: zConversationTurnId,
  clientMessageId: z.string(),
  status: z.enum(["running", "completed", "failed_recoverable", "failed_terminal"]),
  assistantMessageIds: z.array(zConversationMessageId),
  error: ConversationErrorSchema.optional(),
});
export type ConversationTurnView = z.infer<typeof ConversationTurnViewSchema>;

export const ConversationSessionSummaryViewSchema = zObject({
  id: zConversationSessionId,
  mode: zConversationMode,
  context: ConversationContextSchema,
  contextBaseKey: z.string(),
  title: z.string(),
  locale: z.string(),
  status: zConversationSessionStatus,
  learnerTurnCount: z.number().int().nonnegative(),
  lastMessageAt: zTimestamp.optional(),
  lastMessagePreview: ConversationLastMessagePreviewSchema.optional(),
  updatedAt: zTimestamp,
  completedAt: zTimestamp.optional(),
});
export type ConversationSessionSummaryView = z.infer<typeof ConversationSessionSummaryViewSchema>;

export const ItemSubmissionViewSchema = zObject({
  id: zItemSubmissionId,
  sessionId: zConversationSessionId,
  attemptNumber: z.number().int().positive(),
  workflow: zObject({
    status: zSubmissionWorkflowStatus,
    retryable: z.boolean().optional(),
    nextRetryAt: zTimestamp.optional(),
    progressAppliedAt: zTimestamp.optional(),
  }),
  evaluation: StoredEvaluationSchema.optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
export type ItemSubmissionView = z.infer<typeof ItemSubmissionViewSchema>;
