"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestionBankItemDocSchema =
  exports.DigitalTestSessionDocSchema =
  exports.ChatSessionDocSchema =
  exports.ChatMessageDocSchema =
  exports.UnifiedItemDocSchema =
  exports.AgentDocSchema =
  exports.StoryPointDocSchema =
  exports.SpaceDocSchema =
  exports.zLegacyTimestampRead =
    void 0;
/**
 * LEGACY DOC SHAPES for the unprefixed collections this package serves
 * (`tenants/{t}/spaces/**`, `digitalTestSessions/`, `spaceProgress/`,
 * `chatSessions/`, `questionBank/`, `rubricPresets/`, `notifications/`,
 * `userMemberships/`). Ported from @levelup/shared-types as part of U3.2
 * (DATA-MODEL-FIX-PLAN §3/§6, MIGRATION-PATTERN.md rule 2) so that package
 * can be deleted (U3.5).
 *
 * These are deliberately NOT the @levelup/domain entity schemas: docs at rest
 * carry the legacy field vocabularies — flat `payload.questionType` payloads
 * (domain nests a `type` discriminant), `maxPoints` rubric criteria (domain:
 * `maxScore`), `{issue,howToFix}` feedback items (domain: `{message,suggestion}`),
 * `summary` objects (domain: string), the dropped `'test'` storyPoint type —
 * and, pre-B8, Firestore Timestamp objects. Casting them to domain types would
 * be a lie. Enums/roles/primitives that ARE identical to domain come from
 * domain — never redefined here (verified value-identical 2026-07-04).
 *
 * B8 timestamps: every timestamp field is `LegacyTimestamp` (= domain
 * `TimestampInput`): old docs hold Firestore Timestamp objects, audit fields
 * written after U3.2 hold canonical ISO strings. NEVER consume one directly —
 * collapse with `toTimestamp()` / `toMillis(toTimestamp())` from @levelup/domain
 * at the point of use.
 *
 * U3.2 addendum (levelup-specific): DigitalTestSession TIMING fields
 * (`startedAt`, `endedAt`, `serverDeadline`, `submittedAt`) and evaluation
 * `gradedAt` remain Firestore-Timestamp at rest — they are entity timing used
 * in `.toMillis()` math and read by deployed legacy clients; flipping them is
 * deferred to U3.5. Only AUDIT fields (`createdAt`/`updatedAt`/`changedAt`/…)
 * flip to `isoNow()`.
 */
const zod_1 = require("zod");
/**
 * Lenient B8 timestamp validator for doc parses: accepts a Firestore Timestamp
 * (or serialized/{seconds,nanoseconds} shape), an ISO string, epoch millis, or
 * a Date — WITHOUT transforming, so Timestamp instances keep their prototype
 * (`.toMillis()` still works on passthrough fields downstream).
 */
exports.zLegacyTimestampRead = zod_1.z.custom((v) => {
  if (typeof v === "string") return !Number.isNaN(Date.parse(v));
  if (typeof v === "number") return !Number.isNaN(v);
  if (v instanceof Date) return !Number.isNaN(v.getTime());
  if (typeof v === "object" && v !== null) {
    const o = v;
    return (
      (typeof o.seconds === "number" && typeof o.nanoseconds === "number") ||
      (typeof o._seconds === "number" && typeof o._nanoseconds === "number") ||
      typeof o.toMillis === "function"
    );
  }
  return false;
}, "expected Firestore Timestamp or ISO-8601 string");
// ═════════════════════════════════════════════════════════════════════════════
// Doc-parse zod schemas — ported verbatim from shared-types `schemas/index.ts`
// with the timestamp fields swapped to the lenient B8 `zLegacyTimestampRead`
// (accepts Timestamp objects AND post-U3.2 ISO strings, no transform).
// All `.passthrough()` semantics preserved — un-listed fields (e.g. session
// `serverDeadline`, storyPoint `assessmentConfig.schedule`) pass through
// VERBATIM so Firestore Timestamp instances keep their methods.
// ═════════════════════════════════════════════════════════════════════════════
exports.SpaceDocSchema = zod_1.z
  .object({
    id: zod_1.z.string(),
    tenantId: zod_1.z.string(),
    title: zod_1.z.string(),
    description: zod_1.z.string().nullish(),
    thumbnailUrl: zod_1.z.string().nullish(),
    slug: zod_1.z.string().nullish(),
    type: zod_1.z.enum(["learning", "practice", "assessment", "resource", "hybrid"]),
    subject: zod_1.z.string().nullish(),
    labels: zod_1.z.array(zod_1.z.string()).nullish(),
    classIds: zod_1.z.array(zod_1.z.string()),
    sectionIds: zod_1.z.array(zod_1.z.string()).nullish(),
    teacherIds: zod_1.z.array(zod_1.z.string()),
    accessType: zod_1.z.enum(["class_assigned", "tenant_wide", "public_store"]),
    academicSessionId: zod_1.z.string().nullish(),
    status: zod_1.z.enum(["draft", "published", "archived"]),
    createdBy: zod_1.z.string(),
    createdAt: exports.zLegacyTimestampRead,
    updatedAt: exports.zLegacyTimestampRead,
  })
  .passthrough();
