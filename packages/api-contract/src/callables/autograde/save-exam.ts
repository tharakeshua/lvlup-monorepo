/**
 * `v1.autograde.saveExam` — create/update/lifecycle-transition an exam.
 *
 * Retains all transitions and field updates EXCEPT result-release (carved into the
 * dedicated `releaseResults` callable — domains/autograde.md §"Writes"). No
 * `tenantId` in the request (D2). Idempotent: the api-client injects an
 * `idempotencyKey` envelope; the body itself declares none.
 */
import { z } from "zod";
import {
  zObject,
  zExamId,
  zClassId,
  zSectionId,
  zAcademicSessionId,
  zEvaluationSettingsId,
  zSpaceId,
  zStoryPointId,
  zTimestamp,
  zExamStatus,
  ExamGradingConfigSchema,
} from "@levelup/domain";
import type { CallableDef } from "../../callable-def.js";
import { SaveExamResponseSchema } from "./_shared.js";
import type { SaveExamResponse } from "./_shared.js";

/** Mutable subset of an exam (server fills defaults, enforces post-publish locks). */
export const SaveExamDataSchema = zObject({
  title: z.string().optional(),
  subject: z.string().optional(),
  topics: z.array(z.string()).optional(),
  classIds: z.array(zClassId).optional(),
  sectionIds: z.array(zSectionId).optional(),
  examDate: zTimestamp.optional(),
  duration: z.number().int().optional(),
  academicSessionId: zAcademicSessionId.optional(),
  totalMarks: z.number().optional(),
  passingMarks: z.number().optional(),
  gradingConfig: ExamGradingConfigSchema.optional(),
  linkedSpaceId: zSpaceId.optional(),
  linkedSpaceTitle: z.string().optional(),
  linkedStoryPointId: zStoryPointId.optional(),
  status: zExamStatus.optional(),
  evaluationSettingsId: zEvaluationSettingsId.optional(),
  questionPaperImages: z.array(z.string()).optional(),
});
export type SaveExamData = z.infer<typeof SaveExamDataSchema>;

export const SaveExamRequestSchema = zObject({
  id: zExamId.optional(),
  data: SaveExamDataSchema,
});
export type SaveExamRequest = z.infer<typeof SaveExamRequestSchema>;

export const saveExamDef = {
  name: "v1.autograde.saveExam",
  module: "autograde",
  requestSchema: SaveExamRequestSchema,
  responseSchema: SaveExamResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  // ⚷ exam lifecycle (publish + post-publish-locked fields) is server-authoritative.
  authoritySensitive: true,
  invalidates: ["exams"],
} as const satisfies CallableDef<SaveExamRequest, SaveExamResponse>;
