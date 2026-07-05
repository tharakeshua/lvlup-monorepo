import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockUpdate = vi.fn().mockResolvedValue({});
const mockBatch = { update: vi.fn(), commit: vi.fn().mockResolvedValue({}) };

const stableDb: any = {
  doc: vi.fn(() => ({ get: mockGet, update: mockUpdate })),
  collection: vi.fn(() => ({
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: mockGet,
  })),
  collectionGroup: vi.fn(() => ({
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: mockGet,
  })),
  batch: vi.fn(() => mockBatch),
};

vi.mock("firebase-admin", () => {
  const fsFn: any = () => stableDb;
  fsFn.FieldValue = {
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
  };
  fsFn.Timestamp = {
    now: vi.fn(() => ({ seconds: Math.floor(Date.now() / 1000), toDate: () => new Date() })),
    fromDate: vi.fn((d: Date) => ({ seconds: Math.floor(d.getTime() / 1000), toDate: () => d })),
  };
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

vi.mock("../../utils/grading", () => ({
  autoEvaluateSubmission: vi.fn().mockResolvedValue({
    pointsEarned: 8,
    totalPoints: 10,
    percentage: 80,
  }),
}));

import { onTestSessionExpired } from "../../triggers/on-test-session-expired";
const handler = onTestSessionExpired as any;

describe("onTestSessionExpired", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should find and expire overdue test sessions", async () => {
    // Expired sessions query
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: "session-1",
          ref: { path: "tenants/tenant-1/digitalTestSessions/session-1" },
          data: () => ({
            status: "in_progress",
            serverDeadline: { seconds: Date.now() / 1000 - 120 },
            tenantId: "tenant-1",
            spaceId: "space-1",
            studentUid: "stu-1",
          }),
        },
      ],
    });

    // NOTE: the fixture session has no `submissions`, so the grading pass is
    // skipped — do NOT queue extra mockResolvedValueOnce values here.
    // vi.clearAllMocks() does not drop unconsumed once-queues, and leftovers
    // leak into the next test.

    await handler({});

    expect(mockBatch.update).toHaveBeenCalled();
    expect(mockBatch.commit).toHaveBeenCalled();
  });

  it("should handle no expired sessions", async () => {
    // Real QuerySnapshots carry .empty — the handler early-returns on it.
    mockGet.mockResolvedValueOnce({ empty: true, docs: [] });

    await handler({});

    expect(mockBatch.commit).not.toHaveBeenCalled();
  });
});
