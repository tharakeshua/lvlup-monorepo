/**
 * Multi-tenant user management + bulk operations + session rollover (identity).
 *
 * `createOrgUser` is the idempotent saga (Auth user → entity → membership →
 * claims → counters); it `resyncsClaims` and is `authoritySensitive` (mints the
 * org membership). `switchActiveTenant`/`joinTenant` rebuild claims for the
 * target tenant (the client forces `getIdToken(true)`). Bulk ops are batched +
 * idempotent. NO request declares `tenantId` (claim-derived). Schemas `.strict()`.
 */
import { z } from "zod";
import {
  zUserId,
  zTenantId,
  zClassId,
  zStudentId,
  zTeacherId,
  zParentId,
  zStaffId,
  zMembershipId,
  zAcademicSessionId,
  zTenantRole,
  zEntityStatus,
} from "@levelup/domain";
import { defineCallable, type CallableDef } from "./_shared.js";

// ── createOrgUser ─────────────────────────────────────────────────────────────
export const CreateOrgUserRequestSchema = z
  .object({
    role: zTenantRole,
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().optional(),
    rollNumber: z.string().optional(),
    password: z.string().optional(),
    phone: z.string().optional(),
    classIds: z.array(zClassId).optional(),
    subjects: z.array(z.string()).optional(),
    // canonical parent→child linkage mapped server-side to parentLinkedStudentIds.
    linkedStudentIds: z.array(zStudentId).optional(),
  })
  .strict();
export type CreateOrgUserRequest = z.infer<typeof CreateOrgUserRequestSchema>;

export const CreateOrgUserResponseSchema = z
  .object({
    uid: zUserId,
    entityId: z.string(),
    membershipId: zMembershipId,
  })
  .strict();

export const createOrgUser = defineCallable({
  name: "v1.identity.createOrgUser",
  module: "identity",
  requestSchema: CreateOrgUserRequestSchema,
  responseSchema: CreateOrgUserResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  resyncsClaims: true,
  invalidates: ["students", "teachers", "parents", "staff", "memberships", "claims", "tenants"],
  authoritySensitive: true,
});

// ── switchActiveTenant ────────────────────────────────────────────────────────
export const SwitchActiveTenantRequestSchema = z.object({ targetTenantId: zTenantId }).strict();
export type SwitchActiveTenantRequest = z.infer<typeof SwitchActiveTenantRequestSchema>;

export const SwitchActiveTenantResponseSchema = z
  .object({ tenantId: zTenantId, role: zTenantRole })
  .strict();

export const switchActiveTenant = defineCallable({
  name: "v1.identity.switchActiveTenant",
  module: "identity",
  requestSchema: SwitchActiveTenantRequestSchema,
  responseSchema: SwitchActiveTenantResponseSchema,
  authMode: "authed",
  rateTier: "auth",
  resyncsClaims: true,
  // tenant context changes everything — handled by resetForTenantSwitch (§4.3).
  invalidates: ["me", "claims", "memberships"],
  authoritySensitive: true,
});

// ── joinTenant ────────────────────────────────────────────────────────────────
export const JoinTenantRequestSchema = z.object({ tenantCode: z.string() }).strict();
export type JoinTenantRequest = z.infer<typeof JoinTenantRequestSchema>;

export const JoinTenantResponseSchema = z
  .object({ tenantId: zTenantId, membershipId: zMembershipId, role: zTenantRole })
  .strict();

export const joinTenant = defineCallable({
  name: "v1.identity.joinTenant",
  module: "identity",
  requestSchema: JoinTenantRequestSchema,
  responseSchema: JoinTenantResponseSchema,
  authMode: "authed",
  rateTier: "auth",
  idempotent: true,
  idempotencyKey: "transport",
  resyncsClaims: true,
  invalidates: ["me", "memberships", "claims"],
});

// ── bulk import shared shapes ─────────────────────────────────────────────────
export const StudentImportRowSchema = z
  .object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().optional(),
    rollNumber: z.string().optional(),
    section: z.string().optional(),
    grade: z.string().optional(),
    admissionNumber: z.string().optional(),
    classIds: z.array(zClassId).optional(),
  })
  .strict();

export const TeacherImportRowSchema = z
  .object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().optional(),
    phone: z.string().optional(),
    subjects: z.array(z.string()).optional(),
    department: z.string().optional(),
  })
  .strict();

export const BulkRowErrorSchema = z.object({ row: z.number().int(), error: z.string() }).strict();

export const BulkImportResponseSchema = z
  .object({
    created: z.number().int(),
    skipped: z.number().int(),
    errors: z.array(BulkRowErrorSchema),
  })
  .strict();

