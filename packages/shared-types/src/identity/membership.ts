/**
 * User ↔ Tenant membership types.
 * Collection: /userMemberships/{uid}_{tenantId}
 */

import type { FirestoreTimestamp } from "./user";

/** Role a user holds within a tenant. */
export type TenantRole =
  | "superAdmin"
  | "tenantAdmin"
  | "teacher"
  | "student"
  | "parent"
  | "scanner"
  | "staff";

/** Granular permissions for teacher role. */
export interface TeacherPermissions {
  canCreateExams?: boolean;
  canEditRubrics?: boolean;
  canManuallyGrade?: boolean;
  canViewAllExams?: boolean;
  canCreateSpaces?: boolean;
  canManageContent?: boolean;
  canViewAnalytics?: boolean;
  canConfigureAgents?: boolean;
  managedSpaceIds?: string[];
  /** Source of truth for claims classIds. */
  managedClassIds?: string[];
}

/** Default permissions assigned to new teachers. */
export const DEFAULT_TEACHER_PERMISSIONS: TeacherPermissions = {
  canCreateExams: true,
  canEditRubrics: true,
  canManuallyGrade: true,
  canViewAllExams: false,
  canCreateSpaces: false,
  canManageContent: false,
  canViewAnalytics: false,
  canConfigureAgents: false,
  managedSpaceIds: [],
  managedClassIds: [],
};

/** Granular permissions for staff role. */
export interface StaffPermissions {
  canManageUsers: boolean;
  canManageClasses: boolean;
  canManageBilling: boolean;
  canViewAnalytics: boolean;
  canManageSettings: boolean;
  canExportData: boolean;
}

/** Default permissions assigned to new staff members. */
export const DEFAULT_STAFF_PERMISSIONS: StaffPermissions = {
  canManageUsers: false,
  canManageClasses: false,
  canManageBilling: false,
  canViewAnalytics: true,
  canManageSettings: false,
  canExportData: false,
};

/**
 * Links a user to a tenant with a specific role.
 * Composite key: `{uid}_{tenantId}` enforces one role per tenant per user.
 */
/**
 * Minimal subset of UserMembership needed to build custom claims.
 * Use this as the parameter type for `buildClaimsForMembership` to avoid
 * double type assertions when the full membership hasn't been persisted yet
 * (e.g., `createdAt` is still a FieldValue sentinel).
 */
export type MembershipClaimsInput = Pick<
  UserMembership,
  | "role"
  | "tenantId"
  | "tenantCode"
  | "permissions"
  | "staffPermissions"
  | "teacherId"
  | "studentId"
  | "parentId"
  | "parentLinkedStudentIds"
  | "staffId"
  | "scannerId"
>;

export interface UserMembership {
  id: string;
  uid: string;
  tenantId: string;
  tenantCode: string;

  role: TenantRole;
  status: "active" | "inactive" | "suspended";
  joinSource:
    | "admin_created"
    | "bulk_import"
    | "invite_code"
    | "self_register"
    | "migration"
    | "tenant_code";

  // Links to role-specific entity docs (only one set per membership)
  teacherId?: string;
  studentId?: string;
  parentId?: string;
  scannerId?: string;
  schoolId?: string;
  staffId?: string;

  // Granular permissions (teacher-specific)
  permissions?: TeacherPermissions;

  // Granular permissions (staff-specific)
  staffPermissions?: StaffPermissions;

  // Parent-specific: teacher who is also a parent in same tenant
  parentLinkedStudentIds?: string[];

  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
  lastActive?: FirestoreTimestamp;
}
