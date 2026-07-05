/**
 * Unit tests for callable/reactivate-tenant.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Stable mocks ────────────────────────────────────────────────────────────
const mockGet = vi.fn();
const mockUpdate = vi.fn();
const mockBatchUpdate = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);

const stableDb: any = {
  doc: vi.fn(() => ({ get: mockGet, update: mockUpdate })),
  collection: vi.fn(() => ({
    where: vi.fn().mockReturnThis(),
    get: mockGet,
  })),
  batch: vi.fn(() => ({
    update: mockBatchUpdate,
    commit: mockBatchCommit,
  })),
};

vi.mock("firebase-admin", () => {
  const fsFn: any = () => stableDb;
  fsFn.FieldValue = {
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
    increment: vi.fn((n: number) => `INCREMENT(${n})`),
  };
  return {
    default: { firestore: fsFn, initializeApp: vi.fn() },
    firestore: fsFn,
    initializeApp: vi.fn(),
  };
});

vi.mock("firebase-functions/v2/https", () => ({
  onCall: vi.fn((_opts: any, handler: any) => handler),
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockGetUser = vi.fn();
const mockLogTenantAction = vi.fn().mockResolvedValue(undefined);

vi.mock("../../utils", () => ({
  getUser: (...args: any[]) => mockGetUser(...args),
  parseRequest: vi.fn((data: any) => data),
  logTenantAction: (...args: any[]) => mockLogTenantAction(...args),
  writePlatformActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../utils/rate-limit", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
}));

import { reactivateTenant } from "../../callable/reactivate-tenant";

const handler = reactivateTenant as any;

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(data: Record<string, unknown>, auth?: { uid: string } | null) {
  return {
    data,
    auth: auth === null ? undefined : (auth ?? { uid: "superadmin-1" }),
    rawRequest: {} as any,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("reactivateTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ───────────────────── Auth / Permission ─────────────────────

  it("rejects unauthenticated request", async () => {
    await expect(handler(makeRequest({ tenantId: "tenant-1" }, null))).rejects.toThrow(
      "Must be logged in"
    );
  });

  it("rejects non-SuperAdmin user", async () => {
    mockGetUser.mockResolvedValueOnce({ isSuperAdmin: false });

    await expect(handler(makeRequest({ tenantId: "tenant-1" }))).rejects.toThrow("SuperAdmin only");
  });

  it("rejects when getUser returns null", async () => {
    mockGetUser.mockResolvedValueOnce(null);

    await expect(handler(makeRequest({ tenantId: "tenant-1" }))).rejects.toThrow("SuperAdmin only");
  });

  // ───────────────────── Tenant validation ─────────────────────

  it("rejects when tenant not found", async () => {
    mockGetUser.mockResolvedValueOnce({ isSuperAdmin: true });
    mockGet.mockResolvedValueOnce({ exists: false });

    await expect(handler(makeRequest({ tenantId: "nonexistent" }))).rejects.toThrow(
      "Tenant not found"
    );
  });

  it("rejects when tenant is not deactivated", async () => {
    mockGetUser.mockResolvedValueOnce({ isSuperAdmin: true });
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: "active", name: "Test School" }),
    });

    await expect(handler(makeRequest({ tenantId: "tenant-1" }))).rejects.toThrow(
      "Tenant is not deactivated"
    );
  });

  it("rejects when tenant status is suspended (not deactivated)", async () => {
    mockGetUser.mockResolvedValueOnce({ isSuperAdmin: true });
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: "suspended" }),
    });

    await expect(handler(makeRequest({ tenantId: "tenant-1" }))).rejects.toThrow(
      "Tenant is not deactivated"
    );
  });

  // ───────────────────── Successful reactivation ─────────────────────

  it("restores tenant to previousStatus from deactivation record", async () => {
    mockGetUser.mockResolvedValueOnce({ isSuperAdmin: true });

    // Tenant doc: deactivated with previousStatus = 'trial'
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: "deactivated",
        name: "Test School",
        deactivation: { previousStatus: "trial", reason: "Non-payment" },
      }),
    });

    // No suspended memberships
    mockGet.mockResolvedValueOnce({ docs: [], size: 0 });

    const result = await handler(makeRequest({ tenantId: "tenant-1" }));

    expect(result).toEqual({ success: true, membershipsReactivated: 0 });

    // Should update tenant with restored status
    // B8: audit timestamps are canonical ISO strings (was serverTimestamp sentinel).
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "trial",
        "deactivation.reactivatedAt": expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
        ),
        "deactivation.reactivatedBy": "superadmin-1",
        updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        updatedBy: "superadmin-1",
      })
    );
  });

  it('defaults to "active" when no previousStatus in deactivation record', async () => {
    mockGetUser.mockResolvedValueOnce({ isSuperAdmin: true });

    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: "deactivated",
        deactivation: {}, // no previousStatus
      }),
    });

    // No memberships
    mockGet.mockResolvedValueOnce({ docs: [], size: 0 });

    await handler(makeRequest({ tenantId: "tenant-1" }));

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "active" }));
  });

  it('defaults to "active" when deactivation field is undefined', async () => {
    mockGetUser.mockResolvedValueOnce({ isSuperAdmin: true });

    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: "deactivated",
        // no deactivation field at all
      }),
    });

    mockGet.mockResolvedValueOnce({ docs: [], size: 0 });

    await handler(makeRequest({ tenantId: "tenant-1" }));

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "active" }));
  });

  // ───────────────────── Membership reactivation ─────────────────────

  it("reactivates suspended memberships", async () => {
    mockGetUser.mockResolvedValueOnce({ isSuperAdmin: true });

    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: "deactivated",
        deactivation: { previousStatus: "active" },
      }),
    });

    const membershipDocs = [
      { id: "mem-1", ref: { path: "userMemberships/mem-1" } },
      { id: "mem-2", ref: { path: "userMemberships/mem-2" } },
      { id: "mem-3", ref: { path: "userMemberships/mem-3" } },
    ];
    mockGet.mockResolvedValueOnce({ docs: membershipDocs, size: 3 });

    const result = await handler(makeRequest({ tenantId: "tenant-1" }));

    expect(result).toEqual({ success: true, membershipsReactivated: 3 });

    // batch.update called for each membership
    expect(mockBatchUpdate).toHaveBeenCalledTimes(3);
    for (const doc of membershipDocs) {
      expect(mockBatchUpdate).toHaveBeenCalledWith(doc.ref, {
        status: "active",
        // B8: canonical ISO string, not the serverTimestamp sentinel.
        updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      });
    }
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it("processes memberships in batches of 450", async () => {
    mockGetUser.mockResolvedValueOnce({ isSuperAdmin: true });

    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: "deactivated",
        deactivation: { previousStatus: "active" },
      }),
    });

    // 500 memberships should be split into 2 batches (450 + 50)
    const membershipDocs = Array.from({ length: 500 }, (_, i) => ({
      id: `mem-${i}`,
      ref: { path: `userMemberships/mem-${i}` },
    }));
    mockGet.mockResolvedValueOnce({ docs: membershipDocs, size: 500 });

    const result = await handler(makeRequest({ tenantId: "tenant-1" }));

    expect(result).toEqual({ success: true, membershipsReactivated: 500 });

    // 2 batches
    expect(stableDb.batch).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalledTimes(2);

    // Total update calls = 500
    expect(mockBatchUpdate).toHaveBeenCalledTimes(500);
  });

  it("handles single large batch boundary (exactly 450 memberships)", async () => {
    mockGetUser.mockResolvedValueOnce({ isSuperAdmin: true });

    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: "deactivated",
        deactivation: { previousStatus: "active" },
      }),
    });

    const membershipDocs = Array.from({ length: 450 }, (_, i) => ({
      id: `mem-${i}`,
      ref: { path: `userMemberships/mem-${i}` },
    }));
    mockGet.mockResolvedValueOnce({ docs: membershipDocs, size: 450 });

    await handler(makeRequest({ tenantId: "tenant-1" }));

    // Exactly 1 batch for 450
    expect(stableDb.batch).toHaveBeenCalledTimes(1);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  // ───────────────────── Audit logging ─────────────────────

  it("logs tenant action with correct parameters", async () => {
    mockGetUser.mockResolvedValueOnce({ isSuperAdmin: true });

    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: "deactivated",
        deactivation: { previousStatus: "active" },
      }),
    });

    mockGet.mockResolvedValueOnce({ docs: [], size: 0 });

    await handler(makeRequest({ tenantId: "tenant-1" }));

    expect(mockLogTenantAction).toHaveBeenCalledWith(
      "tenant-1",
      "superadmin-1",
      "reactivateTenant",
      { restoredStatus: "active", membershipsReactivated: 0 }
    );
  });

  it("logs correct membership count in tenant action", async () => {
    mockGetUser.mockResolvedValueOnce({ isSuperAdmin: true });

    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: "deactivated",
        deactivation: { previousStatus: "active" },
      }),
    });

    const membershipDocs = [
      { id: "mem-1", ref: {} },
      { id: "mem-2", ref: {} },
    ];
    mockGet.mockResolvedValueOnce({ docs: membershipDocs, size: 2 });

    await handler(makeRequest({ tenantId: "tenant-1" }));

    expect(mockLogTenantAction).toHaveBeenCalledWith(
      "tenant-1",
      "superadmin-1",
      "reactivateTenant",
      { restoredStatus: "active", membershipsReactivated: 2 }
    );
  });
});
