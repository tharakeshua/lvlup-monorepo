var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all) __defProp(target, name, { get: all[name], enumerable: true });
};

// src/bootstrap.ts
import admin from "firebase-admin";

// ../../packages/domain/dist/index.js
import { z } from "zod";
var zBrandedId = (_brand) =>
  z
    .string()
    .min(1)
    .max(1500)
    .regex(/^[^/]+$/, 'id must not contain "/"')
    .transform((s) => s);
var zTenantId = zBrandedId();
var zClassId = zBrandedId();
var zStudentId = zBrandedId();
var zTeacherId = zBrandedId();
var zParentId = zBrandedId();
var zSpaceId = zBrandedId();
var zStoryPointId = zBrandedId();
var zItemId = zBrandedId();
var zExamId = zBrandedId();
var zSubmissionId = zBrandedId();
var zUserId = zBrandedId();
var zSessionId = zBrandedId();
var zAgentId = zBrandedId();
var zAcademicSessionId = zBrandedId();
var zNotificationId = zBrandedId();
var zQuestionBankItemId = zBrandedId();
var zStaffId = zBrandedId();
var zScannerId = zBrandedId();
var zExamQuestionId = zBrandedId();
var zTenantCode = zBrandedId();
var zMembershipId = zBrandedId();
var zSectionId = zBrandedId();
var zAnswerKeyId = zBrandedId();
var zRubricPresetId = zBrandedId();
var zTestSessionId = zBrandedId();
var zSpaceProgressId = zBrandedId();
var zChatSessionId = zBrandedId();
var zChatMessageId = zBrandedId();
var zSpaceReviewId = zBrandedId();
var zContentVersionId = zBrandedId();
var zPurchaseId = zBrandedId();
var zQuestionSubmissionId = zBrandedId();
var zEvaluationSettingsId = zBrandedId();
var zDeadLetterEntryId = zBrandedId();
var zExamAnalyticsId = zBrandedId();
var zInsightId = zBrandedId();
var zLlmCallLogId = zBrandedId();
var zCostSummaryId = zBrandedId();
var zHealthSnapshotId = zBrandedId();
var zPlatformActivityLogId = zBrandedId();
var zAnnouncementId = zBrandedId();
var zAchievementId = zBrandedId();
var zStudentAchievementId = zBrandedId();
var zStudentLevelId = zBrandedId();
var zStudyGoalId = zBrandedId();
var zStudySessionId = zBrandedId();
var ISO_8601_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
var isFirestoreTimestampLike = (v) => "seconds" in v && "nanoseconds" in v;
var isSerializedFirestoreTimestampLike = (v) => "_seconds" in v && "_nanoseconds" in v;
var isMillisTimestampLike = (v) => "toMillis" in v && typeof v.toMillis === "function";
function toDate(input) {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) throw new RangeError("invalid Date");
    return input;
  }
  if (typeof input === "number") {
    if (Number.isNaN(input)) throw new RangeError("invalid epoch-millis (NaN)");
    return new Date(input);
  }
  if (typeof input === "string") {
    const ms = Date.parse(input);
    if (Number.isNaN(ms)) throw new RangeError(`unparseable date string: ${input}`);
    return new Date(ms);
  }
  if (typeof input === "object" && input !== null) {
    if (isFirestoreTimestampLike(input)) {
      return new Date(input.seconds * 1e3 + Math.round(input.nanoseconds / 1e6));
    }
    if (isSerializedFirestoreTimestampLike(input)) {
      return new Date(input._seconds * 1e3 + Math.round(input._nanoseconds / 1e6));
    }
    if (isMillisTimestampLike(input)) {
      const ms = input.toMillis();
      if (Number.isNaN(ms)) throw new RangeError("invalid toMillis() result (NaN)");
      return new Date(ms);
    }
  }
  throw new RangeError("unsupported TimestampInput shape");
}
function toTimestamp(input) {
  if (input == null) return null;
  return toDate(input).toISOString();
}
var isoNow = () => /* @__PURE__ */ new Date().toISOString();
var zTimestamp = z
  .string()
  .regex(ISO_8601_UTC)
  .transform((s) => s);
var zTimestampInput = z.preprocess((v) => toTimestamp(v), zTimestamp);
var ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
var zIsoDate = z
  .string()
  .regex(ISO_DATE)
  .transform((s) => s);
var CURRENCIES = ["INR", "USD"];
var zObject = (shape) => z.object(shape).strict();
var zCurrency = z.enum(CURRENCIES);
var MoneySchema = zObject({
  amountMinor: z.number().int(),
  currency: zCurrency,
});
var zMoney = MoneySchema;
var DEFAULT_PAGE_LIMIT = 20;
var MAX_PAGE_LIMIT = 100;
var zCursor = z.string().transform((s) => s);
var zPageParams = zObject({
  cursor: zCursor.optional(),
  limit: z.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
});
var zSoftDeletable = { archivedAt: zTimestamp.nullable() };
var zJsonValue = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(zJsonValue),
    z.record(z.string(), zJsonValue),
  ])
);
var zJsonObject = z.record(z.string(), zJsonValue);
var zEnum = (values) => z.enum(values);
var SPACE_STATUSES = ["draft", "published", "archived"];
var zSpaceStatus = zEnum(SPACE_STATUSES);
var SPACE_TYPES = ["learning", "practice", "assessment", "resource", "hybrid"];
var zSpaceType = zEnum(SPACE_TYPES);
var SPACE_ACCESS_TYPES = ["class_assigned", "tenant_wide", "public_store"];
var zSpaceAccessType = zEnum(SPACE_ACCESS_TYPES);
var EXAM_STATUSES = [
  "draft",
  "question_paper_uploaded",
  "question_paper_extracted",
  "published",
  "grading",
  "results_released",
  "archived",
];
var zExamStatus = zEnum(EXAM_STATUSES);
var SUBMISSION_PIPELINE_STATUSES = [
  "uploaded",
  "scouting",
  "scouting_failed",
  "scouting_complete",
  "grading",
  "grading_partial",
  "grading_failed",
  "grading_complete",
  "finalization_failed",
  "ready_for_review",
  "reviewed",
  "failed",
  "manual_review_needed",
];
var zSubmissionPipelineStatus = zEnum(SUBMISSION_PIPELINE_STATUSES);
var QUESTION_GRADING_STATUSES = [
  "pending",
  "processing",
  "graded",
  "needs_review",
  "failed",
  "manual",
  "overridden",
];
var zQuestionGradingStatus = zEnum(QUESTION_GRADING_STATUSES);
var TEST_SESSION_STATUSES = ["in_progress", "completed", "expired", "abandoned"];
var zTestSessionStatus = zEnum(TEST_SESSION_STATUSES);
var TEST_SESSION_TYPES = ["timed_test", "quiz", "practice"];
var zTestSessionType = zEnum(TEST_SESSION_TYPES);
var QUESTION_STATUSES = [
  "not_visited",
  "not_answered",
  "answered",
  "marked_for_review",
  "answered_and_marked",
];
var zQuestionStatus = zEnum(QUESTION_STATUSES);
var PROGRESS_STATUSES = ["not_started", "in_progress", "completed"];
var zProgressStatus = zEnum(PROGRESS_STATUSES);
var QUESTION_PROGRESS_STATUSES = ["pending", "correct", "incorrect", "partial"];
var zQuestionProgressStatus = zEnum(QUESTION_PROGRESS_STATUSES);
var TENANT_STATUSES = ["active", "suspended", "trial", "expired", "deactivated"];
var zTenantStatus = zEnum(TENANT_STATUSES);
var TENANT_PLANS = ["free", "trial", "basic", "premium", "enterprise"];
var zTenantPlan = zEnum(TENANT_PLANS);
var TENANT_ROLES = [
  "superAdmin",
  "tenantAdmin",
  "teacher",
  "student",
  "parent",
  "scanner",
  "staff",
];
var zTenantRole = zEnum(TENANT_ROLES);
var MEMBERSHIP_STATUSES = ["active", "inactive", "suspended"];
var zMembershipStatus = zEnum(MEMBERSHIP_STATUSES);
var JOIN_SOURCES = [
  "admin_created",
  "bulk_import",
  "invite_code",
  "self_register",
  "migration",
  "tenant_code",
];
var zJoinSource = zEnum(JOIN_SOURCES);
var USER_STATUSES = ["active", "suspended", "deleted"];
var zUserStatus = zEnum(USER_STATUSES);
var ENTITY_STATUSES = ["active", "archived"];
var zEntityStatus = zEnum(ENTITY_STATUSES);
var CONSUMER_PLANS = ["free", "pro", "premium"];
var zConsumerPlan = zEnum(CONSUMER_PLANS);
var ITEM_TYPES = [
  "question",
  "material",
  "interactive",
  "assessment",
  "discussion",
  "project",
  "checkpoint",
];
var zItemType = zEnum(ITEM_TYPES);
var QUESTION_TYPES = [
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
];
var zQuestionType = zEnum(QUESTION_TYPES);
var MATERIAL_TYPES = ["text", "video", "pdf", "link", "interactive", "story", "rich"];
var zMaterialType = zEnum(MATERIAL_TYPES);
var INTERACTIVE_TYPES = ["simulation", "demo", "tool", "game"];
var zInteractiveType = zEnum(INTERACTIVE_TYPES);
var ITEM_ASSESSMENT_TYPES = ["quiz", "exam", "project", "peer_review"];
var zItemAssessmentType = zEnum(ITEM_ASSESSMENT_TYPES);
var STORY_POINT_TYPES = ["standard", "timed_test", "quiz", "practice"];
var zStoryPointType = zEnum(STORY_POINT_TYPES);
var RICH_BLOCK_TYPES = [
  "heading",
  "paragraph",
  "image",
  "video",
  "audio",
  "code",
  "quote",
  "list",
  "divider",
];
var zRichBlockType = zEnum(RICH_BLOCK_TYPES);
var DISCUSSION_THREAD_TYPES = ["open", "guided"];
var zDiscussionThreadType = zEnum(DISCUSSION_THREAD_TYPES);
var ITEM_ATTACHMENT_TYPES = ["image", "pdf", "audio"];
var zItemAttachmentType = zEnum(ITEM_ATTACHMENT_TYPES);
var RUBRIC_SCORING_MODES = ["criteria_based", "dimension_based", "holistic", "hybrid"];
var zRubricScoringMode = zEnum(RUBRIC_SCORING_MODES);
var DIMENSION_PRIORITIES = ["HIGH", "MEDIUM", "LOW"];
var zDimensionPriority = zEnum(DIMENSION_PRIORITIES);
var FEEDBACK_SEVERITIES = ["critical", "major", "minor"];
var zFeedbackSeverity = zEnum(FEEDBACK_SEVERITIES);
var MISTAKE_CLASSIFICATIONS = ["Conceptual", "Silly Error", "Knowledge Gap", "None"];
var zMistakeClassification = zEnum(MISTAKE_CLASSIFICATIONS);
var RUBRIC_PRESET_CATEGORIES = [
  "general",
  "coding",
  "essay",
  "math",
  "science",
  "language",
  "custom",
];
var zRubricPresetCategory = zEnum(RUBRIC_PRESET_CATEGORIES);
var AGENT_TYPES = ["tutor", "evaluator"];
var zAgentType = zEnum(AGENT_TYPES);
var CHAT_MESSAGE_ROLES = ["user", "assistant", "system"];
var zChatMessageRole = zEnum(CHAT_MESSAGE_ROLES);
var CONTENT_VERSION_ENTITY_TYPES = ["space", "storyPoint", "item"];
var zContentVersionEntityType = zEnum(CONTENT_VERSION_ENTITY_TYPES);
var CONTENT_CHANGE_TYPES = ["created", "updated", "published", "archived"];
var zContentChangeType = zEnum(CONTENT_CHANGE_TYPES);
var PURCHASE_STATUSES = ["completed", "failed", "pending"];
var zPurchaseStatus = zEnum(PURCHASE_STATUSES);
var GRADE_LETTERS = ["A+", "A", "B+", "B", "C+", "C", "D", "F"];
var zGradeLetter = zEnum(GRADE_LETTERS);
var BLOOMS_LEVELS = ["remember", "understand", "apply", "analyze", "evaluate", "create"];
var zBloomsLevel = zEnum(BLOOMS_LEVELS);
var DIFFICULTIES = ["easy", "medium", "hard"];
var zDifficulty = zEnum(DIFFICULTIES);
var AUTHORING_DIFFICULTIES = ["easy", "medium", "hard", "expert"];
var zAuthoringDifficulty = zEnum(AUTHORING_DIFFICULTIES);
var TEACHER_PERMISSION_KEYS = [
  "canManageSpaces",
  "canManageStudents",
  "canManageClasses",
  "canCreateExams",
  "canGradeExams",
  "canViewAnalytics",
  "canManageContent",
  "canReleaseResults",
];
var zTeacherPermissionKey = zEnum(TEACHER_PERMISSION_KEYS);
var STAFF_PERMISSION_KEYS = [
  "canManageUsers",
  "canManageClasses",
  "canImportData",
  "canExportData",
  "canViewAnalytics",
  "canManageAnnouncements",
];
var zStaffPermissionKey = zEnum(STAFF_PERMISSION_KEYS);
var AUTH_PROVIDERS = ["email", "phone", "google", "apple"];
var zAuthProvider = zEnum(AUTH_PROVIDERS);
var UPLOAD_SOURCES = ["web", "scanner", "rn"];
var zUploadSource = zEnum(UPLOAD_SOURCES);
var ANNOUNCEMENT_SCOPES = ["platform", "tenant"];
var zAnnouncementScope = zEnum(ANNOUNCEMENT_SCOPES);
var ANNOUNCEMENT_STATUSES = ["draft", "published", "archived"];
var zAnnouncementStatus = zEnum(ANNOUNCEMENT_STATUSES);
var NOTIFICATION_TYPES = [
  "exam_results_released",
  "new_exam_assigned",
  "new_space_assigned",
  "submission_graded",
  "grading_complete",
  "student_at_risk",
  "deadline_reminder",
  "space_published",
  "bulk_import_complete",
  "ai_budget_alert",
  "system_announcement",
];
var zNotificationType = zEnum(NOTIFICATION_TYPES);
var NOTIFICATION_ENTITY_TYPES = ["exam", "space", "submission", "student", "class"];
var zNotificationEntityType = zEnum(NOTIFICATION_ENTITY_TYPES);
var NOTIFICATION_RECIPIENT_ROLES = ["teacher", "student", "parent", "tenantAdmin"];
var zNotificationRecipientRole = zEnum(NOTIFICATION_RECIPIENT_ROLES);
var AT_RISK_REASONS = [
  "low_exam_score",
  "no_recent_activity",
  "low_space_completion",
  "declining_performance",
  "zero_streak",
];
var zAtRiskReason = zEnum(AT_RISK_REASONS);
var INSIGHT_TYPES = [
  "weak_topic_recommendation",
  "exam_preparation",
  "streak_encouragement",
  "improvement_celebration",
  "at_risk_intervention",
  "cross_system_correlation",
];
var zInsightType = zEnum(INSIGHT_TYPES);
var INSIGHT_PRIORITIES = ["high", "medium", "low"];
var zInsightPriority = zEnum(INSIGHT_PRIORITIES);
var INSIGHT_ACTION_TYPES = ["practice_space", "review_exam", "seek_help", "celebrate"];
var zInsightActionType = zEnum(INSIGHT_ACTION_TYPES);
var LLM_CALL_STATUSES = ["success", "error"];
var zLlmCallStatus = zEnum(LLM_CALL_STATUSES);
var DAY_HEALTH_STATUSES = ["healthy", "degraded", "down"];
var zDayHealthStatus = zEnum(DAY_HEALTH_STATUSES);
var PLATFORM_ACTIVITY_ACTIONS = [
  "tenant_created",
  "tenant_updated",
  "tenant_deactivated",
  "tenant_reactivated",
  "user_created",
  "users_bulk_imported",
];
var zPlatformActivityAction = zEnum(PLATFORM_ACTIVITY_ACTIONS);
var COST_SUMMARY_GRANULARITIES = ["daily", "monthly"];
var zCostSummaryGranularity = zEnum(COST_SUMMARY_GRANULARITIES);
var ACHIEVEMENT_CATEGORIES = [
  "learning",
  "consistency",
  "excellence",
  "exploration",
  "social",
  "milestone",
];
var zAchievementCategory = zEnum(ACHIEVEMENT_CATEGORIES);
var ACHIEVEMENT_RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];
var zAchievementRarity = zEnum(ACHIEVEMENT_RARITIES);
var ACHIEVEMENT_TIERS = ["bronze", "silver", "gold", "platinum", "diamond"];
var zAchievementTier = zEnum(ACHIEVEMENT_TIERS);
var ACHIEVEMENT_CRITERIA_TYPES = [
  "spaces_completed",
  "story_points_completed",
  "exams_passed",
  "perfect_scores",
  "streak_days",
  "total_points",
  "items_completed",
  "chat_sessions",
  "leaderboard_top3",
  "login_days",
];
var zAchievementCriteriaType = zEnum(ACHIEVEMENT_CRITERIA_TYPES);
var STUDY_GOAL_TARGET_TYPES = ["spaces", "story_points", "items", "exams", "minutes"];
var zStudyGoalTargetType = zEnum(STUDY_GOAL_TARGET_TYPES);
var LEADERBOARD_SCOPES = ["tenant", "space", "storyPoint"];
var zLeaderboardScope = zEnum(LEADERBOARD_SCOPES);
var SPACE_TRANSITIONS = {
  draft: ["published"],
  published: ["archived", "draft"],
  archived: ["draft"],
};
var EXAM_TRANSITIONS = {
  draft: ["question_paper_uploaded", "archived"],
  question_paper_uploaded: ["question_paper_extracted", "archived"],
  question_paper_extracted: ["published", "archived"],
  published: ["grading", "archived"],
  grading: ["results_released", "grading"],
  results_released: ["archived"],
  archived: [],
};
var SUBMISSION_TRANSITIONS = {
  uploaded: ["scouting"],
  scouting: ["scouting_complete", "scouting_failed"],
  scouting_failed: ["scouting", "manual_review_needed"],
  scouting_complete: ["grading"],
  grading: ["grading_complete", "grading_partial", "grading_failed", "manual_review_needed"],
  grading_partial: ["grading"],
  grading_failed: ["grading", "manual_review_needed"],
  grading_complete: ["ready_for_review", "finalization_failed"],
  finalization_failed: ["grading_complete"],
  ready_for_review: ["reviewed"],
  reviewed: [],
  manual_review_needed: ["grading", "reviewed"],
  failed: [],
};
var QUESTION_GRADING_TRANSITIONS = {
  pending: ["processing"],
  processing: ["graded", "needs_review", "failed"],
  graded: ["overridden"],
  needs_review: ["graded", "manual", "overridden"],
  failed: ["pending", "manual"],
  manual: ["overridden"],
  overridden: [],
};
var TEST_SESSION_TRANSITIONS = {
  in_progress: ["completed", "expired", "abandoned"],
  completed: [],
  expired: [],
  abandoned: [],
};
var TENANT_TRANSITIONS = {
  trial: ["active", "expired", "suspended", "deactivated"],
  active: ["suspended", "deactivated", "expired"],
  suspended: ["active", "deactivated"],
  expired: ["active", "deactivated"],
  deactivated: ["active"],
};
var MEMBERSHIP_TRANSITIONS = {
  active: ["inactive", "suspended"],
  inactive: ["active"],
  suspended: ["active", "inactive"],
};
var ENTITY_STATUS_TRANSITIONS = {
  active: ["archived"],
  archived: ["active"],
};
var ANNOUNCEMENT_TRANSITIONS = {
  draft: ["published", "archived"],
  published: ["archived"],
  archived: ["draft"],
};
var ALLOWED_TRANSITIONS = {
  space: SPACE_TRANSITIONS,
  exam: EXAM_TRANSITIONS,
  submission: SUBMISSION_TRANSITIONS,
  questionGrading: QUESTION_GRADING_TRANSITIONS,
  testSession: TEST_SESSION_TRANSITIONS,
  tenant: TENANT_TRANSITIONS,
  membership: MEMBERSHIP_TRANSITIONS,
  entityStatus: ENTITY_STATUS_TRANSITIONS,
  announcement: ANNOUNCEMENT_TRANSITIONS,
};
var canTransition = (domain, from, to) => {
  const map = ALLOWED_TRANSITIONS[domain];
  const targets = map?.[from];
  return targets != null && targets.includes(to);
};
var RubricCriterionLevelSchema = zObject({
  label: z.string(),
  description: z.string().optional(),
  score: z.number(),
});
var RubricCriterionSchema = zObject({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  maxScore: z.number(),
  weight: z.number().optional(),
  levels: z.array(RubricCriterionLevelSchema).optional(),
});
var EvaluationDimensionSchema = zObject({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  priority: zDimensionPriority,
  weight: z.number().optional(),
  scoringScale: z.number().optional(),
  // ⚷ authoring-only — leaks how to score.
  promptGuidance: z.string().optional(),
});
var UnifiedRubricSchema = zObject({
  scoringMode: zRubricScoringMode,
  criteria: z.array(RubricCriterionSchema).optional(),
  dimensions: z.array(EvaluationDimensionSchema).optional(),
  holisticGuidance: z.string().optional(),
  holisticMaxScore: z.number().optional(),
  passingPercentage: z.number().optional(),
  showModelAnswer: z.boolean().optional(),
  // ⚷ authoring-only.
  modelAnswer: z.string().optional(),
  evaluatorGuidance: z.string().optional(),
});
var FeedbackItemSchema = zObject({
  severity: zFeedbackSeverity,
  message: z.string(),
  dimension: z.string().optional(),
  suggestion: z.string().optional(),
});
var RubricBreakdownItemSchema = zObject({
  criterionId: z.string().optional(),
  criterionName: z.string(),
  score: z.number(),
  maxScore: z.number(),
  comment: z.string().optional(),
});
var UnifiedEvaluationResultSchema = zObject({
  score: z.number(),
  maxScore: z.number(),
  correctness: z.number(),
  percentage: z.number(),
  structuredFeedback: z.record(z.string(), z.array(FeedbackItemSchema)).optional(),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  missingConcepts: z.array(z.string()).default([]),
  rubricBreakdown: z.array(RubricBreakdownItemSchema).optional(),
  summary: z.string().optional(),
  confidence: z.number(),
  mistakeClassification: zMistakeClassification.optional(),
  // ⚷ cost telemetry — projected out for clients.
  tokensUsed: z.number().optional(),
  costUsd: z.number().optional(),
  evaluationRubricId: z.string().optional(),
  dimensionsUsed: z.array(z.string()).optional(),
  gradedAt: zTimestamp,
});
var StoredEvaluationSummarySchema = zObject({
  keyTakeaway: z.string(),
  overallComment: z.string(),
});
var StoredEvaluationSchema = zObject({
  score: z.number(),
  maxScore: z.number(),
  correctness: z.number(),
  percentage: z.number(),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  missingConcepts: z.array(z.string()).default([]),
  summary: StoredEvaluationSummarySchema.optional(),
  mistakeClassification: zMistakeClassification.optional(),
});
var McqOptionSchema = zObject({
  id: z.string(),
  text: z.string(),
  imageUrl: z.string().optional(),
  // ⚷ stripped into AnswerKey server-side for non-authoring reads.
  isCorrect: z.boolean().optional(),
});
var McqDataSchema = zObject({
  questionType: z.literal("mcq"),
  options: z.array(McqOptionSchema),
  shuffleOptions: z.boolean().optional(),
});
var McaqDataSchema = zObject({
  questionType: z.literal("mcaq"),
  options: z.array(McqOptionSchema),
  shuffleOptions: z.boolean().optional(),
  minSelections: z.number().int().optional(),
  maxSelections: z.number().int().optional(),
});
var TrueFalseDataSchema = zObject({
  questionType: z.literal("true-false"),
  correctAnswer: z.boolean().optional(),
});
var NumericalDataSchema = zObject({
  questionType: z.literal("numerical"),
  correctAnswer: z.number().optional(),
  tolerance: z.number().optional(),
  unit: z.string().optional(),
});
var TextDataSchema = zObject({
  questionType: z.literal("text"),
  maxLength: z.number().int().optional(),
  modelAnswer: z.string().optional(),
});
var ParagraphDataSchema = zObject({
  questionType: z.literal("paragraph"),
  minWords: z.number().int().optional(),
  maxWords: z.number().int().optional(),
  modelAnswer: z.string().optional(),
});
var CodeDataSchema = zObject({
  questionType: z.literal("code"),
  language: z.string().optional(),
  starterCode: z.string().optional(),
  modelAnswer: z.string().optional(),
  testCases: z.array(z.object({ input: z.string(), output: z.string() }).strict()).optional(),
});
var BlankSlotSchema = zObject({
  id: z.string(),
  correctAnswer: z.string().optional(),
  acceptableAnswers: z.array(z.string()).optional(),
});
var FillBlanksDataSchema = zObject({
  questionType: z.literal("fill-blanks"),
  template: z.string(),
  blanks: z.array(BlankSlotSchema),
});
var FillBlanksDdSchema = zObject({
  questionType: z.literal("fill-blanks-dd"),
  template: z.string(),
  blanks: z.array(BlankSlotSchema),
  optionPool: z.array(z.string()),
});
var MatchPairSchema = zObject({
  left: z.string(),
  right: z.string(),
});
var MatchingDataSchema = zObject({
  questionType: z.literal("matching"),
  pairs: z.array(MatchPairSchema),
  shufflePairs: z.boolean().optional(),
});
var JumbledDataSchema = zObject({
  questionType: z.literal("jumbled"),
  tokens: z.array(z.string()),
  correctOrder: z.array(z.number().int()).optional(),
});
var AudioDataSchema = zObject({
  questionType: z.literal("audio"),
  promptAudioUrl: z.string().optional(),
  maxDurationSeconds: z.number().int().optional(),
  modelAnswer: z.string().optional(),
});
var ImageEvaluationDataSchema = zObject({
  questionType: z.literal("image_evaluation"),
  referenceImageUrls: z.array(z.string()).optional(),
  modelAnswer: z.string().optional(),
});
var GroupOptionItemSchema = zObject({
  id: z.string(),
  text: z.string(),
  group: z.string().optional(),
});
var GroupOptionsDataSchema = zObject({
  questionType: z.literal("group-options"),
  groups: z.array(z.string()),
  items: z.array(GroupOptionItemSchema),
});
var ChatAgentQuestionDataSchema = zObject({
  questionType: z.literal("chat_agent_question"),
  agentInstructions: z.string().optional(),
  maxTurns: z.number().int().optional(),
  modelAnswer: z.string().optional(),
});
var QuestionTypeDataSchema = z.discriminatedUnion("questionType", [
  McqDataSchema,
  McaqDataSchema,
  TrueFalseDataSchema,
  NumericalDataSchema,
  TextDataSchema,
  ParagraphDataSchema,
  CodeDataSchema,
  FillBlanksDataSchema,
  FillBlanksDdSchema,
  MatchingDataSchema,
  JumbledDataSchema,
  AudioDataSchema,
  ImageEvaluationDataSchema,
  GroupOptionsDataSchema,
  ChatAgentQuestionDataSchema,
]);
var QuestionPayloadSchema = zObject({
  type: z.literal("question"),
  basePoints: z.number().optional(),
  questionData: QuestionTypeDataSchema,
});
var TextMaterialSchema = zObject({ materialType: z.literal("text"), body: z.string() });
var VideoMaterialSchema = zObject({
  materialType: z.literal("video"),
  url: z.string(),
  durationSeconds: z.number().int().optional(),
});
var PdfMaterialSchema = zObject({ materialType: z.literal("pdf"), url: z.string() });
var LinkMaterialSchema = zObject({
  materialType: z.literal("link"),
  url: z.string(),
  label: z.string().optional(),
});
var InteractiveMaterialSchema = zObject({
  materialType: z.literal("interactive"),
  embedUrl: z.string(),
});
var StoryMaterialSchema = zObject({
  materialType: z.literal("story"),
  slides: z.array(z.object({ title: z.string().optional(), body: z.string() }).strict()),
});
var RichMaterialSchema = zObject({
  materialType: z.literal("rich"),
  blocks: z.array(z.unknown()),
});
var MaterialDataSchema = z.discriminatedUnion("materialType", [
  TextMaterialSchema,
  VideoMaterialSchema,
  PdfMaterialSchema,
  LinkMaterialSchema,
  InteractiveMaterialSchema,
  StoryMaterialSchema,
  RichMaterialSchema,
]);
var MaterialPayloadSchema = zObject({
  type: z.literal("material"),
  materialData: MaterialDataSchema,
});
var InteractivePayloadSchema = zObject({
  type: z.literal("interactive"),
  interactiveType: zInteractiveType,
  config: z.record(z.string(), z.unknown()).optional(),
  embedUrl: z.string().optional(),
});
var AssessmentPayloadSchema = zObject({
  type: z.literal("assessment"),
  assessmentType: zItemAssessmentType,
  durationMinutes: z.number().int().optional(),
  passingPercentage: z.number().optional(),
});
var DiscussionPayloadSchema = zObject({
  type: z.literal("discussion"),
  threadType: zDiscussionThreadType,
  prompt: z.string(),
});
var ProjectPayloadSchema = zObject({
  type: z.literal("project"),
  brief: z.string(),
  deliverables: z.array(z.string()).optional(),
  rubricDriven: z.boolean().optional(),
});
var CheckpointPayloadSchema = zObject({
  type: z.literal("checkpoint"),
  message: z.string().optional(),
  requiresAcknowledgement: z.boolean().optional(),
});
var ItemPayloadSchema = z.discriminatedUnion("type", [
  QuestionPayloadSchema,
  MaterialPayloadSchema,
  InteractivePayloadSchema,
  AssessmentPayloadSchema,
  DiscussionPayloadSchema,
  ProjectPayloadSchema,
  CheckpointPayloadSchema,
]);
var PyqInfoSchema = zObject({
  year: z.number().int(),
  examName: z.string(),
  marks: z.number().optional(),
});
var ItemMetadataSchema = zObject({
  totalPoints: z.number().optional(),
  maxMarks: z.number().optional(),
  estimatedTime: z.number().optional(),
  learningObjectives: z.array(z.string()).optional(),
  skillsAssessed: z.array(z.string()).optional(),
  bloomsLevel: zBloomsLevel.optional(),
  prerequisites: z.array(z.string()).optional(),
  isRetriable: z.boolean().optional(),
  evaluatorAgentId: zAgentId.optional(),
  pyqInfo: z.array(PyqInfoSchema).optional(),
  featured: z.boolean().optional(),
  viewCount: z.number().int().optional(),
  successRate: z.number().optional(),
  migrationSource: z.string().optional(),
});
var ItemAnalyticsSchema = zObject({
  difficulty: z.number().optional(),
  topics: z.array(z.string()).optional(),
  cognitiveLoad: z.number().optional(),
  conceptImportance: z.number().optional(),
  attemptCount: z.number().int().optional(),
  averageScore: z.number().optional(),
});
var ItemAttachmentSchema = zObject({
  type: zItemAttachmentType,
  url: z.string(),
  name: z.string().optional(),
  sizeBytes: z.number().int().optional(),
});
var UnifiedItemSchema = zObject({
  id: zItemId,
  spaceId: zSpaceId,
  storyPointId: zStoryPointId,
  sectionId: zSectionId.optional(),
  tenantId: zTenantId,
  type: zItemType,
  payload: ItemPayloadSchema,
  title: z.string().optional(),
  content: z.string().optional(),
  difficulty: zDifficulty.optional(),
  topics: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
  orderIndex: z.number().int(),
  meta: ItemMetadataSchema.optional(),
  analytics: ItemAnalyticsSchema.optional(),
  // Resolved snapshot + source ref (REVIEW open-Q resolution).
  rubric: UnifiedRubricSchema.optional(),
  rubricId: zRubricPresetId.optional(),
  linkedQuestionId: zExamQuestionId.optional(),
  attachments: z.array(ItemAttachmentSchema).optional(),
  version: z.number().int().optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
  archivedAt: zTimestamp.nullable(),
});
var AnswerKeySchema = zObject({
  id: zAnswerKeyId,
  itemId: zItemId,
  questionType: zQuestionType,
  correctAnswer: z.unknown(),
  acceptableAnswers: z.array(z.unknown()).optional(),
  // ⚷ leak how to score.
  evaluationGuidance: z.string().optional(),
  modelAnswer: z.string().optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
var RubricPresetSchema = zObject({
  id: zRubricPresetId,
  tenantId: zTenantId,
  name: z.string(),
  description: z.string().optional(),
  rubric: UnifiedRubricSchema,
  category: zRubricPresetCategory,
  questionTypes: z.array(zQuestionType).optional(),
  isDefault: z.boolean(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
var QuestionBankItemSchema = zObject({
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
var ContentVersionSchema = zObject({
  id: zContentVersionId,
  version: z.number().int(),
  entityType: zContentVersionEntityType,
  entityId: z.string(),
  changeType: zContentChangeType,
  changeSummary: z.string(),
  changedBy: zUserId,
  changedAt: zTimestamp,
});
var PurchaseRecordSchema = zObject({
  spaceId: zSpaceId,
  spaceTitle: z.string(),
  amount: zMoney,
  purchasedAt: zTimestamp,
  transactionId: z.string(),
});
var ConsumerProfileSchema = zObject({
  plan: zConsumerPlan,
  enrolledSpaceIds: z.array(zSpaceId).default([]),
  purchaseHistory: z.array(PurchaseRecordSchema).default([]),
  totalSpend: zMoney.optional(),
});
var UserPreferencesSchema = zObject({
  theme: z.string().optional(),
  language: z.string().optional(),
  notificationsEnabled: z.boolean().optional(),
});
var UnifiedUserSchema = zObject({
  uid: zUserId,
  email: z.string().optional(),
  phone: z.string().optional(),
  authProviders: z.array(zAuthProvider).default([]),
  displayName: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  photoURL: z.string().optional(),
  country: z.string().optional(),
  age: z.number().int().optional(),
  grade: z.string().optional(),
  onboardingCompleted: z.boolean().optional(),
  preferences: UserPreferencesSchema.optional(),
  isSuperAdmin: z.boolean(),
  consumerProfile: ConsumerProfileSchema.optional(),
  activeTenantId: zTenantId.optional(),
  status: zUserStatus,
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
  lastLogin: zTimestamp.nullable(),
});
var TeacherPermissionsSchema = zObject({
  permissions: z.record(zTeacherPermissionKey, z.boolean()).optional(),
  managedSpaceIds: z.array(zSpaceId).optional(),
  managedClassIds: z.array(zClassId).optional(),
});
var UserMembershipSchema = zObject({
  id: zMembershipId,
  uid: zUserId,
  tenantId: zTenantId,
  tenantCode: zTenantCode,
  role: zTenantRole,
  status: zMembershipStatus,
  joinSource: zJoinSource,
  teacherId: zTeacherId.optional(),
  studentId: zStudentId.optional(),
  parentId: zParentId.optional(),
  staffId: zStaffId.optional(),
  scannerId: zScannerId.optional(),
  permissions: TeacherPermissionsSchema.optional(),
  staffPermissions: z.record(zStaffPermissionKey, z.boolean()).optional(),
  parentLinkedStudentIds: z.array(zStudentId).optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
  lastActive: zTimestamp.nullable(),
});
var PlatformClaimsSchema = zObject({
  role: zTenantRole.optional(),
  tenantId: zTenantId.optional(),
  tenantCode: zTenantCode.optional(),
  teacherId: zTeacherId.optional(),
  studentId: zStudentId.optional(),
  parentId: zParentId.optional(),
  scannerId: zScannerId.optional(),
  staffId: zStaffId.optional(),
  classIds: z.array(zClassId).optional(),
  classIdsOverflow: z.boolean().optional(),
  studentIds: z.array(zStudentId).optional(),
  permissions: z.record(zTeacherPermissionKey, z.boolean()).optional(),
  staffPermissions: z.record(zStaffPermissionKey, z.boolean()).optional(),
  isSuperAdmin: z.boolean().optional(),
});
var TenantSubscriptionSchema = zObject({
  plan: zTenantPlan,
  maxStudents: z.number().int().optional(),
  maxTeachers: z.number().int().optional(),
  maxExamsPerMonth: z.number().int().optional(),
  maxAiCallsPerMonth: z.number().int().optional(),
  renewsAt: zTimestamp.nullable(),
});
var TenantFeaturesSchema = zObject({
  autograde: z.boolean().optional(),
  levelup: z.boolean().optional(),
  analytics: z.boolean().optional(),
  store: z.boolean().optional(),
});
var TenantSettingsSchema = zObject({
  // Secret Manager reference ONLY — never the key value.
  geminiKeyRef: z.string().optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
  gradingScale: z.string().optional(),
});
var TenantStatsSchema = zObject({
  totalStudents: z.number().int().default(0),
  totalTeachers: z.number().int().default(0),
  totalClasses: z.number().int().default(0),
  totalExams: z.number().int().default(0),
  totalSpaces: z.number().int().default(0),
});
var TenantUsageSchema = zObject({
  examsThisMonth: z.number().int().default(0),
  aiCallsThisMonth: z.number().int().default(0),
  resetAt: zTimestamp.nullable(),
});
var TenantBrandingSchema = zObject({
  logoUrl: z.string().optional(),
  bannerUrl: z.string().optional(),
  faviconUrl: z.string().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
});
var TenantOnboardingSchema = zObject({
  completed: z.boolean().default(false),
  steps: z.array(z.string()).optional(),
  completedAt: zTimestamp.nullable(),
});
var TenantDeactivationSchema = zObject({
  reason: z.string().optional(),
  deactivatedBy: zUserId.optional(),
  deactivatedAt: zTimestamp.nullable(),
});
var TenantSchema = zObject({
  id: zTenantId,
  name: z.string(),
  shortName: z.string().optional(),
  slug: z.string(),
  tenantCode: zTenantCode,
  ownerUid: zUserId,
  status: zTenantStatus,
  subscription: TenantSubscriptionSchema,
  features: TenantFeaturesSchema,
  settings: TenantSettingsSchema,
  stats: TenantStatsSchema,
  usage: TenantUsageSchema.optional(),
  branding: TenantBrandingSchema.optional(),
  onboarding: TenantOnboardingSchema.optional(),
  deactivation: TenantDeactivationSchema.optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  trialEndsAt: zTimestamp.nullable(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
});
var TenantCodeIndexSchema = zObject({
  tenantId: zTenantId,
  createdAt: zTimestamp,
});
var TenantPublicViewSchema = zObject({
  tenantId: zTenantId,
  name: z.string(),
  status: zTenantStatus,
  branding: TenantBrandingSchema.optional(),
});
var StudentSchema = zObject({
  id: zStudentId,
  tenantId: zTenantId,
  authUid: zUserId.optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  displayName: z.string().optional(),
  email: z.string().optional(),
  rollNumber: z.string().optional(),
  section: z.string().optional(),
  classIds: z.array(zClassId).default([]),
  parentIds: z.array(zParentId).default([]),
  grade: z.string().optional(),
  admissionNumber: z.string().optional(),
  dateOfBirth: zIsoDate.optional(),
  status: zEntityStatus,
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
});
var TeacherSchema = zObject({
  id: zTeacherId,
  tenantId: zTenantId,
  authUid: zUserId.optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  firstName: z.string(),
  lastName: z.string(),
  displayName: z.string().optional(),
  employeeId: z.string().optional(),
  department: z.string().optional(),
  subjects: z.array(z.string()).default([]),
  designation: z.string().optional(),
  classIds: z.array(zClassId).default([]),
  sectionIds: z.array(zSectionId).optional(),
  status: zEntityStatus,
  lastLogin: zTimestamp.nullable(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
});
var ParentSchema = zObject({
  id: zParentId,
  tenantId: zTenantId,
  authUid: zUserId.optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  firstName: z.string(),
  lastName: z.string(),
  displayName: z.string().optional(),
  studentIds: z.array(zStudentId).default([]),
  linkedStudentNames: z.array(z.string()).optional(),
  status: zEntityStatus,
  lastLogin: zTimestamp.nullable(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
});
var StaffSchema = zObject({
  id: zStaffId,
  tenantId: zTenantId,
  authUid: zUserId.optional(),
  email: z.string().optional(),
  firstName: z.string(),
  lastName: z.string(),
  displayName: z.string().optional(),
  department: z.string().optional(),
  status: zEntityStatus,
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
});
var ScannerSchema = zObject({
  id: zScannerId,
  tenantId: zTenantId,
  authUid: zUserId,
  name: z.string(),
  status: zEntityStatus,
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
});
var ClassSchema = zObject({
  id: zClassId,
  tenantId: zTenantId,
  name: z.string(),
  grade: z.string(),
  section: z.string().optional(),
  academicSessionId: zAcademicSessionId.optional(),
  teacherIds: z.array(zTeacherId).default([]),
  studentIds: z.array(zStudentId).default([]),
  studentCount: z.number().int().default(0),
  status: zEntityStatus,
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
});
var AcademicSessionSchema = zObject({
  id: zAcademicSessionId,
  tenantId: zTenantId,
  name: z.string(),
  startDate: zIsoDate,
  endDate: zIsoDate,
  isCurrent: z.boolean(),
  status: zEntityStatus,
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
});
var SpaceStatsSchema = zObject({
  storyPointCount: z.number().int().default(0),
  itemCount: z.number().int().default(0),
  enrolledCount: z.number().int().default(0),
  completionCount: z.number().int().default(0),
});
var SpaceRatingAggregateSchema = zObject({
  averageRating: z.number(),
  totalReviews: z.number().int(),
  distribution: z.record(z.string(), z.number().int()),
});
var SpaceSchema = zObject({
  id: zSpaceId,
  tenantId: zTenantId,
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  slug: z.string().optional(),
  type: zSpaceType,
  subject: z.string().optional(),
  labels: z.array(z.string()).optional(),
  classIds: z.array(zClassId).default([]),
  sectionIds: z.array(zSectionId).optional(),
  teacherIds: z.array(zUserId).default([]),
  accessType: zSpaceAccessType,
  academicSessionId: zAcademicSessionId.optional(),
  defaultEvaluatorAgentId: zAgentId.optional(),
  defaultTutorAgentId: zAgentId.optional(),
  defaultRubric: UnifiedRubricSchema.optional(),
  defaultRubricId: zRubricPresetId.optional(),
  // store fields
  price: zMoney.optional(),
  publishedToStore: z.boolean().optional(),
  storeDescription: z.string().optional(),
  storeThumbnailUrl: z.string().optional(),
  // lifecycle
  status: zSpaceStatus,
  publishedAt: zTimestamp.nullable(),
  // ⚷ denormalized
  stats: SpaceStatsSchema.optional(),
  ratingAggregate: SpaceRatingAggregateSchema.optional(),
  version: z.number().int().optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
  archivedAt: zTimestamp.nullable(),
});
var StoryPointSectionSchema = zObject({
  id: zSectionId,
  title: z.string(),
  description: z.string().optional(),
  orderIndex: z.number().int(),
});
var AssessmentScheduleSchema = zObject({
  opensAt: zTimestamp.nullable(),
  closesAt: zTimestamp.nullable(),
});
var RetryConfigSchema = zObject({
  cooldownMinutes: z.number().int().optional(),
  lockAfterPassing: z.boolean().optional(),
});
var AdaptiveConfigSchema = zObject({
  enabled: z.boolean(),
  startingDifficulty: zDifficulty.optional(),
  stepUpThreshold: z.number().int().optional(),
  stepDownThreshold: z.number().int().optional(),
});
var AssessmentConfigSchema = zObject({
  durationMinutes: z.number().int().optional(),
  maxAttempts: z.number().int().optional(),
  shuffle: z.boolean().optional(),
  passingPercentage: z.number().optional(),
  adaptiveConfig: AdaptiveConfigSchema.optional(),
  schedule: AssessmentScheduleSchema.optional(),
  retryConfig: RetryConfigSchema.optional(),
});
var StoryPointStatsSchema = zObject({
  itemCount: z.number().int().default(0),
  completionCount: z.number().int().default(0),
});
var StoryPointSchema = zObject({
  id: zStoryPointId,
  spaceId: zSpaceId,
  tenantId: zTenantId,
  title: z.string(),
  description: z.string().optional(),
  orderIndex: z.number().int(),
  type: zStoryPointType,
  sections: z.array(StoryPointSectionSchema).default([]),
  assessmentConfig: AssessmentConfigSchema.optional(),
  defaultRubric: UnifiedRubricSchema.optional(),
  defaultRubricId: zRubricPresetId.optional(),
  difficulty: zDifficulty.optional(),
  estimatedTimeMinutes: z.number().int().optional(),
  stats: StoryPointStatsSchema.optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
  archivedAt: zTimestamp.nullable(),
});
var AgentSchema = zObject({
  id: zAgentId,
  spaceId: zSpaceId,
  tenantId: zTenantId,
  type: zAgentType,
  name: z.string(),
  identity: z.string().optional(),
  isActive: z.boolean(),
  // tutor fields
  systemPrompt: z.string().optional(),
  supportedLanguages: z.array(z.string()).optional(),
  defaultLanguage: z.string().optional(),
  maxConversationTurns: z.number().int().optional(),
  // evaluator fields (rules → string[] per D12)
  rules: z.array(z.string()).optional(),
  evaluationObjectives: z.array(z.string()).optional(),
  strictness: z.number().optional(),
  feedbackStyle: z.string().optional(),
  modelOverride: z.string().optional(),
  temperatureOverride: z.number().optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
});
var AdaptiveStateSchema = zObject({
  currentDifficulty: zDifficulty,
  consecutiveCorrect: z.number().int().default(0),
  consecutiveIncorrect: z.number().int().default(0),
  answeredByDifficulty: z.record(z.string(), z.number().int()).optional(),
});
var AnalyticsBreakdownEntrySchema = zObject({
  correct: z.number().int(),
  total: z.number().int(),
  points: z.number().optional(),
  maxPoints: z.number().optional(),
});
var TestAnalyticsSchema = zObject({
  topicBreakdown: z.record(z.string(), AnalyticsBreakdownEntrySchema).optional(),
  bloomsBreakdown: z.record(z.string(), AnalyticsBreakdownEntrySchema).optional(),
  difficultyBreakdown: z.record(z.string(), AnalyticsBreakdownEntrySchema).optional(),
  sectionBreakdown: z.record(z.string(), AnalyticsBreakdownEntrySchema).optional(),
  timePerQuestion: z.record(z.string(), z.number()).optional(),
  averageTimePerQuestion: z.number().optional(),
});
var DifficultyProgressionEntrySchema = zObject({
  questionIndex: z.number().int(),
  difficulty: zDifficulty,
  correct: z.boolean(),
});
var DigitalTestSessionSchema = zObject({
  id: zTestSessionId,
  tenantId: zTenantId,
  userId: zUserId,
  spaceId: zSpaceId,
  storyPointId: zStoryPointId,
  sessionType: zTestSessionType,
  attemptNumber: z.number().int(),
  status: zTestSessionStatus,
  isLatest: z.boolean(),
  // timing (⚷ serverDeadline)
  startedAt: zTimestamp,
  endedAt: zTimestamp.nullable(),
  durationMinutes: z.number().int(),
  serverDeadline: zTimestamp.nullable(),
  // question tracking
  totalQuestions: z.number().int(),
  answeredQuestions: z.number().int().default(0),
  questionOrder: z.array(zItemId).default([]),
  // lightweight boolean maps kept inline (REVIEW D6)
  visitedQuestions: z.record(z.string(), z.boolean()).default({}),
  markedForReview: z.record(z.string(), z.boolean()).default({}),
  // scores (⚷ server-computed)
  pointsEarned: z.number().optional(),
  totalPoints: z.number().optional(),
  marksEarned: z.number().optional(),
  totalMarks: z.number().optional(),
  percentage: z.number().optional(),
  sectionMapping: z.record(z.string(), z.string()).optional(),
  lastVisitedIndex: z.number().int().optional(),
  // adaptive state
  adaptiveState: AdaptiveStateSchema.optional(),
  currentDifficultyLevel: zDifficulty.optional(),
  difficultyProgression: z.array(DifficultyProgressionEntrySchema).optional(),
  analytics: TestAnalyticsSchema.optional(),
  // audit
  submittedAt: zTimestamp.nullable(),
  autoSubmitted: z.boolean().optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
var TestSubmissionSchema = zObject({
  itemId: zItemId,
  questionType: zQuestionType,
  answer: z.unknown(),
  submittedAt: zTimestamp,
  timeSpentSeconds: z.number().int().optional(),
  // post-grade (⚷)
  evaluation: UnifiedEvaluationResultSchema.optional(),
  correct: z.boolean().optional(),
  pointsEarned: z.number().optional(),
  totalPoints: z.number().optional(),
});
var ChatMessageSchema = zObject({
  id: zChatMessageId,
  role: zChatMessageRole,
  text: z.string(),
  timestamp: zTimestamp,
  mediaUrls: z.array(z.string()).optional(),
  tokensUsed: z.number().int().optional(),
});
var ChatSessionSchema = zObject({
  id: zChatSessionId,
  tenantId: zTenantId,
  userId: zUserId,
  spaceId: zSpaceId,
  storyPointId: zStoryPointId,
  itemId: zItemId,
  questionType: zQuestionType.optional(),
  agentId: zAgentId.optional(),
  agentName: z.string().optional(),
  sessionTitle: z.string(),
  previewMessage: z.string(),
  messageCount: z.number().int().default(0),
  language: z.string(),
  isActive: z.boolean(),
  messages: z.array(ChatMessageSchema).default([]),
  systemPrompt: z.string().optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
});
var SpaceReviewSchema = zObject({
  id: zSpaceReviewId,
  spaceId: zSpaceId,
  tenantId: zTenantId,
  userId: zUserId,
  userName: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
});
var StoreSpaceListingSchema = zObject({
  id: zSpaceId,
  sourceTenantId: zTenantId,
  title: z.string(),
  price: zMoney,
  accessType: zSpaceAccessType,
  storeDescription: z.string().optional(),
  storeThumbnailUrl: z.string().optional(),
  ratingAggregate: SpaceRatingAggregateSchema.optional(),
});
var SpacePurchaseRecordSchema = zObject({
  id: zPurchaseId,
  userId: zUserId,
  spaceId: zSpaceId,
  sourceTenantId: zTenantId,
  amount: zMoney,
  transactionId: z.string(),
  gateway: z.string(),
  status: zPurchaseStatus,
  purchasedAt: zTimestamp,
});
var QuestionProgressDataSchema = zObject({
  status: zQuestionProgressStatus,
  attemptsCount: z.number().int().default(0),
  bestScore: z.number().optional(),
  pointsEarned: z.number().optional(),
  totalPoints: z.number().optional(),
  percentage: z.number().optional(),
  solved: z.boolean().default(false),
  latestScore: z.number().optional(),
  latestStatus: zQuestionProgressStatus.optional(),
});
var AttemptRecordSchema = zObject({
  attemptNumber: z.number().int(),
  answer: z.unknown(),
  evaluation: StoredEvaluationSchema,
  score: z.number(),
  maxScore: z.number(),
  timestamp: zTimestamp,
});
var ItemProgressEntrySchema = zObject({
  itemId: zItemId,
  itemType: zItemType,
  completed: z.boolean().default(false),
  completedAt: zTimestamp.nullable(),
  timeSpent: z.number().optional(),
  interactions: z.number().int().optional(),
  lastUpdatedAt: zTimestamp,
  // question-specific
  questionData: QuestionProgressDataSchema.optional(),
  // material-specific
  progress: z.number().optional(),
  score: z.number().optional(),
  feedback: z.string().optional(),
  // revisit display
  lastAnswer: z.unknown().optional(),
  lastEvaluation: StoredEvaluationSchema.optional(),
  attempts: z.array(AttemptRecordSchema).optional(),
});
var StoryPointProgressSchema = zObject({
  storyPointId: zStoryPointId,
  status: zProgressStatus,
  pointsEarned: z.number().default(0),
  totalPoints: z.number().default(0),
  percentage: z.number().default(0),
  completedItems: z.number().int().default(0),
  totalItems: z.number().int().default(0),
  completedAt: zTimestamp.nullable(),
});
var StoryPointProgressDocSchema = zObject({
  storyPointId: zStoryPointId,
  status: zProgressStatus,
  pointsEarned: z.number().default(0),
  totalPoints: z.number().default(0),
  percentage: z.number().default(0),
  completedItems: z.number().int().default(0),
  totalItems: z.number().int().default(0),
  completedAt: zTimestamp.nullable(),
  updatedAt: zTimestamp,
  items: z.record(z.string(), ItemProgressEntrySchema).default({}),
});
var SpaceProgressSchema = zObject({
  id: zSpaceProgressId,
  userId: zUserId,
  tenantId: zTenantId,
  spaceId: zSpaceId,
  status: zProgressStatus,
  pointsEarned: z.number().default(0),
  totalPoints: z.number().default(0),
  marksEarned: z.number().optional(),
  totalMarks: z.number().optional(),
  percentage: z.number().default(0),
  storyPoints: z.record(z.string(), StoryPointProgressSchema).default({}),
  startedAt: zTimestamp.nullable(),
  completedAt: zTimestamp.nullable(),
  updatedAt: zTimestamp,
});
var RecomputeMarkerSchema = zObject({
  reason: z.enum(["autograde", "levelup", "storyPoint", "atRisk", "manual"]),
  requestedAt: zTimestamp,
  taskId: z.string().optional(),
});
var RecentExamEntrySchema = zObject({
  examId: z.string(),
  examTitle: z.string(),
  score: z.number(),
  percentage: z.number(),
  date: zTimestamp,
});
var RecentActivityEntrySchema = zObject({
  spaceId: z.string(),
  spaceTitle: z.string(),
  pointsEarned: z.number(),
  date: zTimestamp,
});
var AutogradeSubjectBreakdownSchema = zObject({
  avgScore: z.number(),
  examCount: z.number().int(),
});
var StudentAutogradeMetricsSchema = zObject({
  totalExams: z.number().int(),
  completedExams: z.number().int(),
  averageScore: z.number(),
  averagePercentage: z.number(),
  totalMarksObtained: z.number(),
  totalMarksAvailable: z.number(),
  subjectBreakdown: z.record(z.string(), AutogradeSubjectBreakdownSchema),
  recentExams: z.array(RecentExamEntrySchema),
});
var StudentLevelupMetricsSchema = zObject({
  totalSpaces: z.number().int(),
  completedSpaces: z.number().int(),
  averageCompletion: z.number(),
  totalPointsEarned: z.number(),
  totalPointsAvailable: z.number(),
  averageAccuracy: z.number(),
  streakDays: z.number().int(),
  subjectBreakdown: z.record(z.string(), z.number()),
  recentActivity: z.array(RecentActivityEntrySchema),
});
var StudentProgressSummarySchema = zObject({
  id: zStudentId,
  tenantId: zTenantId,
  studentId: zStudentId,
  autograde: StudentAutogradeMetricsSchema,
  levelup: StudentLevelupMetricsSchema,
  overallScore: z.number(),
  strengthAreas: z.array(z.string()).default([]),
  weaknessAreas: z.array(z.string()).default([]),
  isAtRisk: z.boolean(),
  atRiskReasons: z.array(zAtRiskReason).default([]),
  lastUpdatedAt: zTimestamp,
  recompute: RecomputeMarkerSchema.optional(),
});
var ClassAutogradeMetricsSchema = zObject({
  averageScore: z.number(),
  averagePercentage: z.number(),
  examCount: z.number().int(),
  passRate: z.number(),
});
var ClassLevelupMetricsSchema = zObject({
  averageCompletion: z.number(),
  totalPointsEarned: z.number(),
  activeStudents: z.number().int(),
});
var ClassProgressSummarySchema = zObject({
  id: zClassId,
  tenantId: zTenantId,
  classId: zClassId,
  className: z.string(),
  studentCount: z.number().int(),
  autograde: ClassAutogradeMetricsSchema,
  levelup: ClassLevelupMetricsSchema,
  atRiskStudentIds: z.array(zStudentId).default([]),
  atRiskCount: z.number().int(),
  lastUpdatedAt: zTimestamp,
});
var LearningInsightSchema = zObject({
  id: zInsightId,
  tenantId: zTenantId,
  studentId: zStudentId,
  type: zInsightType,
  priority: zInsightPriority,
  title: z.string(),
  description: z.string(),
  actionType: zInsightActionType,
  actionEntityId: z.string().optional(),
  actionEntityTitle: z.string().optional(),
  createdAt: zTimestamp,
  dismissedAt: zTimestamp.nullable(),
});
var ExamQuestionPaperSchema = zObject({
  images: z.array(z.string()),
  extractedAt: zTimestamp.nullable(),
  questionCount: z.number().int(),
  examType: z.literal("standard"),
});
var ExamGradingConfigSchema = zObject({
  autoGrade: z.boolean(),
  allowRubricEdit: z.boolean(),
  evaluationSettingsId: zEvaluationSettingsId.optional(),
  allowManualOverride: z.boolean(),
  requireOverrideReason: z.boolean(),
  releaseResultsAutomatically: z.boolean(),
});
var ExamStatsSchema = zObject({
  totalSubmissions: z.number().int().default(0),
  gradedSubmissions: z.number().int().default(0),
  avgScore: z.number().default(0),
  passRate: z.number().default(0),
});
var ExamSchema = zObject({
  id: zExamId,
  tenantId: zTenantId,
  title: z.string(),
  subject: z.string(),
  topics: z.array(z.string()).default([]),
  classIds: z.array(zClassId).default([]),
  sectionIds: z.array(zSectionId).optional(),
  examDate: zTimestamp,
  duration: z.number().int(),
  academicSessionId: zAcademicSessionId.optional(),
  totalMarks: z.number(),
  passingMarks: z.number(),
  status: zExamStatus,
  questionPaper: ExamQuestionPaperSchema.optional(),
  gradingConfig: ExamGradingConfigSchema,
  evaluationSettingsId: zEvaluationSettingsId.optional(),
  linkedSpaceId: zSpaceId.optional(),
  linkedSpaceTitle: z.string().optional(),
  linkedStoryPointId: zStoryPointId.optional(),
  stats: ExamStatsSchema.optional(),
  createdBy: zUserId,
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
var SubQuestionSchema = zObject({
  label: z.string(),
  text: z.string(),
  maxMarks: z.number(),
  rubric: UnifiedRubricSchema.optional(),
});
var ExamQuestionSchema = zObject({
  id: zExamQuestionId,
  examId: zExamId,
  text: z.string(),
  imageUrls: z.array(z.string()).optional(),
  maxMarks: z.number(),
  order: z.number().int(),
  rubric: UnifiedRubricSchema,
  questionType: zQuestionType.optional(),
  subQuestions: z.array(SubQuestionSchema).optional(),
  linkedItemId: zItemId.optional(),
  extractedBy: zUserId.optional(),
  extractedAt: zTimestamp.nullable(),
  extractionConfidence: z.number().optional(),
  readabilityIssue: z.boolean().optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
var AnswerSheetDataSchema = zObject({
  images: z.array(z.string()),
  uploadedAt: zTimestamp,
  uploadedBy: zUserId,
  uploadSource: zUploadSource,
});
var ScoutingResultSchema = zObject({
  routingMap: z.record(z.string(), z.array(z.number().int())),
  confidence: z.record(z.string(), z.number()),
  completedAt: zTimestamp,
});
var SubmissionSummarySchema = zObject({
  totalScore: z.number(),
  maxScore: z.number(),
  percentage: z.number(),
  grade: zGradeLetter,
  questionsGraded: z.number().int(),
  totalQuestions: z.number().int(),
  completedAt: zTimestamp.nullable(),
});
var GradingProgressSchema = zObject({
  graded: z.number().int(),
  total: z.number().int(),
  batchIndex: z.number().int().optional(),
});
var SubmissionSchema = zObject({
  id: zSubmissionId,
  examId: zExamId,
  studentId: zStudentId,
  studentName: z.string(),
  rollNumber: z.string(),
  classId: zClassId,
  answerSheets: AnswerSheetDataSchema,
  scoutingResult: ScoutingResultSchema.optional(),
  summary: SubmissionSummarySchema,
  pipelineStatus: zSubmissionPipelineStatus,
  pipelineError: z.string().optional(),
  retryCount: z.number().int().default(0),
  watchdogRetryCount: z.number().int().optional(),
  gradingProgress: GradingProgressSchema.optional(),
  resultsReleased: z.boolean().default(false),
  resultsReleasedAt: zTimestamp.nullable(),
  resultsReleasedBy: zUserId.optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
var QuestionMappingSchema = zObject({
  pageIndices: z.array(z.number().int()),
  imageUrls: z.array(z.string()),
  scoutedAt: zTimestamp,
});
var ManualOverrideSchema = zObject({
  score: z.number(),
  reason: z.string(),
  overriddenBy: zUserId,
  overriddenAt: zTimestamp,
  originalScore: z.number(),
});
var QuestionSubmissionSchema = zObject({
  id: zQuestionSubmissionId,
  submissionId: zSubmissionId,
  questionId: zExamQuestionId,
  examId: zExamId,
  mapping: QuestionMappingSchema,
  evaluation: UnifiedEvaluationResultSchema.optional(),
  gradingStatus: zQuestionGradingStatus,
  gradingError: z.string().optional(),
  gradingRetryCount: z.number().int().default(0),
  manualOverride: ManualOverrideSchema.optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
var EvaluationDisplaySettingsSchema = zObject({
  showStrengths: z.boolean(),
  showKeyTakeaway: z.boolean(),
  prioritizeByImportance: z.boolean(),
});
var EvaluationConfidenceConfigSchema = zObject({
  confidenceThreshold: z.number().default(0.7),
  autoApproveThreshold: z.number().default(0.9),
  requireReviewForPartialCredit: z.boolean(),
});
var UsageQuotaConfigSchema = zObject({
  monthlyBudgetUsd: z.number(),
  dailyCallLimit: z.number().int(),
  warningThresholdPercent: z.number().default(80),
});
var EvaluationSettingsSchema = zObject({
  id: zEvaluationSettingsId,
  name: z.string(),
  description: z.string().optional(),
  isDefault: z.boolean(),
  isPublic: z.boolean().optional(),
  enabledDimensions: z.array(EvaluationDimensionSchema),
  displaySettings: EvaluationDisplaySettingsSchema,
  confidenceConfig: EvaluationConfidenceConfigSchema.optional(),
  usageQuota: UsageQuotaConfigSchema.optional(),
  createdBy: zUserId.optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
var GRADING_PIPELINE_STEPS = ["scouting", "grading"];
var DEAD_LETTER_RESOLUTION_METHODS = ["retry_success", "manual_grade", "dismissed"];
var GradingDeadLetterEntrySchema = zObject({
  id: zDeadLetterEntryId,
  submissionId: zSubmissionId,
  questionSubmissionId: zQuestionSubmissionId.optional(),
  pipelineStep: z.enum(GRADING_PIPELINE_STEPS),
  error: z.string(),
  errorStack: z.string().optional(),
  attempts: z.number().int(),
  lastAttemptAt: zTimestamp,
  resolvedAt: zTimestamp.nullable(),
  resolvedBy: zUserId.optional(),
  resolutionMethod: z.enum(DEAD_LETTER_RESOLUTION_METHODS).optional(),
  createdAt: zTimestamp,
});
var QuestionAnalyticsEntrySchema = zObject({
  questionId: zExamQuestionId,
  avgScore: z.number(),
  maxScore: z.number(),
  attemptCount: z.number().int(),
  difficultyIndex: z.number().optional(),
  discriminationIndex: z.number().optional(),
});
var ClassBreakdownEntrySchema = zObject({
  classId: zClassId,
  avgScore: z.number(),
  avgPercentage: z.number(),
  submissionCount: z.number().int(),
});
var TopicPerformanceEntrySchema = zObject({
  topic: z.string(),
  avgPercentage: z.number(),
  questionCount: z.number().int(),
});
var ScoreDistributionSchema = zObject({
  buckets: z.array(z.object({ label: z.string(), count: z.number().int() }).strict()),
  gradeDistribution: z.record(z.string(), z.number().int()).optional(),
});
var ExamAnalyticsSchema = zObject({
  id: zExamAnalyticsId,
  tenantId: zTenantId,
  examId: zExamId,
  totalSubmissions: z.number().int(),
  gradedSubmissions: z.number().int(),
  avgScore: z.number(),
  avgPercentage: z.number(),
  passRate: z.number(),
  medianScore: z.number(),
  scoreDistribution: ScoreDistributionSchema,
  questionAnalytics: z.record(z.string(), QuestionAnalyticsEntrySchema),
  classBreakdown: z.record(z.string(), ClassBreakdownEntrySchema),
  topicPerformance: z.record(z.string(), TopicPerformanceEntrySchema),
  computedAt: zTimestamp,
  lastUpdatedAt: zTimestamp,
});
var CostBucketSchema = zObject({
  calls: z.number().int(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  costUsd: z.number(),
});
var costSummaryShape = {
  totalCalls: z.number().int(),
  totalInputTokens: z.number().int(),
  totalOutputTokens: z.number().int(),
  totalCostUsd: z.number(),
  byPurpose: z.record(z.string(), CostBucketSchema),
  byModel: z.record(z.string(), CostBucketSchema),
  budgetLimitUsd: z.number().optional(),
  budgetUsedPercent: z.number().optional(),
  budgetAlertSent: z.boolean().optional(),
  computedAt: zTimestamp,
};
var DailyCostSummarySchema = zObject({
  id: zCostSummaryId,
  tenantId: zTenantId,
  date: zIsoDate,
  ...costSummaryShape,
});
var MonthlyCostSummarySchema = zObject({
  id: zCostSummaryId,
  tenantId: zTenantId,
  // YYYY-MM
  month: z.string().regex(/^\d{4}-\d{2}$/),
  ...costSummaryShape,
});
var LlmCallLogSchema = zObject({
  id: zLlmCallLogId,
  tenantId: zTenantId,
  functionName: z.string(),
  model: z.string(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  totalTokens: z.number().int(),
  costUSD: z.number(),
  latencyMs: z.number().int(),
  status: zLlmCallStatus,
  errorMessage: z.string().optional(),
  userId: zUserId.optional(),
  examId: zExamId.optional(),
  spaceId: zSpaceId.optional(),
  createdAt: zTimestamp,
});
var HealthSnapshotSchema = zObject({
  id: zHealthSnapshotId,
  date: zIsoDate,
  status: zDayHealthStatus,
  services: z.record(
    z.string(),
    z.object({ status: zDayHealthStatus, latencyMs: z.number().optional() }).strict()
  ),
  checkedAt: zTimestamp,
});
var PlatformActivityLogSchema = zObject({
  id: zPlatformActivityLogId,
  action: zPlatformActivityAction,
  actorUid: zUserId,
  actorEmail: z.string(),
  tenantId: zTenantId.optional(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: zTimestamp,
});
var AchievementCriteriaSchema = zObject({
  type: zAchievementCriteriaType,
  threshold: z.number().int().min(1),
  subject: z.string().optional(),
  spaceId: zSpaceId.optional(),
});
var AchievementSchema = zObject({
  id: zAchievementId,
  tenantId: zTenantId,
  title: z.string(),
  description: z.string(),
  icon: z.string(),
  category: zAchievementCategory,
  rarity: zAchievementRarity,
  tier: zAchievementTier,
  criteria: AchievementCriteriaSchema,
  pointsReward: z.number().int().min(0),
  isActive: z.boolean(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  archivedAt: zTimestamp.nullable(),
});
var StudentAchievementSchema = zObject({
  id: zStudentAchievementId,
  tenantId: zTenantId,
  userId: zUserId,
  achievementId: zAchievementId,
  // denormalized snapshot for display (server writes at unlock).
  achievement: AchievementSchema,
  earnedAt: zTimestamp,
  // the ONLY client-mutable field (mark-read).
  seen: z.boolean(),
});
var StudentLevelSchema = zObject({
  id: zUserId,
  tenantId: zTenantId,
  userId: zUserId,
  level: z.number().int().min(1),
  currentXP: z.number().int().min(0),
  xpToNextLevel: z.number().int().min(0),
  totalXP: z.number().int().min(0),
  tier: zAchievementTier,
  achievementCount: z.number().int().min(0),
  updatedAt: zTimestamp,
});
var StudyGoalSchema = zObject({
  id: zStudyGoalId,
  tenantId: zTenantId,
  userId: zUserId,
  title: z.string(),
  description: z.string().optional(),
  targetType: zStudyGoalTargetType,
  targetCount: z.number().int().min(1),
  // server-derived
  currentCount: z.number().int().min(0),
  startDate: zIsoDate,
  endDate: zIsoDate,
  completed: z.boolean(),
  completedAt: zTimestamp.nullable(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  archivedAt: zTimestamp.nullable(),
});
var StudySessionSchema = zObject({
  id: zStudySessionId,
  tenantId: zTenantId,
  userId: zUserId,
  date: zIsoDate,
  minutesStudied: z.number().int().min(0),
  spacesWorked: z.array(zSpaceId).default([]),
  itemsCompleted: z.number().int().min(0),
  pointsEarned: z.number().int().min(0),
});
var LeaderboardEntrySchema = zObject({
  userId: zUserId,
  displayName: z.string(),
  avatarUrl: z.string().optional(),
  score: z.number(),
  overallScore: z.number().optional(),
  examAvg: z.number().optional(),
  spaceCompletion: z.number().optional(),
  totalPoints: z.number(),
  streakDays: z.number().int(),
  tier: zAchievementTier.optional(),
  countsByTier: z.record(z.string(), z.number().int()).optional(),
  rank: z.number().int(),
  isAtRisk: z.boolean().optional(),
  updatedAt: zTimestamp,
});
var GamificationSummarySchema = zObject({
  level: StudentLevelSchema,
  recentAchievements: z.array(StudentAchievementSchema),
  unseenCount: z.number().int().min(0),
  currentStreakDays: z.number().int().min(0),
  tenantRank: z.number().int().nullable(),
  activeGoals: z.array(StudyGoalSchema),
});
var NotificationSchema = zObject({
  id: zNotificationId,
  tenantId: zTenantId,
  recipientUid: zUserId,
  recipientRole: zNotificationRecipientRole,
  type: zNotificationType,
  title: z.string().max(200),
  body: z.string().max(1e3),
  entityType: zNotificationEntityType.optional(),
  entityId: z.string().optional(),
  actionUrl: z.string().optional(),
  isRead: z.boolean().default(false),
  createdAt: zTimestamp,
  readAt: zTimestamp.nullable(),
});
var NotificationPreferencesSchema = zObject({
  id: z.string(),
  tenantId: zTenantId,
  userId: zUserId,
  enabledTypes: z.array(zNotificationType).default([]),
  muteUntil: zTimestamp.nullable(),
});
var NotificationBadgeStateSchema = zObject({
  unreadCount: z.number().int().min(0),
  latest: zObject({
    id: zNotificationId,
    title: z.string(),
    type: zNotificationType,
    createdAt: z.number().int(),
  }).optional(),
});
var AnnouncementSchema = zObject({
  id: zAnnouncementId,
  tenantId: zTenantId.nullable(),
  title: z.string().max(200),
  body: z.string().max(5e3),
  authorUid: zUserId,
  authorName: z.string(),
  scope: zAnnouncementScope,
  targetRoles: z.array(zNotificationRecipientRole).max(10).optional(),
  targetClassIds: z.array(zClassId).max(100).optional(),
  status: zAnnouncementStatus,
  publishedAt: zTimestamp.nullable(),
  archivedAt: zTimestamp.nullable(),
  expiresAt: zTimestamp.nullable(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});

// ../../packages/services/dist/repo-admin/index.js
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldPath } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
var __defProp2 = Object.defineProperty;
var __export2 = (target, all) => {
  for (var name in all) __defProp2(target, name, { get: all[name], enumerable: true });
};
var appSingleton;
var dbSingleton;
var authSingleton;
function adminApp() {
  if (appSingleton) return appSingleton;
  const existing = getApps();
  appSingleton =
    existing.length > 0
      ? existing[0]
      : initializeApp(
          process.env["GOOGLE_APPLICATION_CREDENTIALS"] ? { credential: applicationDefault() } : {}
        );
  return appSingleton;
}
function db() {
  if (!dbSingleton) {
    dbSingleton = getFirestore(adminApp());
  }
  return dbSingleton;
}
function auth() {
  if (!authSingleton) {
    authSingleton = getAuth(adminApp());
  }
  return authSingleton;
}
var TS_DUCK = (v) => typeof v === "object" && v !== null && typeof v.toDate === "function";
function fromFirestore(value) {
  if (value == null) return value;
  if (value instanceof Timestamp) {
    return toTimestamp(value.toDate());
  }
  if (TS_DUCK(value)) {
    return toTimestamp(value.toDate());
  }
  if (Array.isArray(value)) {
    return value.map(fromFirestore);
  }
  if (typeof value === "object") {
    const obj = value;
    if (
      ("seconds" in obj && "nanoseconds" in obj && Object.keys(obj).length === 2) ||
      ("_seconds" in obj && "_nanoseconds" in obj && Object.keys(obj).length === 2)
    ) {
      return toTimestamp(obj);
    }
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = fromFirestore(v);
    }
    return out;
  }
  return value;
}
function docFromFirestore(data) {
  return fromFirestore(data);
}
function toFirestore(data) {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === void 0) continue;
    out[k] = stripForWrite(v);
  }
  return out;
}
function stripForWrite(value) {
  if (value == null) return value;
  if (value instanceof Timestamp) return toTimestamp(value.toDate());
  if (TS_DUCK(value)) return toTimestamp(value.toDate());
  if (value instanceof Date) return toTimestamp(value);
  if (Array.isArray(value)) return value.map(stripForWrite);
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === void 0) continue;
      out[k] = stripForWrite(v);
    }
    return out;
  }
  return value;
}
function encodeCursor(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}
function decodeCursor(cursor) {
  return JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
}
function encodePageCursor(payload) {
  return encodeCursor(payload);
}
function decodePageCursor(cursor) {
  const v = decodeCursor(cursor);
  if (v == null || typeof v !== "object" || !("id" in v)) {
    throw new RangeError("malformed cursor");
  }
  return v;
}
var IN_CHUNK_SIZE = 10;
function chunk(arr, size = IN_CHUNK_SIZE) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}
var paths_exports = {};
__export2(paths_exports, {
  ANSWER_KEYS_COLLECTION_GROUP: () => ANSWER_KEYS_COLLECTION_GROUP,
  ITEMS_COLLECTION_GROUP: () => ITEMS_COLLECTION_GROUP,
  answerKeyDoc: () => answerKeyDoc,
  auditPath: () => auditPath,
  collectionPrefix: () => collectionPrefix,
  consumerProfileDoc: () => consumerProfileDoc,
  consumerProfilesCollection: () => consumerProfilesCollection,
  globalEvaluationPresetDoc: () => globalEvaluationPresetDoc,
  globalEvaluationPresetsCollection: () => globalEvaluationPresetsCollection,
  idempotencyDoc: () => idempotencyDoc,
  impersonationSessionDoc: () => impersonationSessionDoc,
  impersonationSessionsCollection: () => impersonationSessionsCollection,
  itemDoc: () => itemDoc,
  itemsPath: () => itemsPath,
  outboxPath: () => outboxPath,
  platformActivityLogCollection: () => platformActivityLogCollection,
  spaceDoc: () => spaceDoc,
  spaceProgressDoc: () => spaceProgressDoc,
  spaceProgressId: () => spaceProgressId,
  spaceProgressLiveDoc: () => spaceProgressLiveDoc,
  spacesPath: () => spacesPath,
  storyPointDoc: () => storyPointDoc,
  storyPointProgressDoc: () => storyPointProgressDoc,
  storyPointsPath: () => storyPointsPath,
  tenantCodeDoc: () => tenantCodeDoc,
  tenantCodesCollection: () => tenantCodesCollection,
  tenantCollection: () => tenantCollection,
  tenantCollectionDoc: () => tenantCollectionDoc,
  tenantDoc: () => tenantDoc,
  tenantsRoot: () => tenantsRoot,
  topLevel: () => topLevel,
  userMembershipDoc: () => userMembershipDoc,
  userMembershipId: () => userMembershipId,
  userMembershipsCollection: () => userMembershipsCollection,
  usersCollection: () => usersCollection,
  usersDoc: () => usersDoc,
});
function collectionPrefix() {
  return process.env["LVLUP_COLLECTION_PREFIX"] ?? "";
}
function topLevel(name) {
  return `${collectionPrefix()}${name}`;
}
var PLATFORM_TENANT = "__platform__";
function tenantsRoot() {
  return topLevel("tenants");
}
function tenantDoc(tenantId) {
  return `${tenantsRoot()}/${tenantId}`;
}
function tenantCollection(tenantId, collection) {
  return `${tenantDoc(tenantId)}/${collection}`;
}
function tenantCollectionDoc(tenantId, collection, id) {
  return `${tenantCollection(tenantId, collection)}/${id}`;
}
function spacesPath(tenantId) {
  return tenantCollection(tenantId, "spaces");
}
function spaceDoc(tenantId, spaceId) {
  return `${spacesPath(tenantId)}/${spaceId}`;
}
function storyPointsPath(tenantId, spaceId) {
  return `${spaceDoc(tenantId, spaceId)}/storyPoints`;
}
function storyPointDoc(tenantId, spaceId, storyPointId) {
  return `${storyPointsPath(tenantId, spaceId)}/${storyPointId}`;
}
function itemsPath(tenantId, spaceId, storyPointId) {
  return `${storyPointDoc(tenantId, spaceId, storyPointId)}/items`;
}
function itemDoc(tenantId, spaceId, storyPointId, itemId) {
  return `${itemsPath(tenantId, spaceId, storyPointId)}/${itemId}`;
}
var ITEMS_COLLECTION_GROUP = "items";
function answerKeyDoc(tenantId, spaceId, storyPointId, itemId) {
  return `${itemDoc(tenantId, spaceId, storyPointId, itemId)}/answerKeys/${itemId}`;
}
var ANSWER_KEYS_COLLECTION_GROUP = "answerKeys";
function spaceProgressId(userId, spaceId) {
  return `${userId}_${spaceId}`;
}
function spaceProgressDoc(tenantId, userId, spaceId) {
  return `${tenantCollection(tenantId, "spaceProgress")}/${spaceProgressId(userId, spaceId)}`;
}
function spaceProgressLiveDoc(tenantId, userId, spaceId) {
  return `${spaceProgressDoc(tenantId, userId, spaceId)}/projection/live`;
}
function storyPointProgressDoc(tenantId, userId, spaceId, storyPointId) {
  return `${spaceProgressDoc(tenantId, userId, spaceId)}/storyPointProgress/${storyPointId}`;
}
function idempotencyDoc(tenantId, uid, key) {
  return `${tenantCollection(tenantId, "idempotency")}/${uid}_${key}`;
}
function outboxPath(tenantId) {
  return tenantCollection(tenantId, "outbox");
}
function auditPath(tenantId) {
  if (tenantId === PLATFORM_TENANT) return topLevel("platformAudit");
  return tenantCollection(tenantId, "audit");
}
function usersCollection() {
  return topLevel("users");
}
function usersDoc(uid) {
  return `${usersCollection()}/${uid}`;
}
function userMembershipsCollection() {
  return topLevel("userMemberships");
}
function userMembershipId(uid, tenantId) {
  return `${uid}_${tenantId}`;
}
function userMembershipDoc(uid, tenantId) {
  return `${userMembershipsCollection()}/${userMembershipId(uid, tenantId)}`;
}
function tenantCodesCollection() {
  return topLevel("tenantCodes");
}
function tenantCodeDoc(code) {
  return `${tenantCodesCollection()}/${code}`;
}
function consumerProfilesCollection() {
  return topLevel("consumerProfiles");
}
function consumerProfileDoc(uid) {
  return `${consumerProfilesCollection()}/${uid}`;
}
function impersonationSessionsCollection() {
  return topLevel("impersonationSessions");
}
function impersonationSessionDoc(sessionId) {
  return `${impersonationSessionsCollection()}/${sessionId}`;
}
function globalEvaluationPresetsCollection() {
  return topLevel("globalEvaluationPresets");
}
function globalEvaluationPresetDoc(id) {
  return `${globalEvaluationPresetsCollection()}/${id}`;
}
function platformActivityLogCollection() {
  return topLevel("platformActivityLog");
}
var DEFAULT_LIMIT = 20;
function nextId(coll) {
  return coll.doc().id;
}
function makeEntityRepo(firestore, collectionName, now) {
  const collFor = (tenantId) => firestore.collection(tenantCollection(tenantId, collectionName));
  return {
    async get(tenantId, id) {
      const snap = await collFor(tenantId).doc(id).get();
      if (!snap.exists) return null;
      return docFromFirestore({ ...snap.data(), id: snap.id });
    },
    async getMany(tenantId, ids) {
      if (ids.length === 0) return [];
      const coll = collFor(tenantId);
      const chunks = chunk([...new Set(ids)]);
      const results = await Promise.all(
        chunks.map((c) => coll.where(FieldPath.documentId(), "in", c).get())
      );
      const byId = /* @__PURE__ */ new Map();
      for (const qs of results) {
        for (const d of qs.docs) {
          byId.set(d.id, docFromFirestore({ ...d.data(), id: d.id }));
        }
      }
      return ids.map((id) => byId.get(id)).filter((d) => Boolean(d));
    },
    async upsert(tenantId, data, ts = now()) {
      const coll = collFor(tenantId);
      const id = data["id"] ?? nextId(coll);
      const ref = coll.doc(id);
      const existing = await ref.get();
      const created = !existing.exists;
      const payload = toFirestore({
        ...data,
        id,
        tenantId,
        updatedAt: ts,
        ...(created ? { createdAt: ts } : {}),
      });
      await ref.set(payload, { merge: true });
      return { id, created };
    },
    async list(tenantId, opts = {}) {
      const orderBy = opts.orderBy ?? "__name__";
      let q = collFor(tenantId);
      if (opts.where) {
        for (const [field, value] of Object.entries(opts.where)) {
          q = q.where(field, "==", value);
        }
      }
      q =
        orderBy === "__name__"
          ? q.orderBy(FieldPath.documentId())
          : q.orderBy(orderBy).orderBy(FieldPath.documentId());
      const limit = opts.limit ?? DEFAULT_LIMIT;
      if (opts.cursor) {
        const cur = decodePageCursor(opts.cursor);
        q = orderBy === "__name__" ? q.startAfter(cur.id) : q.startAfter(cur.v, cur.id);
      }
      const snap = await q.limit(limit + 1).get();
      let docs = snap.docs.map((d) => docFromFirestore({ ...d.data(), id: d.id }));
      if (opts.filter) docs = docs.filter(opts.filter);
      const hasMore = snap.docs.length > limit;
      const page = docs.slice(0, limit);
      const last = page.length > 0 ? snap.docs[page.length - 1] : void 0;
      const nextCursor =
        hasMore && last
          ? encodePageCursor({
              v: orderBy === "__name__" ? last.id : last.get(orderBy),
              id: last.id,
            })
          : null;
      return { items: page, nextCursor };
    },
    async delete(tenantId, id) {
      await collFor(tenantId).doc(id).delete();
    },
  };
}
var DEFAULT_LIMIT2 = 20;
function parentIds(data) {
  const spaceId = data["spaceId"];
  const storyPointId = data["storyPointId"];
  if (!spaceId || !storyPointId) {
    throw new Error("item doc requires spaceId + storyPointId to resolve its nested path (D1)");
  }
  return { spaceId, storyPointId };
}
function makeItemRepo(firestore, now) {
  const cg = () => firestore.collectionGroup(ITEMS_COLLECTION_GROUP);
  const byIdInTenant = (tenantId) => cg().where("tenantId", "==", tenantId);
  return {
    async get(tenantId, id) {
      const snap = await byIdInTenant(tenantId).where("id", "==", id).limit(1).get();
      const doc = snap.docs[0];
      if (!doc) return null;
      return docFromFirestore({ ...doc.data(), id: doc.id });
    },
    async getMany(tenantId, ids) {
      if (ids.length === 0) return [];
      const chunks = chunk([...new Set(ids)]);
      const results = await Promise.all(
        chunks.map((c) => byIdInTenant(tenantId).where("id", "in", c).get())
      );
      const byId = /* @__PURE__ */ new Map();
      for (const qs of results) {
        for (const d of qs.docs) {
          byId.set(d.id, docFromFirestore({ ...d.data(), id: d.id }));
        }
      }
      return ids.map((id) => byId.get(id)).filter((d) => Boolean(d));
    },
    async upsert(tenantId, data, ts = now()) {
      const { spaceId, storyPointId } = parentIds(data);
      const id = data["id"] ?? firestore.collection("_ids").doc().id;
      const ref = firestore.doc(itemDoc(tenantId, spaceId, storyPointId, id));
      const existing = await ref.get();
      const created = !existing.exists;
      await ref.set(
        toFirestore({
          ...data,
          id,
          tenantId,
          spaceId,
          storyPointId,
          updatedAt: ts,
          ...(created ? { createdAt: ts } : {}),
        }),
        { merge: true }
      );
      return { id, created };
    },
    async list(tenantId, opts = {}) {
      let q = byIdInTenant(tenantId);
      if (opts.where) {
        for (const [field, value] of Object.entries(opts.where)) {
          q = q.where(field, "==", value);
        }
      }
      const snap = await q.get();
      let docs = snap.docs
        .map((d) => docFromFirestore({ ...d.data(), id: d.id }))
        .sort((a, b) => String(a["id"]).localeCompare(String(b["id"])));
      if (opts.filter) docs = docs.filter(opts.filter);
      if (opts.cursor) {
        const cur = decodePageCursor(opts.cursor);
        const afterId = String(cur.id);
        docs = docs.filter((d) => String(d["id"]) > afterId);
      }
      const limit = opts.limit ?? DEFAULT_LIMIT2;
      const hasMore = docs.length > limit;
      const page = docs.slice(0, limit);
      const last = page[page.length - 1];
      const nextCursor =
        hasMore && last
          ? encodePageCursor({ v: String(last["id"]), id: String(last["id"]) })
          : null;
      return { items: page, nextCursor };
    },
    async delete(tenantId, id) {
      const snap = await byIdInTenant(tenantId).where("id", "==", id).limit(1).get();
      const doc = snap.docs[0];
      if (doc) await doc.ref.delete();
    },
  };
}
function emptyDoc(id, tenantId, userId, spaceId, now) {
  return {
    id,
    userId,
    spaceId,
    tenantId,
    items: {},
    storyPoints: {},
    pointsEarned: 0,
    totalPoints: 0,
    completed: false,
    updatedAt: now,
    createdAt: now,
  };
}
function makeProgressRepo(firestore, nowFn) {
  return {
    async update(tenantId, input, now = nowFn()) {
      const aggRef = firestore.doc(spaceProgressDoc(tenantId, input.userId, input.spaceId));
      const liveRef = firestore.doc(spaceProgressLiveDoc(tenantId, input.userId, input.spaceId));
      const result = await firestore.runTransaction(async (tx) => {
        const snap = await tx.get(aggRef);
        const doc = snap.exists
          ? docFromFirestore({ ...snap.data() })
          : emptyDoc(
              spaceProgressId(input.userId, input.spaceId),
              tenantId,
              input.userId,
              input.spaceId,
              now
            );
        doc.items ??= {};
        doc.storyPoints ??= {};
        for (const u of input.items) {
          const prior = doc.items[u.itemId];
          const keepPrior = prior && prior.score >= u.score;
          if (!keepPrior) {
            doc.items[u.itemId] = {
              itemId: u.itemId,
              storyPointId: u.storyPointId,
              score: u.score,
              maxScore: u.maxScore,
              correct: u.correct,
              timeSpentMs: u.timeSpentMs,
              updatedAt: now,
              evaluation: u.evaluation,
            };
          }
        }
        const spAgg = /* @__PURE__ */ new Map();
        for (const e of Object.values(doc.items)) {
          const cur = spAgg.get(e.storyPointId) ?? { earned: 0, total: 0 };
          cur.earned += e.score;
          cur.total += e.maxScore;
          spAgg.set(e.storyPointId, cur);
        }
        doc.storyPoints = {};
        for (const [spId, agg] of spAgg.entries()) {
          doc.storyPoints[spId] = {
            storyPointId: spId,
            pointsEarned: agg.earned,
            totalPoints: agg.total,
            completed: agg.total > 0 && agg.earned >= agg.total,
          };
        }
        doc.pointsEarned = Object.values(doc.storyPoints).reduce((s, sp) => s + sp.pointsEarned, 0);
        doc.totalPoints = Object.values(doc.storyPoints).reduce((s, sp) => s + sp.totalPoints, 0);
        if (input.totalStoryPoints != null) doc.totalStoryPoints = input.totalStoryPoints;
        const knownStoryPoints = Object.values(doc.storyPoints);
        const expected = doc.totalStoryPoints ?? knownStoryPoints.length;
        doc.completed =
          expected > 0 &&
          knownStoryPoints.length >= expected &&
          knownStoryPoints.every((sp) => sp.completed);
        doc.updatedAt = now;
        doc.recomputeMarker = now;
        tx.set(aggRef, toFirestore(doc), { merge: true });
        tx.set(
          liveRef,
          toFirestore({
            userId: input.userId,
            spaceId: input.spaceId,
            pointsEarned: doc.pointsEarned,
            totalPoints: doc.totalPoints,
            completed: doc.completed,
            storyPoints: Object.fromEntries(
              Object.entries(doc.storyPoints).map(([k, sp]) => [
                k,
                {
                  pointsEarned: sp.pointsEarned,
                  totalPoints: sp.totalPoints,
                  completed: sp.completed,
                },
              ])
            ),
            updatedAt: now,
          }),
          { merge: true }
        );
        return {
          spaceProgressId: doc.id,
          completed: doc.completed,
          pointsEarned: doc.pointsEarned,
          totalPoints: doc.totalPoints,
        };
      });
      return result;
    },
    async get(tenantId, userId, spaceId) {
      const snap = await firestore.doc(spaceProgressDoc(tenantId, userId, spaceId)).get();
      if (!snap.exists) return null;
      return docFromFirestore({ ...snap.data(), id: snap.id });
    },
  };
}
var FLAT_COLLECTION = {
  spaces: "spaces",
  storyPoints: "storyPoints",
  // top-level mirror id-keyed; nested writes use service-level paths
  items: "items",
  tenants: "tenants",
  students: "students",
  teachers: "teachers",
  classes: "classes",
  exams: "exams",
  submissions: "submissions",
  testSessions: "testSessions",
  progressDocs: "spaceProgress",
  notifications: "notifications",
  announcements: "announcements",
};
function makeTx(firestore, now) {
  return async function tx(body) {
    const result = await firestore.runTransaction(async (transaction) => {
      const refFor = (coll, tenantId, id) =>
        // The LITERAL platform tenant doc lives top-level at `tenants/{tenantId}`
        // (NOT nested under itself) — mirror `makeTenantRepo.isTenantDoc` so a tx
        // write to the tenant's own lifecycle status (e.g. deactivateTenant) lands
        // where the platform reads it, not at the tenant-scoped `tenants/{t}/tenants/{t}`.
        coll === "tenants" && id === tenantId
          ? firestore.doc(tenantDoc(id))
          : firestore.doc(`${tenantCollection(tenantId, FLAT_COLLECTION[coll])}/${id}`);
      const reads = /* @__PURE__ */ new Map();
      const handle = {
        async get(coll, tenantId, id) {
          const key = `${coll}/${tenantId}/${id}`;
          let p = reads.get(key);
          if (!p) {
            p = transaction
              .get(refFor(coll, tenantId, id))
              .then((snap) =>
                snap.exists ? docFromFirestore({ ...snap.data(), id: snap.id }) : null
              );
            reads.set(key, p);
          }
          return p;
        },
        upsert(coll, tenantId, data) {
          const id =
            data["id"] ??
            firestore.collection(tenantCollection(tenantId, FLAT_COLLECTION[coll])).doc().id;
          const ref = refFor(coll, tenantId, id);
          transaction.set(ref, toFirestore({ ...data, id, tenantId, updatedAt: now() }), {
            merge: true,
          });
          return { id };
        },
        enqueueOutbox(tenantId, entry) {
          const outRef = firestore.collection(outboxPath(tenantId)).doc();
          transaction.set(
            outRef,
            toFirestore({
              ...entry,
              status: "pending",
              attempts: 0,
              createdAt: now(),
              enqueuedAt: now(),
            })
          );
        },
      };
      return body(handle);
    });
    return result;
  };
}
var IDEMPOTENCY_CONFLICT = "IDEMPOTENCY_CONFLICT";
function makeIdempotencyConflict() {
  const err = new Error(IDEMPOTENCY_CONFLICT);
  err.code = IDEMPOTENCY_CONFLICT;
  err.retryable = true;
  return err;
}
function makeClaimsRepo(adminAuth) {
  return {
    async set(uid, claims) {
      await adminAuth.setCustomUserClaims(uid, claims);
    },
    async get(uid) {
      const user = await adminAuth.getUser(uid).catch(() => null);
      return user?.customClaims ?? null;
    },
    async revokeRefreshTokens(uid) {
      await adminAuth.revokeRefreshTokens(uid);
    },
  };
}
function makeAnswerKeyRepo(firestore, now) {
  return {
    async put(tenantId, itemId, key) {
      const spaceId = key["spaceId"];
      const storyPointId = key["storyPointId"];
      if (!spaceId || !storyPointId) {
        throw new Error("answerKeys.put requires spaceId + storyPointId on the key payload");
      }
      await firestore
        .doc(answerKeyDoc(tenantId, spaceId, storyPointId, itemId))
        .set(toFirestore({ ...key, itemId, tenantId, updatedAt: now() }), { merge: true });
    },
    async get(tenantId, itemId) {
      const snap = await firestore
        .collectionGroup(ANSWER_KEYS_COLLECTION_GROUP)
        .where("itemId", "==", itemId)
        .get();
      const doc = snap.docs.find((d) => {
        const data = d.data();
        if (data.tenantId && data.tenantId !== tenantId) return false;
        return d.ref.path.startsWith(`${tenantDoc(tenantId)}/`);
      });
      if (!doc) return null;
      return docFromFirestore({ ...doc.data() });
    },
  };
}
function makeIdempotencyRepo(firestore, now, leaseMs) {
  return {
    async begin(tenantId, uid, key) {
      const ref = firestore.doc(idempotencyDoc(tenantId, uid, key));
      return firestore.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const nowMs = Date.parse(now());
        if (snap.exists) {
          const data = snap.data();
          if (data.status === "committed") {
            return { status: "committed", result: data.result };
          }
          const expires = data.leaseExpiresAt ? Date.parse(data.leaseExpiresAt) : 0;
          if (expires > nowMs) {
            throw makeIdempotencyConflict();
          }
        }
        tx.set(
          ref,
          toFirestore({
            status: "in_flight",
            uid,
            key,
            createdAt: now(),
            leaseExpiresAt: new Date(nowMs + leaseMs).toISOString(),
          }),
          { merge: true }
        );
        return { status: "new" };
      });
    },
    async commit(tenantId, uid, key, result) {
      await firestore
        .doc(idempotencyDoc(tenantId, uid, key))
        .set(toFirestore({ status: "committed", result, committedAt: now() }), { merge: true });
    },
    async release(tenantId, uid, key) {
      const ref = firestore.doc(idempotencyDoc(tenantId, uid, key));
      const snap = await ref.get();
      if (snap.exists && snap.data().status !== "committed") {
        await ref.delete().catch(() => void 0);
      }
    },
  };
}
function makeOutboxRepo(firestore, now) {
  return {
    async enqueue(tenantId, entry) {
      const coll = firestore.collection(outboxPath(tenantId));
      await coll.add(
        toFirestore({
          ...entry,
          status: "pending",
          attempts: 0,
          createdAt: now(),
          enqueuedAt: now(),
        })
      );
    },
    async drain(tenantId) {
      const coll = firestore.collection(outboxPath(tenantId));
      const snap = await coll.where("status", "==", "pending").get();
      const rows = snap.docs.map((d) => docFromFirestore({ ...d.data(), id: d.id }));
      await Promise.all(
        snap.docs.map((d) => d.ref.update({ status: "delivered", deliveredAt: now() }))
      );
      return rows;
    },
  };
}
function makeRateLimitRepo(firestore, now) {
  return {
    async hit(subject, tier, windowKey2) {
      const id = `${subject}__${tier}__${windowKey2}`.replace(/\//g, "_");
      const ref = firestore.doc(`_rateLimits/${id}`);
      return firestore.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const prev = snap.exists ? (snap.data()?.["count"] ?? 0) : 0;
        const count = prev + 1;
        tx.set(
          ref,
          { subject, tier, windowKey: windowKey2, count, updatedAt: now() },
          { merge: true }
        );
        return count;
      });
    },
  };
}
function makeAuditRepo(firestore, now) {
  return {
    async write(tenantId, entry) {
      await firestore
        .collection(auditPath(tenantId))
        .add(toFirestore({ ...entry, at: now(), createdAt: now() }));
    },
  };
}
var DEFAULT_LIMIT3 = 20;
var PLATFORM = "__platform__";
function makeTenantRepo(firestore, now) {
  const tenantsColl = () => firestore.collection(tenantsRoot());
  const genericColl = (tenantId) => firestore.collection(`${tenantDoc(tenantId)}/_generic`);
  const isTenantDoc = (tenantId, id) => tenantId === PLATFORM || id === tenantId;
  return {
    async get(tenantId, id) {
      const coll = isTenantDoc(tenantId, id) ? tenantsColl() : genericColl(tenantId);
      const snap = await coll.doc(id).get();
      if (!snap.exists) return null;
      return docFromFirestore({ ...snap.data(), id: snap.id });
    },
    async getMany(tenantId, ids) {
      if (ids.length === 0) return [];
      const chunks = chunk([...new Set(ids)]);
      const results = await Promise.all(
        chunks.map((c) => tenantsColl().where(FieldPath.documentId(), "in", c).get())
      );
      const byId = /* @__PURE__ */ new Map();
      for (const qs of results)
        for (const d of qs.docs) byId.set(d.id, docFromFirestore({ ...d.data(), id: d.id }));
      return ids.map((id) => byId.get(id)).filter((d) => Boolean(d));
    },
    async upsert(tenantId, data, ts = now()) {
      const explicitId = data["id"];
      const tenantDoc2 = explicitId ? isTenantDoc(tenantId, explicitId) : tenantId !== PLATFORM;
      const coll = tenantDoc2 ? tenantsColl() : genericColl(tenantId);
      const id = explicitId ?? coll.doc().id;
      const ref = coll.doc(id);
      const existing = await ref.get();
      const created = !existing.exists;
      await ref.set(
        toFirestore({ ...data, id, updatedAt: ts, ...(created ? { createdAt: ts } : {}) }),
        { merge: true }
      );
      return { id, created };
    },
    async list(tenantId, opts = {}) {
      const coll = tenantId === PLATFORM ? tenantsColl() : genericColl(tenantId);
      let q = coll;
      if (opts.where) for (const [f, v] of Object.entries(opts.where)) q = q.where(f, "==", v);
      q = q.orderBy(FieldPath.documentId());
      const limit = opts.limit ?? DEFAULT_LIMIT3;
      if (opts.cursor) q = q.startAfter(decodePageCursor(opts.cursor).id);
      const snap = await q.limit(limit + 1).get();
      let docs = snap.docs.map((d) => docFromFirestore({ ...d.data(), id: d.id }));
      if (opts.filter) docs = docs.filter(opts.filter);
      const hasMore = snap.docs.length > limit;
      const page = docs.slice(0, limit);
      const last = page.length > 0 ? snap.docs[page.length - 1] : void 0;
      const nextCursor = hasMore && last ? encodePageCursor({ v: last.id, id: last.id }) : null;
      return { items: page, nextCursor };
    },
    async delete(tenantId, id) {
      const coll = isTenantDoc(tenantId, id) ? tenantsColl() : genericColl(tenantId);
      await coll.doc(id).delete();
    },
    // AI-gateway usage-config read (the gateway's quota pre-check, `AiRepos.tenants`).
    async getUsageConfig(tenantId) {
      const snap = await tenantsColl().doc(tenantId).get();
      const data = snap.data();
      return data?.usageConfig ?? null;
    },
    // Public code-index resolution (`tenantCodes/{code}` → tenantId). The index is
    // the only public-readable map from a join code to a tenant; lookupTenantByCode
    // resolves it server-side, then reads the (top-level) tenant doc.
    async resolveCode(code) {
      const snap = await firestore.doc(tenantCodeDoc(code)).get();
      if (!snap.exists) return null;
      return snap.data()?.["tenantId"] ?? null;
    },
  };
}
function makeUserRepo(db2, adminAuth, now) {
  return {
    async get(uidOrEmail) {
      const byId = await db2.doc(usersDoc(uidOrEmail)).get();
      if (byId.exists) return docFromFirestore({ ...byId.data(), id: byId.id });
      const q = await db2
        .collection(usersCollection())
        .where("email", "==", uidOrEmail)
        .limit(1)
        .get();
      const d = q.docs[0];
      return d ? docFromFirestore({ ...d.data(), id: d.id }) : null;
    },
    async updateProfile(uid, patch) {
      await db2
        .doc(usersDoc(uid))
        .set(toFirestore({ ...patch, updatedAt: now() }), { merge: true });
      await adminAuth
        .updateUser(uid, {
          ...(patch.displayName ? { displayName: patch.displayName } : {}),
          ...(patch.photoURL ? { photoURL: patch.photoURL } : {}),
        })
        .catch(() => void 0);
    },
    async create(input) {
      const user = await adminAuth.createUser({
        ...(input.email ? { email: input.email } : {}),
        ...(input.displayName ? { displayName: input.displayName } : {}),
        ...(input.password ? { password: input.password } : {}),
      });
      await db2
        .doc(usersDoc(user.uid))
        .set(
          toFirestore({
            id: user.uid,
            email: input.email,
            displayName: input.displayName,
            createdAt: now(),
          }),
          { merge: true }
        );
      return { uid: user.uid };
    },
  };
}
function makeMembershipRepo(db2, now) {
  const coll = db2.collection(userMembershipsCollection());
  const mid = (uid, tenantId) => `${uid}_${tenantId}`;
  return {
    async get(uid, tenantId) {
      const snap = await coll.doc(mid(uid, tenantId)).get();
      return snap.exists ? docFromFirestore({ ...snap.data(), id: snap.id }) : null;
    },
    async listForUser(uid) {
      const snap = await coll.where("uid", "==", uid).get();
      return snap.docs.map((d) => docFromFirestore({ ...d.data(), id: d.id }));
    },
    async getManagedClassIds(uid, tenantId) {
      if (!tenantId) return [];
      const snap = await coll.doc(mid(uid, tenantId)).get();
      const data = snap.data();
      return data?.permissions?.managedClassIds ?? data?.managedClassIds ?? [];
    },
    async upsert(uid, tenantId, data, ts = now()) {
      const id = mid(uid, tenantId);
      const ref = coll.doc(id);
      const existing = await ref.get();
      await ref.set(
        toFirestore({
          ...data,
          id,
          uid,
          tenantId,
          updatedAt: ts,
          ...(existing.exists ? {} : { createdAt: ts }),
        }),
        { merge: true }
      );
      return { id, created: !existing.exists };
    },
    async setStatus(uid, tenantId, status, ts = now()) {
      await coll
        .doc(mid(uid, tenantId))
        .set(toFirestore({ status, updatedAt: ts }), { merge: true });
    },
  };
}
function makeConsumerProfileRepo(db2, now) {
  const coll = db2.collection(consumerProfilesCollection());
  return {
    async get(uid) {
      const snap = await coll.doc(uid).get();
      return snap.exists ? docFromFirestore({ ...snap.data(), id: snap.id }) : null;
    },
    enroll(tx, uid, spaceId, record) {
      void coll
        .doc(uid)
        .set(
          toFirestore({
            id: uid,
            uid,
            [`enrolled_${spaceId}`]: true,
            [`purchase_${spaceId}`]: { ...record, updatedAt: now() },
          }),
          { merge: true }
        )
        .catch(() => void 0);
    },
    async isEnrolled(uid, spaceId) {
      const snap = await coll.doc(uid).get();
      const data = snap.data();
      if (!data) return false;
      if (data[`enrolled_${spaceId}`] === true) return true;
      const list = data["enrolledSpaceIds"] ?? [];
      return list.includes(spaceId);
    },
  };
}
function makeBadgeRepo(db2, now) {
  const ref = (t, uid) => db2.doc(`${tenantDoc(t)}/notificationBadges/${uid}`);
  return {
    async get(uid, tenantId) {
      const snap = await ref(tenantId, uid).get();
      return snap.exists ? docFromFirestore({ ...snap.data() }) : { unreadCount: 0 };
    },
    async set(uid, tenantId, state) {
      await ref(tenantId, uid).set(toFirestore({ ...state, updatedAt: now() }), { merge: true });
    },
  };
}
function makeNotificationReadRepo(db2, now) {
  const notifs = (t) => db2.collection(`${tenantDoc(t)}/notifications`);
  const prefRef = (t, uid) => db2.doc(`${tenantDoc(t)}/notificationPreferences/${uid}`);
  return {
    async markRead(tenantId, uid, notificationId, ts) {
      if (notificationId) {
        await notifs(tenantId)
          .doc(notificationId)
          .set(toFirestore({ isRead: true, readAt: ts }), { merge: true });
      } else {
        const unread = await notifs(tenantId)
          .where("recipientUid", "==", uid)
          .where("isRead", "==", false)
          .get();
        await Promise.all(
          unread.docs.map((d) =>
            d.ref.set(toFirestore({ isRead: true, readAt: ts }), { merge: true })
          )
        );
      }
      return this.unreadCount(tenantId, uid);
    },
    async getPreferences(tenantId, uid) {
      const snap = await prefRef(tenantId, uid).get();
      return snap.exists ? docFromFirestore({ ...snap.data(), id: snap.id }) : null;
    },
    async savePreferences(tenantId, uid, prefs, ts) {
      await prefRef(tenantId, uid).set(toFirestore({ ...prefs, uid, updatedAt: ts }), {
        merge: true,
      });
      return { ...prefs, uid, updatedAt: ts };
    },
    async unreadCount(tenantId, uid) {
      const snap = await notifs(tenantId)
        .where("recipientUid", "==", uid)
        .where("isRead", "==", false)
        .get();
      return snap.size;
    },
  };
}
function makeChatRepo(db2, now) {
  const sessions = (t) => db2.collection(`${tenantDoc(t)}/chatSessions`);
  const messages = (t, sid) => db2.collection(`${tenantDoc(t)}/chatSessions/${sid}/messages`);
  return {
    async getSession(tenantId, sessionId) {
      const snap = await sessions(tenantId).doc(sessionId).get();
      return snap.exists ? docFromFirestore({ ...snap.data(), id: snap.id }) : null;
    },
    async createSession(tenantId, data) {
      const ref = data["id"]
        ? sessions(tenantId).doc(String(data["id"]))
        : sessions(tenantId).doc();
      await ref.set(toFirestore({ ...data, id: ref.id, createdAt: now(), updatedAt: now() }), {
        merge: true,
      });
      return ref.id;
    },
    async appendMessage(tenantId, sessionId, message) {
      const ref = messages(tenantId, sessionId).doc();
      await ref.set(toFirestore({ ...message, id: ref.id }));
      await sessions(tenantId)
        .doc(sessionId)
        .set(toFirestore({ updatedAt: now(), previewMessage: message["text"] ?? "" }), {
          merge: true,
        })
        .catch(() => void 0);
      return ref.id;
    },
  };
}
function makeAnnouncementReadRepo(db2, now) {
  const ref = (t, id, uid) => db2.doc(`${tenantDoc(t)}/announcements/${id}/reads/${uid}`);
  return {
    async markRead(tenantId, announcementId, uid, ts) {
      await ref(tenantId, announcementId, uid).set(toFirestore({ uid, readAt: ts }), {
        merge: true,
      });
    },
    async isReadBy(tenantId, announcementId, uid) {
      const snap = await ref(tenantId, announcementId, uid).get();
      return snap.exists;
    },
  };
}
function makeDeviceRepo(db2, now) {
  const coll = (t, uid) => db2.collection(`${tenantDoc(t)}/users/${uid}/devices`);
  return {
    async register(uid, tenantId, token, platform, appKey, ts) {
      await coll(tenantId, uid)
        .doc(token)
        .set(toFirestore({ token, platform, appKey, updatedAt: ts }), { merge: true });
    },
    async unregister(uid, tenantId, token) {
      await coll(tenantId, uid).doc(token).delete();
    },
    async tokensForUser(uid, tenantId) {
      const snap = await coll(tenantId, uid).get();
      return snap.docs.map((d) => d.id);
    },
  };
}
function makeTestSubmissionRepo(db2, now) {
  const coll = (t, sid) => db2.collection(`${tenantDoc(t)}/digitalTestSessions/${sid}/submissions`);
  return {
    async list(tenantId, sessionId) {
      const snap = await coll(tenantId, sessionId).get();
      return snap.docs.map((d) => docFromFirestore({ ...d.data(), id: d.id }));
    },
    put(tx, tenantId, sessionId, submission) {
      const itemId = String(submission["itemId"] ?? submission["id"] ?? "");
      coll(tenantId, sessionId)
        .doc(itemId)
        .set(toFirestore({ ...submission, itemId, updatedAt: now() }), { merge: true })
        .catch(() => void 0);
    },
    async get(tenantId, sessionId, itemId) {
      const snap = await coll(tenantId, sessionId).doc(itemId).get();
      return snap.exists ? docFromFirestore({ ...snap.data(), id: snap.id }) : null;
    },
  };
}
function makeStoryPointProgressRepo(db2) {
  return {
    async get(tenantId, uid, _spaceId, storyPointId) {
      const snap = await db2
        .doc(`${tenantDoc(tenantId)}/storyPointProgress/${uid}_${storyPointId}`)
        .get();
      return snap.exists ? docFromFirestore({ ...snap.data(), id: snap.id }) : null;
    },
  };
}
function makeGamificationRepo(db2, now) {
  const studentDoc = (t, uid) => db2.doc(`${tenantDoc(t)}/students/${uid}`);
  return {
    async getSummary(tenantId, uid) {
      const snap = await studentDoc(tenantId, uid).collection("gamification").doc("summary").get();
      return snap.exists ? docFromFirestore({ ...snap.data() }) : {};
    },
    async getStudentLevel(tenantId, uid) {
      const snap = await studentDoc(tenantId, uid).collection("level").doc("current").get();
      return snap.exists ? docFromFirestore({ ...snap.data() }) : { level: 1, xp: 0 };
    },
    async earnedAchievementIds(tenantId, uid) {
      const snap = await studentDoc(tenantId, uid).collection("achievements").get();
      return new Set(snap.docs.map((d) => d.id));
    },
    awardAchievement(tx, tenantId, uid, achievement) {
      const id = String(achievement["id"] ?? achievement["achievementId"] ?? "");
      studentDoc(tenantId, uid)
        .collection("achievements")
        .doc(id)
        .set(toFirestore({ ...achievement, id, seen: false, earnedAt: now() }), { merge: true })
        .catch(() => void 0);
    },
    async markSeen(tenantId, uid, ids, ts) {
      const coll = studentDoc(tenantId, uid).collection("achievements");
      const docs =
        ids === "all"
          ? (await coll.where("seen", "==", false).get()).docs
          : ids.map((id) => coll.doc(id));
      let updated = 0;
      for (const ref of docs) {
        const r = "ref" in ref ? ref.ref : ref;
        await r.set(toFirestore({ seen: true, seenAt: ts }), { merge: true });
        updated++;
      }
      return updated;
    },
    applyLevelDelta(tx, tenantId, uid, xpDelta, ts) {
      studentDoc(tenantId, uid)
        .collection("level")
        .doc("current")
        .set(toFirestore({ xpDelta, updatedAt: ts }), { merge: true })
        .catch(() => void 0);
    },
    async saveDefinition(tenantId, input, ts) {
      const coll = db2.collection(`${tenantDoc(tenantId)}/achievements`);
      const id = input.id ?? coll.doc().id;
      const ref = coll.doc(id);
      const existing = await ref.get();
      await ref.set(toFirestore({ ...input.data, id, updatedAt: ts }), { merge: true });
      return { id, created: !existing.exists };
    },
    async listSessions(tenantId, uid, _range) {
      const snap = await studentDoc(tenantId, uid).collection("studySessions").get();
      const sessions = snap.docs.map((d) => docFromFirestore({ ...d.data(), id: d.id }));
      return { sessions, streakDays: 0, longestStreak: 0 };
    },
  };
}
function makeLeaderboardRepo(db2, now) {
  const coll = (t) => db2.collection(`${tenantDoc(t)}/leaderboard`);
  return {
    async getPage(tenantId, scope, params, opts) {
      let q = coll(tenantId).where("scope", "==", scope);
      if (params.spaceId) q = q.where("spaceId", "==", params.spaceId);
      if (params.storyPointId) q = q.where("storyPointId", "==", params.storyPointId);
      const snap = await q.limit((opts.limit ?? 20) + 1).get();
      const items = snap.docs
        .slice(0, opts.limit ?? 20)
        .map((d) => docFromFirestore({ ...d.data(), id: d.id }));
      return { items, nextCursor: null };
    },
    async callerEntry(tenantId, uid, scope, _params) {
      const snap = await coll(tenantId)
        .where("scope", "==", scope)
        .where("uid", "==", uid)
        .limit(1)
        .get();
      const d = snap.docs[0];
      return d ? docFromFirestore({ ...d.data(), id: d.id }) : null;
    },
    async upsertEntry(tenantId, scope, entry) {
      const id = String(entry["uid"] ?? coll(tenantId).doc().id);
      await coll(tenantId)
        .doc(`${scope}_${id}`)
        .set(toFirestore({ ...entry, scope, updatedAt: now() }), { merge: true });
    },
  };
}
function makeInsightRepo(db2, now) {
  const coll = (t) => db2.collection(`${tenantDoc(t)}/insights`);
  return {
    async list(tenantId, filter) {
      let q = coll(tenantId);
      if (filter.studentId) q = q.where("studentId", "==", filter.studentId);
      if (filter.type) q = q.where("type", "==", filter.type);
      const snap = await q.limit((filter.limit ?? 20) + 1).get();
      const items = snap.docs
        .slice(0, filter.limit ?? 20)
        .map((d) => docFromFirestore({ ...d.data(), id: d.id }));
      return { items, nextCursor: null };
    },
    async dismiss(tenantId, _uid, insightId, ts) {
      await coll(tenantId)
        .doc(insightId)
        .set(toFirestore({ dismissed: true, dismissedAt: ts }), { merge: true });
    },
  };
}
function makeStudyGoalRepo(db2, now) {
  const coll = (t, uid) => db2.collection(`${tenantDoc(t)}/students/${uid}/studyGoals`);
  return {
    async list(tenantId, uid, opts) {
      let q = coll(tenantId, uid);
      if (!opts.includeCompleted) q = q.where("completed", "==", false);
      const snap = await q.limit((opts.limit ?? 20) + 1).get();
      const items = snap.docs
        .slice(0, opts.limit ?? 20)
        .map((d) => docFromFirestore({ ...d.data(), id: d.id }));
      return { items, nextCursor: null };
    },
    async save(tenantId, uid, input, ts) {
      const id = input.id ?? coll(tenantId, uid).doc().id;
      const ref = coll(tenantId, uid).doc(id);
      const existing = await ref.get();
      await ref.set(
        toFirestore({
          ...input.data,
          id,
          completed: input.data["completed"] ?? false,
          updatedAt: ts,
        }),
        { merge: true }
      );
      return { id, created: !existing.exists };
    },
  };
}
function makeSecretRepo(db2, now) {
  return {
    async put(tenantId, _key) {
      const secretRef = `${tenantId}-gemini-key`;
      await db2
        .doc(`${tenantDoc(tenantId)}/secretRefs/gemini`)
        .set(toFirestore({ secretRef, updatedAt: now() }), { merge: true });
      return { secretRef };
    },
  };
}
function makeImpersonationRepo(db2, now) {
  return {
    openSession(tx, record) {
      const sessionId = db2.collection(impersonationSessionsCollection()).doc().id;
      db2
        .doc(impersonationSessionDoc(sessionId))
        .set(toFirestore({ ...record, id: sessionId, status: "open", startedAt: now() }), {
          merge: true,
        })
        .catch(() => void 0);
      return { sessionId };
    },
    endSession(tx, sessionId, ts) {
      db2
        .doc(impersonationSessionDoc(sessionId))
        .set(toFirestore({ status: "ended", endedAt: ts }), { merge: true })
        .catch(() => void 0);
    },
  };
}
var DEFAULT_LEASE_MS = 5 * 60 * 1e3;
function createRepos(options = {}) {
  const firestore = db();
  const adminAuth = auth();
  const now = options.now ?? (() => /* @__PURE__ */ new Date().toISOString());
  const leaseMs = options.idempotencyLeaseMs ?? DEFAULT_LEASE_MS;
  const entity = (name) => makeEntityRepo(firestore, name, now);
  const auditRepo = makeAuditRepo(firestore, now);
  const extended = {
    tenants: makeTenantRepo(firestore, now),
    // top-level `tenants/{id}` (NOT nested)
    users: makeUserRepo(firestore, adminAuth, now),
    memberships: makeMembershipRepo(firestore, now),
    consumerProfiles: makeConsumerProfileRepo(firestore, now),
    badges: makeBadgeRepo(firestore, now),
    notificationReads: makeNotificationReadRepo(firestore),
    announcementReads: makeAnnouncementReadRepo(firestore),
    devices: makeDeviceRepo(firestore),
    testSubmissions: makeTestSubmissionRepo(firestore, now),
    storyPointProgress: makeStoryPointProgressRepo(firestore),
    gamification: makeGamificationRepo(firestore, now),
    leaderboard: makeLeaderboardRepo(firestore, now),
    insights: makeInsightRepo(firestore),
    studyGoals: makeStudyGoalRepo(firestore),
    secrets: makeSecretRepo(firestore, now),
    impersonation: makeImpersonationRepo(firestore, now),
    chat: makeChatRepo(firestore, now),
    // generic-collection aliases the services reference by friendly name.
    parents: entity("parents"),
    staff: entity("staff"),
    academicSessions: entity("academicSessions"),
    presets: entity("globalEvaluationPresets"),
    // analytics materialized-projection collections (dedicated, tenant-scoped).
    studentSummaries: entity("studentProgressSummaries"),
    classSummaries: entity("classProgressSummaries"),
    examAnalytics: entity("examAnalytics"),
    analyticsInsights: entity("insights"),
    // autograde evaluation-settings (its own collection, NOT the tenants repo).
    evaluationSettings: entity("evaluationSettings"),
    // AI-gateway cost/usage seam (`@levelup/ai` `AiRepos`: llm + costSummaries).
    llm: {
      async log(params) {
        const ref = firestore
          .collection(`${tenantDoc(String(params["tenantId"]))}/llmCallLogs`)
          .doc();
        const rec = { ...params, id: ref.id, createdAt: now() };
        await ref.set(rec);
        return rec;
      },
      async sumCostUsd(tenantId, fromIso, toIso) {
        const snap = await firestore
          .collection(`${tenantDoc(tenantId)}/llmCallLogs`)
          .where("createdAt", ">=", fromIso)
          .where("createdAt", "<", toIso)
          .get();
        return snap.docs.reduce((s, d) => s + (d.data()["costUSD"] ?? 0), 0);
      },
      async countCalls(tenantId, fromIso, toIso) {
        const snap = await firestore
          .collection(`${tenantDoc(tenantId)}/llmCallLogs`)
          .where("createdAt", ">=", fromIso)
          .where("createdAt", "<", toIso)
          .get();
        return snap.size;
      },
    },
    costSummaries: {
      async daily(tenantId, dateYmd) {
        const snap = await firestore
          .doc(`${tenantDoc(tenantId)}/costSummaries/daily_${dateYmd}`)
          .get();
        return snap.exists ? snap.data() : null;
      },
      async monthly(tenantId, monthYm) {
        const snap = await firestore
          .doc(`${tenantDoc(tenantId)}/costSummaries/monthly_${monthYm}`)
          .get();
        return snap.exists ? snap.data() : null;
      },
    },
    // audit + in-tx variant (fail-closed impersonation audit).
    audit: Object.assign(auditRepo, {
      writeInTx(_tx, actorUid, action, target, meta) {
        void auditRepo.write("__platform__", { actorUid, action, target, ...(meta ?? {}) });
      },
    }),
  };
  return {
    spaces: entity("spaces"),
    storyPoints: entity("storyPoints"),
    items: makeItemRepo(firestore, now),
    students: entity("students"),
    teachers: entity("teachers"),
    classes: entity("classes"),
    exams: entity("exams"),
    submissions: entity("submissions"),
    testSessions: entity("digitalTestSessions"),
    progressDocs: entity("spaceProgress"),
    notifications: entity("notifications"),
    announcements: entity("announcements"),
    claims: makeClaimsRepo(adminAuth),
    answerKeys: makeAnswerKeyRepo(firestore, now),
    idempotency: makeIdempotencyRepo(firestore, now, leaseMs),
    outbox: makeOutboxRepo(firestore, now),
    rateLimits: makeRateLimitRepo(firestore, now),
    progress: makeProgressRepo(firestore, now),
    tx: makeTx(firestore, now),
    encodeCursor,
    decodeCursor,
    ...extended,
  };
}

// ../../packages/ai/dist/index.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
var def = (t) => t;
var PROMPTS = {
  /** Panopticon stage 1 — extract questions + rubric from a question paper. */
  questionExtraction: def({
    purpose: "question_extraction",
    system:
      "You are an exam-paper extraction engine. Read the provided question-paper images and emit a structured list of questions with marks and a per-question rubric. Never invent questions; preserve numbering and sub-parts.",
    user: "Exam title: {{examTitle}}\nExam type: {{examType}}\nExtract every question. For each: text, maxMarks, order, and a criteria-based rubric whose criteria marks sum to maxMarks.",
    requiredVariables: ["examTitle", "examType"],
    structured: true,
    defaultModel: "gemini-1.5-pro",
    defaultTemperature: 0,
  }),
  /** Panopticon stage 2 — map a scanned answer sheet to question regions. */
  answerMapping: def({
    purpose: "answer_mapping",
    system:
      "You are an answer-sheet scout. Given answer-sheet images and the known question list, locate each answer and report which question it belongs to, with a readability/confidence assessment.",
    user: "Questions: {{questions}}\nMap each detected answer region to a questionId. Flag unreadable or missing answers.",
    requiredVariables: ["questions"],
    structured: true,
    defaultModel: "gemini-1.5-flash",
    defaultTemperature: 0,
  }),
  /** RELMS — grade a single answer against its resolved rubric. */
  answerGrading: def({
    purpose: "answer_grading",
    system:
      "You are a rigorous, fair grader. Score the student answer ONLY against the provided rubric. Output score, per-criterion breakdown, strengths, weaknesses, missing concepts, and a confidence value in [0,1]. Never exceed maxMarks. Be consistent and explain each deduction.",
    user: "Question: {{question}}\nMax marks: {{maxMarks}}\nRubric: {{rubric}}\nStudent answer: {{answer}}\nGrade strictly per the rubric.",
    requiredVariables: ["question", "maxMarks", "rubric", "answer"],
    structured: true,
    defaultModel: "gemini-1.5-pro",
    defaultTemperature: 0,
  }),
  /** Tutor chat — conversational help inside a story-point item. */
  aiChat: def({
    purpose: "ai_chat",
    system:
      "You are a patient learning tutor scoped to one practice item. Help the learner reason toward the answer with hints and questions. NEVER reveal the model answer, the rubric, or the grading guidance verbatim. Keep replies concise and encouraging.",
    user: "Item context: {{itemContext}}\nConversation so far: {{history}}\nLearner says: {{message}}\nRespond as the tutor in {{language}}.",
    requiredVariables: ["itemContext", "message", "language"],
    structured: false,
    defaultModel: "gemini-1.5-flash",
    defaultTemperature: 0.6,
  }),
  /** Learning-insight generation from a student's progress summary. */
  insights: def({
    purpose: "insights",
    system:
      "You generate short, actionable learning insights for a single student from their performance summary. Be specific and supportive; cite the weak areas.",
    user: "Student summary: {{summary}}\nProduce up to {{maxInsights}} insights with a title, body, and severity.",
    requiredVariables: ["summary", "maxInsights"],
    structured: true,
    defaultModel: "gemini-1.5-flash",
    defaultTemperature: 0.3,
  }),
};
var PROMPT_KEYS = Object.keys(PROMPTS);
function renderPrompt(key, variables) {
  const template = PROMPTS[key];
  for (const req of template.requiredVariables) {
    if (variables[req] === void 0 || variables[req] === null) {
      throw new Error(`Prompt "${key}" missing required variable "${req}"`);
    }
  }
  const user = template.user.replace(/\{\{(\w+)\}\}/g, (_m, name) => {
    const v = variables[name];
    if (v === void 0) return "";
    return typeof v === "string" ? v : JSON.stringify(v);
  });
  return { system: template.system, user, template };
}
var DEFAULT_MODEL = "gemini-1.5-flash";
function toParts(input) {
  const parts = [{ text: input.user }];
  for (const img of input.images ?? []) {
    parts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } });
  }
  return parts;
}
function toUsage(meta) {
  const inputTokens = meta?.promptTokenCount ?? 0;
  const outputTokens = meta?.candidatesTokenCount ?? 0;
  const totalTokens = meta?.totalTokenCount ?? inputTokens + outputTokens;
  return { inputTokens, outputTokens, totalTokens };
}
function createGeminiProvider(apiKey, opts = {}) {
  const client = new GoogleGenerativeAI(apiKey);
  const fallbackModel = opts.defaultModel ?? DEFAULT_MODEL;
  return {
    name: "gemini",
    async call(input) {
      const modelName = input.model || fallbackModel;
      const model = client.getGenerativeModel({
        model: modelName,
        systemInstruction: input.system,
      });
      const request = {
        contents: [{ role: "user", parts: toParts(input) }],
        generationConfig: {
          ...(input.temperature !== void 0 ? { temperature: input.temperature } : {}),
          ...(input.maxTokens !== void 0 ? { maxOutputTokens: input.maxTokens } : {}),
          ...(input.responseSchema
            ? {
                responseMimeType: "application/json",
                responseSchema: input.responseSchema,
              }
            : {}),
        },
      };
      const result = await model.generateContent(request);
      const response = result.response;
      const text = response.text();
      let json;
      if (input.responseSchema) {
        try {
          json = JSON.parse(text);
        } catch {
          json = void 0;
        }
      }
      return {
        text,
        json,
        usage: toUsage(response.usageMetadata),
        model: modelName,
      };
    },
  };
}
var AiGatewayError = class _AiGatewayError extends Error {
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "AiGatewayError";
    this.code = code;
    this.retryable = opts.retryable ?? false;
    this.meta = opts.meta;
    if (opts.cause !== void 0) {
      this.cause = opts.cause;
    }
    Object.setPrototypeOf(this, _AiGatewayError.prototype);
  }
};
function isAiGatewayError(x) {
  return x instanceof AiGatewayError;
}
var quotaExceeded = (message, meta) =>
  new AiGatewayError("QUOTA_EXCEEDED", message, { retryable: false, meta });
var aiDisabled = (message, meta) =>
  new AiGatewayError("FEATURE_DISABLED", message, { retryable: false, meta });
var providerFailed = (message, opts = {}) => new AiGatewayError("INTERNAL_ERROR", message, opts);
var secretNameFor = (tenantId) => `tenant-${tenantId}-gemini`;
function resolveProjectId(opts) {
  return (
    opts.projectId ??
    opts.env?.GOOGLE_CLOUD_PROJECT ??
    opts.env?.GCLOUD_PROJECT ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.GCLOUD_PROJECT
  );
}
function createSecretResolver(opts = {}) {
  const env = opts.env ?? process.env;
  const cache = /* @__PURE__ */ new Map();
  let client = opts.client ?? null;
  const getClient = () => {
    if (!client) client = new SecretManagerServiceClient();
    return client;
  };
  return {
    async getApiKey(tenantId) {
      const cached = cache.get(tenantId);
      if (cached) return cached;
      const override = env.LEVELUP_AI_KEY ?? env.GEMINI_API_KEY;
      if (override) {
        cache.set(tenantId, override);
        return override;
      }
      const projectId2 = resolveProjectId(opts);
      if (!projectId2) {
        throw aiDisabled("No GCP project configured for Secret Manager key resolution", {
          tenantId,
        });
      }
      const name = `projects/${projectId2}/secrets/${secretNameFor(tenantId)}/versions/latest`;
      let payload;
      try {
        const [version] = await getClient().accessSecretVersion({ name });
        const data = version.payload?.data;
        payload =
          typeof data === "string" ? data : data ? Buffer.from(data).toString("utf8") : void 0;
      } catch (cause) {
        throw aiDisabled("No Gemini key provisioned for tenant", {
          tenantId,
          cause: String(cause),
        });
      }
      const key = payload?.trim();
      if (!key) {
        throw providerFailed("Empty Gemini secret payload", { meta: { tenantId } });
      }
      cache.set(tenantId, key);
      return key;
    },
    invalidate(tenantId) {
      cache.delete(tenantId);
    },
  };
}
var DEFAULT_MONTHLY_BUDGET_USD = 100;
var DEFAULT_DAILY_CALL_CAP = 5e3;
function dayBounds(nowIso) {
  const d = new Date(nowIso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const dateYmd = `${y}-${m}-${day}`;
  const dayStart = `${dateYmd}T00:00:00.000Z`;
  const nextDay = new Date(Date.UTC(y, d.getUTCMonth(), d.getUTCDate() + 1));
  return { dateYmd, dayStart, dayEnd: nextDay.toISOString() };
}
function monthBounds(nowIso) {
  const d = new Date(nowIso);
  const y = d.getUTCFullYear();
  const mIdx = d.getUTCMonth();
  const monthYm = `${y}-${String(mIdx + 1).padStart(2, "0")}`;
  const monthStart = `${monthYm}-01T00:00:00.000Z`;
  const monthEnd = new Date(Date.UTC(y, mIdx + 1, 1)).toISOString();
  return { monthYm, monthStart, monthEnd };
}
async function checkUsageQuota(repos, tenantId, nowIso) {
  const cfg = await repos.tenants.getUsageConfig(tenantId);
  if (cfg?.aiEnabled === false) {
    throw aiDisabled("AI is disabled for this tenant", { tenantId });
  }
  const monthlyBudgetUsd =
    cfg?.monthlyBudgetUsd && cfg.monthlyBudgetUsd > 0
      ? cfg.monthlyBudgetUsd
      : DEFAULT_MONTHLY_BUDGET_USD;
  const dailyCallCap =
    cfg?.dailyCallCap && cfg.dailyCallCap > 0 ? cfg.dailyCallCap : DEFAULT_DAILY_CALL_CAP;
  const { monthYm, monthStart, monthEnd } = monthBounds(nowIso);
  const monthlySummary = await repos.costSummaries.monthly(tenantId, monthYm);
  const monthlySpendUsd =
    monthlySummary?.totalCostUsd ?? (await repos.llm.sumCostUsd(tenantId, monthStart, monthEnd));
  if (monthlySpendUsd >= monthlyBudgetUsd) {
    throw quotaExceeded("Monthly AI budget exceeded", {
      tenantId,
      monthlyBudgetUsd,
      monthlySpendUsd,
    });
  }
  const { dateYmd, dayStart, dayEnd } = dayBounds(nowIso);
  const dailySummary = await repos.costSummaries.daily(tenantId, dateYmd);
  const dailyCalls =
    dailySummary?.totalCalls ?? (await repos.llm.countCalls(tenantId, dayStart, dayEnd));
  if (dailyCalls >= dailyCallCap) {
    throw quotaExceeded("Daily AI call cap exceeded", { tenantId, dailyCallCap, dailyCalls });
  }
  return { allowed: true, monthlyBudgetUsd, monthlySpendUsd, dailyCallCap, dailyCalls };
}
var MODEL_PRICING = {
  "gemini-1.5-pro": { inputPerMillion: 1.25, outputPerMillion: 5 },
  "gemini-1.5-flash": { inputPerMillion: 0.075, outputPerMillion: 0.3 },
  "gemini-1.5-flash-8b": { inputPerMillion: 0.0375, outputPerMillion: 0.15 },
  "gemini-2.0-flash": { inputPerMillion: 0.1, outputPerMillion: 0.4 },
};
var FALLBACK_PRICING = { inputPerMillion: 1.25, outputPerMillion: 5 };
function buildTokenUsage(usage) {
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens || usage.inputTokens + usage.outputTokens,
  };
}
function estimateCost(usage, model) {
  const pricing = MODEL_PRICING[model] ?? FALLBACK_PRICING;
  const inputCostUsd = (usage.inputTokens / 1e6) * pricing.inputPerMillion;
  const outputCostUsd = (usage.outputTokens / 1e6) * pricing.outputPerMillion;
  return {
    inputCostUsd,
    outputCostUsd,
    totalCostUsd: inputCostUsd + outputCostUsd,
    model,
  };
}
async function logLLMCall(repos, params) {
  const record = {
    tenantId: params.tenantId,
    functionName: params.functionName,
    model: params.model,
    inputTokens: params.usage.inputTokens,
    outputTokens: params.usage.outputTokens,
    totalTokens: params.usage.totalTokens,
    costUSD: params.cost.totalCostUsd,
    latencyMs: params.latencyMs,
    status: params.status,
    ...(params.errorMessage !== void 0 ? { errorMessage: params.errorMessage } : {}),
    ...(params.userId !== void 0 ? { userId: params.userId } : {}),
    ...(params.examId !== void 0 ? { examId: params.examId } : {}),
    ...(params.spaceId !== void 0 ? { spaceId: params.spaceId } : {}),
  };
  await repos.llm.log(record);
}
function classifyError(err) {
  const status = err?.status;
  const code = err?.code;
  const n =
    typeof status === "number" ? status : typeof code === "number" ? code : Number(err?.statusCode);
  if (n === 429 || n === 503 || n === 500 || n === 502 || n === 504) return "transient";
  const msg = String(err?.message ?? "").toLowerCase();
  if (
    msg.includes("timeout") ||
    msg.includes("etimedout") ||
    msg.includes("econnreset") ||
    msg.includes("overloaded") ||
    msg.includes("unavailable") ||
    msg.includes("rate limit")
  ) {
    return "transient";
  }
  return "permanent";
}
function createCircuitBreaker(opts = {}) {
  const failureThreshold = opts.failureThreshold ?? 5;
  const cooldownMs = opts.cooldownMs ?? 3e4;
  const now = opts.now ?? (() => Date.now());
  const circuits = /* @__PURE__ */ new Map();
  const entry = (key) => {
    let e = circuits.get(key);
    if (!e) {
      e = { state: "closed", failures: 0, openedAt: 0 };
      circuits.set(key, e);
    }
    return e;
  };
  return {
    isCircuitOpen(key) {
      const e = entry(key);
      if (e.state === "open" && now() - e.openedAt >= cooldownMs) {
        e.state = "half_open";
        return false;
      }
      return e.state === "open";
    },
    recordSuccess(key) {
      const e = entry(key);
      e.failures = 0;
      e.state = "closed";
      e.openedAt = 0;
    },
    recordFailure(key) {
      const e = entry(key);
      e.failures += 1;
      if (e.state === "half_open" || e.failures >= failureThreshold) {
        e.state = "open";
        e.openedAt = now();
      }
    },
    stateOf(key) {
      return entry(key).state;
    },
  };
}
var defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function withRetry(fn, opts) {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 250;
  const maxDelayMs = opts.maxDelayMs ?? 4e3;
  const sleep = opts.sleep ?? defaultSleep;
  const rng = opts.rng ?? Math.random;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt >= maxAttempts || !opts.isRetryable(err)) break;
      const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const jitter = exp * 0.25 * rng();
      await sleep(exp + jitter);
    }
  }
  throw lastErr;
}
var RULES = [
  {
    category: "prompt_injection",
    pattern:
      /\b(ignore (all |the )?previous instructions|disregard (the )?system prompt|reveal (the )?(system )?prompt|show (me )?the (rubric|model answer|grading guidance))\b/i,
  },
  { category: "self_harm", pattern: /\b(kill myself|suicide|end my life|self[-\s]?harm)\b/i },
  {
    category: "sexual_minor",
    pattern: /\b(child|minor|underage)\b.{0,20}\b(sex|nude|explicit)\b/i,
  },
  { category: "violence_threat", pattern: /\b(i('| wi)ll kill|shoot up|bomb the|murder you)\b/i },
  { category: "hate", pattern: /\b(kill all|exterminate the)\b/i },
];
var EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
var PHONE_RE = /\b(?:\+?\d[\d\s-]{7,}\d)\b/g;
function redactPii(text) {
  return text.replace(EMAIL_RE, "[redacted-email]").replace(PHONE_RE, "[redacted-phone]");
}
function moderateText(text, opts = {}) {
  const blockOn = new Set(
    opts.blockOn ?? ["prompt_injection", "self_harm", "sexual_minor", "violence_threat", "hate"]
  );
  const categories = [];
  for (const rule of RULES) {
    if (rule.pattern.test(text) && blockOn.has(rule.category)) {
      categories.push(rule.category);
    }
  }
  const sanitized = opts.redactPii === false ? text : redactPii(text);
  return { allowed: categories.length === 0, categories, sanitized };
}
function createAiGateway(deps) {
  const repos = deps.repos;
  const secretResolver = deps.secretResolver ?? createSecretResolver({ projectId: deps.projectId });
  const circuit = deps.circuitBreaker ?? createCircuitBreaker();
  const providerFactory =
    deps.providerFactory ??
    ((apiKey, model) => createGeminiProvider(apiKey, { defaultModel: model }));
  const maxRetries = deps.maxRetries ?? 3;
  return {
    async generate(req, ctx) {
      const nowIso = (ctx.now ?? (() => /* @__PURE__ */ new Date().toISOString()))();
      const template = PROMPTS[req.promptKey];
      const model = req.model ?? template.defaultModel;
      const circuitKey = `${ctx.tenantId}:${model}`;
      const shouldModerate = req.moderate ?? template.purpose === "ai_chat";
      let inputCategories = [];
      if (shouldModerate) {
        const raw = JSON.stringify(req.variables);
        const m = moderateText(raw);
        inputCategories = m.categories;
        if (!m.allowed) {
          throw aiDisabled("Input blocked by content moderation", {
            tenantId: ctx.tenantId,
            categories: m.categories,
          });
        }
      }
      await checkUsageQuota(repos, ctx.tenantId, nowIso);
      if (circuit.isCircuitOpen(circuitKey)) {
        throw providerFailed("AI provider circuit is open", {
          retryable: true,
          meta: { tenantId: ctx.tenantId, model },
        });
      }
      const apiKey = await secretResolver.getApiKey(ctx.tenantId);
      const provider = providerFactory(apiKey, model);
      const { system, user } = renderPrompt(req.promptKey, req.variables);
      const startedAt = Date.now();
      let providerOut;
      try {
        providerOut = await withRetry(
          () =>
            provider.call({
              model,
              system,
              user,
              images: req.images,
              ...(req.temperature !== void 0
                ? { temperature: req.temperature }
                : { temperature: template.defaultTemperature }),
              ...(req.maxTokens !== void 0 ? { maxTokens: req.maxTokens } : {}),
              ...(req.responseSchema !== void 0 ? { responseSchema: req.responseSchema } : {}),
            }),
          {
            maxAttempts: maxRetries,
            isRetryable: (e) => classifyError(e) === "transient",
          }
        );
        circuit.recordSuccess(circuitKey);
      } catch (err) {
        if (classifyError(err) === "transient") circuit.recordFailure(circuitKey);
        const latencyMs2 = Date.now() - startedAt;
        await safeLogFailure(repos, ctx, req, model, latencyMs2, err);
        if (isAiGatewayError(err)) throw err;
        throw providerFailed("AI provider call failed", {
          retryable: classifyError(err) === "transient",
          meta: { tenantId: ctx.tenantId, model, operation: req.operation },
          cause: err,
        });
      }
      const latencyMs = Date.now() - startedAt;
      const usage = buildTokenUsage(providerOut.usage);
      const cost = estimateCost(usage, providerOut.model);
      let outputCategories = [];
      if (shouldModerate) {
        outputCategories = moderateText(providerOut.text).categories;
      }
      await logLLMCall(repos, {
        tenantId: ctx.tenantId,
        functionName: req.operation,
        model: providerOut.model,
        usage,
        cost,
        latencyMs,
        status: "success",
        userId: ctx.uid,
        ...(ctx.examId !== void 0 ? { examId: ctx.examId } : {}),
        ...(ctx.spaceId !== void 0 ? { spaceId: ctx.spaceId } : {}),
      });
      const data = template.structured ? providerOut.json : providerOut.text;
      return {
        data,
        text: providerOut.text,
        tokenUsage: usage,
        cost,
        model: providerOut.model,
        ...(shouldModerate
          ? { moderation: { input: inputCategories, output: outputCategories } }
          : {}),
      };
    },
  };
}
async function safeLogFailure(repos, ctx, req, model, latencyMs, err) {
  const zeroUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  try {
    await logLLMCall(repos, {
      tenantId: ctx.tenantId,
      functionName: req.operation,
      model,
      usage: zeroUsage,
      cost: estimateCost(zeroUsage, model),
      latencyMs,
      status: "error",
      errorMessage: String(err?.message ?? err),
      userId: ctx.uid,
      ...(ctx.examId !== void 0 ? { examId: ctx.examId } : {}),
      ...(ctx.spaceId !== void 0 ? { spaceId: ctx.spaceId } : {}),
    });
  } catch {}
}
var STUB_USAGE = { inputTokens: 16, outputTokens: 32, totalTokens: 48 };
var GRADE_JSON = {
  score: 1,
  maxScore: 1,
  correctness: 1,
  percentage: 100,
  confidence: 0.95,
  feedback: "Deterministic stub grade.",
  strengths: ["stub-strength"],
  weaknesses: [],
  missingConcepts: [],
  breakdown: [{ criterion: "stub", marks: 1, maxMarks: 1 }],
};
var EXTRACT_JSON = [
  {
    text: "Stub extracted question",
    maxMarks: 1,
    order: 1,
    questionType: "subjective",
    rubric: { criteria: [{ description: "stub", marks: 1 }] },
    extractionConfidence: 0.95,
    readabilityIssue: false,
  },
];
var MAPPING_JSON = {
  routingMap: { q1: [1] },
  confidence: { q1: 0.95 },
};
var INSIGHTS_JSON = {
  insights: [{ title: "Stub insight", body: "Deterministic stub insight.", severity: "info" }],
};
function pickJson(input) {
  const sys = input.system.toLowerCase();
  if (sys.includes("extraction engine")) return EXTRACT_JSON;
  if (sys.includes("answer-sheet scout")) return MAPPING_JSON;
  if (sys.includes("grader")) return GRADE_JSON;
  if (sys.includes("insight")) return INSIGHTS_JSON;
  return GRADE_JSON;
}
function createStubProvider(_apiKey, model) {
  const defaultModel = model ?? "gemini-1.5-flash";
  return {
    name: "gemini",
    async call(input) {
      const resolvedModel = input.model ?? defaultModel;
      if (input.responseSchema !== void 0) {
        const json = pickJson(input);
        return {
          text: JSON.stringify(json),
          json,
          usage: STUB_USAGE,
          model: resolvedModel,
        };
      }
      return {
        text: "Deterministic stub tutor reply.",
        usage: STUB_USAGE,
        model: resolvedModel,
      };
    },
  };
}

// ../../packages/api-contract/dist/index.js
import { z as z2 } from "zod";
function defineCallable(def2) {
  return def2;
}
var PageRequest = z2
  .object({
    cursor: z2.string().optional(),
    limit: z2.number().int().min(1).max(100).default(20),
  })
  .strict();
var pageResponse = (item) =>
  z2
    .object({
      items: z2.array(item),
      nextCursor: z2.string().nullable(),
      // null = end of stream
      total: z2.number().int().nonnegative().optional(),
    })
    .strict();
var withPaging = (shape) => shape.extend(PageRequest.shape).strict();
var SaveResponseSchema = z2
  .object({
    id: z2.string(),
    created: z2.boolean().optional(),
    deleted: z2.boolean().optional(),
  })
  .strict();
z2.object({}).strict();
z2.record(z2.string(), z2.unknown());
var TenantSummarySchema = z2
  .object({
    id: zTenantId,
    name: z2.string(),
    slug: z2.string(),
    status: zTenantStatus,
    plan: zTenantPlan,
    totalStudents: z2.number().int(),
    totalTeachers: z2.number().int(),
    createdAt: z2.string(),
  })
  .strict();
var SaveTenantRequestSchema = z2
  .object({
    id: zTenantId.optional(),
    data: z2
      .object({
        name: z2.string().optional(),
        shortName: z2.string().optional(),
        contactEmail: z2.string().optional(),
        contactPhone: z2.string().optional(),
        plan: zTenantPlan.optional(),
        features: TenantFeaturesSchema.optional(),
        settings: TenantSettingsSchema.optional(),
        branding: TenantBrandingSchema.optional(),
        // Plaintext key on the WIRE only; the server stores a Secret Manager ref
        // (geminiKeyRef) and never persists/returns the value (§authority #8).
        geminiApiKey: z2.string().optional(),
      })
      .strict(),
    delete: z2.boolean().optional(),
  })
  .strict();
var saveTenant = defineCallable({
  name: "v1.identity.saveTenant",
  module: "identity",
  requestSchema: SaveTenantRequestSchema,
  responseSchema: SaveResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["tenants"],
  authoritySensitive: true,
});
var DeactivateTenantRequestSchema = z2
  .object({
    tenantOverride: zTenantId,
    reason: z2.string().optional(),
  })
  .strict();
var DeactivateTenantResponseSchema = z2
  .object({ tenantId: zTenantId, status: zTenantStatus })
  .strict();
var deactivateTenant = defineCallable({
  name: "v1.identity.deactivateTenant",
  module: "identity",
  requestSchema: DeactivateTenantRequestSchema,
  responseSchema: DeactivateTenantResponseSchema,
  authMode: "authed",
  rateTier: "write",
  allowsTenantOverride: true,
  invalidates: ["tenants", "memberships"],
  authoritySensitive: true,
});
var ReactivateTenantRequestSchema = z2.object({ tenantOverride: zTenantId }).strict();
var reactivateTenant = defineCallable({
  name: "v1.identity.reactivateTenant",
  module: "identity",
  requestSchema: ReactivateTenantRequestSchema,
  responseSchema: DeactivateTenantResponseSchema,
  authMode: "authed",
  rateTier: "write",
  allowsTenantOverride: true,
  invalidates: ["tenants", "memberships"],
  authoritySensitive: true,
});
var EXPORT_COLLECTIONS = [
  "students",
  "teachers",
  "parents",
  "classes",
  "exams",
  "analytics",
  "all",
];
var zExportCollection = z2.enum(EXPORT_COLLECTIONS);
var ExportTenantDataRequestSchema = z2
  .object({
    tenantOverride: zTenantId.optional(),
    scope: zExportCollection,
    collections: z2.array(zExportCollection).optional(),
  })
  .strict();
var ExportTenantDataResponseSchema = z2
  .object({ downloadUrl: z2.string(), expiresAt: z2.string() })
  .strict();
var exportTenantData = defineCallable({
  name: "v1.identity.exportTenantData",
  module: "identity",
  requestSchema: ExportTenantDataRequestSchema,
  responseSchema: ExportTenantDataResponseSchema,
  authMode: "authed",
  rateTier: "report",
  allowsTenantOverride: true,
});
var ExportJobSchema = z2
  .object({
    id: z2.string(),
    scope: zExportCollection,
    status: z2.enum(["pending", "running", "completed", "failed", "expired"]),
    downloadUrl: z2.string().nullable(),
    requestedAt: z2.string(),
    completedAt: z2.string().nullable(),
    expiresAt: z2.string().nullable(),
  })
  .strict();
var ListExportJobsRequestSchema = PageRequest;
var listExportJobs = defineCallable({
  name: "v1.identity.listExportJobs",
  module: "identity",
  requestSchema: ListExportJobsRequestSchema,
  responseSchema: pageResponse(ExportJobSchema),
  authMode: "authed",
  rateTier: "read",
});
var UploadTenantAssetRequestSchema = z2
  .object({
    kind: z2.enum(["logo", "banner", "favicon"]),
    contentType: z2.string(),
    bytesBase64: z2.string(),
  })
  .strict();
var UploadTenantAssetResponseSchema = z2.object({ assetUrl: z2.string() }).strict();
var uploadTenantAsset = defineCallable({
  name: "v1.identity.uploadTenantAsset",
  module: "identity",
  requestSchema: UploadTenantAssetRequestSchema,
  responseSchema: UploadTenantAssetResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["tenants"],
});
var LookupTenantByCodeRequestSchema = z2.object({ tenantCode: z2.string() }).strict();
var lookupTenantByCode = defineCallable({
  name: "v1.identity.lookupTenantByCode",
  module: "identity",
  requestSchema: LookupTenantByCodeRequestSchema,
  // The ONLY shape returned pre-auth (REVIEW §6.12 — no enumeration leak).
  responseSchema: TenantPublicViewSchema,
  authMode: "public",
  rateTier: "auth",
});
var SaveTenantSettingsRequestSchema = z2
  .object({
    tenantOverride: zTenantId.optional(),
    data: TenantSettingsSchema,
  })
  .strict();
var saveTenantSettings = defineCallable({
  name: "v1.identity.saveTenantSettings",
  module: "identity",
  requestSchema: SaveTenantSettingsRequestSchema,
  responseSchema: SaveResponseSchema,
  authMode: "authed",
  rateTier: "write",
  allowsTenantOverride: true,
  invalidates: ["tenants"],
});
var SaveTenantFeaturesRequestSchema = z2
  .object({
    tenantOverride: zTenantId,
    features: TenantFeaturesSchema,
  })
  .strict();
var saveTenantFeatures = defineCallable({
  name: "v1.identity.saveTenantFeatures",
  module: "identity",
  requestSchema: SaveTenantFeaturesRequestSchema,
  responseSchema: SaveResponseSchema,
  authMode: "authed",
  rateTier: "write",
  allowsTenantOverride: true,
  invalidates: ["tenants"],
});
var BulkApplyTenantFeaturesRequestSchema = z2
  .object({
    tenantIds: z2.array(zTenantId).min(1),
    featureKey: z2.enum(["autograde", "levelup", "analytics", "store"]),
    enabled: z2.boolean(),
  })
  .strict();
var BulkApplyTenantFeaturesResponseSchema = z2
  .object({
    updated: z2.number().int(),
    errors: z2.array(z2.object({ tenantId: zTenantId, error: z2.string() }).strict()),
  })
  .strict();
var bulkApplyTenantFeatures = defineCallable({
  name: "v1.identity.bulkApplyTenantFeatures",
  module: "identity",
  requestSchema: BulkApplyTenantFeaturesRequestSchema,
  responseSchema: BulkApplyTenantFeaturesResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  // explicit `tenantIds[]` target list (not a single-tenant override) — super-admin.
  invalidates: ["tenants"],
});
var PlatformConfigSchema = z2
  .object({
    trialLength: z2.number().int(),
    supportEmail: z2.string(),
    branding: TenantBrandingSchema.optional(),
    defaultFeatures: TenantFeaturesSchema,
    maintenanceMode: z2.boolean(),
    aiConfigPresent: z2.boolean(),
  })
  .strict();
var GetPlatformConfigRequestSchema = z2.object({}).strict();
var getPlatformConfig = defineCallable({
  name: "v1.identity.getPlatformConfig",
  module: "identity",
  requestSchema: GetPlatformConfigRequestSchema,
  responseSchema: PlatformConfigSchema,
  authMode: "authed",
  rateTier: "read",
});
var SavePlatformConfigRequestSchema = z2
  .object({
    data: z2
      .object({
        trialLength: z2.number().int().optional(),
        supportEmail: z2.string().optional(),
        branding: TenantBrandingSchema.optional(),
        defaultFeatures: TenantFeaturesSchema.optional(),
        maintenanceMode: z2.boolean().optional(),
      })
      .strict(),
  })
  .strict();
var SavePlatformConfigResponseSchema = z2.object({ saved: z2.literal(true) }).strict();
var savePlatformConfig = defineCallable({
  name: "v1.identity.savePlatformConfig",
  module: "identity",
  requestSchema: SavePlatformConfigRequestSchema,
  responseSchema: SavePlatformConfigResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["platformConfig"],
  authoritySensitive: true,
});
var GetTenantRequestSchema = z2.object({ tenantOverride: zTenantId.optional() }).strict();
var getTenant = defineCallable({
  name: "v1.identity.getTenant",
  module: "identity",
  requestSchema: GetTenantRequestSchema,
  responseSchema: TenantSchema,
  authMode: "authed",
  rateTier: "read",
  allowsTenantOverride: true,
});
var ListTenantsRequestSchema = withPaging(
  z2.object({
    status: zTenantStatus.optional(),
    plan: zTenantPlan.optional(),
    q: z2.string().optional(),
  })
);
var listTenants = defineCallable({
  name: "v1.identity.listTenants",
  module: "identity",
  requestSchema: ListTenantsRequestSchema,
  responseSchema: pageResponse(TenantSummarySchema),
  authMode: "authed",
  rateTier: "read",
});
var DAYS_OF_WEEK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
var zDayOfWeek = z2.enum(DAYS_OF_WEEK);
var ClassScheduleSchema = z2
  .object({
    days: z2.array(zDayOfWeek).min(1),
    startTime: z2.string(),
    endTime: z2.string(),
    room: z2.string().optional(),
  })
  .strict();
var SaveStudentRequestSchema = z2
  .object({
    id: zStudentId.optional(),
    data: z2
      .object({
        firstName: z2.string(),
        lastName: z2.string(),
        email: z2.string().optional(),
        rollNumber: z2.string().optional(),
        section: z2.string().optional(),
        grade: z2.string().optional(),
        classIds: z2.array(zClassId).optional(),
        parentIds: z2.array(zParentId).optional(),
        dateOfBirth: zIsoDate.optional(),
        admissionNumber: z2.string().optional(),
        status: zEntityStatus.optional(),
      })
      .strict(),
    delete: z2.boolean().optional(),
  })
  .strict();
var saveStudent = defineCallable({
  name: "v1.identity.saveStudent",
  module: "identity",
  requestSchema: SaveStudentRequestSchema,
  responseSchema: SaveResponseSchema,
  authMode: "authed",
  rateTier: "write",
  resyncsClaims: true,
  invalidates: ["students", "classes", "memberships", "claims"],
});
var SaveTeacherRequestSchema = z2
  .object({
    id: zTeacherId.optional(),
    data: z2
      .object({
        firstName: z2.string(),
        lastName: z2.string(),
        email: z2.string().optional(),
        phone: z2.string().optional(),
        subjects: z2.array(z2.string()).optional(),
        department: z2.string().optional(),
        designation: z2.string().optional(),
        classIds: z2.array(zClassId).optional(),
        permissions: z2
          .object({
            permissions: z2.record(zTeacherPermissionKey, z2.boolean()).optional(),
            managedSpaceIds: z2.array(zSpaceId).optional(),
            managedClassIds: z2.array(zClassId).optional(),
          })
          .strict()
          .optional(),
        status: zEntityStatus.optional(),
      })
      .strict(),
    delete: z2.boolean().optional(),
  })
  .strict();
var saveTeacher = defineCallable({
  name: "v1.identity.saveTeacher",
  module: "identity",
  requestSchema: SaveTeacherRequestSchema,
  responseSchema: SaveResponseSchema,
  authMode: "authed",
  rateTier: "write",
  resyncsClaims: true,
  invalidates: ["teachers", "classes", "memberships", "claims"],
});
var SaveParentRequestSchema = z2
  .object({
    id: zParentId.optional(),
    data: z2
      .object({
        firstName: z2.string(),
        lastName: z2.string(),
        email: z2.string().optional(),
        phone: z2.string().optional(),
        // canonical parent→child name (D10).
        studentIds: z2.array(zStudentId).optional(),
        status: zEntityStatus.optional(),
      })
      .strict(),
    delete: z2.boolean().optional(),
  })
  .strict();
var saveParent = defineCallable({
  name: "v1.identity.saveParent",
  module: "identity",
  requestSchema: SaveParentRequestSchema,
  responseSchema: SaveResponseSchema,
  authMode: "authed",
  rateTier: "write",
  resyncsClaims: true,
  invalidates: ["parents", "students", "memberships", "claims"],
});
var SaveStaffRequestSchema = z2
  .object({
    id: zStaffId.optional(),
    data: z2
      .object({
        firstName: z2.string(),
        lastName: z2.string(),
        email: z2.string().optional(),
        department: z2.string().optional(),
        staffPermissions: z2.record(zStaffPermissionKey, z2.boolean()).optional(),
        status: zEntityStatus.optional(),
      })
      .strict(),
    delete: z2.boolean().optional(),
  })
  .strict();
var saveStaff = defineCallable({
  name: "v1.identity.saveStaff",
  module: "identity",
  requestSchema: SaveStaffRequestSchema,
  responseSchema: SaveResponseSchema,
  authMode: "authed",
  rateTier: "write",
  resyncsClaims: true,
  invalidates: ["staff", "memberships", "claims"],
});
var SaveClassRequestSchema = z2
  .object({
    id: zClassId.optional(),
    data: z2
      .object({
        name: z2.string(),
        grade: z2.string(),
        section: z2.string().optional(),
        academicSessionId: zAcademicSessionId.optional(),
        teacherIds: z2.array(zTeacherId).optional(),
        schedule: ClassScheduleSchema.optional(),
        status: zEntityStatus.optional(),
      })
      .strict(),
    delete: z2.boolean().optional(),
  })
  .strict();
var saveClass = defineCallable({
  name: "v1.identity.saveClass",
  module: "identity",
  requestSchema: SaveClassRequestSchema,
  responseSchema: SaveResponseSchema,
  authMode: "authed",
  rateTier: "write",
  resyncsClaims: true,
  invalidates: ["classes", "students", "teachers", "claims"],
});
var SaveAcademicSessionRequestSchema = z2
  .object({
    id: zAcademicSessionId.optional(),
    data: z2
      .object({
        name: z2.string(),
        startDate: zIsoDate,
        endDate: zIsoDate,
        isCurrent: z2.boolean().optional(),
        status: zEntityStatus.optional(),
      })
      .strict(),
    delete: z2.boolean().optional(),
  })
  .strict();
var saveAcademicSession = defineCallable({
  name: "v1.identity.saveAcademicSession",
  module: "identity",
  requestSchema: SaveAcademicSessionRequestSchema,
  responseSchema: SaveResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["academicSessions", "classes"],
});
var ListStudentsRequestSchema = withPaging(
  z2.object({
    classId: zClassId.optional(),
    status: zEntityStatus.optional(),
    q: z2.string().optional(),
  })
);
var listStudents = defineCallable({
  name: "v1.identity.listStudents",
  module: "identity",
  requestSchema: ListStudentsRequestSchema,
  responseSchema: pageResponse(StudentSchema),
  authMode: "authed",
  rateTier: "read",
});
var GetStudentRequestSchema = z2.object({ id: zStudentId }).strict();
var getStudent = defineCallable({
  name: "v1.identity.getStudent",
  module: "identity",
  requestSchema: GetStudentRequestSchema,
  responseSchema: StudentSchema,
  authMode: "authed",
  rateTier: "read",
});
var ListTeachersRequestSchema = withPaging(z2.object({ status: zEntityStatus.optional() }));
var listTeachers = defineCallable({
  name: "v1.identity.listTeachers",
  module: "identity",
  requestSchema: ListTeachersRequestSchema,
  responseSchema: pageResponse(TeacherSchema),
  authMode: "authed",
  rateTier: "read",
});
var GetTeacherRequestSchema = z2.object({ id: zTeacherId }).strict();
var getTeacher = defineCallable({
  name: "v1.identity.getTeacher",
  module: "identity",
  requestSchema: GetTeacherRequestSchema,
  responseSchema: TeacherSchema,
  authMode: "authed",
  rateTier: "read",
});
var ListParentsRequestSchema = withPaging(z2.object({ studentId: zStudentId.optional() }));
var listParents = defineCallable({
  name: "v1.identity.listParents",
  module: "identity",
  requestSchema: ListParentsRequestSchema,
  responseSchema: pageResponse(ParentSchema),
  authMode: "authed",
  rateTier: "read",
});
var ListStaffRequestSchema = PageRequest;
var listStaff = defineCallable({
  name: "v1.identity.listStaff",
  module: "identity",
  requestSchema: ListStaffRequestSchema,
  responseSchema: pageResponse(StaffSchema),
  authMode: "authed",
  rateTier: "read",
});
var ListClassesRequestSchema = withPaging(
  z2.object({
    academicSessionId: zAcademicSessionId.optional(),
    status: zEntityStatus.optional(),
  })
);
var listClasses = defineCallable({
  name: "v1.identity.listClasses",
  module: "identity",
  requestSchema: ListClassesRequestSchema,
  responseSchema: pageResponse(ClassSchema),
  authMode: "authed",
  rateTier: "read",
});
var ClassDetailViewSchema = z2
  .object({
    class: ClassSchema,
    students: pageResponse(StudentSchema),
    teachers: z2.array(TeacherSchema),
  })
  .strict();
var GetClassRequestSchema = z2.object({ id: zClassId }).strict();
var getClass = defineCallable({
  name: "v1.identity.getClass",
  module: "identity",
  requestSchema: GetClassRequestSchema,
  responseSchema: ClassDetailViewSchema,
  authMode: "authed",
  rateTier: "read",
});
var ListAcademicSessionsRequestSchema = PageRequest;
var listAcademicSessions = defineCallable({
  name: "v1.identity.listAcademicSessions",
  module: "identity",
  requestSchema: ListAcademicSessionsRequestSchema,
  responseSchema: pageResponse(AcademicSessionSchema),
  authMode: "authed",
  rateTier: "read",
});
var CreateOrgUserRequestSchema = z2
  .object({
    role: zTenantRole,
    firstName: z2.string(),
    lastName: z2.string(),
    email: z2.string().optional(),
    rollNumber: z2.string().optional(),
    password: z2.string().optional(),
    phone: z2.string().optional(),
    classIds: z2.array(zClassId).optional(),
    subjects: z2.array(z2.string()).optional(),
    // canonical parent→child linkage mapped server-side to parentLinkedStudentIds.
    linkedStudentIds: z2.array(zStudentId).optional(),
  })
  .strict();
var CreateOrgUserResponseSchema = z2
  .object({
    uid: zUserId,
    entityId: z2.string(),
    membershipId: zMembershipId,
  })
  .strict();
var createOrgUser = defineCallable({
  name: "v1.identity.createOrgUser",
  module: "identity",
  requestSchema: CreateOrgUserRequestSchema,
  responseSchema: CreateOrgUserResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  resyncsClaims: true,
  invalidates: ["students", "teachers", "parents", "staff", "memberships", "claims", "tenants"],
  authoritySensitive: true,
});
var SwitchActiveTenantRequestSchema = z2.object({ targetTenantId: zTenantId }).strict();
var SwitchActiveTenantResponseSchema = z2
  .object({ tenantId: zTenantId, role: zTenantRole })
  .strict();
var switchActiveTenant = defineCallable({
  name: "v1.identity.switchActiveTenant",
  module: "identity",
  requestSchema: SwitchActiveTenantRequestSchema,
  responseSchema: SwitchActiveTenantResponseSchema,
  authMode: "authed",
  rateTier: "auth",
  resyncsClaims: true,
  // tenant context changes everything — handled by resetForTenantSwitch (§4.3).
  invalidates: ["me", "claims", "memberships"],
  authoritySensitive: true,
});
var JoinTenantRequestSchema = z2.object({ tenantCode: z2.string() }).strict();
var JoinTenantResponseSchema = z2
  .object({ tenantId: zTenantId, membershipId: zMembershipId, role: zTenantRole })
  .strict();
var joinTenant = defineCallable({
  name: "v1.identity.joinTenant",
  module: "identity",
  requestSchema: JoinTenantRequestSchema,
  responseSchema: JoinTenantResponseSchema,
  authMode: "authed",
  rateTier: "auth",
  idempotent: true,
  idempotencyKey: "transport",
  resyncsClaims: true,
  invalidates: ["me", "memberships", "claims"],
});
var StudentImportRowSchema = z2
  .object({
    firstName: z2.string(),
    lastName: z2.string(),
    email: z2.string().optional(),
    rollNumber: z2.string().optional(),
    section: z2.string().optional(),
    grade: z2.string().optional(),
    admissionNumber: z2.string().optional(),
    classIds: z2.array(zClassId).optional(),
  })
  .strict();
var TeacherImportRowSchema = z2
  .object({
    firstName: z2.string(),
    lastName: z2.string(),
    email: z2.string().optional(),
    phone: z2.string().optional(),
    subjects: z2.array(z2.string()).optional(),
    department: z2.string().optional(),
  })
  .strict();
var BulkRowErrorSchema = z2.object({ row: z2.number().int(), error: z2.string() }).strict();
var BulkImportResponseSchema = z2
  .object({
    created: z2.number().int(),
    skipped: z2.number().int(),
    errors: z2.array(BulkRowErrorSchema),
  })
  .strict();
var BulkImportStudentsRequestSchema = z2
  .object({
    rows: z2.array(StudentImportRowSchema).min(1),
    defaultClassIds: z2.array(zClassId).optional(),
  })
  .strict();
var bulkImportStudents = defineCallable({
  name: "v1.identity.bulkImportStudents",
  module: "identity",
  requestSchema: BulkImportStudentsRequestSchema,
  responseSchema: BulkImportResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  resyncsClaims: true,
  invalidates: ["students", "classes", "memberships", "claims", "tenants"],
  authoritySensitive: true,
});
var BulkImportTeachersRequestSchema = z2
  .object({ rows: z2.array(TeacherImportRowSchema).min(1) })
  .strict();
var bulkImportTeachers = defineCallable({
  name: "v1.identity.bulkImportTeachers",
  module: "identity",
  requestSchema: BulkImportTeachersRequestSchema,
  responseSchema: BulkImportResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  resyncsClaims: true,
  invalidates: ["teachers", "memberships", "claims", "tenants"],
  authoritySensitive: true,
});
var BulkUpdateStatusRequestSchema = z2
  .object({
    entityType: z2.enum(["student", "teacher", "class"]),
    ids: z2.array(z2.string()).min(1),
    status: zEntityStatus,
  })
  .strict();
var BulkUpdateStatusResponseSchema = z2
  .object({
    updated: z2.number().int(),
    errors: z2.array(z2.object({ id: z2.string(), error: z2.string() }).strict()),
  })
  .strict();
var bulkUpdateStatus = defineCallable({
  name: "v1.identity.bulkUpdateStatus",
  module: "identity",
  requestSchema: BulkUpdateStatusRequestSchema,
  responseSchema: BulkUpdateStatusResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  resyncsClaims: true,
  invalidates: ["students", "teachers", "memberships", "claims"],
  authoritySensitive: true,
});
var ChangeMembershipRoleRequestSchema = z2
  .object({
    uid: zUserId,
    toRole: zTenantRole,
    links: z2
      .object({
        teacherId: zTeacherId.optional(),
        studentId: zStudentId.optional(),
        parentId: zParentId.optional(),
        staffId: zStaffId.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
var ChangeMembershipRoleResponseSchema = z2
  .object({ membershipId: zMembershipId, role: zTenantRole })
  .strict();
var changeMembershipRole = defineCallable({
  name: "v1.identity.changeMembershipRole",
  module: "identity",
  requestSchema: ChangeMembershipRoleRequestSchema,
  responseSchema: ChangeMembershipRoleResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  resyncsClaims: true,
  invalidates: ["memberships", "claims"],
  authoritySensitive: true,
});
var RolloverSessionRequestSchema = z2
  .object({
    fromSessionId: zAcademicSessionId,
    toSessionId: zAcademicSessionId,
    // optional class→class promotion mapping (old classId → new classId).
    promotionMap: z2.record(zClassId, zClassId).optional(),
  })
  .strict();
var RolloverSessionResponseSchema = z2
  .object({ classesCreated: z2.number().int(), studentsMoved: z2.number().int() })
  .strict();
var rolloverSession = defineCallable({
  name: "v1.identity.rolloverSession",
  module: "identity",
  requestSchema: RolloverSessionRequestSchema,
  responseSchema: RolloverSessionResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  invalidates: ["classes", "academicSessions", "students"],
});
var SaveAnnouncementRequestSchema = z2
  .object({
    id: zAnnouncementId.optional(),
    // platform scope is super-admin; tenant scope is admin. `tenantOverride` is
    // the super-admin cross-tenant field (never a body `tenantId`).
    tenantOverride: zTenantId.optional(),
    data: z2
      .object({
        scope: zAnnouncementScope.optional(),
        title: z2.string().max(200).optional(),
        body: z2.string().max(5e3).optional(),
        targetRoles: z2.array(zNotificationRecipientRole).max(10).optional(),
        targetClassIds: z2.array(zClassId).max(100).optional(),
        status: zAnnouncementStatus.optional(),
        expiresAt: z2.string().optional(),
      })
      .strict(),
    delete: z2.boolean().optional(),
  })
  .strict();
var saveAnnouncement = defineCallable({
  name: "v1.identity.saveAnnouncement",
  module: "identity",
  requestSchema: SaveAnnouncementRequestSchema,
  responseSchema: SaveResponseSchema,
  authMode: "authed",
  rateTier: "write",
  allowsTenantOverride: true,
  invalidates: ["announcements"],
  // publish lifecycle transition (assertTransition(announcement)) — never optimistic.
  authoritySensitive: true,
});
var AnnouncementListItemSchema = z2
  .object({
    id: zAnnouncementId,
    title: z2.string(),
    body: z2.string(),
    scope: zAnnouncementScope,
    status: zAnnouncementStatus,
    authorName: z2.string(),
    publishedAt: z2.string().nullable(),
    expiresAt: z2.string().nullable(),
    isReadByMe: z2.boolean(),
  })
  .strict();
var ListAnnouncementsRequestSchema = withPaging(
  z2.object({
    scope: zAnnouncementScope.optional(),
    status: zAnnouncementStatus.optional(),
  })
);
var listAnnouncements = defineCallable({
  name: "v1.identity.listAnnouncements",
  module: "identity",
  requestSchema: ListAnnouncementsRequestSchema,
  responseSchema: pageResponse(AnnouncementListItemSchema),
  authMode: "authed",
  rateTier: "read",
});
var MarkAnnouncementReadRequestSchema = z2.object({ announcementId: zAnnouncementId }).strict();
var MarkAnnouncementReadResponseSchema = z2.object({ isReadByMe: z2.literal(true) }).strict();
var markAnnouncementRead = defineCallable({
  name: "v1.identity.markAnnouncementRead",
  module: "identity",
  requestSchema: MarkAnnouncementReadRequestSchema,
  responseSchema: MarkAnnouncementReadResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "domain:announcementId",
  invalidates: ["announcements"],
});
var EstimateAudienceRequestSchema = z2
  .object({
    targetRoles: z2.array(zNotificationRecipientRole).max(10).optional(),
    targetClassIds: z2.array(zClassId).max(100).optional(),
  })
  .strict();
var EstimateAudienceResponseSchema = z2.object({ recipientCount: z2.number().int() }).strict();
var estimateAudience = defineCallable({
  name: "v1.identity.estimateAudience",
  module: "identity",
  requestSchema: EstimateAudienceRequestSchema,
  responseSchema: EstimateAudienceResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var ListNotificationsRequestSchema = PageRequest;
var listNotifications = defineCallable({
  name: "v1.identity.listNotifications",
  module: "identity",
  requestSchema: ListNotificationsRequestSchema,
  responseSchema: pageResponse(NotificationSchema),
  authMode: "authed",
  rateTier: "read",
});
var GetNotificationBadgeRequestSchema = z2.object({}).strict();
var getNotificationBadge = defineCallable({
  name: "v1.identity.getNotificationBadge",
  module: "identity",
  requestSchema: GetNotificationBadgeRequestSchema,
  responseSchema: NotificationBadgeStateSchema,
  authMode: "authed",
  rateTier: "read",
});
var MarkNotificationReadRequestSchema = z2.discriminatedUnion("mode", [
  z2.object({ mode: z2.literal("one"), notificationId: zNotificationId }).strict(),
  z2.object({ mode: z2.literal("all") }).strict(),
]);
var MarkNotificationReadResponseSchema = z2
  .object({ unreadCount: z2.number().int().min(0) })
  .strict();
var markNotificationRead = defineCallable({
  name: "v1.identity.markNotificationRead",
  module: "identity",
  requestSchema: MarkNotificationReadRequestSchema,
  responseSchema: MarkNotificationReadResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  invalidates: ["notifications", "notificationBadge"],
});
var GetNotificationPreferencesRequestSchema = z2.object({}).strict();
var getNotificationPreferences = defineCallable({
  name: "v1.identity.getNotificationPreferences",
  module: "identity",
  requestSchema: GetNotificationPreferencesRequestSchema,
  responseSchema: NotificationPreferencesSchema,
  authMode: "authed",
  rateTier: "read",
});
var SaveNotificationPreferencesRequestSchema = z2
  .object({
    enabledTypes: z2.array(zNotificationType).optional(),
    muteUntil: z2.string().nullable().optional(),
  })
  .strict();
var saveNotificationPreferences = defineCallable({
  name: "v1.identity.saveNotificationPreferences",
  module: "identity",
  requestSchema: SaveNotificationPreferencesRequestSchema,
  responseSchema: NotificationPreferencesSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  invalidates: ["notificationPreferences"],
});
var RegisterDeviceTokenRequestSchema = z2
  .object({
    token: z2.string(),
    platform: z2.enum(["ios", "android", "web"]),
    appKey: z2.string(),
  })
  .strict();
var DeviceTokenAckSchema = z2.object({ ok: z2.literal(true) }).strict();
var registerDeviceToken = defineCallable({
  name: "v1.identity.registerDeviceToken",
  module: "identity",
  requestSchema: RegisterDeviceTokenRequestSchema,
  responseSchema: DeviceTokenAckSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "domain:token",
  invalidates: ["device"],
});
var UnregisterDeviceTokenRequestSchema = z2.object({ token: z2.string() }).strict();
var unregisterDeviceToken = defineCallable({
  name: "v1.identity.unregisterDeviceToken",
  module: "identity",
  requestSchema: UnregisterDeviceTokenRequestSchema,
  responseSchema: DeviceTokenAckSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "domain:token",
  invalidates: ["device"],
});
var SendDirectMessageRequestSchema = z2
  .object({
    recipientUids: z2.array(zUserId).min(1),
    title: z2.string().max(200),
    body: z2.string().max(5e3),
  })
  .strict();
var SendDirectMessageResponseSchema = z2
  .object({ sent: z2.literal(true), count: z2.number().int() })
  .strict();
var sendDirectMessage = defineCallable({
  name: "v1.identity.sendDirectMessage",
  module: "identity",
  requestSchema: SendDirectMessageRequestSchema,
  responseSchema: SendDirectMessageResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["message"],
});
var GetMeRequestSchema = z2.object({}).strict();
var GetMeResponseSchema = z2
  .object({
    user: UnifiedUserSchema,
    memberships: z2.array(UserMembershipSchema),
    claims: PlatformClaimsSchema,
    activeTenant: TenantSchema.optional(),
  })
  .strict();
var getMe = defineCallable({
  name: "v1.identity.getMe",
  module: "identity",
  requestSchema: GetMeRequestSchema,
  responseSchema: GetMeResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var UpdateMyProfileRequestSchema = z2
  .object({
    displayName: z2.string().optional(),
    photoURL: z2.string().optional(),
  })
  .strict();
var OkResponseSchema = z2.object({ ok: z2.literal(true) }).strict();
var updateMyProfile = defineCallable({
  name: "v1.identity.updateMyProfile",
  module: "identity",
  requestSchema: UpdateMyProfileRequestSchema,
  responseSchema: OkResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["me"],
});
var UploadUserAssetRequestSchema = z2
  .object({
    kind: z2.literal("avatar"),
    contentType: z2.string(),
    bytesBase64: z2.string(),
  })
  .strict();
var UploadUserAssetResponseSchema = z2.object({ assetUrl: z2.string() }).strict();
var uploadUserAsset = defineCallable({
  name: "v1.identity.uploadUserAsset",
  module: "identity",
  requestSchema: UploadUserAssetRequestSchema,
  responseSchema: UploadUserAssetResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["me"],
});
var DeleteConsumerAccountRequestSchema = z2.object({ confirm: z2.literal(true) }).strict();
var DeleteConsumerAccountResponseSchema = z2.object({ scheduled: z2.literal(true) }).strict();
var deleteConsumerAccount = defineCallable({
  name: "v1.identity.deleteConsumerAccount",
  module: "identity",
  requestSchema: DeleteConsumerAccountRequestSchema,
  responseSchema: DeleteConsumerAccountResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["me"],
  authoritySensitive: true,
});
var UserSearchResultSchema = z2
  .object({
    uid: zUserId,
    email: z2.string().optional(),
    displayName: z2.string(),
    isSuperAdmin: z2.boolean(),
    activeTenantId: zTenantId.optional(),
    memberships: z2.array(
      z2.object({ tenantId: zTenantId, tenantCode: zTenantCode, role: zTenantRole }).strict()
    ),
  })
  .strict();
var SearchUsersRequestSchema = withPaging(z2.object({ query: z2.string() }));
var searchUsers = defineCallable({
  name: "v1.identity.searchUsers",
  module: "identity",
  requestSchema: SearchUsersRequestSchema,
  responseSchema: pageResponse(UserSearchResultSchema),
  authMode: "authed",
  rateTier: "read",
});
var GlobalEvaluationPresetSchema = z2
  .object({
    id: z2.string(),
    name: z2.string(),
    description: z2.string().optional(),
    category: z2.string().optional(),
    status: z2.enum(["active", "archived"]),
    rubricSnapshot: z2.unknown(),
    createdAt: z2.string(),
    updatedAt: z2.string(),
  })
  .strict();
var SaveGlobalEvaluationPresetRequestSchema = z2
  .object({
    id: z2.string().optional(),
    data: z2
      .object({
        name: z2.string(),
        description: z2.string().optional(),
        category: z2.string().optional(),
        status: z2.enum(["active", "archived"]).optional(),
        rubricSnapshot: z2.unknown().optional(),
      })
      .strict(),
    delete: z2.boolean().optional(),
  })
  .strict();
var saveGlobalEvaluationPreset = defineCallable({
  name: "v1.identity.saveGlobalEvaluationPreset",
  module: "identity",
  requestSchema: SaveGlobalEvaluationPresetRequestSchema,
  responseSchema: SaveResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["preset"],
});
var ListGlobalEvaluationPresetsRequestSchema = withPaging(
  z2.object({ status: z2.enum(["active", "archived"]).optional() })
);
var listGlobalEvaluationPresets = defineCallable({
  name: "v1.identity.listGlobalEvaluationPresets",
  module: "identity",
  requestSchema: ListGlobalEvaluationPresetsRequestSchema,
  responseSchema: pageResponse(GlobalEvaluationPresetSchema),
  authMode: "authed",
  rateTier: "read",
});
var SetUserStatusRequestSchema = z2
  .object({
    uid: zUserId,
    status: z2.enum(["disabled", "active"]),
  })
  .strict();
var SetUserStatusResponseSchema = z2
  .object({ uid: zUserId, status: z2.enum(["disabled", "active"]) })
  .strict();
var setUserStatus = defineCallable({
  name: "v1.identity.setUserStatus",
  module: "identity",
  requestSchema: SetUserStatusRequestSchema,
  responseSchema: SetUserStatusResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["userSearch"],
  authoritySensitive: true,
});
var SendPasswordResetRequestSchema = z2.object({ uid: zUserId }).strict();
var SendPasswordResetResponseSchema = z2.object({ sent: z2.literal(true) }).strict();
var sendPasswordReset = defineCallable({
  name: "v1.identity.sendPasswordReset",
  module: "identity",
  requestSchema: SendPasswordResetRequestSchema,
  responseSchema: SendPasswordResetResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["userSearch"],
  authoritySensitive: true,
});
var StartImpersonationRequestSchema = z2
  .object({
    targetUid: zUserId,
    // super-admin cross-tenant field (never a body `tenantId`).
    tenantOverride: zTenantId,
    reason: z2.string(),
  })
  .strict();
var StartImpersonationResponseSchema = z2
  .object({ sessionToken: z2.string(), expiresAt: z2.string() })
  .strict();
var startImpersonation = defineCallable({
  name: "v1.identity.startImpersonation",
  module: "identity",
  requestSchema: StartImpersonationRequestSchema,
  responseSchema: StartImpersonationResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  allowsTenantOverride: true,
  invalidates: ["userSearch"],
  authoritySensitive: true,
});
var EndImpersonationRequestSchema = z2.object({}).strict();
var EndImpersonationResponseSchema = z2.object({ ended: z2.literal(true) }).strict();
var endImpersonation = defineCallable({
  name: "v1.identity.endImpersonation",
  module: "identity",
  requestSchema: EndImpersonationRequestSchema,
  responseSchema: EndImpersonationResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  invalidates: ["userSearch"],
  authoritySensitive: true,
});
var IDENTITY_CALLABLES = {
  // tenant lifecycle + settings/features + platform config
  "v1.identity.saveTenant": saveTenant,
  "v1.identity.deactivateTenant": deactivateTenant,
  "v1.identity.reactivateTenant": reactivateTenant,
  "v1.identity.exportTenantData": exportTenantData,
  "v1.identity.listExportJobs": listExportJobs,
  "v1.identity.uploadTenantAsset": uploadTenantAsset,
  "v1.identity.lookupTenantByCode": lookupTenantByCode,
  "v1.identity.saveTenantSettings": saveTenantSettings,
  "v1.identity.saveTenantFeatures": saveTenantFeatures,
  "v1.identity.bulkApplyTenantFeatures": bulkApplyTenantFeatures,
  "v1.identity.getPlatformConfig": getPlatformConfig,
  "v1.identity.savePlatformConfig": savePlatformConfig,
  "v1.identity.getTenant": getTenant,
  "v1.identity.listTenants": listTenants,
  // org-entity upserts + reads
  "v1.identity.saveStudent": saveStudent,
  "v1.identity.saveTeacher": saveTeacher,
  "v1.identity.saveParent": saveParent,
  "v1.identity.saveStaff": saveStaff,
  "v1.identity.saveClass": saveClass,
  "v1.identity.saveAcademicSession": saveAcademicSession,
  "v1.identity.listStudents": listStudents,
  "v1.identity.getStudent": getStudent,
  "v1.identity.listTeachers": listTeachers,
  "v1.identity.getTeacher": getTeacher,
  "v1.identity.listParents": listParents,
  "v1.identity.listStaff": listStaff,
  "v1.identity.listClasses": listClasses,
  "v1.identity.getClass": getClass,
  "v1.identity.listAcademicSessions": listAcademicSessions,
  // multi-tenant user management + bulk ops
  "v1.identity.createOrgUser": createOrgUser,
  "v1.identity.switchActiveTenant": switchActiveTenant,
  "v1.identity.joinTenant": joinTenant,
  "v1.identity.bulkImportStudents": bulkImportStudents,
  "v1.identity.bulkImportTeachers": bulkImportTeachers,
  "v1.identity.bulkUpdateStatus": bulkUpdateStatus,
  "v1.identity.changeMembershipRole": changeMembershipRole,
  "v1.identity.rolloverSession": rolloverSession,
  // announcements + notifications + preferences + device tokens
  "v1.identity.saveAnnouncement": saveAnnouncement,
  "v1.identity.listAnnouncements": listAnnouncements,
  "v1.identity.markAnnouncementRead": markAnnouncementRead,
  "v1.identity.estimateAudience": estimateAudience,
  "v1.identity.listNotifications": listNotifications,
  "v1.identity.getNotificationBadge": getNotificationBadge,
  "v1.identity.markNotificationRead": markNotificationRead,
  "v1.identity.getNotificationPreferences": getNotificationPreferences,
  "v1.identity.saveNotificationPreferences": saveNotificationPreferences,
  "v1.identity.registerDeviceToken": registerDeviceToken,
  "v1.identity.unregisterDeviceToken": unregisterDeviceToken,
  "v1.identity.sendDirectMessage": sendDirectMessage,
  // session/profile reads + account self-service + super-admin platform ops
  "v1.identity.getMe": getMe,
  "v1.identity.updateMyProfile": updateMyProfile,
  "v1.identity.uploadUserAsset": uploadUserAsset,
  "v1.identity.deleteConsumerAccount": deleteConsumerAccount,
  "v1.identity.searchUsers": searchUsers,
  "v1.identity.saveGlobalEvaluationPreset": saveGlobalEvaluationPreset,
  "v1.identity.listGlobalEvaluationPresets": listGlobalEvaluationPresets,
  "v1.identity.setUserStatus": setUserStatus,
  "v1.identity.sendPasswordReset": sendPasswordReset,
  "v1.identity.startImpersonation": startImpersonation,
  "v1.identity.endImpersonation": endImpersonation,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
};
var SaveResponseSchema2 = z2
  .object({
    id: z2.string(),
    created: z2.boolean().optional(),
    deleted: z2.boolean().optional(),
  })
  .strict();
var SaveOrDeleteResponseSchema = z2.union([
  SaveResponseSchema2,
  z2.object({ id: z2.string(), deleted: z2.literal(true) }).strict(),
]);
var SpaceViewSchema = SpaceSchema;
var StoryPointViewSchema = StoryPointSchema;
var ItemViewSchema = UnifiedItemSchema;
var ItemEditViewSchema = UnifiedItemSchema.extend({
  // The ONE sanctioned answer-bearing read: getItemForEdit re-merges the ⚷ AnswerKey.
  answerKey: AnswerKeySchema.optional(),
});
var DigitalTestSessionViewSchema = DigitalTestSessionSchema;
var TestSubmissionResultViewSchema = z2
  .object({
    itemId: TestSubmissionSchema.shape.itemId,
    questionType: zQuestionType,
    answer: z2.unknown(),
    correct: z2.boolean().nullable(),
    pointsEarned: z2.number().nullable(),
    totalPoints: z2.number().nullable(),
    evaluation: StoredEvaluationSchema.nullable(),
    pending: z2.boolean(),
  })
  .strict();
var DigitalTestSessionResultViewSchema = DigitalTestSessionSchema.extend({
  submissions: z2.array(TestSubmissionResultViewSchema).default([]),
}).strict();
var DigitalTestSessionSummaryViewSchema = z2
  .object({
    id: DigitalTestSessionSchema.shape.id,
    spaceId: DigitalTestSessionSchema.shape.spaceId,
    storyPointId: DigitalTestSessionSchema.shape.storyPointId,
    sessionType: DigitalTestSessionSchema.shape.sessionType,
    status: zTestSessionStatus,
    attemptNumber: z2.number().int(),
    isLatest: z2.boolean(),
    percentage: z2.number().optional(),
    startedAt: DigitalTestSessionSchema.shape.startedAt,
    submittedAt: DigitalTestSessionSchema.shape.submittedAt,
  })
  .strict();
var SpaceProgressViewSchema = SpaceProgressSchema;
var StoryPointProgressDocViewSchema = StoryPointProgressDocSchema;
var ItemProgressViewSchema = z2
  .object({
    itemId: z2.string(),
    completed: z2.boolean(),
    bestScore: z2.number().optional(),
    latestScore: z2.number().optional(),
    pointsEarned: z2.number().optional(),
    totalPoints: z2.number().optional(),
    percentage: z2.number().optional(),
    attemptsCount: z2.number().int().optional(),
    solved: z2.boolean().optional(),
    evaluation: StoredEvaluationSchema.nullable(),
  })
  .strict();
var AgentViewSchema = AgentSchema;
var ChatSessionSummarySchema = z2
  .object({
    id: ChatSessionSchema.shape.id,
    spaceId: ChatSessionSchema.shape.spaceId,
    storyPointId: ChatSessionSchema.shape.storyPointId,
    itemId: ChatSessionSchema.shape.itemId,
    sessionTitle: z2.string(),
    previewMessage: z2.string(),
    messageCount: z2.number().int(),
    language: z2.string(),
    isActive: z2.boolean(),
    updatedAt: ChatSessionSchema.shape.updatedAt,
  })
  .strict();
var ChatSessionViewSchema = ChatSessionSchema.omit({ systemPrompt: true }).strict();
var SaveSpaceDataSchema = z2
  .object({
    // OPTIONAL so a PARTIAL update (e.g. a status-only lifecycle move on an
    // existing space) is schema-valid; the service requires title+type on CREATE
    // and merges them from the stored space on UPDATE (saveSpace IS the transition
    // verb — there is no separate publishSpace/archiveSpace).
    title: z2.string().min(1).max(200).optional(),
    type: zSpaceType.optional(),
    description: z2.string().optional(),
    thumbnailUrl: z2.string().optional(),
    slug: z2.string().optional(),
    subject: z2.string().optional(),
    labels: z2.array(z2.string()).optional(),
    classIds: z2.array(z2.string()).optional(),
    sectionIds: z2.array(z2.string()).optional(),
    teacherIds: z2.array(z2.string()).optional(),
    accessType: z2.enum(["class_assigned", "tenant_wide", "public_store"]).optional(),
    academicSessionId: z2.string().optional(),
    defaultEvaluatorAgentId: z2.string().optional(),
    defaultTutorAgentId: z2.string().optional(),
    defaultRubricId: z2.string().optional(),
    status: zSpaceStatus.optional(),
    publishedToStore: z2.boolean().optional(),
    price: zMoney.optional(),
    storeDescription: z2.string().optional(),
    storeThumbnailUrl: z2.string().optional(),
    deleted: z2.boolean().optional(),
  })
  .strict();
var SaveSpaceRequestSchema = z2
  .object({
    id: z2.string().optional(),
    data: SaveSpaceDataSchema,
  })
  .strict();
var SaveSpaceResponseSchema = SaveResponseSchema2;
var saveSpaceDef = defineCallable({
  name: "v1.levelup.saveSpace",
  module: "levelup",
  requestSchema: SaveSpaceRequestSchema,
  responseSchema: SaveSpaceResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["spaces", "store"],
  authoritySensitive: true,
});
var SaveStoryPointDataSchema = z2
  .object({
    title: z2.string().min(1),
    description: z2.string().optional(),
    orderIndex: z2.number().int().optional(),
    type: zStoryPointType,
    sections: z2.array(StoryPointSectionSchema).optional(),
    assessmentConfig: AssessmentConfigSchema.optional(),
    defaultRubricId: z2.string().optional(),
    difficulty: zDifficulty.optional(),
    estimatedTimeMinutes: z2.number().int().optional(),
    deleted: z2.boolean().optional(),
  })
  .strict();
var SaveStoryPointRequestSchema = z2
  .object({
    id: z2.string().optional(),
    spaceId: z2.string(),
    data: SaveStoryPointDataSchema,
  })
  .strict();
var SaveStoryPointResponseSchema = SaveOrDeleteResponseSchema;
var saveStoryPointDef = defineCallable({
  name: "v1.levelup.saveStoryPoint",
  module: "levelup",
  requestSchema: SaveStoryPointRequestSchema,
  responseSchema: SaveStoryPointResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["storyPoints", "spaces"],
  authoritySensitive: true,
});
var SaveItemDataSchema = z2
  .object({
    type: zItemType,
    payload: ItemPayloadSchema,
    title: z2.string().optional(),
    content: z2.string().optional(),
    difficulty: zDifficulty.optional(),
    topics: z2.array(z2.string()).optional(),
    labels: z2.array(z2.string()).optional(),
    orderIndex: z2.number().int().optional(),
    sectionId: z2.string().optional(),
    meta: ItemMetadataSchema.optional(),
    rubricId: z2.string().optional(),
    linkedQuestionId: z2.string().optional(),
    deleted: z2.boolean().optional(),
  })
  .strict();
var SaveItemRequestSchema = z2
  .object({
    id: z2.string().optional(),
    spaceId: z2.string(),
    storyPointId: z2.string(),
    data: SaveItemDataSchema,
  })
  .strict();
var SaveItemResponseSchema = SaveOrDeleteResponseSchema;
var saveItemDef = defineCallable({
  name: "v1.levelup.saveItem",
  module: "levelup",
  requestSchema: SaveItemRequestSchema,
  responseSchema: SaveItemResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["items", "storyPoints", "versions"],
  authoritySensitive: true,
});
var ImportFromBankRequestSchema = z2
  .object({
    spaceId: z2.string(),
    storyPointId: z2.string(),
    bankItemIds: z2.array(z2.string()).min(1),
    targetType: zItemType.optional(),
  })
  .strict();
var ImportFromBankResponseSchema = z2.object({ createdItemIds: z2.array(z2.string()) }).strict();
var importFromBankDef = defineCallable({
  name: "v1.levelup.importFromBank",
  module: "levelup",
  requestSchema: ImportFromBankRequestSchema,
  responseSchema: ImportFromBankResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  invalidates: ["items"],
});
var SaveAgentDataSchema = z2
  .object({
    type: zAgentType,
    name: z2.string().min(1),
    identity: z2.string().optional(),
    isActive: z2.boolean().optional(),
    systemPrompt: z2.string().optional(),
    supportedLanguages: z2.array(z2.string()).optional(),
    defaultLanguage: z2.string().optional(),
    maxConversationTurns: z2.number().int().optional(),
    rules: z2.array(z2.string()).optional(),
    evaluationObjectives: z2.array(z2.string()).optional(),
    strictness: z2.number().optional(),
    feedbackStyle: z2.string().optional(),
    modelOverride: z2.string().optional(),
    temperatureOverride: z2.number().optional(),
    deleted: z2.boolean().optional(),
  })
  .strict();
var SaveAgentRequestSchema = z2
  .object({
    id: z2.string().optional(),
    spaceId: z2.string(),
    data: SaveAgentDataSchema,
  })
  .strict();
var SaveAgentResponseSchema = SaveOrDeleteResponseSchema;
var saveAgentDef = defineCallable({
  name: "v1.levelup.saveAgent",
  module: "levelup",
  requestSchema: SaveAgentRequestSchema,
  responseSchema: SaveAgentResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["agents"],
  authoritySensitive: true,
});
var SaveRubricPresetDataSchema = z2
  .object({
    name: z2.string().min(1),
    description: z2.string().optional(),
    rubric: UnifiedRubricSchema,
    category: zRubricPresetCategory,
    questionTypes: z2.array(zQuestionType).optional(),
    isDefault: z2.boolean().optional(),
    deleted: z2.boolean().optional(),
  })
  .strict();
var SaveRubricPresetRequestSchema = z2
  .object({
    id: z2.string().optional(),
    data: SaveRubricPresetDataSchema,
  })
  .strict();
var SaveRubricPresetResponseSchema = SaveOrDeleteResponseSchema;
var saveRubricPresetDef = defineCallable({
  name: "v1.levelup.saveRubricPreset",
  module: "levelup",
  requestSchema: SaveRubricPresetRequestSchema,
  responseSchema: SaveRubricPresetResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["rubricPresets"],
  authoritySensitive: true,
});
var SaveQuestionBankItemDataSchema = z2
  .object({
    questionType: zQuestionType,
    title: z2.string().optional(),
    content: z2.string(),
    explanation: z2.string().optional(),
    basePoints: z2.number().optional(),
    questionData: QuestionTypeDataSchema,
    subject: z2.string(),
    topics: z2.array(z2.string()),
    difficulty: zDifficulty,
    bloomsLevel: zBloomsLevel.optional(),
    tags: z2.array(z2.string()).optional(),
    deleted: z2.boolean().optional(),
  })
  .strict();
var SaveQuestionBankItemRequestSchema = z2
  .object({
    id: z2.string().optional(),
    data: SaveQuestionBankItemDataSchema,
  })
  .strict();
var SaveQuestionBankItemResponseSchema = SaveOrDeleteResponseSchema;
var saveQuestionBankItemDef = defineCallable({
  name: "v1.levelup.saveQuestionBankItem",
  module: "levelup",
  requestSchema: SaveQuestionBankItemRequestSchema,
  responseSchema: SaveQuestionBankItemResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["questionBank"],
  authoritySensitive: true,
});
var StartTestSessionRequestSchema = z2
  .object({
    spaceId: z2.string(),
    storyPointId: z2.string(),
  })
  .strict();
var StartTestSessionResponseSchema = z2
  .object({
    session: DigitalTestSessionViewSchema,
    resuming: z2.boolean(),
  })
  .strict();
var startTestSessionDef = defineCallable({
  name: "v1.levelup.startTestSession",
  module: "levelup",
  requestSchema: StartTestSessionRequestSchema,
  responseSchema: StartTestSessionResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  invalidates: ["testSessions", "progress"],
  authoritySensitive: true,
});
var SubmitTestSessionRequestSchema = z2
  .object({
    sessionId: z2.string(),
    autoSubmitted: z2.boolean().optional(),
  })
  .strict();
var SubmitTestSessionResponseSchema = z2
  .object({
    session: DigitalTestSessionResultViewSchema,
    progressUpdated: z2.boolean(),
  })
  .strict();
var submitTestSessionDef = defineCallable({
  name: "v1.levelup.submitTestSession",
  module: "levelup",
  requestSchema: SubmitTestSessionRequestSchema,
  responseSchema: SubmitTestSessionResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  invalidates: ["testSessions", "progress", "storyPoints", "analytics"],
  authoritySensitive: true,
});
var SaveTestAnswerRequestSchema = z2
  .object({
    sessionId: z2.string(),
    itemId: z2.string(),
    answer: z2.unknown(),
    markedForReview: z2.boolean().optional(),
    timeSpentSeconds: z2.number().int().optional(),
  })
  .strict();
var SaveTestAnswerResponseSchema = z2
  .object({
    sessionId: z2.string(),
    itemId: z2.string(),
    saved: z2.literal(true),
    answeredQuestions: z2.number().int(),
  })
  .strict();
var saveTestAnswerDef = defineCallable({
  name: "v1.levelup.saveTestAnswer",
  module: "levelup",
  requestSchema: SaveTestAnswerRequestSchema,
  responseSchema: SaveTestAnswerResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  invalidates: ["testSessions"],
  authoritySensitive: true,
});
var EvaluateAnswerRequestSchema = z2
  .object({
    spaceId: z2.string(),
    storyPointId: z2.string().optional(),
    itemId: z2.string(),
    answer: z2.unknown(),
    mode: z2.enum(["practice", "preview"]).optional(),
    mediaUrls: z2.array(z2.string().url()).max(20).optional(),
  })
  .strict();
var EvaluateAnswerResponseSchema = z2
  .object({
    evaluation: StoredEvaluationSchema,
    progressRecorded: z2.boolean(),
  })
  .strict();
var evaluateAnswerDef = defineCallable({
  name: "v1.levelup.evaluateAnswer",
  module: "levelup",
  requestSchema: EvaluateAnswerRequestSchema,
  responseSchema: EvaluateAnswerResponseSchema,
  authMode: "authed",
  rateTier: "ai",
  idempotent: true,
  invalidates: ["storyPoints", "progress"],
  authoritySensitive: true,
});
var RecordItemAttemptRequestSchema = z2
  .object({
    spaceId: z2.string(),
    storyPointId: z2.string(),
    itemId: z2.string(),
    answer: z2.unknown(),
    timeSpent: z2.number().optional(),
  })
  .strict();
var RecordItemAttemptResponseSchema = z2
  .object({
    progress: ItemProgressViewSchema,
    completed: z2.boolean(),
  })
  .strict();
var recordItemAttemptDef = defineCallable({
  name: "v1.levelup.recordItemAttempt",
  module: "levelup",
  requestSchema: RecordItemAttemptRequestSchema,
  responseSchema: RecordItemAttemptResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "domain:spaceId,storyPointId,itemId,answer",
  invalidates: ["progress"],
  // authoritySensitive:true — recordItemAttempt writes a GRADING OUTPUT (server
  // scores per CD13 / REVIEW §6.5). It is the ONE documented carve-out that is
  // ALSO on the OPTIMISTIC_ALLOWLIST: the optimistic patch shows an in-flight
  // attempt and reconciles from the authoritative {progress,completed} response
  // (A11) — the client never sends a score. The authority-flag-coverage test
  // requires this flag AND explicitly excepts recordItemAttempt from the
  // optimistic∩authority disjointness check (§3.1 / §4.4 / §6.5).
  authoritySensitive: true,
});
var SendChatMessageRequestSchema = z2
  .object({
    sessionId: z2.string().optional(),
    spaceId: z2.string(),
    storyPointId: z2.string(),
    itemId: z2.string(),
    text: z2.string().min(1),
    mediaUrls: z2.array(z2.string().url()).optional(),
    language: z2.string().optional(),
  })
  .strict();
var SendChatMessageResponseSchema = z2
  .object({
    sessionId: z2.string(),
    message: ChatMessageSchema,
    tokensUsed: z2.number().int().optional(),
  })
  .strict();
var sendChatMessageDef = defineCallable({
  name: "v1.levelup.sendChatMessage",
  module: "levelup",
  requestSchema: SendChatMessageRequestSchema,
  responseSchema: SendChatMessageResponseSchema,
  authMode: "authed",
  rateTier: "ai",
  invalidates: ["chat"],
});
var SaveSpaceReviewRequestSchema = z2
  .object({
    spaceId: z2.string(),
    rating: z2.number().int().min(1).max(5),
    comment: z2.string().optional(),
  })
  .strict();
var SaveSpaceReviewResponseSchema = z2
  .object({
    success: z2.boolean(),
    isUpdate: z2.boolean(),
  })
  .strict();
var saveSpaceReviewDef = defineCallable({
  name: "v1.levelup.saveSpaceReview",
  module: "levelup",
  requestSchema: SaveSpaceReviewRequestSchema,
  responseSchema: SaveSpaceReviewResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["reviews", "spaces"],
});
var PurchaseSpaceRequestSchema = z2
  .object({
    spaceId: z2.string(),
    paymentToken: z2.string().optional(),
  })
  .strict();
var PurchaseSpaceResponseSchema = z2
  .object({
    success: z2.boolean(),
    transactionId: z2.string(),
    enrolledSpaceId: z2.string(),
  })
  .strict();
var purchaseSpaceDef = defineCallable({
  name: "v1.levelup.purchaseSpace",
  module: "levelup",
  requestSchema: PurchaseSpaceRequestSchema,
  responseSchema: PurchaseSpaceResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  invalidates: ["store", "spaces", "enrollments"],
  authoritySensitive: true,
});
var AssignContentWindowSchema = z2
  .object({
    startAt: z2.string().datetime().optional(),
    dueAt: z2.string().datetime().optional(),
  })
  .strict();
var AssignContentRequestSchema = z2
  .object({
    contentType: z2.enum(["space", "exam"]),
    contentId: z2.string(),
    classIds: z2.array(z2.string()).min(1),
    window: AssignContentWindowSchema.optional(),
    visibility: z2.enum(["visible", "hidden", "scheduled"]).optional(),
  })
  .strict();
var AssignContentResponseSchema = SaveResponseSchema2;
var assignContentDef = defineCallable({
  name: "v1.levelup.assignContent",
  module: "levelup",
  requestSchema: AssignContentRequestSchema,
  responseSchema: AssignContentResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  invalidates: ["assignment", "spaces", "exams"],
});
var GeneratedItemSchema = z2
  .object({
    itemType: z2.enum(["question", "material"]),
    questionType: zQuestionType.optional(),
    title: z2.string(),
    payload: ItemPayloadSchema,
    bloomsLevel: z2.string().optional(),
    topics: z2.array(z2.string()).optional(),
    suggestedRubric: UnifiedRubricSchema.optional(),
  })
  .strict();
var GenerateContentRequestSchema = z2
  .object({
    storyPointId: z2.string(),
    spaceId: z2.string().optional(),
    spec: z2
      .object({
        types: z2.array(z2.string()).min(1),
        count: z2.number().int().min(1).max(50),
        difficulty: z2.string().optional(),
      })
      .strict(),
    sourcePdfPath: z2.string().optional(),
  })
  .strict();
var GenerateContentResponseSchema = z2.object({ drafts: z2.array(GeneratedItemSchema) }).strict();
var generateContentDef = defineCallable({
  name: "v1.levelup.generateContent",
  module: "levelup",
  requestSchema: GenerateContentRequestSchema,
  responseSchema: GenerateContentResponseSchema,
  authMode: "authed",
  rateTier: "ai",
  authoritySensitive: true,
});
var SpaceFilterSchema = z2
  .object({
    status: zSpaceStatus.optional(),
    type: zSpaceType.optional(),
    classId: z2.string().optional(),
    subject: z2.string().optional(),
    teacherId: z2.string().optional(),
  })
  .strict();
var ListSpacesRequestSchema = withPaging(SpaceFilterSchema);
var ListSpacesResponseSchema = pageResponse(SpaceViewSchema);
var listSpacesDef = defineCallable({
  name: "v1.levelup.listSpaces",
  module: "levelup",
  requestSchema: ListSpacesRequestSchema,
  responseSchema: ListSpacesResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var GetSpaceRequestSchema = z2.object({ spaceId: z2.string() }).strict();
var GetSpaceResponseSchema = z2.object({ space: SpaceViewSchema }).strict();
var getSpaceDef = defineCallable({
  name: "v1.levelup.getSpace",
  module: "levelup",
  requestSchema: GetSpaceRequestSchema,
  responseSchema: GetSpaceResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var ListStoryPointsRequestSchema = z2.object({ spaceId: z2.string() }).strict();
var ListStoryPointsResponseSchema = z2.object({ items: z2.array(StoryPointViewSchema) }).strict();
var listStoryPointsDef = defineCallable({
  name: "v1.levelup.listStoryPoints",
  module: "levelup",
  requestSchema: ListStoryPointsRequestSchema,
  responseSchema: ListStoryPointsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var GetStoryPointRequestSchema = z2
  .object({ spaceId: z2.string(), storyPointId: z2.string() })
  .strict();
var GetStoryPointResponseSchema = z2.object({ storyPoint: StoryPointViewSchema }).strict();
var getStoryPointDef = defineCallable({
  name: "v1.levelup.getStoryPoint",
  module: "levelup",
  requestSchema: GetStoryPointRequestSchema,
  responseSchema: GetStoryPointResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var ListItemsRequestSchema = withPaging(
  z2.object({ spaceId: z2.string(), storyPointId: z2.string() }).strict()
);
var ListItemsResponseSchema = pageResponse(ItemViewSchema);
var listItemsDef = defineCallable({
  name: "v1.levelup.listItems",
  module: "levelup",
  requestSchema: ListItemsRequestSchema,
  responseSchema: ListItemsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var GetItemForEditRequestSchema = z2
  .object({ spaceId: z2.string(), storyPointId: z2.string(), itemId: z2.string() })
  .strict();
var GetItemForEditResponseSchema = z2.object({ item: ItemEditViewSchema }).strict();
var getItemForEditDef = defineCallable({
  name: "v1.levelup.getItemForEdit",
  module: "levelup",
  requestSchema: GetItemForEditRequestSchema,
  responseSchema: GetItemForEditResponseSchema,
  authMode: "authed",
  rateTier: "read",
  authoritySensitive: true,
});
var ListVersionsRequestSchema = withPaging(z2.object({ spaceId: z2.string() }).strict());
var ListVersionsResponseSchema = pageResponse(ContentVersionSchema);
var listVersionsDef = defineCallable({
  name: "v1.levelup.listVersions",
  module: "levelup",
  requestSchema: ListVersionsRequestSchema,
  responseSchema: ListVersionsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var QuestionBankFilterSchema = z2
  .object({
    questionType: zQuestionType.optional(),
    subject: z2.string().optional(),
    difficulty: zDifficulty.optional(),
    bloomsLevel: zBloomsLevel.optional(),
    topic: z2.string().optional(),
    search: z2.string().optional(),
  })
  .strict();
var ListQuestionBankRequestSchema = withPaging(QuestionBankFilterSchema);
var ListQuestionBankResponseSchema = pageResponse(QuestionBankItemSchema);
var listQuestionBankDef = defineCallable({
  name: "v1.levelup.listQuestionBank",
  module: "levelup",
  requestSchema: ListQuestionBankRequestSchema,
  responseSchema: ListQuestionBankResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var ListRubricPresetsRequestSchema = z2
  .object({
    category: zRubricPresetCategory.optional(),
    questionType: zQuestionType.optional(),
  })
  .strict();
var ListRubricPresetsResponseSchema = z2.object({ items: z2.array(RubricPresetSchema) }).strict();
var listRubricPresetsDef = defineCallable({
  name: "v1.levelup.listRubricPresets",
  module: "levelup",
  requestSchema: ListRubricPresetsRequestSchema,
  responseSchema: ListRubricPresetsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var ListAgentsRequestSchema = z2.object({ spaceId: z2.string() }).strict();
var ListAgentsResponseSchema = z2.object({ items: z2.array(AgentViewSchema) }).strict();
var listAgentsDef = defineCallable({
  name: "v1.levelup.listAgents",
  module: "levelup",
  requestSchema: ListAgentsRequestSchema,
  responseSchema: ListAgentsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var ListChatSessionsRequestSchema = withPaging(
  z2.object({ spaceId: z2.string().optional(), itemId: z2.string().optional() }).strict()
);
var ListChatSessionsResponseSchema = pageResponse(ChatSessionSummarySchema);
var listChatSessionsDef = defineCallable({
  name: "v1.levelup.listChatSessions",
  module: "levelup",
  requestSchema: ListChatSessionsRequestSchema,
  responseSchema: ListChatSessionsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var GetChatSessionRequestSchema = z2.object({ sessionId: z2.string() }).strict();
var GetChatSessionResponseSchema = z2.object({ session: ChatSessionViewSchema }).strict();
var getChatSessionDef = defineCallable({
  name: "v1.levelup.getChatSession",
  module: "levelup",
  requestSchema: GetChatSessionRequestSchema,
  responseSchema: GetChatSessionResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var ListSpaceReviewsRequestSchema = withPaging(z2.object({ spaceId: z2.string() }).strict());
var ListSpaceReviewsResponseSchema = pageResponse(SpaceReviewSchema);
var listSpaceReviewsDef = defineCallable({
  name: "v1.levelup.listSpaceReviews",
  module: "levelup",
  requestSchema: ListSpaceReviewsRequestSchema,
  responseSchema: ListSpaceReviewsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var ListStoreSpacesRequestSchema = withPaging(
  z2.object({ subject: z2.string().optional(), search: z2.string().optional() }).strict()
);
var ListStoreSpacesResponseSchema = pageResponse(StoreSpaceListingSchema);
var listStoreSpacesDef = defineCallable({
  name: "v1.levelup.listStoreSpaces",
  module: "levelup",
  requestSchema: ListStoreSpacesRequestSchema,
  responseSchema: ListStoreSpacesResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var GetStoreSpaceRequestSchema = z2.object({ spaceId: z2.string() }).strict();
var GetStoreSpaceResponseSchema = z2.object({ listing: StoreSpaceListingSchema }).strict();
var getStoreSpaceDef = defineCallable({
  name: "v1.levelup.getStoreSpace",
  module: "levelup",
  requestSchema: GetStoreSpaceRequestSchema,
  responseSchema: GetStoreSpaceResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var GetSpaceProgressRequestSchema = z2
  .object({ spaceId: z2.string(), userId: z2.string().optional() })
  .strict();
var GetSpaceProgressResponseSchema = z2
  .object({ progress: SpaceProgressViewSchema.nullable() })
  .strict();
var getSpaceProgressDef = defineCallable({
  name: "v1.levelup.getSpaceProgress",
  module: "levelup",
  requestSchema: GetSpaceProgressRequestSchema,
  responseSchema: GetSpaceProgressResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var GetStoryPointProgressRequestSchema = z2
  .object({ spaceId: z2.string(), storyPointId: z2.string(), userId: z2.string().optional() })
  .strict();
var GetStoryPointProgressResponseSchema = z2
  .object({ progress: StoryPointProgressDocViewSchema.nullable() })
  .strict();
var getStoryPointProgressDef = defineCallable({
  name: "v1.levelup.getStoryPointProgress",
  module: "levelup",
  requestSchema: GetStoryPointProgressRequestSchema,
  responseSchema: GetStoryPointProgressResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var ListSpaceProgressForUserRequestSchema = withPaging(z2.object({ userId: z2.string() }).strict());
var ListSpaceProgressForUserResponseSchema = pageResponse(SpaceProgressViewSchema);
var listSpaceProgressForUserDef = defineCallable({
  name: "v1.levelup.listSpaceProgressForUser",
  module: "levelup",
  requestSchema: ListSpaceProgressForUserRequestSchema,
  responseSchema: ListSpaceProgressForUserResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var GetTestSessionRequestSchema = z2.object({ sessionId: z2.string() }).strict();
var GetTestSessionResponseSchema = z2.object({ session: DigitalTestSessionViewSchema }).strict();
var getTestSessionDef = defineCallable({
  name: "v1.levelup.getTestSession",
  module: "levelup",
  requestSchema: GetTestSessionRequestSchema,
  responseSchema: GetTestSessionResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var ListTestSessionsRequestSchema = withPaging(
  z2
    .object({
      spaceId: z2.string().optional(),
      storyPointId: z2.string().optional(),
      userId: z2.string().optional(),
      status: zTestSessionStatus.optional(),
      latestOnly: z2.boolean().optional(),
    })
    .strict()
);
var ListTestSessionsResponseSchema = pageResponse(DigitalTestSessionSummaryViewSchema);
var listTestSessionsDef = defineCallable({
  name: "v1.levelup.listTestSessions",
  module: "levelup",
  requestSchema: ListTestSessionsRequestSchema,
  responseSchema: ListTestSessionsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var LEVELUP_CONTENT_CALLABLES = {
  "v1.levelup.saveSpace": saveSpaceDef,
  "v1.levelup.saveStoryPoint": saveStoryPointDef,
  "v1.levelup.saveItem": saveItemDef,
  "v1.levelup.importFromBank": importFromBankDef,
  "v1.levelup.saveAgent": saveAgentDef,
  "v1.levelup.saveRubricPreset": saveRubricPresetDef,
  "v1.levelup.saveQuestionBankItem": saveQuestionBankItemDef,
  "v1.levelup.startTestSession": startTestSessionDef,
  "v1.levelup.submitTestSession": submitTestSessionDef,
  "v1.levelup.saveTestAnswer": saveTestAnswerDef,
  "v1.levelup.evaluateAnswer": evaluateAnswerDef,
  "v1.levelup.recordItemAttempt": recordItemAttemptDef,
  "v1.levelup.sendChatMessage": sendChatMessageDef,
  "v1.levelup.saveSpaceReview": saveSpaceReviewDef,
  "v1.levelup.purchaseSpace": purchaseSpaceDef,
  "v1.levelup.assignContent": assignContentDef,
  "v1.levelup.generateContent": generateContentDef,
  "v1.levelup.listSpaces": listSpacesDef,
  "v1.levelup.getSpace": getSpaceDef,
  "v1.levelup.listStoryPoints": listStoryPointsDef,
  "v1.levelup.getStoryPoint": getStoryPointDef,
  "v1.levelup.listItems": listItemsDef,
  "v1.levelup.getItemForEdit": getItemForEditDef,
  "v1.levelup.listVersions": listVersionsDef,
  "v1.levelup.listQuestionBank": listQuestionBankDef,
  "v1.levelup.listRubricPresets": listRubricPresetsDef,
  "v1.levelup.listAgents": listAgentsDef,
  "v1.levelup.listChatSessions": listChatSessionsDef,
  "v1.levelup.getChatSession": getChatSessionDef,
  "v1.levelup.listSpaceReviews": listSpaceReviewsDef,
  "v1.levelup.listStoreSpaces": listStoreSpacesDef,
  "v1.levelup.getStoreSpace": getStoreSpaceDef,
  "v1.levelup.getSpaceProgress": getSpaceProgressDef,
  "v1.levelup.getStoryPointProgress": getStoryPointProgressDef,
  "v1.levelup.listSpaceProgressForUser": listSpaceProgressForUserDef,
  "v1.levelup.getTestSession": getTestSessionDef,
  "v1.levelup.listTestSessions": listTestSessionsDef,
};
Object.values(LEVELUP_CONTENT_CALLABLES).map((d) => d.name);
var GetGamificationSummaryRequestSchema = z2.object({ userId: z2.string().optional() }).strict();
var getGamificationSummaryDef = defineCallable({
  name: "v1.levelup.getGamificationSummary",
  module: "levelup",
  requestSchema: GetGamificationSummaryRequestSchema,
  responseSchema: GamificationSummarySchema,
  authMode: "authed",
  rateTier: "read",
});
var GetStudentLevelRequestSchema = z2.object({ userId: z2.string().optional() }).strict();
var getStudentLevelDef = defineCallable({
  name: "v1.levelup.getStudentLevel",
  module: "levelup",
  requestSchema: GetStudentLevelRequestSchema,
  responseSchema: StudentLevelSchema,
  authMode: "authed",
  rateTier: "read",
});
var ListAchievementsRequestSchema = z2
  .object({ category: z2.string().optional(), onlyActive: z2.boolean().optional() })
  .extend(PageRequest.shape)
  .strict();
var AchievementWithEarnedStateSchema = AchievementSchema.extend({
  earned: z2.boolean(),
}).strict();
var ListAchievementsResponseSchema = pageResponse(AchievementWithEarnedStateSchema);
var listAchievementsDef = defineCallable({
  name: "v1.levelup.listAchievements",
  module: "levelup",
  requestSchema: ListAchievementsRequestSchema,
  responseSchema: ListAchievementsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var ListStudentAchievementsRequestSchema = z2
  .object({ userId: z2.string().optional(), unseenOnly: z2.boolean().optional() })
  .extend(PageRequest.shape)
  .strict();
var ListStudentAchievementsResponseSchema = pageResponse(StudentAchievementSchema);
var listStudentAchievementsDef = defineCallable({
  name: "v1.levelup.listStudentAchievements",
  module: "levelup",
  requestSchema: ListStudentAchievementsRequestSchema,
  responseSchema: ListStudentAchievementsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var MarkAchievementsSeenRequestSchema = z2.discriminatedUnion("mode", [
  z2.object({ mode: z2.literal("ids"), achievementIds: z2.array(z2.string()) }).strict(),
  z2.object({ mode: z2.literal("all") }).strict(),
]);
var MarkAchievementsSeenResponseSchema = z2
  .object({ updated: z2.number().int().nonnegative() })
  .strict();
var markAchievementsSeenDef = defineCallable({
  name: "v1.levelup.markAchievementsSeen",
  module: "levelup",
  requestSchema: MarkAchievementsSeenRequestSchema,
  responseSchema: MarkAchievementsSeenResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  invalidates: ["achievements", "gamification"],
});
var SaveAchievementDefinitionRequestSchema = z2
  .object({
    id: z2.string().optional(),
    data: z2.record(z2.string(), z2.unknown()),
    delete: z2.boolean().optional(),
  })
  .strict();
var saveAchievementDefinitionDef = defineCallable({
  name: "v1.levelup.saveAchievementDefinition",
  module: "levelup",
  requestSchema: SaveAchievementDefinitionRequestSchema,
  responseSchema: SaveResponseSchema2,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["achievements"],
  authoritySensitive: true,
});
var GetLeaderboardRequestSchema = z2
  .object({
    scope: z2.string(),
    spaceId: z2.string().optional(),
    storyPointId: z2.string().optional(),
  })
  .extend(PageRequest.shape)
  .strict();
var GetLeaderboardResponseSchema = pageResponse(LeaderboardEntrySchema)
  .extend({ callerEntry: LeaderboardEntrySchema.nullable() })
  .strict();
var getLeaderboardDef = defineCallable({
  name: "v1.levelup.getLeaderboard",
  module: "levelup",
  requestSchema: GetLeaderboardRequestSchema,
  responseSchema: GetLeaderboardResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var ListStudyGoalsRequestSchema = z2
  .object({ userId: z2.string().optional(), includeCompleted: z2.boolean().optional() })
  .extend(PageRequest.shape)
  .strict();
var ListStudyGoalsResponseSchema = pageResponse(StudyGoalSchema);
var listStudyGoalsDef = defineCallable({
  name: "v1.levelup.listStudyGoals",
  module: "levelup",
  requestSchema: ListStudyGoalsRequestSchema,
  responseSchema: ListStudyGoalsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var SaveStudyGoalRequestSchema = z2
  .object({ id: z2.string().optional(), data: z2.record(z2.string(), z2.unknown()) })
  .strict();
var saveStudyGoalDef = defineCallable({
  name: "v1.levelup.saveStudyGoal",
  module: "levelup",
  requestSchema: SaveStudyGoalRequestSchema,
  responseSchema: SaveResponseSchema2,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  invalidates: ["studyGoals"],
});
var ListStudySessionsRequestSchema = z2
  .object({
    userId: z2.string().optional(),
    fromDate: z2.string().optional(),
    toDate: z2.string().optional(),
  })
  .strict();
var ListStudySessionsResponseSchema = z2
  .object({
    sessions: z2.array(StudySessionSchema),
    streakDays: z2.number().int().nonnegative(),
    longestStreak: z2.number().int().nonnegative(),
  })
  .strict();
var listStudySessionsDef = defineCallable({
  name: "v1.levelup.listStudySessions",
  module: "levelup",
  requestSchema: ListStudySessionsRequestSchema,
  responseSchema: ListStudySessionsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var ListLearningInsightsRequestSchema = z2
  .object({ studentId: z2.string().optional(), type: z2.string().optional() })
  .extend(PageRequest.shape)
  .strict();
var ListLearningInsightsResponseSchema = pageResponse(LearningInsightSchema);
var listLearningInsightsDef = defineCallable({
  name: "v1.levelup.listLearningInsights",
  module: "levelup",
  requestSchema: ListLearningInsightsRequestSchema,
  responseSchema: ListLearningInsightsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var DismissInsightRequestSchema = z2.object({ insightId: z2.string() }).strict();
var DismissInsightResponseSchema = z2
  .object({ id: z2.string(), dismissed: z2.literal(true) })
  .strict();
var dismissInsightDef = defineCallable({
  name: "v1.levelup.dismissInsight",
  module: "levelup",
  requestSchema: DismissInsightRequestSchema,
  responseSchema: DismissInsightResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  invalidates: ["insights"],
});
var GAMIFICATION_CALLABLES = {
  "v1.levelup.getGamificationSummary": getGamificationSummaryDef,
  "v1.levelup.getStudentLevel": getStudentLevelDef,
  "v1.levelup.listAchievements": listAchievementsDef,
  "v1.levelup.listStudentAchievements": listStudentAchievementsDef,
  "v1.levelup.markAchievementsSeen": markAchievementsSeenDef,
  "v1.levelup.saveAchievementDefinition": saveAchievementDefinitionDef,
  "v1.levelup.getLeaderboard": getLeaderboardDef,
  "v1.levelup.listStudyGoals": listStudyGoalsDef,
  "v1.levelup.saveStudyGoal": saveStudyGoalDef,
  "v1.levelup.listStudySessions": listStudySessionsDef,
  "v1.levelup.listLearningInsights": listLearningInsightsDef,
  "v1.levelup.dismissInsight": dismissInsightDef,
};
var zPageParamsShape = PageRequest.shape;
var SaveExamResponseSchema = zObject({
  id: zExamId,
  created: z2.boolean(),
});
var SaveEvaluationSettingsResponseSchema = zObject({
  id: zEvaluationSettingsId,
  created: z2.boolean(),
});
var ExamListViewSchema = zObject({
  id: zExamId,
  title: z2.string(),
  subject: z2.string(),
  topics: z2.array(z2.string()),
  classIds: z2.array(zClassId),
  examDate: zTimestamp,
  duration: z2.number().int(),
  totalMarks: z2.number(),
  passingMarks: z2.number(),
  status: zExamStatus,
  academicSessionId: zAcademicSessionId.optional(),
  linkedSpaceId: zSpaceId.optional(),
  linkedSpaceTitle: z2.string().optional(),
  stats: ExamStatsSchema.optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
var ExamDetailViewSchema = zObject({
  id: zExamId,
  title: z2.string(),
  subject: z2.string(),
  topics: z2.array(z2.string()),
  classIds: z2.array(zClassId),
  sectionIds: z2.array(zSectionId).optional(),
  examDate: zTimestamp,
  duration: z2.number().int(),
  academicSessionId: zAcademicSessionId.optional(),
  totalMarks: z2.number(),
  passingMarks: z2.number(),
  status: zExamStatus,
  questionPaper: ExamQuestionPaperSchema.optional(),
  gradingConfig: ExamGradingConfigSchema,
  evaluationSettingsId: zEvaluationSettingsId.optional(),
  linkedSpaceId: zSpaceId.optional(),
  linkedSpaceTitle: z2.string().optional(),
  linkedStoryPointId: zStoryPointId.optional(),
  stats: ExamStatsSchema.optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
var ExamQuestionViewSchema = zObject({
  id: zExamQuestionId,
  examId: zExamId,
  text: z2.string(),
  imageUrls: z2.array(z2.string()).optional(),
  maxMarks: z2.number(),
  order: z2.number().int(),
  rubric: UnifiedRubricSchema,
  questionType: z2.string().optional(),
  subQuestions: z2.array(SubQuestionSchema).optional(),
  extractionConfidence: z2.number().optional(),
  readabilityIssue: z2.boolean().optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
var ExtractedQuestionSchema = zObject({
  id: zExamQuestionId.optional(),
  text: z2.string(),
  maxMarks: z2.number(),
  order: z2.number().int(),
  rubric: UnifiedRubricSchema.optional(),
  questionType: z2.string().optional(),
  subQuestions: z2.array(SubQuestionSchema).optional(),
  extractionConfidence: z2.number().optional(),
  readabilityIssue: z2.boolean().optional(),
});
var SubmissionListViewSchema = zObject({
  id: zSubmissionId,
  examId: zExamId,
  studentId: zStudentId,
  studentName: z2.string(),
  rollNumber: z2.string(),
  classId: zClassId,
  pipelineStatus: zSubmissionPipelineStatus,
  summary: SubmissionSummarySchema,
  gradingProgress: GradingProgressSchema.optional(),
  resultsReleased: z2.boolean(),
  uploadedBy: z2.string().optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
var SubmissionDetailViewSchema = zObject({
  id: zSubmissionId,
  examId: zExamId,
  studentId: zStudentId,
  studentName: z2.string(),
  rollNumber: z2.string(),
  classId: zClassId,
  answerSheets: AnswerSheetDataSchema,
  scoutingResult: ScoutingResultSchema.optional(),
  // ⚷ release-gated: the score summary is WITHHELD (omitted) for an owner reading
  // BEFORE results are released (§6.10 stripped projection), so it is optional here.
  summary: SubmissionSummarySchema.optional(),
  pipelineStatus: zSubmissionPipelineStatus,
  pipelineError: z2.string().optional(),
  retryCount: z2.number().int(),
  gradingProgress: GradingProgressSchema.optional(),
  resultsReleased: z2.boolean(),
  resultsReleasedAt: zTimestamp.nullable(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
var QuestionSubmissionViewSchema = zObject({
  id: zQuestionSubmissionId,
  submissionId: zSubmissionId,
  questionId: zExamQuestionId,
  examId: zExamId,
  mapping: QuestionMappingSchema,
  evaluation: UnifiedEvaluationResultSchema.optional(),
  gradingStatus: zQuestionGradingStatus,
  gradingError: z2.string().optional(),
  manualOverride: ManualOverrideSchema.optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
var EvaluationSettingsViewSchema = zObject({
  id: zEvaluationSettingsId,
  name: z2.string(),
  description: z2.string().optional(),
  isDefault: z2.boolean(),
  isPublic: z2.boolean().optional(),
  enabledDimensions: z2.array(EvaluationDimensionSchema),
  displaySettings: EvaluationDisplaySettingsSchema,
  confidenceConfig: EvaluationConfidenceConfigSchema.optional(),
  usageQuota: UsageQuotaConfigSchema.optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
var DeadLetterViewSchema = zObject({
  id: zDeadLetterEntryId,
  submissionId: zSubmissionId,
  questionSubmissionId: zQuestionSubmissionId.optional(),
  pipelineStep: z2.enum(GRADING_PIPELINE_STEPS),
  error: z2.string(),
  attempts: z2.number().int(),
  lastAttemptAt: zTimestamp,
  resolvedAt: zTimestamp.nullable(),
  resolutionMethod: z2.enum(DEAD_LETTER_RESOLUTION_METHODS).optional(),
  createdAt: zTimestamp,
});
var ExamAnalyticsViewSchema = zObject({
  examId: zExamId,
  totalSubmissions: z2.number().int(),
  gradedSubmissions: z2.number().int(),
  avgScore: z2.number(),
  avgPercentage: z2.number(),
  passRate: z2.number(),
  medianScore: z2.number(),
  scoreDistribution: ScoreDistributionSchema,
  questionAnalytics: z2.record(z2.string(), QuestionAnalyticsEntrySchema),
  classBreakdown: z2.record(z2.string(), ClassBreakdownEntrySchema),
  topicPerformance: z2.record(z2.string(), TopicPerformanceEntrySchema),
  computedAt: zTimestamp,
  lastUpdatedAt: zTimestamp,
});
var SaveExamDataSchema = zObject({
  title: z2.string().optional(),
  subject: z2.string().optional(),
  topics: z2.array(z2.string()).optional(),
  classIds: z2.array(zClassId).optional(),
  sectionIds: z2.array(zSectionId).optional(),
  examDate: zTimestamp.optional(),
  duration: z2.number().int().optional(),
  academicSessionId: zAcademicSessionId.optional(),
  totalMarks: z2.number().optional(),
  passingMarks: z2.number().optional(),
  gradingConfig: ExamGradingConfigSchema.optional(),
  linkedSpaceId: zSpaceId.optional(),
  linkedSpaceTitle: z2.string().optional(),
  linkedStoryPointId: zStoryPointId.optional(),
  status: zExamStatus.optional(),
  evaluationSettingsId: zEvaluationSettingsId.optional(),
  questionPaperImages: z2.array(z2.string()).optional(),
});
var SaveExamRequestSchema = zObject({
  id: zExamId.optional(),
  data: SaveExamDataSchema,
});
var saveExamDef = {
  name: "v1.autograde.saveExam",
  module: "autograde",
  requestSchema: SaveExamRequestSchema,
  responseSchema: SaveExamResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  // ⚷ exam lifecycle (publish + post-publish-locked fields) is server-authoritative.
  authoritySensitive: true,
  invalidates: ["exams"],
};
var EXTRACT_QUESTIONS_MODES = ["full", "single"];
var ExtractQuestionsRequestSchema = zObject({
  examId: zExamId,
  mode: z2.enum(EXTRACT_QUESTIONS_MODES).optional(),
  questionNumber: z2.string().optional(),
});
var ExtractQuestionsMetadataSchema = zObject({
  questionCount: z2.number().int(),
  tokensUsed: z2.number(),
  cost: z2.number(),
  extractedAt: z2.string(),
  imageQualityAcceptable: z2.boolean(),
  mode: z2.enum(EXTRACT_QUESTIONS_MODES).optional(),
});
var ExtractQuestionsResponseSchema = zObject({
  success: z2.boolean(),
  questions: z2.array(ExtractedQuestionSchema),
  warnings: z2.array(z2.string()),
  metadata: ExtractQuestionsMetadataSchema,
});
var extractQuestionsDef = {
  name: "v1.autograde.extractQuestions",
  module: "autograde",
  requestSchema: ExtractQuestionsRequestSchema,
  responseSchema: ExtractQuestionsResponseSchema,
  authMode: "authed",
  rateTier: "ai",
  idempotent: true,
  idempotencyKey: "transport",
  // ⚷ AI call + cost rollup + rubric-snapshot write are server-authoritative.
  authoritySensitive: true,
  invalidates: ["exams"],
};
var UploadAnswerSheetsRequestSchema = zObject({
  examId: zExamId,
  studentId: zStudentId,
  classId: zClassId,
  imageUrls: z2.array(z2.string()).min(1).max(50),
});
var UploadAnswerSheetsResponseSchema = zObject({
  submissionId: zSubmissionId,
});
var uploadAnswerSheetsDef = {
  name: "v1.autograde.uploadAnswerSheets",
  module: "autograde",
  requestSchema: UploadAnswerSheetsRequestSchema,
  responseSchema: UploadAnswerSheetsResponseSchema,
  authMode: "authed",
  rateTier: "ai",
  idempotent: true,
  // domain dedupe on (uid, examId, studentId) so a scanner retry never double-creates.
  idempotencyKey: "domain:examId+studentId",
  // ⚷ creates the Submission + advances exam→grading + counters (server authority).
  authoritySensitive: true,
  invalidates: ["submissions", "exams"],
};
var ManualBranchSchema = zObject({
  mode: z2.literal("manual"),
  submissionId: zSubmissionId,
  questionId: zExamQuestionId,
  score: z2.number(),
  feedback: z2.string().optional(),
});
var RetryBranchSchema = zObject({
  mode: z2.literal("retry"),
  submissionId: zSubmissionId,
  examId: zExamId.optional(),
  questionIds: z2.array(zExamQuestionId).optional(),
});
var AiBranchSchema = zObject({
  mode: z2.literal("ai"),
  submissionId: zSubmissionId,
  questionId: zExamQuestionId,
});
var GradeQuestionRequestSchema = z2.discriminatedUnion("mode", [
  ManualBranchSchema,
  RetryBranchSchema,
  AiBranchSchema,
]);
var GradeQuestionResponseSchema = zObject({
  success: z2.boolean(),
  updatedScore: z2.number().optional(),
  gradingStatus: zQuestionGradingStatus.optional(),
  retriedCount: z2.number().int().optional(),
});
var gradeQuestionDef = {
  name: "v1.autograde.gradeQuestion",
  module: "autograde",
  requestSchema: GradeQuestionRequestSchema,
  responseSchema: GradeQuestionResponseSchema,
  authMode: "authed",
  rateTier: "ai",
  // NOT idempotent (api-client-core §3.5 inventory): gradeQuestion (manual/retry/ai)
  // is a non-idempotent write — no UUIDv7 key on the wire, bypasses the offline
  // queue, and is never auto-retried.
  // ⚷ score authority — the client never writes its own score.
  authoritySensitive: true,
  invalidates: ["submissions"],
};
var ReleaseResultsRequestSchema = zObject({
  examId: zExamId,
  classIds: z2.array(zClassId).optional(),
});
var ReleaseResultsResponseSchema = zObject({
  id: zExamId,
  releasedCount: z2.number().int(),
  created: z2.literal(false),
});
var releaseResultsDef = {
  name: "v1.autograde.releaseResults",
  module: "autograde",
  requestSchema: ReleaseResultsRequestSchema,
  responseSchema: ReleaseResultsResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  // domain dedupe on examId so a double-tap release flips the gate once.
  idempotencyKey: "domain:examId",
  // ⚷ flips resultsReleased + exam status + outbox notification (server authority).
  authoritySensitive: true,
  invalidates: ["exams", "submissions"],
};
var SaveEvaluationSettingsDataSchema = zObject({
  name: z2.string().optional(),
  description: z2.string().optional(),
  isDefault: z2.boolean().optional(),
  isPublic: z2.boolean().optional(),
  enabledDimensions: z2.array(EvaluationDimensionSchema).optional(),
  displaySettings: EvaluationDisplaySettingsSchema.optional(),
  confidenceConfig: EvaluationConfidenceConfigSchema.optional(),
  usageQuota: UsageQuotaConfigSchema.optional(),
});
var SaveEvaluationSettingsRequestSchema = zObject({
  id: zEvaluationSettingsId.optional(),
  data: SaveEvaluationSettingsDataSchema,
});
var saveEvaluationSettingsDef = {
  name: "v1.autograde.saveEvaluationSettings",
  module: "autograde",
  requestSchema: SaveEvaluationSettingsRequestSchema,
  responseSchema: SaveEvaluationSettingsResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  // ⚷ confidence thresholds + promptGuidance are authoring-role-only secrets.
  authoritySensitive: true,
  invalidates: ["evaluationSettings"],
};
var RESOLVE_DEAD_LETTER_METHODS = ["retry", "manual_grade", "dismiss"];
var ResolveDeadLetterRequestSchema = zObject({
  entryId: zDeadLetterEntryId,
  method: z2.enum(RESOLVE_DEAD_LETTER_METHODS),
});
var ResolveDeadLetterResponseSchema = zObject({
  success: z2.boolean(),
  resolution: z2.enum(DEAD_LETTER_RESOLUTION_METHODS),
});
var resolveDeadLetterDef = {
  name: "v1.autograde.resolveDeadLetter",
  module: "autograde",
  requestSchema: ResolveDeadLetterRequestSchema,
  responseSchema: ResolveDeadLetterResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  // domain dedupe on entryId so re-resolving a resolved entry is a no-op.
  idempotencyKey: "domain:entryId",
  // ⚷ re-enqueues a grading step / marks DLQ resolved (submission.grade authority).
  authoritySensitive: true,
  invalidates: ["gradingDeadLetter", "submissions"],
};
var ListExamsFilterSchema = zObject({
  status: zExamStatus.optional(),
  classId: zClassId.optional(),
  academicSessionId: zAcademicSessionId.optional(),
  subject: z2.string().optional(),
  linkedSpaceId: zSpaceId.optional(),
});
var ListExamsRequestSchema = zObject({
  ...zPageParamsShape,
  filter: ListExamsFilterSchema.optional(),
});
var ListExamsResponseSchema = pageResponse(ExamListViewSchema);
var listExamsDef = {
  name: "v1.autograde.listExams",
  module: "autograde",
  requestSchema: ListExamsRequestSchema,
  responseSchema: ListExamsResponseSchema,
  authMode: "authed",
  rateTier: "read",
};
var GetExamRequestSchema = zObject({
  id: zExamId,
});
var GetExamResponseSchema = ExamDetailViewSchema;
var getExamDef = {
  name: "v1.autograde.getExam",
  module: "autograde",
  requestSchema: GetExamRequestSchema,
  responseSchema: GetExamResponseSchema,
  authMode: "authed",
  rateTier: "read",
};
var ListQuestionsRequestSchema = zObject({
  examId: zExamId,
});
var ListQuestionsResponseSchema = zObject({
  questions: z2.array(ExamQuestionViewSchema),
});
var listQuestionsDef = {
  name: "v1.autograde.listQuestions",
  module: "autograde",
  requestSchema: ListQuestionsRequestSchema,
  responseSchema: ListQuestionsResponseSchema,
  authMode: "authed",
  rateTier: "read",
};
var ListSubmissionsFilterSchema = zObject({
  examId: zExamId,
  classId: zClassId.optional(),
  studentId: zStudentId.optional(),
  pipelineStatus: zSubmissionPipelineStatus.optional(),
  uploadedBy: zUserId.optional(),
  resultsReleasedOnly: z2.boolean().optional(),
});
var ListSubmissionsRequestSchema = zObject({
  ...zPageParamsShape,
  filter: ListSubmissionsFilterSchema,
});
var ListSubmissionsResponseSchema = pageResponse(SubmissionListViewSchema);
var listSubmissionsDef = {
  name: "v1.autograde.listSubmissions",
  module: "autograde",
  requestSchema: ListSubmissionsRequestSchema,
  responseSchema: ListSubmissionsResponseSchema,
  authMode: "authed",
  rateTier: "read",
};
var GetSubmissionRequestSchema = zObject({
  id: zSubmissionId,
});
var GetSubmissionResponseSchema = SubmissionDetailViewSchema;
var getSubmissionDef = {
  name: "v1.autograde.getSubmission",
  module: "autograde",
  requestSchema: GetSubmissionRequestSchema,
  responseSchema: GetSubmissionResponseSchema,
  authMode: "authed",
  rateTier: "read",
};
var ListQuestionSubmissionsRequestSchema = zObject({
  submissionId: zSubmissionId,
});
var ListQuestionSubmissionsResponseSchema = zObject({
  questionSubmissions: z2.array(QuestionSubmissionViewSchema),
});
var listQuestionSubmissionsDef = {
  name: "v1.autograde.listQuestionSubmissions",
  module: "autograde",
  requestSchema: ListQuestionSubmissionsRequestSchema,
  responseSchema: ListQuestionSubmissionsResponseSchema,
  authMode: "authed",
  rateTier: "read",
};
var GetExamAnalyticsRequestSchema = zObject({
  examId: zExamId,
});
var GetExamAnalyticsResponseSchema = ExamAnalyticsViewSchema;
var getExamAnalyticsDef = {
  name: "v1.autograde.getExamAnalytics",
  module: "autograde",
  requestSchema: GetExamAnalyticsRequestSchema,
  responseSchema: GetExamAnalyticsResponseSchema,
  authMode: "authed",
  rateTier: "read",
};
var ListEvaluationSettingsRequestSchema = zObject({
  includePublic: z2.boolean().optional(),
});
var ListEvaluationSettingsResponseSchema = zObject({
  settings: z2.array(EvaluationSettingsViewSchema),
});
var listEvaluationSettingsDef = {
  name: "v1.autograde.listEvaluationSettings",
  module: "autograde",
  requestSchema: ListEvaluationSettingsRequestSchema,
  responseSchema: ListEvaluationSettingsResponseSchema,
  authMode: "authed",
  rateTier: "read",
};
var ListDeadLetterFilterSchema = zObject({
  resolved: z2.boolean().optional(),
  pipelineStep: z2.enum(GRADING_PIPELINE_STEPS).optional(),
});
var ListDeadLetterRequestSchema = zObject({
  ...zPageParamsShape,
  filter: ListDeadLetterFilterSchema.optional(),
});
var ListDeadLetterResponseSchema = pageResponse(DeadLetterViewSchema);
var listDeadLetterDef = {
  name: "v1.autograde.listDeadLetter",
  module: "autograde",
  requestSchema: ListDeadLetterRequestSchema,
  responseSchema: ListDeadLetterResponseSchema,
  authMode: "authed",
  rateTier: "read",
};
var AUTOGRADE_CALLABLES = {
  "v1.autograde.saveExam": saveExamDef,
  "v1.autograde.extractQuestions": extractQuestionsDef,
  "v1.autograde.uploadAnswerSheets": uploadAnswerSheetsDef,
  "v1.autograde.gradeQuestion": gradeQuestionDef,
  "v1.autograde.releaseResults": releaseResultsDef,
  "v1.autograde.saveEvaluationSettings": saveEvaluationSettingsDef,
  "v1.autograde.resolveDeadLetter": resolveDeadLetterDef,
  "v1.autograde.listExams": listExamsDef,
  "v1.autograde.getExam": getExamDef,
  "v1.autograde.listQuestions": listQuestionsDef,
  "v1.autograde.listSubmissions": listSubmissionsDef,
  "v1.autograde.getSubmission": getSubmissionDef,
  "v1.autograde.listQuestionSubmissions": listQuestionSubmissionsDef,
  "v1.autograde.getExamAnalytics": getExamAnalyticsDef,
  "v1.autograde.listEvaluationSettings": listEvaluationSettingsDef,
  "v1.autograde.listDeadLetter": listDeadLetterDef,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
};
var RequestUploadUrlRequestSchema = z2
  .object({
    kind: z2.enum(["answer-sheet", "question-paper"]),
    examId: z2.string(),
    studentId: z2.string().optional(),
    classId: z2.string().optional(),
    contentType: z2.string(),
  })
  .strict();
var RequestUploadUrlResponseSchema = z2
  .object({ uploadUrl: z2.string(), path: z2.string(), expiresAt: z2.string() })
  .strict();
var requestUploadUrlDef = defineCallable({
  name: "v1.autograde.requestUploadUrl",
  module: "autograde",
  requestSchema: RequestUploadUrlRequestSchema,
  responseSchema: RequestUploadUrlResponseSchema,
  authMode: "authed",
  rateTier: "write",
  // No cache invalidation: a signed URL is a transient grant, never persisted state.
});
var GetSubmissionForExamRequestSchema = z2
  .object({ examId: z2.string(), studentId: z2.string() })
  .strict();
var GetSubmissionForExamResponseSchema = SubmissionSchema.nullable();
var getSubmissionForExamDef = defineCallable({
  name: "v1.autograde.getSubmissionForExam",
  module: "autograde",
  requestSchema: GetSubmissionForExamRequestSchema,
  responseSchema: GetSubmissionForExamResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var AUTOGRADE_FOLD_CALLABLES = {
  "v1.autograde.requestUploadUrl": requestUploadUrlDef,
  "v1.autograde.getSubmissionForExam": getSubmissionForExamDef,
};
var PerformanceTrendPointSchema = zObject({
  periodStart: zTimestamp,
  periodEnd: zTimestamp,
  avgPercentage: z2.number(),
  examCount: z2.number().int(),
  completionPct: z2.number(),
  overallScore: z2.number(),
});
var TREND_GRANULARITIES = ["week", "month", "term"];
var zTrendGranularity = z2.enum(TREND_GRANULARITIES);
var TimeRangeSchema = zObject({
  from: zTimestamp,
  to: zTimestamp,
});
var PerClassRollupRowSchema = zObject({
  classId: zClassId,
  name: z2.string(),
  avg: z2.number(),
  atRisk: z2.number().int(),
});
var TenantRollupSchema = zObject({
  academyAvg: z2.number(),
  perClass: z2.array(PerClassRollupRowSchema),
});
var MasteryDistributionSchema = zObject({
  notStarted: z2.number().int(),
  inProgress: z2.number().int(),
  mastered: z2.number().int(),
});
var ClassSummaryViewSchema = zObject({
  ...ClassProgressSummarySchema.shape,
  tenantRollup: TenantRollupSchema,
  masteryDistribution: MasteryDistributionSchema,
});
var PlatformKpisSchema = zObject({
  tenantCount: z2.number().int(),
  userCount: z2.number().int(),
  examCount: z2.number().int(),
  activeTenantCount: z2.number().int(),
});
var GrowthSeriesPointSchema = zObject({
  date: zTimestamp,
  tenants: z2.number().int(),
  users: z2.number().int(),
});
var TopTenantRowSchema = zObject({
  tenantId: zTenantId,
  name: z2.string(),
  users: z2.number().int(),
  exams: z2.number().int(),
});
var TenantComparisonRowSchema = zObject({
  tenantId: zTenantId,
  name: z2.string(),
  users: z2.number().int(),
  exams: z2.number().int(),
  growthPct: z2.number(),
});
var PlatformSummarySchema = zObject({
  kpis: PlatformKpisSchema,
  growthSeries: z2.array(GrowthSeriesPointSchema),
  planDistribution: z2.record(z2.string(), z2.number().int()),
  topTenants: z2.array(TopTenantRowSchema),
  tenantComparison: z2.array(TenantComparisonRowSchema),
});
var HealthSummarySchema = zObject({
  snapshot: HealthSnapshotSchema,
});
var PARENT_ALERT_KINDS = ["at_risk", "low_score", "low_streak"];
var zParentAlertKind = z2.enum(PARENT_ALERT_KINDS);
var ParentAlertSchema = zObject({
  studentId: zStudentId,
  name: z2.string(),
  kind: zParentAlertKind,
  detail: z2.string(),
  createdAt: zTimestamp,
});
var LinkedChildRowSchema = zObject({
  studentId: zStudentId,
  name: z2.string(),
  classNames: z2.array(z2.string()),
  overallScore: z2.number(),
  isAtRisk: z2.boolean(),
  atRiskReasons: z2.array(zAtRiskReason).default([]),
});
var ASSIGNMENT_MATRIX_STATUSES = ["not_started", "in_progress", "completed", "overdue"];
var zAssignmentMatrixStatus = z2.enum(ASSIGNMENT_MATRIX_STATUSES);
var AssignmentMatrixCellSchema = zObject({
  studentId: zStudentId,
  status: zAssignmentMatrixStatus,
  completionPct: z2.number(),
});
var AssignmentMatrixRowSchema = zObject({
  contentId: z2.string(),
  contentTitle: z2.string(),
  contentType: z2.enum(["space", "exam"]),
  dueAt: zTimestamp.nullable(),
  cells: z2.array(AssignmentMatrixCellSchema),
});
var AssignmentMatrixSchema = zObject({
  classId: zClassId,
  students: z2.array(zObject({ studentId: zStudentId, name: z2.string() })),
  rows: z2.array(AssignmentMatrixRowSchema),
});
var GetSummaryRequestSchema = z2.discriminatedUnion("scope", [
  zObject({ scope: z2.literal("student"), studentId: zStudentId.optional() }),
  zObject({ scope: z2.literal("class"), classId: zClassId.optional() }),
  zObject({ scope: z2.literal("platform") }),
  zObject({ scope: z2.literal("health") }),
]);
var GetSummaryResponseSchema = z2.discriminatedUnion("scope", [
  zObject({ scope: z2.literal("student"), studentSummary: StudentProgressSummarySchema }),
  zObject({ scope: z2.literal("class"), classSummary: ClassSummaryViewSchema }),
  zObject({ scope: z2.literal("platform"), platformSummary: PlatformSummarySchema }),
  zObject({ scope: z2.literal("health"), healthSummary: HealthSummarySchema }),
]);
var getSummary = defineCallable({
  name: "v1.analytics.getSummary",
  module: "analytics",
  requestSchema: GetSummaryRequestSchema,
  responseSchema: GetSummaryResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var GenerateReportRequestSchema = zObject({
  type: z2.enum(["exam-result", "progress", "class"]),
  examId: zExamId.optional(),
  studentId: zStudentId.optional(),
  classId: zClassId.optional(),
});
var GenerateReportResponseSchema = zObject({
  pdfUrl: z2.string(),
  expiresAt: zTimestamp,
});
var generateReport = defineCallable({
  name: "v1.analytics.generateReport",
  module: "analytics",
  requestSchema: GenerateReportRequestSchema,
  responseSchema: GenerateReportResponseSchema,
  authMode: "authed",
  rateTier: "report",
  idempotent: true,
});
var GetExamAnalyticsRequestSchema2 = zObject({
  examId: zExamId,
});
var GetExamAnalyticsResponseSchema2 = ExamAnalyticsSchema;
var getExamAnalytics = defineCallable({
  name: "v1.analytics.getExamAnalytics",
  module: "analytics",
  requestSchema: GetExamAnalyticsRequestSchema2,
  responseSchema: GetExamAnalyticsResponseSchema2,
  authMode: "authed",
  rateTier: "read",
});
var ListInsightsRequestSchema = zObject({
  studentId: zStudentId,
  includeDismissed: z2.boolean().optional(),
  ...PageRequest.shape,
});
var ListInsightsResponseSchema = pageResponse(LearningInsightSchema);
var listInsights = defineCallable({
  name: "v1.analytics.listInsights",
  module: "analytics",
  requestSchema: ListInsightsRequestSchema,
  responseSchema: ListInsightsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var DismissInsightRequestSchema2 = zObject({
  insightId: zInsightId,
});
var DismissInsightResponseSchema2 = zObject({
  id: zInsightId,
  dismissedAt: zTimestamp,
});
var dismissInsight = defineCallable({
  name: "v1.analytics.dismissInsight",
  module: "analytics",
  requestSchema: DismissInsightRequestSchema2,
  responseSchema: DismissInsightResponseSchema2,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  invalidates: ["insights"],
});
var GetPerformanceTrendsRequestSchema = zObject({
  subjectId: z2.string().optional(),
  studentId: zStudentId.optional(),
  classId: zClassId.optional(),
  granularity: zTrendGranularity,
  range: TimeRangeSchema.optional(),
});
var GetPerformanceTrendsResponseSchema = zObject({
  points: z2.array(PerformanceTrendPointSchema),
});
var getPerformanceTrends = defineCallable({
  name: "v1.analytics.getPerformanceTrends",
  module: "analytics",
  requestSchema: GetPerformanceTrendsRequestSchema,
  responseSchema: GetPerformanceTrendsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var GetChildSummaryRequestSchema = zObject({
  studentId: zStudentId,
});
var GetChildSummaryResponseSchema = zObject({
  studentSummary: StudentProgressSummarySchema,
  recentInsights: z2.array(LearningInsightSchema),
});
var getChildSummary = defineCallable({
  name: "v1.analytics.getChildSummary",
  module: "analytics",
  requestSchema: GetChildSummaryRequestSchema,
  responseSchema: GetChildSummaryResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var ListLinkedChildrenRequestSchema = PageRequest;
var ListLinkedChildrenResponseSchema = pageResponse(LinkedChildRowSchema);
var listLinkedChildren = defineCallable({
  name: "v1.analytics.listLinkedChildren",
  module: "analytics",
  requestSchema: ListLinkedChildrenRequestSchema,
  responseSchema: ListLinkedChildrenResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var GetCostSummaryRequestSchema = zObject({
  granularity: zCostSummaryGranularity,
  // exact-day (daily) selector
  date: zIsoDate.optional(),
  // exact-month (monthly) selector, YYYY-MM
  month: z2
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  range: TimeRangeSchema.optional(),
});
var GetCostSummaryResponseSchema = zObject({
  summaries: z2.array(z2.union([DailyCostSummarySchema, MonthlyCostSummarySchema])),
});
var getCostSummary = defineCallable({
  name: "v1.analytics.getCostSummary",
  module: "analytics",
  requestSchema: GetCostSummaryRequestSchema,
  responseSchema: GetCostSummaryResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var LEADERBOARD_SCOPES2 = ["tenant", "space", "storyPoint"];
var zLeaderboardScope2 = z2.enum(LEADERBOARD_SCOPES2);
var GetLeaderboardRequestSchema2 = zObject({
  scope: zLeaderboardScope2,
  spaceId: zSpaceId.optional(),
  storyPointId: zStoryPointId.optional(),
  limit: z2.number().int().min(1).max(100).optional(),
});
var GetLeaderboardResponseSchema2 = zObject({
  entries: z2.array(LeaderboardEntrySchema),
  myEntry: LeaderboardEntrySchema.optional(),
});
var getLeaderboard = defineCallable({
  name: "v1.analytics.getLeaderboard",
  module: "analytics",
  requestSchema: GetLeaderboardRequestSchema2,
  responseSchema: GetLeaderboardResponseSchema2,
  authMode: "authed",
  rateTier: "read",
});
var ListParentAlertsRequestSchema = PageRequest;
var ListParentAlertsResponseSchema = pageResponse(ParentAlertSchema);
var listParentAlerts = defineCallable({
  name: "v1.analytics.listParentAlerts",
  module: "analytics",
  requestSchema: ListParentAlertsRequestSchema,
  responseSchema: ListParentAlertsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var ListPlatformActivityRequestSchema = zObject({
  action: zPlatformActivityAction.optional(),
  tenantOverride: zTenantId.optional(),
  ...PageRequest.shape,
});
var ListPlatformActivityResponseSchema = pageResponse(PlatformActivityLogSchema);
var listPlatformActivity = defineCallable({
  name: "v1.analytics.listPlatformActivity",
  module: "analytics",
  requestSchema: ListPlatformActivityRequestSchema,
  responseSchema: ListPlatformActivityResponseSchema,
  authMode: "authed",
  rateTier: "read",
  allowsTenantOverride: true,
});
var GetAssignmentMatrixRequestSchema = zObject({
  classId: zClassId,
});
var GetAssignmentMatrixResponseSchema = AssignmentMatrixSchema;
var getAssignmentMatrix = defineCallable({
  name: "v1.analytics.getAssignmentMatrix",
  module: "analytics",
  requestSchema: GetAssignmentMatrixRequestSchema,
  responseSchema: GetAssignmentMatrixResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
var ANALYTICS_CALLABLES = {
  "v1.analytics.getSummary": getSummary,
  "v1.analytics.generateReport": generateReport,
  "v1.analytics.getExamAnalytics": getExamAnalytics,
  "v1.analytics.listInsights": listInsights,
  "v1.analytics.dismissInsight": dismissInsight,
  "v1.analytics.getPerformanceTrends": getPerformanceTrends,
  "v1.analytics.getChildSummary": getChildSummary,
  "v1.analytics.listLinkedChildren": listLinkedChildren,
  "v1.analytics.getCostSummary": getCostSummary,
  "v1.analytics.getLeaderboard": getLeaderboard,
  "v1.analytics.listParentAlerts": listParentAlerts,
  "v1.analytics.listPlatformActivity": listPlatformActivity,
  "v1.analytics.getAssignmentMatrix": getAssignmentMatrix,
};
var CALLABLES = {
  ...IDENTITY_CALLABLES,
  ...LEVELUP_CONTENT_CALLABLES,
  ...GAMIFICATION_CALLABLES,
  ...AUTOGRADE_CALLABLES,
  ...AUTOGRADE_FOLD_CALLABLES,
  ...ANALYTICS_CALLABLES,
};
var CALLABLE_NAMES = Object.keys(CALLABLES);
var AUTHORITY_CALLABLES = Object.freeze(
  Object.values(CALLABLES)
    .filter((d) => d.authoritySensitive)
    .map((d) => d.name)
);
var DOMAIN_NAMES = [
  // identity
  "me",
  "tenants",
  "students",
  "teachers",
  "parents",
  "staff",
  "classes",
  "sessions",
  "announcements",
  "notifications",
  "notificationBadge",
  "userSearch",
  "preset",
  "platformConfig",
  "notificationPreferences",
  "device",
  "message",
  "exportJob",
  "memberships",
  "claims",
  "academicSessions",
  // levelup (content + testsession + gamification)
  "spaces",
  "storyPoints",
  "items",
  "versions",
  "questionBank",
  "rubricPresets",
  "agents",
  "chat",
  "store",
  "reviews",
  "enrollment",
  "enrollments",
  "progress",
  "testSessions",
  "insights",
  "leaderboard",
  "gamification",
  "achievements",
  "levels",
  "studyGoals",
  "studySessions",
  "studentSummary",
  "assignment",
  "aiGeneration",
  "storage",
  // autograde
  "exams",
  "questions",
  "submissions",
  "questionSubmissions",
  "evalSettings",
  "evaluationSettings",
  "deadLetter",
  "gradingDeadLetter",
  "examAnalytics",
  "gradingReview",
  // analytics
  "summary",
  "trends",
  "cost",
  "analytics",
  "parentAlert",
  "platformActivity",
];
var DOMAIN_NAME_SET = new Set(DOMAIN_NAMES);
var INVALIDATION_GRAPH = Object.freeze(
  Object.fromEntries(
    Object.values(CALLABLES)
      .filter((d) => d.invalidates && d.invalidates.length > 0)
      .map((d) => {
        const roots = (d.invalidates ?? []).filter((r) => DOMAIN_NAME_SET.has(r));
        return [d.name, { roots }];
      })
  )
);
var APP_ERROR_CODES = [
  "VALIDATION_ERROR",
  "INVALID_TRANSITION",
  "NOT_FOUND",
  "PERMISSION_DENIED",
  "UNAUTHENTICATED",
  "RATE_LIMITED",
  "QUOTA_EXCEEDED",
  "FEATURE_DISABLED",
  "TENANT_SUSPENDED",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "IDEMPOTENCY_CONFLICT",
  "PAYMENT_FAILED",
  "INTERNAL_ERROR",
];
var DEFAULT_RETRYABLE = {
  VALIDATION_ERROR: false,
  INVALID_TRANSITION: false,
  NOT_FOUND: false,
  PERMISSION_DENIED: false,
  UNAUTHENTICATED: false,
  RATE_LIMITED: true,
  QUOTA_EXCEEDED: false,
  FEATURE_DISABLED: false,
  TENANT_SUSPENDED: false,
  CONFLICT: true,
  PRECONDITION_FAILED: false,
  IDEMPOTENCY_CONFLICT: true,
  PAYMENT_FAILED: false,
  INTERNAL_ERROR: true,
};
var ApiErrorDetailsSchema = z2
  .object({
    code: z2.enum(APP_ERROR_CODES),
    message: z2.string(),
    validationErrors: z2.array(z2.object({ path: z2.string(), message: z2.string() })).optional(),
    retryable: z2.boolean().optional(),
    meta: z2.record(z2.string(), z2.any()).optional(),
  })
  .strict();
var APP_ERROR_TO_HTTPS = {
  VALIDATION_ERROR: "invalid-argument",
  INVALID_TRANSITION: "failed-precondition",
  NOT_FOUND: "not-found",
  PERMISSION_DENIED: "permission-denied",
  UNAUTHENTICATED: "unauthenticated",
  RATE_LIMITED: "resource-exhausted",
  QUOTA_EXCEEDED: "resource-exhausted",
  FEATURE_DISABLED: "failed-precondition",
  TENANT_SUSPENDED: "failed-precondition",
  CONFLICT: "already-exists",
  PRECONDITION_FAILED: "failed-precondition",
  IDEMPOTENCY_CONFLICT: "already-exists",
  PAYMENT_FAILED: "failed-precondition",
  INTERNAL_ERROR: "internal",
};
var ERROR_MESSAGES = {
  VALIDATION_ERROR: "The request contains invalid data.",
  INVALID_TRANSITION: "That action is not allowed from the current state.",
  NOT_FOUND: "The requested resource was not found.",
  PERMISSION_DENIED: "You do not have permission to perform this action.",
  UNAUTHENTICATED: "You must be signed in to perform this action.",
  RATE_LIMITED: "Too many requests. Please try again in a moment.",
  QUOTA_EXCEEDED: "You have exceeded your usage quota.",
  FEATURE_DISABLED: "This feature is not enabled for your organization.",
  TENANT_SUSPENDED: "Your organization account is currently suspended.",
  CONFLICT: "This resource was modified elsewhere. Refresh and retry.",
  PRECONDITION_FAILED: "The operation cannot be performed in the current state.",
  IDEMPOTENCY_CONFLICT: "A conflicting request with the same key is already in progress.",
  PAYMENT_FAILED: "The payment could not be completed.",
  INTERNAL_ERROR: "An unexpected error occurred. Please try again.",
};
function defineSubscription(def2) {
  return def2;
}
var TestSessionLiveSchema = zObject({
  /** Server-computed milliseconds remaining; clamped to 0 at/after the deadline. */
  remainingMs: z2.number().int().min(0),
  /** Authoritative deadline as an ISO-8601 string (the client never owns the clock). */
  serverDeadline: z2.string(),
  status: zTestSessionStatus,
});
var TestSessionDeadlineParamsSchema = zObject({ sessionId: z2.string() });
var testSessionDeadline = defineSubscription({
  name: "v1.levelup.testSessionDeadline",
  module: "levelup",
  source: "firestore-doc",
  params: TestSessionDeadlineParamsSchema,
  payload: TestSessionLiveSchema,
});
var ChatStreamParamsSchema = zObject({ sessionId: z2.string() });
var chatStream = defineSubscription({
  name: "v1.levelup.chatStream",
  module: "levelup",
  source: "firestore-query",
  params: ChatStreamParamsSchema,
  payload: ChatMessageSchema,
});
var StoryPointProgressLiveSchema = zObject({
  storyPointId: z2.string(),
  status: zProgressStatus,
  pointsEarned: z2.number(),
  totalPoints: z2.number(),
  percentage: z2.number(),
  completedItems: z2.number().int(),
  totalItems: z2.number().int(),
});
var SpaceProgressLiveSchema = zObject({
  spaceId: z2.string(),
  userId: z2.string(),
  status: zProgressStatus,
  pointsEarned: z2.number(),
  totalPoints: z2.number(),
  percentage: z2.number(),
  storyPoints: z2.record(z2.string(), StoryPointProgressLiveSchema),
  updatedAt: z2.string(),
});
var SpaceProgressLiveParamsSchema = zObject({
  spaceId: z2.string(),
  userId: z2.string(),
});
var spaceProgressLive = defineSubscription({
  name: "v1.levelup.spaceProgressLive",
  module: "levelup",
  source: "firestore-doc",
  params: SpaceProgressLiveParamsSchema,
  payload: SpaceProgressLiveSchema,
});
var LeaderboardSnapshotSchema = zObject({
  entries: z2.array(LeaderboardEntrySchema),
  callerRank: z2.number().int().nullable(),
});
var LeaderboardLiveParamsSchema = zObject({
  scope: z2.enum(["tenant", "class", "space", "storyPoint"]),
  spaceId: z2.string().optional(),
  storyPointId: z2.string().optional(),
  limit: z2.number().int().min(1).max(100).default(50),
});
var leaderboardLive = defineSubscription({
  name: "v1.levelup.leaderboardLive",
  module: "analytics",
  source: "rtdb-node",
  params: LeaderboardLiveParamsSchema,
  payload: LeaderboardSnapshotSchema,
});
var StudentLevelLiveParamsSchema = zObject({});
var studentLevelLive = defineSubscription({
  name: "v1.levelup.studentLevelLive",
  module: "levelup",
  source: "firestore-doc",
  params: StudentLevelLiveParamsSchema,
  payload: StudentLevelSchema,
});
var AchievementUnlockSchema = StudentAchievementSchema;
var AchievementUnlockParamsSchema = zObject({});
var achievementUnlock = defineSubscription({
  name: "v1.levelup.achievementUnlock",
  module: "levelup",
  source: "firestore-query",
  params: AchievementUnlockParamsSchema,
  payload: AchievementUnlockSchema,
});
var SubmissionStatusSchema = zObject({
  pipelineStatus: zSubmissionPipelineStatus,
  gradingProgress: GradingProgressSchema.optional(),
  updatedAt: z2.string(),
});
var GradingStatusParamsSchema = zObject({ submissionId: z2.string() });
var gradingStatus = defineSubscription({
  name: "v1.autograde.gradingStatus",
  module: "autograde",
  source: "firestore-doc",
  params: GradingStatusParamsSchema,
  payload: SubmissionStatusSchema,
});
var ExamGradingProgressSchema = zObject({
  examId: z2.string(),
  totalSubmissions: z2.number().int().min(0),
  gradedSubmissions: z2.number().int().min(0),
  failedSubmissions: z2.number().int().min(0),
  pendingSubmissions: z2.number().int().min(0),
  /** Coarse exam-wide phase (reuses the per-submission pipeline vocabulary). */
  phase: zSubmissionPipelineStatus.optional(),
  updatedAt: z2.string(),
});
var ExamGradingParamsSchema = zObject({ examId: z2.string() });
var examGrading = defineSubscription({
  name: "v1.autograde.examGrading",
  module: "autograde",
  source: "firestore-doc",
  params: ExamGradingParamsSchema,
  payload: ExamGradingProgressSchema,
});
var NotificationStateSchema = NotificationBadgeStateSchema;
var NotificationBadgeParamsSchema = zObject({});
var notificationBadge = defineSubscription({
  name: "v1.notification.badge",
  module: "identity",
  source: "rtdb-node",
  params: NotificationBadgeParamsSchema,
  payload: NotificationStateSchema,
});
var SUBSCRIPTION_DEFS = {
  "v1.levelup.testSessionDeadline": testSessionDeadline,
  "v1.levelup.chatStream": chatStream,
  "v1.levelup.spaceProgressLive": spaceProgressLive,
  "v1.levelup.leaderboardLive": leaderboardLive,
  "v1.levelup.studentLevelLive": studentLevelLive,
  "v1.levelup.achievementUnlock": achievementUnlock,
  "v1.autograde.gradingStatus": gradingStatus,
  "v1.autograde.examGrading": examGrading,
  "v1.notification.badge": notificationBadge,
};
var SUBSCRIPTIONS = {
  ...SUBSCRIPTION_DEFS,
};
var SUBSCRIPTION_NAMES = Object.keys(SUBSCRIPTIONS);

// ../../packages/access/dist/index.js
var AccessError = class _AccessError extends Error {
  constructor(code, message, meta) {
    super(message);
    this.name = "AccessError";
    this.code = code;
    this.meta = meta;
    Object.setPrototypeOf(this, _AccessError.prototype);
  }
};
function isAccessError(e) {
  return (
    e instanceof AccessError || (e instanceof Error && e.name === "AccessError" && "code" in e)
  );
}
function denied(message, meta) {
  throw new AccessError("PERMISSION_DENIED", message, meta);
}
function invalidTransition(message, meta) {
  throw new AccessError("INVALID_TRANSITION", message, meta);
}
var AUTHORING = ["teacher", "tenantAdmin", "staff"];
var STAFFISH = ["staff", "tenantAdmin"];
var TEACHERISH = ["teacher", "tenantAdmin", "staff"];
var STUDENT_ONLY = ["student"];
var PARENT_ONLY = ["parent"];
var SCANNERISH = ["scanner", "teacher", "tenantAdmin", "staff"];
var ACCESS_RULES = {
  // ---------------- identity ----------------
  "tenant.create": { roles: "super-admin-only", tenantScoped: false },
  "tenant.lifecycle": { roles: ["tenantAdmin"], tenantScoped: true },
  "tenant.export": { roles: ["tenantAdmin"], tenantScoped: true },
  "tenant.asset.upload": { roles: ["tenantAdmin", "staff"], tenantScoped: true },
  "user.create": { roles: STAFFISH, staffPermission: "canManageUsers", tenantScoped: true },
  "user.update": { roles: STAFFISH, staffPermission: "canManageUsers", tenantScoped: true },
  "user.bulkImport": { roles: STAFFISH, staffPermission: "canImportData", tenantScoped: true },
  "user.bulkStatus": { roles: STAFFISH, staffPermission: "canManageUsers", tenantScoped: true },
  "membership.write": { roles: STAFFISH, staffPermission: "canManageUsers", tenantScoped: true },
  "claims.sync": { roles: STAFFISH, tenantScoped: true },
  "tenant.switch": { roles: "any-authed", tenantScoped: false },
  "tenant.join": { roles: "any-authed", tenantScoped: false },
  "class.write": { roles: STAFFISH, staffPermission: "canManageClasses", tenantScoped: true },
  "session.write": { roles: STAFFISH, tenantScoped: true },
  "session.rollover": { roles: ["tenantAdmin", "staff"], tenantScoped: true },
  "announcement.write": {
    roles: STAFFISH,
    staffPermission: "canManageAnnouncements",
    tenantScoped: true,
  },
  "notification.read": { roles: "any-authed", tenantScoped: true, ownershipCheck: "self" },
  "notification.markRead": { roles: "any-authed", tenantScoped: true, ownershipCheck: "self" },
  // Roster reads (list/get students/teachers/parents/staff/classes) — any signed-in
  // member of the tenant; tenant-scoped so a forged cross-tenant target is denied.
  "roster.read": { roles: "any-authed", tenantScoped: true },
  "user.search": { roles: "super-admin-only", tenantScoped: false },
  "preset.global.write": { roles: "super-admin-only", tenantScoped: false },
  "user.impersonate.start": { roles: "super-admin-only", tenantScoped: false },
  "user.impersonate.end": { roles: "any-authed", tenantScoped: false },
  // ---------------- levelup ----------------
  "space.read": { roles: "any-authed", tenantScoped: true },
  "space.write": { roles: TEACHERISH, permission: "canManageSpaces", tenantScoped: true },
  "space.publish": { roles: TEACHERISH, permission: "canManageSpaces", tenantScoped: true },
  "space.archive": { roles: TEACHERISH, permission: "canManageSpaces", tenantScoped: true },
  "storyPoint.write": { roles: TEACHERISH, permission: "canManageContent", tenantScoped: true },
  "item.write": { roles: TEACHERISH, permission: "canManageContent", tenantScoped: true },
  "item.readForEdit": { roles: AUTHORING, tenantScoped: true },
  "version.list": { roles: AUTHORING, tenantScoped: true },
  "questionBank.write": { roles: TEACHERISH, permission: "canManageContent", tenantScoped: true },
  "questionBank.read": { roles: AUTHORING, tenantScoped: true },
  "questionBank.import": { roles: TEACHERISH, permission: "canManageContent", tenantScoped: true },
  "rubricPreset.write": { roles: TEACHERISH, permission: "canManageContent", tenantScoped: true },
  "testSession.start": { roles: STUDENT_ONLY, tenantScoped: true },
  "testSession.submit": { roles: STUDENT_ONLY, tenantScoped: true, ownershipCheck: "self" },
  "answer.evaluate": { roles: STUDENT_ONLY, tenantScoped: true, ownershipCheck: "self" },
  "itemAttempt.record": { roles: STUDENT_ONLY, tenantScoped: true, ownershipCheck: "self" },
  "chat.send": { roles: STUDENT_ONLY, tenantScoped: true, ownershipCheck: "self" },
  "progress.read": { roles: "any-authed", tenantScoped: true },
  "store.list": { roles: "any-authed", tenantScoped: true },
  "store.review": { roles: STUDENT_ONLY, tenantScoped: true, ownershipCheck: "self" },
  "space.purchase": { roles: STUDENT_ONLY, tenantScoped: true, ownershipCheck: "self" },
  // ---------------- autograde ----------------
  "exam.read": { roles: "any-authed", tenantScoped: true },
  "exam.write": { roles: TEACHERISH, permission: "canCreateExams", tenantScoped: true },
  "exam.publish": { roles: TEACHERISH, permission: "canCreateExams", tenantScoped: true },
  "exam.results.release": {
    roles: TEACHERISH,
    permission: "canReleaseResults",
    tenantScoped: true,
  },
  "questions.extract": { roles: TEACHERISH, permission: "canCreateExams", tenantScoped: true },
  "answerSheets.upload": { roles: SCANNERISH, tenantScoped: true },
  "grade.manual": { roles: TEACHERISH, permission: "canGradeExams", tenantScoped: true },
  "grade.retry": { roles: TEACHERISH, permission: "canGradeExams", tenantScoped: true },
  "grade.ai": { roles: TEACHERISH, permission: "canGradeExams", tenantScoped: true },
  "submission.read": { roles: TEACHERISH, tenantScoped: true },
  "submission.readReleased": { roles: "any-authed", tenantScoped: true },
  // ---------------- analytics ----------------
  "summary.read": { roles: "any-authed", tenantScoped: true },
  "report.generate": { roles: TEACHERISH, permission: "canViewAnalytics", tenantScoped: true },
  "analytics.child.read": {
    roles: PARENT_ONLY,
    tenantScoped: true,
    ownershipCheck: "linked-child",
  },
  "analytics.trends.read": { roles: "any-authed", tenantScoped: true },
  "child.read": { roles: PARENT_ONLY, tenantScoped: true, ownershipCheck: "linked-child" },
  // ---------------- rubric guidance leak gate ----------------
  "rubric.guidance.read": { roles: AUTHORING, tenantScoped: true },
};
function isRealSuperAdmin(ctx) {
  return ctx.isSuperAdmin === true && ctx.uid !== "<system>" && ctx.impersonating !== true;
}
function isSystemActor(ctx) {
  return ctx.uid === "<system>" && ctx.isSuperAdmin === true;
}
function roleAllowed(rule, ctx) {
  if (rule.roles === "public") return true;
  if (rule.roles === "any-authed") return Boolean(ctx.uid);
  if (rule.roles === "super-admin-only") return isRealSuperAdmin(ctx);
  if (ctx.role === null) return false;
  return rule.roles.includes(ctx.role);
}
function permissionAllowed(rule, ctx) {
  if (rule.permission) {
    const map = ctx.permissions;
    if (
      map &&
      Object.prototype.hasOwnProperty.call(map, rule.permission) &&
      map[rule.permission] === false
    ) {
      return false;
    }
  }
  if (rule.staffPermission) {
    const map = ctx.staffPermissions;
    if (
      map &&
      Object.prototype.hasOwnProperty.call(map, rule.staffPermission) &&
      map[rule.staffPermission] === false
    ) {
      return false;
    }
  }
  return true;
}
function ownershipAllowed(rule, ctx, resource) {
  switch (rule.ownershipCheck) {
    case void 0:
      return true;
    case "self":
      if (!resource?.ownerUid) return true;
      return String(resource.ownerUid) === String(ctx.uid);
    case "class-member": {
      if (!resource?.classId) return true;
      return ctx.classIds.map(String).includes(String(resource.classId));
    }
    case "linked-child": {
      if (!resource?.studentId) return false;
      return ctx.studentIds.map(String).includes(String(resource.studentId));
    }
    case "space-enrolled":
      return true;
  }
}
function tenantScopeOk(rule, ctx, resource) {
  if (!rule.tenantScoped) return true;
  if (resource?.tenantId == null) return true;
  return String(resource.tenantId) === String(ctx.tenantId ?? "");
}
function authorize(ctx, action, resource) {
  const rule = ACCESS_RULES[action];
  if (!rule) denied(`no access rule for action: ${action}`, { action });
  if (
    ctx.impersonating === true &&
    (action === "user.impersonate.start" || action === "claims.sync")
  ) {
    denied(`impersonated session cannot ${action}`, { action });
  }
  if (rule.roles === "public") return;
  const bypass = rule.superAdminBypass !== false;
  if (bypass && isRealSuperAdmin(ctx)) {
    if (!tenantScopeOk(rule, ctx, resource)) {
      denied(`cross-tenant target denied`, { action, tenantId: String(resource?.tenantId) });
    }
    return;
  }
  if (!ctx.uid) denied(`unauthenticated for ${action}`, { action });
  if (!tenantScopeOk(rule, ctx, resource)) {
    denied(`tenant scope mismatch for ${action}`, {
      action,
      ctxTenant: String(ctx.tenantId),
      target: String(resource?.tenantId),
    });
  }
  if (bypass && isSystemActor(ctx)) return;
  if (!roleAllowed(rule, ctx)) {
    denied(`role ${String(ctx.role)} not permitted for ${action}`, {
      action,
      role: String(ctx.role),
    });
  }
  if (!permissionAllowed(rule, ctx)) {
    denied(`granular permission denied for ${action}`, { action });
  }
  if (!ownershipAllowed(rule, ctx, resource)) {
    denied(`ownership check failed for ${action}`, { action });
  }
}
function canTransition2(entity, from, to) {
  return canTransition(entity, from, to);
}
function assertTransition2(entity, from, to) {
  if (!canTransition2(entity, from, to)) {
    invalidTransition(`invalid ${String(entity)} transition: ${from} \u2192 ${to}`, {
      entity: String(entity),
      from,
      to,
    });
  }
}

// ../../packages/functions-shared/dist/index.js
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  onDocumentWritten,
  onDocumentUpdated,
  onDocumentDeleted,
  onDocumentCreated,
} from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { getFunctions } from "firebase-admin/functions";
function makeSystemContext(tenantId, deps) {
  return {
    uid: "<system>",
    isSuperAdmin: true,
    tenantId,
    role: null,
    permissions: null,
    staffPermissions: null,
    classIds: [],
    studentIds: [],
    entityIds: {},
    now: deps.clock ?? (() => /* @__PURE__ */ new Date().toISOString()),
    repos: deps.repos,
    ai: deps.ai,
  };
}
function fail(code, message, extra) {
  const meta = buildMeta(code, extra);
  throw new AccessError(code, message, meta);
}
function buildMeta(_code, extra) {
  if (!extra) return void 0;
  const meta = { ...(extra.meta ?? {}) };
  if (extra.validationErrors) {
    meta.validationErrors = extra.validationErrors;
  }
  if (extra.retryable !== void 0) {
    meta.retryable = extra.retryable;
  }
  return Object.keys(meta).length > 0 ? meta : void 0;
}
var PUBLIC_UID = "<public>";
async function buildAuthContext(auth2, opts) {
  const clock = opts.clock ?? (() => /* @__PURE__ */ new Date().toISOString());
  if (opts.anonymous) {
    return anonymousContext(opts, clock);
  }
  if (!auth2 || !auth2.uid) {
    return fail("UNAUTHENTICATED", "authentication required");
  }
  const uid = auth2.uid;
  const token = auth2.token ?? {};
  const isSuperAdmin = token.isSuperAdmin === true;
  const claimTenant = token.tenantId ?? token.activeTenantId ?? null;
  let tenantId = claimTenant;
  let usedTenantOverride = false;
  if (isSuperAdmin && opts.tenantOverride) {
    tenantId = opts.tenantOverride;
    usedTenantOverride = true;
  }
  let classIds;
  if (token.classIdsOverflow === true) {
    const managed = await opts.repos.memberships.getManagedClassIds(uid, tenantId);
    classIds = managed;
  } else {
    classIds = token.classIds ?? [];
  }
  const studentIds = token.studentIds ?? [];
  return {
    uid,
    isSuperAdmin,
    tenantId,
    role: token.role ?? null,
    permissions: token.permissions ?? null,
    staffPermissions: token.staffPermissions ?? null,
    classIds,
    studentIds,
    entityIds: {
      teacherId: token.teacherId,
      studentId: token.studentId,
      parentId: token.parentId,
      staffId: token.staffId,
      scannerId: token.scannerId,
    },
    idempotencyKey: opts.idempotencyKey,
    impersonating: token.impersonating === true,
    usedTenantOverride,
    now: clock,
    repos: opts.repos,
    ai: opts.ai,
  };
}
function anonymousContext(opts, clock) {
  return {
    uid: PUBLIC_UID,
    isSuperAdmin: false,
    tenantId: null,
    role: null,
    permissions: null,
    staffPermissions: null,
    classIds: [],
    studentIds: [],
    entityIds: {},
    idempotencyKey: opts.idempotencyKey,
    now: clock,
    repos: opts.repos,
    ai: opts.ai,
  };
}
var REGION = "asia-south1";
var QUEUES = {
  gradingPipeline: "grading-pipeline",
  studentRollup: "student-rollup",
  outboxDrain: "outbox-drain",
};
function projectId() {
  return (
    process.env.GCLOUD_PROJECT ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.FIREBASE_PROJECT_ID ??
    "levelup-local"
  );
}
var VALIDATE_RESPONSES =
  process.env.VALIDATE_RESPONSES === "1" || process.env.VALIDATE_RESPONSES === "true";
var runtime = null;
function configureRuntime(deps) {
  runtime = deps;
}
function requireRuntime() {
  if (!runtime) {
    throw new Error(
      "[functions-shared] runtime not configured \u2014 call configureRuntime({ repos, ai }) at bootstrap"
    );
  }
  return runtime;
}
function getRepos() {
  return requireRuntime().repos;
}
function getAi() {
  return requireRuntime().ai;
}
function getClock() {
  return runtime?.clock;
}
function parseRequest(data, schema) {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const validationErrors = result.error.issues.map((i) => ({
    path: i.path.map(String).join("."),
    message: i.message,
  }));
  const message =
    "Invalid request: " + validationErrors.map((e) => `${e.path}: ${e.message}`).join("; ");
  return fail("VALIDATION_ERROR", message, { validationErrors });
}
function isServiceErrorLike(e) {
  return e instanceof Error && e.name === "ServiceError" && typeof e.code === "string";
}
var CODE_ALIASES = {
  FAILED_PRECONDITION: "PRECONDITION_FAILED",
  INVALID_ARGUMENT: "VALIDATION_ERROR",
  TENANT_REQUIRED: "PERMISSION_DENIED",
  ALREADY_EXISTS: "CONFLICT",
  ABORTED: "CONFLICT",
};
function normalizeCode(raw) {
  return CODE_ALIASES[raw] ?? raw;
}
function isZodLikeError(e) {
  return typeof e === "object" && e !== null && Array.isArray(e.issues) && e.name === "ZodError";
}
function buildDetails(code, message, meta) {
  const details = {
    code,
    message: message || ERROR_MESSAGES[code],
    retryable: DEFAULT_RETRYABLE[code],
  };
  if (meta) {
    const rest = {};
    for (const [k, v] of Object.entries(meta)) {
      if (k === "validationErrors" && Array.isArray(v)) {
        details.validationErrors = v;
      } else if (k === "retryable" && typeof v === "boolean") {
        details.retryable = v;
      } else if (v !== void 0) {
        rest[k] = v;
      }
    }
    if (Object.keys(rest).length > 0) details.meta = rest;
  }
  return details;
}
function mapError(e) {
  if (e instanceof HttpsError) return e;
  if (isAccessError(e) || isServiceErrorLike(e)) {
    const code = normalizeCode(String(e.code));
    const httpsCode = APP_ERROR_TO_HTTPS[code];
    if (httpsCode) {
      const details2 = buildDetails(code, e.message, e.meta);
      return new HttpsError(httpsCode, details2.message, details2);
    }
  }
  if (isZodLikeError(e)) {
    const validationErrors = e.issues.map((i) => ({
      path: i.path.map(String).join("."),
      message: i.message,
    }));
    const details2 = buildDetails("VALIDATION_ERROR", "Invalid request", {
      validationErrors,
    });
    return new HttpsError(APP_ERROR_TO_HTTPS.VALIDATION_ERROR, details2.message, details2);
  }
  console.error(
    "[mapError] UNCLASSIFIED error \u2192INTERNAL_ERROR:",
    e instanceof Error
      ? `${e.name}: ${e.message}
${e.stack}`
      : JSON.stringify(e)
  );
  const details = buildDetails("INTERNAL_ERROR", ERROR_MESSAGES.INTERNAL_ERROR);
  return new HttpsError(APP_ERROR_TO_HTTPS.INTERNAL_ERROR, details.message, details);
}
var RATE_TIER_LIMITS = {
  read: { perMinute: 600 },
  write: { perMinute: 120 },
  ai: { perMinute: 30 },
  auth: { perMinute: 20 },
  report: { perMinute: 10 },
};
function windowKey(now) {
  const iso = now();
  return iso.slice(0, 16);
}
function isExempt(ctx) {
  return ctx.uid === "<system>";
}
async function enforceRateLimit(ctx, tier) {
  if (isExempt(ctx)) return;
  const limit = RATE_TIER_LIMITS[tier];
  const subject = `${String(ctx.tenantId ?? "none")}:${String(ctx.uid)}`;
  const count = await ctx.repos.rateLimits.hit(subject, tier, windowKey(ctx.now));
  if (count > limit.perMinute) {
    fail("RATE_LIMITED", `rate limit exceeded for tier ${tier}`, {
      retryable: true,
      meta: { tier, limit: limit.perMinute, retryAfterMs: 6e4 },
    });
  }
}
function dedupeKey(name, idempotencyKey) {
  return `${name}:${idempotencyKey}`;
}
var dedupe = {
  /** Returns the cached response if present; null means "run the body". Throws on an active lease. */
  async begin(ctx, name) {
    const idk = ctx.idempotencyKey;
    if (!idk) return null;
    const repo = ctx.repos.idempotency;
    const res = await repo.begin(ctx.tenantId ?? "", ctx.uid, dedupeKey(name, idk));
    if (res.status === "committed") return res.result ?? null;
    if (res.status === "in_flight") {
      fail("IDEMPOTENCY_CONFLICT", "a request with this idempotency key is in flight", {
        retryable: true,
        meta: { name },
      });
    }
    return null;
  },
  /** Persist the committed response for replay. */
  async commit(ctx, name, res) {
    const idk = ctx.idempotencyKey;
    if (!idk) return;
    const repo = ctx.repos.idempotency;
    await repo.commit(ctx.tenantId ?? "", ctx.uid, dedupeKey(name, idk), res);
  },
  /** Release an in-flight lease (call when the service body throws). */
  async release(ctx, name) {
    const idk = ctx.idempotencyKey;
    if (!idk) return;
    const repo = ctx.repos.idempotency;
    if (typeof repo.release === "function") {
      await repo.release(ctx.tenantId ?? "", ctx.uid, dedupeKey(name, idk)).catch(() => void 0);
    }
  },
};
async function writeAudit(ctx, action, target, meta) {
  await ctx.repos.audit
    .write({
      tenantId: ctx.tenantId,
      actorUid: ctx.uid,
      action,
      target,
      meta,
      at: ctx.now(),
    })
    .catch(() => void 0);
}
function extractTenantOverride(def2, data) {
  if (!def2.allowsTenantOverride) return void 0;
  if (typeof data === "object" && data !== null && "tenantOverride" in data) {
    const v = data.tenantOverride;
    return typeof v === "string" ? v : void 0;
  }
  return void 0;
}
var ENVELOPE_FIELDS = ["__apiVersion", "__idempotencyKey", "idempotencyKey"];
function stripEnvelopeFields(data) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return data;
  const obj = data;
  if (!ENVELOPE_FIELDS.some((k) => k in obj)) return data;
  const rest = { ...obj };
  for (const k of ENVELOPE_FIELDS) delete rest[k];
  return rest;
}
function extractIdempotencyKey(data) {
  if (typeof data !== "object" || data === null) return void 0;
  const obj = data;
  const v = obj["__idempotencyKey"] ?? obj["idempotencyKey"];
  return typeof v === "string" ? v : void 0;
}
function makeCallable(name, service) {
  const def2 = CALLABLES[name];
  return onCall({ region: REGION, cors: true }, async (request) => {
    try {
      const data = request.data;
      const ctx = await buildAuthContext(request.auth, {
        anonymous: def2.authMode === "public",
        tenantOverride: extractTenantOverride(def2, data),
        idempotencyKey: extractIdempotencyKey(data),
        repos: getRepos(),
        ai: getAi(),
        clock: getClock(),
      });
      if (def2.authMode === "authed" && (!ctx.uid || ctx.uid === "<public>")) {
        fail("UNAUTHENTICATED", "authentication required");
      }
      if (ctx.usedTenantOverride) {
        await writeAudit(
          ctx,
          "tenantOverride",
          { type: "tenant", id: String(ctx.tenantId) },
          { callable: name }
        );
      }
      await enforceRateLimit(ctx, def2.rateTier);
      const requestSchema = def2.requestSchema;
      const input = parseRequest(stripEnvelopeFields(data), requestSchema);
      if (def2.idempotent && ctx.idempotencyKey) {
        const cached = await dedupe.begin(ctx, name);
        if (cached !== null) return cached;
      }
      let res;
      try {
        res = await service(input, ctx);
      } catch (e) {
        if (def2.idempotent && ctx.idempotencyKey) await dedupe.release(ctx, name);
        throw e;
      }
      if (def2.idempotent && ctx.idempotencyKey) await dedupe.commit(ctx, name, res);
      if (VALIDATE_RESPONSES) {
        const parsed = def2.responseSchema.safeParse(res);
        if (!parsed.success) {
          throw new Error(`[contract] response drift for ${name}: ${parsed.error.message}`);
        }
      }
      return res;
    } catch (e) {
      throw mapError(e);
    }
  });
}
function tenantOf(ref, params) {
  const key = ref.tenantParam ?? "t";
  return params[key] ?? null;
}
function systemCtx(tenantId) {
  return makeSystemContext(tenantId, { repos: getRepos(), ai: getAi(), clock: getClock() });
}
function makeTrigger(ref, service) {
  const opts = { region: REGION, document: ref.document };
  const runCreated = async (event) => {
    try {
      const ctx = systemCtx(tenantOf(ref, event.params));
      await service(
        {
          type: "created",
          params: event.params,
          before: null,
          after: event.data?.data() ?? null,
          id: event.data?.id ?? "",
        },
        ctx
      );
    } catch (e) {
      throw mapError(e);
    }
  };
  const runDeleted = async (event) => {
    try {
      const ctx = systemCtx(tenantOf(ref, event.params));
      await service(
        {
          type: "deleted",
          params: event.params,
          before: event.data?.data() ?? null,
          after: null,
          id: event.data?.id ?? "",
        },
        ctx
      );
    } catch (e) {
      throw mapError(e);
    }
  };
  const runChange = async (type, event) => {
    try {
      const ctx = systemCtx(tenantOf(ref, event.params));
      await service(
        {
          type,
          params: event.params,
          before: event.data?.before?.data() ?? null,
          after: event.data?.after?.data() ?? null,
          id: event.data?.after?.id ?? event.data?.before?.id ?? "",
        },
        ctx
      );
    } catch (e) {
      throw mapError(e);
    }
  };
  switch (ref.eventType) {
    case "created":
      return onDocumentCreated(opts, runCreated);
    case "deleted":
      return onDocumentDeleted(opts, runDeleted);
    case "updated":
      return onDocumentUpdated(opts, (e) => runChange("updated", e));
    case "written":
      return onDocumentWritten(opts, (e) => runChange("written", e));
  }
}
function makeScheduler(schedule3, service) {
  return onSchedule({ region: REGION, schedule: schedule3 }, async () => {
    try {
      const ctx = makeSystemContext(null, { repos: getRepos(), ai: getAi(), clock: getClock() });
      await service(ctx);
    } catch (e) {
      throw mapError(e);
    }
  });
}
function makeTaskHandler(queue, service, opts = {}) {
  return onTaskDispatched(
    {
      region: REGION,
      retryConfig: opts.retryConfig,
      rateLimits: opts.rateLimits,
    },
    async (req) => {
      try {
        const payload = req.data;
        const tenantId = payload?.[opts.tenantField ?? "tenantId"] ?? null;
        const ctx = makeSystemContext(tenantId, {
          repos: getRepos(),
          ai: getAi(),
          clock: getClock(),
        });
        await service(payload, ctx);
      } catch (e) {
        throw mapError(e);
      }
    }
  );
}

// src/bootstrap.ts
var configured = false;
function bootstrapRuntime() {
  if (configured) return;
  if (admin.apps.length === 0) {
    admin.initializeApp();
  }
  const clock = () => isoNow();
  const repos = createRepos({ now: () => clock() });
  const isEmulatorOrTest =
    !!process.env["FIRESTORE_EMULATOR_HOST"] ||
    process.env["LEVELUP_AI_STUB"] === "1" ||
    process.env["SEED"] === "1" ||
    process.env["TEST"] === "1";
  const aiDeps = {
    repos,
    projectId: projectId(),
  };
  if (isEmulatorOrTest) {
    const stubSecretResolver = {
      getApiKey: async () => "stub-emulator-key",
      invalidate: () => {},
    };
    aiDeps.providerFactory = (apiKey, model) => createStubProvider(apiKey, model);
    aiDeps.secretResolver = stubSecretResolver;
  }
  const ai = createAiGateway(aiDeps);
  configureRuntime({
    // Structural-port reconciliation cast (see file header). The concrete
    // implementations are supersets of the adapter-layer ports.
    repos,
    ai,
    clock,
  });
  configured = true;
}
bootstrapRuntime();

// src/identity.ts
var identity_exports = {};
__export(identity_exports, {
  bulkApplyTenantFeatures: () => bulkApplyTenantFeatures2,
  bulkImportStudents: () => bulkImportStudents2,
  bulkImportTeachers: () => bulkImportTeachers2,
  bulkUpdateStatus: () => bulkUpdateStatus2,
  changeMembershipRole: () => changeMembershipRole2,
  cleanupExpiredExports: () => cleanupExpiredExports,
  createOrgUser: () => createOrgUser2,
  deactivateTenant: () => deactivateTenant2,
  deleteConsumerAccount: () => deleteConsumerAccount2,
  endImpersonation: () => endImpersonation2,
  estimateAudience: () => estimateAudience2,
  exportTenantData: () => exportTenantData2,
  getClass: () => getClass2,
  getMe: () => getMe2,
  getNotificationBadge: () => getNotificationBadge2,
  getNotificationPreferences: () => getNotificationPreferences2,
  getPlatformConfig: () => getPlatformConfig2,
  getStudent: () => getStudent2,
  getTeacher: () => getTeacher2,
  getTenant: () => getTenant2,
  joinTenant: () => joinTenant2,
  listAcademicSessions: () => listAcademicSessions2,
  listAnnouncements: () => listAnnouncements2,
  listClasses: () => listClasses2,
  listExportJobs: () => listExportJobs2,
  listGlobalEvaluationPresets: () => listGlobalEvaluationPresets2,
  listNotifications: () => listNotifications2,
  listParents: () => listParents2,
  listStaff: () => listStaff2,
  listStudents: () => listStudents2,
  listTeachers: () => listTeachers2,
  listTenants: () => listTenants2,
  lookupTenantByCode: () => lookupTenantByCode2,
  markAnnouncementRead: () => markAnnouncementRead2,
  markNotificationRead: () => markNotificationRead2,
  monthlyUsageReset: () => monthlyUsageReset,
  onAnnouncementPublished: () => onAnnouncementPublished,
  onClassArchived: () => onClassArchived,
  onMembershipWritten: () => onMembershipWritten,
  onStudentArchived: () => onStudentArchived,
  onTenantDeactivated: () => onTenantDeactivated,
  reactivateTenant: () => reactivateTenant2,
  registerDeviceToken: () => registerDeviceToken2,
  rolloverSession: () => rolloverSession2,
  saveAcademicSession: () => saveAcademicSession2,
  saveAnnouncement: () => saveAnnouncement2,
  saveClass: () => saveClass2,
  saveGlobalEvaluationPreset: () => saveGlobalEvaluationPreset2,
  saveNotificationPreferences: () => saveNotificationPreferences2,
  saveParent: () => saveParent2,
  savePlatformConfig: () => savePlatformConfig2,
  saveStaff: () => saveStaff2,
  saveStudent: () => saveStudent2,
  saveTeacher: () => saveTeacher2,
  saveTenant: () => saveTenant2,
  saveTenantFeatures: () => saveTenantFeatures2,
  saveTenantSettings: () => saveTenantSettings2,
  searchUsers: () => searchUsers2,
  sendDirectMessage: () => sendDirectMessage2,
  sendPasswordReset: () => sendPasswordReset2,
  setUserStatus: () => setUserStatus2,
  startImpersonation: () => startImpersonation2,
  switchActiveTenant: () => switchActiveTenant2,
  tenantLifecycleCheck: () => tenantLifecycleCheck,
  unregisterDeviceToken: () => unregisterDeviceToken2,
  updateMyProfile: () => updateMyProfile2,
  uploadTenantAsset: () => uploadTenantAsset2,
  uploadUserAsset: () => uploadUserAsset2,
});

// ../../packages/services/dist/index.js
function requireTenant(ctx) {
  if (!ctx.tenantId) {
    throw new ServiceError("TENANT_REQUIRED", "No active tenant on the auth context");
  }
  return ctx.tenantId;
}
var ServiceError = class extends Error {
  constructor(code, message, meta) {
    super(message);
    this.code = code;
    this.meta = meta;
    this.name = "ServiceError";
  }
};
function fail2(code, message, meta) {
  throw new ServiceError(code, message, meta);
}
function isAuthoringRole(ctx) {
  return ctx.role === "teacher" || ctx.role === "tenantAdmin" || ctx.role === "staff";
}
function isTeacherish(ctx) {
  return isAuthoringRole(ctx);
}
function projectRubric(rubric, authoring) {
  if (authoring || !rubric || typeof rubric !== "object") return rubric;
  const r = { ...rubric };
  delete r["modelAnswer"];
  delete r["evaluatorGuidance"];
  if (Array.isArray(r["dimensions"])) {
    r["dimensions"] = r["dimensions"].map((d) => {
      const copy = { ...d };
      delete copy["promptGuidance"];
      return copy;
    });
  }
  if (Array.isArray(r["criteria"])) {
    r["criteria"] = r["criteria"].map((c) => {
      const copy = { ...c };
      delete copy["evaluatorGuidance"];
      return copy;
    });
  }
  return r;
}
function projectQuestion(q, authoring) {
  return { ...q, rubric: projectRubric(q["rubric"], authoring) };
}
function stripEvaluationCost(evaluation) {
  if (!evaluation || typeof evaluation !== "object") return evaluation;
  const e = { ...evaluation };
  delete e["costUsd"];
  delete e["cost"];
  delete e["tokenUsage"];
  delete e["promptTokens"];
  delete e["completionTokens"];
  delete e["rawProviderResponse"];
  return e;
}
function projectSpaceProgress(p) {
  const spIn = p["storyPoints"] ?? {};
  const storyPoints = {};
  for (const [k, v] of Object.entries(spIn)) {
    const e = v ?? {};
    const pe = typeof e["pointsEarned"] === "number" ? e["pointsEarned"] : 0;
    const tp = typeof e["totalPoints"] === "number" ? e["totalPoints"] : 0;
    storyPoints[k] = {
      storyPointId: typeof e["storyPointId"] === "string" ? e["storyPointId"] : k,
      status: typeof e["status"] === "string" ? e["status"] : "not_started",
      pointsEarned: pe,
      totalPoints: tp,
      percentage:
        typeof e["percentage"] === "number"
          ? e["percentage"]
          : tp > 0
            ? Math.round((pe / tp) * 100)
            : 0,
      completedItems: typeof e["completedItems"] === "number" ? e["completedItems"] : 0,
      totalItems: typeof e["totalItems"] === "number" ? e["totalItems"] : 0,
      completedAt: e["completedAt"] ?? null,
    };
  }
  const percentage =
    typeof p["percentage"] === "number"
      ? p["percentage"]
      : typeof p["overallPercentage"] === "number"
        ? p["overallPercentage"]
        : 0;
  const out = {
    id: p["id"],
    userId: p["userId"],
    tenantId: p["tenantId"],
    spaceId: p["spaceId"],
    status:
      typeof p["status"] === "string"
        ? p["status"]
        : percentage >= 100
          ? "completed"
          : percentage > 0
            ? "in_progress"
            : "not_started",
    pointsEarned: typeof p["pointsEarned"] === "number" ? p["pointsEarned"] : 0,
    totalPoints: typeof p["totalPoints"] === "number" ? p["totalPoints"] : 0,
    percentage,
    storyPoints,
    startedAt: p["startedAt"] ?? null,
    completedAt: p["completedAt"] ?? null,
    updatedAt: p["updatedAt"],
  };
  if (typeof p["marksEarned"] === "number") out["marksEarned"] = p["marksEarned"];
  if (typeof p["totalMarks"] === "number") out["totalMarks"] = p["totalMarks"];
  return out;
}
function projectEvaluationSettings(s, authoring) {
  if (authoring) return s;
  const copy = { ...s };
  delete copy["confidenceConfig"];
  if (Array.isArray(copy["enabledDimensions"])) {
    copy["enabledDimensions"] = copy["enabledDimensions"].map((d) => {
      const c = { ...d };
      delete c["promptGuidance"];
      return c;
    });
  }
  return copy;
}
function buildOutboxRecord(input) {
  return {
    type: input.type,
    tenantId: input.tenantId,
    payload: input.payload,
    createdAt: input.createdAt,
    status: "pending",
    attempts: 0,
  };
}
function enqueueOutboxEvent(tx, input) {
  tx.enqueueOutbox(input.tenantId, buildOutboxRecord(input));
}
async function withIdempotency(ctx, tenantId, key, body) {
  const begin = await ctx.repos.idempotency.begin(tenantId, ctx.uid, key);
  if (begin.status === "committed") {
    return begin.result;
  }
  const result = await body();
  await ctx.repos.idempotency.commit(tenantId, ctx.uid, key, result);
  return result;
}
function xrepos(ctx) {
  return ctx.repos;
}
var MAX_CLAIM_CLASS_IDS = 15;
function buildClaimsFromMembership(membership, opts = {}) {
  const classIds = membership.classIds ?? [];
  const overflow = classIds.length > MAX_CLAIM_CLASS_IDS;
  const claims = {
    role: membership.role,
    tenantId: membership.tenantId,
    tenantCode: membership.tenantCode,
    teacherId: membership.teacherId,
    studentId: membership.studentId,
    parentId: membership.parentId,
    staffId: membership.staffId,
    scannerId: membership.scannerId,
    classIds: overflow ? classIds.slice(0, MAX_CLAIM_CLASS_IDS) : classIds,
    classIdsOverflow: overflow || void 0,
    studentIds: membership.parentLinkedStudentIds,
    permissions: membership.permissions,
    staffPermissions: membership.staffPermissions,
    isSuperAdmin: opts.isSuperAdmin || void 0,
  };
  for (const k of Object.keys(claims)) {
    if (claims[k] === void 0) delete claims[k];
  }
  return claims;
}
async function syncMembershipClaims(uid, tenantId, ctx, opts = {}) {
  const membership = await xrepos(ctx).memberships.get(uid, tenantId);
  if (!membership) fail2("NOT_FOUND", `membership ${uid}@${tenantId} not found`);
  const claims = buildClaimsFromMembership(membership, { isSuperAdmin: opts.isSuperAdmin });
  await ctx.repos.claims.set(uid, claims);
  const inactive = membership.status === "suspended" || membership.status === "inactive";
  if (opts.revoke || inactive) {
    await ctx.repos.claims.revokeRefreshTokens(uid);
  }
  return claims;
}
async function provisionMembership(input, ctx, opts = {}) {
  const repos = xrepos(ctx);
  const now = ctx.now();
  const data = {
    uid: input.uid,
    tenantId: input.tenantId,
    tenantCode: input.tenantCode,
    role: input.role,
    status: "active",
    joinSource: input.joinSource ?? "admin_created",
    ...(input.entityIds ?? {}),
    classIds: input.classIds ?? [],
    permissions: input.permissions,
    staffPermissions: input.staffPermissions,
    parentLinkedStudentIds: input.parentLinkedStudentIds,
    updatedBy: ctx.uid,
  };
  for (const k of Object.keys(data)) {
    if (data[k] === void 0) delete data[k];
  }
  const { id, created } = await repos.memberships.upsert(input.uid, input.tenantId, data, now);
  await syncMembershipClaims(input.uid, input.tenantId, ctx, { revoke: opts.revoke });
  return { membershipId: id, created };
}
async function saveEntity(ctx, repo, entityName, input) {
  const tenantId = requireTenant(ctx);
  const existing = input.id ? await repo.get(tenantId, input.id) : null;
  if (input.id && !existing) fail2("NOT_FOUND", `${entityName} ${input.id} not found`);
  const now = ctx.now();
  if (input.delete && input.id) {
    const from = existing?.["status"] ?? "active";
    assertTransition2("entityStatus", from, "archived");
    await repo.upsert(
      tenantId,
      { ...(existing ?? {}), id: input.id, status: "archived", updatedBy: ctx.uid },
      now
    );
    return { id: input.id, created: false, deleted: true };
  }
  const incomingStatus = input.data["status"];
  if (incomingStatus && existing) {
    const from = existing["status"] ?? "active";
    if (from !== incomingStatus) assertTransition2("entityStatus", from, incomingStatus);
  }
  const payload = {
    ...(existing ?? {}),
    ...input.data,
    ...(input.id ? { id: input.id } : {}),
    status: incomingStatus ?? existing?.["status"] ?? "active",
    createdBy: existing?.["createdBy"] ?? ctx.uid,
    updatedBy: ctx.uid,
  };
  const { id, created } = await repo.upsert(tenantId, payload, now);
  return { id, created };
}
async function assertClassesExist(ctx, tenantId, classIds) {
  if (!classIds?.length) return;
  const found = await ctx.repos.classes.getMany(tenantId, classIds);
  if (found.length !== classIds.length) {
    fail2("INVALID_ARGUMENT", "one or more classIds do not exist in tenant");
  }
}
async function saveStudentService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "user.create", { tenantId });
  await assertClassesExist(ctx, tenantId, input.data.classIds);
  const wasCreate = !input.id;
  const res = await saveEntity(ctx, ctx.repos.students, "student", input);
  if (wasCreate && !input.delete) {
    const tenant = await ctx.repos.tenants.get(tenantId, tenantId);
    const tenantCode = tenant?.["code"] ?? "";
    const authUid = input.data["authUid"];
    if (authUid) {
      await provisionMembership(
        {
          uid: authUid,
          tenantId,
          tenantCode,
          role: "student",
          joinSource: "admin_created",
          entityIds: { studentId: res.id },
          classIds: input.data.classIds,
        },
        ctx
      );
    }
  }
  return res;
}
async function saveTeacherService(input, ctx) {
  requireTenant(ctx);
  authorize(ctx, "user.create", { tenantId: ctx.tenantId ?? void 0 });
  const res = await saveEntity(ctx, ctx.repos.teachers, "teacher", input);
  return res;
}
async function saveParentService(input, ctx) {
  requireTenant(ctx);
  authorize(ctx, "user.create", { tenantId: ctx.tenantId ?? void 0 });
  const res = await saveEntity(ctx, xrepos(ctx).parents, "parent", input);
  return res;
}
async function saveStaffService(input, ctx) {
  requireTenant(ctx);
  authorize(ctx, "user.create", { tenantId: ctx.tenantId ?? void 0 });
  const res = await saveEntity(ctx, xrepos(ctx).staff, "staff", input);
  return res;
}
async function saveClassService(input, ctx) {
  requireTenant(ctx);
  authorize(ctx, "class.write", { classId: input.id, tenantId: ctx.tenantId ?? void 0 });
  const res = await saveEntity(ctx, ctx.repos.classes, "class", input);
  return res;
}
async function saveAcademicSessionService(input, ctx) {
  requireTenant(ctx);
  authorize(ctx, "session.write", { tenantId: ctx.tenantId ?? void 0 });
  const res = await saveEntity(ctx, xrepos(ctx).academicSessions, "academicSession", input);
  return res;
}
async function saveTenantService(input, ctx) {
  authorize(ctx, "tenant.create", {});
  const data = { ...input.data };
  const tenantIdForSecret = input.id ?? data["code"] ?? "pending";
  if (typeof data["geminiApiKey"] === "string" && data["geminiApiKey"]) {
    authorize(ctx, "tenant.create", {});
    const { secretRef } = await xrepos(ctx).secrets.put(
      String(tenantIdForSecret),
      data["geminiApiKey"]
    );
    data["geminiKeyRef"] = secretRef;
    await ctx.repos.audit.write(String(tenantIdForSecret), {
      action: "tenant.ai.key.write",
      actorUid: ctx.uid,
      at: ctx.now(),
    });
  }
  delete data["geminiApiKey"];
  if (input.delete && input.id) {
    const existing = await ctx.repos.tenants.get(input.id, input.id);
    const from = existing?.["status"] ?? "trial";
    assertTransition2("tenant", from, "deactivated");
    await ctx.repos.tenants.upsert(
      input.id,
      { ...(existing ?? {}), id: input.id, status: "deactivated" },
      ctx.now()
    );
    return { id: input.id, deleted: true };
  }
  const { id, created } = await ctx.repos.tenants.upsert(
    String(tenantIdForSecret),
    { ...data, ...(input.id ? { id: input.id } : {}), updatedBy: ctx.uid },
    ctx.now()
  );
  return { id, created };
}
async function deactivateTenantService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "tenant.lifecycle", { tenantId });
  const existing = await ctx.repos.tenants.get(tenantId, tenantId);
  const from = existing?.["status"] ?? "active";
  assertTransition2("tenant", from, "deactivated");
  const now = ctx.now();
  await ctx.repos.tx(async (tx) => {
    tx.upsert("tenants", tenantId, {
      id: tenantId,
      status: "deactivated",
      deactivationReason: input.reason ?? null,
    });
    enqueueOutboxEvent(tx, {
      type: "notification.emit",
      tenantId,
      payload: { kind: "tenant.deactivated", tenantId, reason: input.reason ?? null },
      createdAt: now,
    });
  });
  return { tenantId, status: "deactivated" };
}
async function reactivateTenantService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "tenant.lifecycle", { tenantId });
  const existing = await ctx.repos.tenants.get(tenantId, tenantId);
  const from = existing?.["status"] ?? "deactivated";
  assertTransition2("tenant", from, "active");
  await ctx.repos.tenants.upsert(tenantId, { id: tenantId, status: "active" }, ctx.now());
  return { tenantId, status: "active" };
}
async function lookupTenantByCodeService(input, ctx) {
  const codeRepo = ctx.repos.tenants;
  const tenantId = (await codeRepo.resolveCode(input.tenantCode)) ?? input.tenantCode;
  const tenant = await ctx.repos.tenants.get(tenantId, tenantId);
  if (!tenant) fail2("NOT_FOUND", `no tenant for code ${input.tenantCode}`);
  return {
    tenantId: tenant["id"],
    name: tenant["name"],
    status: tenant["status"],
    ...(tenant["branding"] ? { branding: tenant["branding"] } : {}),
  };
}
async function exportTenantDataService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "tenant.export", { tenantId });
  const now = ctx.now();
  const expiresAt = new Date(Date.parse(now) + 10 * 60 * 1e3).toISOString();
  await ctx.repos.tx(async (tx) => {
    enqueueOutboxEvent(tx, {
      type: "notification.emit",
      tenantId,
      payload: { kind: "export.requested" },
      createdAt: now,
    });
  });
  return { downloadUrl: "", expiresAt };
}
async function uploadTenantAssetService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "tenant.asset.upload", { tenantId });
  return { assetUrl: `tenants/${tenantId}/assets/pending` };
}
async function createOrgUserService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "user.create", { tenantId });
  const tenant = await ctx.repos.tenants.get(tenantId, tenantId);
  const tenantCode = tenant?.["code"] ?? "";
  const repos = xrepos(ctx);
  const now = ctx.now();
  const entityRepoByRole = {
    student: ctx.repos.students,
    teacher: ctx.repos.teachers,
    parent: repos.parents,
    staff: repos.staff,
  };
  const entityRepo = entityRepoByRole[input.role];
  if (!entityRepo)
    fail2("INVALID_ARGUMENT", `role ${input.role} cannot be created via createOrgUser`);
  let user = input.email ? await xrepos(ctx).users.get(input.email) : null;
  if (!user) {
    const created = await xrepos(ctx).users.create({
      email: input.email,
      displayName: `${input.firstName} ${input.lastName}`.trim(),
    });
    user = { id: created.uid };
  }
  const uid = user["id"];
  const { id: entityId } = await entityRepo.upsert(
    tenantId,
    {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      authUid: uid,
      classIds: input.classIds ?? [],
      subjects: input.subjects ?? [],
      status: "active",
      createdBy: ctx.uid,
    },
    now
  );
  const entityIds =
    input.role === "student"
      ? { studentId: entityId }
      : input.role === "teacher"
        ? { teacherId: entityId }
        : input.role === "parent"
          ? { parentId: entityId }
          : { staffId: entityId };
  const { membershipId } = await provisionMembership(
    {
      uid,
      tenantId,
      tenantCode,
      role: input.role,
      joinSource: "admin_created",
      entityIds,
      classIds: input.classIds,
      parentLinkedStudentIds: input.linkedStudentIds,
    },
    ctx
  );
  await ctx.repos.tx(async (tx) => {
    tx.upsert("tenants", tenantId, { id: tenantId });
  });
  return { uid, entityId, membershipId };
}
async function switchActiveTenantService(input, ctx) {
  authorize(ctx, "tenant.switch", { tenantId: input.targetTenantId });
  const membership = await xrepos(ctx).memberships.get(ctx.uid, input.targetTenantId);
  if (!membership) fail2("PERMISSION_DENIED", "no membership in target tenant");
  if (membership["status"] !== "active") fail2("PERMISSION_DENIED", "membership not active");
  await syncMembershipClaims(ctx.uid, input.targetTenantId, ctx);
  return { tenantId: input.targetTenantId, role: membership["role"] };
}
async function joinTenantService(input, ctx) {
  const tenant = await ctx.repos.tenants.get(input.tenantCode, input.tenantCode);
  if (!tenant) fail2("NOT_FOUND", `no tenant for code ${input.tenantCode}`);
  const tenantId = tenant["id"];
  authorize(ctx, "tenant.join", { tenantId });
  const { membershipId } = await provisionMembership(
    {
      uid: ctx.uid,
      tenantId,
      tenantCode: input.tenantCode,
      role: "student",
      joinSource: "self_joined",
    },
    ctx
  );
  return { tenantId, membershipId, role: "student" };
}
async function bulkImportStudentsService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "user.bulkImport", { tenantId });
  let created = 0;
  let skipped = 0;
  const errors = [];
  const now = ctx.now();
  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i];
    try {
      await ctx.repos.students.upsert(
        tenantId,
        {
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          rollNumber: row.rollNumber,
          section: row.section,
          grade: row.grade,
          admissionNumber: row.admissionNumber,
          classIds: row.classIds ?? input.defaultClassIds ?? [],
          status: "active",
          createdBy: ctx.uid,
        },
        now
      );
      created++;
    } catch (e) {
      errors.push({ row: i, error: e instanceof Error ? e.message : "unknown error" });
      skipped++;
    }
  }
  return { created, skipped, errors };
}
async function bulkImportTeachersService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "user.bulkImport", { tenantId });
  let created = 0;
  let skipped = 0;
  const errors = [];
  const now = ctx.now();
  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i];
    try {
      await ctx.repos.teachers.upsert(
        tenantId,
        {
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          phone: row.phone,
          subjects: row.subjects ?? [],
          department: row.department,
          status: "active",
          createdBy: ctx.uid,
        },
        now
      );
      created++;
    } catch (e) {
      errors.push({ row: i, error: e instanceof Error ? e.message : "unknown error" });
      skipped++;
    }
  }
  return { created, skipped, errors };
}
async function bulkUpdateStatusService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "user.bulkStatus", { tenantId });
  const repoFor = {
    student: ctx.repos.students,
    teacher: ctx.repos.teachers,
    class: ctx.repos.classes,
  };
  const repo = repoFor[input.entityType];
  if (!repo) fail2("INVALID_ARGUMENT", `unknown entityType ${input.entityType}`);
  let updated = 0;
  const errors = [];
  const now = ctx.now();
  for (const id of input.ids) {
    try {
      const existing = await repo.get(tenantId, id);
      if (!existing) {
        errors.push({ id, error: "not found" });
        continue;
      }
      await repo.upsert(
        tenantId,
        { ...existing, id, status: input.status, updatedBy: ctx.uid },
        now
      );
      updated++;
    } catch (e) {
      errors.push({ id, error: e instanceof Error ? e.message : "unknown error" });
    }
  }
  return { updated, errors };
}
async function rolloverSessionService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "session.rollover", { tenantId });
  const map = input.promotionMap ?? {};
  const classesCreated = Object.keys(map).length;
  let studentsMoved = 0;
  ctx.now();
  await ctx.repos.tx(async (tx) => {
    for (const [, toClass] of Object.entries(map)) {
      tx.upsert("classes", tenantId, { id: toClass, academicSessionId: input.toSessionId });
      studentsMoved++;
    }
  });
  return { classesCreated, studentsMoved };
}
function projectEntity(doc, allowed, nullableRequired = []) {
  const out = {};
  for (const k of allowed) {
    const v = doc[k];
    if (v !== void 0 && v !== null) out[k] = v;
  }
  for (const k of nullableRequired) if (out[k] === void 0) out[k] = null;
  if ("status" in out && out["status"] !== "archived") out["status"] = "active";
  return out;
}
var STUDENT_KEYS = Object.keys(StudentSchema.shape);
var TEACHER_KEYS = Object.keys(TeacherSchema.shape);
var PARENT_KEYS = Object.keys(ParentSchema.shape);
var STAFF_KEYS = Object.keys(StaffSchema.shape);
var CLASS_KEYS = Object.keys(ClassSchema.shape);
var SESSION_KEYS = Object.keys(AcademicSessionSchema.shape);
var TEACHER_PERMISSION_KEYS2 = /* @__PURE__ */ new Set([
  "canManageSpaces",
  "canManageStudents",
  "canManageClasses",
  "canCreateExams",
  "canGradeExams",
  "canViewAnalytics",
  "canManageContent",
  "canReleaseResults",
]);
var STAFF_PERMISSION_KEYS2 = /* @__PURE__ */ new Set([
  "canManageUsers",
  "canManageClasses",
  "canImportData",
  "canExportData",
  "canViewAnalytics",
  "canManageAnnouncements",
]);
function filterPermRecord(v, allow) {
  if (!v || typeof v !== "object") return void 0;
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    if (allow.has(k) && typeof val === "boolean") out[k] = val;
  }
  return Object.keys(out).length ? out : void 0;
}
function projectPlatformClaims(raw) {
  const out = {};
  const passThrough = [
    "role",
    "tenantId",
    "tenantCode",
    "teacherId",
    "studentId",
    "parentId",
    "scannerId",
    "staffId",
    "classIds",
    "classIdsOverflow",
    "studentIds",
    "isSuperAdmin",
  ];
  for (const k of passThrough) if (raw[k] !== void 0 && raw[k] !== null) out[k] = raw[k];
  const perms = filterPermRecord(raw["permissions"], TEACHER_PERMISSION_KEYS2);
  if (perms) out["permissions"] = perms;
  const staffPerms = filterPermRecord(raw["staffPermissions"], STAFF_PERMISSION_KEYS2);
  if (staffPerms) out["staffPermissions"] = staffPerms;
  return out;
}
function projectUnifiedUser(user, uid) {
  const { id: _id, ...rest } = user;
  const NULLABLE_OPTIONAL = [
    "email",
    "phone",
    "firstName",
    "lastName",
    "photoURL",
    "country",
    "grade",
  ];
  for (const k of NULLABLE_OPTIONAL) if (rest[k] === null) delete rest[k];
  return {
    ...rest,
    createdBy: rest["createdBy"] ?? uid,
    updatedBy: rest["updatedBy"] ?? uid,
  };
}
async function listEntity(ctx, repo, page, where) {
  const tenantId = requireTenant(ctx);
  const opts = { cursor: page.cursor, limit: page.limit ?? 20, where };
  const res = await repo.list(tenantId, opts);
  return { items: res.items, nextCursor: res.nextCursor };
}
async function getMeService(_input, ctx) {
  const user = await xrepos(ctx).users.get(ctx.uid);
  if (!user) fail2("NOT_FOUND", "user not found");
  const memberships = await xrepos(ctx).memberships.listForUser(ctx.uid);
  const rawClaims = (await ctx.repos.claims.get(ctx.uid)) ?? {};
  const activeTenant = ctx.tenantId
    ? await ctx.repos.tenants.get(ctx.tenantId, ctx.tenantId)
    : void 0;
  return {
    user: projectUnifiedUser(user, ctx.uid),
    memberships,
    claims: projectPlatformClaims(rawClaims),
    activeTenant: activeTenant ?? void 0,
  };
}
async function listStudentsService(input, ctx) {
  authorize(ctx, "roster.read", { tenantId: ctx.tenantId ?? void 0 });
  const where = {};
  const classId = input.classId;
  if (classId) where["classIds"] = classId;
  const res = await listEntity(ctx, ctx.repos.students, input, where);
  res.items = res.items.map((d) => projectEntity(d, STUDENT_KEYS));
  return res;
}
async function getStudentService(input, ctx) {
  const tenantId = requireTenant(ctx);
  const student = await ctx.repos.students.get(tenantId, input.id);
  if (!student) fail2("NOT_FOUND", "student not found");
  return student;
}
async function listTeachersService(input, ctx) {
  const res = await listEntity(ctx, ctx.repos.teachers, input);
  res.items = res.items.map((d) => projectEntity(d, TEACHER_KEYS, ["lastLogin"]));
  return res;
}
async function getTeacherService(input, ctx) {
  const tenantId = requireTenant(ctx);
  const teacher = await ctx.repos.teachers.get(tenantId, input.id);
  if (!teacher) fail2("NOT_FOUND", "teacher not found");
  return teacher;
}
async function listParentsService(input, ctx) {
  const res = await listEntity(ctx, xrepos(ctx).parents, input);
  res.items = res.items.map((d) => projectEntity(d, PARENT_KEYS, ["lastLogin"]));
  return res;
}
async function listStaffService(input, ctx) {
  const res = await listEntity(ctx, xrepos(ctx).staff, input);
  res.items = res.items.map((d) => projectEntity(d, STAFF_KEYS));
  return res;
}
async function listClassesService(input, ctx) {
  const res = await listEntity(ctx, ctx.repos.classes, input);
  res.items = res.items.map((d) => projectEntity(d, CLASS_KEYS));
  return res;
}
async function getClassService(input, ctx) {
  const tenantId = requireTenant(ctx);
  const klass = await ctx.repos.classes.get(tenantId, input.id);
  if (!klass) fail2("NOT_FOUND", "class not found");
  const roster = await ctx.repos.students.list(tenantId, {
    where: { classIds: input.id },
    limit: 20,
  });
  return { ...klass, roster: roster.items, rosterNextCursor: roster.nextCursor };
}
async function listAcademicSessionsService(input, ctx) {
  const res = await listEntity(ctx, xrepos(ctx).academicSessions, input);
  res.items = res.items.map((d) => {
    const s = projectEntity(d, SESSION_KEYS);
    if (typeof s["isCurrent"] !== "boolean") s["isCurrent"] = false;
    return s;
  });
  return res;
}
async function searchUsersService(input, ctx) {
  authorize(ctx, "user.search", {});
  await xrepos(ctx).users.get(input.query);
  return { items: [], nextCursor: null };
}
async function saveGlobalEvaluationPresetService(input, ctx) {
  authorize(ctx, "preset.global.write", {});
  const now = ctx.now();
  if (input.delete && input.id) {
    await xrepos(ctx).presets.delete("__global__", input.id);
    return { id: input.id, deleted: true };
  }
  const { id, created } = await xrepos(ctx).presets.upsert(
    "__global__",
    { ...input.data, ...(input.id ? { id: input.id } : {}), status: input.data.status ?? "active" },
    now
  );
  return { id, created };
}
async function updateMyProfileService(input, ctx) {
  await xrepos(ctx).users.updateProfile?.(ctx.uid, {
    displayName: input.displayName,
    photoURL: input.photoURL,
  });
  return { ok: true };
}
async function deleteConsumerAccountService(_input, ctx) {
  await ctx.repos.claims.revokeRefreshTokens(ctx.uid);
  return { scheduled: true };
}
async function setUserStatusService(input, ctx) {
  authorize(ctx, "user.search", {});
  await ctx.repos.claims.revokeRefreshTokens(input.uid);
  await ctx.repos.audit.write(ctx.tenantId ?? "__platform__", {
    action: "user.status.set",
    actorUid: ctx.uid,
    target: input.uid,
    status: input.status,
    at: ctx.now(),
  });
  return { uid: input.uid, status: input.status };
}
async function sendPasswordResetService(input, ctx) {
  authorize(ctx, "user.search", {});
  await ctx.repos.audit.write(ctx.tenantId ?? "__platform__", {
    action: "user.passwordReset.admin",
    actorUid: ctx.uid,
    target: input.uid,
    at: ctx.now(),
  });
  return { sent: true };
}
async function startImpersonationService(input, ctx) {
  if (ctx.impersonating) fail2("PERMISSION_DENIED", "nested impersonation denied");
  if (!ctx.isSuperAdmin) fail2("PERMISSION_DENIED", "impersonation is super-admin only");
  const now = ctx.now();
  const ttlMs = 30 * 60 * 1e3;
  const expiresAt = new Date(Date.parse(now) + ttlMs).toISOString();
  const targetMembership = await xrepos(ctx).memberships.get(input.targetUid, input.tenantOverride);
  if (!targetMembership) fail2("NOT_FOUND", "target has no membership in tenant");
  const sessionToken = `imp_${input.targetUid}_${Date.parse(now)}`;
  await ctx.repos.tx(async (tx) => {
    xrepos(ctx).impersonation.openSession(tx, {
      sessionId: sessionToken,
      actorUid: ctx.uid,
      targetUid: input.targetUid,
      tenantId: input.tenantOverride,
      reason: input.reason,
      issuedAt: now,
      expiresAt,
    });
    xrepos(ctx).audit.writeInTx(
      tx,
      ctx.uid,
      "user.impersonate.start",
      { type: "user", id: input.targetUid },
      {
        tenantId: input.tenantOverride,
        reason: input.reason,
        sessionId: sessionToken,
      }
    );
  });
  await ctx.repos.claims.revokeRefreshTokens(input.targetUid);
  return { sessionToken, expiresAt };
}
async function endImpersonationService(_input, ctx) {
  const now = ctx.now();
  const sessionId = ctx.impersonationSessionId ?? "";
  await ctx.repos.tx(async (tx) => {
    if (sessionId) xrepos(ctx).impersonation.endSession(tx, sessionId, now);
  });
  return { ended: true };
}
async function onMembershipWrittenService(event, ctx) {
  const after = event.after;
  if (!after) return;
  const uid = after["uid"] ?? event.params["uid"];
  const tenantId = after["tenantId"] ?? event.tenantId;
  if (!uid || !tenantId) return;
  const before = event.before;
  const roleChanged = before?.["role"] !== after["role"];
  const statusChanged = before?.["status"] !== after["status"];
  const downgrade =
    after["status"] === "suspended" ||
    after["status"] === "inactive" ||
    (statusChanged && before?.["status"] === "active");
  await syncMembershipClaims(uid, tenantId, ctx, { revoke: roleChanged || downgrade });
}
async function onStudentArchivedService(event, ctx) {
  const after = event.after;
  if (!after || after["status"] !== "archived") return;
  const studentId = after["id"] ?? event.params["id"];
  const classIds = after["classIds"] ?? [];
  if (!studentId) return;
  await ctx.repos.tx(async (tx) => {
    for (const classId of classIds) {
      tx.upsert("classes", event.tenantId, { id: classId, _removeStudentId: studentId });
    }
  });
}
async function onClassArchivedService(event, ctx) {
  const after = event.after;
  if (!after || after["status"] !== "archived") return;
  const classId = after["id"] ?? event.params["id"];
  if (!classId) return;
  const students = await ctx.repos.students.list(event.tenantId, {
    where: { classIds: classId },
    limit: 200,
  });
  await ctx.repos.tx(async (tx) => {
    for (const s of students.items) {
      tx.upsert("students", event.tenantId, { id: s["id"], _removeClassId: classId });
    }
  });
}
async function onTenantDeactivatedService(event, ctx) {
  const after = event.after;
  if (!after || after["status"] !== "deactivated") return;
  const tenantId = after["id"] ?? event.tenantId;
  await ctx.repos.outbox.enqueue(tenantId, {
    type: "tenant.deactivated",
    tenantId,
    payload: { tenantId },
    createdAt: ctx.now(),
    status: "pending",
    attempts: 0,
  });
}
async function onAnnouncementPublishedService(event, ctx) {
  const after = event.after;
  if (!after || after["status"] !== "published") return;
  if (event.before?.["status"] === "published") return;
  const announcementId = after["id"] ?? event.params["id"];
  await ctx.repos.outbox.enqueue(event.tenantId, {
    type: "announcement.published",
    tenantId: event.tenantId,
    payload: {
      announcementId,
      scope: after["scope"],
      targetRoles: after["targetRoles"],
      targetClassIds: after["targetClassIds"],
    },
    createdAt: ctx.now(),
    status: "pending",
    attempts: 0,
  });
}
async function tenantLifecycleCheckService(ctx) {
  const tenants = await ctx.repos.tenants.list("__platform__", { limit: 200 });
  const now = ctx.now();
  for (const t of tenants.items) {
    const trialEndsAt = t["trialEndsAt"];
    if (t["status"] === "trial" && trialEndsAt && Date.parse(trialEndsAt) < Date.parse(now)) {
      await ctx.repos.tenants.upsert(String(t["id"]), { id: t["id"], status: "expired" }, now);
    }
  }
}
async function monthlyUsageResetService(ctx) {
  const tenants = await ctx.repos.tenants.list("__platform__", { limit: 200 });
  for (const t of tenants.items) {
    await ctx.repos.tenants.upsert(
      String(t["id"]),
      { id: t["id"], usage: { aiCallsThisMonth: 0, costThisMonth: 0 } },
      ctx.now()
    );
  }
}
async function cleanupExpiredExportsService(ctx) {
  void xrepos(ctx);
}
var ANSWER_KEY_FIELDS = [
  "answerKey",
  "correctAnswer",
  "acceptableAnswers",
  "modelAnswer",
  "evaluationGuidance",
  "evaluatorGuidance",
];
function stripAnswerFields(value) {
  if (Array.isArray(value)) {
    return value.map((v) => stripAnswerFields(v));
  }
  if (value && typeof value === "object") {
    const copy = {};
    for (const [k, v] of Object.entries(value)) {
      if (ANSWER_KEY_FIELDS.includes(k)) continue;
      copy[k] = stripAnswerFields(v);
    }
    return copy;
  }
  return value;
}
var QUESTION_TYPE_MAP = {
  mcq: "mcq",
  msq: "mcaq",
  mcaq: "mcaq",
  true_false: "true-false",
  "true-false": "true-false",
  numeric: "numerical",
  numerical: "numerical",
  short_answer: "text",
  text: "text",
  long_answer: "paragraph",
  essay: "paragraph",
  paragraph: "paragraph",
  code: "code",
  fill_blank: "fill-blanks",
  "fill-blanks": "fill-blanks",
  "fill-blanks-dd": "fill-blanks-dd",
  match: "matching",
  matching: "matching",
  ordering: "jumbled",
  jumbled: "jumbled",
  audio_response: "audio",
  oral: "audio",
  audio: "audio",
  diagram: "image_evaluation",
  file_upload: "image_evaluation",
  image_evaluation: "image_evaluation",
  "group-options": "group-options",
  chat_agent_question: "chat_agent_question",
};
var MATERIAL_TYPE_MAP = {
  reading: "text",
  text: "text",
  video: "video",
  pdf: "pdf",
  link: "link",
  image: "link",
  audio: "link",
  slides: "story",
  story: "story",
  interactive: "interactive",
  rich: "rich",
};
function asOptions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((o, i) => {
    const od = o ?? {};
    return {
      id: String(od["id"] ?? i),
      text: String(od["text"] ?? ""),
      ...(typeof od["imageUrl"] === "string" ? { imageUrl: od["imageUrl"] } : {}),
    };
  });
}
function buildQuestionData(qt, legacy) {
  const options = asOptions(legacy["options"]);
  switch (qt) {
    case "mcq":
      return { questionType: "mcq", options };
    case "mcaq":
      return { questionType: "mcaq", options };
    case "true-false":
      return { questionType: "true-false" };
    case "numerical":
      return { questionType: "numerical" };
    case "text":
      return { questionType: "text" };
    case "paragraph":
      return { questionType: "paragraph" };
    case "code":
      return {
        questionType: "code",
        ...(typeof legacy["language"] === "string" ? { language: legacy["language"] } : {}),
      };
    case "fill-blanks": {
      const template = String(legacy["prompt"] ?? legacy["template"] ?? "");
      const n = (template.match(/_{2,}/g) ?? ["_"]).length;
      return {
        questionType: "fill-blanks",
        template,
        blanks: Array.from({ length: n }, (_, i) => ({ id: `b${i + 1}` })),
      };
    }
    case "jumbled":
      return { questionType: "jumbled", tokens: options.map((o) => o.text) };
    case "matching":
      return {
        questionType: "matching",
        pairs: options.map((o) => ({ left: o.text, right: "" })),
      };
    case "audio":
      return { questionType: "audio" };
    case "image_evaluation":
      return { questionType: "image_evaluation" };
    case "group-options":
      return {
        questionType: "group-options",
        groups: [],
        items: options.map((o) => ({ id: o.id, text: o.text })),
      };
    case "chat_agent_question":
      return { questionType: "chat_agent_question" };
    default:
      return { questionType: "text" };
  }
}
function buildMaterialData(mt, legacy) {
  const url = typeof legacy["url"] === "string" ? legacy["url"] : "";
  const body = typeof legacy["body"] === "string" ? legacy["body"] : "";
  switch (mt) {
    case "video":
      return {
        materialType: "video",
        url,
        ...(typeof legacy["durationSeconds"] === "number"
          ? { durationSeconds: legacy["durationSeconds"] }
          : {}),
      };
    case "pdf":
      return { materialType: "pdf", url };
    case "link":
      return {
        materialType: "link",
        url,
        ...(typeof legacy["title"] === "string" ? { label: legacy["title"] } : {}),
      };
    case "story":
      return {
        materialType: "story",
        slides: [
          {
            ...(typeof legacy["title"] === "string" ? { title: legacy["title"] } : {}),
            body,
          },
        ],
      };
    case "interactive":
      return { materialType: "interactive", embedUrl: url };
    case "rich":
      return { materialType: "rich", blocks: [] };
    case "text":
    default:
      return { materialType: "text", body };
  }
}
function normalizeItemPayload(payload, item) {
  const p = payload ?? {};
  const kind = typeof p["kind"] === "string" ? p["kind"] : void 0;
  if (kind === "question") {
    const qt = QUESTION_TYPE_MAP[String(p["questionType"] ?? "")] ?? "text";
    const basePoints =
      typeof p["points"] === "number"
        ? p["points"]
        : typeof p["basePoints"] === "number"
          ? p["basePoints"]
          : void 0;
    return {
      type: "question",
      payload: {
        type: "question",
        ...(basePoints !== void 0 ? { basePoints } : {}),
        questionData: buildQuestionData(qt, p),
      },
      content: typeof p["prompt"] === "string" ? p["prompt"] : void 0,
    };
  }
  if (kind === "material") {
    const mt = MATERIAL_TYPE_MAP[String(p["materialType"] ?? "")] ?? "text";
    return {
      type: "material",
      payload: { type: "material", materialData: buildMaterialData(mt, p) },
      title: typeof p["title"] === "string" ? p["title"] : void 0,
      content: typeof p["body"] === "string" ? p["body"] : void 0,
    };
  }
  if (kind) {
    const clean = stripAnswerFields(p);
    clean["type"] = kind;
    delete clean["kind"];
    return { type: kind, payload: clean };
  }
  if (typeof p["type"] === "string") {
    return { type: String(item["type"] ?? p["type"]), payload: stripAnswerFields(p) };
  }
  return { type: "checkpoint", payload: { type: "checkpoint" } };
}
function extractAnswerKey(data) {
  const ak = data["answerKey"];
  if (ak && typeof ak === "object") return { ...ak };
  const inline = {};
  const collect = (value) => {
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) {
        if (k !== "answerKey" && ANSWER_KEY_FIELDS.includes(k) && v !== void 0) {
          inline[k] = v;
        }
        collect(v);
      }
    }
  };
  collect(data);
  return Object.keys(inline).length > 0 ? inline : null;
}
async function saveSpaceService(input, ctx) {
  const tenantId = requireTenant(ctx);
  const data = input.data;
  const targetStatus = data["status"];
  const existing = input.id ? await ctx.repos.spaces.get(tenantId, input.id) : null;
  if (input.id && !existing) fail2("NOT_FOUND", "space not found");
  if (input.id && targetStatus) {
    const fromStatus = existing["status"] ?? "draft";
    const action = targetStatus === "archived" ? "space.archive" : "space.publish";
    authorize(ctx, action, { spaceId: input.id, tenantId });
    if (fromStatus !== targetStatus) {
      assertTransition2("space", fromStatus, targetStatus);
      if (targetStatus === "published") {
        const sps = await ctx.repos.storyPoints.list(tenantId, {
          where: { spaceId: input.id },
          limit: 1,
        });
        if (sps.items.length === 0) fail2("FAILED_PRECONDITION", "space has no content to publish");
      }
    }
  } else {
    authorize(ctx, "space.write", input.id ? { spaceId: input.id, tenantId } : { tenantId });
  }
  const mergedTitle = data["title"] ?? existing?.["title"];
  const mergedType = data["type"] ?? existing?.["type"];
  if (!input.id && (mergedTitle === void 0 || mergedType === void 0)) {
    fail2("VALIDATION_ERROR", "title and type are required to create a space");
  }
  const now = ctx.now();
  const isDelete = data["deleted"] === true;
  const doc = {
    ...(existing ?? {}),
    ...(input.id ? { id: input.id } : {}),
    ...data,
    ...(mergedTitle !== void 0 ? { title: mergedTitle } : {}),
    ...(mergedType !== void 0 ? { type: mergedType } : {}),
    accessType: data["accessType"] ?? existing?.["accessType"] ?? "class_assigned",
    status: targetStatus ?? existing?.["status"] ?? "draft",
    ...(targetStatus === "published" ? { publishedAt: now } : {}),
    ...(isDelete ? { archivedAt: now } : {}),
    createdBy: existing?.["createdBy"] ?? ctx.uid,
    updatedBy: ctx.uid,
  };
  const { id, created } = await ctx.repos.spaces.upsert(tenantId, doc, now);
  if (isDelete) return { id, deleted: true };
  return { id, created };
}
async function saveStoryPointService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "storyPoint.write", { spaceId: input.spaceId, tenantId });
  const now = ctx.now();
  const data = input.data;
  const isDelete = data["deleted"] === true;
  const doc = {
    ...(input.id ? { id: input.id } : {}),
    ...data,
    spaceId: input.spaceId,
    createdBy: ctx.uid,
    updatedBy: ctx.uid,
  };
  const { id, created } = await ctx.repos.storyPoints.upsert(tenantId, doc, now);
  if (isDelete) return { id, deleted: true };
  return { id, created };
}
async function saveItemService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "item.write", { spaceId: input.spaceId, tenantId });
  const now = ctx.now();
  const data = input.data;
  const isDelete = data["deleted"] === true;
  const answerKey = extractAnswerKey(data);
  const strippedData = stripAnswerFields(data);
  const doc = {
    ...(input.id ? { id: input.id } : {}),
    ...strippedData,
    spaceId: input.spaceId,
    storyPointId: input.storyPointId,
    // UnifiedItem invariants: required ordering + soft-delete tombstone.
    orderIndex: strippedData["orderIndex"] ?? 0,
    archivedAt: isDelete ? now : (strippedData["archivedAt"] ?? null),
    createdBy: ctx.uid,
    updatedBy: ctx.uid,
  };
  const { id, created } = await ctx.repos.items.upsert(tenantId, doc, now);
  if (answerKey && !isDelete) {
    await ctx.repos.answerKeys.put(tenantId, id, {
      ...answerKey,
      itemId: id,
      spaceId: input.spaceId,
      storyPointId: input.storyPointId,
    });
  }
  if (isDelete) return { id, deleted: true };
  return { id, created };
}
async function getItemForEditService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "item.readForEdit", { spaceId: input.spaceId, tenantId });
  const item = await ctx.repos.items.get(tenantId, input.itemId);
  if (!item) fail2("NOT_FOUND", "item not found");
  const key = await ctx.repos.answerKeys.get(tenantId, input.itemId);
  const merged = { ...item, ...(key ? { answerKey: key } : {}) };
  return { item: merged };
}
async function listItemsService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "space.read", { spaceId: input.spaceId, tenantId });
  const page = await ctx.repos.items.list(tenantId, {
    where: { spaceId: input.spaceId, storyPointId: input.storyPointId },
    cursor: input.cursor,
    limit: input.limit ?? 20,
  });
  const authoring = isAuthoringRole(ctx);
  const items = page.items.map((it) => projectItem(it, authoring));
  return { items, nextCursor: page.nextCursor };
}
function projectItem(item, authoring) {
  const stripped = stripAnswerFields(item);
  if (stripped["orderIndex"] === void 0 && typeof stripped["order"] === "number") {
    stripped["orderIndex"] = stripped["order"];
  }
  if (typeof stripped["orderIndex"] !== "number") stripped["orderIndex"] = 0;
  delete stripped["order"];
  delete stripped["durationSeconds"];
  if (stripped["rubric"] === void 0 && stripped["effectiveRubric"] !== void 0) {
    stripped["rubric"] = stripped["effectiveRubric"];
  }
  delete stripped["effectiveRubric"];
  if (stripped["rubric"]) stripped["rubric"] = projectRubric(stripped["rubric"], authoring);
  else delete stripped["rubric"];
  const norm = normalizeItemPayload(stripped["payload"], stripped);
  stripped["type"] = norm.type;
  stripped["payload"] = norm.payload;
  if (stripped["title"] === void 0 && norm.title !== void 0) stripped["title"] = norm.title;
  if (stripped["content"] === void 0 && norm.content !== void 0) {
    stripped["content"] = norm.content;
  }
  return stripped;
}
function projectStoryPoint(sp, authoring) {
  const stripped = stripAnswerFields(sp);
  if (stripped["orderIndex"] === void 0 && typeof stripped["order"] === "number") {
    stripped["orderIndex"] = stripped["order"];
  }
  if (typeof stripped["orderIndex"] !== "number") stripped["orderIndex"] = 0;
  delete stripped["order"];
  delete stripped["durationSeconds"];
  const stats = stripped["stats"];
  if (stats) {
    stripped["stats"] = {
      itemCount: typeof stats["itemCount"] === "number" ? stats["itemCount"] : 0,
      completionCount: typeof stats["completionCount"] === "number" ? stats["completionCount"] : 0,
    };
  }
  if (stripped["defaultRubric"]) {
    stripped["defaultRubric"] = projectRubric(stripped["defaultRubric"], authoring);
  }
  return stripped;
}
async function listSpacesService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "space.read", { tenantId });
  const filter = input;
  const where = {};
  if (filter.status) where["status"] = filter.status;
  if (filter.type) where["type"] = filter.type;
  if (filter.subject) where["subject"] = filter.subject;
  const page = await ctx.repos.spaces.list(tenantId, {
    where: Object.keys(where).length > 0 ? where : void 0,
    cursor: filter.cursor,
    limit: filter.limit ?? 20,
  });
  const authoring = isAuthoringRole(ctx);
  let items = page.items.map((s) => projectSpace(s, authoring));
  if (!authoring) items = items.filter((s) => s["status"] !== "draft");
  return { items, nextCursor: page.nextCursor };
}
async function getSpaceService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "space.read", { spaceId: input.spaceId, tenantId });
  const space = await ctx.repos.spaces.get(tenantId, input.spaceId);
  if (!space) fail2("NOT_FOUND", "space not found");
  return { space: projectSpace(space, isAuthoringRole(ctx)) };
}
function projectSpace(space, authoring) {
  const stripped = stripAnswerFields(space);
  if (stripped["defaultRubric"]) {
    stripped["defaultRubric"] = projectRubric(stripped["defaultRubric"], authoring);
  }
  const stats = stripped["stats"];
  if (stats) {
    stripped["stats"] = {
      storyPointCount: stats["storyPointCount"] ?? 0,
      itemCount: stats["itemCount"] ?? 0,
      enrolledCount: stats["enrolledCount"] ?? stats["enrollmentCount"] ?? 0,
    };
  }
  const rating = stripped["ratingAggregate"];
  if (rating) {
    stripped["ratingAggregate"] = {
      averageRating: rating["averageRating"] ?? rating["average"] ?? 0,
      totalReviews: rating["totalReviews"] ?? rating["count"] ?? 0,
      distribution: rating["distribution"] ?? {},
    };
  }
  const price = stripped["price"];
  if (typeof price === "number") {
    if (price > 0) stripped["price"] = { amountMinor: price, currency: "INR" };
    else delete stripped["price"];
  }
  return stripped;
}
async function listStoryPointsService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "space.read", { spaceId: input.spaceId, tenantId });
  const page = await ctx.repos.storyPoints.list(tenantId, {
    where: { spaceId: input.spaceId },
    limit: 200,
  });
  const authoring = isAuthoringRole(ctx);
  const items = page.items.map((sp) => projectStoryPoint(sp, authoring));
  return { items };
}
async function getStoryPointService(input, ctx) {
  const tenantId = requireTenant(ctx);
  const req = input;
  authorize(ctx, "space.read", { spaceId: req.spaceId, tenantId });
  const sp = await ctx.repos.storyPoints.get(tenantId, req.storyPointId);
  if (!sp) fail2("NOT_FOUND", "story point not found");
  return {
    storyPoint: projectStoryPoint(sp, isAuthoringRole(ctx)),
  };
}
var DETERMINISTIC_TYPES = /* @__PURE__ */ new Set([
  "mcq",
  "multiple_choice",
  "multi_select",
  "true_false",
  "fill_blank",
  "numeric",
  "matching",
  "ordering",
]);
function normalize(v) {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}
function arraysEqualAsSet(a, b) {
  if (a.length !== b.length) return false;
  const sa = new Set(a.map(normalize));
  return b.every((x) => sa.has(normalize(x)));
}
function autoEvaluateDeterministic(type, key, answer, maxScore = 1) {
  if (!DETERMINISTIC_TYPES.has(type) || !key) {
    return {
      evaluation: {
        score: 0,
        maxScore,
        correctness: 0,
        percentage: 0,
        strengths: [],
        weaknesses: [],
        missingConcepts: [],
      },
      aiPending: true,
    };
  }
  const correctAnswer = key["correctAnswer"];
  const acceptable = key["acceptableAnswers"] ?? [];
  let correct = false;
  if (Array.isArray(answer) && Array.isArray(correctAnswer)) {
    correct = arraysEqualAsSet(answer, correctAnswer);
  } else if (type === "numeric") {
    const tol = key["tolerance"] ?? 0;
    correct = Math.abs(Number(answer) - Number(correctAnswer)) <= tol;
  } else {
    correct =
      normalize(answer) === normalize(correctAnswer) ||
      acceptable.some((a) => normalize(a) === normalize(answer));
  }
  const score = correct ? maxScore : 0;
  return {
    evaluation: {
      score,
      maxScore,
      correctness: correct ? 1 : 0,
      percentage: maxScore > 0 ? (score / maxScore) * 100 : 0,
      strengths: correct ? ["Correct answer"] : [],
      weaknesses: correct ? [] : ["Incorrect answer"],
      missingConcepts: [],
    },
    aiPending: false,
  };
}
function storyPointTypeToSessionType(storyPointType) {
  switch (storyPointType) {
    case "quiz":
      return "quiz";
    case "test":
    case "exam":
      return "test";
    case "practice":
      return "practice";
    default:
      return "practice";
  }
}
async function applyProgress(args, ctx) {
  const tenantId = ctx.tenantId;
  if (!tenantId) throw new Error("progressUpdater requires a tenant on the context");
  return ctx.repos.progress.update(
    tenantId,
    {
      userId: args.userId,
      spaceId: args.spaceId,
      items: args.items,
      totalStoryPoints: args.totalStoryPoints,
    },
    ctx.now()
  );
}
var DEFAULT_SESSION_MINUTES = 30;
async function startTestSessionService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "testSession.start", { spaceId: input.spaceId, tenantId });
  const existing = await ctx.repos.testSessions.list(tenantId, {
    where: {
      userId: ctx.uid,
      spaceId: input.spaceId,
      storyPointId: input.storyPointId,
      status: "in_progress",
    },
    limit: 1,
  });
  if (existing.items.length > 0) {
    return { session: existing.items[0], resuming: true };
  }
  const storyPoint = await ctx.repos.storyPoints.get(tenantId, input.storyPointId);
  if (!storyPoint) fail2("NOT_FOUND", "story point not found");
  const now = ctx.now();
  const durationMin = storyPoint["durationMinutes"] ?? DEFAULT_SESSION_MINUTES;
  const serverDeadline = new Date(Date.parse(now) + durationMin * 60 * 1e3).toISOString();
  const priors = await ctx.repos.testSessions.list(tenantId, {
    where: { userId: ctx.uid, spaceId: input.spaceId, storyPointId: input.storyPointId },
    limit: 200,
  });
  const itemsPage = await ctx.repos.items.list(tenantId, {
    where: { spaceId: input.spaceId, storyPointId: input.storyPointId },
    limit: 200,
  });
  const questionOrder = itemsPage.items.map((it) => it["id"]);
  const session = {
    tenantId,
    userId: ctx.uid,
    spaceId: input.spaceId,
    storyPointId: input.storyPointId,
    sessionType: storyPointTypeToSessionType(storyPoint["type"] ?? "practice"),
    status: "in_progress",
    attemptNumber: priors.items.length + 1,
    isLatest: true,
    // timing
    startedAt: now,
    endedAt: null,
    durationMinutes: durationMin,
    serverDeadline,
    // question tracking (boolean maps are records, not arrays — D6)
    totalQuestions: questionOrder.length,
    answeredQuestions: 0,
    questionOrder,
    visitedQuestions: {},
    markedForReview: {},
    // audit
    submittedAt: null,
    autoSubmitted: false,
    createdAt: now,
    updatedAt: now,
  };
  const { id } = await ctx.repos.testSessions.upsert(tenantId, session, now);
  await ctx.repos.tx(async (tx) => {
    for (const p of priors.items) {
      if (p["isLatest"]) tx.upsert("testSessions", tenantId, { id: p["id"], isLatest: false });
    }
  });
  return { session: { ...session, id }, resuming: false };
}
async function saveTestAnswerService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "testSession.submit", { sessionId: input.sessionId, tenantId });
  const session = await ctx.repos.testSessions.get(tenantId, input.sessionId);
  if (!session) fail2("NOT_FOUND", "session not found");
  if (session["userId"] !== ctx.uid) fail2("PERMISSION_DENIED", "not your session");
  const now = ctx.now();
  const itemId = input.itemId;
  const existingSub = await xrepos(ctx).testSubmissions.get(tenantId, input.sessionId, itemId);
  await ctx.repos.tx(async (tx) => {
    xrepos(ctx).testSubmissions.put(tx, tenantId, input.sessionId, {
      itemId,
      answer: input.answer,
      submittedAt: now,
      ...(input.timeSpentSeconds !== void 0 ? { timeSpentSeconds: input.timeSpentSeconds } : {}),
    });
  });
  const visited = { ...(session["visitedQuestions"] ?? {}), [itemId]: true };
  const marked = { ...(session["markedForReview"] ?? {}) };
  if (input.markedForReview !== void 0) marked[itemId] = input.markedForReview;
  const prevAnswered = session["answeredQuestions"] ?? 0;
  const answeredQuestions = existingSub ? prevAnswered : prevAnswered + 1;
  await ctx.repos.tx(async (tx) => {
    tx.upsert("testSessions", tenantId, {
      id: input.sessionId,
      visitedQuestions: visited,
      markedForReview: marked,
      answeredQuestions,
    });
  });
  return { sessionId: input.sessionId, itemId, saved: true, answeredQuestions };
}
async function submitTestSessionService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "testSession.submit", { sessionId: input.sessionId, tenantId });
  const session = await ctx.repos.testSessions.get(tenantId, input.sessionId);
  if (!session) fail2("NOT_FOUND", "session not found");
  if (session["userId"] !== ctx.uid) fail2("PERMISSION_DENIED", "not your session");
  const currentStatus = session["status"] ?? "in_progress";
  if (currentStatus !== "in_progress") {
    return { session, progressUpdated: false };
  }
  assertTransition2("testSession", currentStatus, "completed");
  await ctx.repos.tx(async (tx) => {
    tx.upsert("testSessions", tenantId, {
      id: input.sessionId,
      status: "completed",
      autoSubmitted: input.autoSubmitted ?? false,
    });
  });
  const submissions = await xrepos(ctx).testSubmissions.list(tenantId, input.sessionId);
  const itemUpdates = [];
  let totalScore = 0;
  let totalMax = 0;
  let aiPending = 0;
  for (const sub of submissions) {
    const itemId = sub["itemId"];
    const type = sub["itemType"] ?? "short_answer";
    const maxScore = sub["maxScore"] ?? 1;
    const key = await ctx.repos.answerKeys.get(tenantId, itemId);
    const { evaluation, aiPending: pending } = autoEvaluateDeterministic(
      type,
      key,
      sub["answer"],
      maxScore
    );
    if (pending) aiPending++;
    totalScore += evaluation.score;
    totalMax += evaluation.maxScore;
    itemUpdates.push({
      storyPointId: session["storyPointId"],
      itemId,
      score: evaluation.score,
      maxScore: evaluation.maxScore,
      correct: evaluation.correctness >= 1,
      evaluation,
    });
    await ctx.repos.tx(async (tx) => {
      xrepos(ctx).testSubmissions.put(tx, tenantId, input.sessionId, {
        ...sub,
        evaluation,
        gradedAt: ctx.now(),
      });
    });
  }
  const progressResult = await applyProgress(
    { userId: ctx.uid, spaceId: session["spaceId"], items: itemUpdates },
    ctx
  );
  const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
  const now = ctx.now();
  const finalSession = {
    ...session,
    id: input.sessionId,
    status: "completed",
    // Mirror the claim-step write (§6.6 — server owns `autoSubmitted`) so the
    // returned ResultView matches the persisted doc a re-submit reads back.
    autoSubmitted: input.autoSubmitted ?? false,
    // DigitalTestSession score fields (canonical names — not totalScore/maxScore).
    pointsEarned: totalScore,
    totalPoints: totalMax,
    percentage,
    submittedAt: now,
    updatedAt: now,
  };
  await ctx.repos.testSessions.upsert(tenantId, finalSession, now);
  if (aiPending === 0) {
    await ctx.repos.tx(async (tx) => {
      tx.enqueueOutbox(tenantId, {
        type: "test.session.graded",
        tenantId,
        payload: { sessionId: input.sessionId, recipientUid: ctx.uid },
        createdAt: now,
        status: "pending",
        attempts: 0,
      });
    });
  }
  return { session: finalSession, progressUpdated: progressResult.completed };
}
async function getTestSessionService(input, ctx) {
  const tenantId = requireTenant(ctx);
  const session = await ctx.repos.testSessions.get(tenantId, input.sessionId);
  if (!session) fail2("NOT_FOUND", "session not found");
  if (session["userId"] !== ctx.uid) {
    authorize(ctx, "progress.read", { sessionId: input.sessionId, tenantId });
  }
  return { session };
}
async function listTestSessionsService(input, ctx) {
  const tenantId = requireTenant(ctx);
  const where = { userId: input.userId ?? ctx.uid };
  if (input.spaceId) where["spaceId"] = input.spaceId;
  if (input.storyPointId) where["storyPointId"] = input.storyPointId;
  if (input.status) where["status"] = input.status;
  if (input.latestOnly) where["isLatest"] = true;
  if ((input.userId ?? ctx.uid) !== ctx.uid) {
    authorize(ctx, "progress.read", { tenantId, studentId: input.userId });
  }
  const page = await ctx.repos.testSessions.list(tenantId, {
    where,
    cursor: input.cursor,
    limit: input.limit ?? 20,
  });
  return { items: page.items, nextCursor: page.nextCursor };
}
var QT_TO_GRADING = {
  mcaq: "multi_select",
  msq: "multi_select",
  "multiple-choice": "multiple_choice",
  "true-false": "true_false",
  numerical: "numeric",
  "fill-blanks": "fill_blank",
  "fill-blanks-dd": "fill_blank",
  jumbled: "ordering",
  text: "short_answer",
  paragraph: "long_answer",
  essay: "long_answer",
};
function normalizeQuestionType(t) {
  const k = String(t).trim();
  return QT_TO_GRADING[k] ?? k;
}
function answerHash(answer) {
  const s = typeof answer === "string" ? answer : JSON.stringify(answer ?? null);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
async function scoreOne(ctx, tenantId, item, itemId, answer) {
  const payload = item["payload"] ?? {};
  const question = payload["question"] ?? {};
  const questionData = payload["questionData"] ?? {};
  const ITEM_DISCRIMINATORS = /* @__PURE__ */ new Set([
    "question",
    "material",
    "interactive",
    "assessment",
    "discussion",
    "project",
    "checkpoint",
  ]);
  const rawType = item["type"];
  const type = normalizeQuestionType(
    (rawType && !ITEM_DISCRIMINATORS.has(rawType) ? rawType : void 0) ??
      questionData["questionType"] ??
      payload["questionType"] ??
      question["type"] ??
      item["questionType"] ??
      "short_answer"
  );
  const maxScore = item["maxScore"] ?? question["points"] ?? 1;
  const key = await ctx.repos.answerKeys.get(tenantId, itemId);
  if (DETERMINISTIC_TYPES.has(type)) {
    return autoEvaluateDeterministic(type, key, answer, maxScore).evaluation;
  }
  if ((type === "short_answer" || type === "fill_blank") && key) {
    const correct = String(key["correctAnswer"] ?? "")
      .trim()
      .toLowerCase();
    const acceptable = (key["acceptableAnswers"] ?? []).map((a) => String(a).trim().toLowerCase());
    const given = String(answer ?? "")
      .trim()
      .toLowerCase();
    const isCorrect = given.length > 0 && (given === correct || acceptable.includes(given));
    return {
      score: isCorrect ? maxScore : 0,
      maxScore,
      correctness: isCorrect ? 1 : 0,
      percentage: isCorrect ? 100 : 0,
      strengths: [],
      weaknesses: [],
      missingConcepts: [],
    };
  }
  const questionText = String(
    item["content"] ??
      question["text"] ??
      questionData["prompt"] ??
      questionData["text"] ??
      item["title"] ??
      ""
  );
  const ai = await ctx.ai.generate(
    {
      promptKey: "answerGrading",
      operation: "answer.evaluate",
      variables: {
        question: questionText,
        maxMarks: maxScore,
        rubric: JSON.stringify(item["effectiveRubric"] ?? item["rubric"] ?? {}),
        answer: typeof answer === "string" ? answer : JSON.stringify(answer ?? ""),
      },
    },
    { tenantId, uid: ctx.uid, now: ctx.now }
  );
  const raw = ai.json ?? {};
  const evaluation = {
    score: Number(raw["score"] ?? 0),
    maxScore,
    correctness: Number(raw["correctness"] ?? 0),
    percentage: Number(raw["percentage"] ?? 0),
    strengths: raw["strengths"] ?? [],
    weaknesses: raw["weaknesses"] ?? [],
    missingConcepts: raw["missingConcepts"] ?? [],
  };
  return stripEvaluationCost(evaluation);
}
async function evaluateAnswerService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "answer.evaluate", { spaceId: input.spaceId, tenantId });
  const dedupeKey2 = `evaluateAnswer:${input.spaceId}:${input.itemId}:${answerHash(input.answer)}`;
  return withIdempotency(ctx, tenantId, dedupeKey2, async () => {
    const item = await ctx.repos.items.get(tenantId, input.itemId);
    if (!item) fail2("NOT_FOUND", "item not found");
    const evaluation = await scoreOne(ctx, tenantId, item, input.itemId, input.answer);
    let progressRecorded = false;
    if (input.storyPointId) {
      await applyProgress(
        {
          userId: ctx.uid,
          spaceId: input.spaceId,
          items: [
            {
              storyPointId: input.storyPointId,
              itemId: input.itemId,
              score: evaluation.score,
              maxScore: evaluation.maxScore,
              correct: evaluation.correctness >= 1,
              evaluation,
            },
          ],
        },
        ctx
      );
      progressRecorded = true;
    }
    return { evaluation, progressRecorded };
  });
}
async function recordItemAttemptService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "itemAttempt.record", { spaceId: input.spaceId, tenantId });
  const dedupeKey2 = `recordItemAttempt:${input.spaceId}:${input.storyPointId}:${input.itemId}:${answerHash(input.answer)}`;
  return withIdempotency(ctx, tenantId, dedupeKey2, async () => {
    const item = await ctx.repos.items.get(tenantId, input.itemId);
    if (!item) fail2("NOT_FOUND", "item not found");
    const evaluation = await scoreOne(ctx, tenantId, item, input.itemId, input.answer);
    const result = await applyProgress(
      {
        userId: ctx.uid,
        spaceId: input.spaceId,
        items: [
          {
            storyPointId: input.storyPointId,
            itemId: input.itemId,
            score: evaluation.score,
            maxScore: evaluation.maxScore,
            correct: evaluation.correctness >= 1,
            timeSpentMs: input.timeSpent,
            evaluation,
          },
        ],
      },
      ctx
    );
    return {
      progress: {
        itemId: input.itemId,
        completed: result.completed,
        bestScore: evaluation.score,
        latestScore: evaluation.score,
        percentage: evaluation.percentage,
        solved: evaluation.correctness >= 1,
        evaluation,
      },
      completed: result.completed,
    };
  });
}
async function getSpaceProgressService(input, ctx) {
  const tenantId = requireTenant(ctx);
  const targetUid = input.userId ?? ctx.uid;
  if (targetUid !== ctx.uid) authorize(ctx, "progress.read", { tenantId, studentId: targetUid });
  const progress = await ctx.repos.progress.get(tenantId, targetUid, input.spaceId);
  return {
    progress: progress ? projectSpaceProgress(progress) : null,
  };
}
async function getStoryPointProgressService(input, ctx) {
  const tenantId = requireTenant(ctx);
  const targetUid = input.userId ?? ctx.uid;
  if (targetUid !== ctx.uid) authorize(ctx, "progress.read", { tenantId, studentId: targetUid });
  const progress = await xrepos(ctx).storyPointProgress.get(
    tenantId,
    targetUid,
    input.spaceId,
    input.storyPointId
  );
  return { progress: progress ?? null };
}
function toStoreListing(space) {
  return {
    id: space["id"],
    sourceTenantId: space["tenantId"],
    title: space["title"],
    price: space["price"] ?? { amountMinor: 0, currency: "INR" },
    accessType: space["accessType"] ?? "public_store",
    ...(space["storeDescription"] ? { storeDescription: space["storeDescription"] } : {}),
    ...(space["storeThumbnailUrl"] ? { storeThumbnailUrl: space["storeThumbnailUrl"] } : {}),
    ...(space["ratingAggregate"] ? { ratingAggregate: space["ratingAggregate"] } : {}),
  };
}
async function listStoreSpacesService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "space.read", { tenantId });
  const filter = input;
  const page = await ctx.repos.spaces.list(tenantId, {
    where: { publishedToStore: true },
    cursor: filter.cursor,
    limit: filter.limit ?? 20,
  });
  const items = page.items.map((s) => toStoreListing(s));
  return { items, nextCursor: page.nextCursor };
}
async function purchaseSpaceService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "space.purchase", { spaceId: input.spaceId, tenantId });
  return withIdempotency(ctx, tenantId, `purchaseSpace:${input.spaceId}`, async () => {
    const space = await ctx.repos.spaces.get(tenantId, input.spaceId);
    if (!space) fail2("NOT_FOUND", "space not found");
    if (space["status"] !== "published") fail2("FAILED_PRECONDITION", "space is not purchasable");
    if (await xrepos(ctx).consumerProfiles.isEnrolled(ctx.uid, input.spaceId)) {
      return { success: true, transactionId: "already_enrolled", enrolledSpaceId: input.spaceId };
    }
    const price = space["price"]?.amountMinor ?? 0;
    if (price > 0 && !input.paymentToken) fail2("PAYMENT_FAILED", "payment token required");
    const transactionId = `txn_${Date.parse(ctx.now())}`;
    const now = ctx.now();
    await ctx.repos.tx(async (tx) => {
      xrepos(ctx).consumerProfiles.enroll(tx, ctx.uid, input.spaceId, {
        spaceId: input.spaceId,
        transactionId,
        amount: price,
        purchasedAt: now,
        uid: ctx.uid,
      });
    });
    return { success: true, transactionId, enrolledSpaceId: input.spaceId };
  });
}
async function sendChatMessageService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "space.read", { spaceId: input.spaceId, tenantId });
  const now = ctx.now();
  const chat = xrepos(ctx).chat;
  let sessionId = input.sessionId;
  if (!sessionId) {
    sessionId = await chat.createSession(tenantId, {
      tenantId,
      userId: ctx.uid,
      spaceId: input.spaceId,
      storyPointId: input.storyPointId,
      itemId: input.itemId,
      sessionTitle: "Tutor chat",
      previewMessage: input.text,
      language: input.language ?? "en",
      isActive: true,
      messageCount: 0,
      createdBy: ctx.uid,
      updatedBy: ctx.uid,
    });
  }
  await chat.appendMessage(tenantId, sessionId, {
    role: "user",
    text: input.text,
    timestamp: now,
    ...(input.mediaUrls ? { mediaUrls: input.mediaUrls } : {}),
  });
  let replyText = "Let me help you with that.";
  let tokensUsed;
  try {
    const ai = await ctx.ai.generate(
      {
        promptKey: "tutorChat",
        operation: "chat.reply",
        variables: { text: input.text, spaceId: input.spaceId, itemId: input.itemId },
      },
      { tenantId, uid: ctx.uid, now: ctx.now }
    );
    const raw = ai.json ?? {};
    if (typeof raw["text"] === "string" && raw["text"]) replyText = raw["text"];
    else if (typeof ai.text === "string" && ai.text) replyText = ai.text;
    if (typeof ai.tokensUsed === "number") tokensUsed = ai.tokensUsed;
  } catch {}
  const messageId = await chat.appendMessage(tenantId, sessionId, {
    role: "assistant",
    text: replyText,
    timestamp: now,
    ...(tokensUsed !== void 0 ? { tokensUsed } : {}),
  });
  return {
    sessionId,
    message: {
      id: messageId,
      role: "assistant",
      text: replyText,
      timestamp: now,
      ...(tokensUsed !== void 0 ? { tokensUsed } : {}),
    },
    ...(tokensUsed !== void 0 ? { tokensUsed } : {}),
  };
}
function resolveTarget(ctx, userId) {
  const target = userId ?? ctx.uid;
  if (target !== ctx.uid) {
    authorize(ctx, "progress.read", { tenantId: ctx.tenantId ?? void 0, studentId: target });
  }
  return target;
}
async function getGamificationSummaryService(input, ctx) {
  const tenantId = requireTenant(ctx);
  const target = resolveTarget(ctx, input.userId);
  const summary = await xrepos(ctx).gamification.getSummary(tenantId, target);
  return summary;
}
async function getStudentLevelService(input, ctx) {
  const tenantId = requireTenant(ctx);
  const target = resolveTarget(ctx, input.userId);
  const level = await xrepos(ctx).gamification.getStudentLevel(tenantId, target);
  return level;
}
async function listAchievementsService(input, ctx) {
  const tenantId = requireTenant(ctx);
  const where = {};
  if (input.category) where["category"] = input.category;
  if (input.onlyActive) where["isActive"] = true;
  const earned = await xrepos(ctx).gamification.earnedAchievementIds(tenantId, ctx.uid);
  const page = await ctx.repos.spaces.list(tenantId, {
    where,
    cursor: input.cursor,
    limit: input.limit ?? 20,
  });
  const items = page.items.map((a) => ({ ...a, earned: earned.has(a["id"]) }));
  return { items, nextCursor: page.nextCursor };
}
async function listStudentAchievementsService(input, ctx) {
  const tenantId = requireTenant(ctx);
  const target = resolveTarget(ctx, input.userId);
  const page = await ctx.repos.spaces.list(tenantId, {
    where: { userId: target, ...(input.unseenOnly ? { seen: false } : {}) },
    cursor: input.cursor,
    limit: input.limit ?? 20,
  });
  return { items: page.items, nextCursor: page.nextCursor };
}
async function markAchievementsSeenService(input, ctx) {
  const tenantId = requireTenant(ctx);
  const ids = input.mode === "ids" ? input.achievementIds : "all";
  const updated = await xrepos(ctx).gamification.markSeen(tenantId, ctx.uid, ids, ctx.now());
  return { updated };
}
async function saveAchievementDefinitionService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "preset.global.write", { tenantId });
  const { id, created } = await xrepos(ctx).gamification.saveDefinition(
    tenantId,
    { id: input.id, data: input.data },
    ctx.now()
  );
  return { id, created };
}
async function levelupGetLeaderboardService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "progress.read", { tenantId });
  const params = { spaceId: input.spaceId, storyPointId: input.storyPointId };
  const page = await xrepos(ctx).leaderboard.getPage(tenantId, input.scope, params, {
    cursor: input.cursor,
    limit: input.limit ?? 20,
  });
  const callerEntry = await xrepos(ctx).leaderboard.callerEntry(
    tenantId,
    ctx.uid,
    input.scope,
    params
  );
  return { items: page.items, nextCursor: page.nextCursor, callerEntry: callerEntry ?? null };
}
async function listStudyGoalsService(input, ctx) {
  const tenantId = requireTenant(ctx);
  const target = resolveTarget(ctx, input.userId);
  const page = await xrepos(ctx).studyGoals.list(tenantId, target, {
    includeCompleted: input.includeCompleted,
    cursor: input.cursor,
    limit: input.limit ?? 20,
  });
  return { items: page.items, nextCursor: page.nextCursor };
}
async function saveStudyGoalService(input, ctx) {
  const tenantId = requireTenant(ctx);
  const data = { ...input.data };
  delete data["currentCount"];
  delete data["completed"];
  const { id, created } = await xrepos(ctx).studyGoals.save(
    tenantId,
    ctx.uid,
    { id: input.id, data },
    ctx.now()
  );
  return { id, created };
}
async function listStudySessionsService(input, ctx) {
  const tenantId = requireTenant(ctx);
  const target = resolveTarget(ctx, input.userId);
  const res = await xrepos(ctx).gamification.listSessions(tenantId, target, {
    fromDate: input.fromDate,
    toDate: input.toDate,
  });
  return res;
}
async function listLearningInsightsService(input, ctx) {
  const tenantId = requireTenant(ctx);
  const studentId = input.studentId ?? ctx.uid;
  if (studentId !== ctx.uid) authorize(ctx, "progress.read", { tenantId, studentId });
  const page = await xrepos(ctx).insights.list(tenantId, {
    studentId,
    type: input.type,
    cursor: input.cursor,
    limit: input.limit ?? 20,
  });
  return { items: page.items, nextCursor: page.nextCursor };
}
async function levelupDismissInsightService(input, ctx) {
  const tenantId = requireTenant(ctx);
  await xrepos(ctx).insights.dismiss(tenantId, ctx.uid, input.insightId, ctx.now());
  return { id: input.insightId, dismissed: true };
}
async function expireAndGradeSessionService(args, ctx) {
  const tenantId = ctx.tenantId;
  if (!tenantId) return;
  const session = await ctx.repos.testSessions.get(tenantId, args.sessionId);
  if (!session || session["status"] !== "in_progress") return;
  assertTransition2("testSession", "in_progress", "expired");
  await ctx.repos.tx(async (tx) => {
    tx.upsert("testSessions", tenantId, {
      id: args.sessionId,
      status: "expired",
      autoSubmitted: true,
    });
  });
  const submissions = await xrepos(ctx).testSubmissions.list(tenantId, args.sessionId);
  const items = [];
  for (const sub of submissions) {
    const key = await ctx.repos.answerKeys.get(tenantId, sub["itemId"]);
    const { evaluation } = autoEvaluateDeterministic(
      sub["itemType"] ?? "short_answer",
      key,
      sub["answer"],
      sub["maxScore"] ?? 1
    );
    items.push({
      storyPointId: session["storyPointId"],
      itemId: sub["itemId"],
      score: evaluation.score,
      maxScore: evaluation.maxScore,
      correct: evaluation.correctness >= 1,
      evaluation,
    });
  }
  await applyProgress({ userId: session["userId"], spaceId: session["spaceId"], items }, ctx);
}
async function expireTestSessionsService(ctx) {
  const tenantId = ctx.tenantId ?? "__platform__";
  const now = ctx.now();
  const page = await ctx.repos.testSessions.list(tenantId, {
    where: { status: "in_progress" },
    limit: 200,
  });
  for (const s of page.items) {
    const deadline = s["serverDeadline"];
    if (deadline && Date.parse(deadline) < Date.parse(now)) {
      await expireAndGradeSessionService({ sessionId: s["id"] }, ctx);
    }
  }
}
async function cleanupStaleSessionsService(ctx) {
  const tenantId = ctx.tenantId ?? "__platform__";
  const now = ctx.now();
  const staleCutoff = Date.parse(now) - 24 * 60 * 60 * 1e3;
  const page = await ctx.repos.testSessions.list(tenantId, {
    where: { status: "in_progress" },
    limit: 200,
  });
  for (const s of page.items) {
    const deadline = s["serverDeadline"];
    if (deadline && Date.parse(deadline) < Date.parse(now)) continue;
    const startedAt = s["startedAt"];
    if (startedAt && Date.parse(startedAt) < staleCutoff) {
      assertTransition2("testSession", "in_progress", "abandoned");
      await ctx.repos.testSessions.upsert(tenantId, { id: s["id"], status: "abandoned" }, now);
    }
  }
}
async function emitNotificationService(input, ctx) {
  const now = ctx.now();
  let created = 0;
  for (const uid of input.recipientUids) {
    const prefs = await xrepos(ctx).notificationReads.getPreferences(input.tenantId, uid);
    const enabledTypes = prefs?.["enabledTypes"];
    if (enabledTypes && !enabledTypes.includes(input.type)) continue;
    const muteUntil = prefs?.["muteUntil"];
    if (muteUntil && Date.parse(muteUntil) > Date.parse(now)) continue;
    await ctx.repos.tx(async (tx) => {
      tx.upsert("notifications", input.tenantId, {
        recipientUid: uid,
        type: input.type,
        title: input.title,
        body: input.body,
        payload: input.payload ?? {},
        isRead: false,
        createdAt: now,
        dedupeKey: input.dedupeKey,
      });
    });
    const unread = await xrepos(ctx).notificationReads.unreadCount(input.tenantId, uid);
    await xrepos(ctx).badges.set(uid, input.tenantId, {
      unreadCount: unread,
      updatedAt: Date.parse(now),
    });
    created++;
  }
  return { created };
}
async function listNotificationsService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "notification.read", { tenantId });
  const page = await ctx.repos.notifications.list(tenantId, {
    where: { recipientUid: ctx.uid },
    cursor: input.cursor,
    limit: input.limit ?? 20,
    orderBy: "createdAt",
  });
  return { items: page.items, nextCursor: page.nextCursor };
}
async function getNotificationBadgeService(_input, ctx) {
  const tenantId = requireTenant(ctx);
  const badge = await xrepos(ctx).badges.get(ctx.uid, tenantId);
  return badge;
}
async function markNotificationReadService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "notification.markRead", { tenantId });
  const now = ctx.now();
  const notificationId = input.mode === "one" ? input.notificationId : null;
  const unreadCount = await xrepos(ctx).notificationReads.markRead(
    tenantId,
    ctx.uid,
    notificationId,
    now
  );
  await xrepos(ctx).badges.set(ctx.uid, tenantId, { unreadCount, updatedAt: Date.parse(now) });
  return { unreadCount };
}
async function getNotificationPreferencesService(_input, ctx) {
  const tenantId = requireTenant(ctx);
  const prefs = await xrepos(ctx).notificationReads.getPreferences(tenantId, ctx.uid);
  return {
    id: ctx.uid,
    tenantId,
    userId: ctx.uid,
    enabledTypes: prefs?.["enabledTypes"] ?? [],
    muteUntil: prefs?.["muteUntil"] ?? null,
  };
}
async function saveNotificationPreferencesService(input, ctx) {
  const tenantId = requireTenant(ctx);
  const now = ctx.now();
  await xrepos(ctx).notificationReads.savePreferences(
    tenantId,
    ctx.uid,
    { enabledTypes: input.enabledTypes ?? [], muteUntil: input.muteUntil ?? null },
    now
  );
  return {
    id: ctx.uid,
    tenantId,
    userId: ctx.uid,
    enabledTypes: input.enabledTypes ?? [],
    muteUntil: input.muteUntil ?? null,
  };
}
async function saveAnnouncementService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "announcement.write", { tenantId });
  if (input.delete && input.id) {
    await ctx.repos.announcements.delete(tenantId, input.id);
    return { id: input.id, deleted: true };
  }
  const existing = input.id ? await ctx.repos.announcements.get(tenantId, input.id) : null;
  const from = existing?.["status"] ?? "draft";
  const to = input.data.status ?? from;
  if (to !== from) assertTransition2("announcement", from, to);
  const now = ctx.now();
  const { id, created } = await ctx.repos.announcements.upsert(
    tenantId,
    {
      ...(existing ?? {}),
      ...input.data,
      ...(input.id ? { id: input.id } : {}),
      status: to,
      authorUid: existing?.["authorUid"] ?? ctx.uid,
      ...(to === "published" && from !== "published" ? { publishedAt: now } : {}),
    },
    now
  );
  return { id, created };
}
async function listAnnouncementsService(input, ctx) {
  const tenantId = requireTenant(ctx);
  const where = {};
  if (input.scope) where["scope"] = input.scope;
  if (input.status) where["status"] = input.status;
  const page = await ctx.repos.announcements.list(tenantId, {
    where,
    cursor: input.cursor,
    limit: input.limit ?? 20,
  });
  const items = await Promise.all(
    // Project the stored Announcement doc → the strict SLIM `AnnouncementListItem`
    // (id/title/body/scope/status/authorName/publishedAt/expiresAt + caller-relative
    // isReadByMe). Defensive canonicalization (like projectSpace): drop every
    // non-slim key the full doc carries (tenantId/authorUid/targetRoles/audit…),
    // coerce a legacy/targeted `scope` (e.g. seed 'class') to the canonical
    // platform|tenant vocabulary (only an explicit 'platform' stays platform; any
    // tenant-internal/targeted announcement is 'tenant'), and null-fill the
    // nullable timestamps so an absent value validates.
    page.items.map(async (a) => ({
      id: a["id"],
      title: a["title"] ?? "",
      body: a["body"] ?? "",
      scope: a["scope"] === "platform" ? "platform" : "tenant",
      status: a["status"],
      authorName: a["authorName"] ?? "",
      publishedAt: a["publishedAt"] ?? null,
      expiresAt: a["expiresAt"] ?? null,
      isReadByMe: await xrepos(ctx).announcementReads.isReadBy(tenantId, a["id"], ctx.uid),
    }))
  );
  return { items, nextCursor: page.nextCursor };
}
async function markAnnouncementReadService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "notification.markRead", { tenantId });
  await xrepos(ctx).announcementReads.markRead(tenantId, input.announcementId, ctx.uid, ctx.now());
  return { isReadByMe: true };
}
async function estimateAudienceService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "announcement.write", { tenantId });
  let recipientCount = 0;
  const classIds = input.targetClassIds ?? [];
  for (const classId of classIds) {
    const page = await ctx.repos.students.list(tenantId, {
      where: { classIds: classId },
      limit: 200,
    });
    recipientCount += page.items.length;
  }
  if (classIds.length === 0 && input.targetRoles?.length) {
    const page = await ctx.repos.students.list(tenantId, { limit: 200 });
    recipientCount = page.items.length;
  }
  return { recipientCount };
}
async function registerDeviceTokenService(input, ctx) {
  const tenantId = requireTenant(ctx);
  await xrepos(ctx).devices.register(
    ctx.uid,
    tenantId,
    input.token,
    input.platform,
    input.appKey,
    ctx.now()
  );
  return { ok: true };
}
async function unregisterDeviceTokenService(input, ctx) {
  const tenantId = requireTenant(ctx);
  await xrepos(ctx).devices.unregister(ctx.uid, tenantId, input.token);
  return { ok: true };
}
async function sendDirectMessageService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "announcement.write", { tenantId });
  if (input.recipientUids.length === 0) fail2("INVALID_ARGUMENT", "no recipients");
  const { created } = await emitNotificationService(
    {
      tenantId,
      recipientUids: input.recipientUids,
      type: "direct_message",
      title: input.title,
      body: input.body,
    },
    ctx
  );
  return { sent: true, count: created };
}
var POST_PUBLISH_LOCKED_FIELDS = [
  "totalMarks",
  "passingMarks",
  "gradingConfig",
  "evaluationSettingsId",
];
var DEFAULT_GRADING_CONFIG = {
  autoGrade: true,
  allowRubricEdit: true,
  allowManualOverride: true,
  requireOverrideReason: false,
  releaseResultsAutomatically: false,
};
async function saveExamService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "exam.write", { examId: input.id, tenantId });
  const existing = input.id ? await ctx.repos.exams.get(tenantId, input.id) : null;
  if (input.id && !existing) fail2("NOT_FOUND", `exam ${input.id} not found`);
  const data = input.data;
  const currentStatus = existing?.["status"] ?? "draft";
  if (data.status && data.status !== currentStatus) {
    if (data.status === "published") {
      authorize(ctx, "exam.publish", { examId: input.id, tenantId });
    }
    assertTransition2("exam", currentStatus, data.status);
    if (data.status === "published") {
      await validatePublish(ctx, tenantId, input.id);
    }
  }
  if (existing && currentStatus !== "draft" && isPublished(currentStatus)) {
    for (const f of POST_PUBLISH_LOCKED_FIELDS) {
      if (f in data && data[f] !== void 0) {
        fail2("INVALID_ARGUMENT", `field "${f}" is locked after publish`);
      }
    }
  }
  if (data.linkedSpaceId) {
    const space = await ctx.repos.spaces.get(tenantId, data.linkedSpaceId);
    if (!space)
      fail2("INVALID_ARGUMENT", `linkedSpaceId ${data.linkedSpaceId} not found in tenant`);
  }
  const now = ctx.now();
  const payload = {
    ...(existing ?? {}),
    ...data,
    ...(input.id ? { id: input.id } : {}),
    questionPaper: buildQuestionPaper(existing, data),
    gradingConfig: data.gradingConfig ?? existing?.["gradingConfig"] ?? DEFAULT_GRADING_CONFIG,
    status: data.status ?? currentStatus,
    createdBy: existing?.["createdBy"] ?? ctx.uid,
  };
  delete payload["questionPaperImages"];
  const { id, created } = await ctx.repos.exams.upsert(tenantId, payload, now);
  if (data.status === "published" && currentStatus !== "published") {
    await ctx.repos.tx(async (tx) => {
      enqueueOutboxEvent(tx, {
        type: "exam.published",
        tenantId,
        payload: { examId: id },
        createdAt: now,
      });
    });
  }
  return { id, created };
}
function isPublished(status) {
  return status === "published" || status === "grading" || status === "results_released";
}
function buildQuestionPaper(existing, data) {
  if (!data.questionPaperImages || data.questionPaperImages.length === 0) {
    return existing?.["questionPaper"];
  }
  const prev = existing?.["questionPaper"] ?? {};
  return {
    ...prev,
    images: data.questionPaperImages,
    questionCount: prev["questionCount"] ?? 0,
    examType: "standard",
  };
}
async function validatePublish(ctx, tenantId, examId) {
  const page = await ctx.repos.exams.get(tenantId, examId);
  if (!page) fail2("NOT_FOUND", `exam ${examId} not found`);
  const questionCount = page["questionPaper"]?.["questionCount"];
  if (!questionCount || questionCount < 1) {
    fail2("FAILED_PRECONDITION", "cannot publish: exam has no extracted questions");
  }
}
var RELEASABLE_PIPELINE_STATUSES = /* @__PURE__ */ new Set([
  "grading_complete",
  "ready_for_review",
  "reviewed",
]);
async function releaseResultsService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "exam.results.release", { examId: input.examId, tenantId });
  const exam = await ctx.repos.exams.get(tenantId, input.examId);
  if (!exam) fail2("NOT_FOUND", `exam ${input.examId} not found`);
  const now = ctx.now();
  const currentStatus = exam["status"] ?? "grading";
  if (currentStatus !== "results_released") {
    assertTransition2("exam", currentStatus, "results_released");
  }
  const classIds = input.classIds ? new Set(input.classIds) : null;
  const submissions = await listAllSubmissions(ctx, tenantId, input.examId);
  const releasable = submissions.filter((s) => {
    if (s["resultsReleased"] === true) return false;
    if (classIds && !classIds.has(s["classId"])) return false;
    return RELEASABLE_PIPELINE_STATUSES.has(s["pipelineStatus"]);
  });
  let releasedCount = 0;
  for (const sub of releasable) {
    await ctx.repos.submissions.upsert(
      tenantId,
      { id: sub["id"], resultsReleased: true, resultsReleasedAt: now, resultsReleasedBy: ctx.uid },
      now
    );
    releasedCount += 1;
  }
  await ctx.repos.tx(async (tx) => {
    tx.upsert("exams", tenantId, { id: input.examId, status: "results_released" });
    enqueueOutboxEvent(tx, {
      type: "exam.results.released",
      tenantId,
      payload: { examId: input.examId, releasedCount },
      createdAt: now,
    });
  });
  return { id: input.examId, releasedCount, created: false };
}
async function listAllSubmissions(ctx, tenantId, examId) {
  const out = [];
  let cursor;
  do {
    const page = await ctx.repos.submissions.list(tenantId, {
      where: { examId },
      cursor,
      limit: 200,
    });
    out.push(...page.items);
    cursor = page.nextCursor ?? void 0;
  } while (cursor);
  return out;
}
async function extractQuestionsService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "questions.extract", { examId: input.examId, tenantId });
  const exam = await ctx.repos.exams.get(tenantId, input.examId);
  if (!exam) fail2("NOT_FOUND", `exam ${input.examId} not found`);
  const paper = exam["questionPaper"];
  const images = paper?.["images"] ?? [];
  if (images.length === 0) {
    fail2("FAILED_PRECONDITION", "cannot extract: no question-paper images uploaded");
  }
  const mode = input.mode ?? "full";
  const now = ctx.now();
  const ai = await ctx.ai.generate(
    {
      promptKey: "questionExtraction",
      operation: "questions.extract",
      variables: {
        examId: input.examId,
        mode,
        questionNumber: input.questionNumber,
        totalMarks: exam["totalMarks"],
      },
      images: images.map((path) => ({ base64: path, mimeType: "image/jpeg" })),
      responseSchema: { type: "array" },
    },
    { tenantId, uid: ctx.uid, now: ctx.now, examId: input.examId }
  );
  const raw = Array.isArray(ai.json) ? ai.json : [];
  const questions = raw.map((q, i) => ({
    text: q.text ?? "",
    maxMarks: q.maxMarks ?? 0,
    order: q.order ?? i + 1,
    rubric: q.rubric,
    questionType: q.questionType,
    subQuestions: q.subQuestions,
    extractionConfidence: q.extractionConfidence,
    readabilityIssue: q.readabilityIssue,
  }));
  const warnings = [];
  if (questions.some((q) => q.readabilityIssue)) {
    warnings.push("one or more questions had readability issues");
  }
  const imageQualityAcceptable = !questions.some((q) => q.readabilityIssue);
  await ctx.repos.tx(async (tx) => {
    for (const q of questions) {
      tx.upsert("exams", tenantId, {
        // questions are stored as a nested collection in the real adapter; the
        // testing twin flattens. We mark the parent + write via the exam repo path.
        examId: input.examId,
        ...q,
        _kind: "examQuestion",
      });
    }
    tx.upsert("exams", tenantId, {
      id: input.examId,
      status: "question_paper_extracted",
      questionPaper: { ...(paper ?? {}), questionCount: questions.length, extractedAt: now },
    });
  });
  const currentStatus = exam["status"] ?? "question_paper_uploaded";
  if (currentStatus !== "question_paper_extracted") {
    assertTransition2("exam", currentStatus, "question_paper_extracted");
  }
  return {
    success: true,
    questions,
    warnings,
    metadata: {
      questionCount: questions.length,
      tokensUsed: ai.tokensUsed,
      cost: ai.costUsd,
      extractedAt: now,
      imageQualityAcceptable,
      mode,
    },
  };
}
async function listExamQuestions(ctx, tenantId, examId) {
  const out = [];
  let cursor;
  do {
    const page = await ctx.repos.exams.list(tenantId, {
      where: { examId },
      filter: (d) => d["_kind"] === "examQuestion",
      cursor,
      limit: 200,
    });
    out.push(...page.items);
    cursor = page.nextCursor ?? void 0;
  } while (cursor);
  out.sort((a, b) => (a["order"] ?? 0) - (b["order"] ?? 0));
  return out;
}
async function listQuestionSubmissions(ctx, tenantId, submissionId) {
  const out = [];
  let cursor;
  do {
    const page = await ctx.repos.submissions.list(tenantId, {
      where: { submissionId },
      filter: (d) => d["_kind"] === "questionSubmission",
      cursor,
      limit: 200,
    });
    out.push(...page.items);
    cursor = page.nextCursor ?? void 0;
  } while (cursor);
  return out;
}
async function processAnswerMappingService(input, ctx) {
  const tenantId = requireTenant(ctx);
  const sub = await ctx.repos.submissions.get(tenantId, input.submissionId);
  if (!sub) fail2("NOT_FOUND", `submission ${input.submissionId} not found`);
  const examId = sub["examId"];
  const questions = await listExamQuestions(ctx, tenantId, examId);
  const images = sub["answerSheets"]?.["images"];
  const ai = await ctx.ai.generate(
    {
      promptKey: "answerMapping",
      operation: "answer.mapping",
      variables: {
        submissionId: input.submissionId,
        examId,
        // The `answerMapping` prompt requires a `questions` variable (registry
        // requiredVariables); pass the question-id list under that exact name.
        questions: questions.map((q) => q["id"]),
      },
      images: (images ?? []).map((path) => ({ base64: path, mimeType: "image/jpeg" })),
      responseSchema: { type: "object" },
    },
    { tenantId, uid: ctx.uid, now: ctx.now, examId }
  );
  const mapping = ai.json ?? {};
  const routingMap = mapping.routingMap ?? {};
  const confidence = mapping.confidence ?? {};
  const now = ctx.now();
  await ctx.repos.submissions.upsert(
    tenantId,
    {
      id: input.submissionId,
      scoutingResult: { routingMap, confidence, completedAt: now },
      summary: {
        ...sub["summary"],
        totalQuestions: questions.length,
      },
    },
    now
  );
  for (const q of questions) {
    const qid = q["id"];
    const pageIndices = routingMap[qid] ?? [];
    await ctx.repos.submissions.upsert(
      tenantId,
      {
        submissionId: input.submissionId,
        questionId: qid,
        examId,
        mapping: { pageIndices, imageUrls: [], scoutedAt: now },
        gradingStatus: "pending",
        gradingRetryCount: 0,
        _kind: "questionSubmission",
      },
      now
    );
  }
}
async function resolveRubricService(ctx, tenantId, exam, question) {
  const rubric = question["rubric"] ?? null;
  let confidenceConfig = null;
  const settingsId = exam["evaluationSettingsId"];
  if (settingsId) {
    const settings = await ctx.repos.tenants.get(tenantId, settingsId);
    confidenceConfig = settings?.["confidenceConfig"] ?? null;
  }
  if (!confidenceConfig) {
    confidenceConfig = {
      confidenceThreshold: 0.7,
      autoApproveThreshold: 0.9,
      requireReviewForPartialCredit: true,
    };
  }
  return { rubric, confidenceConfig };
}
async function processAnswerGradingService(input, ctx) {
  const tenantId = requireTenant(ctx);
  const sub = await ctx.repos.submissions.get(tenantId, input.submissionId);
  if (!sub) fail2("NOT_FOUND", `submission ${input.submissionId} not found`);
  const examId = sub["examId"];
  const exam = await ctx.repos.exams.get(tenantId, examId);
  if (!exam) fail2("NOT_FOUND", `exam ${examId} not found`);
  const questionsById = new Map(
    (await listExamQuestions(ctx, tenantId, examId)).map((q) => [q["id"], q])
  );
  const qsubs = await listQuestionSubmissions(ctx, tenantId, input.submissionId);
  const targetSet = input.questionIds ? new Set(input.questionIds) : null;
  let gradedCount = 0;
  let needsReviewCount = 0;
  let failedCount = 0;
  let batchIndex = 0;
  for (const qsub of qsubs) {
    const status = qsub["gradingStatus"];
    const questionId = qsub["questionId"];
    if (targetSet && !targetSet.has(questionId)) continue;
    if (status !== "pending" && status !== "failed") {
      if (status === "graded" || status === "overridden" || status === "manual") gradedCount += 1;
      if (status === "needs_review") needsReviewCount += 1;
      continue;
    }
    const question = questionsById.get(questionId);
    if (!question) {
      failedCount += 1;
      continue;
    }
    const { rubric, confidenceConfig } = await resolveRubricService(ctx, tenantId, exam, question);
    const now = ctx.now();
    try {
      await markQuestionStatus(ctx, tenantId, qsub, "pending", "processing");
      const ai = await ctx.ai.generate(
        {
          promptKey: "answerGrading",
          operation: "grade.ai",
          variables: {
            questionId,
            maxMarks: question["maxMarks"],
            rubric,
            mapping: qsub["mapping"],
          },
          responseSchema: { type: "object" },
        },
        { tenantId, uid: ctx.uid, now: ctx.now }
      );
      const result = ai.json ?? {};
      const score = result.score ?? 0;
      const maxScore = result.maxScore ?? question["maxMarks"] ?? 0;
      const confidence = result.confidence ?? 0;
      const threshold = confidenceConfig?.["confidenceThreshold"] ?? 0.7;
      const needsReview = confidence < threshold;
      const evaluation = {
        score,
        maxScore,
        confidence,
        feedback: result.feedback,
        breakdown: result.breakdown,
        costUsd: ai.costUsd,
        tokenUsage: ai.tokensUsed,
      };
      await ctx.repos.submissions.upsert(
        tenantId,
        {
          id: qsub["id"],
          evaluation,
          gradingStatus: needsReview ? "needs_review" : "graded",
          _kind: "questionSubmission",
        },
        now
      );
      if (needsReview) needsReviewCount += 1;
      else gradedCount += 1;
    } catch (err) {
      failedCount += 1;
      await ctx.repos.submissions.upsert(
        tenantId,
        {
          id: qsub["id"],
          gradingStatus: "failed",
          gradingError: String(err?.message ?? err),
          gradingRetryCount: (qsub["gradingRetryCount"] ?? 0) + 1,
          _kind: "questionSubmission",
        },
        now
      );
      await ctx.repos.outbox.enqueue(tenantId, {
        _kind: "gradingDeadLetter",
        submissionId: input.submissionId,
        questionSubmissionId: qsub["id"],
        pipelineStep: "grading",
        error: String(err?.message ?? err),
        attempts: (qsub["gradingRetryCount"] ?? 0) + 1,
        lastAttemptAt: now,
        resolvedAt: null,
        createdAt: now,
      });
    }
    batchIndex += 1;
    await ctx.repos.submissions.upsert(
      tenantId,
      {
        id: input.submissionId,
        gradingProgress: { graded: gradedCount, total: qsubs.length, batchIndex },
      },
      now
    );
  }
  const allGraded = failedCount === 0;
  return { allGraded, gradedCount, needsReviewCount, failedCount };
}
async function markQuestionStatus(ctx, tenantId, qsub, _from, to) {
  await ctx.repos.submissions.upsert(
    tenantId,
    { id: qsub["id"], gradingStatus: to, _kind: "questionSubmission" },
    ctx.now()
  );
}
var CONFIRMED_STATUSES = /* @__PURE__ */ new Set(["graded", "overridden", "manual"]);
async function finalizeSubmissionService(input, ctx) {
  const tenantId = requireTenant(ctx);
  const sub = await ctx.repos.submissions.get(tenantId, input.submissionId);
  if (!sub) fail2("NOT_FOUND", `submission ${input.submissionId} not found`);
  const examId = sub["examId"];
  const exam = await ctx.repos.exams.get(tenantId, examId);
  const qsubs = await listQuestionSubmissions(ctx, tenantId, input.submissionId);
  let totalScore = 0;
  let maxScore = 0;
  let questionsGraded = 0;
  for (const qs of qsubs) {
    const evaluation = qs["evaluation"];
    const override = qs["manualOverride"];
    const status = qs["gradingStatus"];
    const qMax = evaluation?.["maxScore"] ?? 0;
    maxScore += qMax;
    if (CONFIRMED_STATUSES.has(status)) {
      const score = override?.["score"] ?? evaluation?.["score"] ?? 0;
      totalScore += score;
      questionsGraded += 1;
    }
  }
  const totalMarks = exam?.["totalMarks"] ?? maxScore;
  const passingMarks = exam?.["passingMarks"] ?? 0;
  const percentage = totalMarks > 0 ? (totalScore / totalMarks) * 100 : 0;
  const now = ctx.now();
  const summary = {
    totalScore,
    maxScore: totalMarks,
    percentage,
    grade: gradeFor(percentage),
    questionsGraded,
    totalQuestions: qsubs.length,
    completedAt: now,
    passed: totalScore >= passingMarks,
  };
  const currentStatus = sub["pipelineStatus"] ?? "grading_complete";
  if (currentStatus === "grading_complete") {
    assertTransition2("submission", "grading_complete", "ready_for_review");
  }
  await ctx.repos.tx(async (tx) => {
    tx.upsert("submissions", tenantId, {
      id: input.submissionId,
      summary,
      pipelineStatus: "ready_for_review",
    });
    enqueueOutboxEvent(tx, {
      type: "submission.finalized",
      tenantId,
      payload: { submissionId: input.submissionId, examId },
      createdAt: now,
    });
  });
}
function gradeFor(percentage) {
  if (percentage >= 95) return "A+";
  if (percentage >= 90) return "A";
  if (percentage >= 85) return "B+";
  if (percentage >= 80) return "B";
  if (percentage >= 75) return "C+";
  if (percentage >= 70) return "C";
  if (percentage >= 60) return "D";
  return "F";
}
async function enqueuePipelineAdvance(ctx, submissionId, step) {
  const hook = ctx.enqueuePipelineAdvance;
  if (hook) {
    await hook(submissionId, step);
    return;
  }
  await advancePipelineService({ submissionId, step }, ctx);
}
async function advancePipelineService(input, ctx) {
  const tenantId = requireTenant(ctx);
  const sub = await ctx.repos.submissions.get(tenantId, input.submissionId);
  if (!sub) fail2("NOT_FOUND", `submission ${input.submissionId} not found`);
  const status = sub["pipelineStatus"] ?? "uploaded";
  switch (input.step) {
    case "scouting": {
      if (status !== "uploaded" && status !== "scouting") return;
      if (status === "uploaded") {
        await setPipelineStatus(ctx, tenantId, input.submissionId, status, "scouting");
      }
      await processAnswerMappingService({ submissionId: input.submissionId }, ctx);
      await setPipelineStatus(ctx, tenantId, input.submissionId, "scouting", "scouting_complete");
      await enqueuePipelineAdvance(ctx, input.submissionId, "grading");
      return;
    }
    case "grading": {
      if (status !== "scouting_complete" && status !== "grading" && status !== "grading_partial") {
        return;
      }
      if (status === "scouting_complete") {
        await setPipelineStatus(ctx, tenantId, input.submissionId, status, "grading");
      } else if (status === "grading_partial") {
        await setPipelineStatus(ctx, tenantId, input.submissionId, status, "grading");
      }
      const result = await processAnswerGradingService({ submissionId: input.submissionId }, ctx);
      const next = result.allGraded ? "grading_complete" : "grading_partial";
      await setPipelineStatus(ctx, tenantId, input.submissionId, "grading", next);
      if (next === "grading_complete") {
        await enqueuePipelineAdvance(ctx, input.submissionId, "finalize");
      }
      return;
    }
    case "finalize": {
      if (status !== "grading_complete" && status !== "finalization_failed") return;
      await finalizeSubmissionService({ submissionId: input.submissionId }, ctx);
      return;
    }
    default:
      fail2("INVALID_ARGUMENT", `unknown pipeline step ${String(input.step)}`);
  }
}
async function setPipelineStatus(ctx, tenantId, submissionId, from, to) {
  if (from === to) return;
  if (!canTransition2("submission", from, to)) {
    assertTransition2("submission", from, to);
  }
  await ctx.repos.submissions.upsert(tenantId, { id: submissionId, pipelineStatus: to }, ctx.now());
}
async function uploadAnswerSheetsService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "answerSheets.upload", { examId: input.examId, classId: input.classId, tenantId });
  validatePathsInTenant(input.imageUrls, tenantId);
  const key = `uploadAnswerSheets:${input.examId}:${input.studentId}`;
  return withIdempotency(ctx, tenantId, key, async () => {
    const exam = await ctx.repos.exams.get(tenantId, input.examId);
    if (!exam) fail2("NOT_FOUND", `exam ${input.examId} not found`);
    const now = ctx.now();
    const student = await ctx.repos.students.get(tenantId, input.studentId);
    const studentName = student?.["name"] ?? student?.["fullName"] ?? "Unknown";
    const rollNumber = student?.["rollNumber"] ?? "";
    const submission = {
      examId: input.examId,
      studentId: input.studentId,
      studentName,
      rollNumber,
      classId: input.classId,
      answerSheets: {
        images: input.imageUrls,
        uploadedAt: now,
        uploadedBy: ctx.uid,
        uploadSource: resolveUploadSource(ctx.role),
      },
      summary: {
        totalScore: 0,
        maxScore: exam["totalMarks"] ?? 0,
        percentage: 0,
        // valid GradeLetter default for an ungraded submission ('' is not a grade).
        grade: "F",
        questionsGraded: 0,
        totalQuestions: 0,
        completedAt: null,
      },
      pipelineStatus: "uploaded",
      retryCount: 0,
      resultsReleased: false,
      resultsReleasedAt: null,
    };
    const { id } = await ctx.repos.submissions.upsert(tenantId, submission, now);
    const examStatus = exam["status"] ?? "published";
    if (examStatus === "published" && canTransition2("exam", "published", "grading")) {
      await ctx.repos.exams.upsert(tenantId, { id: input.examId, status: "grading" }, now);
    }
    const stats = exam["stats"] ?? {
      totalSubmissions: 0,
      gradedSubmissions: 0,
      avgScore: 0,
      passRate: 0,
    };
    await ctx.repos.exams.upsert(
      tenantId,
      {
        id: input.examId,
        stats: { ...stats, totalSubmissions: (stats.totalSubmissions ?? 0) + 1 },
      },
      now
    );
    await enqueuePipelineAdvance(ctx, id, "scouting");
    return { submissionId: id };
  });
}
var TENANT_PREFIX = "tenants/";
function validatePathsInTenant(paths, tenantId) {
  const prefix = `${TENANT_PREFIX}${tenantId}/`;
  for (const p of paths) {
    if (!p.startsWith(prefix)) {
      fail2("PERMISSION_DENIED", `storage path "${p}" is not scoped to tenant ${tenantId}`);
    }
  }
}
function resolveUploadSource(role) {
  if (role === "scanner") return "scanner";
  return "web";
}
async function gradeQuestionService(input, ctx) {
  const tenantId = requireTenant(ctx);
  switch (input.mode) {
    case "manual":
      authorize(ctx, "grade.manual", { submissionId: input.submissionId, tenantId });
      return manualGrade(input, ctx, tenantId);
    case "retry":
      authorize(ctx, "grade.retry", { submissionId: input.submissionId, tenantId });
      return retryGrade(input, ctx, tenantId);
    case "ai":
      authorize(ctx, "grade.ai", { submissionId: input.submissionId, tenantId });
      return aiGrade(input, ctx, tenantId);
    default:
      return fail2("INVALID_ARGUMENT", "unknown gradeQuestion mode");
  }
}
async function manualGrade(input, ctx, tenantId) {
  const qsubs = await listQuestionSubmissions(ctx, tenantId, input.submissionId);
  const qsub = qsubs.find((q) => q["questionId"] === input.questionId);
  if (!qsub) fail2("NOT_FOUND", `question submission for ${input.questionId} not found`);
  const now = ctx.now();
  const prevEval = qsub["evaluation"];
  const originalScore = prevEval?.["score"] ?? 0;
  await ctx.repos.submissions.upsert(
    tenantId,
    {
      id: qsub["id"],
      manualOverride: {
        score: input.score,
        reason: input.feedback ?? "",
        overriddenBy: ctx.uid,
        overriddenAt: now,
        originalScore,
      },
      gradingStatus: "overridden",
      _kind: "questionSubmission",
    },
    now
  );
  await finalizeSubmissionService({ submissionId: input.submissionId }, ctx);
  return { success: true, updatedScore: input.score, gradingStatus: "overridden" };
}
async function retryGrade(input, ctx, tenantId) {
  const qsubs = await listQuestionSubmissions(ctx, tenantId, input.submissionId);
  const questionIds = input.questionIds;
  const targets = questionIds
    ? qsubs.filter((q) => questionIds.includes(q["questionId"]))
    : qsubs.filter((q) => q["gradingStatus"] === "failed");
  const now = ctx.now();
  let retriedCount = 0;
  for (const q of targets) {
    await ctx.repos.submissions.upsert(
      tenantId,
      { id: q["id"], gradingStatus: "pending", gradingError: null, _kind: "questionSubmission" },
      now
    );
    retriedCount += 1;
  }
  await ctx.repos.submissions.upsert(
    tenantId,
    { id: input.submissionId, pipelineStatus: "grading" },
    now
  );
  await enqueuePipelineAdvance(ctx, input.submissionId, "grading");
  return { success: true, retriedCount, gradingStatus: "processing" };
}
async function aiGrade(input, ctx, tenantId) {
  const result = await processAnswerGradingService(
    { submissionId: input.submissionId, questionIds: [input.questionId] },
    ctx
  );
  const qsubs = await listQuestionSubmissions(ctx, tenantId, input.submissionId);
  const qsub = qsubs.find((q) => q["questionId"] === input.questionId);
  const evaluation = qsub?.["evaluation"];
  return {
    success: result.failedCount === 0,
    updatedScore: evaluation?.["score"],
    gradingStatus: qsub?.["gradingStatus"],
  };
}
async function saveEvaluationSettingsService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "exam.write", { tenantId });
  const now = ctx.now();
  const payload = {
    ...(input.id ? { id: input.id } : {}),
    ...input.data,
    _kind: "evaluationSettings",
    createdBy: ctx.uid,
  };
  const { id, created } = await xrepos(ctx).evaluationSettings.upsert(tenantId, payload, now);
  if (input.data.isDefault === true) {
    const all = await listEvaluationSettings(ctx, tenantId);
    for (const s of all) {
      if (s["id"] !== id && s["isDefault"] === true) {
        await xrepos(ctx).evaluationSettings.upsert(
          tenantId,
          { id: s["id"], isDefault: false, _kind: "evaluationSettings" },
          now
        );
      }
    }
  }
  return { id, created };
}
async function listEvaluationSettings(ctx, tenantId) {
  const out = [];
  let cursor;
  do {
    const page = await xrepos(ctx).evaluationSettings.list(tenantId, { cursor, limit: 200 });
    out.push(...page.items);
    cursor = page.nextCursor ?? void 0;
  } while (cursor);
  return out;
}
var METHOD_TO_RESOLUTION = {
  retry: "retry_success",
  manual_grade: "manual_grade",
  dismiss: "dismissed",
};
async function resolveDeadLetterService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "grade.retry", { tenantId });
  const entries = await ctx.repos.outbox.drain(tenantId);
  const entry = entries.find(
    (e) => e["_kind"] === "gradingDeadLetter" && e["id"] === input.entryId
  );
  if (!entry) fail2("NOT_FOUND", `dead-letter entry ${input.entryId} not found`);
  if (entry["resolvedAt"]) {
    return { success: true, resolution: entry["resolutionMethod"] };
  }
  const resolution = METHOD_TO_RESOLUTION[input.method];
  const now = ctx.now();
  if (input.method === "retry") {
    const submissionId = entry["submissionId"];
    await enqueuePipelineAdvance(ctx, submissionId, "grading");
  }
  await ctx.repos.outbox.enqueue(tenantId, {
    ...entry,
    resolvedAt: now,
    resolvedBy: ctx.uid,
    resolutionMethod: resolution,
  });
  return { success: true, resolution };
}
var UPLOAD_URL_TTL_MS = 15 * 60 * 1e3;
async function requestUploadUrlService(input, ctx) {
  const tenantId = requireTenant(ctx);
  if (input.kind === "answer-sheet") {
    authorize(ctx, "answerSheets.upload", {
      examId: input.examId,
      classId: input.classId,
      tenantId,
    });
    if (
      ctx.role === "scanner" &&
      input.classId &&
      !ctx.classIds.map(String).includes(String(input.classId))
    ) {
      fail2("PERMISSION_DENIED", `class ${input.classId} is outside the scanner's scope`);
    }
  } else {
    authorize(ctx, "questions.extract", { examId: input.examId, tenantId });
  }
  const path = buildScopedPath(tenantId, input);
  const hook = ctx.storage;
  const expiresAtMs = Date.parse(ctx.now()) + UPLOAD_URL_TTL_MS;
  const expiresAt = new Date(
    Number.isNaN(expiresAtMs) ? Date.now() + UPLOAD_URL_TTL_MS : expiresAtMs
  ).toISOString();
  const uploadUrl = hook
    ? await hook.signUploadUrl(path, input.contentType, UPLOAD_URL_TTL_MS)
    : `https://storage.local/${path}`;
  return { uploadUrl, path, expiresAt };
}
function buildScopedPath(tenantId, input) {
  const ext = extFor(input.contentType);
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  if (input.kind === "question-paper") {
    return `tenants/${tenantId}/exams/${input.examId}/question-paper/${stamp}-${rand}.${ext}`;
  }
  if (!input.studentId) fail2("INVALID_ARGUMENT", "studentId required for answer-sheet upload");
  return `tenants/${tenantId}/exams/${input.examId}/answer-sheets/${input.studentId}/${stamp}-${rand}.${ext}`;
}
function extFor(contentType) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("pdf")) return "pdf";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}
async function listExamsService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "exam.read", { tenantId });
  const filter = input.filter ?? {};
  const where = {};
  if (filter.status) where["status"] = filter.status;
  if (filter.classId) where["_classId"] = filter.classId;
  if (filter.academicSessionId) where["academicSessionId"] = filter.academicSessionId;
  if (filter.linkedSpaceId) where["linkedSpaceId"] = filter.linkedSpaceId;
  const page = await ctx.repos.exams.list(tenantId, {
    where,
    filter: (d) =>
      d["_kind"] !== "examQuestion" &&
      d["_kind"] !== "evaluationSettings" &&
      (!filter.subject || d["subject"] === filter.subject) &&
      (!filter.classId || (d["classIds"]?.includes(filter.classId) ?? false)),
    cursor: input.cursor,
    limit: input.limit,
  });
  return {
    items: page.items.map(toExamListView),
    nextCursor: page.nextCursor,
  };
}
async function getExamService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "exam.read", { examId: input.id, tenantId });
  const exam = await ctx.repos.exams.get(tenantId, input.id);
  if (!exam) fail2("NOT_FOUND", `exam ${input.id} not found`);
  return exam;
}
async function listQuestionsService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "exam.read", { examId: input.examId, tenantId });
  const authoring = isAuthoringRole(ctx);
  const questions = await listExamQuestions(ctx, tenantId, input.examId);
  return {
    questions: questions.map((q) => projectQuestion(q, authoring)),
  };
}
async function listSubmissionsService(input, ctx) {
  const tenantId = requireTenant(ctx);
  const teacherish = isTeacherish(ctx);
  authorize(ctx, teacherish ? "submission.read" : "submission.readReleased", { tenantId });
  const f = input.filter;
  const page = await ctx.repos.submissions.list(tenantId, {
    where: { examId: f.examId },
    filter: (d) => {
      if (d["_kind"] === "questionSubmission") return false;
      if (f.classId && d["classId"] !== f.classId) return false;
      if (f.studentId && d["studentId"] !== f.studentId) return false;
      if (f.pipelineStatus && d["pipelineStatus"] !== f.pipelineStatus) return false;
      if (f.uploadedBy) {
        const by = d["answerSheets"]?.["uploadedBy"];
        if (by !== f.uploadedBy) return false;
      }
      if (!teacherish) {
        if (d["resultsReleased"] !== true) return false;
        if (ctx.role === "student" && d["studentId"] !== ctx.entityIds.studentId) return false;
        if (ctx.role === "parent" && !ctx.studentIds.includes(d["studentId"])) return false;
      } else if (ctx.role === "teacher" && ctx.classIds.length > 0) {
        if (!ctx.classIds.includes(d["classId"])) return false;
      }
      if (f.resultsReleasedOnly && d["resultsReleased"] !== true) return false;
      return true;
    },
    cursor: input.cursor,
    limit: input.limit,
  });
  return {
    items: page.items.map(toSubmissionListView),
    nextCursor: page.nextCursor,
  };
}
async function getSubmissionService(input, ctx) {
  const tenantId = requireTenant(ctx);
  const teacherish = isTeacherish(ctx);
  authorize(ctx, teacherish ? "submission.read" : "submission.readReleased", {
    submissionId: input.id,
    tenantId,
  });
  const sub = await ctx.repos.submissions.get(tenantId, input.id);
  if (!sub) fail2("NOT_FOUND", `submission ${input.id} not found`);
  if (!teacherish) {
    if (ctx.role === "student" && sub["studentId"] !== ctx.entityIds.studentId) {
      fail2("PERMISSION_DENIED", "not your submission");
    }
    if (ctx.role === "parent" && !ctx.studentIds.includes(sub["studentId"])) {
      fail2("PERMISSION_DENIED", "not a linked child");
    }
    if (sub["resultsReleased"] !== true) {
      return stripReleaseGated(toSubmissionDetailView(sub));
    }
  }
  return toSubmissionDetailView(sub);
}
function toSubmissionDetailView(d) {
  const ans = d["answerSheets"] ?? {};
  return compact({
    id: d["id"],
    examId: d["examId"],
    studentId: d["studentId"],
    studentName: d["studentName"] ?? "",
    rollNumber: d["rollNumber"] ?? "",
    classId: d["classId"],
    answerSheets: compact({
      images: ans["images"] ?? [],
      uploadedAt: ans["uploadedAt"] ?? d["createdAt"],
      uploadedBy: ans["uploadedBy"] ?? d["uploadedBy"],
      uploadSource: ans["uploadSource"] ?? "web",
    }),
    scoutingResult: d["scoutingResult"],
    summary: toSubmissionSummary(d),
    pipelineStatus: d["pipelineStatus"],
    pipelineError: d["pipelineError"],
    retryCount: d["retryCount"] ?? 0,
    gradingProgress: d["gradingProgress"],
    resultsReleased: d["resultsReleased"] ?? false,
    resultsReleasedAt: d["resultsReleasedAt"] ?? null,
    createdAt: d["createdAt"],
    updatedAt: d["updatedAt"],
  });
}
function toSubmissionSummary(d) {
  const s = d["summary"] ?? {};
  return compact({
    totalScore: s["totalScore"] ?? d["totalScore"] ?? 0,
    maxScore: s["maxScore"] ?? d["maxScore"] ?? 0,
    percentage: s["percentage"] ?? d["percentage"] ?? 0,
    // '' is not a GradeLetter — coerce any empty/missing grade to 'F'.
    grade: s["grade"] || "F",
    questionsGraded: s["questionsGraded"] ?? 0,
    totalQuestions: s["totalQuestions"] ?? 0,
    completedAt: s["completedAt"] ?? null,
  });
}
function stripReleaseGated(sub) {
  const copy = { ...sub };
  for (const f of [
    "totalScore",
    "maxScore",
    "percentage",
    "grade",
    "summary",
    "score",
    "evaluation",
  ]) {
    delete copy[f];
  }
  return copy;
}
async function listQuestionSubmissionsService(input, ctx) {
  const tenantId = requireTenant(ctx);
  const teacherish = isTeacherish(ctx);
  const sub = await ctx.repos.submissions.get(tenantId, input.submissionId);
  if (!sub) fail2("NOT_FOUND", `submission ${input.submissionId} not found`);
  authorize(ctx, teacherish ? "submission.read" : "submission.readReleased", {
    submissionId: input.submissionId,
    tenantId,
  });
  const released = sub["resultsReleased"] === true;
  if (!teacherish) {
    if (ctx.role === "student" && sub["studentId"] !== ctx.entityIds.studentId) {
      fail2("PERMISSION_DENIED", "not your submission");
    }
    if (ctx.role === "parent" && !ctx.studentIds.includes(sub["studentId"])) {
      fail2("PERMISSION_DENIED", "not a linked child");
    }
  }
  const qsubs = await listQuestionSubmissions(ctx, tenantId, input.submissionId);
  const visible = teacherish || released;
  return {
    questionSubmissions: qsubs.map((q) => {
      const view = toQuestionSubmissionView(q, sub["examId"]);
      if (visible) {
        if (view["evaluation"]) view["evaluation"] = stripEvaluationCost(view["evaluation"]);
        return view;
      }
      delete view["evaluation"];
      return view;
    }),
  };
}
function toQuestionSubmissionView(d, examId) {
  const ev = d["evaluation"];
  const maxScore = d["maxScore"] ?? ev?.["maxScore"] ?? 0;
  return compact({
    id: d["id"],
    submissionId: d["submissionId"],
    questionId: d["questionId"],
    examId: d["examId"] ?? examId,
    mapping: d["mapping"] ?? { pageIndices: [], imageUrls: [], scoutedAt: d["createdAt"] },
    evaluation: ev ? toUnifiedEvaluation(ev, d, maxScore) : void 0,
    gradingStatus: d["gradingStatus"] ?? "pending",
    gradingError: d["gradingError"],
    manualOverride: d["manualOverride"],
    createdAt: d["createdAt"],
    updatedAt: d["updatedAt"] ?? d["createdAt"],
  });
}
function toUnifiedEvaluation(ev, parent, maxScore) {
  const score = ev["score"] ?? parent["score"] ?? 0;
  return compact({
    score,
    maxScore: ev["maxScore"] ?? maxScore,
    correctness: ev["correctness"] ?? (maxScore > 0 ? score / maxScore : 0),
    percentage: ev["percentage"] ?? (maxScore > 0 ? (score / maxScore) * 100 : 0),
    structuredFeedback: ev["structuredFeedback"],
    strengths: ev["strengths"] ?? [],
    weaknesses: ev["weaknesses"] ?? [],
    missingConcepts: ev["missingConcepts"] ?? [],
    rubricBreakdown: ev["rubricBreakdown"],
    summary: ev["summary"] ?? ev["feedback"],
    confidence: ev["confidence"] ?? 1,
    mistakeClassification: ev["mistakeClassification"],
    tokensUsed: ev["tokensUsed"] ?? ev["tokenUsage"],
    costUsd: ev["costUsd"],
    gradedAt: ev["gradedAt"] ?? parent["updatedAt"] ?? parent["createdAt"],
  });
}
async function getExamAnalyticsService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "exam.read", { examId: input.examId, tenantId });
  const doc = await ctx.repos.exams.get(tenantId, `analytics_${input.examId}`);
  if (!doc) fail2("NOT_FOUND", `exam analytics ${input.examId} not found`);
  return doc;
}
async function listEvaluationSettingsService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "exam.read", { tenantId });
  const authoring = isAuthoringRole(ctx);
  const all = await listEvaluationSettings(ctx, tenantId);
  const visible = all.filter((s) => authoring || s["isPublic"] === true || input.includePublic);
  return {
    settings: visible.map((s) => projectEvaluationSettings(s, authoring)),
  };
}
async function listDeadLetterService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "grade.retry", { tenantId });
  const entries = await ctx.repos.outbox.drain(tenantId);
  const f = input.filter ?? {};
  let dlq = entries.filter((e) => e["_kind"] === "gradingDeadLetter");
  if (f.resolved !== void 0) {
    dlq = dlq.filter((e) => Boolean(e["resolvedAt"]) === f.resolved);
  }
  if (f.pipelineStep) dlq = dlq.filter((e) => e["pipelineStep"] === f.pipelineStep);
  for (const e of entries) await ctx.repos.outbox.enqueue(tenantId, e);
  return { items: dlq, nextCursor: null };
}
async function getSubmissionForExamService(input, ctx) {
  const tenantId = requireTenant(ctx);
  const teacherish = isTeacherish(ctx);
  authorize(ctx, teacherish ? "submission.read" : "submission.readReleased", { tenantId });
  const page = await ctx.repos.submissions.list(tenantId, {
    where: { examId: input.examId, studentId: input.studentId },
    filter: (d) => d["_kind"] !== "questionSubmission",
    limit: 1,
  });
  const sub = page.items[0];
  if (!sub) return null;
  if (!teacherish && sub["resultsReleased"] !== true) {
    return null;
  }
  return sub;
}
function compact(o) {
  const out = {};
  for (const [k, v] of Object.entries(o)) if (v !== void 0) out[k] = v;
  return out;
}
function toExamListView(d) {
  return compact({
    id: d["id"],
    title: d["title"],
    subject: d["subject"] ?? "",
    topics: d["topics"] ?? [],
    classIds: d["classIds"] ?? [],
    examDate: d["examDate"] ?? d["createdAt"],
    duration: d["duration"] ?? 0,
    totalMarks: d["totalMarks"] ?? 0,
    passingMarks: d["passingMarks"] ?? 0,
    status: d["status"],
    academicSessionId: d["academicSessionId"],
    linkedSpaceId: d["linkedSpaceId"],
    linkedSpaceTitle: d["linkedSpaceTitle"],
    stats: d["stats"],
    createdAt: d["createdAt"],
    updatedAt: d["updatedAt"],
  });
}
function toSubmissionListView(d) {
  return compact({
    id: d["id"],
    examId: d["examId"],
    studentId: d["studentId"],
    studentName: d["studentName"] ?? "",
    rollNumber: d["rollNumber"] ?? "",
    classId: d["classId"],
    pipelineStatus: d["pipelineStatus"],
    summary: toSubmissionSummary(d),
    gradingProgress: d["gradingProgress"],
    resultsReleased: d["resultsReleased"] ?? false,
    uploadedBy: d["uploadedBy"] ?? d["answerSheets"]?.["uploadedBy"],
    createdAt: d["createdAt"],
    updatedAt: d["updatedAt"],
  });
}
async function onSubmissionCreatedService(event, ctx) {
  const sub = event.after;
  if (!sub) return;
  if (sub["pipelineStatus"] !== "uploaded") return;
  await enqueuePipelineAdvance(ctx, sub["id"], "scouting");
}
async function onSubmissionUpdatedService(event, ctx) {
  const before = event.before;
  const after = event.after;
  if (!after) return;
  const prevStatus = before?.["pipelineStatus"] ?? null;
  const nextStatus = after["pipelineStatus"];
  if (prevStatus === nextStatus) return;
  const step = stepForStatus(nextStatus);
  if (!step) return;
  await advancePipelineService({ submissionId: after["id"], step }, ctx);
}
async function onQuestionSubmissionUpdatedService(event, ctx) {
  const qsub = event.after;
  if (!qsub) return;
  const submissionId = qsub["submissionId"];
  if (!submissionId) return;
  await enqueuePipelineAdvance(ctx, submissionId, "finalize");
}
async function onExamPublishedService(event, ctx) {
  if (!transitionedTo(event, "status", "published")) return;
  const examId = event.after["id"];
  await ctx.repos.tx(async (tx) => {
    enqueueOutboxEvent(tx, {
      type: "exam.published",
      tenantId: event.tenantId,
      payload: { examId },
      createdAt: ctx.now(),
    });
  });
}
async function onResultsReleasedService(event, ctx) {
  if (!transitionedTo(event, "status", "results_released")) return;
  const examId = event.after["id"];
  await ctx.repos.tx(async (tx) => {
    enqueueOutboxEvent(tx, {
      type: "exam.results.released",
      tenantId: event.tenantId,
      payload: { examId },
      createdAt: ctx.now(),
    });
  });
}
async function onExamDeletedService(event, ctx) {
  const exam = event.before;
  if (!exam) return;
  const examId = exam["id"];
  const tenantId = event.tenantId;
  let cursor;
  do {
    const page = await ctx.repos.exams.list(tenantId, {
      where: { examId },
      filter: (d) => d["_kind"] === "examQuestion",
      cursor,
      limit: 200,
    });
    for (const q of page.items) await ctx.repos.exams.delete(tenantId, q["id"]);
    cursor = page.nextCursor ?? void 0;
  } while (cursor);
  cursor = void 0;
  do {
    const page = await ctx.repos.submissions.list(tenantId, {
      where: { examId },
      cursor,
      limit: 200,
    });
    for (const s of page.items) await ctx.repos.submissions.delete(tenantId, s["id"]);
    cursor = page.nextCursor ?? void 0;
  } while (cursor);
  await ctx.repos.exams.delete(tenantId, `analytics_${examId}`).catch(() => void 0);
}
function stepForStatus(status) {
  switch (status) {
    case "uploaded":
      return "scouting";
    case "scouting_complete":
    case "grading":
    case "grading_partial":
      return "grading";
    case "grading_complete":
      return "finalize";
    default:
      return null;
  }
}
function transitionedTo(event, field, value) {
  const prev = event.before?.[field];
  const next = event.after?.[field];
  return next === value && prev !== value;
}
var IN_FLIGHT = /* @__PURE__ */ new Set([
  "scouting",
  "grading",
  "grading_partial",
  "grading_complete",
]);
var STALE_MS = 15 * 60 * 1e3;
var MAX_WATCHDOG_RETRIES = 3;
async function staleSubmissionWatchdogService(input, ctx) {
  const tenantId = input.tenantId;
  const nowMs = Date.parse(ctx.now());
  let cursor;
  do {
    const page = await ctx.repos.submissions.list(tenantId, {
      filter: (d) =>
        d["_kind"] !== "questionSubmission" &&
        IN_FLIGHT.has(d["pipelineStatus"]) &&
        isStale(d, nowMs),
      cursor,
      limit: 100,
    });
    for (const sub of page.items) {
      const id = sub["id"];
      const retries = sub["watchdogRetryCount"] ?? 0;
      if (retries >= MAX_WATCHDOG_RETRIES) {
        await ctx.repos.submissions.upsert(
          tenantId,
          { id, pipelineStatus: "manual_review_needed" },
          ctx.now()
        );
        await ctx.repos.outbox.enqueue(tenantId, {
          _kind: "gradingDeadLetter",
          submissionId: id,
          pipelineStep: stepForStatus2(sub["pipelineStatus"]),
          error: "stale submission exceeded watchdog retries",
          attempts: retries,
          lastAttemptAt: ctx.now(),
          resolvedAt: null,
          createdAt: ctx.now(),
        });
        continue;
      }
      await ctx.repos.submissions.upsert(
        tenantId,
        { id, watchdogRetryCount: retries + 1 },
        ctx.now()
      );
      const step = stepForStatus2(sub["pipelineStatus"]);
      if (step) {
        await advancePipelineService({ submissionId: id, step }, ctx).catch(() => void 0);
      }
    }
    cursor = page.nextCursor ?? void 0;
  } while (cursor);
}
function isStale(sub, nowMs) {
  const updatedAt = Date.parse(sub["updatedAt"] ?? "");
  if (Number.isNaN(updatedAt)) return false;
  return nowMs - updatedAt > STALE_MS;
}
function stepForStatus2(status) {
  if (status === "scouting") return "scouting";
  if (status === "grading_complete") return "finalize";
  return "grading";
}
function evaluateAtRiskRules(input) {
  const reasons = [];
  const details = {};
  if (input.overallScore < 0.5) {
    reasons.push("low_overall_score");
    details["low_overall_score"] = `overallScore=${input.overallScore.toFixed(2)}`;
  }
  if (input.streakDays === 0) {
    reasons.push("zero_streak");
    details["zero_streak"] = "no active practice streak";
  }
  const recentFails = input.recentExamPercentages.filter((p) => p < 40).length;
  if (recentFails >= 2) {
    reasons.push("failing_exams");
    details["failing_exams"] = `${recentFails} recent exams below 40%`;
  }
  if (isDeclining(input.recentExamPercentages)) {
    reasons.push("declining_trend");
    details["declining_trend"] = "recent exam scores trending down";
  }
  if (input.completionPct < 0.3) {
    reasons.push("low_completion");
    details["low_completion"] = `completion=${(input.completionPct * 100).toFixed(0)}%`;
  }
  return { isAtRisk: reasons.length > 0, reasons, details };
}
function isDeclining(percentages) {
  if (percentages.length < 3) return false;
  const chrono = [...percentages].reverse();
  let downs = 0;
  for (let i = 1; i < chrono.length; i++) if (chrono[i] < chrono[i - 1]) downs += 1;
  return downs >= chrono.length - 1;
}
function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
function computeOverallScore(input) {
  const exam = clamp01(input.examAverage ?? 0);
  const practice = clamp01(input.practiceAccuracy ?? 0);
  return clamp01(exam * 0.6 + practice * 0.4);
}
function generateInsightsForStudent(ctx) {
  const seeds = [];
  if (ctx.isAtRisk) {
    seeds.push({
      type: "at_risk_intervention",
      priority: "high",
      title: "Let\u2019s get back on track",
      description: "Your recent activity suggests you could use some support.",
      actionType: "seek_help",
    });
  }
  for (const t of ctx.weakTopics.slice(0, 3)) {
    seeds.push({
      type: "weak_topic_recommendation",
      priority: "medium",
      title: `Practice ${t.title}`,
      description: `Your mastery of ${t.title} is low \u2014 a focused session will help.`,
      actionType: "practice_space",
      actionEntityId: t.id,
      actionEntityTitle: t.title,
    });
  }
  for (const e of ctx.upcomingExams.slice(0, 2)) {
    seeds.push({
      type: "exam_preparation",
      priority: "medium",
      title: `Prepare for ${e.title}`,
      description: `${e.title} is coming up \u2014 review the linked material.`,
      actionType: "review_exam",
      actionEntityId: e.id,
      actionEntityTitle: e.title,
    });
  }
  if (ctx.streakDays > 0 && ctx.streakDays < 3) {
    seeds.push({
      type: "streak_encouragement",
      priority: "low",
      title: "Keep your streak going!",
      description: `You\u2019re on a ${ctx.streakDays}-day streak \u2014 don\u2019t break it.`,
      actionType: "practice_space",
    });
  }
  if (ctx.improved) {
    seeds.push({
      type: "improvement_celebration",
      priority: "low",
      title: "Great progress!",
      description: "Your scores are trending up. Keep it up!",
      actionType: "celebrate",
    });
  }
  return seeds;
}
function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}
var STUDENT_SUMMARY = "studentSummary";
var CLASS_SUMMARY = "classSummary";
var EXAM_ANALYTICS = "examAnalytics";
var INSIGHT = "insight";
var COST_DAILY = "costDaily";
var COST_MONTHLY = "costMonthly";
async function getSummaryService(input, ctx) {
  switch (input.scope) {
    case "student": {
      const tenantId = requireTenant(ctx);
      const studentId = input.studentId ?? ctx.entityIds.studentId;
      if (!studentId) fail2("INVALID_ARGUMENT", "studentId required");
      assertStudentReadable(ctx, studentId);
      authorize(ctx, "summary.read", { studentId, tenantId });
      const doc = await getKinded(ctx, tenantId, STUDENT_SUMMARY, studentId);
      if (!doc) fail2("NOT_FOUND", `no summary for student ${studentId}`);
      return { scope: "student", studentSummary: projectStudentSummary(doc) };
    }
    case "class": {
      const tenantId = requireTenant(ctx);
      const classId = input.classId;
      if (!classId) fail2("INVALID_ARGUMENT", "classId required");
      authorize(ctx, "summary.read", { classId, tenantId });
      if (ctx.role === "teacher" && !ctx.classIds.map(String).includes(String(classId))) {
        fail2("PERMISSION_DENIED", `class ${classId} is not assigned to this teacher`);
      }
      const doc = await getKinded(ctx, tenantId, CLASS_SUMMARY, classId);
      if (!doc) fail2("NOT_FOUND", `no summary for class ${classId}`);
      return {
        scope: "class",
        classSummary: {
          ...doc,
          tenantRollup: doc["tenantRollup"] ?? { academyAvg: 0, perClass: [] },
          masteryDistribution: doc["masteryDistribution"] ?? {
            notStarted: 0,
            inProgress: 0,
            mastered: 0,
          },
        },
      };
    }
    case "platform": {
      if (!ctx.isSuperAdmin) fail2("PERMISSION_DENIED", "platform scope is super-admin only");
      return {
        scope: "platform",
        platformSummary: await computePlatformSummary(),
      };
    }
    case "health": {
      if (!ctx.isSuperAdmin) fail2("PERMISSION_DENIED", "health scope is super-admin only");
      return {
        scope: "health",
        healthSummary: { snapshot: await computeHealthSnapshot(ctx) },
      };
    }
    default:
      return fail2("INVALID_ARGUMENT", "unknown summary scope");
  }
}
async function getExamAnalyticsService2(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "report.generate", { examId: input.examId, tenantId });
  const doc = await getKinded(ctx, tenantId, EXAM_ANALYTICS, input.examId);
  if (!doc) fail2("NOT_FOUND", `no analytics for exam ${input.examId}`);
  return doc;
}
async function listInsightsService(input, ctx) {
  const tenantId = requireTenant(ctx);
  assertStudentReadable(ctx, input.studentId);
  authorize(ctx, "summary.read", { studentId: input.studentId, tenantId });
  const page = await xrepos(ctx).analyticsInsights.list(tenantId, {
    where: { studentId: input.studentId },
    filter: (d) => (input.includeDismissed ? true : !d["dismissedAt"] && d["dismissed"] !== true),
    cursor: input.cursor,
    limit: input.limit,
  });
  return { items: page.items, nextCursor: page.nextCursor };
}
async function getPerformanceTrendsService(input, ctx) {
  const tenantId = requireTenant(ctx);
  const studentId = input.studentId ?? ctx.entityIds.studentId;
  authorize(ctx, "analytics.trends.read", { studentId, classId: input.classId, tenantId });
  if (studentId) assertStudentReadable(ctx, studentId);
  const summary = studentId ? await getKinded(ctx, tenantId, STUDENT_SUMMARY, studentId) : null;
  const recent = summary?.["autograde"]?.["recentExams"] ?? [];
  const points = bucketTrends(recent, input.granularity);
  return { points };
}
async function getChildSummaryService(input, ctx) {
  const tenantId = requireTenant(ctx);
  if (!ctx.studentIds.includes(input.studentId)) {
    fail2("PERMISSION_DENIED", "student is not a linked child");
  }
  authorize(ctx, "child.read", { studentId: input.studentId, tenantId });
  const studentSummary = await getKinded(ctx, tenantId, STUDENT_SUMMARY, input.studentId);
  if (!studentSummary) fail2("NOT_FOUND", `no summary for child ${input.studentId}`);
  const insightsPage = await ctx.repos.tenants.list(tenantId, {
    filter: (d) =>
      d["_kind"] === INSIGHT && d["studentId"] === input.studentId && !d["dismissedAt"],
    limit: 5,
  });
  return {
    studentSummary: projectStudentSummary(studentSummary),
    recentInsights: insightsPage.items,
  };
}
async function listLinkedChildrenService(input, ctx) {
  const tenantId = requireTenant(ctx);
  if (ctx.role !== "parent" && !ctx.isSuperAdmin) {
    fail2("PERMISSION_DENIED", "linked children are a parent read");
  }
  const childIds = ctx.studentIds;
  const summaries = await Promise.all(
    childIds.map(async (sid) => ({
      sid,
      doc: await getKinded(ctx, tenantId, STUDENT_SUMMARY, sid),
    }))
  );
  const items = await Promise.all(
    summaries.map(async ({ sid, doc }) => {
      const student = await ctx.repos.students.get(tenantId, sid);
      return {
        studentId: sid,
        name: student?.["name"] ?? student?.["fullName"] ?? "Unknown",
        classNames: student?.["classNames"] ?? [],
        overallScore: doc?.["overallScore"] ?? 0,
        isAtRisk: doc?.["isAtRisk"] ?? false,
        atRiskReasons: doc?.["atRiskReasons"] ?? [],
      };
    })
  );
  return { items, nextCursor: null };
}
async function listParentAlertsService(input, ctx) {
  const tenantId = requireTenant(ctx);
  if (ctx.role !== "parent" && !ctx.isSuperAdmin) {
    fail2("PERMISSION_DENIED", "parent alerts are a parent read");
  }
  const now = ctx.now();
  const alerts = [];
  for (const sid of ctx.studentIds) {
    const doc = await getKinded(ctx, tenantId, STUDENT_SUMMARY, sid);
    if (!doc) continue;
    const student = await ctx.repos.students.get(tenantId, sid);
    const name =
      (student?.["firstName"] && student?.["lastName"]
        ? `${student["firstName"]} ${student["lastName"]}`
        : student?.["name"]) ?? "Unknown";
    if (doc["isAtRisk"] === true) {
      const reasons = doc["atRiskReasons"] ?? [];
      alerts.push({
        studentId: sid,
        name,
        kind: "at_risk",
        detail: reasons.length ? reasons.join(", ") : "Flagged at risk",
        createdAt: doc["lastUpdatedAt"] ?? now,
      });
    }
  }
  return { items: alerts, nextCursor: null };
}
async function listPlatformActivityService(input, ctx) {
  if (!ctx.isSuperAdmin) fail2("PERMISSION_DENIED", "platform activity is super-admin only");
  const page = await ctx.repos.tenants.list("__platform__", {
    filter: (d) =>
      d["_kind"] === "platformActivityLog" && (!input.action || d["action"] === input.action),
    cursor: input.cursor,
    limit: input.limit ?? 20,
  });
  return { items: page.items, nextCursor: page.nextCursor };
}
async function getCostSummaryService(input, ctx) {
  const tenantId = requireTenant(ctx);
  if (!ctx.isSuperAdmin && ctx.role !== "tenantAdmin") {
    fail2("PERMISSION_DENIED", "cost summary is admin only");
  }
  const kind = input.granularity === "monthly" ? COST_MONTHLY : COST_DAILY;
  const page = await ctx.repos.tenants.list(tenantId, {
    filter: (d) => {
      if (d["_kind"] !== kind) return false;
      if (input.date && d["date"] !== input.date) return false;
      if (input.month && d["month"] !== input.month) return false;
      return true;
    },
    limit: 200,
  });
  return { summaries: page.items };
}
async function getLeaderboardService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "summary.read", { tenantId });
  const limit = input.limit ?? 20;
  const page = await ctx.repos.tenants.list(tenantId, {
    filter: (d) =>
      d["_kind"] === "leaderboardEntry" &&
      d["scope"] === input.scope &&
      (input.spaceId ? d["spaceId"] === input.spaceId : true) &&
      (input.storyPointId ? d["storyPointId"] === input.storyPointId : true),
    limit: 200,
  });
  const sorted = page.items
    .sort((a, b) => (b["score"] ?? 0) - (a["score"] ?? 0))
    .map((e, i) => ({ ...e, rank: i + 1 }));
  const entries = sorted.slice(0, limit);
  const myEntry = sorted.find((e) => e["userId"] === ctx.uid);
  return { entries, ...(myEntry ? { myEntry } : {}) };
}
async function getKinded(ctx, tenantId, kind, id) {
  const dedicated = dedicatedRepoFor(ctx, kind);
  if (dedicated) {
    const doc = await dedicated.get(tenantId, id);
    if (doc) return doc;
  }
  const direct = await ctx.repos.tenants.get(tenantId, `${kind}_${id}`);
  if (direct) return direct;
  const page = await ctx.repos.tenants.list(tenantId, {
    filter: (d) =>
      d["_kind"] === kind &&
      (d["id"] === id || d["studentId"] === id || d["classId"] === id || d["examId"] === id),
    limit: 1,
  });
  return page.items[0] ?? null;
}
function projectStudentSummary(doc) {
  const { updatedAt: _u, createdAt: _c, recompute, ...rest } = doc;
  return recompute == null ? rest : { ...rest, recompute };
}
function dedicatedRepoFor(ctx, kind) {
  const x = xrepos(ctx);
  switch (kind) {
    case STUDENT_SUMMARY:
      return x.studentSummaries;
    case CLASS_SUMMARY:
      return x.classSummaries;
    case EXAM_ANALYTICS:
      return x.examAnalytics;
    default:
      return null;
  }
}
function assertStudentReadable(ctx, studentId) {
  if (ctx.isSuperAdmin) return;
  if (ctx.role === "student" && ctx.entityIds.studentId === studentId) return;
  if (ctx.role === "parent" && ctx.studentIds.includes(studentId)) return;
  if (ctx.role === "teacher" || ctx.role === "tenantAdmin" || ctx.role === "staff") return;
  fail2("PERMISSION_DENIED", "not permitted to read this student");
}
function bucketTrends(recent, _granularity) {
  return recent.map((e) => ({
    periodStart: e.date,
    periodEnd: e.date,
    avgPercentage: e.percentage ?? 0,
    examCount: 1,
    completionPct: 1,
    overallScore: (e.percentage ?? 0) / 100,
  }));
}
async function computePlatformSummary(ctx) {
  return {
    kpis: { tenantCount: 0, userCount: 0, examCount: 0, activeTenantCount: 0 },
    growthSeries: [],
    planDistribution: {},
    topTenants: [],
    tenantComparison: [],
  };
}
async function computeHealthSnapshot(ctx) {
  const now = ctx.now();
  return {
    date: now.slice(0, 10),
    status: "healthy",
    services: {},
    checkedAt: now,
  };
}
var STUDENT_SUMMARY2 = "studentSummary";
var CLASS_SUMMARY2 = "classSummary";
var EXAM_ANALYTICS2 = "examAnalytics";
var INSIGHT2 = "insight";
function summaryDocId(kind, id) {
  return `${kind}_${id}`;
}
async function recomputeStudentSummaryService(input, ctx) {
  const { tenantId, studentId, section } = input;
  const now = ctx.now();
  await ctx.repos.tx(async () => {
    const existing = (await ctx.repos.tenants.get(
      tenantId,
      summaryDocId(STUDENT_SUMMARY2, studentId)
    )) ?? {
      _kind: STUDENT_SUMMARY2,
      studentId,
      autograde: emptyAutograde(),
      levelup: emptyLevelup(),
    };
    const updatedSection =
      section === "autograde"
        ? await computeAutogradeMetrics(ctx, tenantId, studentId)
        : await computeLevelupMetrics(ctx, tenantId, studentId);
    const merged = {
      ...existing,
      _kind: STUDENT_SUMMARY2,
      id: summaryDocId(STUDENT_SUMMARY2, studentId),
      studentId,
      [section]: updatedSection,
    };
    const examAvg = merged["autograde"]?.["averageScore"];
    const accuracy = merged["levelup"]?.["averageAccuracy"];
    merged["overallScore"] = computeOverallScore({
      examAverage: examAvg,
      practiceAccuracy: accuracy,
    });
    merged["lastUpdatedAt"] = now;
    merged["recompute"] = { reason: section, requestedAt: now };
    await ctx.repos.tenants.upsert(tenantId, merged, now);
  });
}
async function recomputeClassSummaryService(input, ctx) {
  const { tenantId, classId } = input;
  const now = ctx.now();
  const klass = await ctx.repos.classes.get(tenantId, classId);
  const className = klass?.["name"] ?? classId;
  const students = await listClassStudentSummaries(ctx, tenantId, classId);
  const atRisk = students.filter((s) => s["isAtRisk"] === true);
  const scores = students.map((s) => s["overallScore"]).filter((n) => typeof n === "number");
  await ctx.repos.tenants.upsert(
    tenantId,
    {
      id: summaryDocId(CLASS_SUMMARY2, classId),
      _kind: CLASS_SUMMARY2,
      classId,
      className,
      studentCount: students.length,
      atRiskStudentIds: atRisk.map((s) => s["studentId"]),
      atRiskCount: atRisk.length,
      avgOverallScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      lastUpdatedAt: now,
    },
    now
  );
}
async function recomputeExamAnalyticsService(input, ctx) {
  const { tenantId, examId } = input;
  const now = ctx.now();
  const exam = await ctx.repos.exams.get(tenantId, examId);
  const passingMarks = exam?.["passingMarks"] ?? 0;
  const submissions = await listExamSubmissions(ctx, tenantId, examId);
  const graded = submissions.filter((s) =>
    ["ready_for_review", "reviewed"].includes(s["pipelineStatus"])
  );
  const percentages = graded
    .map((s) => s["summary"]?.["percentage"])
    .filter((n) => typeof n === "number");
  const scores = graded
    .map((s) => s["summary"]?.["totalScore"])
    .filter((n) => typeof n === "number");
  const passed = graded.filter((s) => (s["summary"]?.["totalScore"] ?? 0) >= passingMarks).length;
  await ctx.repos.exams.upsert(
    tenantId,
    {
      id: summaryDocId(EXAM_ANALYTICS2, examId),
      _kind: EXAM_ANALYTICS2,
      examId,
      totalSubmissions: submissions.length,
      gradedSubmissions: graded.length,
      avgScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      avgPercentage: percentages.length
        ? percentages.reduce((a, b) => a + b, 0) / percentages.length
        : 0,
      passRate: graded.length ? passed / graded.length : 0,
      medianScore: median(scores),
      scoreDistribution: { buckets: [] },
      questionAnalytics: {},
      classBreakdown: {},
      topicPerformance: {},
      computedAt: now,
      lastUpdatedAt: now,
    },
    now
  );
}
async function detectAtRiskService(input, ctx) {
  const now = ctx.now();
  for (const summary of input.summaries) {
    const result = evaluateAtRiskRules({
      overallScore: summary["overallScore"] ?? 0,
      streakDays: summary["levelup"]?.["streakDays"] ?? 0,
      recentExamPercentages: extractRecentPercentages(summary),
      completionPct: summary["levelup"]?.["averageCompletion"] ?? 0,
    });
    await ctx.repos.tenants.upsert(
      input.tenantId,
      {
        id: summaryDocId(STUDENT_SUMMARY2, summary["studentId"]),
        _kind: STUDENT_SUMMARY2,
        isAtRisk: result.isAtRisk,
        atRiskReasons: result.reasons,
        lastUpdatedAt: now,
      },
      now
    );
  }
}
var INSIGHT_CAP = 5;
async function generateInsightsService(input, ctx) {
  const { tenantId, studentId, seeds } = input;
  const now = ctx.now();
  const active = (
    await ctx.repos.tenants.list(tenantId, {
      filter: (d) => d["_kind"] === INSIGHT2 && d["studentId"] === studentId && !d["dismissedAt"],
      limit: 100,
    })
  ).items.sort((a, b) => String(a["createdAt"]).localeCompare(String(b["createdAt"])));
  const slotsAvailable = Math.max(0, INSIGHT_CAP - active.length);
  const toWrite = seeds.slice(0, slotsAvailable);
  const overflow = Math.min(seeds.length, INSIGHT_CAP) - slotsAvailable;
  for (let i = 0; i < overflow && i < active.length; i++) {
    await ctx.repos.tenants.delete(tenantId, active[i]["id"]);
  }
  const writeCount = Math.min(seeds.length, INSIGHT_CAP);
  for (let i = 0; i < writeCount; i++) {
    const seed = i < toWrite.length ? toWrite[i] : seeds[i];
    await ctx.repos.tenants.upsert(
      tenantId,
      { _kind: INSIGHT2, studentId, ...seed, createdAt: now, dismissedAt: null },
      now
    );
  }
}
function emptyAutograde() {
  return {
    totalExams: 0,
    completedExams: 0,
    averageScore: 0,
    averagePercentage: 0,
    recentExams: [],
  };
}
function emptyLevelup() {
  return {
    totalSpaces: 0,
    completedSpaces: 0,
    averageCompletion: 0,
    averageAccuracy: 0,
    streakDays: 0,
    recentActivity: [],
  };
}
async function computeAutogradeMetrics(ctx, tenantId, studentId) {
  const subs = (
    await ctx.repos.submissions.list(tenantId, {
      where: { studentId },
      filter: (d) => d["_kind"] !== "questionSubmission" && d["resultsReleased"] === true,
      limit: 200,
    })
  ).items;
  const pcts = subs.map((s) => s["summary"]?.["percentage"]).filter((n) => typeof n === "number");
  const avgPct = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
  return {
    totalExams: subs.length,
    completedExams: subs.length,
    averageScore: avgPct / 100,
    averagePercentage: avgPct,
    recentExams: subs.slice(-5).map((s) => ({
      examId: s["examId"],
      date: s["updatedAt"],
      percentage: s["summary"]?.["percentage"] ?? 0,
    })),
  };
}
async function computeLevelupMetrics(ctx, tenantId, studentId) {
  await ctx.repos.progress.get(tenantId, studentId, "*").catch(() => null);
  return emptyLevelup();
}
async function listClassStudentSummaries(ctx, tenantId, classId) {
  return (
    await ctx.repos.tenants.list(tenantId, {
      filter: (d) => d["_kind"] === STUDENT_SUMMARY2 && (d["classIds"]?.includes(classId) ?? false),
      limit: 500,
    })
  ).items;
}
async function listExamSubmissions(ctx, tenantId, examId) {
  return (
    await ctx.repos.submissions.list(tenantId, {
      where: { examId },
      filter: (d) => d["_kind"] !== "questionSubmission",
      limit: 500,
    })
  ).items;
}
function extractRecentPercentages(summary) {
  const recent = summary["autograde"]?.["recentExams"];
  return (recent ?? [])
    .map((e) => e.percentage)
    .filter((n) => typeof n === "number")
    .reverse();
}
async function sendNotificationService(input, ctx) {
  const now = ctx.now();
  const { id } = await ctx.repos.notifications.upsert(
    input.tenantId,
    {
      tenantId: input.tenantId,
      recipientUid: input.recipientUid,
      recipientRole: input.recipientRole,
      type: input.type,
      title: input.title,
      body: input.body,
      entityType: input.entityType,
      entityId: input.entityId,
      actionUrl: input.actionUrl,
      isRead: false,
      createdAt: now,
      readAt: null,
    },
    now
  );
  await bumpBadge(ctx, input.tenantId, input.recipientUid, {
    id,
    title: input.title,
    type: input.type,
    createdAt: now,
  });
}
async function bumpBadge(ctx, tenantId, uid, latest) {
  const id = `badge_${uid}`;
  const existing = await ctx.repos.notifications.get(tenantId, id);
  const unreadCount = (existing?.["unreadCount"] ?? 0) + 1;
  await ctx.repos.notifications.upsert(
    tenantId,
    { id, _kind: "badge", uid, unreadCount, latest },
    ctx.now()
  );
}
function tierFor(score) {
  if (score >= 1e3) return "diamond";
  if (score >= 500) return "gold";
  if (score >= 200) return "silver";
  return "bronze";
}
async function updateLeaderboardService(input, ctx) {
  const now = ctx.now();
  const id = leaderboardEntryId(input);
  await ctx.repos.tenants.upsert(
    input.tenantId,
    {
      id,
      _kind: "leaderboardEntry",
      userId: input.userId,
      displayName: input.displayName,
      score: input.score,
      tier: tierFor(input.score),
      scope: input.scope,
      spaceId: input.spaceId,
      storyPointId: input.storyPointId,
    },
    now
  );
}
function leaderboardEntryId(input) {
  const suffix =
    input.scope === "space"
      ? `space_${input.spaceId}`
      : input.scope === "storyPoint"
        ? `sp_${input.storyPointId}`
        : "tenant";
  return `lb_${suffix}_${input.userId}`;
}
async function recomputeOrchestratorService(input, ctx) {
  const { tenantId, studentId } = input;
  const summary = await xrepos(ctx).studentSummaries.get(tenantId, studentId);
  if (!summary) fail2("NOT_FOUND", `no summary for student ${studentId}`);
  const marker = summary["recompute"];
  if (input.marker?.taskId && marker?.taskId && marker.taskId !== input.marker.taskId) {
    return;
  }
  const now = ctx.now();
  const classIds = summary["classIds"] ?? [];
  for (const classId of classIds) {
    await recomputeClassSummaryService({ tenantId, classId }, ctx);
  }
  await updateLeaderboardService(
    {
      tenantId,
      userId: studentId,
      score: Math.round((summary["overallScore"] ?? 0) * 1e3),
      scope: "tenant",
    },
    ctx
  );
  await detectAtRiskService({ tenantId, summaries: [summary] }, ctx);
  const refreshed = await xrepos(ctx).studentSummaries.get(tenantId, studentId);
  if (refreshed?.["isAtRisk"] === true) {
    await sendNotificationService(
      {
        tenantId,
        recipientUid: studentId,
        recipientRole: "student",
        type: "at_risk_intervention",
        title: "Support available",
        body: "We noticed you might need some help \u2014 let\u2019s get back on track.",
        entityType: "student",
        entityId: studentId,
      },
      ctx
    );
  }
  await xrepos(ctx).studentSummaries.upsert(
    tenantId,
    { id: studentId, recompute: null, lastUpdatedAt: now },
    now
  );
}
var COST_DAILY2 = "costDaily";
var COST_MONTHLY2 = "costMonthly";
var INSIGHT3 = "insight";
async function aggregateDailyCostService(input, ctx) {
  const { tenantId, date } = input;
  const now = ctx.now();
  const month = date.slice(0, 7);
  const logs = (
    await ctx.repos.tenants.list(tenantId, {
      filter: (d) => d["_kind"] === "llmCallLog" && String(d["createdAt"]).slice(0, 10) === date,
      limit: 1e3,
    })
  ).items;
  const totalCostUsd = logs.reduce((sum, l) => sum + (l["costUSD"] ?? 0), 0);
  const totalInputTokens = logs.reduce((s, l) => s + (l["inputTokens"] ?? 0), 0);
  const totalOutputTokens = logs.reduce((s, l) => s + (l["outputTokens"] ?? 0), 0);
  const dailyId = `${COST_DAILY2}_${date}`;
  const prevDaily = await ctx.repos.tenants.get(tenantId, dailyId);
  const prevCost = prevDaily?.["totalCostUsd"] ?? 0;
  await ctx.repos.tenants.upsert(
    tenantId,
    {
      id: dailyId,
      _kind: COST_DAILY2,
      date,
      totalCalls: logs.length,
      totalInputTokens,
      totalOutputTokens,
      totalCostUsd,
      computedAt: now,
    },
    now
  );
  const monthlyId = `${COST_MONTHLY2}_${month}`;
  const prevMonthly = await ctx.repos.tenants.get(tenantId, monthlyId);
  const monthlyCost = (prevMonthly?.["totalCostUsd"] ?? 0) + (totalCostUsd - prevCost);
  const budget = prevMonthly?.["budgetLimitUsd"] ?? 0;
  const usedPct = budget > 0 ? (monthlyCost / budget) * 100 : 0;
  await ctx.repos.tenants.upsert(
    tenantId,
    {
      id: monthlyId,
      _kind: COST_MONTHLY2,
      month,
      totalCostUsd: monthlyCost,
      budgetLimitUsd: budget,
      budgetUsedPercent: usedPct,
      computedAt: now,
    },
    now
  );
  const alreadySent = prevMonthly?.["budgetAlertSent"] ?? false;
  if (budget > 0 && usedPct >= 80 && !alreadySent) {
    await ctx.repos.tenants.upsert(
      tenantId,
      { id: monthlyId, _kind: COST_MONTHLY2, budgetAlertSent: true },
      now
    );
    await ctx.repos.tx(async (tx) => {
      enqueueOutboxEvent(tx, {
        type: "ai.budget.alert",
        tenantId,
        payload: { month, usedPct, breach: usedPct >= 100 ? "hard" : "soft" },
        createdAt: now,
      });
    });
  }
}
async function dismissInsightService(input, ctx) {
  const tenantId = requireTenant(ctx);
  const insight = await findInsight(ctx, tenantId, input.insightId);
  if (!insight) fail2("NOT_FOUND", `insight ${input.insightId} not found`);
  const studentId = insight["studentId"];
  const allowed =
    (ctx.role === "student" && ctx.entityIds.studentId === studentId) ||
    (ctx.role === "parent" && ctx.studentIds.includes(studentId)) ||
    ctx.isSuperAdmin;
  if (!allowed) {
    authorize(ctx, "summary.read", { studentId, tenantId });
  }
  const dismissedAt = ctx.now();
  if (insight["_source"] === "dedicated") {
    await xrepos(ctx).analyticsInsights.upsert(
      tenantId,
      { id: insight["id"], dismissed: true, dismissedAt },
      dismissedAt
    );
  } else {
    await ctx.repos.tenants.upsert(
      tenantId,
      { id: insight["id"], _kind: INSIGHT3, dismissedAt },
      dismissedAt
    );
  }
  return { id: input.insightId, dismissedAt };
}
var REPORT_TTL_MS = 60 * 60 * 1e3;
async function generateReportService(input, ctx) {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "report.generate", {
    examId: input.examId,
    studentId: input.studentId,
    classId: input.classId,
    tenantId,
  });
  const hook = ctx.reports;
  const refs = { examId: input.examId, studentId: input.studentId, classId: input.classId };
  const pdfUrl = hook
    ? await hook.renderAndSign(input.type, refs, tenantId, REPORT_TTL_MS)
    : `https://storage.local/tenants/${tenantId}/reports/${input.type}-${Date.now()}.pdf`;
  const expiresMs = Date.parse(ctx.now()) + REPORT_TTL_MS;
  const expiresAt = new Date(
    Number.isNaN(expiresMs) ? Date.now() + REPORT_TTL_MS : expiresMs
  ).toISOString();
  return { pdfUrl, expiresAt };
}
async function findInsight(ctx, tenantId, insightId) {
  const dedicated = await xrepos(ctx).analyticsInsights.get(tenantId, insightId);
  if (dedicated) return { ...dedicated, _source: "dedicated" };
  const direct = await ctx.repos.tenants.get(tenantId, insightId);
  if (direct && direct["_kind"] === INSIGHT3) return direct;
  const page = await ctx.repos.tenants.list(tenantId, {
    filter: (d) => d["_kind"] === INSIGHT3 && d["id"] === insightId,
    limit: 1,
  });
  return page.items[0] ?? null;
}
var GRADED_PIPELINE_STATUSES = /* @__PURE__ */ new Set(["ready_for_review", "reviewed"]);
async function onSubmissionGradedService(event, ctx) {
  const before = event.before;
  const after = event.after;
  if (!after) return;
  const prev = before?.["pipelineStatus"];
  const next = after["pipelineStatus"];
  if (!GRADED_PIPELINE_STATUSES.has(next) || GRADED_PIPELINE_STATUSES.has(prev ?? "")) return;
  const studentId = after["studentId"];
  await recomputeStudentSummaryService(
    { tenantId: event.tenantId, studentId, section: "autograde" },
    ctx
  );
  await enqueueOrchestrator(ctx, event.tenantId, studentId, "autograde");
}
async function onSpaceProgressUpdatedService(event, ctx) {
  const after = event.after;
  if (!after) return;
  const studentId = after["userId"] ?? after["studentId"];
  if (!studentId) return;
  await recomputeStudentSummaryService(
    { tenantId: event.tenantId, studentId, section: "levelup" },
    ctx
  );
  await enqueueOrchestrator(ctx, event.tenantId, studentId, "levelup");
}
async function onExamResultsReleasedService(event, ctx) {
  const prev = event.before?.["status"];
  const next = event.after?.["status"];
  if (next !== "results_released" || prev === "results_released") return;
  const examId = event.after["id"];
  await recomputeExamAnalyticsService({ tenantId: event.tenantId, examId }, ctx);
  await ctx.repos.tx(async (tx) => {
    enqueueOutboxEvent(tx, {
      type: "exam.results.released",
      tenantId: event.tenantId,
      payload: { examId },
      createdAt: ctx.now(),
    });
  });
}
async function recomputeOrchestratorHandler(payload, ctx) {
  await recomputeOrchestratorService(payload, ctx);
}
async function enqueueOrchestrator(ctx, tenantId, studentId, reason) {
  const hook = ctx.enqueueRecompute;
  const marker = { reason, requestedAt: ctx.now(), taskId: `${studentId}:${ctx.now()}` };
  if (hook) {
    await hook({ tenantId, studentId, marker });
    return;
  }
  await recomputeOrchestratorService({ tenantId, studentId, marker }, ctx);
}
async function dailyCostAggregationService(input, ctx) {
  const date = ctx.now().slice(0, 10);
  await aggregateDailyCostService({ tenantId: input.tenantId, date }, ctx);
}
async function nightlyAtRiskDetectionService(input, ctx) {
  let cursor;
  do {
    const page = await ctx.repos.tenants.list(input.tenantId, {
      filter: (d) => d["_kind"] === "studentSummary",
      cursor,
      limit: 500,
    });
    if (page.items.length > 0) {
      await detectAtRiskService({ tenantId: input.tenantId, summaries: page.items }, ctx);
    }
    cursor = page.nextCursor ?? void 0;
  } while (cursor);
}
async function generateInsightsScheduler(input, ctx) {
  let cursor;
  do {
    const page = await ctx.repos.tenants.list(input.tenantId, {
      filter: (d) => d["_kind"] === "studentSummary",
      cursor,
      limit: 200,
    });
    for (const summary of page.items) {
      const ctxIn = buildInsightContext(summary);
      const seeds = generateInsightsForStudent(ctxIn);
      if (seeds.length > 0) {
        await generateInsightsService(
          { tenantId: input.tenantId, studentId: summary["studentId"], seeds },
          ctx
        );
      }
    }
    cursor = page.nextCursor ?? void 0;
  } while (cursor);
}
function buildInsightContext(summary) {
  const levelup = summary["levelup"];
  return {
    weakTopics: summary["weaknessAreas"] ?? [],
    upcomingExams: [],
    streakDays: levelup?.["streakDays"] ?? 0,
    improved: false,
    isAtRisk: summary["isAtRisk"] ?? false,
  };
}

// src/identity.ts
function wire(name, service) {
  return makeCallable(name, service);
}
var sysCtx = (ctx) => ctx;
function wireScheduler(schedule3, service) {
  return makeScheduler(schedule3, (ctx) => service(sysCtx(ctx)));
}
var saveTenant2 = wire("v1.identity.saveTenant", saveTenantService);
var deactivateTenant2 = wire("v1.identity.deactivateTenant", deactivateTenantService);
var reactivateTenant2 = wire("v1.identity.reactivateTenant", reactivateTenantService);
var lookupTenantByCode2 = wire("v1.identity.lookupTenantByCode", lookupTenantByCodeService);
var exportTenantData2 = wire("v1.identity.exportTenantData", exportTenantDataService);
var uploadTenantAsset2 = wire("v1.identity.uploadTenantAsset", uploadTenantAssetService);
var saveStudent2 = wire("v1.identity.saveStudent", saveStudentService);
var saveTeacher2 = wire("v1.identity.saveTeacher", saveTeacherService);
var saveParent2 = wire("v1.identity.saveParent", saveParentService);
var saveStaff2 = wire("v1.identity.saveStaff", saveStaffService);
var saveClass2 = wire("v1.identity.saveClass", saveClassService);
var saveAcademicSession2 = wire("v1.identity.saveAcademicSession", saveAcademicSessionService);
var createOrgUser2 = wire("v1.identity.createOrgUser", createOrgUserService);
var switchActiveTenant2 = wire("v1.identity.switchActiveTenant", switchActiveTenantService);
var joinTenant2 = wire("v1.identity.joinTenant", joinTenantService);
var bulkImportStudents2 = wire("v1.identity.bulkImportStudents", bulkImportStudentsService);
var bulkImportTeachers2 = wire("v1.identity.bulkImportTeachers", bulkImportTeachersService);
var bulkUpdateStatus2 = wire("v1.identity.bulkUpdateStatus", bulkUpdateStatusService);
var rolloverSession2 = wire("v1.identity.rolloverSession", rolloverSessionService);
var getMe2 = wire("v1.identity.getMe", getMeService);
var listStudents2 = wire("v1.identity.listStudents", listStudentsService);
var getStudent2 = wire("v1.identity.getStudent", getStudentService);
var listTeachers2 = wire("v1.identity.listTeachers", listTeachersService);
var getTeacher2 = wire("v1.identity.getTeacher", getTeacherService);
var listParents2 = wire("v1.identity.listParents", listParentsService);
var listStaff2 = wire("v1.identity.listStaff", listStaffService);
var listClasses2 = wire("v1.identity.listClasses", listClassesService);
var getClass2 = wire("v1.identity.getClass", getClassService);
var listAcademicSessions2 = wire("v1.identity.listAcademicSessions", listAcademicSessionsService);
var searchUsers2 = wire("v1.identity.searchUsers", searchUsersService);
var saveGlobalEvaluationPreset2 = wire(
  "v1.identity.saveGlobalEvaluationPreset",
  saveGlobalEvaluationPresetService
);
var updateMyProfile2 = wire("v1.identity.updateMyProfile", updateMyProfileService);
var deleteConsumerAccount2 = wire(
  "v1.identity.deleteConsumerAccount",
  deleteConsumerAccountService
);
var setUserStatus2 = wire("v1.identity.setUserStatus", setUserStatusService);
var sendPasswordReset2 = wire("v1.identity.sendPasswordReset", sendPasswordResetService);
var startImpersonation2 = wire("v1.identity.startImpersonation", startImpersonationService);
var endImpersonation2 = wire("v1.identity.endImpersonation", endImpersonationService);
var listNotifications2 = wire("v1.identity.listNotifications", listNotificationsService);
var getNotificationBadge2 = wire("v1.identity.getNotificationBadge", getNotificationBadgeService);
var markNotificationRead2 = wire("v1.identity.markNotificationRead", markNotificationReadService);
var getNotificationPreferences2 = wire(
  "v1.identity.getNotificationPreferences",
  getNotificationPreferencesService
);
var saveNotificationPreferences2 = wire(
  "v1.identity.saveNotificationPreferences",
  saveNotificationPreferencesService
);
var saveAnnouncement2 = wire("v1.identity.saveAnnouncement", saveAnnouncementService);
var listAnnouncements2 = wire("v1.identity.listAnnouncements", listAnnouncementsService);
var markAnnouncementRead2 = wire("v1.identity.markAnnouncementRead", markAnnouncementReadService);
var estimateAudience2 = wire("v1.identity.estimateAudience", estimateAudienceService);
var registerDeviceToken2 = wire("v1.identity.registerDeviceToken", registerDeviceTokenService);
var unregisterDeviceToken2 = wire(
  "v1.identity.unregisterDeviceToken",
  unregisterDeviceTokenService
);
var sendDirectMessage2 = wire("v1.identity.sendDirectMessage", sendDirectMessageService);
var getTenantShell = async (_input, ctx) => {
  const tenantId = requireTenant(ctx);
  const tenant = await ctx.repos.tenants.get(tenantId, tenantId);
  if (!tenant) fail2("NOT_FOUND", "tenant not found");
  return tenant;
};
var getTenant2 = wire("v1.identity.getTenant", getTenantShell);
var TENANT_PLANS2 = /* @__PURE__ */ new Set(["free", "trial", "basic", "premium", "enterprise"]);
var projectTenantSummary = (t) => {
  const sub = t["subscription"] ?? {};
  const stats = t["stats"] ?? {};
  const rawPlan = sub["plan"] ?? t["plan"];
  return {
    id: t["id"],
    name: t["name"] ?? "",
    slug: t["slug"] ?? t["id"],
    status: t["status"],
    // Canonical `zTenantPlan` is {free,trial,basic,premium,enterprise}; a legacy
    // tier (e.g. seed 'starter') coerces to the neutral 'free' so the strict enum
    // validates without weakening the schema.
    plan: rawPlan && TENANT_PLANS2.has(rawPlan) ? rawPlan : "free",
    totalStudents: stats["totalStudents"] ?? 0,
    totalTeachers: stats["totalTeachers"] ?? 0,
    createdAt: t["createdAt"],
  };
};
var listTenantsShell = async (input, ctx) => {
  const page = input;
  const where = {};
  if (page.status) where["status"] = page.status;
  const res = await ctx.repos.tenants.list("__platform__", {
    cursor: page.cursor,
    limit: page.limit ?? 20,
    where: Object.keys(where).length ? where : void 0,
    // The `__platform__` tenants collection also carries non-tenant control docs
    // (`__config__`, code-index rows); keep only real tenant docs (have a status).
    filter: (d) =>
      d["id"] !== "__config__" &&
      typeof d["status"] === "string" &&
      (!page.plan || (d["subscription"]?.["plan"] ?? d["plan"]) === page.plan),
  });
  return {
    items: res.items.map(projectTenantSummary),
    nextCursor: res.nextCursor,
  };
};
var listTenants2 = wire("v1.identity.listTenants", listTenantsShell);
var listExportJobsShell = async (input, ctx) => {
  void input;
  requireTenant(ctx);
  return { items: [], nextCursor: null };
};
var listExportJobs2 = wire("v1.identity.listExportJobs", listExportJobsShell);
var listGlobalEvaluationPresetsShell = async (input, ctx) => {
  const page = input;
  const where = page.status ? { status: page.status } : void 0;
  const res = await xrepos(ctx).presets.list("__global__", {
    cursor: page.cursor,
    limit: page.limit ?? 20,
    where,
  });
  return { items: res.items, nextCursor: res.nextCursor };
};
var listGlobalEvaluationPresets2 = wire(
  "v1.identity.listGlobalEvaluationPresets",
  listGlobalEvaluationPresetsShell
);
var changeMembershipRoleShell = async (input, ctx) => {
  const tenantId = requireTenant(ctx);
  const req = input;
  const existing = await xrepos(ctx).memberships.get(req.uid, tenantId);
  if (!existing) fail2("NOT_FOUND", "membership not found");
  const { id: membershipId } = await xrepos(ctx).memberships.upsert(
    req.uid,
    tenantId,
    { ...existing, role: req.toRole, ...(req.links ?? {}) },
    ctx.now()
  );
  await syncMembershipClaims(req.uid, tenantId, ctx, { revoke: true });
  return { membershipId, role: req.toRole };
};
var changeMembershipRole2 = wire("v1.identity.changeMembershipRole", changeMembershipRoleShell);
var saveTenantSettingsShell = async (input, ctx) => {
  const tenantId = requireTenant(ctx);
  const req = input;
  const { id, created } = await ctx.repos.tenants.upsert(
    tenantId,
    { id: tenantId, settings: req.data },
    ctx.now()
  );
  return { id, created };
};
var saveTenantSettings2 = wire("v1.identity.saveTenantSettings", saveTenantSettingsShell);
var saveTenantFeaturesShell = async (input, ctx) => {
  const tenantId = requireTenant(ctx);
  const req = input;
  const { id, created } = await ctx.repos.tenants.upsert(
    tenantId,
    { id: tenantId, features: req.features },
    ctx.now()
  );
  return { id, created };
};
var saveTenantFeatures2 = wire("v1.identity.saveTenantFeatures", saveTenantFeaturesShell);
var bulkApplyTenantFeaturesShell = async (input, ctx) => {
  const req = input;
  let updated = 0;
  const errors = [];
  const now = ctx.now();
  for (const tenantId of req.tenantIds) {
    try {
      await ctx.repos.tenants.upsert(
        tenantId,
        { id: tenantId, features: { [req.featureKey]: req.enabled } },
        now
      );
      updated++;
    } catch (e) {
      errors.push({ tenantId, error: e instanceof Error ? e.message : "unknown error" });
    }
  }
  return { updated, errors };
};
var bulkApplyTenantFeatures2 = wire(
  "v1.identity.bulkApplyTenantFeatures",
  bulkApplyTenantFeaturesShell
);
var getPlatformConfigShell = async (_input, ctx) => {
  const cfg = await ctx.repos.tenants.get("__platform__", "__config__");
  if (!cfg) fail2("NOT_FOUND", "platform config not found");
  return cfg;
};
var getPlatformConfig2 = wire("v1.identity.getPlatformConfig", getPlatformConfigShell);
var savePlatformConfigShell = async (input, ctx) => {
  const req = input;
  await ctx.repos.tenants.upsert("__platform__", { id: "__config__", ...req.data }, ctx.now());
  return { saved: true };
};
var savePlatformConfig2 = wire("v1.identity.savePlatformConfig", savePlatformConfigShell);
var uploadUserAssetShell = async (_input, ctx) => {
  return { assetUrl: `users/${ctx.uid}/assets/avatar` };
};
var uploadUserAsset2 = wire("v1.identity.uploadUserAsset", uploadUserAssetShell);
var onMembershipWritten = makeTrigger(
  { document: "users/{uid}/memberships/{tenantId}", eventType: "written", tenantParam: "tenantId" },
  (event, ctx) =>
    onMembershipWrittenService(
      {
        tenantId: event.params["tenantId"] ?? "",
        params: event.params,
        before: event.before,
        after: event.after,
      },
      sysCtx(ctx)
    )
);
var onStudentArchived = makeTrigger(
  { document: "tenants/{tenantId}/students/{id}", eventType: "updated", tenantParam: "tenantId" },
  (event, ctx) =>
    onStudentArchivedService(
      {
        tenantId: event.params["tenantId"] ?? "",
        params: event.params,
        before: event.before,
        after: event.after,
      },
      sysCtx(ctx)
    )
);
var onClassArchived = makeTrigger(
  { document: "tenants/{tenantId}/classes/{id}", eventType: "updated", tenantParam: "tenantId" },
  (event, ctx) =>
    onClassArchivedService(
      {
        tenantId: event.params["tenantId"] ?? "",
        params: event.params,
        before: event.before,
        after: event.after,
      },
      sysCtx(ctx)
    )
);
var onTenantDeactivated = makeTrigger(
  { document: "tenants/{tenantId}", eventType: "updated", tenantParam: "tenantId" },
  (event, ctx) =>
    onTenantDeactivatedService(
      {
        tenantId: event.params["tenantId"] ?? "",
        params: event.params,
        before: event.before,
        after: event.after,
      },
      sysCtx(ctx)
    )
);
var onAnnouncementPublished = makeTrigger(
  {
    document: "tenants/{tenantId}/announcements/{id}",
    eventType: "written",
    tenantParam: "tenantId",
  },
  (event, ctx) =>
    onAnnouncementPublishedService(
      {
        tenantId: event.params["tenantId"] ?? "",
        params: event.params,
        before: event.before,
        after: event.after,
      },
      sysCtx(ctx)
    )
);
var tenantLifecycleCheck = wireScheduler("every day 00:00", tenantLifecycleCheckService);
var monthlyUsageReset = wireScheduler("0 0 1 * *", monthlyUsageResetService);
var cleanupExpiredExports = wireScheduler("every 30 minutes", cleanupExpiredExportsService);

// src/levelup.ts
var levelup_exports = {};
__export(levelup_exports, {
  cleanupStaleSessions: () => cleanupStaleSessions,
  dismissInsight: () => dismissInsight2,
  evaluateAnswer: () => evaluateAnswer,
  expireTestSessions: () => expireTestSessions,
  getGamificationSummary: () => getGamificationSummary,
  getItemForEdit: () => getItemForEdit,
  getLeaderboard: () => getLeaderboard2,
  getSpace: () => getSpace,
  getSpaceProgress: () => getSpaceProgress,
  getStoryPoint: () => getStoryPoint,
  getStoryPointProgress: () => getStoryPointProgress,
  getStudentLevel: () => getStudentLevel,
  getTestSession: () => getTestSession,
  listAchievements: () => listAchievements,
  listItems: () => listItems,
  listLearningInsights: () => listLearningInsights,
  listSpaces: () => listSpaces,
  listStoreSpaces: () => listStoreSpaces,
  listStoryPoints: () => listStoryPoints,
  listStudentAchievements: () => listStudentAchievements,
  listStudyGoals: () => listStudyGoals,
  listStudySessions: () => listStudySessions,
  listTestSessions: () => listTestSessions,
  markAchievementsSeen: () => markAchievementsSeen,
  purchaseSpace: () => purchaseSpace,
  recordItemAttempt: () => recordItemAttempt,
  saveAchievementDefinition: () => saveAchievementDefinition,
  saveItem: () => saveItem,
  saveSpace: () => saveSpace,
  saveStoryPoint: () => saveStoryPoint,
  saveStudyGoal: () => saveStudyGoal,
  saveTestAnswer: () => saveTestAnswer,
  sendChatMessage: () => sendChatMessage,
  startTestSession: () => startTestSession,
  submitTestSession: () => submitTestSession,
});
function call(name, service) {
  return makeCallable(name, service);
}
function schedule(spec, service) {
  return makeScheduler(spec, service);
}
var saveSpace = call("v1.levelup.saveSpace", saveSpaceService);
var saveStoryPoint = call("v1.levelup.saveStoryPoint", saveStoryPointService);
var saveItem = call("v1.levelup.saveItem", saveItemService);
var getItemForEdit = call("v1.levelup.getItemForEdit", getItemForEditService);
var listItems = call("v1.levelup.listItems", listItemsService);
var listSpaces = call("v1.levelup.listSpaces", listSpacesService);
var getSpace = call("v1.levelup.getSpace", getSpaceService);
var listStoryPoints = call("v1.levelup.listStoryPoints", listStoryPointsService);
var getStoryPoint = call("v1.levelup.getStoryPoint", getStoryPointService);
var startTestSession = call("v1.levelup.startTestSession", startTestSessionService);
var submitTestSession = call("v1.levelup.submitTestSession", submitTestSessionService);
var saveTestAnswer = call("v1.levelup.saveTestAnswer", saveTestAnswerService);
var getTestSession = call("v1.levelup.getTestSession", getTestSessionService);
var listTestSessions = call("v1.levelup.listTestSessions", listTestSessionsService);
var evaluateAnswer = call("v1.levelup.evaluateAnswer", evaluateAnswerService);
var recordItemAttempt = call("v1.levelup.recordItemAttempt", recordItemAttemptService);
var getSpaceProgress = call("v1.levelup.getSpaceProgress", getSpaceProgressService);
var getStoryPointProgress = call("v1.levelup.getStoryPointProgress", getStoryPointProgressService);
var purchaseSpace = call("v1.levelup.purchaseSpace", purchaseSpaceService);
var listStoreSpaces = call("v1.levelup.listStoreSpaces", listStoreSpacesService);
var sendChatMessage = call("v1.levelup.sendChatMessage", sendChatMessageService);
var getGamificationSummary = call(
  "v1.levelup.getGamificationSummary",
  getGamificationSummaryService
);
var getStudentLevel = call("v1.levelup.getStudentLevel", getStudentLevelService);
var listAchievements = call("v1.levelup.listAchievements", listAchievementsService);
var listStudentAchievements = call(
  "v1.levelup.listStudentAchievements",
  listStudentAchievementsService
);
var markAchievementsSeen = call("v1.levelup.markAchievementsSeen", markAchievementsSeenService);
var saveAchievementDefinition = call(
  "v1.levelup.saveAchievementDefinition",
  saveAchievementDefinitionService
);
var getLeaderboard2 = call("v1.levelup.getLeaderboard", levelupGetLeaderboardService);
var listStudyGoals = call("v1.levelup.listStudyGoals", listStudyGoalsService);
var saveStudyGoal = call("v1.levelup.saveStudyGoal", saveStudyGoalService);
var listStudySessions = call("v1.levelup.listStudySessions", listStudySessionsService);
var listLearningInsights = call("v1.levelup.listLearningInsights", listLearningInsightsService);
var dismissInsight2 = call("v1.levelup.dismissInsight", levelupDismissInsightService);
var expireTestSessions = schedule("every 5 minutes", expireTestSessionsService);
var cleanupStaleSessions = schedule("every 1 hours", cleanupStaleSessionsService);

// src/autograde.ts
var autograde_exports = {};
__export(autograde_exports, {
  advancePipeline: () => advancePipeline,
  extractQuestions: () => extractQuestions,
  getExam: () => getExam,
  getExamAnalytics: () => getExamAnalytics2,
  getSubmission: () => getSubmission,
  getSubmissionForExam: () => getSubmissionForExam,
  gradeQuestion: () => gradeQuestion,
  listDeadLetter: () => listDeadLetter,
  listEvaluationSettings: () => listEvaluationSettings2,
  listExams: () => listExams,
  listQuestionSubmissions: () => listQuestionSubmissions2,
  listQuestions: () => listQuestions,
  listSubmissions: () => listSubmissions,
  onExamDeleted: () => onExamDeleted,
  onExamPublished: () => onExamPublished,
  onQuestionSubmissionUpdated: () => onQuestionSubmissionUpdated,
  onResultsReleased: () => onResultsReleased,
  onSubmissionCreated: () => onSubmissionCreated,
  onSubmissionUpdated: () => onSubmissionUpdated,
  releaseResults: () => releaseResults,
  requestUploadUrl: () => requestUploadUrl,
  resolveDeadLetter: () => resolveDeadLetter,
  saveEvaluationSettings: () => saveEvaluationSettings,
  saveExam: () => saveExam,
  staleSubmissionWatchdog: () => staleSubmissionWatchdog,
  uploadAnswerSheets: () => uploadAnswerSheets,
});
function call2(name, service) {
  return makeCallable(name, service);
}
var sysCtx2 = (ctx) => ctx;
var saveExam = call2("v1.autograde.saveExam", saveExamService);
var extractQuestions = call2("v1.autograde.extractQuestions", extractQuestionsService);
var uploadAnswerSheets = call2("v1.autograde.uploadAnswerSheets", uploadAnswerSheetsService);
var requestUploadUrl = call2("v1.autograde.requestUploadUrl", requestUploadUrlService);
var gradeQuestion = call2("v1.autograde.gradeQuestion", gradeQuestionService);
var releaseResults = call2("v1.autograde.releaseResults", releaseResultsService);
var saveEvaluationSettings = call2(
  "v1.autograde.saveEvaluationSettings",
  saveEvaluationSettingsService
);
var resolveDeadLetter = call2("v1.autograde.resolveDeadLetter", resolveDeadLetterService);
var listExams = call2("v1.autograde.listExams", listExamsService);
var getExam = call2("v1.autograde.getExam", getExamService);
var listQuestions = call2("v1.autograde.listQuestions", listQuestionsService);
var listSubmissions = call2("v1.autograde.listSubmissions", listSubmissionsService);
var getSubmission = call2("v1.autograde.getSubmission", getSubmissionService);
var getSubmissionForExam = call2("v1.autograde.getSubmissionForExam", getSubmissionForExamService);
var listQuestionSubmissions2 = call2(
  "v1.autograde.listQuestionSubmissions",
  listQuestionSubmissionsService
);
var getExamAnalytics2 = call2("v1.autograde.getExamAnalytics", getExamAnalyticsService);
var listEvaluationSettings2 = call2(
  "v1.autograde.listEvaluationSettings",
  listEvaluationSettingsService
);
var listDeadLetter = call2("v1.autograde.listDeadLetter", listDeadLetterService);
function toServiceEvent(event, ctx) {
  return {
    params: event.params,
    before: event.before,
    after: event.after,
    tenantId: String(ctx.tenantId ?? event.params["tenantId"] ?? ""),
    eventId: event.id,
  };
}
var onSubmissionCreated = makeTrigger(
  {
    document: "tenants/{tenantId}/submissions/{submissionId}",
    eventType: "created",
    tenantParam: "tenantId",
  },
  (event, ctx) => onSubmissionCreatedService(toServiceEvent(event, ctx), sysCtx2(ctx))
);
var onSubmissionUpdated = makeTrigger(
  {
    document: "tenants/{tenantId}/submissions/{submissionId}",
    eventType: "updated",
    tenantParam: "tenantId",
  },
  (event, ctx) => onSubmissionUpdatedService(toServiceEvent(event, ctx), sysCtx2(ctx))
);
var onQuestionSubmissionUpdated = makeTrigger(
  {
    document: "tenants/{tenantId}/submissions/{submissionId}/questionSubmissions/{questionId}",
    eventType: "updated",
    tenantParam: "tenantId",
  },
  (event, ctx) => onQuestionSubmissionUpdatedService(toServiceEvent(event, ctx), sysCtx2(ctx))
);
var onExamPublished = makeTrigger(
  {
    document: "tenants/{tenantId}/exams/{examId}",
    eventType: "updated",
    tenantParam: "tenantId",
  },
  (event, ctx) => onExamPublishedService(toServiceEvent(event, ctx), sysCtx2(ctx))
);
var onResultsReleased = makeTrigger(
  {
    document: "tenants/{tenantId}/exams/{examId}",
    eventType: "updated",
    tenantParam: "tenantId",
  },
  (event, ctx) => onResultsReleasedService(toServiceEvent(event, ctx), sysCtx2(ctx))
);
var onExamDeleted = makeTrigger(
  {
    document: "tenants/{tenantId}/exams/{examId}",
    eventType: "deleted",
    tenantParam: "tenantId",
  },
  (event, ctx) => onExamDeletedService(toServiceEvent(event, ctx), sysCtx2(ctx))
);
var advancePipeline = makeTaskHandler(
  QUEUES.gradingPipeline,
  (payload, ctx) =>
    advancePipelineService(
      { submissionId: payload.submissionId, step: payload.step },
      sysCtx2(ctx)
    ),
  {
    tenantField: "tenantId",
    retryConfig: { maxAttempts: 5, minBackoffSeconds: 10 },
    rateLimits: { maxConcurrentDispatches: 6 },
  }
);
async function fanOutPerTenant(ctx, service) {
  let cursor;
  do {
    const page = await ctx.repos.tenants.list("__platform__", { cursor, limit: 200 });
    for (const tenant of page.items) {
      const tenantId = String(tenant.id);
      const tenantCtx = { ...ctx, tenantId };
      await service({ tenantId }, tenantCtx);
    }
    cursor = page.nextCursor ?? void 0;
  } while (cursor);
}
var staleSubmissionWatchdog = makeScheduler("every 15 minutes", (ctx) =>
  fanOutPerTenant(sysCtx2(ctx), staleSubmissionWatchdogService)
);

// src/analytics.ts
var analytics_exports = {};
__export(analytics_exports, {
  dailyCostAggregation: () => dailyCostAggregation,
  dismissInsight: () => dismissInsight3,
  generateInsights: () => generateInsights,
  generateReport: () => generateReport2,
  getChildSummary: () => getChildSummary2,
  getCostSummary: () => getCostSummary2,
  getExamAnalytics: () => getExamAnalytics3,
  getLeaderboard: () => getLeaderboard3,
  getPerformanceTrends: () => getPerformanceTrends2,
  getSummary: () => getSummary2,
  listInsights: () => listInsights2,
  listLinkedChildren: () => listLinkedChildren2,
  listParentAlerts: () => listParentAlerts2,
  listPlatformActivity: () => listPlatformActivity2,
  nightlyAtRiskDetection: () => nightlyAtRiskDetection,
  onExamResultsReleased: () => onExamResultsReleased,
  onSpaceProgressUpdated: () => onSpaceProgressUpdated,
  onSubmissionGraded: () => onSubmissionGraded,
  recomputeStudentRollup: () => recomputeStudentRollup,
});
function call3(name, service) {
  return makeCallable(name, service);
}
function trigger(ref, service) {
  const bridged = (event, ctx) =>
    service(
      {
        params: event.params,
        before: event.before,
        after: event.after,
        tenantId: String(ctx.tenantId ?? event.params["tenantId"] ?? ""),
        eventId: event.id,
      },
      ctx
    );
  return makeTrigger(ref, bridged);
}
function schedule2(spec, service) {
  const platform = async (ctx) => {
    const sysCtx3 = ctx;
    const tenantsRepo = sysCtx3.repos.tenants;
    let cursor;
    do {
      const page = await tenantsRepo.list("__platform__", { cursor, limit: 200 });
      for (const tenant of page.items) {
        const tenantId = String(tenant.id);
        const tenantCtx = { ...sysCtx3, tenantId };
        await service({ tenantId }, tenantCtx);
      }
      cursor = page.nextCursor ?? void 0;
    } while (cursor);
  };
  return makeScheduler(spec, platform);
}
function task(queue, service, opts = {}) {
  return makeTaskHandler(queue, service, opts);
}
var getSummary2 = call3("v1.analytics.getSummary", getSummaryService);
var getExamAnalytics3 = call3("v1.analytics.getExamAnalytics", getExamAnalyticsService2);
var listInsights2 = call3("v1.analytics.listInsights", listInsightsService);
var getPerformanceTrends2 = call3("v1.analytics.getPerformanceTrends", getPerformanceTrendsService);
var getChildSummary2 = call3("v1.analytics.getChildSummary", getChildSummaryService);
var listLinkedChildren2 = call3("v1.analytics.listLinkedChildren", listLinkedChildrenService);
var listParentAlerts2 = call3("v1.analytics.listParentAlerts", listParentAlertsService);
var listPlatformActivity2 = call3("v1.analytics.listPlatformActivity", listPlatformActivityService);
var getCostSummary2 = call3("v1.analytics.getCostSummary", getCostSummaryService);
var generateReport2 = call3("v1.analytics.generateReport", generateReportService);
var dismissInsight3 = call3("v1.analytics.dismissInsight", dismissInsightService);
var getLeaderboard3 = call3("v1.analytics.getLeaderboard", getLeaderboardService);
var onSubmissionGraded = trigger(
  {
    document: "tenants/{tenantId}/submissions/{submissionId}",
    eventType: "updated",
    tenantParam: "tenantId",
  },
  onSubmissionGradedService
);
var onSpaceProgressUpdated = trigger(
  {
    document: "tenants/{tenantId}/spaceProgress/{progressId}",
    eventType: "written",
    tenantParam: "tenantId",
  },
  onSpaceProgressUpdatedService
);
var onExamResultsReleased = trigger(
  {
    document: "tenants/{tenantId}/exams/{examId}",
    eventType: "updated",
    tenantParam: "tenantId",
  },
  onExamResultsReleasedService
);
var recomputeStudentRollup = task(
  QUEUES.studentRollup,
  (payload, ctx) =>
    recomputeOrchestratorHandler(
      { tenantId: payload.tenantId, studentId: payload.studentId, marker: payload.marker },
      ctx
    ),
  {
    tenantField: "tenantId",
    retryConfig: { maxAttempts: 5, minBackoffSeconds: 10 },
    rateLimits: { maxConcurrentDispatches: 6 },
  }
);
var dailyCostAggregation = schedule2("5 0 * * *", dailyCostAggregationService);
var nightlyAtRiskDetection = schedule2("0 2 * * *", nightlyAtRiskDetectionService);
var generateInsights = schedule2("30 2 * * *", generateInsightsScheduler);

// src/index.ts
var v1 = {
  identity: identity_exports,
  levelup: levelup_exports,
  autograde: autograde_exports,
  analytics: analytics_exports,
};
export { v1 };
//# sourceMappingURL=index.js.map
