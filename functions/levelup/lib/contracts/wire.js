"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageNotificationsRequestSchema =
  exports.SaveRubricPresetRequestSchema =
  exports.SaveSpaceReviewRequestSchema =
  exports.ImportFromBankRequestSchema =
  exports.ListQuestionBankRequestSchema =
  exports.SaveQuestionBankItemRequestSchema =
  exports.PurchaseSpaceRequestSchema =
  exports.ListStoreSpacesRequestSchema =
  exports.RecordItemAttemptRequestSchema =
  exports.SendChatMessageRequestSchema =
  exports.EvaluateAnswerRequestSchema =
  exports.SubmitTestSessionRequestSchema =
  exports.StartTestSessionRequestSchema =
  exports.SaveItemRequestSchema =
  exports.SaveStoryPointRequestSchema =
  exports.SaveSpaceRequestSchema =
  exports.firestoreId =
    void 0;
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
const zod_1 = require("zod");
// ── Validation constants (ported) ─────────────────────────────────────────
const MAX_SHORT_TEXT = 200;
const MAX_MEDIUM_TEXT = 2000;
const MAX_LONG_TEXT = 10000;
const MAX_ARRAY_ITEMS = 100;
/** Firestore document ID pattern (no slashes, non-empty). */
exports.firestoreId = zod_1.z
  .string()
  .min(1, "ID cannot be empty")
  .max(1500)
  .regex(/^[^/]+$/, "ID cannot contain slashes");
// ── Reusable wire fragments (legacy vocabulary — `maxPoints`, 9-field dims) ──
const RubricCriterionLevelSchema = zod_1.z.object({
  score: zod_1.z.number(),
  label: zod_1.z.string(),
  description: zod_1.z.string(),
});
const RubricCriterionSchema = zod_1.z.object({
  id: zod_1.z.string(),
  name: zod_1.z.string(),
  description: zod_1.z.string().optional(),
  maxPoints: zod_1.z.number(),
  weight: zod_1.z.number().optional(),
  levels: zod_1.z.array(RubricCriterionLevelSchema).optional(),
});
const EvaluationDimensionSchema = zod_1.z.object({
  id: zod_1.z.string(),
  name: zod_1.z.string(),
  description: zod_1.z.string(),
  icon: zod_1.z.string().optional(),
  priority: zod_1.z.enum(["HIGH", "MEDIUM", "LOW"]),
  promptGuidance: zod_1.z.string(),
  enabled: zod_1.z.boolean(),
  isDefault: zod_1.z.boolean(),
  isCustom: zod_1.z.boolean(),
  expectedFeedbackCount: zod_1.z.number().optional(),
  weight: zod_1.z.number(),
  scoringScale: zod_1.z.number(),
});
const UnifiedRubricSchema = zod_1.z.object({
  scoringMode: zod_1.z.enum(["criteria_based", "dimension_based", "holistic", "hybrid"]),
  criteria: zod_1.z.array(RubricCriterionSchema).optional(),
  dimensions: zod_1.z.array(EvaluationDimensionSchema).optional(),
  holisticGuidance: zod_1.z.string().optional(),
  holisticMaxScore: zod_1.z.number().optional(),
  passingPercentage: zod_1.z.number().optional(),
  showModelAnswer: zod_1.z.boolean().optional(),
  modelAnswer: zod_1.z.string().optional(),
  evaluatorGuidance: zod_1.z.string().optional(),
});
const ItemMetadataSchema = zod_1.z
  .object({
    subject: zod_1.z.string().optional(),
    topics: zod_1.z.array(zod_1.z.string()).optional(),
    bloomsLevel: zod_1.z.string().optional(),
    estimatedTime: zod_1.z.number().optional(),
    source: zod_1.z.string().optional(),
  })
  .passthrough();
