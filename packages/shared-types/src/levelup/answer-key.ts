/**
 * AnswerKey — server-only subcollection for timed test answer verification.
 * Collection: /tenants/{tenantId}/spaces/{spaceId}/storyPoints/{spId}/answerKeys/{itemId}
 * @module levelup/answer-key
 */

import type { FirestoreTimestamp } from "../identity/user";
import type { QuestionType } from "../content/item";

export interface AnswerKey {
  id: string;
  itemId: string;
  questionType: QuestionType;
  correctAnswer: unknown;
  acceptableAnswers?: unknown[];
  evaluationGuidance?: string;
  modelAnswer?: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
