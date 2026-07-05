/**
 * Unit tests for onSpaceProgressUpdated trigger.
 * Verifies recalculation of StudentLevelupMetrics: totalSpaces, completedSpaces,
 * averageAccuracy, recentActivity, overallScore, and transaction usage.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Stable mocks ────────────────────────────────────────────────────────────
const mockGet = vi.fn();
const mockSet = vi.fn().mockResolvedValue({});
const mockRunTransaction = vi.fn();

const stableDb: any = {
  doc: vi.fn(() => ({ get: mockGet, set: mockSet })),
  collection: vi.fn(() => ({
    where: vi.fn().mockReturnThis(),
    get: mockGet,
  })),
  runTransaction: mockRunTransaction,
};

vi.mock("firebase-admin", () => {
  const fsFn: any = () => stableDb;
  fsFn.FieldValue = {
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
  };
  fsFn.FieldPath = {
    documentId: vi.fn(() => "__documentId__"),
  };
  return {
    default: { firestore: fsFn, initializeApp: vi.fn() },
    firestore: fsFn,
    initializeApp: vi.fn(),
  };
});

vi.mock("firebase-functions/v2/firestore", () => ({
  onDocumentWritten: (_opts: any, handler: any) => handler,
}));

vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../../utils/aggregation-helpers", async (importOriginal) => ({
  // Keep the real module (legacyMillis is used by the recent-activity sort).
  ...(await importOriginal<Record<string, unknown>>()),
  computeOverallScore: vi.fn(
    (autograde: number, completion: number) => (autograde + completion) / 2
  ),
  identifyStrengthsAndWeaknesses: vi.fn(() => ({ strengths: ["Math"], weaknesses: ["Science"] })),
  topN: vi.fn((arr: any[], n: number) => arr.slice(0, n)),
}));

// ── Import handler ──────────────────────────────────────────────────────────
import { onSpaceProgressUpdated } from "../../triggers/on-space-progress-updated";
const handler = onSpaceProgressUpdated as any;

const TENANT = "tenant-1";
const PROGRESS_ID = "user1_space1";

function makeEvent(
  afterData: Record<string, any> | null,
  params = { tenantId: TENANT, progressId: PROGRESS_ID }
) {
  return {
    data: {
      after: { data: () => afterData },
    },
    params,
  };
}

describe("onSpaceProgressUpdated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return early when after data is null (deleted)", async () => {
    await handler(makeEvent(null));

    expect(mockGet).not.toHaveBeenCalled();
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it("should recalculate metrics for a student with space progress", async () => {
    // Space progress for student
    mockGet.mockResolvedValueOnce({
      size: 2,
      docs: [
        {
          data: () => ({
            spaceId: "space-1",
            userId: "user-1",
            pointsEarned: 80,
            totalPoints: 100,
            percentage: 80,
            status: "completed",
            updatedAt: { toMillis: () => 1000 },
          }),
        },
        {
          data: () => ({
            spaceId: "space-2",
            userId: "user-1",
            pointsEarned: 60,
            totalPoints: 100,
            percentage: 60,
            status: "in_progress",
            updatedAt: { toMillis: () => 2000 },
          }),
        },
      ],
    });

    // Space lookup batch
    mockGet.mockResolvedValueOnce({
      docs: [
        { id: "space-1", data: () => ({ title: "Algebra", subject: "Math" }) },
        { id: "space-2", data: () => ({ title: "Biology", subject: "Science" }) },
      ],
    });

    // Transaction
    mockRunTransaction.mockImplementation(async (fn: any) => {
      const txn = {
        get: vi
          .fn()
          .mockResolvedValue({
            data: () => ({ autograde: { subjectBreakdown: {}, averageScore: 70 } }),
          }),
        set: vi.fn(),
      };
      await fn(txn);
      return txn;
    });

    await handler(makeEvent({ userId: "user-1" }));

    expect(mockRunTransaction).toHaveBeenCalled();
  });

  it("should compute totalSpaces and completedSpaces correctly", async () => {
    // 3 spaces, 2 completed
    mockGet.mockResolvedValueOnce({
      size: 3,
      docs: [
        {
          data: () => ({
            spaceId: "s1",
            userId: "u1",
            pointsEarned: 90,
            totalPoints: 100,
            percentage: 90,
            status: "completed",
            updatedAt: null,
          }),
        },
        {
          data: () => ({
            spaceId: "s2",
            userId: "u1",
            pointsEarned: 85,
            totalPoints: 100,
            percentage: 85,
            status: "completed",
            updatedAt: null,
          }),
        },
        {
          data: () => ({
            spaceId: "s3",
            userId: "u1",
            pointsEarned: 30,
            totalPoints: 100,
            percentage: 30,
            status: "in_progress",
            updatedAt: null,
          }),
        },
      ],
    });

    // Space lookup
    mockGet.mockResolvedValueOnce({
      docs: [
        { id: "s1", data: () => ({ title: "S1", subject: "Math" }) },
        { id: "s2", data: () => ({ title: "S2", subject: "Math" }) },
        { id: "s3", data: () => ({ title: "S3", subject: "Science" }) },
      ],
    });

    let capturedLevelup: any;
    mockRunTransaction.mockImplementation(async (fn: any) => {
      const txn = {
        get: vi.fn().mockResolvedValue({ data: () => ({}) }),
        set: vi.fn((_, data: any) => {
          capturedLevelup = data.levelup;
        }),
      };
      await fn(txn);
    });

    await handler(makeEvent({ userId: "u1" }));

    expect(capturedLevelup.totalSpaces).toBe(3);
    expect(capturedLevelup.completedSpaces).toBe(2);
  });

  it("should compute averageAccuracy from points", async () => {
    // 2 spaces: 80/100 and 60/200
    mockGet.mockResolvedValueOnce({
      size: 2,
      docs: [
        {
          data: () => ({
            spaceId: "s1",
            userId: "u1",
            pointsEarned: 80,
            totalPoints: 100,
            percentage: 80,
            status: "completed",
            updatedAt: null,
          }),
        },
        {
          data: () => ({
            spaceId: "s2",
            userId: "u1",
            pointsEarned: 60,
            totalPoints: 200,
            percentage: 30,
            status: "in_progress",
            updatedAt: null,
          }),
        },
      ],
    });

    mockGet.mockResolvedValueOnce({
      docs: [
        { id: "s1", data: () => ({ title: "S1", subject: "Math" }) },
        { id: "s2", data: () => ({ title: "S2", subject: "Math" }) },
      ],
    });

    let capturedLevelup: any;
    mockRunTransaction.mockImplementation(async (fn: any) => {
      const txn = {
        get: vi.fn().mockResolvedValue({ data: () => ({}) }),
        set: vi.fn((_, data: any) => {
          capturedLevelup = data.levelup;
        }),
      };
      await fn(txn);
    });

    await handler(makeEvent({ userId: "u1" }));

    // averageAccuracy = (80 + 60) / (100 + 200) = 140/300
    expect(capturedLevelup.averageAccuracy).toBeCloseTo(140 / 300, 5);
  });

  it("should include top 10 recent activity entries", async () => {
    // 12 spaces to test top 10 limiting
    const spaceDocs = Array.from({ length: 12 }, (_, i) => ({
      data: () => ({
        spaceId: `s${i}`,
        userId: "u1",
        pointsEarned: 10,
        totalPoints: 100,
        percentage: 10,
        status: "in_progress",
        updatedAt: { toMillis: () => i * 1000 },
      }),
    }));
    mockGet.mockResolvedValueOnce({ size: 12, docs: spaceDocs });

    // Space lookup (batches of 30)
    const spaceInfoDocs = Array.from({ length: 12 }, (_, i) => ({
      id: `s${i}`,
      data: () => ({ title: `Space ${i}`, subject: "General" }),
    }));
    mockGet.mockResolvedValueOnce({ docs: spaceInfoDocs });

    let capturedLevelup: any;
    mockRunTransaction.mockImplementation(async (fn: any) => {
      const txn = {
        get: vi.fn().mockResolvedValue({ data: () => ({}) }),
        set: vi.fn((_, data: any) => {
          capturedLevelup = data.levelup;
        }),
      };
      await fn(txn);
    });

    await handler(makeEvent({ userId: "u1" }));

    // topN mock returns first 10
    expect(capturedLevelup.recentActivity.length).toBeLessThanOrEqual(10);
  });

  it("should compute overallScore using aggregation helper", async () => {
    mockGet.mockResolvedValueOnce({
      size: 1,
      docs: [
        {
          data: () => ({
            spaceId: "s1",
            userId: "u1",
            pointsEarned: 50,
            totalPoints: 100,
            percentage: 50,
            status: "in_progress",
            updatedAt: null,
          }),
        },
      ],
    });

    mockGet.mockResolvedValueOnce({
      docs: [{ id: "s1", data: () => ({ title: "S1", subject: "Math" }) }],
    });

    let capturedOverallScore: number | undefined;
    mockRunTransaction.mockImplementation(async (fn: any) => {
      const txn = {
        get: vi
          .fn()
          .mockResolvedValue({
            data: () => ({ autograde: { averageScore: 70, subjectBreakdown: {} } }),
          }),
        set: vi.fn((_, data: any) => {
          capturedOverallScore = data.overallScore;
        }),
      };
      await fn(txn);
    });

    await handler(makeEvent({ userId: "u1" }));

    // computeOverallScore mock: (70 + 50) / 2 = 60
    expect(capturedOverallScore).toBe(60);
  });

  it("should use a transaction for atomic read-modify-write", async () => {
    mockGet.mockResolvedValueOnce({
      size: 1,
      docs: [
        {
          data: () => ({
            spaceId: "s1",
            userId: "u1",
            pointsEarned: 10,
            totalPoints: 100,
            percentage: 10,
            status: "in_progress",
            updatedAt: null,
          }),
        },
      ],
    });

    mockGet.mockResolvedValueOnce({
      docs: [{ id: "s1", data: () => ({ title: "S1", subject: "General" }) }],
    });

    mockRunTransaction.mockImplementation(async (fn: any) => {
      const txn = {
        get: vi.fn().mockResolvedValue({ data: () => ({}) }),
        set: vi.fn(),
      };
      await fn(txn);
    });

    await handler(makeEvent({ userId: "u1" }));

    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
  });

  it("should handle no existing metrics gracefully", async () => {
    mockGet.mockResolvedValueOnce({
      size: 1,
      docs: [
        {
          data: () => ({
            spaceId: "s1",
            userId: "u1",
            pointsEarned: 50,
            totalPoints: 100,
            percentage: 50,
            status: "completed",
            updatedAt: null,
          }),
        },
      ],
    });

    mockGet.mockResolvedValueOnce({
      docs: [{ id: "s1", data: () => ({ title: "S1", subject: "Math" }) }],
    });

    mockRunTransaction.mockImplementation(async (fn: any) => {
      const txn = {
        get: vi.fn().mockResolvedValue({ data: () => undefined }),
        set: vi.fn(),
      };
      await fn(txn);
    });

    await expect(handler(makeEvent({ userId: "u1" }))).resolves.not.toThrow();
  });
});
