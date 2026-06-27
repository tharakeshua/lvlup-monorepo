/**
 * Role entity docs: Student, Teacher, Parent, Staff (NEW), Scanner (NEW).
 * Canonical `authUid?: UserId` (drop bare `uid` — REVIEW D3). Parent uses canonical
 * `studentIds` (drop `childStudentIds` — REVIEW D10). Scanner is tenant-scoped with
 * required `authUid` (REVIEW D11).
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import {
  zStudentId,
  zTeacherId,
  zParentId,
  zStaffId,
  zScannerId,
  zTenantId,
  zUserId,
  zClassId,
  zSectionId,
} from "../../primitives/branded-id.zod.js";
import { zTimestamp } from "../../primitives/timestamp.zod.js";
import { zIsoDate } from "../../primitives/iso-date.zod.js";
import { zEntityStatus } from "../../enums/tenant.js";

export const StudentSchema = zObject({
  id: zStudentId,
  tenantId: zTenantId,
  authUid: zUserId.optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  displayName: z.string().optional(),
  email: z.string().optional(),
  rollNumber: z.string().optional(),
  section: z.string().optional(),
  classIds: z.array(zClassId).default([]),
  parentIds: z.array(zParentId).default([]),
  grade: z.string().optional(),
  admissionNumber: z.string().optional(),
  dateOfBirth: zIsoDate.optional(),
  status: zEntityStatus,
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
});
export type Student = z.infer<typeof StudentSchema>;

export const TeacherSchema = zObject({
  id: zTeacherId,
  tenantId: zTenantId,
  authUid: zUserId.optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  firstName: z.string(),
  lastName: z.string(),
  displayName: z.string().optional(),
  employeeId: z.string().optional(),
  department: z.string().optional(),
  subjects: z.array(z.string()).default([]),
  designation: z.string().optional(),
  classIds: z.array(zClassId).default([]),
  sectionIds: z.array(zSectionId).optional(),
  status: zEntityStatus,
  lastLogin: zTimestamp.nullable(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
});
export type Teacher = z.infer<typeof TeacherSchema>;

export const ParentSchema = zObject({
  id: zParentId,
  tenantId: zTenantId,
  authUid: zUserId.optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  firstName: z.string(),
  lastName: z.string(),
  displayName: z.string().optional(),
  studentIds: z.array(zStudentId).default([]),
  linkedStudentNames: z.array(z.string()).optional(),
  status: zEntityStatus,
  lastLogin: zTimestamp.nullable(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
});
export type Parent = z.infer<typeof ParentSchema>;

export const StaffSchema = zObject({
  id: zStaffId,
  tenantId: zTenantId,
  authUid: zUserId.optional(),
  email: z.string().optional(),
  firstName: z.string(),
  lastName: z.string(),
  displayName: z.string().optional(),
  department: z.string().optional(),
  status: zEntityStatus,
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
});
export type Staff = z.infer<typeof StaffSchema>;

export const ScannerSchema = zObject({
  id: zScannerId,
  tenantId: zTenantId,
  authUid: zUserId,
  name: z.string(),
  status: zEntityStatus,
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
});
export type Scanner = z.infer<typeof ScannerSchema>;
