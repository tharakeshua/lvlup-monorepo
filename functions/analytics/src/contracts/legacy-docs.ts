/**
 * LEGACY DOC SHAPES for the unprefixed collections this package serves
 * (`tenants/{t}/studentProgressSummaries`, `classProgressSummaries`,
 * `examAnalytics`, `costSummaries`, `submissions`, `exams`, …). Ported from
 * @levelup/shared-types as part of U3.3 (DATA-MODEL-FIX-PLAN §3/§6) so that
 * package can be deleted (U3.5).
 *
 * These are deliberately NOT the @levelup/domain entity schemas: docs at rest
 * in the legacy collections carry legacy field vocabularies and, pre-B8,
 * Firestore Timestamp objects. Casting legacy docs to domain types would be a
 * lie; these types describe what is actually at rest. Enums/primitives that
 * ARE identical to domain come from domain — never redefined here
 * (AtRiskReason, Insight* enums, GradeLetter, ProgressStatus).
 *
 * B8 timestamps: every timestamp field is `LegacyTimestamp` (= domain
 * `TimestampInput`): old docs hold Firestore Timestamp objects, docs written
 * after U3.3 hold canonical ISO strings. NEVER consume one directly — collapse
 * with `toTimestamp()`/`legacyMillis()` at the point of use. The zod read
 * schemas below normalize timestamps to canonical ISO via domain
 * `zTimestampInput`, so PARSED docs always carry ISO strings (which are valid
 * `LegacyTimestamp`s) — safe to return over the wire (rule 3, responses).
 *
 * Legacy enum values are widened ON READ via domain `zLegacy*Read` adapters
 * (AD-4): exam status `completed`→`grading` (AD-10), pipeline
 * `ocr_processing`/`ocr_failed`, upload source `gcs`. Never widen a write.
 */
import { z } from "zod";
import {
  zTimestampInput,
  zLegacyExamStatusRead,
  zLegacySubmissionPipelineStatusRead,
  zLegacyUploadSourceRead,
  zLegacyGradeLetterRead,
} from "@levelup/domain";
import type { TimestampInput, AtRiskReason, ProgressStatus } from "@levelup/domain";

/** Firestore-Timestamp-or-ISO-string. Collapse with domain `toTimestamp()`. */
export type LegacyTimestamp = TimestampInput;

// Re-exported so handlers have ONE local import surface for legacy doc shapes.
export type { AtRiskReason, ProgressStatus };

/**
 * Grade letter at rest on a legacy submission summary: a canonical letter
 * (the legacy 7-letter scale is a strict subset of the canonical 8), or `""`
 * before grading completes (reports render falsy grades as "Ungraded"/"--").
 */
const zLegacyGradeAtRest = z.union([z.literal(""), zLegacyGradeLetterRead]);

// ─────────────────────────────────────────────────────────────────────────────
// StudentProgressSummary — /tenants/{tenantId}/studentProgressSummaries/{studentId}
// ─────────────────────────────────────────────────────────────────────────────

export interface AutogradeSubjectBreakdown {
  avgScore: number;
  examCount: number;
}

export interface RecentExamEntry {
  examId: string;
  examTitle: string;
  score: number; // 0-1 normalised
  percentage: number;
  date: LegacyTimestamp;
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

export interface LevelupSubjectBreakdown {
  avgCompletion: number;
  spaceCount: number;
}

export interface RecentActivityEntry {
  spaceId: string;
  spaceTitle: string;
  action: string;
  date: LegacyTimestamp;
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

