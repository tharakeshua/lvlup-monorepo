/**
 * PlatformClaims — JWT projection (never a doc). ⚷ minted server-only.
 * Adds `isSuperAdmin?` claim (auth-access §4.5; removes the per-rule get()).
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import {
  zTenantId,
  zTenantCode,
  zTeacherId,
  zStudentId,
  zParentId,
  zScannerId,
  zStaffId,
  zClassId,
} from "../../primitives/branded-id.zod.js";
import { zTenantRole } from "../../enums/tenant.js";
import { zTeacherPermissionKey, zStaffPermissionKey } from "../../enums/permissions.js";

export const PlatformClaimsSchema = zObject({
  role: zTenantRole.optional(),
  tenantId: zTenantId.optional(),
  tenantCode: zTenantCode.optional(),
  teacherId: zTeacherId.optional(),
  studentId: zStudentId.optional(),
  parentId: zParentId.optional(),
  scannerId: zScannerId.optional(),
  staffId: zStaffId.optional(),
  classIds: z.array(zClassId).optional(),
  classIdsOverflow: z.boolean().optional(),
  studentIds: z.array(zStudentId).optional(),
  permissions: z.record(zTeacherPermissionKey, z.boolean()).optional(),
  staffPermissions: z.record(zStaffPermissionKey, z.boolean()).optional(),
  isSuperAdmin: z.boolean().optional(),
});
export type PlatformClaims = z.infer<typeof PlatformClaimsSchema>;
