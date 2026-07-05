import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockBatch = { update: vi.fn(), commit: vi.fn().mockResolvedValue({}) };

const stableDb: any = {
  doc: vi.fn(() => ({ get: mockGet })),
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
  fsFn.FieldValue = { serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP") };
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

import { cleanupStaleSessions } from "../../triggers/cleanup-stale-sessions";
const handler = cleanupStaleSessions as any;

describe("cleanupStaleSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should mark stale sessions as abandoned", async () => {
    // B8 dual query: one get() for Timestamp-typed createdAt, one for ISO strings.
    mockGet
      .mockResolvedValueOnce({
        docs: [
          {
            id: "session-1",
            ref: { path: "tenants/tenant-1/digitalTestSessions/session-1" },
            data: () => ({
              status: "in_progress",
              createdAt: { seconds: Date.now() / 1000 - 86400 * 2 }, // 2 days ago
            }),
          },
        ],
      })
      .mockResolvedValueOnce({ docs: [] });

    await handler({});

    expect(mockBatch.update).toHaveBeenCalled();
    expect(mockBatch.commit).toHaveBeenCalled();
    const updateArgs = mockBatch.update.mock.calls[0];
    expect(updateArgs[1].status).toBe("abandoned");
    expect(updateArgs[1].abandonedReason).toBe("stale_24h");
    // B8: audit updatedAt is a canonical ISO string; endedAt stays a Timestamp.
    expect(updateArgs[1].updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("should handle no stale sessions", async () => {
    mockGet.mockResolvedValue({ docs: [] });

    await handler({});
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });
});
