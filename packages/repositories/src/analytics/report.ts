/**
 * `reportRepo` — command repo for the server-authoritative PDF artifacts
 * (SDK-LAYERS-PLAN §4.1, analytics.md §reportRepo).
 *
 * Reports are generated + signed server-side (`generateReportService`); the repo
 * issues the `v1.analytics.generateReport` call with the correct `type` and
 * returns `{ pdfUrl, expiresAt }`. **NEVER optimistic** (expensive, authoritative
 * artifact); the callable is idempotent (the api-client UUIDv7 envelope dedupes
 * the expensive PDF gen on retry — no client `idempotencyKey` field, MERGE-
 * IDEMPOTENCY). Methods use the `get*` verb (they fetch a generated artifact).
 *
 * Per-entity repo — imports `api` + `@levelup/domain` ONLY; never a sibling repo
 * (R6).
 */
import type { ClassId, ExamId, StudentId } from "@levelup/domain";
import type { ApiClient, GenerateReportResponse } from "./api-types.js";

export interface ReportRepo {
  /** Exam-result PDF for an exam (optionally scoped to one student). */
  getExamReport(input: { examId: ExamId; studentId?: StudentId }): Promise<GenerateReportResponse>;
  /** Student progress PDF. */
  getProgressReport(input: { studentId: StudentId }): Promise<GenerateReportResponse>;
  /** Class report PDF. */
  getClassReport(input: { classId: ClassId }): Promise<GenerateReportResponse>;
}

export function createReportRepo(api: ApiClient): ReportRepo {
  return {
    getExamReport: ({ examId, studentId }) =>
      api.analytics.generateReport({
        type: "exam-result",
        examId,
        ...(studentId !== undefined ? { studentId } : {}),
      }),

    getProgressReport: ({ studentId }) =>
      api.analytics.generateReport({ type: "progress", studentId }),

    getClassReport: ({ classId }) => api.analytics.generateReport({ type: "class", classId }),
  };
}
