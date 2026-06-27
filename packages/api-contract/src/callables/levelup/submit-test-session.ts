/**
 * v1.levelup.submitTestSession — finalize a session; server grades deterministic
 * types, flags AI-pending, computes scores+analytics, writes progress. Idempotent
 * on (uid, sessionId): a re-submit returns the already-computed result. The client
 * submits ANSWERS; the server owns scores → authoritySensitive, NOT optimistic.
 */
import { z } from "zod";
import { defineCallable } from "./_shared.js";
import { DigitalTestSessionResultViewSchema } from "./_shared.js";

export const SubmitTestSessionRequestSchema = z
  .object({
    sessionId: z.string(),
    autoSubmitted: z.boolean().optional(),
  })
  .strict();
export type SubmitTestSessionRequest = z.infer<typeof SubmitTestSessionRequestSchema>;

export const SubmitTestSessionResponseSchema = z
  .object({
    session: DigitalTestSessionResultViewSchema,
    progressUpdated: z.boolean(),
  })
  .strict();
export type SubmitTestSessionResponse = z.infer<typeof SubmitTestSessionResponseSchema>;

export const submitTestSessionDef = defineCallable<
  SubmitTestSessionRequest,
  SubmitTestSessionResponse
>({
  name: "v1.levelup.submitTestSession",
  module: "levelup",
  requestSchema: SubmitTestSessionRequestSchema,
  responseSchema: SubmitTestSessionResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  invalidates: ["testSessions", "progress", "storyPoints", "analytics"],
  authoritySensitive: true,
});
