"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadTenantAsset = exports.monthlyUsageReset = exports.tenantLifecycleCheck = exports.searchUsers = exports.listAnnouncements = exports.saveAnnouncement = exports.exportTenantData = exports.reactivateTenant = exports.deactivateTenant = exports.joinTenant = exports.switchActiveTenant = exports.createOrgUser = exports.saveStaff = exports.saveGlobalEvaluationPreset = exports.rolloverSession = exports.bulkUpdateStatus = exports.bulkImportTeachers = exports.bulkImportStudents = exports.saveAcademicSession = exports.saveParent = exports.saveTeacher = exports.saveStudent = exports.saveClass = exports.saveTenant = exports.cleanupExpiredExports = exports.onTenantDeactivated = exports.onStudentArchived = exports.onClassArchived = exports.onUserDeleted = exports.onUserCreated = void 0;
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
// Auth triggers
var on_user_created_1 = require("./triggers/on-user-created");
Object.defineProperty(exports, "onUserCreated", { enumerable: true, get: function () { return on_user_created_1.onUserCreated; } });
var on_user_deleted_1 = require("./triggers/on-user-deleted");
Object.defineProperty(exports, "onUserDeleted", { enumerable: true, get: function () { return on_user_deleted_1.onUserDeleted; } });
// Firestore triggers
var on_class_deleted_1 = require("./triggers/on-class-deleted");
Object.defineProperty(exports, "onClassArchived", { enumerable: true, get: function () { return on_class_deleted_1.onClassArchived; } });
var on_student_deleted_1 = require("./triggers/on-student-deleted");
Object.defineProperty(exports, "onStudentArchived", { enumerable: true, get: function () { return on_student_deleted_1.onStudentArchived; } });
var on_tenant_deactivated_1 = require("./triggers/on-tenant-deactivated");
Object.defineProperty(exports, "onTenantDeactivated", { enumerable: true, get: function () { return on_tenant_deactivated_1.onTenantDeactivated; } });
var cleanup_expired_exports_1 = require("./triggers/cleanup-expired-exports");
Object.defineProperty(exports, "cleanupExpiredExports", { enumerable: true, get: function () { return cleanup_expired_exports_1.cleanupExpiredExports; } });
// ── Consolidated callable endpoints ──
var save_tenant_1 = require("./callable/save-tenant");
Object.defineProperty(exports, "saveTenant", { enumerable: true, get: function () { return save_tenant_1.saveTenant; } });
var save_class_1 = require("./callable/save-class");
Object.defineProperty(exports, "saveClass", { enumerable: true, get: function () { return save_class_1.saveClass; } });
var save_student_1 = require("./callable/save-student");
Object.defineProperty(exports, "saveStudent", { enumerable: true, get: function () { return save_student_1.saveStudent; } });
var save_teacher_1 = require("./callable/save-teacher");
Object.defineProperty(exports, "saveTeacher", { enumerable: true, get: function () { return save_teacher_1.saveTeacher; } });
var save_parent_1 = require("./callable/save-parent");
Object.defineProperty(exports, "saveParent", { enumerable: true, get: function () { return save_parent_1.saveParent; } });
var save_academic_session_1 = require("./callable/save-academic-session");
Object.defineProperty(exports, "saveAcademicSession", { enumerable: true, get: function () { return save_academic_session_1.saveAcademicSession; } });
var bulk_import_students_1 = require("./callable/bulk-import-students");
Object.defineProperty(exports, "bulkImportStudents", { enumerable: true, get: function () { return bulk_import_students_1.bulkImportStudents; } });
var bulk_import_teachers_1 = require("./callable/bulk-import-teachers");
Object.defineProperty(exports, "bulkImportTeachers", { enumerable: true, get: function () { return bulk_import_teachers_1.bulkImportTeachers; } });
var bulk_update_status_1 = require("./callable/bulk-update-status");
Object.defineProperty(exports, "bulkUpdateStatus", { enumerable: true, get: function () { return bulk_update_status_1.bulkUpdateStatus; } });
var rollover_session_1 = require("./callable/rollover-session");
Object.defineProperty(exports, "rolloverSession", { enumerable: true, get: function () { return rollover_session_1.rolloverSession; } });
var save_global_preset_1 = require("./callable/save-global-preset");
Object.defineProperty(exports, "saveGlobalEvaluationPreset", { enumerable: true, get: function () { return save_global_preset_1.saveGlobalEvaluationPreset; } });
var save_staff_1 = require("./callable/save-staff");
Object.defineProperty(exports, "saveStaff", { enumerable: true, get: function () { return save_staff_1.saveStaff; } });
// ── Multi-tenant user management ──
var create_org_user_1 = require("./callable/create-org-user");
Object.defineProperty(exports, "createOrgUser", { enumerable: true, get: function () { return create_org_user_1.createOrgUser; } });
var switch_active_tenant_1 = require("./callable/switch-active-tenant");
Object.defineProperty(exports, "switchActiveTenant", { enumerable: true, get: function () { return switch_active_tenant_1.switchActiveTenant; } });
var join_tenant_1 = require("./callable/join-tenant");
Object.defineProperty(exports, "joinTenant", { enumerable: true, get: function () { return join_tenant_1.joinTenant; } });
// ── Tenant lifecycle & data operations ──
var deactivate_tenant_1 = require("./callable/deactivate-tenant");
Object.defineProperty(exports, "deactivateTenant", { enumerable: true, get: function () { return deactivate_tenant_1.deactivateTenant; } });
var reactivate_tenant_1 = require("./callable/reactivate-tenant");
Object.defineProperty(exports, "reactivateTenant", { enumerable: true, get: function () { return reactivate_tenant_1.reactivateTenant; } });
var export_tenant_data_1 = require("./callable/export-tenant-data");
Object.defineProperty(exports, "exportTenantData", { enumerable: true, get: function () { return export_tenant_data_1.exportTenantData; } });
var save_announcement_1 = require("./callable/save-announcement");
Object.defineProperty(exports, "saveAnnouncement", { enumerable: true, get: function () { return save_announcement_1.saveAnnouncement; } });
var list_announcements_1 = require("./callable/list-announcements");
Object.defineProperty(exports, "listAnnouncements", { enumerable: true, get: function () { return list_announcements_1.listAnnouncements; } });
// ── Global user search (SuperAdmin) ──
var search_users_1 = require("./callable/search-users");
Object.defineProperty(exports, "searchUsers", { enumerable: true, get: function () { return search_users_1.searchUsers; } });
// ── Scheduled functions ──
var tenant_lifecycle_1 = require("./scheduled/tenant-lifecycle");
Object.defineProperty(exports, "tenantLifecycleCheck", { enumerable: true, get: function () { return tenant_lifecycle_1.tenantLifecycleCheck; } });
var usage_reset_1 = require("./scheduled/usage-reset");
Object.defineProperty(exports, "monthlyUsageReset", { enumerable: true, get: function () { return usage_reset_1.monthlyUsageReset; } });
// ── Tenant asset upload ──
var upload_tenant_asset_1 = require("./callable/upload-tenant-asset");
Object.defineProperty(exports, "uploadTenantAsset", { enumerable: true, get: function () { return upload_tenant_asset_1.uploadTenantAsset; } });
//# sourceMappingURL=index.js.map