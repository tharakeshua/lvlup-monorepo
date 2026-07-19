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
  // ⚷ Explicit REPLACE confirmation (owner directive 2026-07-19). When a submission
  // already exists for (examId, studentId), the server REJECTS the upload
  // (FAILED_PRECONDITION, `meta.reason='submission_exists'`) UNLESS `replace===true`.
  // A `replace` re-points the existing submission at the new answer sheets, resets its
  // grading/release state, and re-runs the pipeline — so released results are never
  // silently destroyed by a re-upload. Optional & absent-by-default → a scanner /
  // first-time upload is unaffected. See uploadAnswerSheetsService.
  replace: z.boolean().optional(),
});
export type UploadAnswerSheetsRequest = z.infer<typeof UploadAnswerSheetsRequestSchema>;

export const UploadAnswerSheetsResponseSchema = zObject({
  submissionId: zSubmissionId,
  // Outcome flag so the client can message honestly (created vs replaced). Optional
  // for wire back-compat with a pre-replace backend (older deploy omits it → treated
  // as a plain create).
  replaced: z.boolean().optional(),
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
  // Domain dedupe on (uid, examId, studentId, imageUrls-hash): a scanner network
  // retry (identical paths) is deduped, but a genuine RE-upload (new scan paths) runs
  // fresh — the one-submission-per-student invariant + released-result protection is
  // enforced in the service body, not by a permanent business key (which silently
  // swallowed re-uploads, owner directive 2026-07-19).
  idempotencyKey: "domain:examId+studentId+contentHash",
  // ⚷ creates the Submission + advances exam→grading + counters (server authority).
  authoritySensitive: true,
  invalidates: ["submissions", "exams"],
} as const satisfies CallableDef<UploadAnswerSheetsRequest, UploadAnswerSheetsResponse>;
