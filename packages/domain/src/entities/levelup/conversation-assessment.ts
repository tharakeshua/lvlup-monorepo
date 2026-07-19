/**
 * Conversation assessment shapes kept dependency-light so content question
 * schemas can consume them without introducing a content ↔ conversation cycle.
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import {
  zAgentId,
  zConversationSessionId,
  zItemSubmissionId,
} from "../../primitives/branded-id.zod.js";

export const ConversationPublicLearningObjectiveSchema = zObject({
  id: z.string(),
  label: z.string(),
});
export type ConversationPublicLearningObjective = z.infer<
  typeof ConversationPublicLearningObjectiveSchema
>;

export const ConversationCompletionPolicySchema = zObject({
  minLearnerTurns: z.number().int().positive(),
  maxLearnerTurns: z.number().int().positive().max(12),
  allowEarlyFinish: z.boolean(),
  hardLimitAction: z.literal("auto_finalize"),
}).superRefine((policy, ctx) => {
  if (policy.minLearnerTurns > policy.maxLearnerTurns) {
    ctx.addIssue({
      code: "custom",
      message: "minLearnerTurns must be less than or equal to maxLearnerTurns",
      path: ["minLearnerTurns"],
    });
  }
});
export type ConversationCompletionPolicy = z.infer<typeof ConversationCompletionPolicySchema>;

/** Learner-safe prompt stored with a `chat_agent_question` item. */
export const AgentAssessmentQuestionPromptSchema = zObject({
  questionType: z.literal("chat_agent_question"),
  scenario: z.string(),
  publicLearningObjectives: z.array(ConversationPublicLearningObjectiveSchema),
  conversationStarters: z.array(z.string()).optional(),
  interviewerAgentId: zAgentId,
  completionPolicy: ConversationCompletionPolicySchema,
});
export type AgentAssessmentQuestionPrompt = z.infer<typeof AgentAssessmentQuestionPromptSchema>;

/** Private data persisted only in the deny-all answer-key document. */
export const AgentAssessmentPrivateObjectiveSchema = zObject({
  id: z.string(),
  rubricDimensionId: z.string(),
  description: z.string(),
  evidenceRequirement: z.string().optional(),
});
export type AgentAssessmentPrivateObjective = z.infer<typeof AgentAssessmentPrivateObjectiveSchema>;

export const AgentAssessmentAnswerKeyDataSchema = zObject({
  questionType: z.literal("chat_agent_question"),
  modelAnswer: z.string().optional(),
  evaluationGuidance: z.string().optional(),
  privateEvaluationObjectives: z.array(AgentAssessmentPrivateObjectiveSchema),
});
export type AgentAssessmentAnswerKeyData = z.infer<typeof AgentAssessmentAnswerKeyDataSchema>;

/** A learner references a server-frozen session/submission, never a transcript. */
export const AgentAssessmentLearnerAnswerSchema = zObject({
  questionType: z.literal("chat_agent_question"),
  sessionId: zConversationSessionId,
  submissionId: zItemSubmissionId.optional(),
});
export type AgentAssessmentLearnerAnswer = z.infer<typeof AgentAssessmentLearnerAnswerSchema>;
