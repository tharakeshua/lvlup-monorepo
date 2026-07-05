/**
 * Unit tests for bulkUpdateStatus callable.
 * Tests auth, entity type routing, batch processing, stats, and audit logging.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";

// ── Mock firebase-admin ─────────────────────────────────────────────
const mockBatchUpdate = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
const mockDocRef = vi.fn();

const stableDb: any = {
  doc: vi.fn((path: string) => {
    mockDocRef(path);
    return { id: path.split("/").pop(), path };
  }),
  batch: vi.fn(() => ({
    update: mockBatchUpdate,
    commit: mockBatchCommit,
  })),
};

vi.mock("firebase-admin", () => {
  const firestoreFn: any = () => stableDb;
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
const mockParseRequest = vi.fn();
const mockLogTenantAction = vi.fn();

vi.mock("../../utils", () => ({
  assertTenantAdminOrSuperAdmin: (...args: unknown[]) => mockAssertTenantAdminOrSuperAdmin(...args),
  parseRequest: (...args: unknown[]) => mockParseRequest(...args),
  logTenantAction: (...args: unknown[]) => mockLogTenantAction(...args),
}));

const mockEnforceRateLimit = vi.fn();
vi.mock("../../utils/rate-limit", () => ({
  enforceRateLimit: (...args: unknown[]) => mockEnforceRateLimit(...args),
}));

import { bulkUpdateStatus } from "../../callable/bulk-update-status";

const handler = bulkUpdateStatus as unknown as (request: any) => Promise<any>;

// ── Helpers ─────────────────────────────────────────────────────────

function makeRequest(data: Record<string, unknown>, auth?: { uid: string } | null) {
  return {
    data,
    auth: auth === null ? undefined : (auth ?? { uid: "admin-uid" }),
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("bulkUpdateStatus", () => {
  const tenantId = "tenant-1";
  const callerUid = "admin-uid";

  beforeEach(() => {
    vi.clearAllMocks();

    mockParseRequest.mockImplementation((data: any) => data);
    mockAssertTenantAdminOrSuperAdmin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue(undefined);
    mockLogTenantAction.mockResolvedValue(undefined);
    mockBatchCommit.mockResolvedValue(undefined);
  });

  // ── Auth ──────────────────────────────────────────────────────────

  it("throws unauthenticated when no auth provided", async () => {
    await expect(
      handler(
        makeRequest(
          { tenantId, entityType: "student", entityIds: ["s1"], newStatus: "archived" },
          null
        )
      )
    ).rejects.toThrow("Must be logged in");
  });

  it("throws when caller is not admin", async () => {
    mockAssertTenantAdminOrSuperAdmin.mockRejectedValue(
      new HttpsError("permission-denied", "Must be TenantAdmin or SuperAdmin")
    );

    await expect(
      handler(
        makeRequest({
          tenantId,
          entityType: "student",
          entityIds: ["s1"],
          newStatus: "archived",
        })
      )
    ).rejects.toThrow("Must be TenantAdmin or SuperAdmin");
  });

  // ── Entity type routing ───────────────────────────────────────────

  it("updates students in the correct collection path", async () => {
    const result = await handler(
      makeRequest({
        tenantId,
        entityType: "student",
        entityIds: ["s1", "s2"],
        newStatus: "archived",
      })
    );

    expect(result).toEqual({ success: true, updated: 2 });
    expect(stableDb.doc).toHaveBeenCalledWith(`tenants/${tenantId}/students/s1`);
    expect(stableDb.doc).toHaveBeenCalledWith(`tenants/${tenantId}/students/s2`);
  });

  it("updates teachers in the correct collection path", async () => {
    await handler(
      makeRequest({
        tenantId,
        entityType: "teacher",
        entityIds: ["t1"],
        newStatus: "active",
      })
    );

    expect(stableDb.doc).toHaveBeenCalledWith(`tenants/${tenantId}/teachers/t1`);
  });

  it("updates classes in the correct collection path", async () => {
    await handler(
      makeRequest({
        tenantId,
        entityType: "class",
        entityIds: ["c1"],
        newStatus: "archived",
      })
    );

    expect(stableDb.doc).toHaveBeenCalledWith(`tenants/${tenantId}/classes/c1`);
  });

  // ── Batch processing ──────────────────────────────────────────────

  it("batches large updates in chunks of 450", async () => {
    const entityIds = Array.from({ length: 500 }, (_, i) => `entity-${i}`);

    const result = await handler(
      makeRequest({
        tenantId,
        entityType: "student",
        entityIds,
        newStatus: "archived",
      })
    );

    expect(result).toEqual({ success: true, updated: 500 });
    // Should create 2 batches: 450 + 50
    expect(stableDb.batch).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalledTimes(2);
  });

  // ── Return value ──────────────────────────────────────────────────

  it("returns correct updated count", async () => {
    const result = await handler(
      makeRequest({
        tenantId,
        entityType: "teacher",
        entityIds: ["t1", "t2", "t3"],
        newStatus: "active",
      })
    );

    expect(result).toEqual({ success: true, updated: 3 });
  });

  // ── Audit logging ─────────────────────────────────────────────────

  it("logs tenant action with entity details", async () => {
    await handler(
      makeRequest({
        tenantId,
        entityType: "student",
        entityIds: ["s1", "s2"],
        newStatus: "archived",
      })
    );

    expect(mockLogTenantAction).toHaveBeenCalledWith(
      tenantId,
      callerUid,
      "bulkUpdateStatus",
      expect.objectContaining({
        entityType: "student",
        count: 2,
        newStatus: "archived",
      })
    );
  });

  // ── Update fields ─────────────────────────────────────────────────

  it("sets status and updatedAt on each entity", async () => {
    await handler(
      makeRequest({
        tenantId,
        entityType: "student",
        entityIds: ["s1"],
        newStatus: "archived",
      })
    );

    expect(mockBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "s1" }),
      expect.objectContaining({
        status: "archived",
        updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      })
    );
  });
});
