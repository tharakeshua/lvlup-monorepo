/**
 * Pins the CONVERGED claim shape (RR-T2-A): the legacy builder must produce the
 * same claims as the v1 mint (`services/identity/sync-membership-claims.ts
 * buildClaimsFromMembership`) and parse against domain `PlatformClaimsSchema`.
 */
import { describe, it, expect } from "vitest";
import { PlatformClaimsSchema } from "@levelup/domain";
import { buildClaimsForMembership } from "../../utils/claims";
import type { UserMembership } from "../../contracts/legacy-docs";

const ts = { seconds: 0, nanoseconds: 0 };

function makeMembership(overrides: Partial<UserMembership>): UserMembership {
  return {
    id: "uid1_tenant1",
    uid: "uid1",
    tenantId: "tenant1",
    tenantCode: "TST001",
    role: "student",
    status: "active",
    joinSource: "admin_created",
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  } as UserMembership;
}

describe("buildClaimsForMembership (converged with v1 mint)", () => {
  it("should set base claims for all roles", () => {
    const claims = buildClaimsForMembership(makeMembership({}));
    expect(claims.role).toBe("student");
    expect(claims.tenantId).toBe("tenant1");
    expect(claims.tenantCode).toBe("TST001");
  });

  it("should set studentId for student role", () => {
    const claims = buildClaimsForMembership(makeMembership({ role: "student", studentId: "stu1" }));
    expect(claims.studentId).toBe("stu1");
    expect(claims.teacherId).toBeUndefined();
  });

  it("should read classIds from legacy permissions.managedClassIds", () => {
    const claims = buildClaimsForMembership(
      makeMembership({
        role: "teacher",
        teacherId: "tch1",
        permissions: { managedClassIds: ["c1", "c2", "c3"] },
      })
    );
    expect(claims.teacherId).toBe("tch1");
    expect(claims.classIds).toEqual(["c1", "c2", "c3"]);
    // v1 shape: overflow flag is present-or-absent, never false.
    expect(claims.classIdsOverflow).toBeUndefined();
  });

  it("should prefer v1 top-level classIds over legacy managedClassIds", () => {
    const claims = buildClaimsForMembership({
      ...makeMembership({ role: "teacher", teacherId: "tch1" }),
      classIds: ["top1"],
      permissions: { managedClassIds: ["legacy1"] },
    });
    expect(claims.classIds).toEqual(["top1"]);
  });

  it("should cap classIds at 15 and set overflow flag", () => {
    const manyClassIds = Array.from({ length: 20 }, (_, i) => `class_${i}`);
    const claims = buildClaimsForMembership(
      makeMembership({
        role: "teacher",
        teacherId: "tch1",
        permissions: { managedClassIds: manyClassIds },
      })
    );
    expect(claims.classIds).toHaveLength(15);
    expect(claims.classIdsOverflow).toBe(true);
  });

  it("should set parentId and studentIds for parent role", () => {
    const claims = buildClaimsForMembership(
      makeMembership({
        role: "parent",
        parentId: "par1",
        parentLinkedStudentIds: ["stu1", "stu2"],
      })
    );
    expect(claims.parentId).toBe("par1");
    expect(claims.studentIds).toEqual(["stu1", "stu2"]);
    expect(claims.classIds).toEqual([]);
  });

  it("should drop studentIds when parentLinkedStudentIds is absent (v1 shape)", () => {
    const claims = buildClaimsForMembership(makeMembership({ role: "parent", parentId: "par1" }));
    expect("studentIds" in claims).toBe(false);
  });

  it("should set scannerId for scanner role", () => {
    const claims = buildClaimsForMembership(
      makeMembership({ role: "scanner", scannerId: "scan1" })
    );
    expect(claims.scannerId).toBe("scan1");
  });

  it("should lift only boolean permission entries (managed*Ids never leak into the claim)", () => {
    const claims = buildClaimsForMembership(
      makeMembership({
        role: "teacher",
        teacherId: "tch1",
        permissions: {
          canCreateExams: true,
          canEditRubrics: false,
          managedClassIds: ["c1"],
          managedSpaceIds: ["s1"],
        },
      })
    );
    expect(claims.permissions).toEqual({ canCreateExams: true, canEditRubrics: false });
  });

  it("should NOT default-expand missing permission keys (v1 pass-through)", () => {
    const claims = buildClaimsForMembership(
      makeMembership({
        role: "teacher",
        teacherId: "tch1",
        permissions: { canCreateExams: true },
      })
    );
    expect(claims.permissions).toEqual({ canCreateExams: true });
  });

  it("should pass staffPermissions through for staff role", () => {
    const claims = buildClaimsForMembership(
      makeMembership({
        role: "staff",
        staffId: "stf1",
        staffPermissions: {
          canManageUsers: true,
          canManageClasses: false,
          canManageBilling: false,
          canViewAnalytics: true,
          canManageSettings: false,
          canExportData: false,
        },
      })
    );
    expect(claims.staffPermissions).toEqual({
      canManageUsers: true,
      canManageClasses: false,
      canManageBilling: false,
      canViewAnalytics: true,
      canManageSettings: false,
      canExportData: false,
    });
  });

  it("should mint isSuperAdmin when passed (DEP-1 bug class)", () => {
    const claims = buildClaimsForMembership(makeMembership({ role: "tenantAdmin" }), {
      isSuperAdmin: true,
    });
    expect(claims.isSuperAdmin).toBe(true);
  });

  it("should omit isSuperAdmin when false/absent (present-or-absent, never false)", () => {
    expect("isSuperAdmin" in buildClaimsForMembership(makeMembership({}))).toBe(false);
    expect(
      "isSuperAdmin" in buildClaimsForMembership(makeMembership({}), { isSuperAdmin: false })
    ).toBe(false);
  });

  it("should drop every undefined key (compact JWT, v1 shape)", () => {
    const claims = buildClaimsForMembership(makeMembership({ role: "tenantAdmin" }));
    expect(Object.keys(claims).sort()).toEqual(["classIds", "role", "tenantCode", "tenantId"]);
  });

  it("should handle exactly 15 classIds without overflow", () => {
    const classIds = Array.from({ length: 15 }, (_, i) => `class_${i}`);
    const claims = buildClaimsForMembership(
      makeMembership({
        role: "student",
        studentId: "stu1",
        permissions: { managedClassIds: classIds },
      })
    );
    expect(claims.classIds).toHaveLength(15);
    expect(claims.classIdsOverflow).toBeUndefined();
  });
});

