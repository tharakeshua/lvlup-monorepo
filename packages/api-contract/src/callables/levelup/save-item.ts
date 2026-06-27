/**
 * v1.levelup.saveItem — upsert a content Item. `data.payload` is the REAL two-level
 * `z.discriminatedUnion` (top-level item `type`, nested question/material subtypes)
 * imported from `@levelup/domain` — the most important content-core contract.
 *
 * The authoring payload carries answer-bearing fields; the server extracts them
 * into the ⚷ AnswerKey subcollection on save. This is the ONLY callable whose
 * request carries answers — authoritySensitive, NOT optimistic.
 */
import { z } from "zod";
import { zDifficulty } from "@levelup/domain";
import { defineCallable } from "./_shared.js";
import {
  SaveOrDeleteResponseSchema,
  ItemPayloadSchema,
  ItemMetadataSchema,
  zItemType,
} from "./_shared.js";

export const SaveItemDataSchema = z
  .object({
    type: zItemType,
    payload: ItemPayloadSchema,
    title: z.string().optional(),
    content: z.string().optional(),
    difficulty: zDifficulty.optional(),
    topics: z.array(z.string()).optional(),
    labels: z.array(z.string()).optional(),
    orderIndex: z.number().int().optional(),
    sectionId: z.string().optional(),
    meta: ItemMetadataSchema.optional(),
    rubricId: z.string().optional(),
    linkedQuestionId: z.string().optional(),
    deleted: z.boolean().optional(),
  })
  .strict();

export const SaveItemRequestSchema = z
  .object({
    id: z.string().optional(),
    spaceId: z.string(),
    storyPointId: z.string(),
    data: SaveItemDataSchema,
  })
  .strict();
export type SaveItemRequest = z.infer<typeof SaveItemRequestSchema>;

export const SaveItemResponseSchema = SaveOrDeleteResponseSchema;
export type SaveItemResponse = z.infer<typeof SaveItemResponseSchema>;

export const saveItemDef = defineCallable<SaveItemRequest, SaveItemResponse>({
  name: "v1.levelup.saveItem",
  module: "levelup",
  requestSchema: SaveItemRequestSchema,
  responseSchema: SaveItemResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["items", "storyPoints", "versions"],
  authoritySensitive: true,
});
