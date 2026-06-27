/**
 * LevelUp-module (content + testsession) contract kit.
 *
 * Re-exports the CORE authoring surface (`src/callable-def.ts` + `src/pagination.ts`
 * + `src/callables/core/_shared.ts`) so the per-callable defs in this folder author
 * against ONE canonical `defineCallable`, `CallableDef`, pagination fragment, and
 * `SaveResponse`. Adds the levelup-specific answer-stripped / authority-projected
 * VIEW schemas (derived from `@levelup/domain` — the contract never re-declares an
 * entity shape, it projects it).
 *
 * No request schema in this module declares `tenantId` (claim-derived) or, except
 * the documented `recordItemAttempt` carve-out, `idempotencyKey`.
 */
import { z } from "zod";
import {
  SpaceSchema,
  StoryPointSchema,
  UnifiedItemSchema,
  AnswerKeySchema,
  DigitalTestSessionSchema,
  TestSubmissionSchema,
  SpaceProgressSchema,
  StoryPointProgressDocSchema,
  StoryPointProgressSchema,
  StoredEvaluationSchema,
  ChatSessionSchema,
  ChatMessageSchema,
  RubricPresetSchema,
  AgentSchema,
  QuestionBankItemSchema,
  SpaceReviewSchema,
  StoreSpaceListingSchema,
  ContentVersionSchema,
  ItemPayloadSchema,
  UnifiedRubricSchema,
  ItemMetadataSchema,
  zItemType,
  zQuestionType,
  zSpaceStatus,
  zSpaceType,
  zTestSessionStatus,
} from "@levelup/domain";

// ── CORE authoring surface (canonical re-exports) ─────────────────────────
export { defineCallable } from "../../callable-def.js";
export type {
  CallableDef,
  ApiModule,
  RateTier,
  AuthMode,
  IdempotencyKeyHint,
} from "../../callable-def.js";
export { PageRequest, pageResponse, withPaging } from "../../pagination.js";
export type { PageRequestInput, PageRequestParsed, PageResponse } from "../../pagination.js";
export { SaveResponseSchema } from "../core/_shared.js";
export type { SaveResponse } from "../core/_shared.js";

import { SaveResponseSchema } from "../core/_shared.js";

/** Soft-delete variant returned when `data.deleted=true` (storyPoint/item/agent/...). */
export const SaveOrDeleteResponseSchema = z.union([
  SaveResponseSchema,
  z.object({ id: z.string(), deleted: z.literal(true) }).strict(),
]);
export type SaveOrDeleteResponse = z.infer<typeof SaveOrDeleteResponseSchema>;

// ── Answer-stripped / authority-projected VIEW schemas ────────────────────

/** SpaceView — full Space shape; server projects rubric guidance out for non-authoring. */
export const SpaceViewSchema = SpaceSchema;
export type SpaceView = z.infer<typeof SpaceViewSchema>;

export const StoryPointViewSchema = StoryPointSchema;
export type StoryPointView = z.infer<typeof StoryPointViewSchema>;

/** ItemView — answer-stripped projection (answer-bearing payload fields zeroed server-side). */
export const ItemViewSchema = UnifiedItemSchema;
export type ItemView = z.infer<typeof ItemViewSchema>;

/** ItemEditView — ⚷ re-merged authoring view (answer keys folded back); gated server-side. */
export const ItemEditViewSchema = UnifiedItemSchema.extend({
  // The ONE sanctioned answer-bearing read: getItemForEdit re-merges the ⚷ AnswerKey.
  answerKey: AnswerKeySchema.optional(),
});
export type ItemEditView = z.infer<typeof ItemEditViewSchema>;

/** DigitalTestSessionView — answer-key-free runtime projection. */
export const DigitalTestSessionViewSchema = DigitalTestSessionSchema;
export type DigitalTestSessionView = z.infer<typeof DigitalTestSessionViewSchema>;

/** Per-question result projection: StoredEvaluation only (never raw UnifiedEvaluationResult). */
export const TestSubmissionResultViewSchema = z
  .object({
    itemId: TestSubmissionSchema.shape.itemId,
    questionType: zQuestionType,
    answer: z.unknown(),
    correct: z.boolean().nullable(),
    pointsEarned: z.number().nullable(),
    totalPoints: z.number().nullable(),
    evaluation: StoredEvaluationSchema.nullable(),
    pending: z.boolean(),
  })
  .strict();
