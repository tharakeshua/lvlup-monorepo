/**
 * Exam (+ ExamQuestionPaper, ExamGradingConfig, ExamStats embeds) and ExamQuestion
 * (+ SubQuestion). `tenantId` is path-scoped (server fills) — kept on the entity for
 * defense-in-depth/collection-group queries. `images` are tenant storage paths.
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import {
  zExamId,
  zExamQuestionId,
  zTenantId,
  zClassId,
  zSectionId,
  zAcademicSessionId,
  zEvaluationSettingsId,
  zSpaceId,
  zStoryPointId,
  zItemId,
  zUserId,
} from "../../primitives/branded-id.zod.js";
import { zTimestamp } from "../../primitives/timestamp.zod.js";
import { zExamStatus } from "../../enums/exam.js";
import { zQuestionType } from "../../enums/content.js";
import { UnifiedRubricSchema } from "../content/rubric.js";

export const ExamQuestionPaperSchema = zObject({
  images: z.array(z.string()),
  extractedAt: zTimestamp.nullable(),
  /** Set when Pass-2 rubric generation completes (live extraction pipeline). */
  rubricsGeneratedAt: zTimestamp.optional(),
  questionCount: z.number().int(),
  examType: z.literal("standard"),
});
export type ExamQuestionPaper = z.infer<typeof ExamQuestionPaperSchema>;

export const ExamGradingConfigSchema = zObject({
  autoGrade: z.boolean(),
  allowRubricEdit: z.boolean(),
  /**
   * @deprecated Read-only legacy field. The canonical location is `Exam.evaluationSettingsId`
   * (top-level). Readers must resolve `exam.evaluationSettingsId ?? exam.gradingConfig?.evaluationSettingsId`.
   * NEVER write here from new code — only the top-level field is written. Retained so existing
   * legacy docs still parse.
   */
  evaluationSettingsId: zEvaluationSettingsId.optional(),
  allowManualOverride: z.boolean(),
  requireOverrideReason: z.boolean(),
  releaseResultsAutomatically: z.boolean(),
});
export type ExamGradingConfig = z.infer<typeof ExamGradingConfigSchema>;

export const ExamStatsSchema = zObject({
  totalSubmissions: z.number().int().default(0),
  gradedSubmissions: z.number().int().default(0),
  avgScore: z.number().default(0),
  passRate: z.number().default(0),
});
export type ExamStats = z.infer<typeof ExamStatsSchema>;

export const ExamSchema = zObject({
  id: zExamId,
  tenantId: zTenantId,
  title: z.string(),
  subject: z.string(),
  topics: z.array(z.string()).default([]),
  classIds: z.array(zClassId).default([]),
  sectionIds: z.array(zSectionId).optional(),
  examDate: zTimestamp,
  duration: z.number().int(),
  academicSessionId: zAcademicSessionId.optional(),
  totalMarks: z.number(),
  passingMarks: z.number(),
  status: zExamStatus,
  questionPaper: ExamQuestionPaperSchema.optional(),
  gradingConfig: ExamGradingConfigSchema,
  evaluationSettingsId: zEvaluationSettingsId.optional(),
  linkedSpaceId: zSpaceId.optional(),
  linkedSpaceTitle: z.string().optional(),
  linkedStoryPointId: zStoryPointId.optional(),
  stats: ExamStatsSchema.optional(),
  createdBy: zUserId,
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
export type Exam = z.infer<typeof ExamSchema>;

export const SubQuestionSchema = zObject({
  label: z.string(),
  text: z.string(),
  maxMarks: z.number(),
  rubric: UnifiedRubricSchema.optional(),
});
export type SubQuestion = z.infer<typeof SubQuestionSchema>;

export const ExamQuestionSchema = zObject({
  id: zExamQuestionId,
  examId: zExamId,
  text: z.string(),
  imageUrls: z.array(z.string()).optional(),
  maxMarks: z.number(),
  order: z.number().int(),
  rubric: UnifiedRubricSchema,
  questionType: zQuestionType.optional(),
  subQuestions: z.array(SubQuestionSchema).optional(),
  linkedItemId: zItemId.optional(),
  extractedBy: zUserId.optional(),
  extractedAt: zTimestamp.nullable(),
  extractionConfidence: z.number().optional(),
  readabilityIssue: z.boolean().optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
export type ExamQuestion = z.infer<typeof ExamQuestionSchema>;
