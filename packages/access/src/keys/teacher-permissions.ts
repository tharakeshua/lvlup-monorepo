/**
 * Teacher granular permission keys. Canonical union lives in `@levelup/domain`
 * (REVIEW §1 — replaces stringly-typed Record<string,boolean>); re-exported here
 * so the policy table can reference the same key list the claims/membership use.
 */
import { TEACHER_PERMISSION_KEYS, type TeacherPermissionKey } from "@levelup/domain";

export { TEACHER_PERMISSION_KEYS };
export type { TeacherPermissionKey };

/** Set membership guard usable in the policy table. */
export function isTeacherPermissionKey(k: string): k is TeacherPermissionKey {
  return (TEACHER_PERMISSION_KEYS as readonly string[]).includes(k);
}
