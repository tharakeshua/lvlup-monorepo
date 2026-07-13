/**
 * Unit tests for onSubmissionCreated trigger.
 * Verifies pipeline kickoff: status transition to 'scouting',
 * answer mapping invocation, and error handling.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Stable mocks (hoisted for vi.mock factory access) ───────────────────────
const { mockUpdate, mockProcessAnswerMapping } = vi.hoisted(() => ({
  mockUpdate: vi.fn().mockResolvedValue({}),
  mockProcessAnswerMapping: vi.fn().mockResolvedValue({}),
}));

const stableDb: any = {
  doc: vi.fn(() => ({ update: mockUpdate })),
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
  onDocumentCreated: (_opts: any, handler: any) => handler,
}));

vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../../pipeline/process-answer-mapping", () => ({
  processAnswerMapping: mockProcessAnswerMapping,
}));

// ── Import handler ──────────────────────────────────────────────────────────
import { onSubmissionCreated } from "../../triggers/on-submission-created";
const handler = onSubmissionCreated as any;

const TENANT = "tenant-1";
const SUBMISSION_ID = "sub-1";

function makeEvent(
  data: Record<string, any> | null,
  params = { tenantId: TENANT, submissionId: SUBMISSION_ID }
) {
  return {
    data: data ? { data: () => data } : null,
    params,
  };
}

describe("onSubmissionCreated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return early when snapshot is null", async () => {
    await handler(makeEvent(null));

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockProcessAnswerMapping).not.toHaveBeenCalled();
  });

  it("should return early when answerSheets images are missing", async () => {
    await handler(makeEvent({ pipelineStatus: "uploaded", answerSheets: {} }));

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("should return early when pipelineStatus is not uploaded", async () => {
    await handler(
      makeEvent({
        pipelineStatus: "grading",
        answerSheets: { images: ["img1.png"] },
      })
    );

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("should transition status to scouting and run answer mapping", async () => {
    await handler(
      makeEvent({
        pipelineStatus: "uploaded",
        answerSheets: { images: ["img1.png", "img2.png"] },
      })
    );

    // First update: transition to scouting
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        pipelineStatus: "scouting",
      })
    );

    // Should call processAnswerMapping with tenantId and submissionId
    expect(mockProcessAnswerMapping).toHaveBeenCalledWith(TENANT, SUBMISSION_ID);
  });

  it("should handle pipeline error by setting scouting_failed status", async () => {
    mockProcessAnswerMapping.mockRejectedValueOnce(new Error("OCR service unavailable"));

    await handler(
      makeEvent({
        pipelineStatus: "uploaded",
        answerSheets: { images: ["img1.png"] },
      })
    );

    // First call: transition to scouting
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ pipelineStatus: "scouting" })
    );

    // Second call: transition to scouting_failed with error message
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        pipelineStatus: "scouting_failed",
        pipelineError: "OCR service unavailable",
      })
    );
  });

  it("should record pipelineError message from non-Error objects", async () => {
    mockProcessAnswerMapping.mockRejectedValueOnce("string error reason");

    await handler(
      makeEvent({
        pipelineStatus: "uploaded",
        answerSheets: { images: ["img1.png"] },
      })
    );

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        pipelineStatus: "scouting_failed",
        pipelineError: "string error reason",
      })
    );
  });
});
