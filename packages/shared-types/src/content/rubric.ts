/**
 * Unified rubric types shared by AutoGrade and LevelUp.
 * @module content/rubric
 */

import type { FirestoreTimestamp } from "../identity/user";

/**
 * Scoring mode determines which rubric fields are active.
 */
export type RubricScoringMode = "criteria_based" | "dimension_based" | "holistic" | "hybrid";

/**
 * Rich rubric criterion — LevelUp model with id, name, levels.
 * AutoGrade's simpler (description + marks) is a subset:
 * set name = description, maxScore = marks.
 */
export interface RubricCriterionLevel {
  score: number;
  label: string;
  description: string;
}

export interface RubricCriterion {
  id: string;
  name: string;
  description?: string;
  maxScore?: number;
  /** @deprecated Use maxScore. */
  maxPoints: number;
  weight?: number;
  levels?: RubricCriterionLevel[];
}

/**
 * Evaluation dimension — AutoGrade full version + LevelUp weight/scoringScale.
 * Used by RELMS grading and AI agent evaluation.
 */
export interface EvaluationDimension {
  id: string;
  name: string;
  description: string;
  icon?: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  promptGuidance: string;
  enabled: boolean;
  isDefault: boolean;
  isCustom: boolean;
  expectedFeedbackCount?: number;
  weight: number;
  scoringScale: number;
  createdAt?: FirestoreTimestamp;
  createdBy?: string;
}

/**
 * Unified rubric — canonical grading criteria structure.
 * Supports 4 scoring modes with inheritance chain:
 *   tenant default → space → storyPoint → item (LevelUp)
 *   tenant default → exam → question (AutoGrade)
 */
export interface UnifiedRubric {
  scoringMode: RubricScoringMode;

  // Criteria-based scoring (AutoGrade default)
  criteria?: RubricCriterion[];

  // Dimension-based scoring (RELMS / agent model)
  dimensions?: EvaluationDimension[];

  // Holistic scoring
  holisticGuidance?: string;
  holisticMaxScore?: number;

  // Shared settings
  passingPercentage?: number;
  showModelAnswer?: boolean;
  modelAnswer?: string;
  evaluatorGuidance?: string;
}
