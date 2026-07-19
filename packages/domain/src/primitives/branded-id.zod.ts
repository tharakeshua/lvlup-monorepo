/**
 * The bridge that puts brands INTO schemas (kills REVIEW D8). One generic factory
 * + per-ID exported schemas. `z.infer<typeof zSpaceId>` is `SpaceId`.
 */
import { z } from "zod";
import type { Brand } from "./brand.js";

/** Non-empty trimmed string, re-typed to the brand. Firestore IDs: 1..1500 chars, no '/'. */
export const zBrandedId = <B extends string>(_brand: B) =>
  z
    .string()
    .min(1)
    .max(1500)
    .regex(/^[^/]+$/, 'id must not contain "/"')
    .transform((s) => s as Brand<string, B>);

export const zTenantId = zBrandedId("TenantId");
export const zClassId = zBrandedId("ClassId");
export const zStudentId = zBrandedId("StudentId");
export const zTeacherId = zBrandedId("TeacherId");
export const zParentId = zBrandedId("ParentId");
export const zSpaceId = zBrandedId("SpaceId");
export const zStoryPointId = zBrandedId("StoryPointId");
export const zItemId = zBrandedId("ItemId");
export const zExamId = zBrandedId("ExamId");
export const zSubmissionId = zBrandedId("SubmissionId");
export const zUserId = zBrandedId("UserId");
/**
 * @deprecated Use {@link zTestSessionId} instead. `SessionId` is a legacy alias with no
 * live callers in the new spine; retained only for the core-19 brand contract. All
 * test-session records use `TestSessionId`.
 */
export const zSessionId = zBrandedId("SessionId");
export const zAgentId = zBrandedId("AgentId");
export const zAcademicSessionId = zBrandedId("AcademicSessionId");
export const zNotificationId = zBrandedId("NotificationId");
export const zQuestionBankItemId = zBrandedId("QuestionBankItemId");
export const zStaffId = zBrandedId("StaffId");
export const zScannerId = zBrandedId("ScannerId");
export const zExamQuestionId = zBrandedId("ExamQuestionId");

export const zConversationSessionId = zBrandedId("ConversationSessionId");
export const zConversationMessageId = zBrandedId("ConversationMessageId");
export const zConversationTurnId = zBrandedId("ConversationTurnId");
export const zConversationEvidenceId = zBrandedId("ConversationEvidenceId");
export const zItemSubmissionId = zBrandedId("ItemSubmissionId");

export const zTenantCode = zBrandedId("TenantCode");
export const zMembershipId = zBrandedId("MembershipId");
export const zSectionId = zBrandedId("SectionId");
export const zAnswerKeyId = zBrandedId("AnswerKeyId");
export const zRubricPresetId = zBrandedId("RubricPresetId");
export const zTestSessionId = zBrandedId("TestSessionId");
export const zSpaceProgressId = zBrandedId("SpaceProgressId");
export const zChatSessionId = zBrandedId("ChatSessionId");
export const zChatMessageId = zBrandedId("ChatMessageId");
export const zSpaceReviewId = zBrandedId("SpaceReviewId");
export const zContentVersionId = zBrandedId("ContentVersionId");
export const zPurchaseId = zBrandedId("PurchaseId");
export const zQuestionSubmissionId = zBrandedId("QuestionSubmissionId");
export const zEvaluationSettingsId = zBrandedId("EvaluationSettingsId");
export const zDeadLetterEntryId = zBrandedId("DeadLetterEntryId");
export const zExamAnalyticsId = zBrandedId("ExamAnalyticsId");
export const zInsightId = zBrandedId("InsightId");
export const zLlmCallLogId = zBrandedId("LlmCallLogId");
export const zCostSummaryId = zBrandedId("CostSummaryId");
export const zHealthSnapshotId = zBrandedId("HealthSnapshotId");
export const zPlatformActivityLogId = zBrandedId("PlatformActivityLogId");
export const zAnnouncementId = zBrandedId("AnnouncementId");
export const zAchievementId = zBrandedId("AchievementId");
export const zStudentAchievementId = zBrandedId("StudentAchievementId");
export const zStudentLevelId = zBrandedId("StudentLevelId");
export const zStudyGoalId = zBrandedId("StudyGoalId");
export const zStudySessionId = zBrandedId("StudySessionId");
