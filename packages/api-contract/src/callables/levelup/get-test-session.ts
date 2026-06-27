/**
 * v1.levelup.getTestSession — live runtime view (answer-key-free; result fields
 * populated when status !== 'in_progress').
 */
import { z } from "zod";
import { defineCallable } from "./_shared.js";
import { DigitalTestSessionViewSchema } from "./_shared.js";

export const GetTestSessionRequestSchema = z.object({ sessionId: z.string() }).strict();
export type GetTestSessionRequest = z.infer<typeof GetTestSessionRequestSchema>;

export const GetTestSessionResponseSchema = z
  .object({ session: DigitalTestSessionViewSchema })
  .strict();
export type GetTestSessionResponse = z.infer<typeof GetTestSessionResponseSchema>;

export const getTestSessionDef = defineCallable<GetTestSessionRequest, GetTestSessionResponse>({
  name: "v1.levelup.getTestSession",
  module: "levelup",
  requestSchema: GetTestSessionRequestSchema,
  responseSchema: GetTestSessionResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
