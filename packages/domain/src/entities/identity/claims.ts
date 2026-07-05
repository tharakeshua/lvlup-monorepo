/**
 * PlatformClaims — JWT projection (never a doc). ⚷ minted server-only.
 * Adds `isSuperAdmin?` claim (auth-access §4.5; removes the per-rule get()).
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import { zTenantId, zTenantCode, zClassId, zStudentId } from "../../primitives/branded-id.zod.js";
import { zTenantRole } from "../../enums/tenant.js";
import { roleIdFields } from "./role-registry.js";
import { zTeacherPermissionKey, zStaffPermissionKey } from "../../enums/permissions.js";

export const PlatformClaimsSchema = zObject({
  role: zTenantRole.optional(),
  tenantId: zTenantId.optional(),
  tenantCode: zTenantCode.optional(),
  // Per-role id fields (teacherId/studentId/parentId/scannerId/staffId) DERIVED
  // from ID_ROLES (DP-2 Part B) — a new role's id field appears here automatically.
  ...roleIdFields,
  classIds: z.array(zClassId).optional(),
  classIdsOverflow: z.boolean().optional(),
  studentIds: z.array(zStudentId).optional(),
  permissions: z.partialRecord(zTeacherPermissionKey, z.boolean()).optional(),
  staffPermissions: z.partialRecord(zStaffPermissionKey, z.boolean()).optional(),
  isSuperAdmin: z.boolean().optional(),
});
export type PlatformClaims = z.infer<typeof PlatformClaimsSchema>;
