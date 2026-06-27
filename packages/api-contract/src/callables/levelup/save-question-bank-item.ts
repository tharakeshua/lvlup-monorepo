/**
 * v1.levelup.saveQuestionBankItem — upsert a reusable bank question. `questionData`
 * is discriminated on `questionType` (imported from @levelup/domain).
 */
import { z } from "zod";
import { QuestionTypeDataSchema, zBloomsLevel, zDifficulty } from "@levelup/domain";
import { defineCallable } from "./_shared.js";
import { SaveOrDeleteResponseSchema, zQuestionType } from "./_shared.js";

export const SaveQuestionBankItemDataSchema = z
  .object({
    questionType: zQuestionType,
    title: z.string().optional(),
    content: z.string(),
    explanation: z.string().optional(),
    basePoints: z.number().optional(),
    questionData: QuestionTypeDataSchema,
    subject: z.string(),
    topics: z.array(z.string()),
    difficulty: zDifficulty,
    bloomsLevel: zBloomsLevel.optional(),
    tags: z.array(z.string()).optional(),
    deleted: z.boolean().optional(),
  })
  .strict();

export const SaveQuestionBankItemRequestSchema = z
  .object({
    id: z.string().optional(),
    data: SaveQuestionBankItemDataSchema,
  })
  .strict();
export type SaveQuestionBankItemRequest = z.infer<typeof SaveQuestionBankItemRequestSchema>;

export const SaveQuestionBankItemResponseSchema = SaveOrDeleteResponseSchema;
export type SaveQuestionBankItemResponse = z.infer<typeof SaveQuestionBankItemResponseSchema>;

export const saveQuestionBankItemDef = defineCallable<
  SaveQuestionBankItemRequest,
  SaveQuestionBankItemResponse
>({
  name: "v1.levelup.saveQuestionBankItem",
  module: "levelup",
  requestSchema: SaveQuestionBankItemRequestSchema,
  responseSchema: SaveQuestionBankItemResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["questionBank"],
  authoritySensitive: true,
});
