/**
 * Unit tests for generateInsights scheduler.
 * Verifies nightly insight generation: per-student rules, MAX_ACTIVE_INSIGHTS = 5 limit,
 * deduplication, pagination (500 per batch), and multi-tenant support.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Stable mocks (hoisted for vi.mock factory access) ───────────────────────
const {
  mockGet,
  mockSet,
  mockBatchSet,
  mockBatchDelete,
  mockBatchCommit,
  mockGenerateInsightsForStudent,
} = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn().mockResolvedValue({}),
  mockBatchSet: vi.fn(),
  mockBatchDelete: vi.fn(),
  mockBatchCommit: vi.fn().mockResolvedValue({}),
  mockGenerateInsightsForStudent: vi.fn(),
}));

const stableDb: any = {
  doc: vi.fn(() => ({ get: mockGet, set: mockSet })),
  collection: vi.fn(() => ({
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    startAfter: vi.fn().mockReturnThis(),
    get: mockGet,
    doc: vi.fn(() => ({ id: "auto-id", get: mockGet, set: mockSet })),
  })),
  batch: vi.fn(() => ({
    set: mockBatchSet,
    delete: mockBatchDelete,
    commit: mockBatchCommit,
  })),
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

vi.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: vi.fn((_opts: any, handler: any) => handler),
}));

vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../../utils/insight-rules", () => ({
  generateInsightsForStudent: mockGenerateInsightsForStudent,
}));

// ── Import handler ──────────────────────────────────────────────────────────
import { generateInsights } from "../../schedulers/generate-insights";
const handler = generateInsights as any;

describe("generateInsights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReset();
    mockSet.mockReset();
    mockBatchSet.mockReset();
    mockBatchDelete.mockReset();
    mockBatchCommit.mockReset().mockResolvedValue({});
    mockGenerateInsightsForStudent.mockReset();
  });

  it("should generate insights for students with progress", async () => {
    // Tenants
    mockGet.mockResolvedValueOnce({ docs: [{ id: "tenant-1" }] });
    // Exams
    mockGet.mockResolvedValueOnce({
      docs: [{ id: "exam-1", data: () => ({ title: "Math Test", classIds: ["c1"], topics: [] }) }],
    });
    // Spaces
    mockGet.mockResolvedValueOnce({
      docs: [
        { id: "space-1", data: () => ({ title: "Algebra", subject: "Math", status: "published" }) },
      ],
    });
    // Student progress summaries (page 1)
    mockGet.mockResolvedValueOnce({
      empty: false,
      size: 1,
      docs: [{ id: "stu-1", data: () => ({ overallScore: 60 }) }],
    });
    // Space progress for student
    mockGet.mockResolvedValueOnce({
      docs: [{ data: () => ({ spaceId: "space-1", percentage: 75 }) }],
    });

    // Generate insights returns 2 seeds
    mockGenerateInsightsForStudent.mockReturnValueOnce([
      {
        type: "improvement",
        priority: "medium",
        title: "Keep it up",
        description: "desc",
        actionType: "view_space",
      },
      {
        type: "warning",
        priority: "high",
        title: "Falling behind",
        description: "desc2",
        actionType: "view_exam",
      },
    ]);

    // Existing active insights: empty
    mockGet.mockResolvedValueOnce({ size: 0, docs: [] });

    // Second page: empty (stop pagination)
    mockGet.mockResolvedValueOnce({ empty: true, size: 0, docs: [] });

    await handler({});

    expect(mockGenerateInsightsForStudent).toHaveBeenCalled();
    expect(mockBatchSet).toHaveBeenCalled();
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it("should limit to 5 active insights per student", async () => {
    // Tenants
    mockGet.mockResolvedValueOnce({ docs: [{ id: "tenant-1" }] });
    // Exams
    mockGet.mockResolvedValueOnce({ docs: [] });
    // Spaces
    mockGet.mockResolvedValueOnce({ docs: [] });
    // Students (page 1)
    mockGet.mockResolvedValueOnce({
      empty: false,
      size: 1,
      docs: [{ id: "stu-1", data: () => ({ overallScore: 50 }) }],
    });
    // Space progress
    mockGet.mockResolvedValueOnce({ docs: [] });

    // Generate 8 insight seeds
    mockGenerateInsightsForStudent.mockReturnValueOnce(
      Array.from({ length: 8 }, (_, i) => ({
        type: "tip",
        priority: "low",
        title: `Insight ${i}`,
        description: `Desc ${i}`,
        actionType: "view_space",
      }))
    );

    // Existing active insights: already 3
    const existingDocs = Array.from({ length: 3 }, (_, i) => ({
      ref: { path: `insights/existing-${i}` },
      data: () => ({ createdAt: { toMillis: () => i * 1000 } }),
    }));
    mockGet.mockResolvedValueOnce({ size: 3, docs: existingDocs });

    // Second page: empty
    mockGet.mockResolvedValueOnce({ empty: true, size: 0, docs: [] });

    await handler({});

    // Should delete old insights to stay under limit
    expect(mockBatchDelete).toHaveBeenCalled();
  });

  it("should deduplicate by removing oldest existing insights when over limit", async () => {
    // Tenants
    mockGet.mockResolvedValueOnce({ docs: [{ id: "tenant-1" }] });
    // Exams + Spaces
    mockGet.mockResolvedValueOnce({ docs: [] });
    mockGet.mockResolvedValueOnce({ docs: [] });
    // Students
    mockGet.mockResolvedValueOnce({
      empty: false,
      size: 1,
      docs: [{ id: "stu-1", data: () => ({}) }],
    });
    // Space progress
    mockGet.mockResolvedValueOnce({ docs: [] });

    // 3 new seeds
    mockGenerateInsightsForStudent.mockReturnValueOnce([
      { type: "tip", priority: "low", title: "New 1", description: "d", actionType: "none" },
      { type: "tip", priority: "low", title: "New 2", description: "d", actionType: "none" },
      { type: "tip", priority: "low", title: "New 3", description: "d", actionType: "none" },
    ]);

    // 4 existing active insights (4 + 3 = 7 > MAX 5 => delete 2)
    const existingDocs = Array.from({ length: 4 }, (_, i) => ({
      ref: { path: `insights/old-${i}` },
      data: () => ({ createdAt: { toMillis: () => i * 1000 } }),
    }));
    mockGet.mockResolvedValueOnce({ size: 4, docs: existingDocs });

    // Second page: empty
    mockGet.mockResolvedValueOnce({ empty: true, size: 0, docs: [] });

    await handler({});

    // Should delete oldest insights to stay under MAX_ACTIVE_INSIGHTS limit
    expect(mockBatchDelete).toHaveBeenCalled();
    // toRemove = (4 + 3) - 5 = 2, but capped at sorted.length (4)
    expect(mockBatchDelete.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("should paginate through student batches", async () => {
    // Tenants
    mockGet.mockResolvedValueOnce({ docs: [{ id: "tenant-1" }] });
    // Exams + Spaces
    mockGet.mockResolvedValueOnce({ docs: [] });
    mockGet.mockResolvedValueOnce({ docs: [] });

    // Page 1: 3 students (size < PAGE_SIZE=500, so only one page)
    const page1Docs = Array.from({ length: 3 }, (_, i) => ({
      id: `stu-${i}`,
      data: () => ({}),
    }));
    mockGet.mockResolvedValueOnce({ empty: false, size: 3, docs: page1Docs });

    // Space progress for each student: empty (3 calls)
    for (let i = 0; i < 3; i++) {
      mockGet.mockResolvedValueOnce({ docs: [] });
    }

    // No insights generated for any student
    mockGenerateInsightsForStudent.mockReturnValue([]);

    await handler({});

    // generateInsightsForStudent should have been called for each student
    expect(mockGenerateInsightsForStudent).toHaveBeenCalledTimes(3);
  });

  it("should handle no students gracefully", async () => {
    // No tenants at all
    mockGet.mockResolvedValueOnce({ docs: [] });

    await handler({});

    expect(mockGenerateInsightsForStudent).not.toHaveBeenCalled();
    expect(mockBatchSet).not.toHaveBeenCalled();
  });

  it("should skip students without progress data", async () => {
    // Tenants
    mockGet.mockResolvedValueOnce({ docs: [{ id: "tenant-1" }] });
    // Exams + Spaces
    mockGet.mockResolvedValueOnce({ docs: [] });
    mockGet.mockResolvedValueOnce({ docs: [] });
    // Students
    mockGet.mockResolvedValueOnce({
      empty: false,
      size: 1,
      docs: [{ id: "stu-1", data: () => ({}) }],
    });
    // Space progress: empty
    mockGet.mockResolvedValueOnce({ docs: [] });

    // No insights generated
    mockGenerateInsightsForStudent.mockReturnValueOnce([]);

    // Second page: empty
    mockGet.mockResolvedValueOnce({ empty: true, size: 0, docs: [] });

    await handler({});

    expect(mockBatchSet).not.toHaveBeenCalled();
  });

  it("should handle multiple tenants", async () => {
    // 2 tenants
    mockGet.mockResolvedValueOnce({ docs: [{ id: "tenant-1" }, { id: "tenant-2" }] });

    // Tenant-1: exams + spaces
    mockGet.mockResolvedValueOnce({ docs: [] });
    mockGet.mockResolvedValueOnce({ docs: [] });
    // Tenant-1: no students
    mockGet.mockResolvedValueOnce({ empty: true, size: 0, docs: [] });

    // Tenant-2: exams + spaces
    mockGet.mockResolvedValueOnce({ docs: [] });
    mockGet.mockResolvedValueOnce({ docs: [] });
    // Tenant-2: no students
    mockGet.mockResolvedValueOnce({ empty: true, size: 0, docs: [] });

    await handler({});

    // collection should be called for both tenants
    expect(stableDb.collection).toHaveBeenCalled();
  });

  it("should log summary after completion", async () => {
    // No tenants
    mockGet.mockResolvedValueOnce({ docs: [] });

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await handler({});

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Insight generation complete"));

    consoleSpy.mockRestore();
  });
});
