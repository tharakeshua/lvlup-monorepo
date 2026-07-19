import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock firebase-admin
// ---------------------------------------------------------------------------
const mockDocId = "mock-doc-id-123";
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockDoc = vi.fn(() => ({ id: mockDocId, set: mockSet }));
const mockCollection = vi.fn(() => ({ doc: mockDoc }));

vi.mock("firebase-admin", () => ({
  default: {
    firestore: Object.assign(() => ({ collection: mockCollection }), {
      Timestamp: { now: () => ({ seconds: 1000, nanoseconds: 0 }) },
    }),
  },
  firestore: Object.assign(() => ({ collection: mockCollection }), {
    Timestamp: { now: () => ({ seconds: 1000, nanoseconds: 0 }) },
  }),
}));

import { logLLMCall, _setFirestoreForTesting, type LogLLMCallParams } from "../ai/llm-logger";
import { buildTokenUsage, estimateCost } from "../ai/cost-tracker";

describe("llm-logger", () => {
  const baseParams: LogLLMCallParams = {
    tenantId: "tenant-1",
    userId: "user-1",
    userRole: "teacher",
    purpose: "answer_grading",
    operation: "relmsEvaluation",
    resourceType: "questionSubmission",
    resourceId: "qs-1",
    model: "gemini-2.5-flash",
    tokens: buildTokenUsage(500, 200),
    cost: estimateCost("gemini-2.5-flash", buildTokenUsage(500, 200)),
    latencyMs: 1234,
    success: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Use the mock firestore
    _setFirestoreForTesting({ collection: mockCollection } as any);
  });

  it("logs a successful LLM call and returns a callId", async () => {
    const callId = await logLLMCall(baseParams);
    expect(callId).toBe(mockDocId);
    expect(mockCollection).toHaveBeenCalledWith("tenants/tenant-1/llmCallLogs");
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        callId: mockDocId,
        tenantId: "tenant-1",
        userId: "user-1",
        success: true,
        model: "gemini-2.5-flash",
      })
    );
  });

  it("includes error field when provided", async () => {
    const params = { ...baseParams, success: false, error: "Rate limit exceeded" };
    await logLLMCall(params);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Rate limit exceeded",
        success: false,
      })
    );
  });

  it("includes timing data", async () => {
    await logLLMCall(baseParams);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        timing: { latencyMs: 1234 },
      })
    );
  });

  it("writes to the correct tenant subcollection", async () => {
    const params = { ...baseParams, tenantId: "other-tenant" };
    await logLLMCall(params);
    expect(mockCollection).toHaveBeenCalledWith("tenants/other-tenant/llmCallLogs");
  });
});
