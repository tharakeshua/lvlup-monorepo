/**
 * v1.levelup.saveSpace — upsert a Space (create/update; `data.deleted` soft-deletes).
 * No tenantId (claim-derived). Lifecycle/publish is ⚷ server-enforced via
 * ALLOWED_TRANSITIONS.space — hence authoritySensitive + NOT optimistic.
 */
import { z } from "zod";
import { SpaceSchema } from "@levelup/domain";
import { defineCallable } from "./_shared.js";
import { SaveResponseSchema } from "./_shared.js";

/**
 * The client-mutable Space projection is derived from the domain entity. Inline
 * `defaultRubric` is an explicitly supported resolved snapshot; `defaultRubricId`
 * remains the optional preset provenance.
 */
export const SaveSpaceDataSchema = SpaceSchema.pick({
  title: true,
  type: true,
  description: true,
  thumbnailUrl: true,
  slug: true,
  subject: true,
  labels: true,
  classIds: true,
  sectionIds: true,
  teacherIds: true,
  accessType: true,
  academicSessionId: true,
  defaultEvaluatorAgentId: true,
  defaultTutorAgentId: true,
  defaultRubric: true,
  defaultRubricId: true,
  evaluationSettingsId: true,
  allowRetakes: true,
  maxRetakes: true,
  defaultTimeLimitMinutes: true,
  showCorrectAnswers: true,
  status: true,
  publishedToStore: true,
  price: true,
  storeDescription: true,
  storeThumbnailUrl: true,
})
  .partial()
  .extend({
    deleted: z.boolean().optional(),
  })
  .strict();

export const SaveSpaceRequestSchema = z
  .object({
    id: SpaceSchema.shape.id.optional(),
    data: SaveSpaceDataSchema,
  })
  .strict();
export type SaveSpaceRequest = z.infer<typeof SaveSpaceRequestSchema>;

export const SaveSpaceResponseSchema = SaveResponseSchema;
export type SaveSpaceResponse = z.infer<typeof SaveSpaceResponseSchema>;

export const saveSpaceDef = defineCallable<SaveSpaceRequest, SaveSpaceResponse>({
  name: "v1.levelup.saveSpace",
  module: "levelup",
  requestSchema: SaveSpaceRequestSchema,
  responseSchema: SaveSpaceResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["spaces", "store"],
  authoritySensitive: true,
});
