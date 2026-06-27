import { zEnum } from "./enum.js";

/**
 * Typed permission-key unions so rules-gen + TS + claims share ONE key list
 * (auth-access rec #2; REVIEW §1). Replaces stringly-typed Record<string,boolean>.
 */
export const TEACHER_PERMISSION_KEYS = [
  "canManageSpaces",
  "canManageStudents",
  "canManageClasses",
  "canCreateExams",
  "canGradeExams",
  "canViewAnalytics",
  "canManageContent",
  "canReleaseResults",
] as const;
export type TeacherPermissionKey = (typeof TEACHER_PERMISSION_KEYS)[number];
export const zTeacherPermissionKey = zEnum(TEACHER_PERMISSION_KEYS);

export const STAFF_PERMISSION_KEYS = [
  "canManageUsers",
  "canManageClasses",
  "canImportData",
  "canExportData",
  "canViewAnalytics",
  "canManageAnnouncements",
] as const;
export type StaffPermissionKey = (typeof STAFF_PERMISSION_KEYS)[number];
export const zStaffPermissionKey = zEnum(STAFF_PERMISSION_KEYS);

export const MAX_CLAIM_CLASS_IDS = 15;
