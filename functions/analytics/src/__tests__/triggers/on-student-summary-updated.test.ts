/**
 * Unit tests for onStudentSummaryUpdated trigger.
 * Verifies class progress summary recalculation, debounce (5-min cooldown),
 * top/bottom performers, at-risk tracking, and multi-class support.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Stable mocks ────────────────────────────────────────────────────────────
const mockGet = vi.fn();
const mockSet = vi.fn().mockResolvedValue({});
const mockUpdate = vi.fn().mockResolvedValue({});

const stableDb: any = {
  doc: vi.fn(() => ({ get: mockGet, set: mockSet, update: mockUpdate })),
  collection: vi.fn(() => ({
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: mockGet,
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

vi.mock("firebase-functions/v2/firestore", () => ({
  onDocumentWritten: (_opts: any, handler: any) => handler,
}));

vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../../utils/aggregation-helpers", async (importOriginal) => ({
  // Keep the real module (legacyMillis is used by the debounce path) and
  // only stub the ranking helpers.
  ...(await importOriginal<Record<string, unknown>>()),
  topN: vi.fn((arr: any[], n: number, fn: (item: any) => number) =>
    [...arr].sort((a, b) => fn(b) - fn(a)).slice(0, n)
  ),
  bottomN: vi.fn((arr: any[], n: number, fn: (item: any) => number) =>
    [...arr].sort((a, b) => fn(a) - fn(b)).slice(0, n)
  ),
}));

// ── Import handler ──────────────────────────────────────────────────────────
import { onStudentSummaryUpdated } from "../../triggers/on-student-summary-updated";
const handler = onStudentSummaryUpdated as any;

const TENANT = "tenant-1";
const STUDENT_ID = "stu-1";

function makeEvent(
  afterData: Record<string, any> | null,
  params = { tenantId: TENANT, studentId: STUDENT_ID }
) {
  return {
    data: {
      after: { data: () => afterData },
    },
    params,
  };
}

describe("onStudentSummaryUpdated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return early when after data is null", async () => {
    await handler(makeEvent(null));

    expect(mockGet).not.toHaveBeenCalled();
  });

  it("should return early when student has no class memberships", async () => {
    // Memberships query: empty
    mockGet.mockResolvedValueOnce({ docs: [] });

    await handler(makeEvent({ overallScore: 80 }));

    expect(mockSet).not.toHaveBeenCalled();
  });

  it("should update class progress summary with aggregated metrics", async () => {
    // Student memberships
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          data: () => ({ uid: STUDENT_ID, schoolId: "class-1", role: "student", status: "active" }),
        },
      ],
    });

    // Debounce check: class summary does not exist
    mockGet.mockResolvedValueOnce({ exists: false });

    // Class doc
    mockGet.mockResolvedValueOnce({ data: () => ({ name: "Grade 10A" }) });

    // Student memberships for class
    mockGet.mockResolvedValueOnce({
      docs: [
        { data: () => ({ uid: "stu-1", displayName: "Alice", role: "student", status: "active" }) },
        { data: () => ({ uid: "stu-2", displayName: "Bob", role: "student", status: "active" }) },
      ],
    });

    // Student summaries batch
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: "stu-1",
          data: () => ({
            autograde: { averageScore: 85, completedExams: 3, totalExams: 5 },
            levelup: { averageCompletion: 70, totalSpaces: 3, totalPointsEarned: 200 },
            isAtRisk: false,
          }),
        },
        {
          id: "stu-2",
          data: () => ({
            autograde: { averageScore: 60, completedExams: 2, totalExams: 5 },
            levelup: { averageCompletion: 40, totalSpaces: 2, totalPointsEarned: 100 },
            isAtRisk: true,
          }),
        },
      ],
    });

    await handler(makeEvent({ overallScore: 80 }));

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        classId: "class-1",
        className: "Grade 10A",
        studentCount: 2,
      })
    );
  });

  it("should compute averageClassScore correctly", async () => {
    // Memberships
    mockGet.mockResolvedValueOnce({
      docs: [{ data: () => ({ uid: STUDENT_ID, schoolId: "class-1" }) }],
    });

    // No existing summary
    mockGet.mockResolvedValueOnce({ exists: false });

    // Class doc
    mockGet.mockResolvedValueOnce({ data: () => ({ name: "Class A" }) });

    // Student memberships
    mockGet.mockResolvedValueOnce({
      docs: [
        { data: () => ({ uid: "stu-1", displayName: "A" }) },
        { data: () => ({ uid: "stu-2", displayName: "B" }) },
      ],
    });

    // Student summaries
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: "stu-1",
          data: () => ({
            autograde: { averageScore: 90, completedExams: 2, totalExams: 3 },
            levelup: { averageCompletion: 80, totalSpaces: 1, totalPointsEarned: 50 },
          }),
        },
        {
          id: "stu-2",
          data: () => ({
            autograde: { averageScore: 70, completedExams: 1, totalExams: 3 },
            levelup: { averageCompletion: 60, totalSpaces: 1, totalPointsEarned: 30 },
          }),
        },
      ],
    });

    await handler(makeEvent({ overallScore: 80 }));

    const setCall = mockSet.mock.calls[0][0];
    // averageClassScore = (90 + 70) / 2 = 80
    expect(setCall.autograde.averageClassScore).toBe(80);
  });

  it("should compute topPerformers and bottomPerformers (top/bottom 5)", async () => {
    // Memberships
    mockGet.mockResolvedValueOnce({
      docs: [{ data: () => ({ uid: STUDENT_ID, schoolId: "class-1" }) }],
    });

    // No existing summary
    mockGet.mockResolvedValueOnce({ exists: false });
    // Class doc
    mockGet.mockResolvedValueOnce({ data: () => ({ name: "Class B" }) });

    // 6 student memberships
    const memberDocs = Array.from({ length: 6 }, (_, i) => ({
      data: () => ({ uid: `stu-${i}`, displayName: `Student ${i}` }),
    }));
    mockGet.mockResolvedValueOnce({ docs: memberDocs });

    // 6 student summaries with varying scores
    const summaryDocs = Array.from({ length: 6 }, (_, i) => ({
      id: `stu-${i}`,
      data: () => ({
        autograde: { averageScore: 50 + i * 10, completedExams: 1, totalExams: 1 },
        levelup: { averageCompletion: 50, totalSpaces: 1, totalPointsEarned: 10 * i },
      }),
    }));
    mockGet.mockResolvedValueOnce({ docs: summaryDocs });

    await handler(makeEvent({ overallScore: 70 }));

    const setCall = mockSet.mock.calls[0][0];
    // topN and bottomN mocks sort and slice to 5
    expect(setCall.autograde.topPerformers.length).toBeLessThanOrEqual(5);
    expect(setCall.autograde.bottomPerformers.length).toBeLessThanOrEqual(5);
  });

  it("should debounce when class summary was updated within 5 minutes", async () => {
    // Memberships
    mockGet.mockResolvedValueOnce({
      docs: [{ data: () => ({ uid: STUDENT_ID, schoolId: "class-1" }) }],
    });

    // Existing class summary with recent lastUpdatedAt (1 minute ago)
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        lastUpdatedAt: {
          toMillis: () => Date.now() - 60 * 1000, // 1 min ago
        },
      }),
    });

    await handler(makeEvent({ overallScore: 80 }));

    // Should only update pendingRecalculation, not rewrite the summary
    expect(mockUpdate).toHaveBeenCalledWith({ pendingRecalculation: true });
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("should process after cooldown period has elapsed", async () => {
    // Memberships
    mockGet.mockResolvedValueOnce({
      docs: [{ data: () => ({ uid: STUDENT_ID, schoolId: "class-1" }) }],
    });

    // Existing class summary with old lastUpdatedAt (10 minutes ago)
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        lastUpdatedAt: {
          toMillis: () => Date.now() - 10 * 60 * 1000, // 10 min ago
        },
      }),
    });

    // Class doc
    mockGet.mockResolvedValueOnce({ data: () => ({ name: "Class C" }) });

    // Student memberships
    mockGet.mockResolvedValueOnce({
      docs: [{ data: () => ({ uid: "stu-1", displayName: "Alice" }) }],
    });

    // Student summaries
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: "stu-1",
          data: () => ({
            autograde: { averageScore: 75, completedExams: 1, totalExams: 1 },
            levelup: { averageCompletion: 50, totalSpaces: 1, totalPointsEarned: 50 },
          }),
        },
      ],
    });

    await handler(makeEvent({ overallScore: 75 }));

    expect(mockSet).toHaveBeenCalled();
  });

  it("should handle student with multiple classes", async () => {
    // Student belongs to 2 classes
    mockGet.mockResolvedValueOnce({
      docs: [
        { data: () => ({ uid: STUDENT_ID, schoolId: "class-1" }) },
        { data: () => ({ uid: STUDENT_ID, schoolId: "class-2" }) },
      ],
    });

    // Class-1: no existing summary
    mockGet.mockResolvedValueOnce({ exists: false });
    mockGet.mockResolvedValueOnce({ data: () => ({ name: "Class 1" }) });
    mockGet.mockResolvedValueOnce({
      docs: [{ data: () => ({ uid: "stu-1", displayName: "Alice" }) }],
    });
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: "stu-1",
          data: () => ({
            autograde: { averageScore: 80, completedExams: 1, totalExams: 1 },
            levelup: { averageCompletion: 70, totalSpaces: 1, totalPointsEarned: 50 },
          }),
        },
      ],
    });

    // Class-2: no existing summary
    mockGet.mockResolvedValueOnce({ exists: false });
    mockGet.mockResolvedValueOnce({ data: () => ({ name: "Class 2" }) });
    mockGet.mockResolvedValueOnce({
      docs: [{ data: () => ({ uid: "stu-1", displayName: "Alice" }) }],
    });
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: "stu-1",
          data: () => ({
            autograde: { averageScore: 90, completedExams: 2, totalExams: 2 },
            levelup: { averageCompletion: 80, totalSpaces: 2, totalPointsEarned: 100 },
          }),
        },
      ],
    });

    await handler(makeEvent({ overallScore: 85 }));

    // Should set class summary for both classes
    expect(mockSet).toHaveBeenCalledTimes(2);
  });

  it("should handle empty class with no student summaries", async () => {
    // Memberships
    mockGet.mockResolvedValueOnce({
      docs: [{ data: () => ({ uid: STUDENT_ID, schoolId: "class-1" }) }],
    });

    // No existing summary
    mockGet.mockResolvedValueOnce({ exists: false });
    // Class doc
    mockGet.mockResolvedValueOnce({ data: () => ({ name: "Empty Class" }) });

    // No student memberships
    mockGet.mockResolvedValueOnce({ docs: [] });

    await handler(makeEvent({ overallScore: 50 }));

    // Should return early when no studentIds
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("should track at-risk students in class summary", async () => {
    // Memberships
    mockGet.mockResolvedValueOnce({
      docs: [{ data: () => ({ uid: STUDENT_ID, schoolId: "class-1" }) }],
    });

    mockGet.mockResolvedValueOnce({ exists: false });
    mockGet.mockResolvedValueOnce({ data: () => ({ name: "Class D" }) });

    mockGet.mockResolvedValueOnce({
      docs: [
        { data: () => ({ uid: "stu-1", displayName: "Alice" }) },
        { data: () => ({ uid: "stu-2", displayName: "Bob" }) },
        { data: () => ({ uid: "stu-3", displayName: "Charlie" }) },
      ],
    });

    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: "stu-1",
          data: () => ({
            autograde: { averageScore: 90, completedExams: 1, totalExams: 1 },
            levelup: { averageCompletion: 90, totalSpaces: 1, totalPointsEarned: 100 },
            isAtRisk: false,
          }),
        },
        {
          id: "stu-2",
          data: () => ({
            autograde: { averageScore: 40, completedExams: 1, totalExams: 1 },
            levelup: { averageCompletion: 20, totalSpaces: 1, totalPointsEarned: 10 },
            isAtRisk: true,
          }),
        },
        {
          id: "stu-3",
          data: () => ({
            autograde: { averageScore: 35, completedExams: 1, totalExams: 1 },
            levelup: { averageCompletion: 15, totalSpaces: 1, totalPointsEarned: 5 },
            isAtRisk: true,
          }),
        },
      ],
    });

    await handler(makeEvent({ overallScore: 60 }));

    const setCall = mockSet.mock.calls[0][0];
    expect(setCall.atRiskStudentIds).toEqual(["stu-2", "stu-3"]);
    expect(setCall.atRiskCount).toBe(2);
  });

  it("should log summary after updating class progress", async () => {
    // Memberships
    mockGet.mockResolvedValueOnce({
      docs: [{ data: () => ({ uid: STUDENT_ID, schoolId: "class-1" }) }],
    });

    mockGet.mockResolvedValueOnce({ exists: false });
    mockGet.mockResolvedValueOnce({ data: () => ({ name: "Class E" }) });
    mockGet.mockResolvedValueOnce({
      docs: [{ data: () => ({ uid: "stu-1", displayName: "Alice" }) }],
    });
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: "stu-1",
          data: () => ({
            autograde: { averageScore: 80, completedExams: 1, totalExams: 1 },
            levelup: { averageCompletion: 60, totalSpaces: 1, totalPointsEarned: 50 },
          }),
        },
      ],
    });

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await handler(makeEvent({ overallScore: 70 }));

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Updated class summary"));

    consoleSpy.mockRestore();
  });
});
