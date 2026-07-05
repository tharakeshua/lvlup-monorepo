/**
 * Role registry + rank + predicates.
 *
 * The canonical `TenantRole` union + `TENANT_ROLES` live in `@levelup/domain`
 * (so the membership/claims schemas and rules-gen share ONE list). `@levelup/access`
 * re-exports them for convenience and OWNS the policy-facing helpers (rank, predicates).
 */
import { TENANT_ROLES, ROLE_RANK, isAuthoringRole, type TenantRole } from "@levelup/domain";

// DP-2 Part B: `TENANT_ROLES`, `ROLE_RANK`, and `isAuthoringRole` are now DERIVED
// from `ROLE_DESCRIPTORS` in `@levelup/domain` (one source). `@levelup/access`
// re-exports them and OWNS only the rank-comparison predicates below.
export { TENANT_ROLES, ROLE_RANK, isAuthoringRole };
export type { TenantRole };

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
