/**
 * v1.levelup.startTestSession — begin (or resume) a test/quiz/practice session.
 * Server owns the clock: `serverDeadline`, `attemptNumber`, `isLatest`, ordering.
 * Idempotent resume on (uid, spaceId, storyPointId). authoritySensitive (session
 * authority) → NOT optimistic.
 */
import { z } from "zod";
import { defineCallable } from "./_shared.js";
import { DigitalTestSessionViewSchema } from "./_shared.js";

export const StartTestSessionRequestSchema = z
  .object({
    spaceId: z.string(),
    storyPointId: z.string(),
  })
  .strict();
export type StartTestSessionRequest = z.infer<typeof StartTestSessionRequestSchema>;

export const StartTestSessionResponseSchema = z
  .object({
    session: DigitalTestSessionViewSchema,
    resuming: z.boolean(),
  })
  .strict();
export type StartTestSessionResponse = z.infer<typeof StartTestSessionResponseSchema>;

export const startTestSessionDef = defineCallable<
  StartTestSessionRequest,
  StartTestSessionResponse
>({
  name: "v1.levelup.startTestSession",
  module: "levelup",
  requestSchema: StartTestSessionRequestSchema,
  responseSchema: StartTestSessionResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  invalidates: ["testSessions", "progress"],
  authoritySensitive: true,
});
