/**
 * Exam entity — the top-level exam document.
 * Collection: /tenants/{tenantId}/exams/{examId}
 * @module autograde/exam
 */

import type { FirestoreTimestamp } from "../identity/user";
import type { ExamStatus } from "../constants/grades";

export interface ExamQuestionPaper {
  images: string[];
  extractedAt: FirestoreTimestamp;
  questionCount: number;
  examType: "standard";
}

export interface ExamGradingConfig {
  autoGrade: boolean;
  allowRubricEdit: boolean;
  evaluationSettingsId?: string;
  allowManualOverride: boolean;
  requireOverrideReason: boolean;
  releaseResultsAutomatically: boolean;
}

export interface ExamStats {
  totalSubmissions: number;
  gradedSubmissions: number;
  avgScore: number;
  passRate: number;
}

export interface Exam {
  id: string;
  tenantId: string;
  title: string;
  subject: string;
  topics: string[];
  classIds: string[];
  sectionIds?: string[];
  examDate: FirestoreTimestamp;
  duration: number;
  academicSessionId?: string;
  totalMarks: number;
  passingMarks: number;

  // Question paper metadata
  questionPaper?: ExamQuestionPaper;

  // Grading configuration
  gradingConfig: ExamGradingConfig;

  // Cross-domain linkage
  linkedSpaceId?: string;
  linkedSpaceTitle?: string;
  linkedStoryPointId?: string;

  // Lifecycle
  status: ExamStatus;

  // Evaluation settings reference
  evaluationSettingsId?: string;

  // Denormalized stats
  stats?: ExamStats;

  createdBy: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
