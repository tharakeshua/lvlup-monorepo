/**
 * `v1.autograde.resolveDeadLetter` — resolve a grading DLQ entry. `method`:
 *   - `retry`:        re-enqueue the failed pipeline step (→ `retry_success`).
 *   - `manual_grade`: mark resolved via a manual override (→ `manual_grade`).
 *   - `dismiss`:      dismiss without grading (→ `dismissed`).
 *
 * The request `method` is the operator intent; the response `resolution` is the
 * persisted `DeadLetterResolutionMethod`. No `tenantId` (D2). Idempotent.
 */
import { z } from "zod";
import { zObject, zDeadLetterEntryId, DEAD_LETTER_RESOLUTION_METHODS } from "@levelup/domain";
import type { CallableDef } from "../../callable-def.js";

export const RESOLVE_DEAD_LETTER_METHODS = ["retry", "manual_grade", "dismiss"] as const;

export const ResolveDeadLetterRequestSchema = zObject({
  entryId: zDeadLetterEntryId,
  method: z.enum(RESOLVE_DEAD_LETTER_METHODS),
});
export type ResolveDeadLetterRequest = z.infer<typeof ResolveDeadLetterRequestSchema>;

export const ResolveDeadLetterResponseSchema = zObject({
  success: z.boolean(),
  resolution: z.enum(DEAD_LETTER_RESOLUTION_METHODS),
});
export type ResolveDeadLetterResponse = z.infer<typeof ResolveDeadLetterResponseSchema>;

export const resolveDeadLetterDef = {
  name: "v1.autograde.resolveDeadLetter",
  module: "autograde",
  requestSchema: ResolveDeadLetterRequestSchema,
  responseSchema: ResolveDeadLetterResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  // domain dedupe on entryId so re-resolving a resolved entry is a no-op.
  idempotencyKey: "domain:entryId",
  // ⚷ re-enqueues a grading step / marks DLQ resolved (submission.grade authority).
  authoritySensitive: true,
  invalidates: ["gradingDeadLetter", "submissions"],
} as const satisfies CallableDef<ResolveDeadLetterRequest, ResolveDeadLetterResponse>;
