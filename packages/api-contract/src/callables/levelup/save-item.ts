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
import { AgentAssessmentAnswerKeyDataSchema, UnifiedItemSchema } from "@levelup/domain";
import { defineCallable } from "./_shared.js";
import { SaveOrDeleteResponseSchema } from "./_shared.js";

/**
 * Partial by design: create, edit, reorder/move, and soft-delete share this verb.
 * The service requires type/payload on create. Inline `rubric` snapshots and
 * `attachments` are explicitly persisted item fields (not client-only metadata).
 */
export const SaveItemDataSchema = UnifiedItemSchema.pick({
  type: true,
  payload: true,
  title: true,
  content: true,
  difficulty: true,
  topics: true,
  labels: true,
  orderIndex: true,
  sectionId: true,
  meta: true,
  rubric: true,
  rubricId: true,
  linkedQuestionId: true,
  attachments: true,
})
  .partial()
  .extend({
    /**
     * Private chat-agent assessment data. It is written into the deny-all
     * answer-key document by the service and never appears in learner ItemView.
     */
    answerKey: AgentAssessmentAnswerKeyDataSchema.optional(),
    deleted: z.boolean().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.type !== undefined && data.payload !== undefined && data.type !== data.payload.type) {
      ctx.addIssue({
        code: "custom",
        message: "type must match payload.type",
        path: ["type"],
      });
    }
    if (
      data.answerKey !== undefined &&
      data.payload !== undefined &&
      (data.payload.type !== "question" ||
        data.payload.questionData.questionType !== "chat_agent_question")
    ) {
      ctx.addIssue({
        code: "custom",
        message: "answerKey is only valid for a chat_agent_question payload",
        path: ["answerKey"],
      });
    }
  });

export const SaveItemRequestSchema = z
  .object({
    id: UnifiedItemSchema.shape.id.optional(),
    spaceId: UnifiedItemSchema.shape.spaceId,
    storyPointId: UnifiedItemSchema.shape.storyPointId,
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
