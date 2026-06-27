/**
 * Identity query-key helpers (identity.md "Query hooks").
 *
 * Thin, domain-shaped facade over the shared `@levelup/query` key factories. The
 * factories own the hierarchical `[domain, kind, …]` convention; these helpers
 * name the specific keys the identity hooks read/write so hooks + invalidation
 * fanout reference ONE place.
 */
export {
  meKeys,
  tenantKeys,
  studentKeys,
  teacherKeys,
  parentKeys,
  staffKeys,
  classKeys,
  sessionKeys,
  academicSessionKeys,
  announcementKeys,
  notificationKeys,
  notificationBadgeKeys,
  userSearchKeys,
  membershipKeys,
} from "../keys/registry.js";
