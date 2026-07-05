/**
 * Unit tests for saveClass callable.
 * Tests create/update/soft-delete logic, validation, auth, and stats updates.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";

// ── Mock firebase-admin ─────────────────────────────────────────────
const mockDocGet = vi.fn();
const mockDocSet = vi.fn();
const mockDocUpdate = vi.fn();
const mockCollectionDoc = vi.fn();
const mockDocRef = vi.fn();

vi.mock("firebase-admin", () => {
  const firestoreFn = () => ({
    collection: (path: string) => ({
      doc: (id?: string) => {
        mockCollectionDoc(path, id);
        const docId = id ?? "auto-generated-id";
        return {
          id: docId,
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
  };
  return {
    default: {
      firestore: firestoreFn,
      initializeApp: vi.fn(),
      apps: [{}],
    },
    firestore: firestoreFn,
    initializeApp: vi.fn(),
    apps: [{}],
  };
});

// The handler imports FieldValue from the `firebase-admin/firestore` subpath,
// so stub it there (the top-level `firebase-admin` FieldValue never applies).
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => "SERVER_TIMESTAMP",
    increment: (n: number) => `INCREMENT(${n})`,
  },
}));

// ── Mock utils ──────────────────────────────────────────────────────
const mockAssertTenantAdminOrSuperAdmin = vi.fn();
const mockGetTenant = vi.fn();

vi.mock("../../utils", () => ({
  assertTenantAdminOrSuperAdmin: (...args: unknown[]) => mockAssertTenantAdminOrSuperAdmin(...args),
  getTenant: (...args: unknown[]) => mockGetTenant(...args),
  parseRequest: vi.fn((data: any) => data),
}));

vi.mock("../../utils/rate-limit", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock firebase-functions ─────────────────────────────────────────
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

import { saveClass } from "../../callable/save-class";

// saveClass is the unwrapped handler due to our onCall mock
const handler = saveClass as unknown as (request: any) => Promise<any>;

describe("saveClass", () => {
  const tenantId = "tenant-1";
  const callerUid = "admin-uid";

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertTenantAdminOrSuperAdmin.mockResolvedValue(undefined);
    mockGetTenant.mockResolvedValue({ status: "active", tenantCode: "T001" });
  });

  // ── Auth ──────────────────────────────────────────────────────────

  it("throws unauthenticated when no auth provided", async () => {
    await expect(handler({ auth: null, data: { tenantId, data: {} } })).rejects.toThrow(
      "Must be logged in"
    );
  });

  it("calls assertTenantAdminOrSuperAdmin with caller uid and tenantId", async () => {
    mockDocSet.mockResolvedValue(undefined);
    mockDocUpdate.mockResolvedValue(undefined);

    await handler({
      auth: { uid: callerUid },
      data: { tenantId, data: { name: "Class A", grade: "10" } },
    });

    expect(mockAssertTenantAdminOrSuperAdmin).toHaveBeenCalledWith(callerUid, tenantId);
  });

  it("rejects when caller is not admin", async () => {
    mockAssertTenantAdminOrSuperAdmin.mockRejectedValue(
      new HttpsError("permission-denied", "Must be TenantAdmin or SuperAdmin")
    );

    await expect(
      handler({ auth: { uid: "random" }, data: { tenantId, data: { name: "X", grade: "1" } } })
    ).rejects.toThrow("Must be TenantAdmin or SuperAdmin");
  });

  // ── CREATE ────────────────────────────────────────────────────────

  it("creates a class and returns { id, created: true }", async () => {
    mockDocSet.mockResolvedValue(undefined);
    mockDocUpdate.mockResolvedValue(undefined);

    const result = await handler({
      auth: { uid: callerUid },
      data: { tenantId, data: { name: "Grade 10-A", grade: "10", section: "A" } },
    });

    expect(result.created).toBe(true);
    expect(result.id).toBeDefined();
    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Grade 10-A",
        grade: "10",
        section: "A",
        tenantId,
        status: "active",
        studentIds: [],
        studentCount: 0,
      })
    );
  });

  it("throws when name is missing on create", async () => {
    await expect(
      handler({ auth: { uid: callerUid }, data: { tenantId, data: { grade: "10" } } })
    ).rejects.toThrow("Name and grade are required");
  });

  it("throws when grade is missing on create", async () => {
    await expect(
      handler({ auth: { uid: callerUid }, data: { tenantId, data: { name: "Class A" } } })
    ).rejects.toThrow("Name and grade are required");
  });

  it("throws when tenant is inactive on create", async () => {
    mockGetTenant.mockResolvedValue({ status: "suspended" });

    await expect(
      handler({ auth: { uid: callerUid }, data: { tenantId, data: { name: "C", grade: "1" } } })
    ).rejects.toThrow("Tenant not found or inactive");
  });

  it("increments tenant stats.totalClasses on create", async () => {
    mockDocSet.mockResolvedValue(undefined);
    mockDocUpdate.mockResolvedValue(undefined);

    await handler({
      auth: { uid: callerUid },
      data: { tenantId, data: { name: "New", grade: "5" } },
    });

    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        "stats.totalClasses": "INCREMENT(1)",
      })
    );
  });

  it("defaults optional fields to null/empty on create", async () => {
    mockDocSet.mockResolvedValue(undefined);
    mockDocUpdate.mockResolvedValue(undefined);

    await handler({
      auth: { uid: callerUid },
      data: { tenantId, data: { name: "C", grade: "1" } },
    });

    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        section: null,
        academicSessionId: null,
        teacherIds: [],
      })
    );
  });

  // ── UPDATE ────────────────────────────────────────────────────────

  it("updates a class and returns { id, created: false }", async () => {
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({ status: "active" }) });
    mockDocUpdate.mockResolvedValue(undefined);

    const result = await handler({
      auth: { uid: callerUid },
      data: { id: "class-1", tenantId, data: { name: "Renamed" } },
    });

    expect(result).toEqual({ id: "class-1", created: false });
  });

  it("throws not-found when updating non-existing class", async () => {
    mockDocGet.mockResolvedValue({ exists: false });

    await expect(
      handler({ auth: { uid: callerUid }, data: { id: "missing", tenantId, data: { name: "X" } } })
    ).rejects.toThrow("Class not found");
  });

  it("only includes defined fields in updates", async () => {
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({ status: "active" }) });
    mockDocUpdate.mockResolvedValue(undefined);

    await handler({
      auth: { uid: callerUid },
      data: { id: "class-1", tenantId, data: { name: "New Name" } },
    });

    const updateArg = mockDocUpdate.mock.calls[0][0];
    expect(updateArg.name).toBe("New Name");
    expect(updateArg).not.toHaveProperty("grade");
    expect(updateArg).not.toHaveProperty("section");
  });

  // ── SOFT DELETE ───────────────────────────────────────────────────

  it("decrements stats.totalClasses on soft-delete", async () => {
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({ status: "active" }) });
    mockDocUpdate.mockResolvedValue(undefined);

    await handler({
      auth: { uid: callerUid },
      data: { id: "class-1", tenantId, data: { status: "deleted" } },
    });

    // First call is class update, second is tenant stats
    expect(mockDocUpdate).toHaveBeenCalledTimes(2);
    expect(mockDocUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        "stats.totalClasses": "INCREMENT(-1)",
      })
    );
  });

  it("does not decrement stats if class was already deleted", async () => {
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({ status: "deleted" }) });
    mockDocUpdate.mockResolvedValue(undefined);

    await handler({
      auth: { uid: callerUid },
      data: { id: "class-1", tenantId, data: { status: "deleted" } },
    });

    // Only the class update, no stats update
    expect(mockDocUpdate).toHaveBeenCalledTimes(1);
  });
});
