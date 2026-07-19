/**
 * Tenant-scoped entity upserts (`save*`) + their read endpoints (identity).
 *
 * All upserts use the canonical `SaveResponse{id,created,archived?}` (§3.2 DX-11).
 * Role-profile `saveStudent/Teacher/Parent/Staff` persist METADATA only —
 * membership + claims minting is exclusively `createOrgUser` (B-IDN-03).
 * `saveClass` may re-sync teacher memberships/claims on roster change, so it
 * alone keeps `resyncsClaims` + memberships/claims invalidation. NO request
 * declares `tenantId` (claim-derived). `delete?=true` maps to an archive
 * transition (D5), not a hard delete. Schemas are `.strict()`.
 */
import { z } from "zod";
import {
  StudentSchema,
  TeacherSchema,
  ParentSchema,
  StaffSchema,
  ClassSchema,
  AcademicSessionSchema,
  zStudentId,
  zTeacherId,
  zParentId,
  zStaffId,
  zClassId,
  zAcademicSessionId,
  zSpaceId,
  zEntityStatus,
  zIsoDate,
  zTeacherPermissionKey,
  zStaffPermissionKey,
} from "@levelup/domain";
import {
  defineCallable,
  pageResponse,
  withPaging,
  PageRequest,
  SaveResponseSchema,
  type CallableDef,
} from "./_shared.js";

/** Day-of-week tuple for the C5 `Class.schedule` field. */
export const DAYS_OF_WEEK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export const zDayOfWeek = z.enum(DAYS_OF_WEEK);

/** C5 — class schedule embed (extends `saveClass.data` + `ClassDetailView`). */
export const ClassScheduleSchema = z
  .object({
    days: z.array(zDayOfWeek).min(1),
    startTime: z.string(),
    endTime: z.string(),
    room: z.string().optional(),
  })
  .strict();

// ── saveStudent ───────────────────────────────────────────────────────────────
export const SaveStudentRequestSchema = z
  .object({
    id: zStudentId.optional(),
    data: z
      .object({
        firstName: z.string(),
        lastName: z.string(),
        email: z.string().optional(),
        rollNumber: z.string().optional(),
        section: z.string().optional(),
        grade: z.string().optional(),
        classIds: z.array(zClassId).optional(),
        parentIds: z.array(zParentId).optional(),
        dateOfBirth: zIsoDate.optional(),
        admissionNumber: z.string().optional(),
        status: zEntityStatus.optional(),
      })
      .strict(),
    delete: z.boolean().optional(),
  })
  .strict();
export type SaveStudentRequest = z.infer<typeof SaveStudentRequestSchema>;

export const saveStudent = defineCallable({
  name: "v1.identity.saveStudent",
  module: "identity",
  requestSchema: SaveStudentRequestSchema,
  responseSchema: SaveResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["students", "classes"],
});

// ── saveTeacher ───────────────────────────────────────────────────────────────
export const SaveTeacherRequestSchema = z
  .object({
    id: zTeacherId.optional(),
    data: z
      .object({
        firstName: z.string(),
        lastName: z.string(),
        email: z.string().optional(),
        phone: z.string().optional(),
        subjects: z.array(z.string()).optional(),
        department: z.string().optional(),
        designation: z.string().optional(),
        classIds: z.array(zClassId).optional(),
        permissions: z
          .object({
            permissions: z.record(zTeacherPermissionKey, z.boolean()).optional(),
            managedSpaceIds: z.array(zSpaceId).optional(),
            managedClassIds: z.array(zClassId).optional(),
          })
          .strict()
          .optional(),
        status: zEntityStatus.optional(),
      })
      .strict(),
    delete: z.boolean().optional(),
  })
  .strict();
export type SaveTeacherRequest = z.infer<typeof SaveTeacherRequestSchema>;

export const saveTeacher = defineCallable({
  name: "v1.identity.saveTeacher",
  module: "identity",
  requestSchema: SaveTeacherRequestSchema,
  responseSchema: SaveResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["teachers", "classes"],
});

