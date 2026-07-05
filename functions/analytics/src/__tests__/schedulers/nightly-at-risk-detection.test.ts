import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Stable mocks ────────────────────────────────────────────────────────────
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockUpdate = vi.fn();
const mockBatch = { set: vi.fn(), update: vi.fn(), commit: vi.fn() };

const stableDb: any = {
  doc: vi.fn(() => ({ get: mockGet, set: mockSet, update: mockUpdate })),
  collection: vi.fn(() => ({
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    startAfter: vi.fn().mockReturnThis(),
    get: mockGet,
    doc: vi.fn(() => ({ get: mockGet, set: mockSet, update: mockUpdate, id: "auto-id" })),
  })),
  batch: vi.fn(() => mockBatch),
  collectionGroup: vi.fn(() => ({
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    startAfter: vi.fn().mockReturnThis(),
    get: mockGet,
  })),
};

vi.mock("firebase-admin", () => {
  const fsFn: any = () => stableDb;
  fsFn.FieldValue = {
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
  };
  fsFn.FieldPath = {
    documentId: vi.fn(() => "__document_id__"),
  };
  fsFn.Timestamp = { now: vi.fn(() => ({ toDate: () => new Date() })) };
  return {
    default: { firestore: fsFn, initializeApp: vi.fn() },
    firestore: fsFn,
    initializeApp: vi.fn(),
  };
});

vi.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: vi.fn((_opts: any, handler: any) => handler),
}));

vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../../utils/at-risk-rules", () => ({
  evaluateAtRiskRules: vi.fn(() => ({ isAtRisk: false, reasons: [] })),
}));

vi.mock("../../contracts/legacy-docs", () => ({
  StudentProgressSummarySchema: { safeParse: (data: any) => ({ success: true, data }) },
}));

import { nightlyAtRiskDetection } from "../../schedulers/nightly-at-risk-detection";
const handler = nightlyAtRiskDetection as any;

describe("nightlyAtRiskDetection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should process student progress summaries and detect at-risk students", async () => {
    // Mock: active tenants query
    mockGet.mockResolvedValueOnce({
      docs: [{ id: "tenant-1", data: () => ({ status: "active" }) }],
    });

    // Mock: student progress summaries for tenant
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: "stu-1",
          ref: { path: "tenants/tenant-1/studentProgressSummaries/stu-1" },
          data: () => ({
            uid: "stu-1",
            isAtRisk: false,
            atRiskReasons: [],
            overallScore: 45,
            classId: "class-1",
          }),
        },
      ],
      size: 1,
    });

    // Empty second page (stop pagination)
    mockGet.mockResolvedValueOnce({ docs: [], size: 0 });

    await handler({});

    // Should have attempted batch operations
    expect(stableDb.batch).toHaveBeenCalled();
  });

  it("should handle no tenants gracefully", async () => {
    mockGet.mockResolvedValueOnce({ docs: [], size: 0 });
    await handler({});
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });
});
