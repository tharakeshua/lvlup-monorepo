/**
 * Unified evaluation result types shared by AutoGrade and LevelUp.
 * @module content/evaluation
 */

import type { FirestoreTimestamp } from "../identity/user";

export interface FeedbackItem {
  issue: string;
  whyItMatters?: string;
  howToFix: string;
  severity: "critical" | "major" | "minor";
  relatedConcept?: string;
}

export interface RubricBreakdownItem {
  criterion: string;
  awarded: number;
  max: number;
  feedback?: string;
}

/**
 * Canonical evaluation result produced by AI grading (RELMS)
 * or manual grading. Used by both AutoGrade QuestionSubmission
 * and LevelUp DigitalTestSession / practice evaluation.
 */
export interface UnifiedEvaluationResult {
  score: number;
  maxScore: number;
  correctness: number;
  percentage: number;

  // Structured feedback (keyed by dimension id/name)
  structuredFeedback?: Record<string, FeedbackItem[]>;

  // Simple arrays (backward compatible)
  strengths: string[];
  weaknesses: string[];
  missingConcepts: string[];

  // Rubric breakdown
  rubricBreakdown?: RubricBreakdownItem[];

  // Summary
  summary?: {
    keyTakeaway: string;
    overallComment: string;
  };

  // Metadata
  confidence: number;
  mistakeClassification?: "Conceptual" | "Silly Error" | "Knowledge Gap" | "None";

  // Cost tracking
  tokensUsed?: { input: number; output: number };
  costUsd?: number;

  // Traceability
  evaluationRubricId?: string;
  dimensionsUsed?: string[];

  gradedAt: FirestoreTimestamp;
}
