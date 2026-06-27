/**
 * `@levelup/query` — identity domain hooks barrel (identity.md "Query hooks").
 *
 * Query + mutation hooks over the identity repos. Mutations route invalidation
 * through `invalidateForCallable` (the graph decides scope); the only ✅
 * optimistic surfaces are mark-notification-read / mark-all / mark-announcement-read.
 */
export { useMe, useSwitchTenant, useJoinTenant } from "./me.js";
export {
  useTenants,
  useTenant,
  useLookupTenantByCode,
  useSaveTenant,
  useDeactivateTenant,
  useReactivateTenant,
  useExportTenantData,
} from "./tenants.js";
export {
  useStudents,
  useStudent,
  useSaveStudent,
  useTeachers,
  useTeacher,
  useSaveTeacher,
  useParents,
  useSaveParent,
  useStaff,
  useSaveStaff,
  useClasses,
  useClass,
  useSaveClass,
  useAcademicSessions,
  useSaveAcademicSession,
  useRolloverSession,
  useCreateOrgUser,
  useBulkImportStudents,
  useBulkImportTeachers,
  useBulkUpdateStatus,
} from "./entities.js";
export {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "./notifications.js";
export {
  useNotificationPreferences,
  useNotificationBadgeQuery,
  useSaveNotificationPreferences,
} from "./notification-preferences.js";
export { useNotificationCenter } from "./notification-center.js";
export { useAnnouncements, useSaveAnnouncement, useMarkAnnouncementRead } from "./announcements.js";
export { useSearchUsers, useNotificationBadge } from "./users.js";
