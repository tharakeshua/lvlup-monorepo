/**
 * v1.levelup.assignContent — assign a space/exam to classes with an availability
 * window + visibility (SDK-LAYERS C12). Models the content↔class junction window
 * (`startAt`/`dueAt`) the assignment tracker reads. Idempotent upsert.
 */
import { z } from "zod";
import { defineCallable } from "./_shared.js";
import { SaveResponseSchema } from "./_shared.js";

export const AssignContentWindowSchema = z
  .object({
    startAt: z.string().datetime().optional(),
    dueAt: z.string().datetime().optional(),
  })
  .strict();

export const AssignContentRequestSchema = z
  .object({
    contentType: z.enum(["space", "exam"]),
    contentId: z.string(),
    classIds: z.array(z.string()).min(1),
    window: AssignContentWindowSchema.optional(),
    visibility: z.enum(["visible", "hidden", "scheduled"]).optional(),
  })
  .strict();
export type AssignContentRequest = z.infer<typeof AssignContentRequestSchema>;

export const AssignContentResponseSchema = SaveResponseSchema;
export type AssignContentResponse = z.infer<typeof AssignContentResponseSchema>;

export const assignContentDef = defineCallable<AssignContentRequest, AssignContentResponse>({
  name: "v1.levelup.assignContent",
  module: "levelup",
  requestSchema: AssignContentRequestSchema,
  responseSchema: AssignContentResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  invalidates: ["assignment", "spaces", "exams"],
});
