/**
 * Deterministic conversation document fixtures for the T-I QA suites.
 *
 * Every builder returns a document that PARSES against the frozen
 * `@levelup/domain` schema, so a projection/leak test can trust the input is a
 * real durable record — then prove the learner projection strips the private
 * fields deliberately seeded here (answer key, private rubric/objectives,
 * evaluator policy, interviewer system prompt, frozen configuration snapshot).
 *
 * Private markers are literal, greppable sentinels so a leak assertion can do a
 * single deep string scan of the projected JSON and fail on ANY appearance.
 */
import {
  ConversationSessionDocSchema,
  ConversationTurnDocSchema,
  ConversationMessageSchema,
  ItemSubmissionDocSchema,
  type ConversationConfigurationSnapshot,
  type ConversationMode,
  type ConversationSessionDoc,
  type ConversationSessionStatus,
  type ConversationTurnDoc,
  type ConversationTurnStatus,
  type ConversationMessage,
  type ItemSubmissionDoc,
} from "@levelup/domain";

/** Greppable private sentinels — MUST never survive a learner projection. */
export const PRIVATE_SENTINELS = {
  systemPrompt: "PRIVATE_SYSTEM_PROMPT_DO_NOT_LEAK",
  answerKey: "PRIVATE_ANSWER_KEY_DO_NOT_LEAK",
  rubric: "PRIVATE_RUBRIC_DO_NOT_LEAK",
  objectiveNote: "PRIVATE_OBJECTIVE_NOTE_DO_NOT_LEAK",
  evaluatorPrompt: "PRIVATE_EVALUATOR_PROMPT_DO_NOT_LEAK",
  cost: 4242.42, // a distinctive cost telemetry value
} as const;

export const CLOCK = "2026-07-19T00:00:00.000Z";
const LATER = "2026-07-19T00:05:00.000Z";

const SPACE = "space_alpha";
const STORY = "story_alpha";
const ITEM = "item_alpha";
const TENANT = "tenant_contract";
const OWNER = "uid_owner";

function contextFor(mode: ConversationMode) {
  switch (mode) {
    case "tutor":
      return {
        kind: "tutor",
        scope: "item",
        spaceId: SPACE,
        storyPointId: STORY,
        itemId: ITEM,
      } as const;
    case "question_help":
      return { kind: "question_help", spaceId: SPACE, storyPointId: STORY, itemId: ITEM } as const;
    case "agent_assessment":
      return {
        kind: "agent_assessment",
        spaceId: SPACE,
        storyPointId: STORY,
        itemId: ITEM,
        attemptNumber: 1,
      } as const;
  }
}

/** A frozen configuration snapshot deliberately laden with private data. */
export function makePrivateSnapshot(mode: ConversationMode): ConversationConfigurationSnapshot {
  const base: ConversationConfigurationSnapshot = {
    schemaVersion: 1,
    fingerprint: "fp_deadbeef",
    mode,
    locale: "en",
    prompt: {
      key:
        mode === "tutor"
          ? "conversationTutor"
          : mode === "question_help"
            ? "conversationQuestionHelp"
            : "conversationAssessment",
      version: `${mode}:1`,
    },
    safetyPolicy: { id: "safety.default", version: "1" },
    toolset: { id: `conversation.${mode}`, version: `conversation.${mode}:1`, toolNames: [] },
    createdAt: CLOCK,
    runtimeModelPolicyId:
      mode === "agent_assessment" ? "conversation.quality" : "conversation.fast",
    runtimeAgent: {
      source: "configured",
      id: "agent_1",
      version: 1,
      type: mode === "agent_assessment" ? "interviewer" : "tutor",
      identity: "Alex",
      systemPrompt: PRIVATE_SENTINELS.systemPrompt,
      rules: [PRIVATE_SENTINELS.systemPrompt],
      openingMessage: "Hi! How can I help?",
    },
    context: {
      contentVersions: [{ resourceType: "item", resourceId: ITEM, version: 3 }],
      interviewerContext: {
        publicScenario: "Design a rate limiter.",
        privateEvaluationObjectives: [
          {
            id: "obj_1",
            rubricDimensionId: "dim_1",
            description: PRIVATE_SENTINELS.objectiveNote,
          },
        ],
      },
    },
  };
  if (mode === "agent_assessment") {
    base.context.evaluatorContext = {
      question: { scenario: "Design a rate limiter." },
      answerKey: { modelAnswer: PRIVATE_SENTINELS.answerKey },
      rubric: { dimensions: [PRIVATE_SENTINELS.rubric] },
      evaluationSettings: { tolerance: 0.1 },
      evaluatorModelPolicyId: "evaluation.quality",
      evaluatorPromptVersion: PRIVATE_SENTINELS.evaluatorPrompt,
    };
    base.completionPolicy = {
      minLearnerTurns: 2,
      maxLearnerTurns: 8,
      allowEarlyFinish: true,
      hardLimitAction: "auto_finalize",
    };
  }
  return base;
}

export interface SessionOverrides {
  status?: ConversationSessionStatus;
  activeTurnId?: string;
  learnerTurnCount?: number;
  hardLimitReached?: boolean;
  completionRecommendation?: ConversationSessionDoc["completionRecommendation"];
  safeResult?: ConversationSessionDoc["safeResult"];
}

