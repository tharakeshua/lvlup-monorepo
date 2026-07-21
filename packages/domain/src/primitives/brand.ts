/**
 * Brand mechanism + all branded ID types + `as*()` trust-boundary factories.
 *
 * The `unique symbol` technique gives nominal typing on top of `string` so a bare
 * `string` cannot be passed where a branded ID is required. Brands live *inside*
 * persisted shapes (via `branded-id.zod.ts`), never only at function signatures.
 */

declare const __brand: unique symbol;

export type Brand<T, B extends string> = T & { readonly [__brand]: B };

// ---------------------------------------------------------------------------
// The branded ID types
// ---------------------------------------------------------------------------
// Core 19 (domain-core.md §2.2) plus the additional domain-specific brands the
// per-domain plans require (TenantCode, MembershipId, SectionId, AnswerKeyId,
// RubricPresetId, TestSessionId, SpaceProgressId, ChatSessionId, ChatMessageId,
// SpaceReviewId, ContentVersionId, PurchaseId, QuestionSubmissionId,
// EvaluationSettingsId, DeadLetterEntryId, ExamAnalyticsId, InsightId,
// LlmCallLogId, CostSummaryId, HealthSnapshotId, PlatformActivityLogId,
// AnnouncementId, AchievementId, StudentAchievementId, StudentLevelId,
// StudyGoalId, StudySessionId).

export type TenantId = Brand<string, "TenantId">;
export type ClassId = Brand<string, "ClassId">;
export type StudentId = Brand<string, "StudentId">;
export type TeacherId = Brand<string, "TeacherId">;
export type ParentId = Brand<string, "ParentId">;
export type SpaceId = Brand<string, "SpaceId">;
export type StoryPointId = Brand<string, "StoryPointId">;
export type ItemId = Brand<string, "ItemId">;
export type ExamId = Brand<string, "ExamId">;
export type SubmissionId = Brand<string, "SubmissionId">;
export type UserId = Brand<string, "UserId">;
/**
 * @deprecated Use {@link TestSessionId} instead. Legacy alias, retained only for the
 * core-19 brand contract. New code should not reference `SessionId`.
 */
export type SessionId = Brand<string, "SessionId">;
export type AgentId = Brand<string, "AgentId">;
export type AcademicSessionId = Brand<string, "AcademicSessionId">;
export type NotificationId = Brand<string, "NotificationId">;
export type QuestionBankItemId = Brand<string, "QuestionBankItemId">;
export type StaffId = Brand<string, "StaffId">;
export type ScannerId = Brand<string, "ScannerId">;
export type ExamQuestionId = Brand<string, "ExamQuestionId">;

// Additional brands required by the per-domain plans.
export type ConversationSessionId = Brand<string, "ConversationSessionId">;
export type ConversationMessageId = Brand<string, "ConversationMessageId">;
export type ConversationTurnId = Brand<string, "ConversationTurnId">;
export type ConversationEvidenceId = Brand<string, "ConversationEvidenceId">;
export type ItemSubmissionId = Brand<string, "ItemSubmissionId">;
export type TenantCode = Brand<string, "TenantCode">;
export type MembershipId = Brand<string, "MembershipId">;
export type SectionId = Brand<string, "SectionId">;
export type AnswerKeyId = Brand<string, "AnswerKeyId">;
export type RubricPresetId = Brand<string, "RubricPresetId">;
export type TestSessionId = Brand<string, "TestSessionId">;
export type SpaceProgressId = Brand<string, "SpaceProgressId">;
export type ChatSessionId = Brand<string, "ChatSessionId">;
export type ChatMessageId = Brand<string, "ChatMessageId">;
export type SpaceReviewId = Brand<string, "SpaceReviewId">;
export type ContentVersionId = Brand<string, "ContentVersionId">;
export type PurchaseId = Brand<string, "PurchaseId">;
export type QuestionSubmissionId = Brand<string, "QuestionSubmissionId">;
export type EvaluationSettingsId = Brand<string, "EvaluationSettingsId">;
export type DeadLetterEntryId = Brand<string, "DeadLetterEntryId">;
export type ExamAnalyticsId = Brand<string, "ExamAnalyticsId">;
export type InsightId = Brand<string, "InsightId">;
export type LlmCallLogId = Brand<string, "LlmCallLogId">;
export type CostSummaryId = Brand<string, "CostSummaryId">;
export type HealthSnapshotId = Brand<string, "HealthSnapshotId">;
export type PlatformActivityLogId = Brand<string, "PlatformActivityLogId">;
export type AnnouncementId = Brand<string, "AnnouncementId">;
export type AchievementId = Brand<string, "AchievementId">;
export type StudentAchievementId = Brand<string, "StudentAchievementId">;
export type StudentLevelId = Brand<string, "StudentLevelId">;
export type StudyGoalId = Brand<string, "StudyGoalId">;
export type StudySessionId = Brand<string, "StudySessionId">;

