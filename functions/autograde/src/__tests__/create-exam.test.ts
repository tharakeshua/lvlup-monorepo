import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCallerMembership, assertAutogradePermission } from "../utils/assertions";
import type { CallerMembership } from "../utils/assertions";

/**
 * Tests for create-exam — validation & permission helpers.
 *
 * We test the pure assertion functions directly rather than the
 * onCall wrapper, since the assertions are the critical logic.
 */

describe("create-exam — validation & permissions", () => {
  describe("getCallerMembership", () => {
    it("should throw unauthenticated when auth is missing", () => {
      expect(() => getCallerMembership({ data: {}, auth: undefined } as any)).toThrow(
        "Authentication required."
      );
    });

    it("should throw permission-denied when no active tenant", () => {
      expect(() =>
        getCallerMembership({ data: {}, auth: { uid: "u1", token: {} } } as any)
      ).toThrow("No active tenant context");
    });

    it("should return caller membership from claims", () => {
      const result = getCallerMembership({
        data: {},
        auth: {
          uid: "u1",
          token: { tenantId: "t1", role: "teacher", permissions: { canCreateExams: true } },
        },
      } as any);

      expect(result).toEqual({
        uid: "u1",
        tenantId: "t1",
        role: "teacher",
        permissions: { canCreateExams: true },
      });
    });
  });

  describe("assertAutogradePermission", () => {
    const makeCaller = (overrides: Partial<CallerMembership> = {}): CallerMembership => ({
      uid: "u1",
      tenantId: "tenant-1",
      role: "teacher",
      permissions: { canCreateExams: true },
      ...overrides,
    });

    it("should allow superAdmin for any operation", () => {
      expect(() =>
        assertAutogradePermission(makeCaller({ role: "superAdmin" }), "tenant-1", "canCreateExams")
      ).not.toThrow();
    });

    it("should allow tenantAdmin for any operation", () => {
      expect(() =>
        assertAutogradePermission(makeCaller({ role: "tenantAdmin" }), "tenant-1", "canCreateExams")
      ).not.toThrow();
    });

    it("should allow teacher with required permission", () => {
      expect(() =>
        assertAutogradePermission(
          makeCaller({ role: "teacher", permissions: { canCreateExams: true } }),
          "tenant-1",
          "canCreateExams"
        )
      ).not.toThrow();
    });

    it("should deny teacher without required permission", () => {
      expect(() =>
        assertAutogradePermission(
          makeCaller({ role: "teacher", permissions: { canCreateExams: false } }),
          "tenant-1",
          "canCreateExams"
        )
      ).toThrow("Teacher lacks required permission");
    });

    it("should deny cross-tenant access", () => {
      expect(() =>
        assertAutogradePermission(
          makeCaller({ tenantId: "other-tenant" }),
          "tenant-1",
          "canCreateExams"
        )
      ).toThrow("Cross-tenant access denied");
    });

    it("should deny student role", () => {
      expect(() =>
        assertAutogradePermission(makeCaller({ role: "student" }), "tenant-1", "canCreateExams")
      ).toThrow("cannot perform this operation");
    });

    it("should allow scanner when allowScanner is true", () => {
      expect(() =>
        assertAutogradePermission(makeCaller({ role: "scanner" }), "tenant-1", undefined, {
          allowScanner: true,
        })
      ).not.toThrow();
    });

    it("should deny scanner when allowScanner is not set", () => {
      expect(() =>
        assertAutogradePermission(makeCaller({ role: "scanner" }), "tenant-1", undefined)
      ).toThrow("Scanner role is not permitted");
    });
  });
});
