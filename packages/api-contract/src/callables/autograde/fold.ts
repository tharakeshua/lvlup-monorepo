/**
 * Core-owned autograde C-fold callable defs (SDK-LAYERS-PLAN §3.2 autograde fold
 * / §3.7 Storage seam C1 / C16).
 *
 * `requestUploadUrl` (C1 — the signed-PUT Storage seam) and `getSubmissionForExam`
 * (C16 — released-gated single-submission read for a given exam) sit under
 * `module: 'autograde'`. Authored here by the contract core (mirrors the levelup
 * gamification fold) and spread into `CALLABLES` so the closed callable set
 * matches the fixture inventory. No `tenantId` in either request (claim-derived).
 */
import { z } from "zod";
import { SubmissionSchema } from "@levelup/domain";
import { defineCallable } from "../../callable-def.js";

// ---- C1: Storage signed-upload-URL seam ----
export const RequestUploadUrlRequestSchema = z
  .object({
    kind: z.enum(["answer-sheet", "question-paper"]),
    examId: z.string(),
    studentId: z.string().optional(),
    classId: z.string().optional(),
    contentType: z.string(),
  })
  .strict();
export type RequestUploadUrlRequest = z.infer<typeof RequestUploadUrlRequestSchema>;
export const RequestUploadUrlResponseSchema = z
  .object({ uploadUrl: z.string(), path: z.string(), expiresAt: z.string() })
  .strict();
export type RequestUploadUrlResponse = z.infer<typeof RequestUploadUrlResponseSchema>;

export const requestUploadUrlDef = defineCallable<
  RequestUploadUrlRequest,
  RequestUploadUrlResponse
>({
  name: "v1.autograde.requestUploadUrl",
  module: "autograde",
  requestSchema: RequestUploadUrlRequestSchema,
  responseSchema: RequestUploadUrlResponseSchema,
  authMode: "authed",
  rateTier: "write",
  // No cache invalidation: a signed URL is a transient grant, never persisted state.
});

// ---- C16: released-gated single submission read for an exam ----
export const GetSubmissionForExamRequestSchema = z
  .object({ examId: z.string(), studentId: z.string() })
  .strict();
export type GetSubmissionForExamRequest = z.infer<typeof GetSubmissionForExamRequestSchema>;
export const GetSubmissionForExamResponseSchema = SubmissionSchema.nullable();
export type GetSubmissionForExamResponse = z.infer<typeof GetSubmissionForExamResponseSchema>;

export const getSubmissionForExamDef = defineCallable<
  GetSubmissionForExamRequest,
  GetSubmissionForExamResponse
>({
  name: "v1.autograde.getSubmissionForExam",
  module: "autograde",
  requestSchema: GetSubmissionForExamRequestSchema,
  responseSchema: GetSubmissionForExamResponseSchema,
  authMode: "authed",
  rateTier: "read",
});

/** Named record of the core-owned autograde fold (spread into CALLABLES). */
export const AUTOGRADE_FOLD_CALLABLES = {
  "v1.autograde.requestUploadUrl": requestUploadUrlDef,
  "v1.autograde.getSubmissionForExam": getSubmissionForExamDef,
} as const;
