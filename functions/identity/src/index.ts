import * as admin from "firebase-admin";

admin.initializeApp();

// Auth triggers
export { onUserCreated } from "./triggers/on-user-created";
export { onUserDeleted } from "./triggers/on-user-deleted";

// Firestore triggers
export { onClassArchived } from "./triggers/on-class-deleted";
export { onStudentArchived } from "./triggers/on-student-deleted";
export { onTenantDeactivated } from "./triggers/on-tenant-deactivated";
export { cleanupExpiredExports } from "./triggers/cleanup-expired-exports";

// ── Consolidated callable endpoints ──
export { saveTenant } from "./callable/save-tenant";
export { saveClass } from "./callable/save-class";
export { saveStudent } from "./callable/save-student";
export { saveTeacher } from "./callable/save-teacher";
export { saveParent } from "./callable/save-parent";
export { saveAcademicSession } from "./callable/save-academic-session";
export { manageNotifications } from "./callable/manage-notifications";
export { bulkImportStudents } from "./callable/bulk-import-students";
export { bulkImportTeachers } from "./callable/bulk-import-teachers";
export { bulkUpdateStatus } from "./callable/bulk-update-status";
export { rolloverSession } from "./callable/rollover-session";
export { saveGlobalEvaluationPreset } from "./callable/save-global-preset";

export { saveStaff } from "./callable/save-staff";

// ── Multi-tenant user management ──
export { createOrgUser } from "./callable/create-org-user";
export { switchActiveTenant } from "./callable/switch-active-tenant";
export { joinTenant } from "./callable/join-tenant";

// ── Tenant lifecycle & data operations ──
export { deactivateTenant } from "./callable/deactivate-tenant";
export { reactivateTenant } from "./callable/reactivate-tenant";
export { exportTenantData } from "./callable/export-tenant-data";
export { saveAnnouncement } from "./callable/save-announcement";
export { listAnnouncements } from "./callable/list-announcements";

// ── Global user search (SuperAdmin) ──
export { searchUsers } from "./callable/search-users";

// ── Scheduled functions ──
export { tenantLifecycleCheck } from "./scheduled/tenant-lifecycle";
export { monthlyUsageReset } from "./scheduled/usage-reset";

// ── Tenant asset upload ──
export { uploadTenantAsset } from "./callable/upload-tenant-asset";
