/**
 * Unit tests for saveStaff callable.
 * Tests auth, validation, field updates, permission changes,
 * custom claims refresh, and audit logging.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";

// ── Mock firebase-admin ─────────────────────────────────────────────
const mockDocGet = vi.fn();
const mockDocSet = vi.fn();
const mockDocUpdate = vi.fn();
const mockCollectionDoc = vi.fn();
const mockDocRef = vi.fn();
const mockSetCustomUserClaims = vi.fn();

vi.mock("firebase-admin", () => {
  const firestoreFn = () => ({
    collection: (path: string) => ({
      doc: (id?: string) => {
        mockCollectionDoc(path, id);
        const docId = id ?? "auto-staff-id";
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
        setCustomUserClaims: mockSetCustomUserClaims,
      }),
      initializeApp: vi.fn(),
      apps: [{}],
    },
    firestore: firestoreFn,
    auth: () => ({
      setCustomUserClaims: mockSetCustomUserClaims,
    }),
    initializeApp: vi.fn(),
    apps: [{}],
  };
});

// ── Mock utils ──────────────────────────────────────────────────────
const mockAssertTenantAdminOrSuperAdmin = vi.fn();
const mockBuildClaimsForMembership = vi.fn();
const mockLogTenantAction = vi.fn();
const mockGetUser = vi.fn();

vi.mock("../../utils", () => ({
  assertTenantAdminOrSuperAdmin: (...args: unknown[]) => mockAssertTenantAdminOrSuperAdmin(...args),
  buildClaimsForMembership: (...args: unknown[]) => mockBuildClaimsForMembership(...args),
  getUser: (...args: unknown[]) => mockGetUser(...args),
  parseRequest: vi.fn((data: any) => data),
  logTenantAction: (...args: unknown[]) => mockLogTenantAction(...args),
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

import { saveStaff } from "../../callable/save-staff";

const handler = saveStaff as unknown as (request: any) => Promise<any>;

// B8: audit timestamps at rest are canonical ISO strings (were serverTimestamp sentinels).
const ISO_TIMESTAMP = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

describe("saveStaff", () => {
  const tenantId = "tenant-1";
  const callerUid = "admin-uid";
  const staffId = "staff-1";

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertTenantAdminOrSuperAdmin.mockResolvedValue(undefined);
    mockBuildClaimsForMembership.mockReturnValue({ role: "staff", tenantId });
    mockLogTenantAction.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue({ isSuperAdmin: false });
    mockSetCustomUserClaims.mockResolvedValue(undefined);
    mockDocSet.mockResolvedValue(undefined);
    mockDocUpdate.mockResolvedValue(undefined);
    // Default: staff doc exists with uid
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ uid: "staff-user-uid", department: "Admin", status: "active" }),
    });
  });

  // ── Auth ──────────────────────────────────────────────────────────

  it("throws unauthenticated when no auth", async () => {
    await expect(
      handler({ auth: null, data: { id: staffId, tenantId, data: {} } })
    ).rejects.toThrow("Must be logged in");
  });

  // ── Validation ────────────────────────────────────────────────────

  it("throws when tenantId is missing", async () => {
    await expect(
      handler({
        auth: { uid: callerUid },
        data: { id: staffId, data: {} },
      })
    ).rejects.toThrow("tenantId is required");
  });

  it("throws when id is missing (should use createOrgUser)", async () => {
    await expect(
      handler({
        auth: { uid: callerUid },
        data: { tenantId, data: {} },
      })
    ).rejects.toThrow("Staff creation should use createOrgUser");
  });

  it("throws not-found when staff doc does not exist", async () => {
    mockDocGet.mockResolvedValueOnce({ exists: false });

    await expect(
      handler({
        auth: { uid: callerUid },
        data: { id: staffId, tenantId, data: { department: "HR" } },
      })
    ).rejects.toThrow(`Staff member ${staffId} not found`);
  });

  // ── Field updates ─────────────────────────────────────────────────

  it("updates department field", async () => {
    await handler({
      auth: { uid: callerUid },
      data: { id: staffId, tenantId, data: { department: "Finance" } },
    });

    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        department: "Finance",
        updatedAt: ISO_TIMESTAMP,
      })
    );
  });

  it("updates status field", async () => {
    await handler({
      auth: { uid: callerUid },
      data: { id: staffId, tenantId, data: { status: "archived" } },
    });

    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "archived",
        updatedAt: ISO_TIMESTAMP,
      })
    );
  });

  // ── Staff permissions & claims ────────────────────────────────────

  it("updates staff permissions on membership", async () => {
    const permissions = { canManageUsers: true, canManageBilling: false };
    // First get: staff doc, second get: membership doc
    mockDocGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ uid: "staff-user-uid", department: "Admin" }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ role: "staff", tenantCode: "T001" }),
      });

    await handler({
      auth: { uid: callerUid },
      data: { id: staffId, tenantId, data: { staffPermissions: permissions } },
    });

    // Staff doc update + membership update = 2 update calls
    expect(mockDocUpdate).toHaveBeenCalledTimes(2);
    expect(mockDocUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        staffPermissions: permissions,
        updatedAt: ISO_TIMESTAMP,
      })
    );
  });

  it("refreshes custom claims when permissions change", async () => {
    const permissions = { canManageUsers: true };
    const builtClaims = { role: "staff", tenantId, permissions };
    mockBuildClaimsForMembership.mockReturnValue(builtClaims);

    mockDocGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ uid: "staff-user-uid" }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ role: "staff", tenantCode: "T001" }),
      });

    await handler({
      auth: { uid: callerUid },
      data: { id: staffId, tenantId, data: { staffPermissions: permissions } },
    });

    expect(mockSetCustomUserClaims).toHaveBeenCalledWith("staff-user-uid", builtClaims);
    expect(mockBuildClaimsForMembership).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        staffPermissions: permissions,
      }),
      { isSuperAdmin: false }
    );
  });

  // DEP-1: re-minting claims must not wipe a super-admin's isSuperAdmin claim.
  it("preserves isSuperAdmin when the target staff user is a super-admin", async () => {
    const permissions = { canManageUsers: true };
    mockGetUser.mockResolvedValue({ isSuperAdmin: true });

    mockDocGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ uid: "staff-user-uid" }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ role: "staff", tenantCode: "T001" }),
      });

    await handler({
      auth: { uid: callerUid },
      data: { id: staffId, tenantId, data: { staffPermissions: permissions } },
    });

    expect(mockGetUser).toHaveBeenCalledWith("staff-user-uid");
    expect(mockBuildClaimsForMembership).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, staffPermissions: permissions }),
      { isSuperAdmin: true }
    );
  });

  it("skips claims update if staff has no uid", async () => {
    const permissions = { canManageUsers: true };
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ department: "Admin" }), // no uid
    });

    await handler({
      auth: { uid: callerUid },
      data: { id: staffId, tenantId, data: { staffPermissions: permissions } },
    });

    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });

  // ── Audit logging ─────────────────────────────────────────────────

  it("logs tenant action after update", async () => {
    await handler({
      auth: { uid: callerUid },
      data: { id: staffId, tenantId, data: { department: "IT" } },
    });

    expect(mockLogTenantAction).toHaveBeenCalledWith(
      tenantId,
      callerUid,
      "updateStaff",
      expect.objectContaining({ staffId })
    );
  });
});
