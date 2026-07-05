"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExamQuestionSchema =
  exports.SubmissionSchema =
  exports.ExamSchema =
  exports.ClassProgressSummarySchema =
  exports.StudentProgressSummarySchema =
    void 0;
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
const zod_1 = require("zod");
const domain_1 = require("@levelup/domain");
/**
 * Grade letter at rest on a legacy submission summary: a canonical letter
 * (the legacy 7-letter scale is a strict subset of the canonical 8), or `""`
 * before grading completes (reports render falsy grades as "Ungraded"/"--").
 */
const zLegacyGradeAtRest = zod_1.z.union([zod_1.z.literal(""), domain_1.zLegacyGradeLetterRead]);
const RecentExamEntrySchema = zod_1.z.looseObject({
  examId: zod_1.z.string(),
  examTitle: zod_1.z.string(),
  score: zod_1.z.number(),
  percentage: zod_1.z.number(),
  date: domain_1.zTimestampInput,
});
const StudentAutogradeMetricsSchema = zod_1.z.looseObject({
  totalExams: zod_1.z.number(),
  completedExams: zod_1.z.number(),
  averageScore: zod_1.z.number(),
  averagePercentage: zod_1.z.number(),
  totalMarksObtained: zod_1.z.number(),
  totalMarksAvailable: zod_1.z.number(),
  subjectBreakdown: zod_1.z.record(
    zod_1.z.string(),
    zod_1.z.looseObject({ avgScore: zod_1.z.number(), examCount: zod_1.z.number() })
  ),
  recentExams: zod_1.z.array(RecentExamEntrySchema),
});
const RecentActivityEntrySchema = zod_1.z.looseObject({
  spaceId: zod_1.z.string(),
  spaceTitle: zod_1.z.string(),
  action: zod_1.z.string(),
  date: domain_1.zTimestampInput,
});
const StudentLevelupMetricsSchema = zod_1.z.looseObject({
  totalSpaces: zod_1.z.number(),
  completedSpaces: zod_1.z.number(),
  averageCompletion: zod_1.z.number(),
  totalPointsEarned: zod_1.z.number(),
  totalPointsAvailable: zod_1.z.number(),
  averageAccuracy: zod_1.z.number(),
  streakDays: zod_1.z.number(),
  subjectBreakdown: zod_1.z.record(
    zod_1.z.string(),
    zod_1.z.looseObject({ avgCompletion: zod_1.z.number(), spaceCount: zod_1.z.number() })
  ),
  recentActivity: zod_1.z.array(RecentActivityEntrySchema),
});
exports.StudentProgressSummarySchema = zod_1.z.looseObject({
  id: zod_1.z.string(),
  tenantId: zod_1.z.string(),
  studentId: zod_1.z.string(),
  autograde: StudentAutogradeMetricsSchema,
  levelup: StudentLevelupMetricsSchema,
  overallScore: zod_1.z.number(),
  strengthAreas: zod_1.z.array(zod_1.z.string()),
  weaknessAreas: zod_1.z.array(zod_1.z.string()),
  isAtRisk: zod_1.z.boolean(),
  atRiskReasons: zod_1.z.array(zod_1.z.string()),
  lastUpdatedAt: domain_1.zTimestampInput,
});
const PerformerSchema = zod_1.z.looseObject({
  studentId: zod_1.z.string(),
  name: zod_1.z.string(),
  avgScore: zod_1.z.number(),
});
exports.ClassProgressSummarySchema = zod_1.z.looseObject({
  id: zod_1.z.string(),
  tenantId: zod_1.z.string(),
  classId: zod_1.z.string(),
  className: zod_1.z.string(),
  studentCount: zod_1.z.number(),
  autograde: zod_1.z.looseObject({
    averageClassScore: zod_1.z.number(),
    examCompletionRate: zod_1.z.number(),
    topPerformers: zod_1.z.array(PerformerSchema),
    bottomPerformers: zod_1.z.array(PerformerSchema),
  }),
  levelup: zod_1.z.looseObject({
    averageClassCompletion: zod_1.z.number(),
    activeStudentRate: zod_1.z.number(),
    topPointEarners: zod_1.z.array(
      zod_1.z.looseObject({
        studentId: zod_1.z.string(),
        name: zod_1.z.string(),
        points: zod_1.z.number(),
      })
    ),
  }),
  atRiskStudentIds: zod_1.z.array(zod_1.z.string()),
  atRiskCount: zod_1.z.number(),
  lastUpdatedAt: domain_1.zTimestampInput,
});
// ─────────────────────────────────────────────────────────────────────────────
// Autograde docs read by generateReport — /tenants/{t}/exams, /submissions
// ─────────────────────────────────────────────────────────────────────────────
exports.ExamSchema = zod_1.z.looseObject({
  id: zod_1.z.string(),
  tenantId: zod_1.z.string(),
  title: zod_1.z.string(),
  subject: zod_1.z.string(),
  topics: zod_1.z.array(zod_1.z.string()).optional().default([]),
  classIds: zod_1.z.array(zod_1.z.string()).optional().default([]),
  sectionIds: zod_1.z.array(zod_1.z.string()).optional(),
  // examDate may be null in Firestore when an exam was created without a date.
  examDate: domain_1.zTimestampInput.nullish(),
  duration: zod_1.z.number().optional().default(0),
  academicSessionId: zod_1.z.string().nullish(),
  totalMarks: zod_1.z.number().optional().default(0),
  passingMarks: zod_1.z.number().optional().default(0),
  status: domain_1.zLegacyExamStatusRead, // legacy 'completed' → 'grading' on read (AD-10)
  createdBy: zod_1.z.string().optional(),
  createdAt: domain_1.zTimestampInput,
  updatedAt: domain_1.zTimestampInput,
});
exports.SubmissionSchema = zod_1.z.looseObject({
  id: zod_1.z.string(),
  tenantId: zod_1.z.string(),
  examId: zod_1.z.string(),
  studentId: zod_1.z.string(),
  studentName: zod_1.z.string(),
  rollNumber: zod_1.z.string(),
  classId: zod_1.z.string(),
  answerSheets: zod_1.z.looseObject({
    images: zod_1.z.array(zod_1.z.string()),
    uploadedAt: domain_1.zTimestampInput,
    uploadedBy: zod_1.z.string(),
    uploadSource: domain_1.zLegacyUploadSourceRead, // legacy 'gcs' widened on read
  }),
  summary: zod_1.z.looseObject({
    totalScore: zod_1.z.number(),
    maxScore: zod_1.z.number(),
    percentage: zod_1.z.number(),
    grade: zLegacyGradeAtRest,
    questionsGraded: zod_1.z.number(),
    totalQuestions: zod_1.z.number(),
    completedAt: domain_1.zTimestampInput.optional(),
  }),
  pipelineStatus: domain_1.zLegacySubmissionPipelineStatusRead, // legacy ocr_* widened on read
  pipelineError: zod_1.z.string().optional(),
  retryCount: zod_1.z.number(),
  resultsReleased: zod_1.z.boolean(),
  resultsReleasedAt: domain_1.zTimestampInput.optional(),
  resultsReleasedBy: zod_1.z.string().optional(),
  createdAt: domain_1.zTimestampInput,
  updatedAt: domain_1.zTimestampInput,
});
exports.ExamQuestionSchema = zod_1.z.looseObject({
  id: zod_1.z.string(),
  examId: zod_1.z.string(),
  text: zod_1.z.string(),
  imageUrls: zod_1.z.array(zod_1.z.string()).optional(),
  maxMarks: zod_1.z.number(),
  order: zod_1.z.number(),
  questionType: zod_1.z.enum(["standard", "diagram", "multi-part"]).optional(),
  extractedBy: zod_1.z.enum(["ai", "manual"]).optional(),
  extractedAt: domain_1.zTimestampInput.optional(),
  createdAt: domain_1.zTimestampInput,
  updatedAt: domain_1.zTimestampInput,
});
//# sourceMappingURL=legacy-docs.js.map
