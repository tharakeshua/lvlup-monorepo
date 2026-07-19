/**
 * StoryPoint entity — a section within a space.
 * Collection: /tenants/{tenantId}/spaces/{spaceId}/storyPoints/{storyPointId}
 * @module levelup/story-point
 */

import type { FirestoreTimestamp } from "../identity/user";
import type { UnifiedRubric } from "../content/rubric";

export type StoryPointType = "standard" | "timed_test" | "quiz" | "practice" | "test";

export interface StoryPointSection {
  id: string;
  title: string;
  orderIndex: number;
  description?: string;
}

export interface AdaptiveConfig {
  enabled: boolean;
  initialDifficulty: "easy" | "medium" | "hard";
  difficultyAdjustment: "gradual" | "aggressive";
  minQuestionsPerDifficulty?: number;
  maxConsecutiveSameDifficulty?: number;
}

export interface AssessmentSchedule {
  startAt?: FirestoreTimestamp;
  endAt?: FirestoreTimestamp;
  lateSubmissionGraceMinutes?: number;
}

export interface RetryConfig {
  cooldownMinutes?: number;
  lockAfterPassing?: boolean;
}

export interface AssessmentConfig {
  durationMinutes?: number;
  instructions?: string;
  maxAttempts?: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  showResultsImmediately?: boolean;
  passingPercentage?: number;
  adaptiveConfig?: AdaptiveConfig;
  schedule?: AssessmentSchedule;
  retryConfig?: RetryConfig;
}

export interface StoryPointStats {
  totalItems: number;
  totalQuestions: number;
  totalMaterials: number;
  totalPoints: number;
}

export interface StoryPoint {
  id: string;
  spaceId: string;
  tenantId: string;

  // Core
  title: string;
  description?: string;
  orderIndex: number;

  // Type determines UX mode
  type: StoryPointType;

  // Sections (embedded, lightweight)
  sections: StoryPointSection[];

  // Assessment config (for timed_test, quiz, practice types)
  assessmentConfig?: AssessmentConfig;

  // Rubric (storyPoint-level, overrides space default)
  defaultRubric?: UnifiedRubric;

  // Metadata
  difficulty?: "easy" | "medium" | "hard" | "expert";
  estimatedTimeMinutes?: number;

  // Denormalized stats
  stats?: StoryPointStats;

  // Audit
  createdBy: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
