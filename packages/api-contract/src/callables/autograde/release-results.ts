/**
 * `v1.autograde.releaseResults` — dedicated, idempotent result-release callable
 * carved out of `saveExam` (domains/autograde.md §"Note on releaseResults"). Flips
 * `resultsReleased` on releasable submissions + sets exam `results_released` +
 * enqueues an outbox notification. Gated server-side on the SUBMISSION pipeline
 * status only (fixes the `'grading_complete'`-as-exam-status bug). No `tenantId` (D2).
 */
import { z } from "zod";
import { zObject, zExamId, zClassId } from "@levelup/domain";
import type { CallableDef } from "../../callable-def.js";

export const ReleaseResultsRequestSchema = zObject({
  examId: zExamId,
  classIds: z.array(zClassId).optional(),
});
export type ReleaseResultsRequest = z.infer<typeof ReleaseResultsRequestSchema>;

export const ReleaseResultsResponseSchema = zObject({
  id: zExamId,
  releasedCount: z.number().int(),
  created: z.literal(false),
});
export type ReleaseResultsResponse = z.infer<typeof ReleaseResultsResponseSchema>;

export const releaseResultsDef = {
  name: "v1.autograde.releaseResults",
  module: "autograde",
  requestSchema: ReleaseResultsRequestSchema,
  responseSchema: ReleaseResultsResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  // domain dedupe on examId so a double-tap release flips the gate once.
  idempotencyKey: "domain:examId",
  // ⚷ flips resultsReleased + exam status + outbox notification (server authority).
  authoritySensitive: true,
  invalidates: ["exams", "submissions"],
} as const satisfies CallableDef<ReleaseResultsRequest, ReleaseResultsResponse>;
