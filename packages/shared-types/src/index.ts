/**
 * Shared types for Auto LevelUp platform
 * @packageDocumentation
 */

// Branded ID types
export type {
  Brand,
  TenantId,
  ClassId,
  StudentId,
  TeacherId,
  ParentId,
  SpaceId,
  StoryPointId,
  ItemId,
  ExamId,
  SubmissionId,
  UserId,
  SessionId,
  AgentId,
  AcademicSessionId,
  NotificationId,
  QuestionBankItemId,
} from "./branded";

// Branded ID factory helpers
export {
  asTenantId,
  asClassId,
  asStudentId,
  asTeacherId,
  asParentId,
  asSpaceId,
  asStoryPointId,
  asItemId,
  asExamId,
  asSubmissionId,
  asUserId,
  asSessionId,
  asAgentId,
  asAcademicSessionId,
} from "./branded";

// Identity types
export * from "./identity";

// Tenant entity types
export * from "./tenant";

// Content types (shared between AutoGrade and LevelUp)
export * from "./content";

// LevelUp types
export * from "./levelup";

// AutoGrade types
export * from "./autograde";

// Progress & Analytics types (cross-system aggregation)
export * from "./progress";

// Notification types
export * from "./notification";

// Gamification types (achievements, levels, study goals)
export * from "./gamification";

// Analytics types (LLM call logs, cost tracking)
export * from "./analytics";

// Constants
export * from "./constants";

// Callable request/response types (consolidated API)
export * from "./callable-types";

// Error types (unified error handling across backend + frontend)
export * from "./error-types";

// Runtime type guards for external data boundaries
export * from "./type-guards";

// Zod schemas for runtime validation at Firebase read boundaries
// and callable request validation
export * from "./schemas";
