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

vi.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: (_opts: any, handler: any) => handler,
}));

vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { monthlyUsageReset } from "../../scheduled/usage-reset";
import { logger } from "firebase-functions/v2";

const handler = monthlyUsageReset as any;

// B8: writes now emit canonical ISO strings, not a serverTimestamp sentinel.
const ISO = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

function makeTenantDoc(id: string, status: string) {
  return {
    id,
    ref: { path: `tenants/${id}` },
    data: () => ({
      status,
      usage: { examsThisMonth: 42, aiCallsThisMonth: 100 },
    }),
  };
}

describe("monthlyUsageReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollectionWhere.mockReturnValue({
      where: mockCollectionWhere,
      get: mockCollectionGet,
    });
  });

  it("should reset counters for active tenants", async () => {
    const doc = makeTenantDoc("t1", "active");
    mockCollectionGet.mockResolvedValueOnce({ docs: [doc] });

    await handler();

    expect(mockBatchUpdate).toHaveBeenCalledWith(
      doc.ref,
      expect.objectContaining({
        "usage.examsThisMonth": 0,
        "usage.aiCallsThisMonth": 0,
        "usage.lastUpdated": ISO,
        updatedAt: ISO,
      })
    );
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith("Monthly usage reset: 1 tenants reset");
  });

  it("should reset counters for trial tenants", async () => {
    const doc = makeTenantDoc("t1", "trial");
    mockCollectionGet.mockResolvedValueOnce({ docs: [doc] });

    await handler();

    expect(mockBatchUpdate).toHaveBeenCalledWith(
      doc.ref,
      expect.objectContaining({
        "usage.examsThisMonth": 0,
        "usage.aiCallsThisMonth": 0,
      })
    );
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it("should handle empty tenant list", async () => {
    mockCollectionGet.mockResolvedValueOnce({ docs: [] });

    await handler();

    expect(mockBatchUpdate).not.toHaveBeenCalled();
    expect(mockBatchCommit).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith("Monthly usage reset: 0 tenants reset");
  });

  it("should batch large lists in chunks of 450", async () => {
    const docs = Array.from({ length: 500 }, (_, i) =>
      makeTenantDoc(`t-${i}`, i % 2 === 0 ? "active" : "trial")
    );
    mockCollectionGet.mockResolvedValueOnce({ docs });

    await handler();

    // 500 docs => two batches: 450 + 50
    expect(mockBatchCommit).toHaveBeenCalledTimes(2);
    expect(mockBatchUpdate).toHaveBeenCalledTimes(500);
    expect(logger.info).toHaveBeenCalledWith("Monthly usage reset: 500 tenants reset");
  });

  it("should set correct update fields for each tenant", async () => {
    const doc1 = makeTenantDoc("t1", "active");
    const doc2 = makeTenantDoc("t2", "trial");
    mockCollectionGet.mockResolvedValueOnce({ docs: [doc1, doc2] });

    await handler();

    // Verify both docs get the same field structure
    for (const call of mockBatchUpdate.mock.calls) {
      const updateData = call[1];
      expect(updateData).toEqual({
        "usage.examsThisMonth": 0,
        "usage.aiCallsThisMonth": 0,
        "usage.lastUpdated": ISO,
        updatedAt: ISO,
      });
    }
    expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
  });

  it("should log the correct reset count", async () => {
    const docs = Array.from({ length: 7 }, (_, i) => makeTenantDoc(`t-${i}`, "active"));
    mockCollectionGet.mockResolvedValueOnce({ docs });

    await handler();

    expect(logger.info).toHaveBeenCalledWith("Monthly usage reset: 7 tenants reset");
  });
});
