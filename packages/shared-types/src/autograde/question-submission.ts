/**
 * QuestionSubmission — per-question grading result within a submission.
 * Collection: /tenants/{tenantId}/submissions/{submissionId}/questionSubmissions/{questionId}
 * @module autograde/question-submission
 */

import type { FirestoreTimestamp } from "../identity/user";
import type { UnifiedEvaluationResult } from "../content/evaluation";
import type { QuestionGradingStatus } from "../constants/grades";

export interface QuestionMapping {
  pageIndices: number[];
  imageUrls: string[];
  scoutedAt: FirestoreTimestamp;
}

export interface ManualOverride {
  score: number;
  reason: string;
  overriddenBy: string;
  overriddenAt: FirestoreTimestamp;
  originalScore: number;
}

export interface QuestionSubmission {
  id: string;
  submissionId: string;
  questionId: string;
  examId: string;

  // Mapping data (from scouting phase)
  mapping: QuestionMapping;

  // Evaluation result — uses SHARED UnifiedEvaluationResult
  evaluation?: UnifiedEvaluationResult;

  // Per-question grading status
  gradingStatus: QuestionGradingStatus;
  gradingError?: string;
  gradingRetryCount: number;

  // Manual override
  manualOverride?: ManualOverride;

  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
