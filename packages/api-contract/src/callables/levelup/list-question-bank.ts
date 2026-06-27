/**
 * v1.levelup.listQuestionBank — paginated, filtered QuestionBankItem list.
 */
import { z } from "zod";
import { zDifficulty, zBloomsLevel } from "@levelup/domain";
import { defineCallable } from "./_shared.js";
import { withPaging, pageResponse } from "./_shared.js";

import { QuestionBankItemSchema, zQuestionType } from "./_shared.js";

export const QuestionBankFilterSchema = z
  .object({
    questionType: zQuestionType.optional(),
    subject: z.string().optional(),
    difficulty: zDifficulty.optional(),
    bloomsLevel: zBloomsLevel.optional(),
    topic: z.string().optional(),
    search: z.string().optional(),
  })
  .strict();

export const ListQuestionBankRequestSchema = withPaging(QuestionBankFilterSchema);
export type ListQuestionBankRequest = z.infer<typeof ListQuestionBankRequestSchema>;

export const ListQuestionBankResponseSchema = pageResponse(QuestionBankItemSchema);
export type ListQuestionBankResponse = z.infer<typeof ListQuestionBankResponseSchema>;

export const listQuestionBankDef = defineCallable<
  ListQuestionBankRequest,
  ListQuestionBankResponse
>({
  name: "v1.levelup.listQuestionBank",
  module: "levelup",
  requestSchema: ListQuestionBankRequestSchema,
  responseSchema: ListQuestionBankResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
