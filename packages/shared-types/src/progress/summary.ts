/**
 * Student & Class progress summaries — cross-system aggregation types.
 *
 * StudentProgressSummary: /tenants/{tenantId}/studentProgressSummaries/{studentId}
 * ClassProgressSummary:   /tenants/{tenantId}/classProgressSummaries/{classId}
 *
 * @module progress/summary
 */

import type { FirestoreTimestamp } from "../identity/user";

// ── AutoGrade metrics (exam-based) ──────────────────────────────────────────

export interface AutogradeSubjectBreakdown {
  avgScore: number;
  examCount: number;
}

export interface RecentExamEntry {
  examId: string;
  examTitle: string;
  score: number; // 0-1 normalised
  percentage: number;
  date: FirestoreTimestamp;
}

export interface StudentAutogradeMetrics {
  totalExams: number;
  completedExams: number;
  averageScore: number; // 0-1 normalised
  averagePercentage: number; // 0-100
  totalMarksObtained: number;
  totalMarksAvailable: number;
  subjectBreakdown: Record<string, AutogradeSubjectBreakdown>;
  recentExams: RecentExamEntry[];
}

// ── LevelUp metrics (space-based) ───────────────────────────────────────────

export interface LevelupSubjectBreakdown {
  avgCompletion: number;
  spaceCount: number;
}

export interface RecentActivityEntry {
  spaceId: string;
  spaceTitle: string;
  action: string;
  date: FirestoreTimestamp;
}

export interface StudentLevelupMetrics {
  totalSpaces: number;
  completedSpaces: number;
  averageCompletion: number; // 0-100 %
  totalPointsEarned: number;
  totalPointsAvailable: number;
  averageAccuracy: number; // 0-1
  streakDays: number;
  subjectBreakdown: Record<string, LevelupSubjectBreakdown>;
  recentActivity: RecentActivityEntry[];
}

// ── Student Progress Summary ────────────────────────────────────────────────

export interface StudentProgressSummary {
  id: string; // {studentId}
  tenantId: string;
  studentId: string;

  autograde: StudentAutogradeMetrics;
  levelup: StudentLevelupMetrics;

  // Cross-system
  overallScore: number; // weighted combination 0-1
  strengthAreas: string[];
  weaknessAreas: string[];
  isAtRisk: boolean;
  atRiskReasons: string[];

  lastUpdatedAt: FirestoreTimestamp;
}

// ── Class Progress Summary ──────────────────────────────────────────────────

export interface ClassAutogradeMetrics {
  averageClassScore: number; // percentage 0–100 (stored as-is; UI renders raw, no ×100)
  examCompletionRate: number; // percentage 0–100 (stored as-is; UI renders raw, no ×100)
  topPerformers: Array<{ studentId: string; name: string; avgScore: number }>; // avgScore: percentage 0–100
  bottomPerformers: Array<{ studentId: string; name: string; avgScore: number }>;
}

export interface ClassLevelupMetrics {
  averageClassCompletion: number; // percentage 0–100 (stored as-is; UI renders raw, no ×100)
  activeStudentRate: number; // percentage 0–100 (stored as-is; UI renders raw, no ×100)
  topPointEarners: Array<{ studentId: string; name: string; points: number }>; // points: raw integer
}

export interface ClassProgressSummary {
  id: string; // {classId}
  tenantId: string;
  classId: string;
  className: string;
  studentCount: number;

  autograde: ClassAutogradeMetrics;
  levelup: ClassLevelupMetrics;

  atRiskStudentIds: string[];
  atRiskCount: number;
  lastUpdatedAt: FirestoreTimestamp;
}
