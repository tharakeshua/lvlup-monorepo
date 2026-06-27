/**
 * Submission (+ AnswerSheetData, ScoutingResult, SubmissionSummary embeds) and
 * QuestionSubmission (+ QuestionMapping, ManualOverride embeds). `uploadSource`
 * closed to web|scanner|rn ('gcs' dropped — D12). Pipeline/grading outputs ⚷.
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import {
  zSubmissionId,
  zQuestionSubmissionId,
  zExamId,
  zExamQuestionId,
  zStudentId,
  zClassId,
  zUserId,
} from "../../primitives/branded-id.zod.js";
import { zTimestamp } from "../../primitives/timestamp.zod.js";
import { zSubmissionPipelineStatus } from "../../enums/submission.js";
import { zQuestionGradingStatus } from "../../enums/question-grading.js";
import { zUploadSource } from "../../enums/misc.js";
import { zGradeLetter } from "../../enums/grading.js";
import { UnifiedEvaluationResultSchema } from "../content/evaluation-result.js";

export const AnswerSheetDataSchema = zObject({
  images: z.array(z.string()),
  uploadedAt: zTimestamp,
  uploadedBy: zUserId,
  uploadSource: zUploadSource,
});
export type AnswerSheetData = z.infer<typeof AnswerSheetDataSchema>;

export const ScoutingResultSchema = zObject({
  routingMap: z.record(z.string(), z.array(z.number().int())),
  confidence: z.record(z.string(), z.number()),
  completedAt: zTimestamp,
});
export type ScoutingResult = z.infer<typeof ScoutingResultSchema>;

export const SubmissionSummarySchema = zObject({
  totalScore: z.number(),
  maxScore: z.number(),
  percentage: z.number(),
  grade: zGradeLetter,
  questionsGraded: z.number().int(),
  totalQuestions: z.number().int(),
  completedAt: zTimestamp.nullable(),
});
export type SubmissionSummary = z.infer<typeof SubmissionSummarySchema>;

export const GradingProgressSchema = zObject({
  graded: z.number().int(),
  total: z.number().int(),
  batchIndex: z.number().int().optional(),
});
export type GradingProgress = z.infer<typeof GradingProgressSchema>;

export const SubmissionSchema = zObject({
  id: zSubmissionId,
  examId: zExamId,
  studentId: zStudentId,
  studentName: z.string(),
  rollNumber: z.string(),
  classId: zClassId,
  answerSheets: AnswerSheetDataSchema,
  scoutingResult: ScoutingResultSchema.optional(),
  summary: SubmissionSummarySchema,
  pipelineStatus: zSubmissionPipelineStatus,
  pipelineError: z.string().optional(),
  retryCount: z.number().int().default(0),
  watchdogRetryCount: z.number().int().optional(),
  gradingProgress: GradingProgressSchema.optional(),
  resultsReleased: z.boolean().default(false),
  resultsReleasedAt: zTimestamp.nullable(),
  resultsReleasedBy: zUserId.optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
export type Submission = z.infer<typeof SubmissionSchema>;

export const QuestionMappingSchema = zObject({
  pageIndices: z.array(z.number().int()),
  imageUrls: z.array(z.string()),
  scoutedAt: zTimestamp,
});
export type QuestionMapping = z.infer<typeof QuestionMappingSchema>;

export const ManualOverrideSchema = zObject({
  score: z.number(),
  reason: z.string(),
  overriddenBy: zUserId,
  overriddenAt: zTimestamp,
  originalScore: z.number(),
});
export type ManualOverride = z.infer<typeof ManualOverrideSchema>;

export const QuestionSubmissionSchema = zObject({
  id: zQuestionSubmissionId,
  submissionId: zSubmissionId,
  questionId: zExamQuestionId,
  examId: zExamId,
  mapping: QuestionMappingSchema,
  evaluation: UnifiedEvaluationResultSchema.optional(),
  gradingStatus: zQuestionGradingStatus,
  gradingError: z.string().optional(),
  gradingRetryCount: z.number().int().default(0),
  manualOverride: ManualOverrideSchema.optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
export type QuestionSubmission = z.infer<typeof QuestionSubmissionSchema>;
