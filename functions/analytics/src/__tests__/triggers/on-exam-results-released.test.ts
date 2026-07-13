import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Stable mocks ────────────────────────────────────────────────────────────
const mockGet = vi.fn();
const mockSet = vi.fn();

const stableDb: any = {
  doc: vi.fn(() => ({ get: mockGet, set: mockSet })),
  collection: vi.fn(() => ({
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: mockGet,
    doc: vi.fn(() => ({ get: mockGet, set: mockSet })),
  })),
};

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
  onDocumentUpdated: vi.fn((_opts: any, handler: any) => handler),
}));

vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { onExamResultsReleased } from "../../triggers/on-exam-results-released";
const handler = onExamResultsReleased as any;

const TENANT = "tenant-1";
const EXAM_ID = "exam-1";

function makeEvent(beforeData: any, afterData: any) {
  return {
    params: { tenantId: TENANT, examId: EXAM_ID },
    data: {
      before: { data: () => beforeData },
      after: { data: () => afterData, ref: { path: `tenants/${TENANT}/exams/${EXAM_ID}` } },
    },
  };
}

describe("onExamResultsReleased", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should skip when status has not changed to results_released", async () => {
    const event = makeEvent({ status: "draft" }, { status: "published" });
    await handler(event);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("should process when status transitions to results_released", async () => {
    const event = makeEvent(
      { status: "published" },
      { status: "results_released", maxScore: 100, subject: "Math", title: "Unit Test Exam" }
    );

    // Mock submissions query
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: "sub-1",
          data: () => ({
            studentUid: "stu-1",
            totalScore: 85,
            maxScore: 100,
            classId: "class-1",
            pipelineStatus: "graded",
          }),
        },
        {
          id: "sub-2",
          data: () => ({
            studentUid: "stu-2",
            totalScore: 70,
            maxScore: 100,
            classId: "class-1",
            pipelineStatus: "graded",
          }),
        },
      ],
    });

    // Mock question submissions (per submission)
    mockGet.mockResolvedValueOnce({ docs: [] });
    mockGet.mockResolvedValueOnce({ docs: [] });

    await handler(event);
    expect(mockSet).toHaveBeenCalled();
  });

  it("should handle exam with no submissions", async () => {
    const event = makeEvent({ status: "published" }, { status: "results_released", maxScore: 100 });

    mockGet.mockResolvedValueOnce({ docs: [] });

    await handler(event);
    // Should still create analytics doc (with zero submissions)
    expect(mockSet).toHaveBeenCalled();
  });
});
