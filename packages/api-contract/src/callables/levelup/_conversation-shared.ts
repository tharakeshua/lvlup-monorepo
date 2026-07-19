/**
 * Shared strict conversational callable fragments. Durable/private schemas stay
 * in @levelup/domain; this module exposes only request inputs and learner-safe
 * projections for the six callable contracts.
 */
import { z } from "zod";
import {
  ConversationMessageViewSchema,
  ConversationSessionSummaryViewSchema,
  ConversationSessionViewSchema,
  ConversationTurnViewSchema,
  ItemSubmissionViewSchema,
  StartConversationContextSchema,
  zConversationMode,
  zConversationSessionStatus,
  zJsonValue,
} from "@levelup/domain";

export {
  ConversationMessageViewSchema,
  ConversationSessionSummaryViewSchema,
  ConversationSessionViewSchema,
  ConversationTurnViewSchema,
  ItemSubmissionViewSchema,
  StartConversationContextSchema,
  zConversationMode,
  zConversationSessionStatus,
};
export type {
  ConversationMessageView,
  ConversationSessionSummaryView,
  ConversationSessionView,
  ConversationTurnView,
  ItemSubmissionView,
  StartConversationContext,
  ConversationMode,
  ConversationSessionStatus,
} from "@levelup/domain";

/** Phases 1–5 use only the existing image gateway seam; audio is intentionally absent. */
export const ConversationMediaInputSchema = z
  .object({
    mediaKind: z.literal("image"),
    storagePath: z.string().min(1),
    mimeType: z.string().min(1),
    altText: z.string().optional(),
  })
  .strict();
export type ConversationMediaInput = z.infer<typeof ConversationMediaInputSchema>;

export const QuestionHelpDraftSnapshotSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    answer: zJsonValue,
  })
  .strict();
export type QuestionHelpDraftSnapshot = z.infer<typeof QuestionHelpDraftSnapshotSchema>;
