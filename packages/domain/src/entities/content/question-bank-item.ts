/**
 * QuestionBankItem — reusable bank question; `questionData` discriminated on
 * questionType. `usageCount`/`averageScore` are ⚷ counters.
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import { zQuestionBankItemId, zTenantId } from "../../primitives/branded-id.zod.js";
import { zTimestamp } from "../../primitives/timestamp.zod.js";
import { zQuestionType } from "../../enums/content.js";
import { zBloomsLevel, zDifficulty } from "../../enums/grading.js";
import { QuestionTypeDataSchema } from "./question-payload.js";

export const QuestionBankItemSchema = zObject({
  id: zQuestionBankItemId,
  tenantId: zTenantId,
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
  usageCount: z.number().int().default(0),
  averageScore: z.number().optional(),
  lastUsedAt: zTimestamp.nullable(),
  tags: z.array(z.string()).default([]),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
export type QuestionBankItem = z.infer<typeof QuestionBankItemSchema>;