describe("RR-T2-A: claim shape parses against domain PlatformClaimsSchema", () => {
  it("teacher claim (domain-vocabulary permission keys) round-trips the schema", () => {
    const claims = buildClaimsForMembership(
      makeMembership({
        role: "teacher",
        teacherId: "tch1",
        // Domain-vocabulary keys: the legacy keys (canEditRubrics, …) are the
        // RR-T2-B conflict, blocked on product — the builder passes keys
        // through untranslated either way. The record is EXHAUSTIVE because
        // zod4 z.record(enum, bool) requires every key — see seam test below.
        permissions: {
          canManageSpaces: false,
          canManageStudents: false,
          canManageClasses: false,
          canCreateExams: true,
          canGradeExams: false,
          canViewAnalytics: false,
          canManageContent: true,
          canReleaseResults: false,
          managedClassIds: ["c1", "c2"],
        } as UserMembership["permissions"],
      })
    );
    const parsed = PlatformClaimsSchema.parse(claims);
    expect(parsed).toEqual(claims);
  });

  it("domain PlatformClaimsSchema accepts PARTIAL permission records (z.partialRecord — sparse claims fit the 1000-byte budget)", () => {
    const claims = buildClaimsForMembership(
      makeMembership({
        role: "teacher",
        teacherId: "tch1",
        permissions: { canCreateExams: true } as UserMembership["permissions"],
      })
    );
    // Domain flipped z.record → z.partialRecord (U3.1 escalation (a), 2026-07-04):
    // the v1 mint's sparse permission records now parse.
    expect(PlatformClaimsSchema.safeParse(claims).success).toBe(true);
  });

  it("super-admin claim keeps isSuperAdmin through the schema", () => {
    const claims = buildClaimsForMembership(makeMembership({ role: "tenantAdmin" }), {
      isSuperAdmin: true,
    });
    const parsed = PlatformClaimsSchema.parse(claims);
    expect(parsed.isSuperAdmin).toBe(true);
  });

  it("parent and scanner claims parse", () => {
    const parent = buildClaimsForMembership(
      makeMembership({ role: "parent", parentId: "p1", parentLinkedStudentIds: ["s1"] })
    );
    const scanner = buildClaimsForMembership(makeMembership({ role: "scanner", scannerId: "sc1" }));
    expect(PlatformClaimsSchema.parse(parent)).toEqual(parent);
    expect(PlatformClaimsSchema.parse(scanner)).toEqual(scanner);
  });
});
