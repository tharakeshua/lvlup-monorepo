/**
 * v1.levelup.saveSpace — upsert a Space (create/update; `data.deleted` soft-deletes).
 * No tenantId (claim-derived). Lifecycle/publish is ⚷ server-enforced via
 * ALLOWED_TRANSITIONS.space — hence authoritySensitive + NOT optimistic.
 */
import { z } from "zod";
import { zMoney } from "@levelup/domain";
import { defineCallable } from "./_shared.js";
import { SaveResponseSchema, zSpaceStatus, zSpaceType } from "./_shared.js";

export const SaveSpaceDataSchema = z
  .object({
    // OPTIONAL so a PARTIAL update (e.g. a status-only lifecycle move on an
    // existing space) is schema-valid; the service requires title+type on CREATE
    // and merges them from the stored space on UPDATE (saveSpace IS the transition
    // verb — there is no separate publishSpace/archiveSpace).
    title: z.string().min(1).max(200).optional(),
    type: zSpaceType.optional(),
    description: z.string().optional(),
    thumbnailUrl: z.string().optional(),
    slug: z.string().optional(),
    subject: z.string().optional(),
    labels: z.array(z.string()).optional(),
    classIds: z.array(z.string()).optional(),
    sectionIds: z.array(z.string()).optional(),
    teacherIds: z.array(z.string()).optional(),
    accessType: z.enum(["class_assigned", "tenant_wide", "public_store"]).optional(),
    academicSessionId: z.string().optional(),
    defaultEvaluatorAgentId: z.string().optional(),
    defaultTutorAgentId: z.string().optional(),
    defaultRubricId: z.string().optional(),
    status: zSpaceStatus.optional(),
    publishedToStore: z.boolean().optional(),
    price: zMoney.optional(),
    storeDescription: z.string().optional(),
    storeThumbnailUrl: z.string().optional(),
    deleted: z.boolean().optional(),
  })
  .strict();

export const SaveSpaceRequestSchema = z
  .object({
    id: z.string().optional(),
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