// ── bulkImportStudents ────────────────────────────────────────────────────────
export const BulkImportStudentsRequestSchema = z
  .object({
    rows: z.array(StudentImportRowSchema).min(1),
    defaultClassIds: z.array(zClassId).optional(),
  })
  .strict();
export type BulkImportStudentsRequest = z.infer<typeof BulkImportStudentsRequestSchema>;

export const bulkImportStudents = defineCallable({
  name: "v1.identity.bulkImportStudents",
  module: "identity",
  requestSchema: BulkImportStudentsRequestSchema,
  responseSchema: BulkImportResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  resyncsClaims: true,
  invalidates: ["students", "classes", "memberships", "claims", "tenants"],
  authoritySensitive: true,
});

// ── bulkImportTeachers ────────────────────────────────────────────────────────
export const BulkImportTeachersRequestSchema = z
  .object({ rows: z.array(TeacherImportRowSchema).min(1) })
  .strict();
export type BulkImportTeachersRequest = z.infer<typeof BulkImportTeachersRequestSchema>;

export const bulkImportTeachers = defineCallable({
  name: "v1.identity.bulkImportTeachers",
  module: "identity",
  requestSchema: BulkImportTeachersRequestSchema,
  responseSchema: BulkImportResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  resyncsClaims: true,
  invalidates: ["teachers", "memberships", "claims", "tenants"],
  authoritySensitive: true,
});

// ── bulkUpdateStatus (C10: + 'class') ─────────────────────────────────────────
export const BulkUpdateStatusRequestSchema = z
  .object({
    entityType: z.enum(["student", "teacher", "class"]),
    ids: z.array(z.string()).min(1),
    status: zEntityStatus,
  })
  .strict();
export type BulkUpdateStatusRequest = z.infer<typeof BulkUpdateStatusRequestSchema>;

export const BulkUpdateStatusResponseSchema = z
  .object({
    updated: z.number().int(),
    errors: z.array(z.object({ id: z.string(), error: z.string() }).strict()),
  })
  .strict();

export const bulkUpdateStatus = defineCallable({
  name: "v1.identity.bulkUpdateStatus",
  module: "identity",
  requestSchema: BulkUpdateStatusRequestSchema,
  responseSchema: BulkUpdateStatusResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  resyncsClaims: true,
  invalidates: ["students", "teachers", "memberships", "claims"],
  authoritySensitive: true,
});

// ── changeMembershipRole (C10 optional) ───────────────────────────────────────
export const ChangeMembershipRoleRequestSchema = z
  .object({
    uid: zUserId,
    toRole: zTenantRole,
    links: z
      .object({
        teacherId: zTeacherId.optional(),
        studentId: zStudentId.optional(),
        parentId: zParentId.optional(),
        staffId: zStaffId.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type ChangeMembershipRoleRequest = z.infer<typeof ChangeMembershipRoleRequestSchema>;

export const ChangeMembershipRoleResponseSchema = z
  .object({ membershipId: zMembershipId, role: zTenantRole })
  .strict();

export const changeMembershipRole = defineCallable({
  name: "v1.identity.changeMembershipRole",
  module: "identity",
  requestSchema: ChangeMembershipRoleRequestSchema,
  responseSchema: ChangeMembershipRoleResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  resyncsClaims: true,
  invalidates: ["memberships", "claims"],
  authoritySensitive: true,
});

// ── rolloverSession ───────────────────────────────────────────────────────────
export const RolloverSessionRequestSchema = z
  .object({
    fromSessionId: zAcademicSessionId,
    toSessionId: zAcademicSessionId,
    // optional class→class promotion mapping (old classId → new classId).
    promotionMap: z.record(zClassId, zClassId).optional(),
  })
  .strict();
export type RolloverSessionRequest = z.infer<typeof RolloverSessionRequestSchema>;

export const RolloverSessionResponseSchema = z
  .object({ classesCreated: z.number().int(), studentsMoved: z.number().int() })
  .strict();

export const rolloverSession = defineCallable({
  name: "v1.identity.rolloverSession",
  module: "identity",
  requestSchema: RolloverSessionRequestSchema,
  responseSchema: RolloverSessionResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  invalidates: ["classes", "academicSessions", "students"],
});

export const USER_CALLABLES = {
  createOrgUser,
  switchActiveTenant,
  joinTenant,
  bulkImportStudents,
  bulkImportTeachers,
  bulkUpdateStatus,
  changeMembershipRole,
  rolloverSession,
} as const satisfies Record<string, CallableDef>;
