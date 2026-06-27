/**
 * `v1.autograde.uploadAnswerSheets` — the SINGLE canonical answer-sheet ingestion
 * path (scanner-rn calls this exact method with storage paths; it never writes the
 * submission doc — D12 / spec §6). `imageUrls` are tenant storage paths (1..50);
 * the server validates they sit within `tenants/{ctx.tenantId}/`. Scanner role
 * allowed. No `tenantId` in the request (D2). AI tier, idempotent.
 */
import { z } from "zod";
import { zObject, zExamId, zStudentId, zClassId, zSubmissionId } from "@levelup/domain";
import type { CallableDef } from "../../callable-def.js";

export const UploadAnswerSheetsRequestSchema = zObject({
  examId: zExamId,
  studentId: zStudentId,
  classId: zClassId,
  imageUrls: z.array(z.string()).min(1).max(50),
});
export type UploadAnswerSheetsRequest = z.infer<typeof UploadAnswerSheetsRequestSchema>;

export const UploadAnswerSheetsResponseSchema = zObject({
  submissionId: zSubmissionId,
});
export type UploadAnswerSheetsResponse = z.infer<typeof UploadAnswerSheetsResponseSchema>;

export const uploadAnswerSheetsDef = {
  name: "v1.autograde.uploadAnswerSheets",
  module: "autograde",
  requestSchema: UploadAnswerSheetsRequestSchema,
  responseSchema: UploadAnswerSheetsResponseSchema,
  authMode: "authed",
  rateTier: "ai",
  idempotent: true,
  // domain dedupe on (uid, examId, studentId) so a scanner retry never double-creates.
  idempotencyKey: "domain:examId+studentId",
  // ⚷ creates the Submission + advances exam→grading + counters (server authority).
  authoritySensitive: true,
  invalidates: ["submissions", "exams"],
} as const satisfies CallableDef<UploadAnswerSheetsRequest, UploadAnswerSheetsResponse>;
