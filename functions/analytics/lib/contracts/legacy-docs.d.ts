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
import type { TimestampInput, AtRiskReason, ProgressStatus } from "@levelup/domain";
/** Firestore-Timestamp-or-ISO-string. Collapse with domain `toTimestamp()`. */
export type LegacyTimestamp = TimestampInput;
export type { AtRiskReason, ProgressStatus };
export interface AutogradeSubjectBreakdown {
  avgScore: number;
  examCount: number;
}
export interface RecentExamEntry {
  examId: string;
  examTitle: string;
  score: number;
  percentage: number;
  date: LegacyTimestamp;
}
export interface StudentAutogradeMetrics {
  totalExams: number;
  completedExams: number;
  averageScore: number;
  averagePercentage: number;
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
  averageCompletion: number;
  totalPointsEarned: number;
  totalPointsAvailable: number;
  averageAccuracy: number;
  streakDays: number;
  subjectBreakdown: Record<string, LevelupSubjectBreakdown>;
  recentActivity: RecentActivityEntry[];
}
export interface StudentProgressSummary {
  id: string;
  tenantId: string;
  studentId: string;
  autograde: StudentAutogradeMetrics;
  levelup: StudentLevelupMetrics;
  overallScore: number;
  strengthAreas: string[];
  weaknessAreas: string[];
  isAtRisk: boolean;
  atRiskReasons: string[];
  lastUpdatedAt: LegacyTimestamp;
}
export declare const StudentProgressSummarySchema: z.ZodObject<
  {
    id: z.ZodString;
    tenantId: z.ZodString;
    studentId: z.ZodString;
    autograde: z.ZodObject<
      {
        totalExams: z.ZodNumber;
        completedExams: z.ZodNumber;
        averageScore: z.ZodNumber;
        averagePercentage: z.ZodNumber;
        totalMarksObtained: z.ZodNumber;
        totalMarksAvailable: z.ZodNumber;
        subjectBreakdown: z.ZodRecord<
          z.ZodString,
          z.ZodObject<
            {
              avgScore: z.ZodNumber;
              examCount: z.ZodNumber;
            },
            z.core.$loose
          >
        >;
        recentExams: z.ZodArray<
          z.ZodObject<
            {
              examId: z.ZodString;
              examTitle: z.ZodString;
              score: z.ZodNumber;
              percentage: z.ZodNumber;
              date: z.ZodPipe<
                z.ZodTransform<import("@levelup/domain").Timestamp, unknown>,
                z.ZodPipe<z.ZodString, z.ZodTransform<import("@levelup/domain").Timestamp, string>>
              >;
            },
            z.core.$loose
          >
        >;
      },
      z.core.$loose
    >;
    levelup: z.ZodObject<
      {
        totalSpaces: z.ZodNumber;
        completedSpaces: z.ZodNumber;
        averageCompletion: z.ZodNumber;
        totalPointsEarned: z.ZodNumber;
        totalPointsAvailable: z.ZodNumber;
        averageAccuracy: z.ZodNumber;
        streakDays: z.ZodNumber;
        subjectBreakdown: z.ZodRecord<
          z.ZodString,
          z.ZodObject<
            {
              avgCompletion: z.ZodNumber;
              spaceCount: z.ZodNumber;
            },
            z.core.$loose
          >
        >;
        recentActivity: z.ZodArray<
          z.ZodObject<
            {
              spaceId: z.ZodString;
              spaceTitle: z.ZodString;
              action: z.ZodString;
              date: z.ZodPipe<
                z.ZodTransform<import("@levelup/domain").Timestamp, unknown>,
                z.ZodPipe<z.ZodString, z.ZodTransform<import("@levelup/domain").Timestamp, string>>
              >;
            },
            z.core.$loose
          >
        >;
      },
      z.core.$loose
    >;
    overallScore: z.ZodNumber;
    strengthAreas: z.ZodArray<z.ZodString>;
    weaknessAreas: z.ZodArray<z.ZodString>;
    isAtRisk: z.ZodBoolean;
    atRiskReasons: z.ZodArray<z.ZodString>;
    lastUpdatedAt: z.ZodPipe<
      z.ZodTransform<import("@levelup/domain").Timestamp, unknown>,
      z.ZodPipe<z.ZodString, z.ZodTransform<import("@levelup/domain").Timestamp, string>>
    >;
  },
  z.core.$loose