export type TestSubmissionResultView = z.infer<typeof TestSubmissionResultViewSchema>;

/** DigitalTestSessionResultView — submit/result projection (scores + analytics + per-q). */
export const DigitalTestSessionResultViewSchema = DigitalTestSessionSchema.extend({
  submissions: z.array(TestSubmissionResultViewSchema).default([]),
}).strict();
export type DigitalTestSessionResultView = z.infer<typeof DigitalTestSessionResultViewSchema>;

/** Compact list-summary for a session (no submissions). */
export const DigitalTestSessionSummaryViewSchema = z
  .object({
    id: DigitalTestSessionSchema.shape.id,
    spaceId: DigitalTestSessionSchema.shape.spaceId,
    storyPointId: DigitalTestSessionSchema.shape.storyPointId,
    sessionType: DigitalTestSessionSchema.shape.sessionType,
    status: zTestSessionStatus,
    attemptNumber: z.number().int(),
    isLatest: z.boolean(),
    percentage: z.number().optional(),
    startedAt: DigitalTestSessionSchema.shape.startedAt,
    submittedAt: DigitalTestSessionSchema.shape.submittedAt,
  })
  .strict();
export type DigitalTestSessionSummaryView = z.infer<typeof DigitalTestSessionSummaryViewSchema>;

/** SpaceProgressView — aggregate + storyPoint summaries (no item maps). */
export const SpaceProgressViewSchema = SpaceProgressSchema;
export type SpaceProgressView = z.infer<typeof SpaceProgressViewSchema>;

/** StoryPointProgressDocView — item-level detail (released/own-data projected). */
export const StoryPointProgressDocViewSchema = StoryPointProgressDocSchema;
export type StoryPointProgressDocView = z.infer<typeof StoryPointProgressDocViewSchema>;

/** StoryPointProgressView — summary-only. */
export const StoryPointProgressViewSchema = StoryPointProgressSchema;
export type StoryPointProgressView = z.infer<typeof StoryPointProgressViewSchema>;

/** ItemProgressView — the single-item attempt outcome surfaced by recordItemAttempt. */
export const ItemProgressViewSchema = z
  .object({
    itemId: z.string(),
    completed: z.boolean(),
    bestScore: z.number().optional(),
    latestScore: z.number().optional(),
    pointsEarned: z.number().optional(),
    totalPoints: z.number().optional(),
    percentage: z.number().optional(),
    attemptsCount: z.number().int().optional(),
    solved: z.boolean().optional(),
    evaluation: StoredEvaluationSchema.nullable(),
  })
  .strict();
export type ItemProgressView = z.infer<typeof ItemProgressViewSchema>;

/** AgentView — prompts/rules ⚷ stripped for non-authoring server-side (full shape on the wire). */
export const AgentViewSchema = AgentSchema;
export type AgentView = z.infer<typeof AgentViewSchema>;

/** ChatSessionSummary — list projection (no full message array). */
export const ChatSessionSummarySchema = z
  .object({
    id: ChatSessionSchema.shape.id,
    spaceId: ChatSessionSchema.shape.spaceId,
    storyPointId: ChatSessionSchema.shape.storyPointId,
    itemId: ChatSessionSchema.shape.itemId,
    sessionTitle: z.string(),
    previewMessage: z.string(),
    messageCount: z.number().int(),
    language: z.string(),
    isActive: z.boolean(),
    updatedAt: ChatSessionSchema.shape.updatedAt,
  })
  .strict();
export type ChatSessionSummary = z.infer<typeof ChatSessionSummarySchema>;

/** ChatSessionView — full session incl. messages (systemPrompt ⚷ stripped). */
export const ChatSessionViewSchema = ChatSessionSchema.omit({ systemPrompt: true }).strict();
export type ChatSessionView = z.infer<typeof ChatSessionViewSchema>;

// Re-export domain schemas consumed by defs in this module.
export {
  ChatMessageSchema,
  RubricPresetSchema,
  QuestionBankItemSchema,
  SpaceReviewSchema,
  StoreSpaceListingSchema,
  ContentVersionSchema,
  ItemPayloadSchema,
  UnifiedRubricSchema,
  ItemMetadataSchema,
  zItemType,
  zQuestionType,
  zSpaceStatus,
  zSpaceType,
  zTestSessionStatus,
};