exports.StoryPointDocSchema = zod_1.z
  .object({
    id: zod_1.z.string(),
    tenantId: zod_1.z.string(),
    spaceId: zod_1.z.string(),
    title: zod_1.z.string(),
    description: zod_1.z.string().nullish(),
    orderIndex: zod_1.z.number(),
    // At-rest value NOT normalized — handlers branch on 'test' explicitly.
    type: zod_1.z.enum(["standard", "timed_test", "quiz", "practice", "test"]),
    sections: zod_1.z
      .array(
        zod_1.z.object({
          id: zod_1.z.string(),
          title: zod_1.z.string(),
          orderIndex: zod_1.z.number(),
          description: zod_1.z.string().nullish(),
        })
      )
      .nullish(),
    assessmentConfig: zod_1.z
      .object({
        durationMinutes: zod_1.z.number().nullish(),
        instructions: zod_1.z.string().nullish(),
        maxAttempts: zod_1.z.number().nullish(),
        shuffleQuestions: zod_1.z.boolean().nullish(),
        shuffleOptions: zod_1.z.boolean().nullish(),
        showResultsImmediately: zod_1.z.boolean().nullish(),
      })
      .passthrough()
      .nullish(),
    difficulty: zod_1.z.enum(["easy", "medium", "hard", "expert"]).nullish(),
    estimatedTimeMinutes: zod_1.z.number().nullish(),
    status: zod_1.z.enum(["active", "archived"]).nullish(),
    createdAt: exports.zLegacyTimestampRead,
    updatedAt: exports.zLegacyTimestampRead,
  })
  .passthrough();
exports.AgentDocSchema = zod_1.z
  .object({
    id: zod_1.z.string(),
    tenantId: zod_1.z.string(),
    spaceId: zod_1.z.string(),
    name: zod_1.z.string(),
    type: zod_1.z.enum(["tutor", "evaluator"]),
    systemPrompt: zod_1.z.string(),
    rules: zod_1.z.array(zod_1.z.string()).optional(),
    modelOverride: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean(),
    createdAt: exports.zLegacyTimestampRead,
    updatedAt: exports.zLegacyTimestampRead,
  })
  .passthrough();
exports.UnifiedItemDocSchema = zod_1.z
  .object({
    id: zod_1.z.string(),
    spaceId: zod_1.z.string(),
    storyPointId: zod_1.z.string(),
    sectionId: zod_1.z.string().nullish(),
    tenantId: zod_1.z.string(),
    type: zod_1.z.enum([
      "question",
      "material",
      "interactive",
      "assessment",
      "discussion",
      "project",
      "checkpoint",
    ]),
    payload: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    title: zod_1.z.string().nullish(),
    content: zod_1.z.string().nullish(),
    difficulty: zod_1.z.enum(["easy", "medium", "hard"]).nullish(),
    topics: zod_1.z.array(zod_1.z.string()).nullish(),
    labels: zod_1.z.array(zod_1.z.string()).nullish(),
    orderIndex: zod_1.z.number(),
    meta: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullish(),
    analytics: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullish(),
    rubric: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullish(),
    linkedQuestionId: zod_1.z.string().nullish(),
    version: zod_1.z.number().nullish(),
    createdBy: zod_1.z.string().nullish(),
    createdAt: exports.zLegacyTimestampRead,
    updatedAt: exports.zLegacyTimestampRead,
  })
  .passthrough();
