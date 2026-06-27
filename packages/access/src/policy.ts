/**
 * The ONE authority decision (server-shared.md §1.4). Server-side, AUTHORITATIVE.
 * `authorize()` throws `AccessError('PERMISSION_DENIED')` on deny and returns void
 * on allow (never returns `false`). `can()` is the non-throwing hint variant.
 *
 * Decision order:
 *   1. impersonation guard — a constrained impersonated session can never
 *      re-impersonate or sync claims (brief: user.impersonate.* + claims.sync).
 *   2. public actions — always allowed.
 *   3. real-super-admin bypass — ONLY a genuine super-admin (isSuperAdmin, not a
 *      `<system>` actor, not impersonating) short-circuits role/permission gating.
 *      It does NOT bypass an EXPLICIT cross-tenant resource mismatch.
 *   4. authentication — non-public actions require a uid.
 *   5. tenant scope — tenant-scoped actions assert resource.tenantId === ctx.tenantId
 *      whenever a resource.tenantId is supplied (this is what stops a `<system>`
 *      trigger actor from operating cross-tenant).
 *   6. role gate — ctx.role ∈ rule.roles.
 *   7. permission / staffPermission gate — granular teacher/staff flags.
 *   8. ownership gate — self / class-member / linked-child / space-enrolled.
 */
import type { TenantRole } from "./keys/roles.js";
import type { TeacherPermissionKey } from "./keys/teacher-permissions.js";
import type { StaffPermissionKey } from "./keys/staff-permissions.js";
import type { Action, AccessContext, ResourceRef } from "./actions.js";
import { ACTIONS } from "./actions.js";
import { denied } from "./errors.js";

export interface AccessRule {
  /** Allowed roles, or a wildcard policy. */
  roles: readonly TenantRole[] | "any-authed" | "super-admin-only" | "public";
  /** Teacher granular gate (checked only if the caller carries a permissions map). */
  permission?: TeacherPermissionKey;
  /** Staff granular gate (checked only if the caller carries a staffPermissions map). */
  staffPermission?: StaffPermissionKey;
  /** Assert resource.tenantId === ctx.tenantId when a resource tenant is supplied. */
  tenantScoped: boolean;
  /** Ownership scoping after the role/permission gate. */
  ownershipCheck?: "self" | "class-member" | "linked-child" | "space-enrolled";
  /** Defaults to true; set false to forbid even super-admin (rare). */
  superAdminBypass?: boolean;
}

const AUTHORING: readonly TenantRole[] = ["teacher", "tenantAdmin", "staff"];
const STAFFISH: readonly TenantRole[] = ["staff", "tenantAdmin"];
const TEACHERISH: readonly TenantRole[] = ["teacher", "tenantAdmin", "staff"];
const STUDENT_ONLY: readonly TenantRole[] = ["student"];
const PARENT_ONLY: readonly TenantRole[] = ["parent"];
const SCANNERISH: readonly TenantRole[] = ["scanner", "teacher", "tenantAdmin", "staff"];

/**
 * The declarative rule table — DATA, unit-tested for completeness against the
 * `Action` union. Every authority decision in the system reduces to one of these.
 */
