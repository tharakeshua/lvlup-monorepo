import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Stable mocks ────────────────────────────────────────────────────────────
const mockBatchUpdate = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
const mockCollectionGet = vi.fn();
const mockCollectionWhere = vi.fn();

const stableDb: any = {
  collection: vi.fn(() => ({
    where: mockCollectionWhere,
    get: mockCollectionGet,
  })),
  batch: vi.fn(() => ({
    update: mockBatchUpdate,
    commit: mockBatchCommit,
  })),
};

// Chain .where().where().get()
mockCollectionWhere.mockReturnValue({
  where: mockCollectionWhere,
  get: mockCollectionGet,
});

vi.mock("firebase-admin", () => {
  const fsFn: any = () => stableDb;
  fsFn.FieldValue = {
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
  };
  return {
    default: { firestore: fsFn, initializeApp: vi.fn() },
    firestore: fsFn,
    initializeApp: vi.fn(),
  };
});

vi.mock("firebase-functions/v2/firestore", () => ({
  onDocumentUpdated: (_opts: any, handler: any) => handler,
}));

vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { onTenantDeactivated } from "../../triggers/on-tenant-deactivated";
import { logger } from "firebase-functions/v2";

const handler = onTenantDeactivated as any;

// B8: writes now emit canonical ISO strings, not a serverTimestamp sentinel.
const ISO = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

function makeEvent(
  beforeData: Record<string, unknown> | undefined,
  afterData: Record<string, unknown> | undefined,
  params: Record<string, string> = { tenantId: "tenant-1" }
) {
  return {
    data:
      beforeData && afterData
        ? {
            before: { id: "tenant-1", data: () => beforeData },
            after: { id: "tenant-1", data: () => afterData },
          }
        : undefined,
    params,
  };
}

describe("onTenantDeactivated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollectionWhere.mockReturnValue({
      where: mockCollectionWhere,
      get: mockCollectionGet,
    });
  });

  it("should no-op when event data is missing", async () => {
    const event = { data: undefined, params: { tenantId: "tenant-1" } };
    await handler(event);
    expect(mockCollectionGet).not.toHaveBeenCalled();
  });

  it("should no-op when before data is undefined", async () => {
    const event = {
      data: {
        before: { id: "tenant-1", data: () => undefined },
        after: { id: "tenant-1", data: () => ({ status: "suspended" }) },
      },
      params: { tenantId: "tenant-1" },
    };
    await handler(event);
    expect(mockCollectionGet).not.toHaveBeenCalled();
  });

  it("should no-op (and log) when status projection fails for before", async () => {
    // Invalid `status` on the before doc → local whitelist projection rejects it.
    await handler(makeEvent({ status: "not-a-status" }, { status: "suspended" }));

    expect(logger.error).toHaveBeenCalledWith(
      "Invalid Tenant document in trigger",
      expect.objectContaining({ beforeValid: false })
    );
    expect(mockCollectionGet).not.toHaveBeenCalled();
  });

  it("should no-op (and log) when status projection fails for after", async () => {
    await handler(makeEvent({ status: "active" }, { status: "garbage" }));

    expect(logger.error).toHaveBeenCalledWith(
      "Invalid Tenant document in trigger",
      expect.objectContaining({ afterValid: false })
    );
    expect(mockCollectionGet).not.toHaveBeenCalled();
  });

  it("should no-op when before status was already suspended", async () => {
    await handler(makeEvent({ status: "suspended" }, { status: "suspended" }));
    expect(mockCollectionGet).not.toHaveBeenCalled();
  });

  it("should no-op when before status was already expired", async () => {
    await handler(makeEvent({ status: "expired" }, { status: "expired" }));
    expect(mockCollectionGet).not.toHaveBeenCalled();
  });

  it("should no-op when after status is not suspended or expired", async () => {
    await handler(makeEvent({ status: "trial" }, { status: "active" }));
    expect(mockCollectionGet).not.toHaveBeenCalled();
  });

  it("should no-op when no active memberships found", async () => {
    mockCollectionGet.mockResolvedValueOnce({ empty: true });

    await handler(makeEvent({ status: "active" }, { status: "suspended" }));

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("No active memberships to suspend")
    );
    expect(mockBatchUpdate).not.toHaveBeenCalled();
  });

  it("should suspend all active memberships when status changes to suspended", async () => {
    const mockDocs = [
      { ref: { path: "userMemberships/mem-1" } },
      { ref: { path: "userMemberships/mem-2" } },
    ];
    mockCollectionGet.mockResolvedValueOnce({ empty: false, docs: mockDocs });

    await handler(makeEvent({ status: "active" }, { status: "suspended" }));

    expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      mockDocs[0].ref,
      expect.objectContaining({
        status: "suspended",
        suspendedReason: "tenant_suspended",
        updatedAt: ISO,
      })
    );
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("Suspended 2 memberships"));
  });

  it("should set suspendedReason to tenant_expired when status is expired", async () => {
    const mockDocs = [{ ref: { path: "userMemberships/mem-1" } }];
    mockCollectionGet.mockResolvedValueOnce({ empty: false, docs: mockDocs });

    await handler(makeEvent({ status: "active" }, { status: "expired" }));

    expect(mockBatchUpdate).toHaveBeenCalledWith(
      mockDocs[0].ref,
      expect.objectContaining({
        suspendedReason: "tenant_expired",
      })
    );
  });

  it("should batch memberships in chunks of 450", async () => {
    // Generate 500 mock docs to trigger two batches
    const mockDocs = Array.from({ length: 500 }, (_, i) => ({
      ref: { path: `userMemberships/mem-${i}` },
    }));
    mockCollectionGet.mockResolvedValueOnce({ empty: false, docs: mockDocs });

    await handler(makeEvent({ status: "active" }, { status: "suspended" }));

    // Two batches: 450 + 50
    expect(mockBatchCommit).toHaveBeenCalledTimes(2);
    expect(mockBatchUpdate).toHaveBeenCalledTimes(500);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("Suspended 500 memberships"));
  });

  it("should catch and log errors", async () => {
    const error = new Error("Firestore unavailable");
    mockCollectionGet.mockRejectedValueOnce(error);

    await handler(makeEvent({ status: "active" }, { status: "suspended" }));

    expect(logger.error).toHaveBeenCalledWith(
      "Failed to suspend memberships for deactivated tenant",
      error
    );
  });
});