exports.ChatMessageDocSchema = zod_1.z.object({
  id: zod_1.z.string(),
  role: zod_1.z.enum(["user", "assistant", "system"]),
  text: zod_1.z.string(),
  timestamp: exports.zLegacyTimestampRead,
  mediaUrls: zod_1.z.array(zod_1.z.string()).optional(),
  tokensUsed: zod_1.z.number().optional(),
});
exports.ChatSessionDocSchema = zod_1.z.object({
  id: zod_1.z.string(),
  tenantId: zod_1.z.string(),
  userId: zod_1.z.string(),
  spaceId: zod_1.z.string(),
  storyPointId: zod_1.z.string().optional(),
  itemId: zod_1.z.string().optional(),
  agentId: zod_1.z.string().optional(),
  messages: zod_1.z.array(exports.ChatMessageDocSchema),
  systemPrompt: zod_1.z.string().optional(),
  isActive: zod_1.z.boolean(),
  createdAt: exports.zLegacyTimestampRead,
  updatedAt: exports.zLegacyTimestampRead,
});
exports.DigitalTestSessionDocSchema = zod_1.z
  .object({
    id: zod_1.z.string(),
    tenantId: zod_1.z.string(),
    userId: zod_1.z.string(),
    spaceId: zod_1.z.string(),
    storyPointId: zod_1.z.string(),
    // Legacy 'test'/'exam' at rest are collapsed by domain zLegacyTestSessionTypeRead
    // at read CALL SITES; the wire-era doc schema listed only the canonical three
    // and `sessionType` passes through (this mirrors the shared-types original,
    // which validated a `type` field that session docs don't carry via `.passthrough()`).
    status: zod_1.z.enum(["in_progress", "completed", "expired", "abandoned"]),
    startedAt: exports.zLegacyTimestampRead,
    totalQuestions: zod_1.z.number(),
    attemptNumber: zod_1.z.number(),
    createdAt: exports.zLegacyTimestampRead,
    updatedAt: exports.zLegacyTimestampRead,
  })
  .passthrough();
exports.QuestionBankItemDocSchema = zod_1.z
  .object({
    id: zod_1.z.string(),
    tenantId: zod_1.z.string(),
    questionType: zod_1.z.enum([
      "mcq",
      "mcaq",
      "true-false",
      "numerical",
      "text",
      "paragraph",
      "code",
      "fill-blanks",
      "fill-blanks-dd",
      "matching",
      "jumbled",
      "audio",
      "image_evaluation",
      "group-options",
      "chat_agent_question",
    ]),
    title: zod_1.z.string().optional(),
    content: zod_1.z.string(),
    explanation: zod_1.z.string().optional(),
    basePoints: zod_1.z.number().optional(),
    questionData: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    subject: zod_1.z.string(),
    topics: zod_1.z.array(zod_1.z.string()),
    difficulty: zod_1.z.enum(["easy", "medium", "hard"]),
    bloomsLevel: zod_1.z
      .enum(["remember", "understand", "apply", "analyze", "evaluate", "create"])
      .optional(),
    usageCount: zod_1.z.number(),
    averageScore: zod_1.z.number().nullish(),
    lastUsedAt: exports.zLegacyTimestampRead.nullish(),
    tags: zod_1.z.array(zod_1.z.string()),
    createdBy: zod_1.z.string(),
    createdAt: exports.zLegacyTimestampRead,
    updatedAt: exports.zLegacyTimestampRead,
  })
  .passthrough();
//# sourceMappingURL=legacy-docs.js.map
