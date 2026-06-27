/**
 * Class + AcademicSession. `studentIds`/`studentCount` denorm are trigger-maintained
 * projections, not source of truth (REVIEW D7).
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import {
  zClassId,
  zTenantId,
  zUserId,
  zTeacherId,
  zStudentId,
  zAcademicSessionId,
} from "../../primitives/branded-id.zod.js";
import { zTimestamp } from "../../primitives/timestamp.zod.js";
import { zIsoDate } from "../../primitives/iso-date.zod.js";
import { zEntityStatus } from "../../enums/tenant.js";

export const ClassSchema = zObject({
  id: zClassId,
  tenantId: zTenantId,
  name: z.string(),
  grade: z.string(),
  section: z.string().optional(),
  academicSessionId: zAcademicSessionId.optional(),
  teacherIds: z.array(zTeacherId).default([]),
  studentIds: z.array(zStudentId).default([]),
  studentCount: z.number().int().default(0),
  status: zEntityStatus,
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
});
export type Class = z.infer<typeof ClassSchema>;

export const AcademicSessionSchema = zObject({
  id: zAcademicSessionId,
  tenantId: zTenantId,
  name: z.string(),
  startDate: zIsoDate,
  endDate: zIsoDate,
  isCurrent: z.boolean(),
  status: zEntityStatus,
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
});
export type AcademicSession = z.infer<typeof AcademicSessionSchema>;
