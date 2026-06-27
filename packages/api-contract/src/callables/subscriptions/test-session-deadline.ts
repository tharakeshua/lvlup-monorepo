/**
 * v1.levelup.testSessionDeadline — server-computed countdown for a timed test.
 *
 * Projection doc `tenants/{t}/.../sessions/{id}/live` written by startTestSession.
 * SLIM: server-computed remaining time + the authoritative deadline + status.
 * **No answers, no question bodies** — the live channel never carries test content.
 *
 * Plan: SDK-LAYERS-PLAN §3.3 (testSessionDeadline row) / api-contract-core §7.2.
 */
import { z } from "zod";
import { zObject, zTestSessionStatus } from "@levelup/domain";
import { defineSubscription } from "../../subscriptions/subscription-def.js";

/** `{remainingMs, serverDeadline, status}` (server-computed; no answers). */
export const TestSessionLiveSchema = zObject({
  /** Server-computed milliseconds remaining; clamped to 0 at/after the deadline. */
  remainingMs: z.number().int().min(0),
  /** Authoritative deadline as an ISO-8601 string (the client never owns the clock). */
  serverDeadline: z.string(),
  status: zTestSessionStatus,
});
export type TestSessionLive = z.infer<typeof TestSessionLiveSchema>;

export const TestSessionDeadlineParamsSchema = zObject({ sessionId: z.string() });
export type TestSessionDeadlineParams = z.infer<typeof TestSessionDeadlineParamsSchema>;

export const testSessionDeadline = defineSubscription({
  name: "v1.levelup.testSessionDeadline",
  module: "levelup",
  source: "firestore-doc",
  params: TestSessionDeadlineParamsSchema,
  payload: TestSessionLiveSchema,
});