// ── Spaces ────────────────────────────────────────────────────────────────
/** v1 successor: api-contract levelup `SaveSpaceRequestSchema`. */
exports.SaveSpaceRequestSchema = zod_1.z.object({
  id: exports.firestoreId.optional(),
  tenantId: exports.firestoreId,
  data: zod_1.z.object({
    title: zod_1.z.string().max(MAX_SHORT_TEXT).optional(),
    description: zod_1.z.string().max(MAX_MEDIUM_TEXT).optional(),
    thumbnailUrl: zod_1.z.string().optional(),
    slug: zod_1.z.string().optional(),
    type: zod_1.z.enum(["learning", "practice", "assessment", "resource", "hybrid"]).optional(),
    subject: zod_1.z.string().optional(),
    labels: zod_1.z.array(zod_1.z.string().max(MAX_SHORT_TEXT)).max(MAX_ARRAY_ITEMS).optional(),
    classIds: zod_1.z.array(exports.firestoreId).max(MAX_ARRAY_ITEMS).optional(),
    sectionIds: zod_1.z.array(exports.firestoreId).max(MAX_ARRAY_ITEMS).optional(),
    teacherIds: zod_1.z.array(exports.firestoreId).max(MAX_ARRAY_ITEMS).optional(),
    accessType: zod_1.z.enum(["class_assigned", "tenant_wide", "public_store"]).optional(),
    academicSessionId: zod_1.z.string().optional(),
    defaultEvaluatorAgentId: zod_1.z.string().optional(),
    defaultTutorAgentId: zod_1.z.string().optional(),
    defaultTimeLimitMinutes: zod_1.z.number().optional(),
    allowRetakes: zod_1.z.boolean().optional(),
    maxRetakes: zod_1.z.number().optional(),
    showCorrectAnswers: zod_1.z.boolean().optional(),
    defaultRubric: UnifiedRubricSchema.optional(),
    status: zod_1.z.enum(["draft", "published", "archived"]).optional(),
    price: zod_1.z.number().optional(),
    currency: zod_1.z.string().optional(),
    publishedToStore: zod_1.z.boolean().optional(),
    storeDescription: zod_1.z.string().max(MAX_MEDIUM_TEXT).optional(),
    storeThumbnailUrl: zod_1.z.string().optional(),
  }),
});
/** v1 successor: api-contract levelup `SaveStoryPointRequestSchema`. */
exports.SaveStoryPointRequestSchema = zod_1.z.object({
  id: exports.firestoreId.optional(),
  tenantId: exports.firestoreId,
  spaceId: exports.firestoreId,
  data: zod_1.z.object({
    title: zod_1.z.string().max(MAX_SHORT_TEXT).optional(),
    description: zod_1.z.string().max(MAX_MEDIUM_TEXT).optional(),
    orderIndex: zod_1.z.number().optional(),
    // Legacy wire still accepts the dropped 'test' synonym (stored as-received).
    type: zod_1.z.enum(["standard", "timed_test", "quiz", "practice", "test"]).optional(),
    sections: zod_1.z
      .array(
        zod_1.z.object({
          id: zod_1.z.string(),
          title: zod_1.z.string(),
          orderIndex: zod_1.z.number(),
          description: zod_1.z.string().optional(),
        })
      )
      .optional(),
    assessmentConfig: zod_1.z
      .object({
        durationMinutes: zod_1.z.number().optional(),
        instructions: zod_1.z.string().optional(),
        maxAttempts: zod_1.z.number().optional(),
        shuffleQuestions: zod_1.z.boolean().optional(),
        shuffleOptions: zod_1.z.boolean().optional(),
        showResultsImmediately: zod_1.z.boolean().optional(),
      })
      .passthrough()
      .optional(),
    defaultRubric: UnifiedRubricSchema.optional(),
    difficulty: zod_1.z.enum(["easy", "medium", "hard", "expert"]).optional(),
    estimatedTimeMinutes: zod_1.z.number().optional(),
    deleted: zod_1.z.boolean().optional(),
  }),
});
/** v1 successor: api-contract levelup `SaveItemRequestSchema` (two-level payload). */
exports.SaveItemRequestSchema = zod_1.z.object({
  id: exports.firestoreId.optional(),
  tenantId: exports.firestoreId,
  spaceId: exports.firestoreId,
  storyPointId: exports.firestoreId,
  data: zod_1.z.object({
    sectionId: exports.firestoreId.optional(),
    type: zod_1.z
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
    payload: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    title: zod_1.z.string().max(MAX_SHORT_TEXT).optional(),
    content: zod_1.z.string().max(MAX_LONG_TEXT).optional(),
    difficulty: zod_1.z.enum(["easy", "medium", "hard"]).optional(),
    topics: zod_1.z.array(zod_1.z.string().max(MAX_SHORT_TEXT)).max(MAX_ARRAY_ITEMS).optional(),
    labels: zod_1.z.array(zod_1.z.string().max(MAX_SHORT_TEXT)).max(MAX_ARRAY_ITEMS).optional(),
    orderIndex: zod_1.z.number().optional(),
    meta: ItemMetadataSchema.optional(),
    analytics: zod_1.z.record(zod_1.z.string(), zod_1.z.number()).optional(),
    rubric: UnifiedRubricSchema.optional(),
    linkedQuestionId: zod_1.z.string().optional(),
    attachments: zod_1.z
      .array(
        zod_1.z.object({
          id: zod_1.z.string(),
          fileName: zod_1.z.string().max(MAX_SHORT_TEXT),
          url: zod_1.z.string(),
          type: zod_1.z.enum(["image", "pdf", "audio"]),
          size: zod_1.z.number(),
          mimeType: zod_1.z.string(),
        })
      )
      .max(20)
      .optional(),
    deleted: zod_1.z.boolean().optional(),
  }),
});
// ── Test sessions ─────────────────────────────────────────────────────────
/** v1 successor: api-contract levelup `StartTestSessionRequestSchema`. */
exports.StartTestSessionRequestSchema = zod_1.z.object({
  tenantId: exports.firestoreId,
  spaceId: exports.firestoreId,
  storyPointId: exports.firestoreId,
});
/** v1 successor: api-contract levelup `SubmitTestSessionRequestSchema`. */
exports.SubmitTestSessionRequestSchema = zod_1.z.object({
  tenantId: exports.firestoreId,
  sessionId: exports.firestoreId,
  autoSubmitted: zod_1.z.boolean().optional(),
});
/** v1 successor: api-contract levelup `EvaluateAnswerRequestSchema`. */
exports.EvaluateAnswerRequestSchema = zod_1.z.object({
  tenantId: exports.firestoreId,
  spaceId: exports.firestoreId,
  storyPointId: exports.firestoreId.optional(),
  itemId: exports.firestoreId,
  answer: zod_1.z.unknown(),
  mediaUrls: zod_1.z.array(zod_1.z.string().url()).max(20).optional(),
});
/** v1 successor: api-contract levelup `SendChatMessageRequestSchema`. */
exports.SendChatMessageRequestSchema = zod_1.z.object({
  tenantId: exports.firestoreId,
  spaceId: exports.firestoreId,
  storyPointId: exports.firestoreId,
  itemId: exports.firestoreId,
  sessionId: exports.firestoreId.optional(),
  message: zod_1.z.string().min(1, "Message cannot be empty").max(MAX_LONG_TEXT),
  language: zod_1.z.string().max(10).optional(),
  agentId: exports.firestoreId.optional(),
});
/** Compact evaluation data sent alongside a recorded attempt for persistence.
 *  Uses .nullish() because Firebase callable SDK encodes undefined → null. */
