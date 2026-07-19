/**
 * ExamAnalytics — computed analytics for an exam.
 * Collection: /tenants/{tenantId}/examAnalytics/{examId}
 * @module autograde/exam-analytics
 */

import type { FirestoreTimestamp } from "../identity/user";

export interface ScoreDistributionBucket {
  min: number;
  max: number;
  count: number;
}

export interface QuestionAnalyticsEntry {
  questionId: string;
  avgScore: number;
  maxScore: number;
  avgPercentage: number;
  difficultyIndex: number;
  discriminationIndex: number;
  commonMistakes: string[];
  commonStrengths: string[];
}

export interface ClassBreakdownEntry {
  classId: string;
  className: string;
  avgScore: number;
  passRate: number;
  submissionCount: number;
}

export interface TopicPerformanceEntry {
  topic: string;
  avgPercentage: number;
  weakStudentCount: number;
}

export interface ExamAnalytics {
  id: string;
  tenantId: string;
  examId: string;

  // Overall stats
  totalSubmissions: number;
  gradedSubmissions: number;
  avgScore: number;
  avgPercentage: number;
  passRate: number;
  medianScore: number;

  // Score distribution
  scoreDistribution: {
    buckets: ScoreDistributionBucket[];
    gradeDistribution?: Record<string, number>;
  };

  // Per-question analytics
  questionAnalytics: Record<string, QuestionAnalyticsEntry>;

  // Per-class breakdown
  classBreakdown: Record<string, ClassBreakdownEntry>;

  // Topic performance
  topicPerformance: Record<string, TopicPerformanceEntry>;

  computedAt: FirestoreTimestamp;
  lastUpdatedAt: FirestoreTimestamp;
}
