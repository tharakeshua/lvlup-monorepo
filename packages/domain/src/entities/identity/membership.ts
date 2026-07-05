/**
 * UserMembership — `/userMemberships/{uid}_{tenantId}`. ⚷ Admin-SDK write only.
 * `parentLinkedStudentIds` is the canonical parent→child name (REVIEW D10).
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import {
  zMembershipId,
  zUserId,
  zTenantId,
  zTenantCode,
  zStudentId,
  zSpaceId,
  zClassId,
} from "../../primitives/branded-id.zod.js";
import { zTimestamp } from "../../primitives/timestamp.zod.js";
import { zTenantRole, zMembershipStatus, zJoinSource } from "../../enums/tenant.js";
import { roleIdFields } from "./role-registry.js";
import { zTeacherPermissionKey, zStaffPermissionKey } from "../../enums/permissions.js";

export const TeacherPermissionsSchema = zObject({
  permissions: z.partialRecord(zTeacherPermissionKey, z.boolean()).optional(),
  managedSpaceIds: z.array(zSpaceId).optional(),
  managedClassIds: z.array(zClassId).optional(),
});
export type TeacherPermissions = z.infer<typeof TeacherPermissionsSchema>;

export const UserMembershipSchema = zObject({
  id: zMembershipId,
  uid: zUserId,
  tenantId: zTenantId,
  tenantCode: zTenantCode,
  role: zTenantRole,
  status: zMembershipStatus,
  joinSource: zJoinSource,
  // Per-role id fields DERIVED from ID_ROLES (DP-2 Part B).
  ...roleIdFields,
  permissions: TeacherPermissionsSchema.optional(),
  staffPermissions: z.partialRecord(zStaffPermissionKey, z.boolean()).optional(),
  parentLinkedStudentIds: z.array(zStudentId).optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
  lastActive: zTimestamp.nullable(),
});
export type UserMembership = z.infer<typeof UserMembershipSchema>;
