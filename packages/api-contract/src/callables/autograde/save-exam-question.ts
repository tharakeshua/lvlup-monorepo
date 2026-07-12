/**
 * `v1.autograde.saveExamQuestion` — create/update/delete a single exam question.
 *
 * Idempotent (transport key). Enforces `exam.write` authority and POST_PUBLISH_LOCKED
 * semantics server-side (structural fields locked after publish). No `tenantId` in
 * the request (D2). Delete via `{ id, examId, delete: true }`.
 */
import { z } from "zod";
import {
  zObject,
  zExamId,
  zExamQuestionId,
  UnifiedRubricSchema,
  SubQuestionSchema,
  zQuestionType,
} from "@levelup/domain";
import type { CallableDef } from "../../callable-def.js";
import { SaveExamQuestionResponseSchema } from "./_shared.js";
import type { SaveExamQuestionResponse } from "./_shared.js";

/** Mutable subset of an exam question (server fills defaults, enforces post-publish locks). */
export const SaveExamQuestionDataSchema = zObject({
  text: z.string().optional(),
  maxMarks: z.number().optional(),
  order: z.number().int().optional(),
  questionType: zQuestionType.optional(),
  rubric: UnifiedRubricSchema.optional(),
  subQuestions: z.array(SubQuestionSchema).optional(),
  /** Storage paths under `tenants/{tenantId}/` — validated server-side. */
  imageUrls: z.array(z.string()).optional(),
});
export type SaveExamQuestionData = z.infer<typeof SaveExamQuestionDataSchema>;

export const SaveExamQuestionRequestSchema = zObject({
  /** Omit to create (server assigns deterministic `{examId}_q{order}`). */
  id: zExamQuestionId.optional(),
  examId: zExamId,
  /** Required for create/update; omitted for delete. */
  data: SaveExamQuestionDataSchema.optional(),
  /** Set to `true` to delete the question (requires `id`). */
  delete: z.literal(true).optional(),
});
export type SaveExamQuestionRequest = z.infer<typeof SaveExamQuestionRequestSchema>;

export const saveExamQuestionDef = {
  name: "v1.autograde.saveExamQuestion",
  module: "autograde",
  requestSchema: SaveExamQuestionRequestSchema,
  responseSchema: SaveExamQuestionResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  // ⚷ structural question edits / delete affect exam publish-readiness.
  authoritySensitive: true,
  invalidates: ["questions"],
} as const satisfies CallableDef<SaveExamQuestionRequest, SaveExamQuestionResponse>;
