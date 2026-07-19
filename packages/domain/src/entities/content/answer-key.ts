/**
 * AnswerKey — ⚷ SERVER-ONLY (deny-all rules). Lives at
 * `items/{itemId}/answerKeys/{keyId}`. Never in any client-facing response except
 * the authoring-gated getItemForEdit.
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import { zAnswerKeyId, zItemId } from "../../primitives/branded-id.zod.js";
import { zTimestamp } from "../../primitives/timestamp.zod.js";
import { zQuestionType } from "../../enums/content.js";
import { AgentAssessmentPrivateObjectiveSchema } from "../levelup/conversation-assessment.js";

export const AnswerKeySchema = zObject({
  id: zAnswerKeyId,
  itemId: zItemId,
  questionType: zQuestionType,
  correctAnswer: z.unknown(),
  acceptableAnswers: z.array(z.unknown()).optional(),
  // ⚷ leak how to score.
  evaluationGuidance: z.string().optional(),
  modelAnswer: z.string().optional(),
  // Chat-agent assessment-only private objectives. These stay in the deny-all
  // answer-key document and are never projected to learners.
  privateEvaluationObjectives: z.array(AgentAssessmentPrivateObjectiveSchema).optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
export type AnswerKey = z.infer<typeof AnswerKeySchema>;
