/**
 * DigitalTestSession — tracks a student's test/quiz/practice attempt.
 * Collection: /tenants/{tenantId}/digitalTestSessions/{sessionId}
 * @module levelup/test-session
 */

import type { FirestoreTimestamp } from "../identity/user";
import type { QuestionType } from "../content/item";
import type { UnifiedEvaluationResult } from "../content/evaluation";

export type TestSessionStatus = "in_progress" | "completed" | "expired" | "abandoned";

export type TestSessionType = "timed_test" | "quiz" | "practice";

export type QuestionStatus =
  | "not_visited"
  | "not_answered"
  | "answered"
  | "marked_for_review"
  | "answered_and_marked";

export interface TestSubmission {
  itemId: string;
  questionType: QuestionType;
  answer: unknown;
  submittedAt: number;
  timeSpentSeconds: number;

  // Evaluation (filled after grading)
  evaluation?: UnifiedEvaluationResult;
  correct?: boolean;
  pointsEarned?: number;
  totalPoints?: number;
}

export interface AnalyticsBreakdownEntry {
  correct: number;
  total: number;
  points?: number;
  maxPoints?: number;
}

export interface TestAnalytics {
  topicBreakdown?: Record<string, AnalyticsBreakdownEntry>;
  bloomsBreakdown?: Record<string, AnalyticsBreakdownEntry>;
  difficultyBreakdown?: Record<string, AnalyticsBreakdownEntry>;
  sectionBreakdown?: Record<string, AnalyticsBreakdownEntry>;
  timePerQuestion?: Record<string, number>;
  averageTimePerQuestion?: number;
}

export interface AdaptiveState {
  currentDifficulty: "easy" | "medium" | "hard";
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  answeredByDifficulty: Record<string, number>;
}

export interface DigitalTestSession {
  id: string;
  tenantId: string;
  userId: string;
  spaceId: string;
  storyPointId: string;

  // Session metadata
  sessionType: TestSessionType;
  attemptNumber: number;
  status: TestSessionStatus;
  isLatest: boolean;

  // Timing
  startedAt: FirestoreTimestamp;
  endedAt?: FirestoreTimestamp;
  durationMinutes: number;
  serverDeadline?: FirestoreTimestamp;

  // Question tracking
  totalQuestions: number;
  answeredQuestions: number;
  questionOrder: string[];

  // 5-Status tracking maps
  visitedQuestions: Record<string, boolean>;
  submissions: Record<string, TestSubmission>;
  markedForReview: Record<string, boolean>;

  // Scores (computed on submit)
  pointsEarned?: number;
  totalPoints?: number;
  marksEarned?: number;
  totalMarks?: number;
  percentage?: number;

  // Section & position tracking
  sectionMapping?: Record<string, string>;
  lastVisitedIndex?: number;

  // Adaptive testing tracking
  adaptiveState?: AdaptiveState;
  currentDifficultyLevel?: "easy" | "medium" | "hard";
  difficultyProgression?: Array<{
    questionIndex: number;
    difficulty: string;
    correct: boolean;
  }>;

  // Results
  analytics?: TestAnalytics;

  // Audit
  submittedAt?: FirestoreTimestamp;
  autoSubmitted?: boolean;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
