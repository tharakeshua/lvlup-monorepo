/**
 * v1.levelup.recordItemAttempt — the non-test practice/standard progress path.
 *
 * CD13 authority boundary: the client sends the raw learner `answer` ONLY — never
 * `score`/`maxScore`/`correct`. The server scores deterministically (or re-validates)
 * and writes progress via the single transactional progress-updater, returning the
 * resulting per-item progress + completion. Idempotent (server dedupes on
 * (uid, spaceId, storyPointId, itemId, answerHash)). ✅ conservative-optimistic.
 *
 * `idempotencyKey` is the ONE documented request-field carve-out (SDK-LAYERS §3.2).
 */
import { z } from "zod";
import { defineCallable } from "./_shared.js";
import { ItemProgressViewSchema } from "./_shared.js";

export const RecordItemAttemptRequestSchema = z
  .object({
    spaceId: z.string(),
    storyPointId: z.string(),
    itemId: z.string(),
    answer: z.unknown(),
    timeSpent: z.number().optional(),
  })
  .strict();
export type RecordItemAttemptRequest = z.infer<typeof RecordItemAttemptRequestSchema>;

export const RecordItemAttemptResponseSchema = z
  .object({
    progress: ItemProgressViewSchema,
    completed: z.boolean(),
  })
  .strict();
export type RecordItemAttemptResponse = z.infer<typeof RecordItemAttemptResponseSchema>;

export const recordItemAttemptDef = defineCallable<
  RecordItemAttemptRequest,
  RecordItemAttemptResponse
>({
  name: "v1.levelup.recordItemAttempt",
  module: "levelup",
  requestSchema: RecordItemAttemptRequestSchema,
  responseSchema: RecordItemAttemptResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "domain:spaceId,storyPointId,itemId,answer",
  invalidates: ["progress"],
  // authoritySensitive:true — recordItemAttempt writes a GRADING OUTPUT (server
  // scores per CD13 / REVIEW §6.5). It is the ONE documented carve-out that is
  // ALSO on the OPTIMISTIC_ALLOWLIST: the optimistic patch shows an in-flight
  // attempt and reconciles from the authoritative {progress,completed} response
  // (A11) — the client never sends a score. The authority-flag-coverage test
  // requires this flag AND explicitly excepts recordItemAttempt from the
  // optimistic∩authority disjointness check (§3.1 / §4.4 / §6.5).
  authoritySensitive: true,
});