  lastUpdatedAt: LegacyTimestamp;
}

const RecentExamEntrySchema = z.looseObject({
  examId: z.string(),
  examTitle: z.string(),
  score: z.number(),
  percentage: z.number(),
  date: zTimestampInput,
});

const StudentAutogradeMetricsSchema = z.looseObject({
  totalExams: z.number(),
  completedExams: z.number(),
  averageScore: z.number(),
  averagePercentage: z.number(),
  totalMarksObtained: z.number(),
  totalMarksAvailable: z.number(),
  subjectBreakdown: z.record(
    z.string(),
    z.looseObject({ avgScore: z.number(), examCount: z.number() })
  ),
  recentExams: z.array(RecentExamEntrySchema),
});

const RecentActivityEntrySchema = z.looseObject({
  spaceId: z.string(),
  spaceTitle: z.string(),
  action: z.string(),
  date: zTimestampInput,
});

const StudentLevelupMetricsSchema = z.looseObject({
  totalSpaces: z.number(),
  completedSpaces: z.number(),
  averageCompletion: z.number(),
  totalPointsEarned: z.number(),
  totalPointsAvailable: z.number(),
  averageAccuracy: z.number(),
  streakDays: z.number(),
  subjectBreakdown: z.record(
    z.string(),
    z.looseObject({ avgCompletion: z.number(), spaceCount: z.number() })
  ),
  recentActivity: z.array(RecentActivityEntrySchema),
});

export const StudentProgressSummarySchema = z.looseObject({
  id: z.string(),
  tenantId: z.string(),
  studentId: z.string(),
  autograde: StudentAutogradeMetricsSchema,
  levelup: StudentLevelupMetricsSchema,
  overallScore: z.number(),
  strengthAreas: z.array(z.string()),
  weaknessAreas: z.array(z.string()),
  isAtRisk: z.boolean(),
  atRiskReasons: z.array(z.string()),
  lastUpdatedAt: zTimestampInput,
});

// ─────────────────────────────────────────────────────────────────────────────
// ClassProgressSummary — /tenants/{tenantId}/classProgressSummaries/{classId}
// ─────────────────────────────────────────────────────────────────────────────

export interface ClassAutogradeMetrics {
  averageClassScore: number; // percentage 0–100 (stored as-is; UI renders raw, no ×100)
  examCompletionRate: number; // percentage 0–100 (stored as-is; UI renders raw, no ×100)
  topPerformers: Array<{ studentId: string; name: string; avgScore: number }>;
  bottomPerformers: Array<{ studentId: string; name: string; avgScore: number }>;
}

export interface ClassLevelupMetrics {
  averageClassCompletion: number; // percentage 0–100 (stored as-is; UI renders raw, no ×100)
  activeStudentRate: number; // percentage 0–100 (stored as-is; UI renders raw, no ×100)
  topPointEarners: Array<{ studentId: string; name: string; points: number }>;
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
  lastUpdatedAt: LegacyTimestamp;
}

const PerformerSchema = z.looseObject({
  studentId: z.string(),
  name: z.string(),
  avgScore: z.number(),
});

export const ClassProgressSummarySchema = z.looseObject({
  id: z.string(),
  tenantId: z.string(),
  classId: z.string(),
  className: z.string(),
  studentCount: z.number(),
  autograde: z.looseObject({
    averageClassScore: z.number(),
    examCompletionRate: z.number(),
    topPerformers: z.array(PerformerSchema),
    bottomPerformers: z.array(PerformerSchema),
  }),
  levelup: z.looseObject({
    averageClassCompletion: z.number(),
    activeStudentRate: z.number(),
    topPointEarners: z.array(
      z.looseObject({ studentId: z.string(), name: z.string(), points: z.number() })
    ),
  }),
  atRiskStudentIds: z.array(z.string()),
  atRiskCount: z.number(),
  lastUpdatedAt: zTimestampInput,
});

// ─────────────────────────────────────────────────────────────────────────────
// ExamAnalytics — /tenants/{tenantId}/examAnalytics/{examId}
// ─────────────────────────────────────────────────────────────────────────────

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

  totalSubmissions: number;
  gradedSubmissions: number;
  avgScore: number;
  avgPercentage: number;
  passRate: number;
  medianScore: number;

  scoreDistribution: {
    buckets: ScoreDistributionBucket[];
    gradeDistribution?: Record<string, number>;
  };

  questionAnalytics: Record<string, QuestionAnalyticsEntry>;
  classBreakdown: Record<string, ClassBreakdownEntry>;
  topicPerformance: Record<string, TopicPerformanceEntry>;

