import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Stable mocks ────────────────────────────────────────────────────────────
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockUpdate = vi.fn();
const mockRunTransaction = vi.fn();
const mockBatch = { set: vi.fn(), update: vi.fn(), commit: vi.fn() };

const stableDb: any = {
  doc: vi.fn(() => ({ get: mockGet, set: mockSet, update: mockUpdate })),
  collection: vi.fn(() => ({
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: mockGet,
  })),
  batch: vi.fn(() => mockBatch),
  runTransaction: mockRunTransaction,
  collectionGroup: vi.fn(() => ({
    where: vi.fn().mockReturnThis(),
    get: mockGet,
  })),
};

vi.mock("firebase-admin", () => {
  const fsFn: any = () => stableDb;
  fsFn.FieldValue = {
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
    increment: vi.fn((n: number) => `INCREMENT(${n})`),
  };
  fsFn.FieldPath = {
    documentId: vi.fn(() => "__document_id__"),
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

vi.mock("../../utils/aggregation-helpers", async (importOriginal) => ({
  // Keep the real module (legacyMillis is used by the recent-exams sort).
  ...(await importOriginal<Record<string, unknown>>()),
  computeOverallScore: vi.fn(() => 0.75),
  identifyStrengthsAndWeaknesses: vi.fn(() => ({ strengthAreas: [], weaknessAreas: [] })),
  topN: vi.fn((arr: any[]) => arr.slice(0, 10)),
}));

// ── Import handler ──────────────────────────────────────────────────────────
import { onSubmissionGraded } from "../../triggers/on-submission-graded";
const handler = onSubmissionGraded as any;

const TENANT = "tenant-1";
const SUBMISSION_ID = "sub-1";

function makeEvent(beforeData: any, afterData: any) {
  return {
    params: { tenantId: TENANT, submissionId: SUBMISSION_ID },
    data: {
      before: { data: () => beforeData },
      after: {
        data: () => afterData,
        ref: { path: `tenants/${TENANT}/submissions/${SUBMISSION_ID}` },
      },
    },
  };
}

describe("onSubmissionGraded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should skip when pipelineStatus has not changed to graded", async () => {
    const event = makeEvent(
      { pipelineStatus: "uploaded", studentUid: "stu-1" },
      { pipelineStatus: "uploaded", studentUid: "stu-1" }
    );
    await handler(event);
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it("should process when pipelineStatus transitions to graded", async () => {
    const event = makeEvent(
      { pipelineStatus: "uploaded", studentUid: "stu-1", examId: "exam-1" },
      { pipelineStatus: "graded", studentUid: "stu-1", examId: "exam-1" }
    );

    // Mock: student submissions query
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: "sub-1",
          data: () => ({
            examId: "exam-1",
            totalScore: 80,
            maxScore: 100,
            pipelineStatus: "graded",
          }),
        },
      ],
    });

    // Mock: exam metadata
    mockGet.mockResolvedValueOnce({
      docs: [{ id: "exam-1", data: () => ({ subject: "Math", title: "Test 1", maxScore: 100 }) }],
    });

    mockRunTransaction.mockImplementation(async (fn: any) => {
      const txn = {
        get: vi.fn().mockResolvedValue({ exists: true, data: () => ({}) }),
        set: vi.fn(),
        update: vi.fn(),
      };
      await fn(txn);
    });

    await handler(event);
    expect(mockRunTransaction).toHaveBeenCalled();
  });

  it("should skip when before status is already in graded set", async () => {
    // before.pipelineStatus='graded' is in GRADED_STATUSES, so handler exits early
    const event = makeEvent(
      { pipelineStatus: "graded", studentUid: "stu-1", examId: "exam-1" },
      { pipelineStatus: "grading_complete", studentUid: "stu-1", examId: "exam-1" }
    );

    await handler(event);
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });
});
