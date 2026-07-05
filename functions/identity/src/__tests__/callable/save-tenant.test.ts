/**
 * Unit tests for saveTenant callable.
 * Tests create/update logic, validation, auth, custom claims,
 * membership creation, and Gemini API key storage.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";

// ── Mock firebase-admin ─────────────────────────────────────────────
const mockDocGet = vi.fn();
const mockDocSet = vi.fn();
const mockDocUpdate = vi.fn();
const mockCollectionDoc = vi.fn();
const mockDocRef = vi.fn();
const mockSetCustomClaims = vi.fn();
const mockRunTransaction = vi.fn();

vi.mock("firebase-admin", () => {
  const firestoreFn: any = () => ({
    collection: (path: string) => ({
      doc: (id?: string) => {
        mockCollectionDoc(path, id);
        return {
          id: id ?? "auto-id",
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
        delete: vi.fn(),
      };
    },
    runTransaction: mockRunTransaction,
  });
  firestoreFn.FieldValue = {
    serverTimestamp: () => "SERVER_TIMESTAMP",
    increment: (n: number) => `INCREMENT(${n})`,
    arrayRemove: (...args: any[]) => ({ _type: "arrayRemove", values: args }),
  };
  firestoreFn.Timestamp = { now: () => ({ toDate: () => new Date() }) };
  const authFn = () => ({ setCustomUserClaims: mockSetCustomClaims });
  return {
    default: {
      firestore: firestoreFn,
      initializeApp: vi.fn(),
      auth: authFn,
      storage: () => ({ bucket: () => ({ file: vi.fn(), name: "test-bucket" }) }),
    },
    firestore: firestoreFn,
    auth: authFn,
    initializeApp: vi.fn(),
  };
});

// ── Mock utils ──────────────────────────────────────────────────────
const mockGetUser = vi.fn();
const mockGenerateSlug = vi.fn((name: string) => name.toLowerCase().replace(/\s+/g, "-"));
const mockAssertTenantAdminOrSuperAdmin = vi.fn();
const mockParseRequest = vi.fn((data: any, _schema: any) => data);
const mockLogTenantAction = vi.fn();
const mockWritePlatformActivity = vi.fn();

// Faithful to the converged builder for this input: flat id fields + isSuperAdmin
// present-or-absent (never false), undefined keys dropped.
const mockBuildClaimsForMembership = vi.fn((membership: any, opts?: { isSuperAdmin?: boolean }) => {
  const out: Record<string, unknown> = {
    role: membership.role,
    tenantId: membership.tenantId,
    tenantCode: membership.tenantCode,
  };
  if (opts?.isSuperAdmin) out.isSuperAdmin = true;
  return out;
});

vi.mock("../../utils", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  generateSlug: (...args: unknown[]) => mockGenerateSlug(...args),
  assertTenantAdminOrSuperAdmin: (...args: unknown[]) => mockAssertTenantAdminOrSuperAdmin(...args),
  parseRequest: (...args: unknown[]) => mockParseRequest(...args),
  logTenantAction: (...args: unknown[]) => mockLogTenantAction(...args),
  writePlatformActivity: (...args: unknown[]) => mockWritePlatformActivity(...args),
  buildClaimsForMembership: (...args: [any, any?]) => mockBuildClaimsForMembership(...args),
}));

vi.mock("../../utils/rate-limit", () => ({
  enforceRateLimit: vi.fn(),
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

// ── Mock @google-cloud/secret-manager ───────────────────────────────
const mockCreateSecret = vi.fn();
const mockAddSecretVersion = vi.fn();

vi.mock("@google-cloud/secret-manager", () => {
  class MockSecretManagerServiceClient {
    createSecret(...args: any[]) {
      return mockCreateSecret(...args);
    }
    addSecretVersion(...args: any[]) {
      return mockAddSecretVersion(...args);
    }
  }
  return { SecretManagerServiceClient: MockSecretManagerServiceClient };
});

// ── Import after mocks ─────────────────────────────────────────────
import { saveTenant } from "../../callable/save-tenant";

const handler = saveTenant as unknown as (request: any) => Promise<any>;

describe("saveTenant", () => {
  const callerUid = "admin-uid";

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ isSuperAdmin: true });
    mockAssertTenantAdminOrSuperAdmin.mockResolvedValue(undefined);
    mockSetCustomClaims.mockResolvedValue(undefined);
    mockDocSet.mockResolvedValue(undefined);
    mockDocUpdate.mockResolvedValue(undefined);
    mockLogTenantAction.mockResolvedValue(undefined);
    mockWritePlatformActivity.mockResolvedValue(undefined);
    mockCreateSecret.mockResolvedValue(undefined);
    mockAddSecretVersion.mockResolvedValue(undefined);
    // Default: transaction just runs the callback
    mockRunTransaction.mockImplementation(async (cb: any) => {
      const tx = {
        get: vi.fn().mockResolvedValue({ exists: false }),
        set: vi.fn(),
      };
      return cb(tx);
    });
  });

  // ── Auth ──────────────────────────────────────────────────────────

  it("throws unauthenticated when no auth provided", async () => {
    await expect(handler({ auth: null, data: { data: { name: "School" } } })).rejects.toThrow(
      "Must be logged in"
    );
  });

  // ── CREATE ────────────────────────────────────────────────────────

  it("throws permission-denied when non-superadmin tries to create", async () => {
    mockGetUser.mockResolvedValue({ isSuperAdmin: false });

    await expect(
      handler({
        auth: { uid: callerUid },
        data: { data: { name: "School", contactEmail: "a@b.com" } },
      })
    ).rejects.toThrow("SuperAdmin only");
  });

  it("throws when name is missing on create", async () => {
    await expect(
      handler({
        auth: { uid: callerUid },
        data: { data: { contactEmail: "a@b.com" } },
      })
    ).rejects.toThrow("name and contactEmail are required");
  });

  it("throws when contactEmail is missing on create", async () => {
    await expect(
      handler({
        auth: { uid: callerUid },
        data: { data: { name: "School" } },
      })
    ).rejects.toThrow("name and contactEmail are required");
  });

  it("generates tenantCode from name when shortName is not provided", async () => {
    const tx = {
      get: vi.fn().mockResolvedValue({ exists: false }),
      set: vi.fn(),
    };
    mockRunTransaction.mockImplementation(async (cb: any) => cb(tx));

    await handler({
      auth: { uid: callerUid },
      data: { data: { name: "Green Valley School", contactEmail: "a@b.com" } },
    });

    // tx.set is called: tenantRef (first), tenantCodeRef (second), membershipRef (third)
    const tenantDoc = tx.set.mock.calls[0][1];
    // "Green Valley School" => uppercase "GREENVALLEYSCHOOL" => strip non-alpha => slice(0,12) => "GREENVALLEYS"
    expect(tenantDoc.tenantCode).toBe("GREENVALLEYS");
  });

  it("generates tenantCode from shortName when provided", async () => {
    const tx = {
      get: vi.fn().mockResolvedValue({ exists: false }),
      set: vi.fn(),
    };
    mockRunTransaction.mockImplementation(async (cb: any) => cb(tx));

    await handler({
      auth: { uid: callerUid },
      data: { data: { name: "Green Valley School", shortName: "GVS", contactEmail: "a@b.com" } },
    });

    const tenantDoc = tx.set.mock.calls[0][1];
    expect(tenantDoc.tenantCode).toBe("GVS");
  });

  it("throws already-exists when tenantCode is a duplicate", async () => {
    mockRunTransaction.mockImplementation(async (cb: any) => {
      const tx = {
        get: vi.fn().mockResolvedValue({ exists: true }),
        set: vi.fn(),
      };
      return cb(tx);
    });

    await expect(
      handler({
        auth: { uid: callerUid },
        data: { data: { name: "School", contactEmail: "a@b.com" } },
      })
    ).rejects.toThrow("already in use");
  });

  it("creates tenant document with correct defaults", async () => {
    const tx = {
      get: vi.fn().mockResolvedValue({ exists: false }),
      set: vi.fn(),
    };
    mockRunTransaction.mockImplementation(async (cb: any) => cb(tx));

    await handler({
      auth: { uid: callerUid },
      data: { data: { name: "Demo School", contactEmail: "admin@demo.com" } },
    });

    const tenantDoc = tx.set.mock.calls[0][1];
    expect(tenantDoc.name).toBe("Demo School");
    expect(tenantDoc.contactEmail).toBe("admin@demo.com");
    expect(tenantDoc.ownerUid).toBe(callerUid);
    expect(tenantDoc.status).toBe("active");
    expect(tenantDoc.subscription.plan).toBe("trial");
    expect(tenantDoc.features.autoGradeEnabled).toBe(true);
    expect(tenantDoc.features.levelUpEnabled).toBe(true);
    expect(tenantDoc.features.scannerAppEnabled).toBe(false);
    expect(tenantDoc.settings).toEqual({ geminiKeySet: false });
    expect(tenantDoc.onboarding).toEqual({ completed: false, completedSteps: [] });
    expect(tenantDoc.usage.currentStudents).toBe(0);
    expect(tenantDoc.stats.totalStudents).toBe(0);
  });

  it("creates membership for the caller on create", async () => {
    const tx = {
      get: vi.fn().mockResolvedValue({ exists: false }),
      set: vi.fn(),
    };
    mockRunTransaction.mockImplementation(async (cb: any) => cb(tx));

    await handler({
      auth: { uid: callerUid },
      data: { data: { name: "School", contactEmail: "a@b.com" } },
    });

    // Third tx.set call is the membership
    const membershipDoc = tx.set.mock.calls[2][1];
    expect(membershipDoc.uid).toBe(callerUid);
    expect(membershipDoc.role).toBe("tenantAdmin");
    expect(membershipDoc.status).toBe("active");
    expect(membershipDoc.joinSource).toBe("admin_created");
  });

  it("sets custom claims after tenant creation", async () => {
    const tx = {
      get: vi.fn().mockResolvedValue({ exists: false }),
      set: vi.fn(),
    };
    mockRunTransaction.mockImplementation(async (cb: any) => cb(tx));

    await handler({
      auth: { uid: callerUid },
      data: { data: { name: "School", contactEmail: "a@b.com" } },
    });

    expect(mockSetCustomClaims).toHaveBeenCalledWith(
      callerUid,
      expect.objectContaining({
        role: "tenantAdmin",
        tenantId: expect.any(String),
        tenantCode: expect.any(String),
      })
    );
  });

  it("preserves isSuperAdmin in the create-branch claims (DEP-1 fix)", async () => {
    const tx = {
      get: vi.fn().mockResolvedValue({ exists: false }),
      set: vi.fn(),
    };
    mockRunTransaction.mockImplementation(async (cb: any) => cb(tx));

    await handler({
      auth: { uid: callerUid },
      data: { data: { name: "School", contactEmail: "a@b.com" } },
    });

    // Claims must be minted via the converged builder with the super-admin flag,
    // so a super-admin caller does not lose isSuperAdmin when creating a tenant.
    expect(mockBuildClaimsForMembership).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "tenantAdmin",
        tenantId: expect.any(String),
        tenantCode: expect.any(String),
      }),
      { isSuperAdmin: true }
    );
    expect(mockSetCustomClaims).toHaveBeenCalledWith(
      callerUid,
      expect.objectContaining({ isSuperAdmin: true })
    );
  });

  it("stores gemini API key when provided during creation", async () => {
    const tx = {
      get: vi.fn().mockResolvedValue({ exists: false }),
      set: vi.fn(),
    };
    mockRunTransaction.mockImplementation(async (cb: any) => cb(tx));

    await handler({
      auth: { uid: callerUid },
      data: {
        data: {
          name: "School",
          contactEmail: "a@b.com",
          geminiApiKey: "AIzaSyB1234567890",
        },
      },
    });

    expect(mockCreateSecret).toHaveBeenCalled();
    expect(mockAddSecretVersion).toHaveBeenCalled();
  });

  it("returns { id, created: true } on successful create", async () => {
    const tx = {
      get: vi.fn().mockResolvedValue({ exists: false }),
      set: vi.fn(),
    };
    mockRunTransaction.mockImplementation(async (cb: any) => cb(tx));

    const result = await handler({
      auth: { uid: callerUid },
      data: { data: { name: "School", contactEmail: "a@b.com" } },
    });

    expect(result.created).toBe(true);
    expect(result.id).toBeDefined();
  });

  // ── UPDATE ────────────────────────────────────────────────────────

  it("throws permission-denied when non-admin tries to update", async () => {
    mockAssertTenantAdminOrSuperAdmin.mockRejectedValue(
      new HttpsError("permission-denied", "Must be TenantAdmin or SuperAdmin")
    );

    await expect(
      handler({
        auth: { uid: "random-user" },
        data: { id: "tenant-1", data: { name: "Renamed" } },
      })
    ).rejects.toThrow("Must be TenantAdmin or SuperAdmin");
  });

  it("throws not-found when updating non-existing tenant", async () => {
    mockGetUser.mockResolvedValue({ isSuperAdmin: false });
    mockDocGet.mockResolvedValue({ exists: false });

    await expect(
      handler({
        auth: { uid: callerUid },
        data: { id: "missing-tenant", data: { name: "X" } },
      })
    ).rejects.toThrow("Tenant not found");
  });

  it("throws when non-superadmin tries to change status", async () => {
    mockGetUser.mockResolvedValue({ isSuperAdmin: false });
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({}) });

    await expect(
      handler({
        auth: { uid: callerUid },
        data: { id: "tenant-1", data: { status: "suspended" } },
      })
    ).rejects.toThrow("Only SuperAdmin can change tenant status");
  });

  it("throws when non-superadmin tries to change subscription", async () => {
    mockGetUser.mockResolvedValue({ isSuperAdmin: false });
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({}) });

    await expect(
      handler({
        auth: { uid: callerUid },
        data: { id: "tenant-1", data: { subscription: { plan: "pro" } } },
      })
    ).rejects.toThrow("Only SuperAdmin can change subscription settings");
  });

  it("throws when non-superadmin tries to change features", async () => {
    mockGetUser.mockResolvedValue({ isSuperAdmin: false });
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({}) });

    await expect(
      handler({
        auth: { uid: callerUid },
        data: { id: "tenant-1", data: { features: { aiChatEnabled: true } } },
      })
    ).rejects.toThrow("Only SuperAdmin can change feature flags");
  });

  it("allows superadmin to change privileged fields (status, subscription, features)", async () => {
    mockGetUser.mockResolvedValue({ isSuperAdmin: true });
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({}) });
    mockDocUpdate.mockResolvedValue(undefined);

    const result = await handler({
      auth: { uid: callerUid },
      data: {
        id: "tenant-1",
        data: {
          status: "suspended",
          subscription: { plan: "pro" },
          features: { aiChatEnabled: true },
        },
      },
    });

    expect(result).toEqual({ id: "tenant-1", created: false });

    const updateArg = mockDocUpdate.mock.calls[0][0];
    expect(updateArg.status).toBe("suspended");
    expect(updateArg["subscription.plan"]).toBe("pro");
    expect(updateArg["features.aiChatEnabled"]).toBe(true);
  });

  it("updates only defined fields using dot notation for nested objects", async () => {
    mockGetUser.mockResolvedValue({ isSuperAdmin: true });
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({}) });
    mockDocUpdate.mockResolvedValue(undefined);

    await handler({
      auth: { uid: callerUid },
      data: {
        id: "tenant-1",
        data: {
          name: "New Name",
          branding: { primaryColor: "#ff0000" },
          settings: { timezone: "Asia/Kolkata" },
        },
      },
    });

    const updateArg = mockDocUpdate.mock.calls[0][0];
    expect(updateArg.name).toBe("New Name");
    expect(updateArg["branding.primaryColor"]).toBe("#ff0000");
    expect(updateArg["settings.timezone"]).toBe("Asia/Kolkata");
    // Undefined fields should not be present
    expect(updateArg).not.toHaveProperty("contactEmail");
    expect(updateArg).not.toHaveProperty("description");
    expect(updateArg).not.toHaveProperty("logoUrl");
  });

  it("returns { id, created: false } on successful update", async () => {
    mockGetUser.mockResolvedValue({ isSuperAdmin: true });
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({}) });
    mockDocUpdate.mockResolvedValue(undefined);

    const result = await handler({
      auth: { uid: callerUid },
      data: { id: "tenant-1", data: { name: "Updated" } },
    });

    expect(result).toEqual({ id: "tenant-1", created: false });
  });

  // ── storeGeminiApiKey ─────────────────────────────────────────────

  it("rejects gemini key shorter than 10 characters", async () => {
    mockGetUser.mockResolvedValue({ isSuperAdmin: true });
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({}) });
    mockDocUpdate.mockResolvedValue(undefined);

    await expect(
      handler({
        auth: { uid: callerUid },
        data: { id: "tenant-1", data: { geminiApiKey: "short" } },
      })
    ).rejects.toThrow("Invalid API key");
  });
});
