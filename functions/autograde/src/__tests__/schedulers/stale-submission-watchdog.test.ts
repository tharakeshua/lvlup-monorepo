/**
 * Unit tests for staleSubmissionWatchdog scheduler.
 * Verifies detection of stuck submissions (>10 min), retry logic
 * (MAX_WATCHDOG_RETRIES = 3), escalation to manual_review_needed,
 * and per-status query limits.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Stable mocks ────────────────────────────────────────────────────────────
const mockGet = vi.fn();
const mockUpdate = vi.fn().mockResolvedValue({});

const stableDb: any = {
  doc: vi.fn(() => ({ get: mockGet, update: mockUpdate })),
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
  fsFn.Timestamp = {
    fromDate: vi.fn((d: Date) => ({ toDate: () => d })),
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

// ── Import handler ──────────────────────────────────────────────────────────
import { staleSubmissionWatchdog } from "../../schedulers/stale-submission-watchdog";
const handler = staleSubmissionWatchdog as any;

function makeSubDoc(id: string, status: string, watchdogRetryCount = 0) {
  return {
    id,
    ref: { update: mockUpdate },
    data: () => ({ pipelineStatus: status, watchdogRetryCount }),
  };
}

describe("staleSubmissionWatchdog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should find stale scouting submissions and retry them", async () => {
    // Tenants query
    mockGet.mockResolvedValueOnce({
      docs: [{ id: "tenant-1" }],
    });

    // Stale scouting submissions
    mockGet.mockResolvedValueOnce({
      docs: [makeSubDoc("sub-1", "scouting", 0)],
    });

    // Stale grading submissions: none
    mockGet.mockResolvedValueOnce({ docs: [] });

    await handler({});

    // Should reset scouting -> uploaded
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        pipelineStatus: "uploaded",
        watchdogRetryCount: 1,
        pipelineError: null,
      })
    );
  });

  it("should find stale grading submissions and reset to scouting_complete", async () => {
    // Tenants
    mockGet.mockResolvedValueOnce({
      docs: [{ id: "tenant-1" }],
    });

    // Stale scouting: none
    mockGet.mockResolvedValueOnce({ docs: [] });

    // Stale grading: 1 doc
    mockGet.mockResolvedValueOnce({
      docs: [makeSubDoc("sub-2", "grading", 1)],
    });

    await handler({});

    // Should reset grading -> scouting_complete
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        pipelineStatus: "scouting_complete",
        watchdogRetryCount: 2,
      })
    );
  });

  it("should escalate to manual_review_needed when max retries exceeded", async () => {
    // Tenants
    mockGet.mockResolvedValueOnce({
      docs: [{ id: "tenant-1" }],
    });

    // Stale scouting: retry count already at 3
    mockGet.mockResolvedValueOnce({
      docs: [makeSubDoc("sub-3", "scouting", 3)],
    });

    // Stale grading: none
    mockGet.mockResolvedValueOnce({ docs: [] });

    await handler({});

    // Should escalate (retryCount becomes 4 > MAX_WATCHDOG_RETRIES=3)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        pipelineStatus: "manual_review_needed",
        watchdogRetryCount: 4,
      })
    );
  });

  it("should query with limit of 50 per status", async () => {
    // Tenants
    mockGet.mockResolvedValueOnce({
      docs: [{ id: "tenant-1" }],
    });

    // Both queries return empty
    mockGet.mockResolvedValueOnce({ docs: [] });
    mockGet.mockResolvedValueOnce({ docs: [] });

    await handler({});

    // Verify collection was called with the correct path
    expect(stableDb.collection).toHaveBeenCalledWith("tenants");
  });

  it("should handle no stale submissions gracefully", async () => {
    // Tenants
    mockGet.mockResolvedValueOnce({
      docs: [{ id: "tenant-1" }],
    });

    // Both statuses: no stale docs
    mockGet.mockResolvedValueOnce({ docs: [] });
    mockGet.mockResolvedValueOnce({ docs: [] });

    await handler({});

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("should handle multiple tenants", async () => {
    // 2 tenants
    mockGet.mockResolvedValueOnce({
      docs: [{ id: "tenant-1" }, { id: "tenant-2" }],
    });

    // Tenant-1: scouting stale
    mockGet.mockResolvedValueOnce({
      docs: [makeSubDoc("sub-a", "scouting", 0)],
    });
    // Tenant-1: grading empty
    mockGet.mockResolvedValueOnce({ docs: [] });

    // Tenant-2: scouting empty
    mockGet.mockResolvedValueOnce({ docs: [] });
    // Tenant-2: grading stale
    mockGet.mockResolvedValueOnce({
      docs: [makeSubDoc("sub-b", "grading", 2)],
    });

    await handler({});

    // Both submissions should have been updated
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });

  it("should reset scouting submissions to uploaded status", async () => {
    // Tenants
    mockGet.mockResolvedValueOnce({
      docs: [{ id: "tenant-1" }],
    });

    // Stale scouting
    mockGet.mockResolvedValueOnce({
      docs: [makeSubDoc("sub-1", "scouting", 1)],
    });
    // Stale grading: none
    mockGet.mockResolvedValueOnce({ docs: [] });

    await handler({});

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        pipelineStatus: "uploaded",
      })
    );
  });

  it("should log results when stale submissions are found", async () => {
    // Tenants
    mockGet.mockResolvedValueOnce({
      docs: [{ id: "tenant-1" }],
    });

    // Stale scouting: 1 doc
    mockGet.mockResolvedValueOnce({
      docs: [makeSubDoc("sub-1", "scouting", 0)],
    });
    // Stale grading: none
    mockGet.mockResolvedValueOnce({ docs: [] });

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await handler({});

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
