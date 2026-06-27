/**
 * Role registry + rank + predicates.
 *
 * The canonical `TenantRole` union + `TENANT_ROLES` live in `@levelup/domain`
 * (so the membership/claims schemas and rules-gen share ONE list). `@levelup/access`
 * re-exports them for convenience and OWNS the policy-facing helpers (rank, predicates).
 */
import { TENANT_ROLES, type TenantRole } from "@levelup/domain";

export { TENANT_ROLES };
export type { TenantRole };

/**
 * Ordinal rank for "at least staff" / "at least teacher" comparisons.
 * `superAdmin` is the highest; `scanner`/`student` the lowest authority.
 */
export const ROLE_RANK: Record<TenantRole, number> = {
  superAdmin: 6,
  tenantAdmin: 5,
  staff: 4,
  teacher: 3,
  scanner: 2,
  parent: 1,
  student: 0,
};

/** A role with at least `staff` authority (staff | tenantAdmin | superAdmin). */
export function isStaffOrAbove(role: TenantRole | null): boolean {
  if (role === null) return false;
  return ROLE_RANK[role] >= ROLE_RANK.staff;
}

/** A role with at least `teacher` authority. */
export function isTeacherOrAbove(role: TenantRole | null): boolean {
  if (role === null) return false;
  return ROLE_RANK[role] >= ROLE_RANK.teacher;
}

/**
 * Authoring roles — the gate for rubric-guidance reads / item-for-edit (REVIEW §6.7,
 * §7.1.3). Never student/parent/scanner.
 */
export function isAuthoringRole(role: TenantRole | null): boolean {
  return role === "teacher" || role === "tenantAdmin" || role === "staff";
}