export const ACCESS_RULES: Readonly<Record<Action, AccessRule>> = {
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
  // Platform-scoped tenant directory — super-admin only (cross-tenant read).
  "tenant.list": { roles: "super-admin-only", tenantScoped: false },
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

/** A genuine super-admin actor (not a `<system>` trigger, not an impersonation). */
function isRealSuperAdmin(ctx: AccessContext): boolean {
  return ctx.isSuperAdmin === true && ctx.uid !== "<system>" && ctx.impersonating !== true;
}

/**
 * A trigger/scheduler/task system actor: super-admin-EQUIVALENT authority but
 * SCOPED to the triggering tenant (server-shared.md §2.9). It bypasses the
 * role/permission gate (it acts as the platform) yet is still subject to the
 * tenant-scope check — so it can never operate cross-tenant.
 */
function isSystemActor(ctx: AccessContext): boolean {
  return ctx.uid === "<system>" && ctx.isSuperAdmin === true;
}

function roleAllowed(rule: AccessRule, ctx: AccessContext): boolean {
  if (rule.roles === "public") return true;
  if (rule.roles === "any-authed") return Boolean(ctx.uid);
  if (rule.roles === "super-admin-only") return isRealSuperAdmin(ctx);
  if (ctx.role === null) return false;
  return rule.roles.includes(ctx.role);
}

/**
 * Granular permission gate. Lenient by design: a permission is treated as GRANTED
 * unless the caller carries the relevant permission map AND it explicitly maps the
 * key to `false`. The role gate is the primary authority; permissions only DEMOTE.
 */
function permissionAllowed(rule: AccessRule, ctx: AccessContext): boolean {
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

function ownershipAllowed(rule: AccessRule, ctx: AccessContext, resource?: ResourceRef): boolean {
  switch (rule.ownershipCheck) {
    case undefined:
      return true;
    case "self":
      // No explicit owner to compare → allow (the caller acts on its own resources).
      if (!resource?.ownerUid) return true;
      return String(resource.ownerUid) === String(ctx.uid);
    case "class-member": {
      if (!resource?.classId) return true;
      return ctx.classIds.map(String).includes(String(resource.classId));
    }
    case "linked-child": {
      // Parent gate (REVIEW §6.10): the target student MUST be a linked child.
      if (!resource?.studentId) return false;
      return ctx.studentIds.map(String).includes(String(resource.studentId));
    }
    case "space-enrolled":
      // Enrollment is resolved by the service against repos; policy is permissive here.
      return true;
  }
}

function tenantScopeOk(rule: AccessRule, ctx: AccessContext, resource?: ResourceRef): boolean {
  if (!rule.tenantScoped) return true;
  // Only enforce when an explicit target tenant is supplied. A mismatch is denied
  // even for a `<system>` super-admin-equivalent actor (cross-tenant guard).
  if (resource?.tenantId == null) return true;
  return String(resource.tenantId) === String(ctx.tenantId ?? "");
}

/** Throws `AccessError('PERMISSION_DENIED')` on deny. Returns void on allow. */
export function authorize(ctx: AccessContext, action: Action, resource?: ResourceRef): void {
  const rule = ACCESS_RULES[action];
  if (!rule) denied(`no access rule for action: ${action}`, { action });

  // (1) impersonation guard
  if (
    ctx.impersonating === true &&
    (action === "user.impersonate.start" || action === "claims.sync")
  ) {
    denied(`impersonated session cannot ${action}`, { action });
  }

  // (2) public short-circuit
  if (rule.roles === "public") return;

  const bypass = rule.superAdminBypass !== false;

  // (3) real super-admin bypass — but still honor an EXPLICIT cross-tenant mismatch.
  if (bypass && isRealSuperAdmin(ctx)) {
    if (!tenantScopeOk(rule, ctx, resource)) {
      denied(`cross-tenant target denied`, { action, tenantId: String(resource?.tenantId) });
    }
    return;
  }

  // (4) authentication
  if (!ctx.uid) denied(`unauthenticated for ${action}`, { action });

  // (5) tenant scope (stops `<system>` actor crossing tenants)
  if (!tenantScopeOk(rule, ctx, resource)) {
    denied(`tenant scope mismatch for ${action}`, {
      action,
      ctxTenant: String(ctx.tenantId),
      target: String(resource?.tenantId),
    });
  }

  // (5b) system actor — platform-equivalent authority, already tenant-scoped above.
  // Bypasses role/permission gating but NOT the cross-tenant guard.
  if (bypass && isSystemActor(ctx)) return;

  // (6) role gate
  if (!roleAllowed(rule, ctx)) {
    denied(`role ${String(ctx.role)} not permitted for ${action}`, {
      action,
      role: String(ctx.role),
    });
  }

  // (7) permission / staffPermission gate
  if (!permissionAllowed(rule, ctx)) {
    denied(`granular permission denied for ${action}`, { action });
  }

  // (8) ownership gate
  if (!ownershipAllowed(rule, ctx, resource)) {
    denied(`ownership check failed for ${action}`, { action });
  }
}

/** Non-throwing variant for server-side "can I show this" hints (rare). */
export function can(ctx: AccessContext, action: Action, resource?: ResourceRef): boolean {
  try {
    authorize(ctx, action, resource);
    return true;
  } catch {
    return false;
  }
}

/** The full action list (re-exported for completeness tests). */
export { ACTIONS };
