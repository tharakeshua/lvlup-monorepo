/**
 * Unit tests for bulkImportTeachers callable.
 * Tests auth, validation, dry-run, batch processing, error handling,
 * stats updates, audit logging, notifications, and credentials upload.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";

// ── Mock firebase-admin ─────────────────────────────────────────────
const mockDocGet = vi.fn();
const mockDocSet = vi.fn();
const mockDocUpdate = vi.fn();
const mockCollectionDoc = vi.fn();
const mockDocRef = vi.fn();
const mockCreateUser = vi.fn();
const mockGetUserByEmail = vi.fn();
const mockSetCustomUserClaims = vi.fn();
const mockFileSave = vi.fn().mockResolvedValue(undefined);
const mockGetSignedUrl = vi.fn().mockResolvedValue(["https://storage.example.com/creds.csv"]);
const mockFile = vi.fn(() => ({
  save: mockFileSave,
  getSignedUrl: mockGetSignedUrl,
}));
const mockBucket = vi.fn(() => ({ file: mockFile }));

vi.mock("firebase-admin", () => {
  const firestoreFn: any = () => ({
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
      auth: () => ({
        createUser: mockCreateUser,
        getUserByEmail: mockGetUserByEmail,
        setCustomUserClaims: mockSetCustomUserClaims,
      }),
      storage: () => ({ bucket: mockBucket }),
      initializeApp: vi.fn(),
      apps: [{}],
    },
    firestore: firestoreFn,
    auth: () => ({
      createUser: mockCreateUser,
      getUserByEmail: mockGetUserByEmail,
      setCustomUserClaims: mockSetCustomUserClaims,
    }),
    storage: () => ({ bucket: mockBucket }),
    initializeApp: vi.fn(),
    apps: [{}],
  };
});

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

// ── Mock utils ──────────────────────────────────────────────────────
const mockAssertTenantAdminOrSuperAdmin = vi.fn();
const mockGetTenant = vi.fn();
const mockGenerateTempPassword = vi.fn();
const mockBuildClaimsForMembership = vi.fn();
const mockUpdateTenantStats = vi.fn();
const mockParseRequest = vi.fn();
const mockAssertQuota = vi.fn();
const mockAssertFeatureEnabled = vi.fn();
const mockLogTenantAction = vi.fn();
const mockWritePlatformActivity = vi.fn();

vi.mock("../../utils", () => ({
  assertTenantAdminOrSuperAdmin: (...args: unknown[]) => mockAssertTenantAdminOrSuperAdmin(...args),
  getTenant: (...args: unknown[]) => mockGetTenant(...args),
  generateTempPassword: (...args: unknown[]) => mockGenerateTempPassword(...args),
  buildClaimsForMembership: (...args: unknown[]) => mockBuildClaimsForMembership(...args),
  updateTenantStats: (...args: unknown[]) => mockUpdateTenantStats(...args),
  parseRequest: (...args: unknown[]) => mockParseRequest(...args),
  assertQuota: (...args: unknown[]) => mockAssertQuota(...args),
  assertFeatureEnabled: (...args: unknown[]) => mockAssertFeatureEnabled(...args),
  logTenantAction: (...args: unknown[]) => mockLogTenantAction(...args),
  writePlatformActivity: (...args: unknown[]) => mockWritePlatformActivity(...args),
}));

const mockEnforceRateLimit = vi.fn();
vi.mock("../../utils/rate-limit", () => ({
  enforceRateLimit: (...args: unknown[]) => mockEnforceRateLimit(...args),
}));

// ── Mock notification sender ────────────────────────────────────────
const mockSendNotification = vi.fn().mockResolvedValue(undefined);
vi.mock("../../notifications/notification-sender", () => ({
  sendNotification: (...args: unknown[]) => mockSendNotification(...args),
}));

import { bulkImportTeachers } from "../../callable/bulk-import-teachers";

const handler = bulkImportTeachers as unknown as (request: any) => Promise<any>;

// ── Helpers ─────────────────────────────────────────────────────────

function makeTeacher(
  overrides: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    subjects: string;
    designation: string;
  }> = {}
) {
  return {
    firstName: "John",
    lastName: "Doe",
    email: `teacher-${Math.random().toString(36).slice(2, 8)}@test.com`,
    ...overrides,
  };
}

function makeRequest(data: Record<string, unknown>, auth?: { uid: string } | null) {
  return {
    data,
    auth: auth === null ? undefined : (auth ?? { uid: "admin-uid" }),
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("bulkImportTeachers", () => {
  const tenantId = "tenant-1";
  const callerUid = "admin-uid";

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock behaviors
    mockParseRequest.mockImplementation((data: any) => data);
    mockAssertTenantAdminOrSuperAdmin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue(undefined);
    mockAssertFeatureEnabled.mockResolvedValue(undefined);
    mockGetTenant.mockResolvedValue({ status: "active", tenantCode: "T001" });
    mockAssertQuota.mockResolvedValue(undefined);
    mockGenerateTempPassword.mockReturnValue("TempPass1");
    mockBuildClaimsForMembership.mockReturnValue({ role: "teacher", tenantId });
    mockLogTenantAction.mockResolvedValue(undefined);
    mockWritePlatformActivity.mockResolvedValue(undefined);
    mockDocSet.mockResolvedValue(undefined);
    mockDocUpdate.mockResolvedValue(undefined);
    mockSetCustomUserClaims.mockResolvedValue(undefined);
    mockCreateUser.mockResolvedValue({ uid: "new-user-uid" });
  });

  // ── Auth ──────────────────────────────────────────────────────────

  it("throws unauthenticated when no auth provided", async () => {
    mockParseRequest.mockImplementation((data: any) => data);
    // The handler reads request.auth?.uid which will be undefined
    // assertTenantAdminOrSuperAdmin will receive undefined callerUid
    mockAssertTenantAdminOrSuperAdmin.mockRejectedValue(
      new HttpsError("unauthenticated", "Must be logged in")
    );

    await expect(
      handler(makeRequest({ tenantId, teachers: [makeTeacher()], dryRun: false }, null))
    ).rejects.toThrow();
  });

  it("throws when caller is not admin (assertTenantAdminOrSuperAdmin rejects)", async () => {
    mockAssertTenantAdminOrSuperAdmin.mockRejectedValue(
      new HttpsError("permission-denied", "Must be TenantAdmin or SuperAdmin")
    );

    await expect(
      handler(makeRequest({ tenantId, teachers: [makeTeacher()], dryRun: false }))
    ).rejects.toThrow("Must be TenantAdmin or SuperAdmin");
  });

  // ── Tenant validation ─────────────────────────────────────────────

  it("throws when tenant is not found", async () => {
    mockGetTenant.mockResolvedValue(null);

    await expect(
      handler(makeRequest({ tenantId, teachers: [makeTeacher()], dryRun: false }))
    ).rejects.toThrow("Tenant not found or inactive");
  });

  it("throws when tenant status is not active", async () => {
    mockGetTenant.mockResolvedValue({ status: "suspended", tenantCode: "T001" });

    await expect(
      handler(makeRequest({ tenantId, teachers: [makeTeacher()], dryRun: false }))
    ).rejects.toThrow("Tenant not found or inactive");
  });

  // ── Row limit ─────────────────────────────────────────────────────

  it("throws when more than 200 teachers are provided", async () => {
    const teachers = Array.from({ length: 201 }, (_, i) =>
      makeTeacher({ email: `t${i}@test.com` })
    );

    await expect(handler(makeRequest({ tenantId, teachers, dryRun: false }))).rejects.toThrow(
      "Maximum 200 rows per import"
    );
  });

  // ── Dry run ───────────────────────────────────────────────────────

  it("dry run returns validation results without creating anything", async () => {
    const teachers = [
      makeTeacher({ email: "alice@test.com" }),
      makeTeacher({ firstName: "", lastName: "", email: "bad@test.com" }),
    ];

    const result = await handler(makeRequest({ tenantId, teachers, dryRun: true }));

    expect(result.totalRows).toBe(2);
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(1);
    // Should NOT call createUser in dry run
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  // ── Validation errors ─────────────────────────────────────────────

  it("flags duplicate email in batch as error", async () => {
    const teachers = [
      makeTeacher({ email: "dup@test.com" }),
      makeTeacher({ email: "dup@test.com" }),
    ];

    const result = await handler(makeRequest({ tenantId, teachers, dryRun: true }));

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain("Duplicate email in batch");
    expect(result.errors[0].rowIndex).toBe(1);
  });

  it("flags missing firstName/lastName as error", async () => {
    const teachers = [makeTeacher({ firstName: "", lastName: "" })];

    const result = await handler(makeRequest({ tenantId, teachers, dryRun: true }));

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain("firstName and lastName required");
  });

  it("flags missing email as error", async () => {
    const teachers = [{ firstName: "John", lastName: "Doe", email: "" }];

    const result = await handler(makeRequest({ tenantId, teachers, dryRun: true }));

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain("email required");
  });

  // ── Happy path: single teacher created ────────────────────────────

  it("creates a single teacher successfully", async () => {
    const teacher = makeTeacher({
      email: "alice@school.com",
      firstName: "Alice",
      lastName: "Smith",
    });
    mockCreateUser.mockResolvedValue({ uid: "user-alice" });

    const result = await handler(makeRequest({ tenantId, teachers: [teacher], dryRun: false }));

    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "alice@school.com",
        displayName: "Alice Smith",
      })
    );
    // Teacher doc set
    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: "Alice",
        lastName: "Smith",
        email: "alice@school.com",
        tenantId,
        status: "active",
      })
    );
  });

  // ── auth/email-already-exists fallback ────────────────────────────

  it("falls back to getUserByEmail when auth/email-already-exists", async () => {
    const teacher = makeTeacher({ email: "existing@school.com" });
    mockCreateUser.mockRejectedValue({ code: "auth/email-already-exists" });
    mockGetUserByEmail.mockResolvedValue({ uid: "existing-uid" });

    const result = await handler(makeRequest({ tenantId, teachers: [teacher], dryRun: false }));

    expect(result.created).toBe(1);
    expect(mockGetUserByEmail).toHaveBeenCalledWith("existing@school.com");
    // Should still set teacher doc and membership
    expect(mockDocSet).toHaveBeenCalled();
  });

  // ── Batch processing ──────────────────────────────────────────────

  it("processes teachers in batches of 50", async () => {
    const teachers = Array.from({ length: 75 }, (_, i) =>
      makeTeacher({ email: `teacher${i}@test.com`, firstName: `T${i}`, lastName: "Test" })
    );
    mockCreateUser.mockResolvedValue({ uid: "batch-uid" });

    const result = await handler(makeRequest({ tenantId, teachers, dryRun: false }));

    expect(result.created).toBe(75);
    // createUser should be called 75 times (once per teacher)
    expect(mockCreateUser).toHaveBeenCalledTimes(75);
  });

  // ── Tenant stats ──────────────────────────────────────────────────

  it("updates tenant stats with increment on created count", async () => {
    const teachers = [makeTeacher({ email: "a@test.com" }), makeTeacher({ email: "b@test.com" })];
    mockCreateUser.mockResolvedValue({ uid: "uid-1" });

    await handler(makeRequest({ tenantId, teachers, dryRun: false }));

    // Should update tenant doc with increment. The handler imports FieldValue
    // from 'firebase-admin/firestore' (not the mocked 'firebase-admin' module),
    // so increment yields a real NumericIncrementTransform{ operand: 2 }.
    // updatedAt is now a canonical ISO string (B8), not a serverTimestamp.
    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        "stats.totalTeachers": expect.objectContaining({ operand: 2 }),
        updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      })
    );
  });

  // ── Audit logging ─────────────────────────────────────────────────

  it("logs tenant action after import", async () => {
    const teachers = [makeTeacher({ email: "log@test.com" })];
    mockCreateUser.mockResolvedValue({ uid: "log-uid" });

    await handler(makeRequest({ tenantId, teachers, dryRun: false }));

    expect(mockLogTenantAction).toHaveBeenCalledWith(
      tenantId,
      callerUid,
      "bulkImportTeachers",
      expect.objectContaining({
        totalRows: 1,
        created: 1,
      })
    );
  });

  // ── Platform activity ─────────────────────────────────────────────

  it("writes platform activity after import", async () => {
    const teachers = [makeTeacher({ email: "pa@test.com" })];
    mockCreateUser.mockResolvedValue({ uid: "pa-uid" });

    await handler(makeRequest({ tenantId, teachers, dryRun: false }));

    expect(mockWritePlatformActivity).toHaveBeenCalledWith(
      "users_bulk_imported",
      callerUid,
      expect.objectContaining({
        entityType: "teacher",
      }),
      tenantId
    );
  });

  // ── Notification ──────────────────────────────────────────────────

  it("sends notification to the admin after import", async () => {
    const teachers = [makeTeacher({ email: "notif@test.com" })];
    mockCreateUser.mockResolvedValue({ uid: "notif-uid" });

    await handler(makeRequest({ tenantId, teachers, dryRun: false }));

    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        recipientId: callerUid,
        type: "bulk_import_complete",
      })
    );
  });

  // ── Credentials CSV upload ────────────────────────────────────────

  it("uploads credentials CSV and returns signed URL", async () => {
    const teachers = [makeTeacher({ email: "cred@test.com" })];
    mockCreateUser.mockResolvedValue({ uid: "cred-uid" });

    const result = await handler(makeRequest({ tenantId, teachers, dryRun: false }));

    expect(mockFileSave).toHaveBeenCalledWith(
      expect.stringContaining("email,password"),
      expect.objectContaining({ contentType: "text/csv" })
    );
    expect(mockGetSignedUrl).toHaveBeenCalledWith(expect.objectContaining({ action: "read" }));
    expect(result.credentialsUrl).toBe("https://storage.example.com/creds.csv");
    expect(result.credentialsExpiresAt).toBeDefined();
  });
});
