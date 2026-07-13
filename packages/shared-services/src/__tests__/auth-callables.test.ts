/**
 * Unit tests for auth/auth-callables.ts
 * Mocks Firebase SDK httpsCallable to verify callable wrappers pass correct
 * function names and data, and propagate results / errors.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Firebase SDK
// ---------------------------------------------------------------------------

const mockCallableFn = vi.fn();

vi.mock("firebase/functions", () => ({
  httpsCallable: vi.fn(() => mockCallableFn),
}));

vi.mock("../firebase", () => ({
  getFirebaseServices: vi.fn(() => ({
    functions: { app: {}, region: "asia-south1" },
  })),
}));

import { httpsCallable } from "firebase/functions";
import {
  callSwitchActiveTenant,
  callCreateOrgUser,
  callUpdateTeacherPermissions,
  callCreateTenant,
  callBulkImportStudents,
  type CreateOrgUserRequest,
  type UpdateTeacherPermissionsRequest,
  type CreateTenantRequest,
  type BulkImportStudentsRequest,
} from "../auth/auth-callables";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockCallableSuccess<T>(data: T) {
  mockCallableFn.mockResolvedValueOnce({ data });
}

function mockCallableError(message: string, code = "internal") {
  const error = new Error(message);
  (error as any).code = `functions/${code}`;
  mockCallableFn.mockRejectedValueOnce(error);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("auth-callables", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // callSwitchActiveTenant
  // -------------------------------------------------------------------------

  describe("callSwitchActiveTenant", () => {
    it("calls the switchActiveTenant callable with the tenantId and returns success + role", async () => {
      mockCallableSuccess({ success: true, role: "teacher" });

      const result = await callSwitchActiveTenant("tenant-123");

      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "switchActiveTenant");
      expect(mockCallableFn).toHaveBeenCalledWith({ tenantId: "tenant-123" });
      expect(result).toEqual({ success: true, role: "teacher" });
    });

    it("propagates errors from the callable (e.g. invalid tenantId)", async () => {
      mockCallableError("Tenant not found", "not-found");

      await expect(callSwitchActiveTenant("bad-tenant")).rejects.toThrow("Tenant not found");
    });
  });

  // -------------------------------------------------------------------------
  // callCreateOrgUser
  // -------------------------------------------------------------------------

  describe("callCreateOrgUser", () => {
    const baseStudentReq: CreateOrgUserRequest = {
      tenantId: "tenant-1",
      role: "student",
      firstName: "John",
      lastName: "Doe",
      rollNumber: "STU-001",
    };

    it("creates a student user with required fields", async () => {
      mockCallableSuccess({ uid: "u1", entityId: "e1", membershipId: "m1" });

      const result = await callCreateOrgUser(baseStudentReq);

      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "createOrgUser");
      expect(mockCallableFn).toHaveBeenCalledWith(baseStudentReq);
      expect(result).toEqual({ uid: "u1", entityId: "e1", membershipId: "m1" });
    });

    it("creates a teacher user with subjects", async () => {
      const teacherReq: CreateOrgUserRequest = {
        tenantId: "tenant-1",
        role: "teacher",
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@school.test",
        subjects: ["math", "science"],
      };
      mockCallableSuccess({ uid: "u2", entityId: "e2", membershipId: "m2" });

      const result = await callCreateOrgUser(teacherReq);

      expect(mockCallableFn).toHaveBeenCalledWith(teacherReq);
      expect(result.uid).toBe("u2");
    });

    it("creates a parent user with linkedStudentIds", async () => {
      const parentReq: CreateOrgUserRequest = {
        tenantId: "tenant-1",
        role: "parent",
        firstName: "Bob",
        lastName: "Parent",
        phone: "+1234567890",
        linkedStudentIds: ["stu-a", "stu-b"],
      };
      mockCallableSuccess({ uid: "u3", entityId: "e3", membershipId: "m3" });

      const result = await callCreateOrgUser(parentReq);

      expect(mockCallableFn).toHaveBeenCalledWith(parentReq);
      expect(result.uid).toBe("u3");
    });

    it("creates a scanner user", async () => {
      const scannerReq: CreateOrgUserRequest = {
        tenantId: "tenant-1",
        role: "scanner",
        firstName: "Scanner",
        lastName: "Bot",
        email: "scanner@school.test",
      };
      mockCallableSuccess({ uid: "u4", entityId: "e4", membershipId: "m4" });

      const result = await callCreateOrgUser(scannerReq);

      expect(mockCallableFn).toHaveBeenCalledWith(scannerReq);
      expect(result.uid).toBe("u4");
    });

    it("creates a tenantAdmin user", async () => {
      const adminReq: CreateOrgUserRequest = {
        tenantId: "tenant-1",
        role: "tenantAdmin",
        firstName: "Admin",
        lastName: "User",
        email: "admin@school.test",
      };
      mockCallableSuccess({ uid: "u5", entityId: "e5", membershipId: "m5" });

      const result = await callCreateOrgUser(adminReq);

      expect(mockCallableFn).toHaveBeenCalledWith(adminReq);
      expect(result.uid).toBe("u5");
    });

    it("propagates server-side validation errors", async () => {
      mockCallableError("Missing required fields", "invalid-argument");

      await expect(
        callCreateOrgUser({
          tenantId: "",
          role: "student",
          firstName: "",
          lastName: "",
        })
      ).rejects.toThrow("Missing required fields");
    });
  });

  // -------------------------------------------------------------------------
  // callUpdateTeacherPermissions
  // -------------------------------------------------------------------------

  describe("callUpdateTeacherPermissions", () => {
    it("updates permissions and returns claimsRefreshed", async () => {
      const req: UpdateTeacherPermissionsRequest = {
        tenantId: "tenant-1",
        teacherUid: "teacher-uid",
        permissions: { canEditGrades: true, canManageStudents: false } as any,
      };
      mockCallableSuccess({ success: true, claimsRefreshed: true });

      const result = await callUpdateTeacherPermissions(req);

      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "updateTeacherPermissions");
      expect(mockCallableFn).toHaveBeenCalledWith(req);
      expect(result).toEqual({ success: true, claimsRefreshed: true });
    });

    it("propagates permission errors", async () => {
      const req: UpdateTeacherPermissionsRequest = {
        tenantId: "tenant-1",
        teacherUid: "teacher-uid",
        permissions: {},
      };
      mockCallableError("Permission denied", "permission-denied");

      await expect(callUpdateTeacherPermissions(req)).rejects.toThrow("Permission denied");
    });
  });

  // -------------------------------------------------------------------------
  // callCreateTenant
  // -------------------------------------------------------------------------

  describe("callCreateTenant", () => {
    it("creates a tenant with valid data and returns tenantId", async () => {
      const req: CreateTenantRequest = {
        name: "Test School",
        tenantCode: "TST001",
        contactEmail: "test@school.edu",
      };
      mockCallableSuccess({ tenantId: "new-tenant-id" });

      const result = await callCreateTenant(req);

      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "createTenant");
      expect(mockCallableFn).toHaveBeenCalledWith(req);
      expect(result.tenantId).toBe("new-tenant-id");
    });

    it("creates a tenant with all optional fields", async () => {
      const req: CreateTenantRequest = {
        name: "Full School",
        tenantCode: "FUL001",
        contactEmail: "full@school.edu",
        ownerUid: "owner-1",
        shortName: "FS",
        description: "A fully configured school",
        contactPhone: "+1234567890",
        contactPerson: "John Admin",
        subscription: { plan: "pro" } as any,
        features: { levelUpEnabled: true } as any,
      };
      mockCallableSuccess({ tenantId: "full-tenant-id" });

      const result = await callCreateTenant(req);

      expect(mockCallableFn).toHaveBeenCalledWith(req);
      expect(result.tenantId).toBe("full-tenant-id");
    });

    it("propagates duplicate tenantCode errors", async () => {
      const req: CreateTenantRequest = {
        name: "Duplicate",
        tenantCode: "DUP001",
        contactEmail: "dup@school.edu",
      };
      mockCallableError("Tenant code already exists", "already-exists");

      await expect(callCreateTenant(req)).rejects.toThrow("Tenant code already exists");
    });
  });

  // -------------------------------------------------------------------------
  // callBulkImportStudents
  // -------------------------------------------------------------------------

  describe("callBulkImportStudents", () => {
    it("imports valid CSV rows and returns summary", async () => {
      const req: BulkImportStudentsRequest = {
        tenantId: "tenant-1",
        dryRun: false,
        students: [
          { firstName: "Alice", lastName: "A", rollNumber: "R001" },
          { firstName: "Bob", lastName: "B", rollNumber: "R002" },
        ],
      };
      mockCallableSuccess({
        totalRows: 2,
        created: 2,
        skipped: 0,
        errors: [],
        credentials: [
          { rollNumber: "R001", password: "pw1" },
          { rollNumber: "R002", password: "pw2" },
        ],
      });

      const result = await callBulkImportStudents(req);

      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "bulkImportStudents");
      expect(result.totalRows).toBe(2);
      expect(result.created).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(result.credentials).toHaveLength(2);
    });

    it("returns validation errors for invalid rows", async () => {
      const req: BulkImportStudentsRequest = {
        tenantId: "tenant-1",
        dryRun: false,
        students: [
          { firstName: "Alice", lastName: "A", rollNumber: "R001" },
          { firstName: "", lastName: "", rollNumber: "" }, // invalid row
        ],
      };
      mockCallableSuccess({
        totalRows: 2,
        created: 1,
        skipped: 1,
        errors: [{ rowIndex: 1, rollNumber: "", error: "Missing required fields" }],
        credentialsUrl:
          "https://storage.googleapis.com/bucket/exports/tenant1/credentials-123.csv?...",
        credentialsExpiresAt: "2026-03-07T12:05:00.000Z",
      });

      const result = await callBulkImportStudents(req);

      expect(result.totalRows).toBe(2);
      expect(result.created).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.error).toBe("Missing required fields");
    });

    it("propagates errors when students array is empty", async () => {
      const req: BulkImportStudentsRequest = {
        tenantId: "tenant-1",
        dryRun: false,
        students: [],
      };
      mockCallableError("Students array must not be empty", "invalid-argument");

      await expect(callBulkImportStudents(req)).rejects.toThrow("Students array must not be empty");
    });

    it("handles dry run mode", async () => {
      const req: BulkImportStudentsRequest = {
        tenantId: "tenant-1",
        dryRun: true,
        students: [{ firstName: "Alice", lastName: "A", rollNumber: "R001" }],
      };
      mockCallableSuccess({
        totalRows: 1,
        created: 0,
        skipped: 0,
        errors: [],
        credentials: [],
      });

      const result = await callBulkImportStudents(req);

      expect(mockCallableFn).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }));
      expect(result.created).toBe(0);
    });
  });
});
