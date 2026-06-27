/**
 * Unit tests for onQuestionSubmissionUpdated trigger.
 * Verifies grading status aggregation and submission pipeline transitions
 * (grading_complete, grading_partial, manual_review_needed).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Stable mocks ────────────────────────────────────────────────────────────
const mockGet = vi.fn();
const mockUpdate = vi.fn().mockResolvedValue({});

const stableDb: any = {
  doc: vi.fn(() => ({ get: mockGet, update: mockUpdate })),
  collection: vi.fn(() => ({
    get: mockGet,
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
  onDocumentUpdated: (_opts: any, handler: any) => handler,
}));

vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Import handler ──────────────────────────────────────────────────────────
import { onQuestionSubmissionUpdatedV2 } from "../../triggers/on-question-submission-updated";
const handler = onQuestionSubmissionUpdatedV2 as any;

const TENANT = "tenant-1";
const SUBMISSION_ID = "sub-1";
const QUESTION_ID = "q-1";

function makeEvent(
  beforeData: Record<string, any> | null,
  afterData: Record<string, any> | null,
  params = { tenantId: TENANT, submissionId: SUBMISSION_ID, questionId: QUESTION_ID }
) {
  return {
    data: {
      before: { data: () => beforeData },
      after: { data: () => afterData },
    },
    params,
  };
}

describe("onQuestionSubmissionUpdated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return early when event data is null", async () => {
    await handler(makeEvent(null, null));

    expect(mockGet).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("should return early when gradingStatus has not changed", async () => {
    await handler(makeEvent({ gradingStatus: "graded" }, { gradingStatus: "graded" }));

    expect(mockGet).not.toHaveBeenCalled();
  });

  it("should return early when new status is not a terminal status", async () => {
    await handler(makeEvent({ gradingStatus: "pending" }, { gradingStatus: "processing" }));

    expect(mockGet).not.toHaveBeenCalled();
  });

  it("should transition to grading_complete when all questions are graded", async () => {
    mockGet.mockResolvedValueOnce({
      empty: false,
      size: 3,
      docs: [
        { data: () => ({ gradingStatus: "graded" }) },
        { data: () => ({ gradingStatus: "graded" }) },
        { data: () => ({ gradingStatus: "graded" }) },
      ],
    });

    await handler(makeEvent({ gradingStatus: "pending" }, { gradingStatus: "graded" }));

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        pipelineStatus: "grading_complete",
      })
    );
  });

  it("should count graded and failed questions correctly", async () => {
    mockGet.mockResolvedValueOnce({
      empty: false,
      size: 4,
      docs: [
        { data: () => ({ gradingStatus: "graded" }) },
        { data: () => ({ gradingStatus: "manual" }) },
        { data: () => ({ gradingStatus: "failed" }) },
        { data: () => ({ gradingStatus: "overridden" }) },
      ],
    });

    await handler(makeEvent({ gradingStatus: "pending" }, { gradingStatus: "failed" }));

    // 3 graded (graded + manual + overridden), 1 failed => grading_partial
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        pipelineStatus: "grading_partial",
        "summary.questionsGraded": 3,
        "summary.totalQuestions": 4,
      })
    );
  });

  it("should handle partial grading with mixed graded and failed", async () => {
    mockGet.mockResolvedValueOnce({
      empty: false,
      size: 3,
      docs: [
        { data: () => ({ gradingStatus: "graded" }) },
        { data: () => ({ gradingStatus: "failed" }) },
        { data: () => ({ gradingStatus: "graded" }) },
      ],
    });

    await handler(makeEvent({ gradingStatus: "pending" }, { gradingStatus: "graded" }));

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        pipelineStatus: "grading_partial",
      })
    );
  });

  it("should transition to manual_review_needed when all questions failed", async () => {
    mockGet.mockResolvedValueOnce({
      empty: false,
      size: 2,
      docs: [
        { data: () => ({ gradingStatus: "failed" }) },
        { data: () => ({ gradingStatus: "failed" }) },
      ],
    });

    await handler(makeEvent({ gradingStatus: "pending" }, { gradingStatus: "failed" }));

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        pipelineStatus: "manual_review_needed",
      })
    );
  });

  it("should not update when some questions are still pending", async () => {
    mockGet.mockResolvedValueOnce({
      empty: false,
      size: 3,
      docs: [
        { data: () => ({ gradingStatus: "graded" }) },
        { data: () => ({ gradingStatus: "pending" }) },
        { data: () => ({ gradingStatus: "graded" }) },
      ],
    });

    await handler(makeEvent({ gradingStatus: "pending" }, { gradingStatus: "graded" }));

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("should handle empty question submissions", async () => {
    mockGet.mockResolvedValueOnce({ empty: true, size: 0, docs: [] });

    await handler(makeEvent({ gradingStatus: "pending" }, { gradingStatus: "graded" }));

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
