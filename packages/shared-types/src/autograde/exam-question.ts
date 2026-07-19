/**
 * ExamQuestion — a question extracted from a physical exam paper.
 * Collection: /tenants/{tenantId}/exams/{examId}/questions/{questionId}
 * @module autograde/exam-question
 */

import type { FirestoreTimestamp } from "../identity/user";
import type { UnifiedRubric } from "../content/rubric";

export interface SubQuestion {
  label: string;
  text: string;
  maxMarks: number;
  rubric?: UnifiedRubric;
}

export interface ExamQuestion {
  id: string;
  examId: string;

  // Question content
  text: string;
  imageUrls?: string[];

  // Scoring
  maxMarks: number;
  order: number;

  // Rubric — uses SHARED UnifiedRubric type
  rubric: UnifiedRubric;

  // Pipeline metadata
  questionType?: "standard" | "diagram" | "multi-part";
  subQuestions?: SubQuestion[];

  // Cross-domain linkage
  linkedItemId?: string;

  // Extraction metadata
  extractedBy?: "ai" | "manual";
  extractedAt?: FirestoreTimestamp;
  extractionConfidence?: number;
  readabilityIssue?: boolean;
  rubricStatus?: "pending" | "generated";

  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
