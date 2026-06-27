/**
 * Staff granular permission keys. Canonical union lives in `@levelup/domain`;
 * re-exported here so the policy table references the same list as claims/membership.
 */
import { STAFF_PERMISSION_KEYS, type StaffPermissionKey } from "@levelup/domain";

export { STAFF_PERMISSION_KEYS };
export type { StaffPermissionKey };

/** Set membership guard usable in the policy table. */
export function isStaffPermissionKey(k: string): k is StaffPermissionKey {
  return (STAFF_PERMISSION_KEYS as readonly string[]).includes(k);
}