// ── saveParent ────────────────────────────────────────────────────────────────
export const SaveParentRequestSchema = z
  .object({
    id: zParentId.optional(),
    data: z
      .object({
        firstName: z.string(),
        lastName: z.string(),
        email: z.string().optional(),
        phone: z.string().optional(),
        // canonical parent→child name (D10).
        studentIds: z.array(zStudentId).optional(),
        status: zEntityStatus.optional(),
      })
      .strict(),
    delete: z.boolean().optional(),
  })
  .strict();
export type SaveParentRequest = z.infer<typeof SaveParentRequestSchema>;

export const saveParent = defineCallable({
  name: "v1.identity.saveParent",
  module: "identity",
  requestSchema: SaveParentRequestSchema,
  responseSchema: SaveResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["parents", "students"],
});

// ── saveStaff ─────────────────────────────────────────────────────────────────
export const SaveStaffRequestSchema = z
  .object({
    id: zStaffId.optional(),
    data: z
      .object({
        firstName: z.string(),
        lastName: z.string(),
        email: z.string().optional(),
        department: z.string().optional(),
        staffPermissions: z.record(zStaffPermissionKey, z.boolean()).optional(),
        status: zEntityStatus.optional(),
      })
      .strict(),
    delete: z.boolean().optional(),
  })
  .strict();
export type SaveStaffRequest = z.infer<typeof SaveStaffRequestSchema>;

export const saveStaff = defineCallable({
  name: "v1.identity.saveStaff",
  module: "identity",
  requestSchema: SaveStaffRequestSchema,
  responseSchema: SaveResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["staff"],
});

// ── saveClass (+ C5 schedule) ─────────────────────────────────────────────────
export const SaveClassRequestSchema = z
  .object({
    id: zClassId.optional(),
    data: z
      .object({
        name: z.string(),
        grade: z.string(),
        section: z.string().optional(),
        academicSessionId: zAcademicSessionId.optional(),
        teacherIds: z.array(zTeacherId).optional(),
        schedule: ClassScheduleSchema.optional(),
        status: zEntityStatus.optional(),
      })
      .strict(),
    delete: z.boolean().optional(),
  })
  .strict();
export type SaveClassRequest = z.infer<typeof SaveClassRequestSchema>;

export const saveClass = defineCallable({
  name: "v1.identity.saveClass",
  module: "identity",
  requestSchema: SaveClassRequestSchema,
  responseSchema: SaveResponseSchema,
  authMode: "authed",
  rateTier: "write",
  resyncsClaims: true,
  invalidates: ["classes", "students", "teachers", "claims"],
});

// ── saveAcademicSession ───────────────────────────────────────────────────────
export const SaveAcademicSessionRequestSchema = z
  .object({
    id: zAcademicSessionId.optional(),
    data: z
      .object({
        name: z.string(),
        startDate: zIsoDate,
        endDate: zIsoDate,
        isCurrent: z.boolean().optional(),
        status: zEntityStatus.optional(),
      })
      .strict(),
    delete: z.boolean().optional(),
  })
  .strict();
export type SaveAcademicSessionRequest = z.infer<typeof SaveAcademicSessionRequestSchema>;

export const saveAcademicSession = defineCallable({
  name: "v1.identity.saveAcademicSession",
  module: "identity",
  requestSchema: SaveAcademicSessionRequestSchema,
  responseSchema: SaveResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["academicSessions", "classes"],
});

// ── reads: students ───────────────────────────────────────────────────────────
export const ListStudentsRequestSchema = withPaging(
  z.object({
    classId: zClassId.optional(),
    status: zEntityStatus.optional(),
    q: z.string().optional(),
  })
);
export type ListStudentsRequest = z.infer<typeof ListStudentsRequestSchema>;

export const listStudents = defineCallable({
  name: "v1.identity.listStudents",
  module: "identity",
  requestSchema: ListStudentsRequestSchema,
  responseSchema: pageResponse(StudentSchema),
  authMode: "authed",
  rateTier: "read",
});

export const GetStudentRequestSchema = z.object({ id: zStudentId }).strict();
export type GetStudentRequest = z.infer<typeof GetStudentRequestSchema>;

export const getStudent = defineCallable({
  name: "v1.identity.getStudent",
  module: "identity",
  requestSchema: GetStudentRequestSchema,
  responseSchema: StudentSchema,
  authMode: "authed",
  rateTier: "read",
});

