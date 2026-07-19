/**
 * Submission entity — a student's answer sheet submission.
 * Collection: /tenants/{tenantId}/submissions/{submissionId}
 * @module autograde/submission
 */

import type { FirestoreTimestamp } from "../identity/user";
import type { SubmissionPipelineStatus } from "../constants/grades";

export interface AnswerSheetData {
  images: string[];
  uploadedAt: FirestoreTimestamp;
  uploadedBy: string;
  uploadSource: "web" | "scanner";
}

export interface ScoutingResult {
  routingMap: Record<string, number[]>;
  confidence: Record<string, number>;
  completedAt: FirestoreTimestamp;
}

export interface SubmissionSummary {
  totalScore: number;
  maxScore: number;
  percentage: number;
  grade: string;
  questionsGraded: number;
  totalQuestions: number;
  completedAt?: FirestoreTimestamp;
}

export interface Submission {
  id: string;
  tenantId: string;
  examId: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  classId: string;

  // Answer sheet images
  answerSheets: AnswerSheetData;

  // Scouting result (from Panopticon)
  scoutingResult?: ScoutingResult;

  // Summary
  summary: SubmissionSummary;

  // Pipeline state
  pipelineStatus: SubmissionPipelineStatus;
  pipelineError?: string;
  retryCount: number;

  // Result release
  resultsReleased: boolean;
  resultsReleasedAt?: FirestoreTimestamp;
  resultsReleasedBy?: string;

  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
