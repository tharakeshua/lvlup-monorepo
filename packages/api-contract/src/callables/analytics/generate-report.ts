/**
 * v1.analytics.generateReport — server-authoritative PDF artifact.
 * `type` discriminates exam-result / progress / class. Idempotent (dedupe expensive
 * PDF gen on retry; UUIDv7 rides the api-client envelope — no idempotencyKey field).
 * Returns a signed URL + `expiresAt` (1h TTL). Plan: §2.6 L87, common-api §155.
 */
import { z } from "zod";
import { zObject, zExamId, zStudentId, zClassId, zTimestamp } from "@levelup/domain";
import { defineCallable } from "../../callable-def.js";

export const GenerateReportRequestSchema = zObject({
  type: z.enum(["exam-result", "progress", "class"]),
  examId: zExamId.optional(),
  studentId: zStudentId.optional(),
  classId: zClassId.optional(),
});
export type GenerateReportRequest = z.infer<typeof GenerateReportRequestSchema>;

export const GenerateReportResponseSchema = zObject({
  pdfUrl: z.string(),
  expiresAt: zTimestamp,
});
export type GenerateReportResponse = z.infer<typeof GenerateReportResponseSchema>;

export const generateReport = defineCallable({
  name: "v1.analytics.generateReport",
  module: "analytics",
  requestSchema: GenerateReportRequestSchema,
  responseSchema: GenerateReportResponseSchema,
  authMode: "authed",
  rateTier: "report",
  idempotent: true,
});