export function makeSessionDoc(
  mode: ConversationMode,
  overrides: SessionOverrides = {}
): ConversationSessionDoc {
  const snapshot = makePrivateSnapshot(mode);
  const completion =
    overrides.completionRecommendation ??
    (overrides.hardLimitReached
      ? {
          reasonCode: "hard_limit" as const,
          coveredPublicObjectiveIds: ["obj_pub_1"],
          remainingPublicObjectiveIds: [],
          hardLimitReached: true,
          recommendedAt: CLOCK,
        }
      : undefined);
  const doc = {
    schemaVersion: 1,
    id: "c_session_alpha",
    tenantId: TENANT,
    ownerUid: OWNER,
    mode,
    context: contextFor(mode),
    contextBaseKey: `${mode}:base`,
    contextKey: `${mode}:key`,
    title: "Rate limiter chat",
    locale: "en",
    status: overrides.status ?? "active",
    publicConfig: {
      openingMessage: "Hi! How can I help?",
      publicLearningObjectives: [{ id: "obj_pub_1", label: "Explain rate limiting" }],
      conversationStarters: ["What is a token bucket?"],
      ...(mode === "agent_assessment"
        ? {
            completionPolicy: {
              minLearnerTurns: 2,
              maxLearnerTurns: 8,
              allowEarlyFinish: true,
              hardLimitAction: "auto_finalize" as const,
            },
          }
        : {}),
      configurationFingerprint: "fp_deadbeef",
      sourceVersions: [{ resourceType: "item", resourceId: ITEM, version: 3 }],
    },
    configurationSnapshot: snapshot,
    clientRequestId: "11111111-1111-1111-1111-111111111111",
    nextSequence: 5,
    revision: 7,
    learnerTurnCount: overrides.learnerTurnCount ?? 2,
    ...(overrides.activeTurnId ? { activeTurnId: overrides.activeTurnId } : {}),
    ...(completion ? { completionRecommendation: completion } : {}),
    ...(overrides.safeResult ? { safeResult: overrides.safeResult } : {}),
    createdAt: CLOCK,
    updatedAt: LATER,
  };
  return ConversationSessionDocSchema.parse(doc);
}

export function makeTurnDoc(
  status: ConversationTurnStatus,
  overrides: Partial<Record<string, unknown>> = {}
): ConversationTurnDoc {
  const doc = {
    id: "ct_turn_alpha",
    sessionId: "c_session_alpha",
    clientMessageId: "22222222-2222-2222-2222-222222222222",
    learnerMessageId: "cm_u_alpha",
    status,
    attemptCount: 1,
    promptVersion: "conversationTutor:1",
    configurationFingerprint: "fp_deadbeef",
    toolsetVersion: "conversation.tutor:1",
    modelPolicyId: "conversation.fast",
    modelRequestIds: ["req_1"],
    toolInvocations: [],
    assistantMessageIds: ["cm_a_ct_turn_alpha_0"],
    traceId: "trace_1",
    claimedAt: CLOCK,
    tenantId: TENANT,
    ownerUid: OWNER,
    sessionRevisionAtClaim: 6,
    requestInputHash: "hash_input",
    // deliberately laden private telemetry that must never reach a learner view
    usageAggregate: {
      inputTokens: 10,
      outputTokens: 20,
      cachedInputTokens: 5,
      costUsd: PRIVATE_SENTINELS.cost,
    },
    updatedAt: LATER,
    ...overrides,
  };
  return ConversationTurnDocSchema.parse(doc);
}

export function makeAssistantMessage(): ConversationMessage {
  return ConversationMessageSchema.parse({
    id: "cm_a_ct_turn_alpha_0",
    sessionId: "c_session_alpha",
    sequence: 4,
    role: "assistant",
    origin: "turn",
    turnId: "ct_turn_alpha",
    content: [{ type: "text", text: "A token bucket refills at a fixed rate." }],
    deliveryStatus: "complete",
    createdAt: CLOCK,
    completedAt: LATER,
  });
}

export function makeSubmissionDoc(
  workflowStatus: ItemSubmissionDoc["workflow"]["status"] = "grading_pending"
): ItemSubmissionDoc {
  const snapshot = makePrivateSnapshot("agent_assessment");
  const doc = {
    schemaVersion: 1,
    id: "cis_submission_alpha",
    tenantId: TENANT,
    ownerUid: OWNER,
    spaceId: SPACE,
    storyPointId: STORY,
    itemId: ITEM,
    sessionId: "c_session_alpha",
    attemptNumber: 1,
    payload: {
      mode: "agent_assessment",
      frozenThroughSequence: 6,
      transcript: [
        {
          sequence: 1,
          role: "assistant",
          content: [{ type: "text", text: "Welcome." }],
          createdAt: CLOCK,
        },
        {
          sequence: 2,
          role: "learner",
          content: [{ type: "text", text: "I would use a token bucket." }],
          createdAt: CLOCK,
        },
      ],
      transcriptHash: "hash_transcript",
      configurationSnapshot: snapshot,
      configurationFingerprint: "fp_deadbeef",
      finalizationReason: "learner_requested",
      earlyFinish: true,
      frozenAt: CLOCK,
    },
    workflow: {
      status: workflowStatus,
      evaluationAttemptCount: workflowStatus === "grading_failed" ? 1 : 0,
      ...(workflowStatus === "grading_failed"
        ? {
            lastError: {
              code: "AI_TEMPORARY",
              retryable: true,
              safeMessage: "Grading will retry shortly.",
            },
            nextRetryAt: LATER,
          }
        : {}),
    },
    createdAt: CLOCK,
    updatedAt: LATER,
  };
  return ItemSubmissionDocSchema.parse(doc);
}
