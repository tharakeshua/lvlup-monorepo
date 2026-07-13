/**
 * Branded (nominal) types for entity IDs.
 *
 * Branded types prevent accidental mixing of different ID types
 * (e.g., passing a StudentId where a TeacherId is expected).
 *
 * Usage:
 *   const tenantId = 'abc123' as TenantId;
 *   const classId = 'xyz789' as ClassId;
 *
 * @module branded
 */

declare const __brand: unique symbol;

/**
 * Creates a branded type that is structurally compatible with the base type
 * but nominally distinct at compile time.
 */
export type Brand<T, B extends string> = T & { readonly [__brand]: B };

// ── Entity ID types ─────────────────────────────────────────────────────────

/** Tenant (school/institution) document ID. */
export type TenantId = Brand<string, "TenantId">;

/** Class document ID within a tenant. */
export type ClassId = Brand<string, "ClassId">;

/** Student profile document ID within a tenant. */
export type StudentId = Brand<string, "StudentId">;

/** Teacher profile document ID within a tenant. */
export type TeacherId = Brand<string, "TeacherId">;

/** Parent profile document ID within a tenant. */
export type ParentId = Brand<string, "ParentId">;

/** Learning Space document ID within a tenant. */
export type SpaceId = Brand<string, "SpaceId">;

/** StoryPoint (section) document ID within a Space. */
export type StoryPointId = Brand<string, "StoryPointId">;

/** UnifiedItem document ID within a StoryPoint. */
export type ItemId = Brand<string, "ItemId">;

/** Exam document ID within a tenant. */
export type ExamId = Brand<string, "ExamId">;

/** Submission document ID within a tenant. */
export type SubmissionId = Brand<string, "SubmissionId">;

/** Firebase Auth UID — platform-wide user identifier. */
export type UserId = Brand<string, "UserId">;

/** Test or Chat session document ID. */
export type SessionId = Brand<string, "SessionId">;

/** AI Agent document ID within a Space. */
export type AgentId = Brand<string, "AgentId">;

/** Academic Session document ID within a tenant. */
export type AcademicSessionId = Brand<string, "AcademicSessionId">;

/** Notification document ID. */
export type NotificationId = Brand<string, "NotificationId">;

/** Question Bank Item document ID. */
export type QuestionBankItemId = Brand<string, "QuestionBankItemId">;

// ── Factory helpers ─────────────────────────────────────────────────────────
// Use these at trust boundaries (Firestore reads, URL params, request data)
// to convert raw strings into branded IDs with compile-time safety.

export const asTenantId = (id: string) => id as TenantId;
export const asClassId = (id: string) => id as ClassId;
export const asStudentId = (id: string) => id as StudentId;
export const asTeacherId = (id: string) => id as TeacherId;
export const asParentId = (id: string) => id as ParentId;
export const asSpaceId = (id: string) => id as SpaceId;
export const asStoryPointId = (id: string) => id as StoryPointId;
export const asItemId = (id: string) => id as ItemId;
export const asExamId = (id: string) => id as ExamId;
export const asSubmissionId = (id: string) => id as SubmissionId;
export const asUserId = (id: string) => id as UserId;
export const asSessionId = (id: string) => id as SessionId;
export const asAgentId = (id: string) => id as AgentId;
export const asAcademicSessionId = (id: string) => id as AcademicSessionId;
export const asNotificationId = (id: string) => id as NotificationId;
export const asQuestionBankItemId = (id: string) => id as QuestionBankItemId;
