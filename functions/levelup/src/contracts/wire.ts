/**
 * WIRE-PRESERVING request schemas + response types for the legacy levelup
 * callables. Ported VERBATIM from @levelup/shared-types (U3.2, DATA-MODEL-FIX-PLAN
 * §3/§6, MIGRATION-PATTERN.md rule 4) so that package can be deleted (U3.5).
 *
 * These deliberately do NOT adopt the @levelup/api-contract v1 request shapes:
 * the v1 contract restructured payloads (two-level `type`-discriminated item
 * payload, `maxScore` rubric criteria, envelope `{data}` responses, …) and this
 * package serves the DEPLOYED legacy wire. Each schema notes its v1 successor
 * (all under `packages/api-contract/src/levelup/`); this file dies with the
 * legacy stack.
 *
 * Wire quirks preserved on purpose:
 *  - SaveStoryPointRequestSchema still accepts the legacy `'test'` storyPoint
 *    type (deployed clients send it); the value is stored as-received.
 *  - The embedded rubric fragment uses the legacy `maxPoints` vocabulary.
 *  - StoredEvaluation fields use `.nullish()` because the Firebase callable SDK
 *    encodes undefined → null.
 *
 * B8 note: timestamps in RESPONSES from migrated handlers are canonical ISO
 * strings — EXCEPT DigitalTestSession timing fields (startedAt/serverDeadline),
 * which remain Firestore Timestamps end-to-end until U3.5 (see
 * contracts/legacy-docs.ts header addendum).
 */
import { z } from "zod";

// ── Validation constants (ported) ─────────────────────────────────────────
const MAX_SHORT_TEXT = 200;
const MAX_MEDIUM_TEXT = 2000;
const MAX_LONG_TEXT = 10000;
const MAX_ARRAY_ITEMS = 100;

/** Firestore document ID pattern (no slashes, non-empty). */
export const firestoreId = z
  .string()
  .min(1, "ID cannot be empty")
  .max(1500)
  .regex(/^[^/]+$/, "ID cannot contain slashes");

// ── Reusable wire fragments (legacy vocabulary — `maxPoints`, 9-field dims) ──

const RubricCriterionLevelSchema = z.object({
  score: z.number(),
  label: z.string(),
  description: z.string(),
});

const RubricCriterionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  maxPoints: z.number(),
  weight: z.number().optional(),
  levels: z.array(RubricCriterionLevelSchema).optional(),
});

const EvaluationDimensionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string().optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
  promptGuidance: z.string(),
  enabled: z.boolean(),
  isDefault: z.boolean(),
  isCustom: z.boolean(),
  expectedFeedbackCount: z.number().optional(),
  weight: z.number(),
  scoringScale: z.number(),
});

const UnifiedRubricSchema = z.object({
  scoringMode: z.enum(["criteria_based", "dimension_based", "holistic", "hybrid"]),
  criteria: z.array(RubricCriterionSchema).optional(),
  dimensions: z.array(EvaluationDimensionSchema).optional(),
  holisticGuidance: z.string().optional(),
  holisticMaxScore: z.number().optional(),
  passingPercentage: z.number().optional(),
  showModelAnswer: z.boolean().optional(),
  modelAnswer: z.string().optional(),
  evaluatorGuidance: z.string().optional(),
});

const ItemMetadataSchema = z
  .object({
    subject: z.string().optional(),
    topics: z.array(z.string()).optional(),
    bloomsLevel: z.string().optional(),
    estimatedTime: z.number().optional(),
    source: z.string().optional(),
  })
  .passthrough();

// ── Generic save pattern ──────────────────────────────────────────────────

/** v1 successor: api-contract `SaveResponseSchema` (adds `archived?`). */
export interface SaveResponse {
  id: string;
  created: boolean;
}

// ── Spaces ────────────────────────────────────────────────────────────────