// ── reads: teachers ───────────────────────────────────────────────────────────
export const ListTeachersRequestSchema = withPaging(z.object({ status: zEntityStatus.optional() }));
export type ListTeachersRequest = z.infer<typeof ListTeachersRequestSchema>;

export const listTeachers = defineCallable({
  name: "v1.identity.listTeachers",
  module: "identity",
  requestSchema: ListTeachersRequestSchema,
  responseSchema: pageResponse(TeacherSchema),
  authMode: "authed",
  rateTier: "read",
});

export const GetTeacherRequestSchema = z.object({ id: zTeacherId }).strict();
export type GetTeacherRequest = z.infer<typeof GetTeacherRequestSchema>;

export const getTeacher = defineCallable({
  name: "v1.identity.getTeacher",
  module: "identity",
  requestSchema: GetTeacherRequestSchema,
  responseSchema: TeacherSchema,
  authMode: "authed",
  rateTier: "read",
});

// ── reads: parents ────────────────────────────────────────────────────────────
export const ListParentsRequestSchema = withPaging(z.object({ studentId: zStudentId.optional() }));
export type ListParentsRequest = z.infer<typeof ListParentsRequestSchema>;

export const listParents = defineCallable({
  name: "v1.identity.listParents",
  module: "identity",
  requestSchema: ListParentsRequestSchema,
  responseSchema: pageResponse(ParentSchema),
  authMode: "authed",
  rateTier: "read",
});

// ── reads: staff ──────────────────────────────────────────────────────────────
export const ListStaffRequestSchema = PageRequest;
export type ListStaffRequest = z.infer<typeof ListStaffRequestSchema>;

export const listStaff = defineCallable({
  name: "v1.identity.listStaff",
  module: "identity",
  requestSchema: ListStaffRequestSchema,
  responseSchema: pageResponse(StaffSchema),
  authMode: "authed",
  rateTier: "read",
});

// ── reads: classes ────────────────────────────────────────────────────────────
export const ListClassesRequestSchema = withPaging(
  z.object({
    academicSessionId: zAcademicSessionId.optional(),
    status: zEntityStatus.optional(),
  })
);
export type ListClassesRequest = z.infer<typeof ListClassesRequestSchema>;

export const listClasses = defineCallable({
  name: "v1.identity.listClasses",
  module: "identity",
  requestSchema: ListClassesRequestSchema,
  responseSchema: pageResponse(ClassSchema),
  authMode: "authed",
  rateTier: "read",
});

/** `ClassDetailView` = class + counts + first roster page (§3.2 / MERGE-PAGINATION). */
export const ClassDetailViewSchema = z
  .object({
    class: ClassSchema,
    students: pageResponse(StudentSchema),
    teachers: z.array(TeacherSchema),
  })
  .strict();

export const GetClassRequestSchema = z.object({ id: zClassId }).strict();
export type GetClassRequest = z.infer<typeof GetClassRequestSchema>;

export const getClass = defineCallable({
  name: "v1.identity.getClass",
  module: "identity",
  requestSchema: GetClassRequestSchema,
  responseSchema: ClassDetailViewSchema,
  authMode: "authed",
  rateTier: "read",
});

// ── reads: academic sessions ──────────────────────────────────────────────────
export const ListAcademicSessionsRequestSchema = PageRequest;
export type ListAcademicSessionsRequest = z.infer<typeof ListAcademicSessionsRequestSchema>;

export const listAcademicSessions = defineCallable({
  name: "v1.identity.listAcademicSessions",
  module: "identity",
  requestSchema: ListAcademicSessionsRequestSchema,
  responseSchema: pageResponse(AcademicSessionSchema),
  authMode: "authed",
  rateTier: "read",
});

export const ENTITY_CALLABLES = {
  saveStudent,
  saveTeacher,
  saveParent,
  saveStaff,
  saveClass,
  saveAcademicSession,
  listStudents,
  getStudent,
  listTeachers,
  getTeacher,
  listParents,
  listStaff,
  listClasses,
  getClass,
  listAcademicSessions,
} as const satisfies Record<string, CallableDef>;
