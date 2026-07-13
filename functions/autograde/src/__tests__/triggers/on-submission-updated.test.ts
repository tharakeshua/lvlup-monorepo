/**
 * Unit tests for onSubmissionUpdated trigger.
 * Verifies pipeline state machine transitions, retry logic (MAX_RETRIES = 3),
 * dead letter queue creation, and error handling at each pipeline step.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Stable mocks (hoisted for vi.mock factory access) ───────────────────────
const {
  mockGet,
  mockUpdate,
  mockSet,
  mockProcessAnswerMapping,
  mockProcessAnswerGrading,
  mockFinalizeSubmission,
} = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockUpdate: vi.fn().mockResolvedValue({}),
  mockSet: vi.fn().mockResolvedValue({}),
  mockProcessAnswerMapping: vi.fn().mockResolvedValue({}),
  mockProcessAnswerGrading: vi.fn().mockResolvedValue({}),
  mockFinalizeSubmission: vi.fn().mockResolvedValue({}),
}));

const stableDb: any = {
  doc: vi.fn(() => ({ get: mockGet, update: mockUpdate, set: mockSet })),
  collection: vi.fn(() => ({
    doc: vi.fn(() => ({ id: "dlq-auto-id", set: mockSet })),
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

vi.mock("../../pipeline/process-answer-mapping", () => ({
  processAnswerMapping: mockProcessAnswerMapping,
}));

vi.mock("../../pipeline/process-answer-grading", () => ({
  processAnswerGrading: mockProcessAnswerGrading,
}));

vi.mock("../../pipeline/finalize-submission", () => ({
  finalizeSubmission: mockFinalizeSubmission,
}));

// ── Import handler ──────────────────────────────────────────────────────────
import { onSubmissionUpdated } from "../../triggers/on-submission-updated";
const handler = onSubmissionUpdated as any;

const TENANT = "tenant-1";
const SUBMISSION_ID = "sub-1";

function makeEvent(
  beforeData: Record<string, any> | null,
  afterData: Record<string, any> | null,
  params = { tenantId: TENANT, submissionId: SUBMISSION_ID }
) {
  return {
    data: {
      before: { data: () => beforeData },
      after: { data: () => afterData },
    },
    params,
  };
}

describe("onSubmissionUpdated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Early returns ──────────────────────────────────────────────────

  it("should return early when event data is null", async () => {
    await handler(makeEvent(null, null));

    expect(mockProcessAnswerMapping).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("should not act when pipelineStatus has not changed", async () => {
    await handler(makeEvent({ pipelineStatus: "scouting" }, { pipelineStatus: "scouting" }));

    expect(mockProcessAnswerMapping).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  // ── scouting_complete -> grading ───────────────────────────────────

  it("should transition from scouting_complete to grading", async () => {
    await handler(
      makeEvent({ pipelineStatus: "scouting" }, { pipelineStatus: "scouting_complete" })
    );

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        pipelineStatus: "grading",
      })
    );
  });

  // ── grading step ───────────────────────────────────────────────────

  it("should call processAnswerGrading when status transitions to grading", async () => {
    await handler(
      makeEvent({ pipelineStatus: "scouting_complete" }, { pipelineStatus: "grading" })
    );

    expect(mockProcessAnswerGrading).toHaveBeenCalledWith(TENANT, SUBMISSION_ID);
  });

  // ── grading_complete -> finalization ────────────────────────────────

  it("should call finalizeSubmission when status transitions to grading_complete", async () => {
    await handler(makeEvent({ pipelineStatus: "grading" }, { pipelineStatus: "grading_complete" }));

    expect(mockFinalizeSubmission).toHaveBeenCalledWith(TENANT, SUBMISSION_ID);
  });

  // ── scouting retry logic ───────────────────────────────────────────

  it("should retry scouting when scouting_failed and retries remain", async () => {
    await handler(
      makeEvent(
        { pipelineStatus: "scouting" },
        { pipelineStatus: "scouting_failed", retryCount: 1 }
      )
    );

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        pipelineStatus: "scouting",
        retryCount: 2,
      })
    );
  });

  it("should create dead letter entry when max retries exceeded for scouting", async () => {
    await handler(
      makeEvent(
        { pipelineStatus: "scouting" },
        { pipelineStatus: "scouting_failed", retryCount: 3, pipelineError: "OCR timeout" }
      )
    );

    // Should transition to manual_review_needed
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        pipelineStatus: "manual_review_needed",
      })
    );

    // Should create DLQ entry
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionId: SUBMISSION_ID,
        pipelineStep: "scouting",
        error: "OCR timeout",
        attempts: 3,
      })
    );
  });

  // ── scouting step ──────────────────────────────────────────────────

  it("should call processAnswerMapping when status transitions to scouting", async () => {
    await handler(makeEvent({ pipelineStatus: "uploaded" }, { pipelineStatus: "scouting" }));

    expect(mockProcessAnswerMapping).toHaveBeenCalledWith(TENANT, SUBMISSION_ID);
  });

  // ── Error handling ─────────────────────────────────────────────────

  it("should set scouting_failed on error during scouting", async () => {
    mockProcessAnswerMapping.mockRejectedValueOnce(new Error("OCR crash"));

    await handler(makeEvent({ pipelineStatus: "uploaded" }, { pipelineStatus: "scouting" }));

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        pipelineStatus: "scouting_failed",
        pipelineError: "OCR crash",
      })
    );
  });

  it("should set grading_failed and create DLQ on error during grading", async () => {
    mockProcessAnswerGrading.mockRejectedValueOnce(new Error("LLM rate limited"));

    await handler(
      makeEvent({ pipelineStatus: "scouting_complete" }, { pipelineStatus: "grading" })
    );

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        pipelineStatus: "grading_failed",
        pipelineError: "LLM rate limited",
      })
    );

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionId: SUBMISSION_ID,
        pipelineStep: "grading",
      })
    );
  });

  it("should set finalization_failed and create DLQ on error during grading_complete", async () => {
    mockFinalizeSubmission.mockRejectedValueOnce(new Error("Score calculation failed"));

    await handler(makeEvent({ pipelineStatus: "grading" }, { pipelineStatus: "grading_complete" }));

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        pipelineStatus: "finalization_failed",
        pipelineError: "Score calculation failed",
      })
    );

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionId: SUBMISSION_ID,
        pipelineStep: "grading",
      })
    );
  });

  it("should not act on unrecognized status transitions", async () => {
    await handler(makeEvent({ pipelineStatus: "grading" }, { pipelineStatus: "finalized" }));

    expect(mockProcessAnswerMapping).not.toHaveBeenCalled();
    expect(mockProcessAnswerGrading).not.toHaveBeenCalled();
    expect(mockFinalizeSubmission).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