/** v1 successor: api-contract levelup `SaveSpaceRequestSchema`. */
export const SaveSpaceRequestSchema = z.object({
  id: firestoreId.optional(),
  tenantId: firestoreId,
  data: z.object({
    title: z.string().max(MAX_SHORT_TEXT).optional(),
    description: z.string().max(MAX_MEDIUM_TEXT).optional(),
    thumbnailUrl: z.string().optional(),
    slug: z.string().optional(),
    type: z.enum(["learning", "practice", "assessment", "resource", "hybrid"]).optional(),
    subject: z.string().optional(),
    labels: z.array(z.string().max(MAX_SHORT_TEXT)).max(MAX_ARRAY_ITEMS).optional(),
    classIds: z.array(firestoreId).max(MAX_ARRAY_ITEMS).optional(),
    sectionIds: z.array(firestoreId).max(MAX_ARRAY_ITEMS).optional(),
    teacherIds: z.array(firestoreId).max(MAX_ARRAY_ITEMS).optional(),
    accessType: z.enum(["class_assigned", "tenant_wide", "public_store"]).optional(),
    academicSessionId: z.string().optional(),
    defaultEvaluatorAgentId: z.string().optional(),
    defaultTutorAgentId: z.string().optional(),
    defaultTimeLimitMinutes: z.number().optional(),
    allowRetakes: z.boolean().optional(),
    maxRetakes: z.number().optional(),
    showCorrectAnswers: z.boolean().optional(),
    defaultRubric: UnifiedRubricSchema.optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
    price: z.number().optional(),
    currency: z.string().optional(),
    publishedToStore: z.boolean().optional(),
    storeDescription: z.string().max(MAX_MEDIUM_TEXT).optional(),
    storeThumbnailUrl: z.string().optional(),
  }),
});
export type SaveSpaceRequest = z.infer<typeof SaveSpaceRequestSchema>;

/** v1 successor: api-contract levelup `SaveStoryPointRequestSchema`. */
export const SaveStoryPointRequestSchema = z.object({
  id: firestoreId.optional(),
  tenantId: firestoreId,
  spaceId: firestoreId,
  data: z.object({
    title: z.string().max(MAX_SHORT_TEXT).optional(),
    description: z.string().max(MAX_MEDIUM_TEXT).optional(),
    orderIndex: z.number().optional(),
    // Legacy wire still accepts the dropped 'test' synonym (stored as-received).
    type: z.enum(["standard", "timed_test", "quiz", "practice", "test"]).optional(),
    sections: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          orderIndex: z.number(),
          description: z.string().optional(),
        })
      )
      .optional(),
    assessmentConfig: z
      .object({
        durationMinutes: z.number().optional(),
        instructions: z.string().optional(),
        maxAttempts: z.number().optional(),
        shuffleQuestions: z.boolean().optional(),
        shuffleOptions: z.boolean().optional(),
        showResultsImmediately: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
    defaultRubric: UnifiedRubricSchema.optional(),
    difficulty: z.enum(["easy", "medium", "hard", "expert"]).optional(),
    estimatedTimeMinutes: z.number().optional(),
    deleted: z.boolean().optional(),
  }),
});
export type SaveStoryPointRequest = z.infer<typeof SaveStoryPointRequestSchema>;

/** v1 successor: api-contract levelup `SaveItemRequestSchema` (two-level payload). */
export const SaveItemRequestSchema = z.object({
  id: firestoreId.optional(),
  tenantId: firestoreId,
  spaceId: firestoreId,
  storyPointId: firestoreId,
  data: z.object({
    sectionId: firestoreId.optional(),
    type: z
      .enum([
        "question",
        "material",
        "interactive",
        "assessment",
        "discussion",
        "project",
        "checkpoint",
      ])
      .optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
    title: z.string().max(MAX_SHORT_TEXT).optional(),
    content: z.string().max(MAX_LONG_TEXT).optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    topics: z.array(z.string().max(MAX_SHORT_TEXT)).max(MAX_ARRAY_ITEMS).optional(),
    labels: z.array(z.string().max(MAX_SHORT_TEXT)).max(MAX_ARRAY_ITEMS).optional(),
    orderIndex: z.number().optional(),
    meta: ItemMetadataSchema.optional(),
    analytics: z.record(z.string(), z.number()).optional(),
    rubric: UnifiedRubricSchema.optional(),
    linkedQuestionId: z.string().optional(),
    attachments: z
      .array(
        z.object({
          id: z.string(),
          fileName: z.string().max(MAX_SHORT_TEXT),
          url: z.string(),
          type: z.enum(["image", "pdf", "audio"]),
          size: z.number(),
          mimeType: z.string(),
        })
      )
      .max(20)
      .optional(),
    deleted: z.boolean().optional(),
  }),
});
export type SaveItemRequest = z.infer<typeof SaveItemRequestSchema>;

