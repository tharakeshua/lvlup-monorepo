/**
 * The exhaustive `Action` registry — one verb per authority-sensitive operation
 * (server-shared.md §1.3). Plus `ResourceRef` and the minimal `AccessContext`
 * shape `authorize()` consumes.
 *
 * `AccessContext` is declared STRUCTURALLY here (not imported from
 * `@levelup/functions-shared`, which sits ABOVE this package). The real
 * `AuthContext` in `@levelup/functions-shared` structurally satisfies it, as does
 * the server-side test harness `TestAuthContext`.
 */
import type {
  TenantId,
  SpaceId,
  ExamId,
  ClassId,
  StudentId,
  SubmissionId,
  TestSessionId,
  UserId,
} from "@levelup/domain";
import type { TenantRole } from "./keys/roles.js";

export type Action =
  // ---- identity ----
  | "tenant.create"
  | "tenant.lifecycle"
  | "tenant.export"
  | "tenant.asset.upload"
  | "user.create"
  | "user.update"
  | "user.bulkImport"
  | "user.bulkStatus"
  | "membership.write"
  | "claims.sync"
  | "tenant.switch"
  | "tenant.join"
  | "class.write"
  | "session.write"
  | "session.rollover"
  | "announcement.write"
  | "notification.read"
  | "notification.markRead"
  | "roster.read"
  | "tenant.list"
  | "user.search"
  | "preset.global.write"
  | "user.impersonate.start"
  | "user.impersonate.end"
  // per-user BYOK (own keys); tenant-owned keys; platform fallback keys
  | "userKey.manage"
  | "tenantKey.manage"
  | "platformKey.manage"
  // ---- levelup ----
  | "space.read"
  | "space.write"
  | "space.publish"
  | "space.archive"
  | "storyPoint.write"
  | "item.write"
  | "item.readForEdit"
  | "version.list"
  | "questionBank.write"
  | "questionBank.read"
  | "questionBank.import"
  | "rubricPreset.write"
  | "agent.write"
  | "testSession.start"
  | "testSession.submit"
  | "answer.evaluate"
  | "itemAttempt.record"
  | "chat.send"
  | "progress.read"
  | "store.list"
  | "store.review"
  | "space.purchase"
  // ---- autograde ----
  | "exam.read"
  | "exam.write"
  | "exam.publish"
  | "exam.results.release"
  | "questions.extract"
  | "answerSheets.upload"
  | "grade.manual"
  | "grade.retry"
  | "grade.ai"
  | "submission.read"
  | "submission.readReleased"
  // ---- analytics ----
  | "summary.read"
  | "report.generate"
  | "analytics.child.read"
  | "analytics.trends.read"
  // child.read alias used by the parent gate (server-shared.md §8 T5)
  | "child.read"
  // ---- rubric guidance leak gate (REVIEW §6.7) ----
  | "rubric.guidance.read";

/** Runtime mirror of the Action union — completeness asserted in the policy test. */
export const ACTIONS = [
  "tenant.create",
  "tenant.lifecycle",
  "tenant.export",
  "tenant.asset.upload",
  "user.create",
  "user.update",
  "user.bulkImport",
  "user.bulkStatus",
  "membership.write",
  "claims.sync",
  "tenant.switch",
  "tenant.join",
  "class.write",
  "session.write",
  "session.rollover",
  "announcement.write",
  "notification.read",
  "notification.markRead",
  "roster.read",
  "tenant.list",
  "user.search",
  "preset.global.write",
  "user.impersonate.start",
  "user.impersonate.end",
  "userKey.manage",
  "tenantKey.manage",
  "platformKey.manage",
  "space.read",
  "space.write",
  "space.publish",
  "space.archive",
  "storyPoint.write",
  "item.write",
  "item.readForEdit",
  "version.list",
  "questionBank.write",
  "questionBank.read",
  "questionBank.import",
  "rubricPreset.write",
  "agent.write",
  "testSession.start",
  "testSession.submit",
  "answer.evaluate",
  "itemAttempt.record",
  "chat.send",
  "progress.read",
  "store.list",
  "store.review",
  "space.purchase",
  "exam.read",
  "exam.write",
  "exam.publish",
  "exam.results.release",
  "questions.extract",
  "answerSheets.upload",
  "grade.manual",
  "grade.retry",
  "grade.ai",
  "submission.read",
  "submission.readReleased",
  "summary.read",
  "report.generate",
  "analytics.child.read",
  "analytics.trends.read",
  "child.read",
  "rubric.guidance.read",
] as const satisfies readonly Action[];

// Compile-time exhaustiveness (union ⊆ array AND array ⊆ union).
type _ActionCheck = Action extends (typeof ACTIONS)[number] ? true : never;
const _actionCheck: _ActionCheck = true;
void _actionCheck;

/** Resource descriptor passed to `authorize()`; all fields optional per-action. */
export interface ResourceRef {
  /** Target tenant (defaults to `ctx.tenantId`). Branded or bare string accepted. */
  tenantId?: TenantId | string;
  spaceId?: SpaceId | string;
  examId?: ExamId | string;
  classId?: ClassId | string;
  studentId?: StudentId | string;
  submissionId?: SubmissionId | string;
  sessionId?: TestSessionId | string;
  /** For ownership checks (self / class-member). */
  ownerUid?: UserId | string;
  scope?: "student" | "class" | "platform" | "health";
}

/**
 * The minimal context shape `authorize()` reads. Declared structurally so neither
 * the real `AuthContext` (functions-shared) nor the test harness ctx must import
 * this — both already carry these fields.
 */
export interface AccessContext {
  uid: UserId | string;
  isSuperAdmin: boolean;
  tenantId: TenantId | string | null;
  role: TenantRole | null;
  permissions: Record<string, boolean> | null;
  staffPermissions: Record<string, boolean> | null;
  classIds: ReadonlyArray<ClassId | string>;
  studentIds: ReadonlyArray<StudentId | string>;
  /** Set true on a constrained impersonation session — blocks re-impersonate / claims.sync. */
  impersonating?: boolean;
}
