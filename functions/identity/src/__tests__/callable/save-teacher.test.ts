/**
 * Unit tests for saveTeacher callable.
 * Tests create/update, permissions, class assignment, and membership/claims.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";

// ── Mock firebase-admin ─────────────────────────────────────────────
const mockDocGet = vi.fn();
const mockDocSet = vi.fn();
const mockDocUpdate = vi.fn();
const mockCollectionDoc = vi.fn();
const mockDocRef = vi.fn();
const mockGetUser = vi.fn();
const mockSetCustomUserClaims = vi.fn();

vi.mock("firebase-admin", () => {
  const firestoreFn = () => ({
    collection: (path: string) => ({
      doc: (id?: string) => {
        mockCollectionDoc(path, id);
        return {
          id: id ?? "auto-teacher-id",
          get: mockDocGet,
          set: mockDocSet,
          update: mockDocUpdate,
        };
      },
    }),
    doc: (path: string) => {
      mockDocRef(path);
      return {
        id: path.split("/").pop(),
        get: mockDocGet,
        set: mockDocSet,
        update: mockDocUpdate,
      };
    },
  });
  firestoreFn.FieldValue = {
    serverTimestamp: () => "SERVER_TIMESTAMP",
    increment: (n: number) => `INCREMENT(${n})`,
    arrayUnion: (...args: unknown[]) => ({ _type: "arrayUnion", values: args }),
    arrayRemove: (...args: unknown[]) => ({ _type: "arrayRemove", values: args }),
  };
  return {
    default: {
      firestore: firestoreFn,
      auth: () => ({
        getUser: mockGetUser,
        setCustomUserClaims: mockSetCustomUserClaims,
      }),
      initializeApp: vi.fn(),
      apps: [{}],
    },
    firestore: firestoreFn,
    auth: () => ({
      getUser: mockGetUser,
      setCustomUserClaims: mockSetCustomUserClaims,
    }),
    initializeApp: vi.fn(),
    apps: [{}],
  };
});

const mockAssertTenantAdminOrSuperAdmin = vi.fn();
const mockGetTenant = vi.fn();
const mockBuildClaimsForMembership = vi.fn();

vi.mock("../../utils", () => ({
  assertTenantAdminOrSuperAdmin: (...args: unknown[]) => mockAssertTenantAdminOrSuperAdmin(...args),
  getTenant: (...args: unknown[]) => mockGetTenant(...args),
  buildClaimsForMembership: (...args: unknown[]) => mockBuildClaimsForMembership(...args),
  parseRequest: vi.fn((data: any) => data),
}));

vi.mock("../../utils/rate-limit", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("firebase-functions/v2/https", () => ({
  onCall: (_opts: any, handler: any) => handler,
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "HttpsError";
    }
  },
}));

vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { saveTeacher } from "../../callable/save-teacher";

const handler = saveTeacher as unknown as (request: any) => Promise<any>;

describe("saveTeacher", () => {
  const tenantId = "tenant-1";
  const callerUid = "admin-uid";

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertTenantAdminOrSuperAdmin.mockResolvedValue(undefined);
    mockGetTenant.mockResolvedValue({ status: "active", tenantCode: "T001" });
    mockBuildClaimsForMembership.mockReturnValue({ role: "teacher", tenantId });
    mockGetUser.mockResolvedValue({ customClaims: {} });
    mockSetCustomUserClaims.mockResolvedValue(undefined);
    mockDocSet.mockResolvedValue(undefined);
    mockDocUpdate.mockResolvedValue(undefined);
  });

  // ── Auth ──────────────────────────────────────────────────────────

  it("throws unauthenticated when no auth", async () => {
    await expect(handler({ auth: null, data: { tenantId, data: {} } })).rejects.toThrow(
      "Must be logged in"
    );
  });

  // ── CREATE ────────────────────────────────────────────────────────

  it("creates teacher and returns { id, created: true }", async () => {
    const result = await handler({
      auth: { uid: callerUid },
      data: { tenantId, data: { uid: "user-t1", subjects: ["Math"] } },
    });

    expect(result.created).toBe(true);
    expect(result.id).toBeDefined();
  });

  it("throws when uid is missing on create", async () => {
    await expect(
      handler({ auth: { uid: callerUid }, data: { tenantId, data: { subjects: ["Math"] } } })
    ).rejects.toThrow("uid is required");
  });

  it("creates teacher doc with correct fields", async () => {
    await handler({
      auth: { uid: callerUid },
      data: { tenantId, data: { uid: "user-t1", subjects: ["Math"], designation: "HOD" } },
    });

    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "user-t1",
        subjects: ["Math"],
        designation: "HOD",
        status: "active",
        tenantId,
      })
    );
  });

  it("creates UserMembership with teacher role and default permissions", async () => {
    await handler({
      auth: { uid: callerUid },
      data: { tenantId, data: { uid: "user-t1" } },
    });

    // Second set call is the membership
    const membershipData = mockDocSet.mock.calls[1][0];
    expect(membershipData.role).toBe("teacher");
    expect(membershipData.permissions.permissions.canCreateExams).toBe(true);
    expect(membershipData.permissions.permissions.canViewAllExams).toBe(false);
  });

  it("merges custom permissions with defaults on create", async () => {
    await handler({
      auth: { uid: callerUid },
      data: {
        tenantId,
        data: {
          uid: "user-t1",
          permissions: { canCreateSpaces: true, canViewAnalytics: true },
        },
      },
    });

    const membershipData = mockDocSet.mock.calls[1][0];
    expect(membershipData.permissions.permissions.canCreateSpaces).toBe(true);
    expect(membershipData.permissions.permissions.canViewAnalytics).toBe(true);
    // Defaults still present
    expect(membershipData.permissions.permissions.canCreateExams).toBe(true);
  });

  // ── UPDATE ────────────────────────────────────────────────────────

  it("updates teacher and returns { id, created: false }", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ uid: "user-t1", classIds: [], status: "active" }),
    });

    const result = await handler({
      auth: { uid: callerUid },
      data: { id: "tch-1", tenantId, data: { subjects: ["Physics"] } },
    });

    expect(result).toEqual({ id: "tch-1", created: false });
  });

  it("throws not-found when updating non-existing teacher", async () => {
    mockDocGet.mockResolvedValue({ exists: false });

    await expect(
      handler({ auth: { uid: callerUid }, data: { id: "missing", tenantId, data: {} } })
    ).rejects.toThrow("Teacher not found");
  });

  it("handles classIds reassignment on update", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ uid: "user-t1", classIds: ["c1"], status: "active" }),
    });

    await handler({
      auth: { uid: callerUid },
      data: { id: "tch-1", tenantId, data: { classIds: ["c2"] } },
    });

    // Updates: add to c2, remove from c1, then teacher update = 3
    expect(mockDocUpdate).toHaveBeenCalledTimes(3);
  });

  it("updates permissions on membership when permissions provided", async () => {
    // First get: teacher doc, second get: membership doc
    mockDocGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ uid: "user-t1", classIds: [], status: "active" }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          role: "teacher",
          permissions: { canCreateExams: true, managedClassIds: [] },
        }),
      });

    await handler({
      auth: { uid: callerUid },
      data: { id: "tch-1", tenantId, data: { permissions: { canCreateSpaces: true } } },
    });

    // Teacher update + membership permissions update = 2 update calls
    expect(mockDocUpdate).toHaveBeenCalledTimes(2);
  });
});