// ── Test sessions ─────────────────────────────────────────────────────────

/** v1 successor: api-contract levelup `StartTestSessionRequestSchema`. */
export const StartTestSessionRequestSchema = z.object({
  tenantId: firestoreId,
  spaceId: firestoreId,
  storyPointId: firestoreId,
});

/** v1 successor: api-contract levelup `SubmitTestSessionRequestSchema`. */
export const SubmitTestSessionRequestSchema = z.object({
  tenantId: firestoreId,
  sessionId: firestoreId,
  autoSubmitted: z.boolean().optional(),
});

/** v1 successor: api-contract levelup `EvaluateAnswerRequestSchema`. */
export const EvaluateAnswerRequestSchema = z.object({
  tenantId: firestoreId,
  spaceId: firestoreId,
  storyPointId: firestoreId.optional(),
  itemId: firestoreId,
  answer: z.unknown(),
  mediaUrls: z.array(z.string().url()).max(20).optional(),
});

/** v1 successor: api-contract levelup `SendChatMessageRequestSchema`. */
export const SendChatMessageRequestSchema = z.object({
  tenantId: firestoreId,
  spaceId: firestoreId,
  storyPointId: firestoreId,
  itemId: firestoreId,
  sessionId: firestoreId.optional(),
  message: z.string().min(1, "Message cannot be empty").max(MAX_LONG_TEXT),
  language: z.string().max(10).optional(),
  agentId: firestoreId.optional(),
});

/** Compact evaluation data sent alongside a recorded attempt for persistence.
 *  Uses .nullish() because Firebase callable SDK encodes undefined → null. */
const StoredEvaluationSchema = z
  .object({
    score: z.number(),
    maxScore: z.number(),
    correctness: z.number(),
    percentage: z.number(),
    strengths: z.array(z.string()).max(20),
    weaknesses: z.array(z.string()).max(20),
    missingConcepts: z.array(z.string()).max(20),
    summary: z
      .object({
        keyTakeaway: z.string().max(MAX_MEDIUM_TEXT),
        overallComment: z.string().max(MAX_MEDIUM_TEXT),
      })
      .nullish(),
    mistakeClassification: z.enum(["Conceptual", "Silly Error", "Knowledge Gap", "None"]).nullish(),
  })
  .nullish();

/** v1 successor: api-contract levelup `RecordItemAttemptRequestSchema`. */
export const RecordItemAttemptRequestSchema = z.object({
  tenantId: firestoreId,
  spaceId: firestoreId,
  storyPointId: firestoreId,
  itemId: firestoreId,
  itemType: z.string(),
  score: z.number(),
  maxScore: z.number(),
  correct: z.boolean(),
  timeSpent: z.number().nullish(),
  feedback: z.string().max(MAX_MEDIUM_TEXT).nullish(),
  /** Student's answer for persistence (displayed on revisit). */
  answer: z.unknown().nullish(),
  /** Compact evaluation result for persistence (displayed on revisit). */
  evaluationData: StoredEvaluationSchema,
});

// ── Store (B2C) ───────────────────────────────────────────────────────────

/** v1 successor: api-contract levelup `ListStoreSpacesRequestSchema`. */
export const ListStoreSpacesRequestSchema = z.object({
  subject: z.string().max(MAX_SHORT_TEXT).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  startAfter: firestoreId.optional(),
  search: z.string().max(MAX_SHORT_TEXT).optional(),
});

/** v1 successor: api-contract levelup `PurchaseSpaceRequestSchema`. */
export const PurchaseSpaceRequestSchema = z.object({
  spaceId: firestoreId,
  paymentToken: z.string().max(MAX_SHORT_TEXT).optional(),
});

// ── Question bank ─────────────────────────────────────────────────────────

