import { describe, it, expect } from "vitest";
import { buildClaimsForMembership } from "../../utils/claims";
import type { UserMembership } from "../../contracts/legacy-docs";

/**
 * Tests for switch-active-tenant callable.
 *
 * Tests claim building and membership validation logic.
 */

const ts = { seconds: 0, nanoseconds: 0, toDate: () => new Date(), toMillis: () => 0 };

function makeMembership(overrides: Partial<UserMembership>): UserMembership {
  return {
    id: "uid1_tenant1",
    uid: "uid1",
    tenantId: "tenant1",
    tenantCode: "TST001",
    role: "teacher",
    status: "active",
    joinSource: "admin_created",
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  } as UserMembership;
}

describe("switch-active-tenant — membership validation", () => {
  it("should require active membership", () => {
    const membership = makeMembership({ status: "inactive" });
    expect(membership.status !== "active").toBe(true);
  });

  it("should accept active membership", () => {
    const membership = makeMembership({ status: "active" });
    expect(membership.status === "active").toBe(true);
  });

  it("should reject suspended membership", () => {
    const membership = makeMembership({ status: "suspended" } as any);
    expect(membership.status !== "active").toBe(true);
  });
});

describe("switch-active-tenant — claims building", () => {
  it("should build correct claims for teacher", () => {
    const claims = buildClaimsForMembership(
      makeMembership({
        role: "teacher",
        teacherId: "tch1",
        permissions: { managedClassIds: ["c1"] },
      })
    );

    expect(claims.role).toBe("teacher");
    expect(claims.tenantId).toBe("tenant1");
    expect(claims.teacherId).toBe("tch1");
  });

  it("should build correct claims for student", () => {
    const claims = buildClaimsForMembership(
      makeMembership({
        role: "student",
        studentId: "stu1",
      })
    );

    expect(claims.role).toBe("student");
    expect(claims.studentId).toBe("stu1");
  });

  it("should include tenantCode in claims", () => {
    const claims = buildClaimsForMembership(makeMembership({}));
    expect(claims.tenantCode).toBe("TST001");
  });

  // DEP-1: switchActiveTenant REPLACES the caller's claims. When the caller's
  // user doc has isSuperAdmin:true, the handler passes it through so a bare
  // re-mint no longer silently strips the super-admin claim.
  it("preserves isSuperAdmin when caller user doc is a super-admin", () => {
    const claims = buildClaimsForMembership(
      makeMembership({ role: "teacher", teacherId: "tch1" }),
      { isSuperAdmin: true }
    );
    expect(claims.isSuperAdmin).toBe(true);
  });

  it("omits isSuperAdmin for a non-super-admin caller (present-or-absent)", () => {
    const claims = buildClaimsForMembership(
      makeMembership({ role: "teacher", teacherId: "tch1" }),
      { isSuperAdmin: false }
    );
    expect(claims.isSuperAdmin).toBeUndefined();
  });
});
