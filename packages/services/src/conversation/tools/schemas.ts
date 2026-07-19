/** Strict tool argument schemas and provider declarations for the bounded loop. */
import { z } from "zod";

export const EmptyArgsSchema = z.object({}).strict();

export const RecommendLearningContentArgsSchema = z
  .object({
    itemId: z.string().min(1).optional(),
    reason: z.string().min(1).max(500).optional(),
  })
  .strict();

export const RecordHintUsageArgsSchema = z
  .object({
    category: z.enum(["conceptual", "strategy", "clarification", "example"]),
  })
  .strict();

export const RecordEvidenceArgsSchema = z
  .object({
    objectiveId: z.string().min(1),
    rubricDimensionId: z.string().min(1),
    messageSequences: z.array(z.number().int().positive()).min(1).max(8),
    note: z.string().min(1).max(1_000),
    confidence: z.number().min(0).max(1),
  })
  .strict();
export type RecordEvidenceArgs = z.infer<typeof RecordEvidenceArgsSchema>;

export const RecommendCompletionArgsSchema = z
  .object({
    reason: z.enum(["objectives_covered", "learner_requested", "insufficient_new_evidence"]),
    coveredObjectiveIds: z.array(z.string().min(1)).max(32),
    remainingObjectiveIds: z.array(z.string().min(1)).max(32),
  })
  .strict();
export type RecommendCompletionArgs = z.infer<typeof RecommendCompletionArgsSchema>;

export interface ProviderToolDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const TOOL_DECLARATIONS: Record<string, ProviderToolDeclaration> = {
  retrieve_scope_context: {
    name: "retrieve_scope_context",
    description: "Retrieve concise learner-visible context for this exact conversation scope.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  get_learner_visible_progress_summary: {
    name: "get_learner_visible_progress_summary",
    description: "Retrieve only the learner's own safe progress summary for this space.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  recommend_learning_content: {
    name: "recommend_learning_content",
    description: "Recommend a content item already available in the current authorized scope.",
    parameters: {
      type: "object",
      properties: {
        itemId: { type: "string" },
        reason: { type: "string", maxLength: 500 },
      },
      additionalProperties: false,
    },
  },
  retrieve_item_context: {
    name: "retrieve_item_context",
    description: "Retrieve the learner-visible question context for the exact help item.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  record_hint_usage: {
    name: "record_hint_usage",
    description:
      "Record a bounded hint category for this help turn; never evaluate a learner draft.",
    parameters: {
      type: "object",
      properties: {
        category: { type: "string", enum: ["conceptual", "strategy", "clarification", "example"] },
      },
      required: ["category"],
      additionalProperties: false,
    },
  },
  record_evidence: {
    name: "record_evidence",
    description:
      "Stage evidence linked to valid frozen assessment objectives and transcript messages. Never score.",
    parameters: {
      type: "object",
      properties: {
        objectiveId: { type: "string" },
        rubricDimensionId: { type: "string" },
        messageSequences: {
          type: "array",
          items: { type: "integer", minimum: 1 },
          minItems: 1,
          maxItems: 8,
        },
        note: { type: "string", minLength: 1, maxLength: 1000 },
        confidence: { type: "number", minimum: 0, maximum: 1 },
      },
      required: ["objectiveId", "rubricDimensionId", "messageSequences", "note", "confidence"],
      additionalProperties: false,
    },
  },
  recommend_completion: {
    name: "recommend_completion",
    description:
      "Recommend, but never perform, assessment completion after objectives are covered.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          enum: ["objectives_covered", "learner_requested", "insufficient_new_evidence"],
        },
        coveredObjectiveIds: { type: "array", items: { type: "string" }, maxItems: 32 },
        remainingObjectiveIds: { type: "array", items: { type: "string" }, maxItems: 32 },
      },
      required: ["reason", "coveredObjectiveIds", "remainingObjectiveIds"],
      additionalProperties: false,
    },
  },
};