  computedAt: LegacyTimestamp;
  lastUpdatedAt: LegacyTimestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// DailyCostSummary — /tenants/{tenantId}/costSummaries/{daily_YYYY-MM-DD}
// (monthly rollups live in the SAME collection as monthly_YYYY-MM docs —
// prefixed doc ids, never nested daily/monthly sub-paths)
// ─────────────────────────────────────────────────────────────────────────────

export interface CostBucket {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface DailyCostSummary {
  id: string; // daily_{YYYY-MM-DD} — mirrors the doc id
  tenantId: string;
  date: string; // YYYY-MM-DD

  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;

  byPurpose: Record<string, CostBucket>;
  byModel: Record<string, CostBucket>;

  budgetLimitUsd?: number;
  budgetUsedPercent?: number;
  budgetAlertSent?: boolean;

  computedAt: LegacyTimestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// StoryPointProgress — embedded map on /tenants/{tenantId}/spaceProgress/{id}
// ─────────────────────────────────────────────────────────────────────────────

export interface StoryPointProgress {
  storyPointId: string;
  status: ProgressStatus;
  pointsEarned: number;
  totalPoints: number;
  percentage: number;
  completedItems: number;
  totalItems: number;
  completedAt?: number; // epoch millis (legacy convention for this embedded map)
}

// ─────────────────────────────────────────────────────────────────────────────
// Autograde docs read by generateReport — /tenants/{t}/exams, /submissions
// ─────────────────────────────────────────────────────────────────────────────

export const ExamSchema = z.looseObject({
  id: z.string(),
  tenantId: z.string(),
  title: z.string(),
  subject: z.string(),
  topics: z.array(z.string()).optional().default([]),
  classIds: z.array(z.string()).optional().default([]),
  sectionIds: z.array(z.string()).optional(),
  // examDate may be null in Firestore when an exam was created without a date.
  examDate: zTimestampInput.nullish(),
  duration: z.number().optional().default(0),
  academicSessionId: z.string().nullish(),
  totalMarks: z.number().optional().default(0),
  passingMarks: z.number().optional().default(0),
  status: zLegacyExamStatusRead, // legacy 'completed' → 'grading' on read (AD-10)
  createdBy: z.string().optional(),
  createdAt: zTimestampInput,
  updatedAt: zTimestampInput,
});
export type ExamDoc = z.infer<typeof ExamSchema>;

export const SubmissionSchema = z.looseObject({
  id: z.string(),
  tenantId: z.string(),
  examId: z.string(),
  studentId: z.string(),
  studentName: z.string(),
  rollNumber: z.string(),
  classId: z.string(),
  answerSheets: z.looseObject({
    images: z.array(z.string()),
    uploadedAt: zTimestampInput,
    uploadedBy: z.string(),
    uploadSource: zLegacyUploadSourceRead, // legacy 'gcs' widened on read
  }),
  summary: z.looseObject({
    totalScore: z.number(),
    maxScore: z.number(),
    percentage: z.number(),
    grade: zLegacyGradeAtRest,
    questionsGraded: z.number(),
    totalQuestions: z.number(),
    completedAt: zTimestampInput.optional(),
  }),
  pipelineStatus: zLegacySubmissionPipelineStatusRead, // legacy ocr_* widened on read
  pipelineError: z.string().optional(),
  retryCount: z.number(),
  resultsReleased: z.boolean(),
  resultsReleasedAt: zTimestampInput.optional(),
  resultsReleasedBy: z.string().optional(),
  createdAt: zTimestampInput,
  updatedAt: zTimestampInput,
});
export type SubmissionDoc = z.infer<typeof SubmissionSchema>;

export const ExamQuestionSchema = z.looseObject({
  id: z.string(),
  examId: z.string(),
  text: z.string(),
  imageUrls: z.array(z.string()).optional(),
  maxMarks: z.number(),
  order: z.number(),
  questionType: z.enum(["standard", "diagram", "multi-part"]).optional(),
  extractedBy: z.enum(["ai", "manual"]).optional(),
  extractedAt: zTimestampInput.optional(),
  createdAt: zTimestampInput,
  updatedAt: zTimestampInput,
});
export type ExamQuestionDoc = z.infer<typeof ExamQuestionSchema>;
