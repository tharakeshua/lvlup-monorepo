/**
 * PlatformClaims builder — the SINGLE claim-mint path the seed shares with the server.
 *
 * Per SDK-LAYERS-PLAN §7.2 (T2): "claims built via the shared membership→claims path
 * (assert seed claims === syncMembershipClaims output for the same membership — no second
 * claim-builder)". This `buildPlatformClaims(membership)` is that one builder; the contract
 * test `seed.claims.test.ts` asserts it is byte-equal to `syncMembershipClaims` for the same
 * membership input.
 *
 * PlatformClaims shape (identity domain §2.1 / domain-core): role?, tenantId?, tenantCode?,
 * teacherId?/studentId?/parentId?/scannerId?/staffId?, classIds? (cap MAX_CLAIM_CLASS_IDS=15),
 * classIdsOverflow?, studentIds?, permissions?, staffPermissions?, isSuperAdmin?.
 */

import type {
  ClassId,
  ParentId,
  ScannerId,
  StaffId,
  StudentId,
  TeacherId,
  TenantId,
} from "./ids.js";

export const MAX_CLAIM_CLASS_IDS = 15;

export type TenantRole =
  | "superAdmin"
  | "tenantAdmin"
  | "teacher"
  | "student"
  | "parent"
  | "staff"
  | "scanner";

export type MembershipStatus = "active" | "invited" | "suspended" | "archived";

export const TEACHER_PERMISSION_KEYS = [
  "canCreateExams",
  "canEditRubrics",
  "canManuallyGrade",
  "canViewAllExams",
  "canCreateSpaces",
  "canManageContent",
  "canViewAnalytics",
  "canConfigureAgents",
] as const;
export type TeacherPermissionKey = (typeof TEACHER_PERMISSION_KEYS)[number];

export const STAFF_PERMISSION_KEYS = [
  "canManageUsers",
  "canManageClasses",
  "canManageBilling",
  "canViewAnalytics",
  "canManageSettings",
  "canExportData",
] as const;
export type StaffPermissionKey = (typeof STAFF_PERMISSION_KEYS)[number];

/**
 * The membership-shaped input the claims builder consumes (subset of UserMembership).
 * Link/class ids accept either the branded type or a bare string (the engine resolves opaque
 * entity ids that are structurally `string`); claims store them as plain strings regardless.
 */
export interface MembershipForClaims {
  uid: string;
  tenantId: TenantId | string;
  tenantCode: string;
  role: TenantRole;
  teacherId?: TeacherId | string;
  studentId?: StudentId | string;
  parentId?: ParentId | string;
  staffId?: StaffId | string;
  scannerId?: ScannerId | string;
  /** Classes this membership manages/belongs to (teacher-managed or student-enrolled). */
  managedClassIds?: (ClassId | string)[];
  /** Parent → linked children (canonical `parentLinkedStudentIds`, D10). */
  parentLinkedStudentIds?: (StudentId | string)[];
  permissions?: Partial<Record<TeacherPermissionKey, boolean>>;
  staffPermissions?: Partial<Record<StaffPermissionKey, boolean>>;
  /** Promotes the `isSuperAdmin` claim (NEW claim, removes per-rule get() on /users). */
  isSuperAdmin?: boolean;
}

export interface PlatformClaims {
  role?: TenantRole;
  tenantId?: string;
  tenantCode?: string;
  teacherId?: string;
  studentId?: string;
  parentId?: string;
  staffId?: string;
  scannerId?: string;
  classIds?: string[];
  classIdsOverflow?: boolean;
  studentIds?: string[];
  permissions?: Partial<Record<TeacherPermissionKey, boolean>>;
  staffPermissions?: Partial<Record<StaffPermissionKey, boolean>>;
  isSuperAdmin?: boolean;
}

/** Deterministic, order-stable claim build (so determinism snapshots are reproducible). */
export function buildPlatformClaims(m: MembershipForClaims): PlatformClaims {
  const claims: PlatformClaims = {
    role: m.role,
    tenantId: m.tenantId,
    tenantCode: m.tenantCode,
  };

  if (m.isSuperAdmin) claims.isSuperAdmin = true;

  const classIds = m.managedClassIds ?? [];
  const applyClassIds = () => {
    claims.classIds = classIds.slice(0, MAX_CLAIM_CLASS_IDS);
    claims.classIdsOverflow = classIds.length > MAX_CLAIM_CLASS_IDS;
  };

  switch (m.role) {
    case "teacher":
      if (m.teacherId) claims.teacherId = m.teacherId;
      applyClassIds();
      if (m.permissions) claims.permissions = m.permissions;
      break;
    case "student":
      if (m.studentId) claims.studentId = m.studentId;
      applyClassIds();
      break;
    case "parent":
      if (m.parentId) claims.parentId = m.parentId;
      claims.studentIds = m.parentLinkedStudentIds ?? [];
      break;
    case "staff":
      if (m.staffId) claims.staffId = m.staffId;
      applyClassIds();
      if (m.staffPermissions) claims.staffPermissions = m.staffPermissions;
      break;
    case "scanner":
      if (m.scannerId) claims.scannerId = m.scannerId;
      break;
    case "tenantAdmin":
    case "superAdmin":
      // Tenant-wide authority — no class scoping in claims.
      break;
  }

  return claims;
}

/** Stable key-sorted clone — used so claim writes are byte-deterministic for snapshots. */
export function sortClaims(claims: PlatformClaims): PlatformClaims {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(claims).sort()) {
    out[k] = (claims as Record<string, unknown>)[k];
  }
  return out as PlatformClaims;
}
