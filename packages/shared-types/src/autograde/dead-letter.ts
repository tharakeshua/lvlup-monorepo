/**
 * GradingDeadLetterEntry — failed grading pipeline entries.
 * Collection: /tenants/{tenantId}/gradingDeadLetter/{entryId}
 * @module autograde/dead-letter
 */

import type { FirestoreTimestamp } from "../identity/user";

export type DeadLetterPipelineStep = "ocr" | "scouting" | "grading";

export type DeadLetterResolutionMethod = "retry_success" | "manual_grade" | "dismissed";

export interface GradingDeadLetterEntry {
  id: string;
  submissionId: string;
  questionSubmissionId?: string;
  pipelineStep: DeadLetterPipelineStep;
  error: string;
  errorStack?: string;
  attempts: number;
  lastAttemptAt: FirestoreTimestamp;
  resolvedAt?: FirestoreTimestamp;
  resolvedBy?: string;
  resolutionMethod?: DeadLetterResolutionMethod;
  createdAt: FirestoreTimestamp;
}
