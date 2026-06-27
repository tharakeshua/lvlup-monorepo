/**
 * v1.levelup.saveTestAnswer — write-through a single in-progress answer / mark-for-
 * review to the `submissions/{itemId}` subcollection WITHOUT submitting (crash-
 * resume safety; web-student G2). Server-authoritative session write, idempotent,
 * NOT optimistic.
 */
import { z } from "zod";
import { defineCallable } from "./_shared.js";

export const SaveTestAnswerRequestSchema = z
  .object({
    sessionId: z.string(),
    itemId: z.string(),
    answer: z.unknown(),
    markedForReview: z.boolean().optional(),
    timeSpentSeconds: z.number().int().optional(),
  })
  .strict();
export type SaveTestAnswerRequest = z.infer<typeof SaveTestAnswerRequestSchema>;

export const SaveTestAnswerResponseSchema = z
  .object({
    sessionId: z.string(),
    itemId: z.string(),
    saved: z.literal(true),
    answeredQuestions: z.number().int(),
  })
  .strict();
export type SaveTestAnswerResponse = z.infer<typeof SaveTestAnswerResponseSchema>;

export const saveTestAnswerDef = defineCallable<SaveTestAnswerRequest, SaveTestAnswerResponse>({
  name: "v1.levelup.saveTestAnswer",
  module: "levelup",
  requestSchema: SaveTestAnswerRequestSchema,
  responseSchema: SaveTestAnswerResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  invalidates: ["testSessions"],
  authoritySensitive: true,
});