// ---------------------------------------------------------------------------
// `as*()` factories — the trust-boundary cast (read / URL param / request → brand)
// ---------------------------------------------------------------------------
export const asTenantId = (id: string): TenantId => id as TenantId;
export const asClassId = (id: string): ClassId => id as ClassId;
export const asStudentId = (id: string): StudentId => id as StudentId;
export const asTeacherId = (id: string): TeacherId => id as TeacherId;
export const asParentId = (id: string): ParentId => id as ParentId;
export const asSpaceId = (id: string): SpaceId => id as SpaceId;
export const asStoryPointId = (id: string): StoryPointId => id as StoryPointId;
/** Product term alias — IDs are unchanged in Firestore/API. */
export type ModuleId = StoryPointId;
export const asModuleId = asStoryPointId;
export const asItemId = (id: string): ItemId => id as ItemId;
export const asExamId = (id: string): ExamId => id as ExamId;
export const asSubmissionId = (id: string): SubmissionId => id as SubmissionId;
export const asUserId = (id: string): UserId => id as UserId;
/** @deprecated Use {@link asTestSessionId} instead. */
export const asSessionId = (id: string): SessionId => id as SessionId;
export const asAgentId = (id: string): AgentId => id as AgentId;
export const asAcademicSessionId = (id: string): AcademicSessionId => id as AcademicSessionId;
export const asNotificationId = (id: string): NotificationId => id as NotificationId;
export const asQuestionBankItemId = (id: string): QuestionBankItemId => id as QuestionBankItemId;
export const asStaffId = (id: string): StaffId => id as StaffId;
export const asScannerId = (id: string): ScannerId => id as ScannerId;
export const asExamQuestionId = (id: string): ExamQuestionId => id as ExamQuestionId;

export const asConversationSessionId = (id: string): ConversationSessionId =>
  id as ConversationSessionId;
export const asConversationMessageId = (id: string): ConversationMessageId =>
  id as ConversationMessageId;
export const asConversationTurnId = (id: string): ConversationTurnId => id as ConversationTurnId;
export const asConversationEvidenceId = (id: string): ConversationEvidenceId =>
  id as ConversationEvidenceId;
export const asItemSubmissionId = (id: string): ItemSubmissionId => id as ItemSubmissionId;

export const asTenantCode = (id: string): TenantCode => id as TenantCode;
export const asMembershipId = (id: string): MembershipId => id as MembershipId;
export const asSectionId = (id: string): SectionId => id as SectionId;
export const asAnswerKeyId = (id: string): AnswerKeyId => id as AnswerKeyId;
export const asRubricPresetId = (id: string): RubricPresetId => id as RubricPresetId;
export const asTestSessionId = (id: string): TestSessionId => id as TestSessionId;
export const asSpaceProgressId = (id: string): SpaceProgressId => id as SpaceProgressId;
export const asChatSessionId = (id: string): ChatSessionId => id as ChatSessionId;
export const asChatMessageId = (id: string): ChatMessageId => id as ChatMessageId;
export const asSpaceReviewId = (id: string): SpaceReviewId => id as SpaceReviewId;
export const asContentVersionId = (id: string): ContentVersionId => id as ContentVersionId;
export const asPurchaseId = (id: string): PurchaseId => id as PurchaseId;
export const asQuestionSubmissionId = (id: string): QuestionSubmissionId =>
  id as QuestionSubmissionId;
export const asEvaluationSettingsId = (id: string): EvaluationSettingsId =>
  id as EvaluationSettingsId;
export const asDeadLetterEntryId = (id: string): DeadLetterEntryId => id as DeadLetterEntryId;
export const asExamAnalyticsId = (id: string): ExamAnalyticsId => id as ExamAnalyticsId;
export const asInsightId = (id: string): InsightId => id as InsightId;
export const asLlmCallLogId = (id: string): LlmCallLogId => id as LlmCallLogId;
export const asCostSummaryId = (id: string): CostSummaryId => id as CostSummaryId;
export const asHealthSnapshotId = (id: string): HealthSnapshotId => id as HealthSnapshotId;
export const asPlatformActivityLogId = (id: string): PlatformActivityLogId =>
  id as PlatformActivityLogId;
export const asAnnouncementId = (id: string): AnnouncementId => id as AnnouncementId;
export const asAchievementId = (id: string): AchievementId => id as AchievementId;
export const asStudentAchievementId = (id: string): StudentAchievementId =>
  id as StudentAchievementId;
export const asStudentLevelId = (id: string): StudentLevelId => id as StudentLevelId;
export const asStudyGoalId = (id: string): StudyGoalId => id as StudyGoalId;
export const asStudySessionId = (id: string): StudySessionId => id as StudySessionId;

// ---------------------------------------------------------------------------
// AnyId union + BRAND_TAGS registry (domain-core.md §2.4)
// ---------------------------------------------------------------------------
export type AnyId =
  | TenantId
  | ClassId
  | StudentId
  | TeacherId
  | ParentId
  | SpaceId
  | StoryPointId
  | ItemId
  | ExamId
  | SubmissionId
  | UserId
  | SessionId
  | AgentId
  | AcademicSessionId
  | NotificationId
  | QuestionBankItemId
  | StaffId
  | ScannerId
  | ExamQuestionId;

/**
 * The canonical 19 core brand tags (domain-core.md §2.4). `length === 19` is
 * asserted in `brand.contract.test.ts`. The additional domain brands above are
 * not part of this registry by design (the registry guards the core-19 contract).
 */
export const BRAND_TAGS = [
  "TenantId",
  "ClassId",
  "StudentId",
  "TeacherId",
  "ParentId",
  "SpaceId",
  "StoryPointId",
  "ItemId",
  "ExamId",
  "SubmissionId",
  "UserId",
  "SessionId",
  "AgentId",
  "AcademicSessionId",
  "NotificationId",
  "QuestionBankItemId",
  "StaffId",
  "ScannerId",
  "ExamQuestionId",
] as const;

export type BrandTag = (typeof BRAND_TAGS)[number];
