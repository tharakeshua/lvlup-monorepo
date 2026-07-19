import { describe, expect, it } from "vitest";
import { TenantFeaturesSchema } from "../entities/identity/tenant.js";
import {
  AgentAssessmentAnswerKeyDataSchema,
  AgentAssessmentLearnerAnswerSchema,
  AgentAssessmentQuestionPromptSchema,
  ConversationConfigurationSnapshotSchema,
  ConversationCompletionRecommendationSchema,
  ConversationContentBlockSchema,
  ConversationLastMessagePreviewSchema,
  ConversationMessageSchema,
  ConversationPublicConfigSchema,
} from "../entities/levelup/conversation.js";

const ISO = "2026-01-01T00:00:00.000Z";

const assessmentPrompt = {
  questionType: "chat_agent_question" as const,
  scenario: "Talk through how you would reduce the lookup cost.",
  publicLearningObjectives: [{ id: "objective_1", label: "Explain the trade-off" }],
  conversationStarters: ["What would you examine first?"],
  interviewerAgentId: "agent_interviewer",
  completionPolicy: {
    minLearnerTurns: 1,
    maxLearnerTurns: 4,
    allowEarlyFinish: true,
    hardLimitAction: "auto_finalize" as const,
  },
};

describe("conversation domain contracts", () => {
  it("keeps chat-agent public, private, and learner-reference data lossless and separate", () => {
    expect(AgentAssessmentQuestionPromptSchema.parse(assessmentPrompt)).toMatchObject({
      scenario: assessmentPrompt.scenario,
      interviewerAgentId: assessmentPrompt.interviewerAgentId,
    });
    expect(
      AgentAssessmentAnswerKeyDataSchema.parse({
        questionType: "chat_agent_question",
        evaluationGuidance: "Assess evidence against each dimension.",
        privateEvaluationObjectives: [
          {
            id: "objective_1",
            rubricDimensionId: "dimension_reasoning",
            description: "Names the relevant cost trade-off.",
            evidenceRequirement: "References a learner turn.",
          },
        ],
      })
    ).toMatchObject({ privateEvaluationObjectives: [{ id: "objective_1" }] });
    expect(
      AgentAssessmentLearnerAnswerSchema.parse({
        questionType: "chat_agent_question",
        sessionId: "c_session_1",
      })
    ).toMatchObject({ sessionId: "c_session_1" });

    expect(
      AgentAssessmentQuestionPromptSchema.safeParse({
        questionType: "chat_agent_question",
        agentInstructions: "legacy lossy field",
      }).success
    ).toBe(false);
    expect(
      AgentAssessmentLearnerAnswerSchema.safeParse({
        questionType: "chat_agent_question",
        sessionId: "c_session_1",
        transcript: [{ role: "learner", content: "must not cross the boundary" }],
      }).success
    ).toBe(false);
  });

  it("allows only image media and requires a durable message origin", () => {
    expect(
      ConversationContentBlockSchema.safeParse({
        type: "media",
        mediaKind: "image",
        storagePath: "tenants/t1/images/i1.png",
        mimeType: "image/png",
      }).success
    ).toBe(true);
    expect(
      ConversationContentBlockSchema.safeParse({
        type: "media",
        mediaKind: "audio",
        storagePath: "tenants/t1/audio/a1.mp3",
        mimeType: "audio/mpeg",
      }).success
    ).toBe(false);

    const message = {
      id: "cm_u_1",
      sessionId: "c_session_1",
      sequence: 1,
      role: "learner" as const,
      origin: "turn" as const,
      content: [{ type: "text" as const, text: "I would inspect the hash function first." }],
      turnId: "ct_turn_1",
      clientMessageId: "00000000-0000-4000-8000-000000000001",
      deliveryStatus: "complete" as const,
      createdAt: ISO,
    };
    expect(ConversationMessageSchema.safeParse(message).success).toBe(true);
    const { origin: _origin, ...withoutOrigin } = message;
    expect(ConversationMessageSchema.safeParse(withoutOrigin).success).toBe(false);

    const { turnId: _turnId, clientMessageId: _clientMessageId, ...opening } = message;
    expect(
      ConversationMessageSchema.safeParse({
        ...opening,
        id: "cm_a_opening",
        role: "assistant",
        origin: "opening",
      }).success
    ).toBe(true);
    expect(ConversationMessageSchema.safeParse({ ...opening, origin: "opening" }).success).toBe(
      false
    );
  });

  it("freezes runtime and evaluator model policies as distinct fields", () => {
    const snapshot = {
      schemaVersion: 1 as const,
      fingerprint: "sha256-fingerprint",
      mode: "agent_assessment" as const,
      locale: "en",
      prompt: { key: "conversationAssessment" as const, version: "v1" },
      safetyPolicy: { id: "default", version: "v1" },
      toolset: { id: "assessment", version: "v1", toolNames: ["record_evidence" as const] },
      runtimeModelPolicyId: "conversation.fast" as const,
      runtimeAgent: {
        source: "configured" as const,
        id: "agent_interviewer",
        version: 3,
        type: "interviewer" as const,
        rules: [],
        openingMessage: "Let us explore this together.",
      },
      context: {
        contentVersions: [],
        interviewerContext: {},
        evaluatorContext: {
          question: {},
          answerKey: {},
          rubric: {},
          evaluationSettings: {},
          evaluatorModelPolicyId: "evaluation.quality" as const,
          evaluatorPromptVersion: "v7",
        },
      },
      completionPolicy: assessmentPrompt.completionPolicy,
      createdAt: ISO,
    };
    const parsed = ConversationConfigurationSnapshotSchema.parse(snapshot);
    expect(parsed.runtimeModelPolicyId).toBe("conversation.fast");
    expect(parsed.context.evaluatorContext?.evaluatorModelPolicyId).toBe("evaluation.quality");
    expect(parsed.runtimeAgent.openingMessage).toBe("Let us explore this together.");

    const { evaluatorModelPolicyId: _evaluatorModelPolicyId, ...evaluatorWithoutPolicy } =
      snapshot.context.evaluatorContext;
    const missingEvaluatorPolicy = {
      ...snapshot,
      context: { ...snapshot.context, evaluatorContext: evaluatorWithoutPolicy },
    };
    expect(ConversationConfigurationSnapshotSchema.safeParse(missingEvaluatorPolicy).success).toBe(
      false
    );
  });

  it("keeps conversation feature flags explicit-off when omitted", () => {
    const features = TenantFeaturesSchema.parse({});
    expect(features.conversations).toBeUndefined();
    expect(features.conversationTutor).toBeUndefined();
    expect(features.conversationQuestionHelp).toBeUndefined();
    expect(features.conversationAssessment).toBeUndefined();
  });

  it("bounds session-picker previews to normalized learner-safe text", () => {
    expect(ConversationLastMessagePreviewSchema.parse("A concise learner-safe preview.")).toBe(
      "A concise learner-safe preview."
    );
    expect(ConversationLastMessagePreviewSchema.safeParse("untrimmed preview ").success).toBe(
      false
    );
    expect(ConversationLastMessagePreviewSchema.safeParse("line one\nline two").success).toBe(
      false
    );
    expect(ConversationLastMessagePreviewSchema.safeParse("x".repeat(161)).success).toBe(false);
  });

  it("keeps evaluator and private source identities out of public configuration", () => {
    const config = {
      configurationFingerprint: "sha256-fingerprint",
      sourceVersions: [
        { resourceType: "interviewer_agent" as const, resourceId: "agent_1", version: 2 },
      ],
    };
    expect(ConversationPublicConfigSchema.safeParse(config).success).toBe(true);
    expect(
      ConversationPublicConfigSchema.safeParse({
        ...config,
        sourceVersions: [{ resourceType: "evaluator_agent", resourceId: "agent_eval", version: 2 }],
      }).success
    ).toBe(false);
  });

  it("allows the safe insufficient-evidence completion recommendation", () => {
    expect(
      ConversationCompletionRecommendationSchema.safeParse({
        reasonCode: "insufficient_new_evidence",
        coveredPublicObjectiveIds: [],
        remainingPublicObjectiveIds: ["objective_1"],
        hardLimitReached: false,
        recommendedAt: ISO,
      }).success
    ).toBe(true);
  });
});