const StoredEvaluationSchema = zod_1.z
  .object({
    score: zod_1.z.number(),
    maxScore: zod_1.z.number(),
    correctness: zod_1.z.number(),
    percentage: zod_1.z.number(),
    strengths: zod_1.z.array(zod_1.z.string()).max(20),
    weaknesses: zod_1.z.array(zod_1.z.string()).max(20),
    missingConcepts: zod_1.z.array(zod_1.z.string()).max(20),
    summary: zod_1.z
      .object({
        keyTakeaway: zod_1.z.string().max(MAX_MEDIUM_TEXT),
        overallComment: zod_1.z.string().max(MAX_MEDIUM_TEXT),
      })
      .nullish(),
    mistakeClassification: zod_1.z
      .enum(["Conceptual", "Silly Error", "Knowledge Gap", "None"])
      .nullish(),
  })
  .nullish();
/** v1 successor: api-contract levelup `RecordItemAttemptRequestSchema`. */
exports.RecordItemAttemptRequestSchema = zod_1.z.object({
  tenantId: exports.firestoreId,
  spaceId: exports.firestoreId,
  storyPointId: exports.firestoreId,
  itemId: exports.firestoreId,
  itemType: zod_1.z.string(),
  score: zod_1.z.number(),
  maxScore: zod_1.z.number(),
  correct: zod_1.z.boolean(),
  timeSpent: zod_1.z.number().nullish(),
  feedback: zod_1.z.string().max(MAX_MEDIUM_TEXT).nullish(),
  /** Student's answer for persistence (displayed on revisit). */
  answer: zod_1.z.unknown().nullish(),
  /** Compact evaluation result for persistence (displayed on revisit). */
  evaluationData: StoredEvaluationSchema,
});
// ── Store (B2C) ───────────────────────────────────────────────────────────
/** v1 successor: api-contract levelup `ListStoreSpacesRequestSchema`. */
exports.ListStoreSpacesRequestSchema = zod_1.z.object({
  subject: zod_1.z.string().max(MAX_SHORT_TEXT).optional(),
  limit: zod_1.z.number().int().min(1).max(100).optional(),
  startAfter: exports.firestoreId.optional(),
  search: zod_1.z.string().max(MAX_SHORT_TEXT).optional(),
});
/** v1 successor: api-contract levelup `PurchaseSpaceRequestSchema`. */
exports.PurchaseSpaceRequestSchema = zod_1.z.object({
  spaceId: exports.firestoreId,
  paymentToken: zod_1.z.string().max(MAX_SHORT_TEXT).optional(),
});
// ── Question bank ─────────────────────────────────────────────────────────
/** v1 successor: api-contract levelup `SaveQuestionBankItemRequestSchema`. */
exports.SaveQuestionBankItemRequestSchema = zod_1.z.object({
  id: exports.firestoreId.optional(),
  tenantId: exports.firestoreId,
  data: zod_1.z.object({
    questionType: zod_1.z.string().max(50).optional(),
    title: zod_1.z.string().max(MAX_SHORT_TEXT).optional(),
    content: zod_1.z.string().max(MAX_LONG_TEXT).optional(),
    explanation: zod_1.z.string().max(MAX_MEDIUM_TEXT).optional(),
    basePoints: zod_1.z.number().optional(),
    questionData: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    subject: zod_1.z.string().max(MAX_SHORT_TEXT).optional(),
    topics: zod_1.z.array(zod_1.z.string().max(MAX_SHORT_TEXT)).max(MAX_ARRAY_ITEMS).optional(),
    difficulty: zod_1.z.enum(["easy", "medium", "hard"]).optional(),
    bloomsLevel: zod_1.z
      .enum(["remember", "understand", "apply", "analyze", "evaluate", "create"])
      .optional(),
    tags: zod_1.z.array(zod_1.z.string().max(MAX_SHORT_TEXT)).max(MAX_ARRAY_ITEMS).optional(),
    deleted: zod_1.z.boolean().optional(),
  }),
});
/** v1 successor: api-contract levelup `ListQuestionBankRequestSchema`. */
exports.ListQuestionBankRequestSchema = zod_1.z.object({
  tenantId: exports.firestoreId,
  subject: zod_1.z.string().max(MAX_SHORT_TEXT).optional(),
  topics: zod_1.z.array(zod_1.z.string().max(MAX_SHORT_TEXT)).max(MAX_ARRAY_ITEMS).optional(),
  difficulty: zod_1.z.enum(["easy", "medium", "hard"]).optional(),
  bloomsLevel: zod_1.z
    .enum(["remember", "understand", "apply", "analyze", "evaluate", "create"])
    .optional(),
  questionType: zod_1.z.string().max(50).optional(),
  tags: zod_1.z.array(zod_1.z.string().max(MAX_SHORT_TEXT)).max(MAX_ARRAY_ITEMS).optional(),
  search: zod_1.z.string().max(MAX_SHORT_TEXT).optional(),
  sortBy: zod_1.z.enum(["usageCount", "averageScore", "createdAt"]).optional(),
  sortDir: zod_1.z.enum(["asc", "desc"]).optional(),
  limit: zod_1.z.number().optional(),
  startAfter: zod_1.z.string().optional(),
});
/** v1 successor: api-contract levelup `ImportFromBankRequestSchema`. */
exports.ImportFromBankRequestSchema = zod_1.z.object({
  tenantId: exports.firestoreId,
  spaceId: exports.firestoreId,
  storyPointId: exports.firestoreId,
  sectionId: exports.firestoreId.optional(),
  questionBankItemIds: zod_1.z
    .array(exports.firestoreId)
    .min(1, "Select at least one item")
    .max(MAX_ARRAY_ITEMS),
});
// ── Reviews / presets / notifications ─────────────────────────────────────
/** v1 successor: api-contract levelup `SaveSpaceReviewRequestSchema`. */
exports.SaveSpaceReviewRequestSchema = zod_1.z.object({
  tenantId: exports.firestoreId,
  spaceId: exports.firestoreId,
  rating: zod_1.z
    .number()
    .int()
    .min(1, "Rating must be at least 1")
    .max(5, "Rating must be at most 5"),
  comment: zod_1.z.string().max(MAX_MEDIUM_TEXT).optional(),
});
/** v1 successor: api-contract levelup `SaveRubricPresetRequestSchema`. */
exports.SaveRubricPresetRequestSchema = zod_1.z.object({
  id: exports.firestoreId.optional(),
  tenantId: exports.firestoreId,
  data: zod_1.z.object({
    name: zod_1.z.string().max(MAX_SHORT_TEXT).optional(),
    description: zod_1.z.string().max(MAX_MEDIUM_TEXT).optional(),
    rubric: UnifiedRubricSchema.optional(),
    category: zod_1.z
      .enum(["general", "math", "science", "language", "coding", "essay", "custom"])
      .optional(),
    questionTypes: zod_1.z.array(zod_1.z.string().max(50)).max(MAX_ARRAY_ITEMS).optional(),
    deleted: zod_1.z.boolean().optional(),
  }),
});
/** v1 successor: api-contract notification `ManageNotificationsRequestSchema`. */
exports.ManageNotificationsRequestSchema = zod_1.z.object({
  tenantId: exports.firestoreId,
  action: zod_1.z.enum(["list", "markRead"]),
  limit: zod_1.z.number().optional(),
  cursor: zod_1.z.string().optional(),
  notificationId: zod_1.z.string().optional(),
  markAllRead: zod_1.z.boolean().optional(),
});
//# sourceMappingURL=wire.js.map