>;
export interface ClassAutogradeMetrics {
  averageClassScore: number;
  examCompletionRate: number;
  topPerformers: Array<{
    studentId: string;
    name: string;
    avgScore: number;
  }>;
  bottomPerformers: Array<{
    studentId: string;
    name: string;
    avgScore: number;
  }>;
}
export interface ClassLevelupMetrics {
  averageClassCompletion: number;
  activeStudentRate: number;
  topPointEarners: Array<{
    studentId: string;
    name: string;
    points: number;
  }>;
}
export interface ClassProgressSummary {
  id: string;
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
export declare const ClassProgressSummarySchema: z.ZodObject<
  {
    id: z.ZodString;
    tenantId: z.ZodString;
    classId: z.ZodString;
    className: z.ZodString;
    studentCount: z.ZodNumber;
    autograde: z.ZodObject<
      {
        averageClassScore: z.ZodNumber;
        examCompletionRate: z.ZodNumber;
        topPerformers: z.ZodArray<
          z.ZodObject<
            {
              studentId: z.ZodString;
              name: z.ZodString;
              avgScore: z.ZodNumber;
            },
            z.core.$loose
          >
        >;
        bottomPerformers: z.ZodArray<
          z.ZodObject<
            {
              studentId: z.ZodString;
              name: z.ZodString;
              avgScore: z.ZodNumber;
            },
            z.core.$loose
          >
        >;
      },
      z.core.$loose
    >;
    levelup: z.ZodObject<
      {
        averageClassCompletion: z.ZodNumber;
        activeStudentRate: z.ZodNumber;
        topPointEarners: z.ZodArray<
          z.ZodObject<
            {
              studentId: z.ZodString;
              name: z.ZodString;
              points: z.ZodNumber;
            },
            z.core.$loose
          >
        >;
      },
      z.core.$loose
    >;
    atRiskStudentIds: z.ZodArray<z.ZodString>;
    atRiskCount: z.ZodNumber;
    lastUpdatedAt: z.ZodPipe<
      z.ZodTransform<import("@levelup/domain").Timestamp, unknown>,
      z.ZodPipe<z.ZodString, z.ZodTransform<import("@levelup/domain").Timestamp, string>>
    >;
  },
  z.core.$loose
>;
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
export interface CostBucket {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}
export interface DailyCostSummary {
  id: string;
  tenantId: string;
  date: string;
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
export interface StoryPointProgress {
  storyPointId: string;
  status: ProgressStatus;
  pointsEarned: number;
  totalPoints: number;
  percentage: number;
  completedItems: number;
  totalItems: number;
  completedAt?: number;
}
export declare const ExamSchema: z.ZodObject<
  {
    id: z.ZodString;
    tenantId: z.ZodString;
    title: z.ZodString;
    subject: z.ZodString;
    topics: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    classIds: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    sectionIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    examDate: z.ZodOptional<
      z.ZodNullable<
        z.ZodPipe<
          z.ZodTransform<import("@levelup/domain").Timestamp, unknown>,
          z.ZodPipe<z.ZodString, z.ZodTransform<import("@levelup/domain").Timestamp, string>>
        >
      >
    >;
    duration: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    academicSessionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    totalMarks: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    passingMarks: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    status: z.ZodPipe<
      z.ZodEnum<{
        draft: "draft";
        published: "published";
        archived: "archived";
        question_paper_uploaded: "question_paper_uploaded";
        question_paper_extracted: "question_paper_extracted";
        grading: "grading";
        results_released: "results_released";
        completed: "completed";
      }>,
      z.ZodTransform<
        | "draft"
        | "published"
        | "archived"
        | "question_paper_uploaded"
        | "question_paper_extracted"
        | "grading"
        | "results_released",
        | "completed"
        | "draft"
        | "published"
        | "archived"
        | "question_paper_uploaded"
        | "question_paper_extracted"
        | "grading"
        | "results_released"
      >
    >;
    createdBy: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodPipe<
      z.ZodTransform<import("@levelup/domain").Timestamp, unknown>,
      z.ZodPipe<z.ZodString, z.ZodTransform<import("@levelup/domain").Timestamp, string>>
    >;
    updatedAt: z.ZodPipe<
      z.ZodTransform<import("@levelup/domain").Timestamp, unknown>,
      z.ZodPipe<z.ZodString, z.ZodTransform<import("@levelup/domain").Timestamp, string>>
    >;
  },
  z.core.$loose
>;
export type ExamDoc = z.infer<typeof ExamSchema>;
export declare const SubmissionSchema: z.ZodObject<
  {
    id: z.ZodString;
    tenantId: z.ZodString;
    examId: z.ZodString;
    studentId: z.ZodString;
    studentName: z.ZodString;
    rollNumber: z.ZodString;
    classId: z.ZodString;
    answerSheets: z.ZodObject<
      {
        images: z.ZodArray<z.ZodString>;
        uploadedAt: z.ZodPipe<
          z.ZodTransform<import("@levelup/domain").Timestamp, unknown>,
          z.ZodPipe<z.ZodString, z.ZodTransform<import("@levelup/domain").Timestamp, string>>
        >;
        uploadedBy: z.ZodString;
        uploadSource: z.ZodPipe<
          z.ZodEnum<{
            scanner: "scanner";
            web: "web";
            rn: "rn";
            gcs: "gcs";
          }>,
          z.ZodTransform<"scanner" | "web" | "rn", "scanner" | "web" | "rn" | "gcs">
        >;
      },
      z.core.$loose
    >;
    summary: z.ZodObject<
      {
        totalScore: z.ZodNumber;
        maxScore: z.ZodNumber;
        percentage: z.ZodNumber;
        grade: z.ZodUnion<
          readonly [
            z.ZodLiteral<"">,
            z.ZodPipe<
              z.ZodString,
              z.ZodEnum<{
                A: "A";
                "A+": "A+";
                "B+": "B+";
                B: "B";
                "C+": "C+";
                C: "C";
                D: "D";
                F: "F";
              }>
            >,
          ]
        >;
        questionsGraded: z.ZodNumber;
        totalQuestions: z.ZodNumber;
        completedAt: z.ZodOptional<
          z.ZodPipe<
            z.ZodTransform<import("@levelup/domain").Timestamp, unknown>,
            z.ZodPipe<z.ZodString, z.ZodTransform<import("@levelup/domain").Timestamp, string>>
          >
        >;
      },
      z.core.$loose
    >;
    pipelineStatus: z.ZodPipe<
      z.ZodEnum<{
        grading: "grading";
        uploaded: "uploaded";
        scouting: "scouting";
        scouting_failed: "scouting_failed";
        scouting_complete: "scouting_complete";
        grading_partial: "grading_partial";
        grading_failed: "grading_failed";
        grading_complete: "grading_complete";
        finalization_failed: "finalization_failed";
        ready_for_review: "ready_for_review";
        reviewed: "reviewed";
        failed: "failed";
        manual_review_needed: "manual_review_needed";
        ocr_processing: "ocr_processing";
        ocr_failed: "ocr_failed";
      }>,
      z.ZodTransform<
        | "grading"
        | "uploaded"
        | "scouting"
        | "scouting_failed"
        | "scouting_complete"
        | "grading_partial"
        | "grading_failed"
        | "grading_complete"
        | "finalization_failed"
        | "ready_for_review"
        | "reviewed"
        | "failed"
        | "manual_review_needed",
        | "grading"
        | "uploaded"
        | "scouting"
        | "scouting_failed"
        | "scouting_complete"
        | "grading_partial"
        | "grading_failed"
        | "grading_complete"
        | "finalization_failed"
        | "ready_for_review"
        | "reviewed"
        | "failed"
        | "manual_review_needed"
        | "ocr_processing"
        | "ocr_failed"
      >
    >;
    pipelineError: z.ZodOptional<z.ZodString>;
    retryCount: z.ZodNumber;
    resultsReleased: z.ZodBoolean;
    resultsReleasedAt: z.ZodOptional<
      z.ZodPipe<
        z.ZodTransform<import("@levelup/domain").Timestamp, unknown>,
        z.ZodPipe<z.ZodString, z.ZodTransform<import("@levelup/domain").Timestamp, string>>
      >
    >;
    resultsReleasedBy: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodPipe<
      z.ZodTransform<import("@levelup/domain").Timestamp, unknown>,
      z.ZodPipe<z.ZodString, z.ZodTransform<import("@levelup/domain").Timestamp, string>>
    >;
    updatedAt: z.ZodPipe<
      z.ZodTransform<import("@levelup/domain").Timestamp, unknown>,
      z.ZodPipe<z.ZodString, z.ZodTransform<import("@levelup/domain").Timestamp, string>>
    >;
  },
  z.core.$loose
>;
export type SubmissionDoc = z.infer<typeof SubmissionSchema>;
export declare const ExamQuestionSchema: z.ZodObject<
  {
    id: z.ZodString;
    examId: z.ZodString;
    text: z.ZodString;
    imageUrls: z.ZodOptional<z.ZodArray<z.ZodString>>;
    maxMarks: z.ZodNumber;
    order: z.ZodNumber;
    questionType: z.ZodOptional<
      z.ZodEnum<{
        standard: "standard";
        diagram: "diagram";
        "multi-part": "multi-part";
      }>
    >;
    extractedBy: z.ZodOptional<
      z.ZodEnum<{
        ai: "ai";
        manual: "manual";
      }>
    >;
    extractedAt: z.ZodOptional<
      z.ZodPipe<
        z.ZodTransform<import("@levelup/domain").Timestamp, unknown>,
        z.ZodPipe<z.ZodString, z.ZodTransform<import("@levelup/domain").Timestamp, string>>
      >
    >;
    createdAt: z.ZodPipe<
      z.ZodTransform<import("@levelup/domain").Timestamp, unknown>,
      z.ZodPipe<z.ZodString, z.ZodTransform<import("@levelup/domain").Timestamp, string>>
    >;
    updatedAt: z.ZodPipe<
      z.ZodTransform<import("@levelup/domain").Timestamp, unknown>,
      z.ZodPipe<z.ZodString, z.ZodTransform<import("@levelup/domain").Timestamp, string>>
    >;
  },
  z.core.$loose
>;
export type ExamQuestionDoc = z.infer<typeof ExamQuestionSchema>;
