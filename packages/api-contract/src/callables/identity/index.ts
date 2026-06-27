/**
 * Identity-module callable barrel.
 *
 * Re-exports every identity/tenant/notification CallableDef + its request/response
 * schemas and types, and assembles the named `IDENTITY_CALLABLES` record that the
 * contract CORE (`src/registry.ts`) spreads into the flat `CALLABLES` registry
 * (§3.2). The record is keyed by the canonical `v1.identity.<op>` name so
 * `def.name === key` (asserted by `registry-integrity`/`registry-completeness`).
 * One callable per source file; this barrel only aggregates.
 *
 * Canonical reconciliations baked in here:
 *  - `manageNotifications` facade is DELETED (MERGE-NOTIF-FACADE) — the five split
 *    notification callables + announcement callables are canonical.
 *  - NO request schema carries `tenantId` (claim-derived; `tenantOverride` only on
 *    super-admin cross-tenant defs flagged `allowsTenantOverride`).
 */
import type { CallableDef } from "../../callable-def.js";

import {
  saveTenant,
  deactivateTenant,
  reactivateTenant,
  exportTenantData,
  listExportJobs,
  uploadTenantAsset,
  lookupTenantByCode,
  saveTenantSettings,
  saveTenantFeatures,
  bulkApplyTenantFeatures,
  getPlatformConfig,
  savePlatformConfig,
  getTenant,
  listTenants,
} from "./tenant.js";
import {
  saveStudent,
  saveTeacher,
  saveParent,
  saveStaff,
  saveClass,
  saveAcademicSession,
  listStudents,
  getStudent,
  listTeachers,
  getTeacher,
  listParents,
  listStaff,
  listClasses,
  getClass,
  listAcademicSessions,
} from "./entities.js";
import {
  createOrgUser,
  switchActiveTenant,
  joinTenant,
  bulkImportStudents,
  bulkImportTeachers,
  bulkUpdateStatus,
  changeMembershipRole,
  rolloverSession,
} from "./users.js";
import {
  saveAnnouncement,
  listAnnouncements,
  markAnnouncementRead,
  estimateAudience,
  listNotifications,
  getNotificationBadge,
  markNotificationRead,
  getNotificationPreferences,
  saveNotificationPreferences,
  registerDeviceToken,
  unregisterDeviceToken,
  sendDirectMessage,
} from "./notifications.js";
import {
  getMe,
  updateMyProfile,
  uploadUserAsset,
  deleteConsumerAccount,
  searchUsers,
  saveGlobalEvaluationPreset,
  listGlobalEvaluationPresets,
  setUserStatus,
  sendPasswordReset,
  startImpersonation,
  endImpersonation,
} from "./platform.js";

export * from "./_shared.js";
export * from "./tenant.js";
export * from "./entities.js";
export * from "./users.js";
export * from "./notifications.js";
export * from "./platform.js";

/**
 * The identity module slice of the registry, keyed by the canonical callable name
 * (`def.name`). CORE spreads this into the flat `CALLABLES` map.
 */
export const IDENTITY_CALLABLES = {
  // tenant lifecycle + settings/features + platform config
  "v1.identity.saveTenant": saveTenant,
  "v1.identity.deactivateTenant": deactivateTenant,
  "v1.identity.reactivateTenant": reactivateTenant,
  "v1.identity.exportTenantData": exportTenantData,
  "v1.identity.listExportJobs": listExportJobs,
  "v1.identity.uploadTenantAsset": uploadTenantAsset,
  "v1.identity.lookupTenantByCode": lookupTenantByCode,
  "v1.identity.saveTenantSettings": saveTenantSettings,
  "v1.identity.saveTenantFeatures": saveTenantFeatures,
  "v1.identity.bulkApplyTenantFeatures": bulkApplyTenantFeatures,
  "v1.identity.getPlatformConfig": getPlatformConfig,
  "v1.identity.savePlatformConfig": savePlatformConfig,
  "v1.identity.getTenant": getTenant,
  "v1.identity.listTenants": listTenants,
  // org-entity upserts + reads
  "v1.identity.saveStudent": saveStudent,
  "v1.identity.saveTeacher": saveTeacher,
  "v1.identity.saveParent": saveParent,
  "v1.identity.saveStaff": saveStaff,
  "v1.identity.saveClass": saveClass,
  "v1.identity.saveAcademicSession": saveAcademicSession,
  "v1.identity.listStudents": listStudents,
  "v1.identity.getStudent": getStudent,
  "v1.identity.listTeachers": listTeachers,
  "v1.identity.getTeacher": getTeacher,
  "v1.identity.listParents": listParents,
  "v1.identity.listStaff": listStaff,
  "v1.identity.listClasses": listClasses,
  "v1.identity.getClass": getClass,
  "v1.identity.listAcademicSessions": listAcademicSessions,
  // multi-tenant user management + bulk ops
  "v1.identity.createOrgUser": createOrgUser,
  "v1.identity.switchActiveTenant": switchActiveTenant,
  "v1.identity.joinTenant": joinTenant,
  "v1.identity.bulkImportStudents": bulkImportStudents,
  "v1.identity.bulkImportTeachers": bulkImportTeachers,
  "v1.identity.bulkUpdateStatus": bulkUpdateStatus,
  "v1.identity.changeMembershipRole": changeMembershipRole,
  "v1.identity.rolloverSession": rolloverSession,
  // announcements + notifications + preferences + device tokens
  "v1.identity.saveAnnouncement": saveAnnouncement,
  "v1.identity.listAnnouncements": listAnnouncements,
  "v1.identity.markAnnouncementRead": markAnnouncementRead,
  "v1.identity.estimateAudience": estimateAudience,
  "v1.identity.listNotifications": listNotifications,
  "v1.identity.getNotificationBadge": getNotificationBadge,
  "v1.identity.markNotificationRead": markNotificationRead,
  "v1.identity.getNotificationPreferences": getNotificationPreferences,
  "v1.identity.saveNotificationPreferences": saveNotificationPreferences,
  "v1.identity.registerDeviceToken": registerDeviceToken,
  "v1.identity.unregisterDeviceToken": unregisterDeviceToken,
  "v1.identity.sendDirectMessage": sendDirectMessage,
  // session/profile reads + account self-service + super-admin platform ops
  "v1.identity.getMe": getMe,
  "v1.identity.updateMyProfile": updateMyProfile,
  "v1.identity.uploadUserAsset": uploadUserAsset,
  "v1.identity.deleteConsumerAccount": deleteConsumerAccount,
  "v1.identity.searchUsers": searchUsers,
  "v1.identity.saveGlobalEvaluationPreset": saveGlobalEvaluationPreset,
  "v1.identity.listGlobalEvaluationPresets": listGlobalEvaluationPresets,
  "v1.identity.setUserStatus": setUserStatus,
  "v1.identity.sendPasswordReset": sendPasswordReset,
  "v1.identity.startImpersonation": startImpersonation,
  "v1.identity.endImpersonation": endImpersonation,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as const satisfies Record<string, CallableDef<any, any>>;

/** The fully-qualified `v1.identity.*` names this module defines. */
export const IDENTITY_CALLABLE_NAMES = Object.keys(IDENTITY_CALLABLES) as readonly string[];