/** v1 successor: api-contract levelup `SaveQuestionBankItemRequestSchema`. */
export const SaveQuestionBankItemRequestSchema = z.object({
  id: firestoreId.optional(),
  tenantId: firestoreId,
  data: z.object({
    questionType: z.string().max(50).optional(),
    title: z.string().max(MAX_SHORT_TEXT).optional(),
    content: z.string().max(MAX_LONG_TEXT).optional(),
    explanation: z.string().max(MAX_MEDIUM_TEXT).optional(),
    basePoints: z.number().optional(),
    questionData: z.record(z.string(), z.unknown()).optional(),
    subject: z.string().max(MAX_SHORT_TEXT).optional(),
    topics: z.array(z.string().max(MAX_SHORT_TEXT)).max(MAX_ARRAY_ITEMS).optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    bloomsLevel: z
      .enum(["remember", "understand", "apply", "analyze", "evaluate", "create"])
      .optional(),
    tags: z.array(z.string().max(MAX_SHORT_TEXT)).max(MAX_ARRAY_ITEMS).optional(),
    deleted: z.boolean().optional(),
  }),
});

/** v1 successor: api-contract levelup `ListQuestionBankRequestSchema`. */
export const ListQuestionBankRequestSchema = z.object({
  tenantId: firestoreId,
  subject: z.string().max(MAX_SHORT_TEXT).optional(),
  topics: z.array(z.string().max(MAX_SHORT_TEXT)).max(MAX_ARRAY_ITEMS).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  bloomsLevel: z
    .enum(["remember", "understand", "apply", "analyze", "evaluate", "create"])
    .optional(),
  questionType: z.string().max(50).optional(),
  tags: z.array(z.string().max(MAX_SHORT_TEXT)).max(MAX_ARRAY_ITEMS).optional(),
  search: z.string().max(MAX_SHORT_TEXT).optional(),
  sortBy: z.enum(["usageCount", "averageScore", "createdAt"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  limit: z.number().optional(),
  startAfter: z.string().optional(),
});

/** v1 successor: api-contract levelup `ImportFromBankRequestSchema`. */
export const ImportFromBankRequestSchema = z.object({
  tenantId: firestoreId,
  spaceId: firestoreId,
  storyPointId: firestoreId,
  sectionId: firestoreId.optional(),
  questionBankItemIds: z.array(firestoreId).min(1, "Select at least one item").max(MAX_ARRAY_ITEMS),
});

// ── Reviews / presets / notifications ─────────────────────────────────────

/** v1 successor: api-contract levelup `SaveSpaceReviewRequestSchema`. */
export const SaveSpaceReviewRequestSchema = z.object({
  tenantId: firestoreId,
  spaceId: firestoreId,
  rating: z.number().int().min(1, "Rating must be at least 1").max(5, "Rating must be at most 5"),
  comment: z.string().max(MAX_MEDIUM_TEXT).optional(),
});

/** v1 successor: api-contract levelup `SaveRubricPresetRequestSchema`. */
export const SaveRubricPresetRequestSchema = z.object({
  id: firestoreId.optional(),
  tenantId: firestoreId,
  data: z.object({
    name: z.string().max(MAX_SHORT_TEXT).optional(),
    description: z.string().max(MAX_MEDIUM_TEXT).optional(),
    rubric: UnifiedRubricSchema.optional(),
    category: z
      .enum(["general", "math", "science", "language", "coding", "essay", "custom"])
      .optional(),
    questionTypes: z.array(z.string().max(50)).max(MAX_ARRAY_ITEMS).optional(),
    deleted: z.boolean().optional(),
  }),
});

/** v1 successor: api-contract notification `ManageNotificationsRequestSchema`. */
export const ManageNotificationsRequestSchema = z.object({
  tenantId: firestoreId,
  action: z.enum(["list", "markRead"]),
  limit: z.number().optional(),
  cursor: z.string().optional(),
  notificationId: z.string().optional(),
  markAllRead: z.boolean().optional(),
});
export type ManageNotificationsRequest = z.infer<typeof ManageNotificationsRequestSchema>;

/**
 * v1 successor: api-contract notification `ListNotificationsResponseSchema`.
 * B8: `createdAt` out over the wire is an ISO string (or null for legacy
 * docs missing it) — same as the pre-migration `toDate().toISOString()` output.
 */
export interface ManageNotificationsResponse {
  notifications?: Array<{
    id: string;
    type: string;
    title: string;
    body: string;
    isRead: boolean;
    createdAt: string | null;
    entityType?: string;
    entityId?: string;
    actionUrl?: string;
  }>;
  nextCursor?: string;
  success?: boolean;
}
