/**
 * Tests for onUserStoryPointProgressWrite trigger.
 *
 * Covers:
 *  1. Detecting newly completed story points
 *  2. Skipping when no story points are newly completed
 *  3. Skipping on document deletion
 *  4. Updating RTDB story-point leaderboard entries
 *  5. Updating RTDB course-level leaderboard with aggregate scores
 *  6. Recalculating student progress summary via transaction
 *  7. Handling multiple story points completing at once
 *  8. Handling first write (no before data)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockFirestore } from "../../../test-utils/mock-firestore";

// ── Mock firebase-admin ──────────────────────────────────────────────────

const mockFirestore = createMockFirestore();

const rtdbUpdates: Record<string, any>[] = [];
const mockRtdbRef = {
  update: vi.fn(async (updates: Record<string, any>) => {
    rtdbUpdates.push(updates);
  }),
};

vi.mock("firebase-admin", () => {
  const firestoreFn: any = () => mockFirestore.db;
  firestoreFn.FieldValue = {
    serverTimestamp: () => ({ _sentinel: "serverTimestamp" }),
  };

  const databaseFn: any = () => ({ ref: () => mockRtdbRef });
  databaseFn.ServerValue = { TIMESTAMP: { ".sv": "timestamp" } };

  return {
    firestore: firestoreFn,
    database: databaseFn,
    initializeApp: vi.fn(),
  };
});

vi.mock("firebase-functions/v2/firestore", () => ({
  onDocumentWritten: (_opts: any, handler: Function) => handler,
}));

vi.mock("../utils/aggregation-helpers", () => ({
  computeOverallScore: vi.fn((autograde: number, levelup: number) => {
    return autograde * 0.6 + (levelup / 100) * 0.4;
  }),
  identifyStrengthsAndWeaknesses: vi.fn(() => ({
    strengths: ["Mathematics"],
    weaknesses: [],
  })),
}));

// ── Import under test (after mocks) ─────────────────────────────────────

import { onUserStoryPointProgressWrite } from "../triggers/on-user-story-point-progress-write";

// ── Helpers ──────────────────────────────────────────────────────────────

const handler = onUserStoryPointProgressWrite as unknown as (event: any) => Promise<void>;

function makeEvent(
  beforeData: Record<string, any> | null,
  afterData: Record<string, any> | null,
  params: Record<string, string> = {}
) {
  return {
    data: {
      before: { data: () => beforeData },
      after: { data: () => afterData },
    },
    params: { tenantId: "tenant-1", progressId: "prog-1", ...params },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("onUserStoryPointProgressWrite — skip conditions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rtdbUpdates.length = 0;
  });

  it("should skip when document is deleted (afterData is null)", async () => {
    const event = makeEvent({ userId: "u1", spaceId: "s1", storyPoints: {} }, null);
    await handler(event);

    expect(mockRtdbRef.update).not.toHaveBeenCalled();
  });

  it("should skip when no story points are newly completed", async () => {
    const storyPoints = {
      sp1: { status: "in_progress", pointsEarned: 5, totalPoints: 10 },
    };
    const event = makeEvent(
      { userId: "u1", spaceId: "s1", storyPoints },
      { userId: "u1", spaceId: "s1", storyPoints }
    );
    await handler(event);

    expect(mockRtdbRef.update).not.toHaveBeenCalled();
  });

  it("should skip when story point was already completed before", async () => {
    const before = {
      sp1: { status: "completed", pointsEarned: 10, totalPoints: 10 },
    };
    const after = {
      sp1: { status: "completed", pointsEarned: 10, totalPoints: 10 },
    };
    const event = makeEvent(
      { userId: "u1", spaceId: "s1", storyPoints: before },
      { userId: "u1", spaceId: "s1", storyPoints: after }
    );
    await handler(event);

    expect(mockRtdbRef.update).not.toHaveBeenCalled();
  });
});

describe("onUserStoryPointProgressWrite — newly completed detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rtdbUpdates.length = 0;
    // Default: transaction.get returns an empty summary doc
    mockFirestore.transaction.get.mockResolvedValue({
      data: () => ({}),
    });
  });

  it("should detect a story point transitioning to completed", async () => {
    const before = {
      sp1: { status: "in_progress", pointsEarned: 5, totalPoints: 10 },
    };
    const after = {
      sp1: {
        status: "completed",
        pointsEarned: 10,
        totalPoints: 10,
        percentage: 100,
        completedAt: 1700000000000,
      },
    };

    const event = makeEvent(
      { userId: "u1", spaceId: "s1", storyPoints: before },
      { userId: "u1", spaceId: "s1", storyPoints: after }
    );
    await handler(event);

    expect(mockRtdbRef.update).toHaveBeenCalled();
    const updates = rtdbUpdates[0];
    expect(updates["storyPointLeaderboard/sp1/u1"]).toBeDefined();
    expect(updates["storyPointLeaderboard/sp1/u1"].score).toBe(10);
  });

  it("should detect newly completed on first write (no before data)", async () => {
    const after = {
      sp1: {
        status: "completed",
        pointsEarned: 8,
        totalPoints: 10,
        percentage: 80,
        completedAt: 1700000000000,
      },
    };

    const event = makeEvent(null, { userId: "u1", spaceId: "s1", storyPoints: after });
    await handler(event);

    expect(mockRtdbRef.update).toHaveBeenCalled();
    const updates = rtdbUpdates[0];
    expect(updates["storyPointLeaderboard/sp1/u1"].score).toBe(8);
    expect(updates["storyPointLeaderboard/sp1/u1"].percentage).toBe(80);
  });

  it("should handle multiple story points completing simultaneously", async () => {
    const before = {
      sp1: { status: "in_progress", pointsEarned: 0, totalPoints: 10 },
      sp2: { status: "in_progress", pointsEarned: 0, totalPoints: 20 },
      sp3: { status: "completed", pointsEarned: 15, totalPoints: 15 },
    };
    const after = {
      sp1: {
        status: "completed",
        pointsEarned: 8,
        totalPoints: 10,
        percentage: 80,
        completedAt: 1700000000000,
      },
      sp2: {
        status: "completed",
        pointsEarned: 18,
        totalPoints: 20,
        percentage: 90,
        completedAt: 1700000000000,
      },
      sp3: {
        status: "completed",
        pointsEarned: 15,
        totalPoints: 15,
        percentage: 100,
        completedAt: 1700000000000,
      },
    };

    const event = makeEvent(
      { userId: "u1", spaceId: "s1", storyPoints: before },
      { userId: "u1", spaceId: "s1", storyPoints: after }
    );
    await handler(event);

    expect(mockRtdbRef.update).toHaveBeenCalled();
    const updates = rtdbUpdates[0];
    // sp1 and sp2 are newly completed, sp3 was already completed
    expect(updates["storyPointLeaderboard/sp1/u1"]).toBeDefined();
    expect(updates["storyPointLeaderboard/sp2/u1"]).toBeDefined();
    expect(updates["storyPointLeaderboard/sp3/u1"]).toBeUndefined();
  });
});

describe("onUserStoryPointProgressWrite — RTDB leaderboard updates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rtdbUpdates.length = 0;
    mockFirestore.transaction.get.mockResolvedValue({
      data: () => ({}),
    });
  });

  it("should update course-level leaderboard with aggregate scores", async () => {
    const after = {
      sp1: {
        status: "completed",
        pointsEarned: 10,
        totalPoints: 10,
        percentage: 100,
        completedAt: 1700000000000,
      },
      sp2: { status: "in_progress", pointsEarned: 5, totalPoints: 20 },
    };

    const event = makeEvent(
      { userId: "u1", spaceId: "space-1", storyPoints: {} },
      { userId: "u1", spaceId: "space-1", storyPoints: after }
    );
    await handler(event);

    const updates = rtdbUpdates[0];
    const courseEntry = updates["courseLeaderboard/space-1/u1"];
    expect(courseEntry).toBeDefined();
    expect(courseEntry.score).toBe(15); // 10 + 5
    expect(courseEntry.totalPoints).toBe(30); // 10 + 20
    expect(courseEntry.completedStoryPoints).toBe(1);
    expect(courseEntry.totalStoryPoints).toBe(2);
    expect(courseEntry.percentage).toBe(50); // 15/30 * 100
  });

  it("should compute 0% when totalPointsAvailable is 0", async () => {
    const after = {
      sp1: {
        status: "completed",
        pointsEarned: 0,
        totalPoints: 0,
        percentage: 0,
        completedAt: 1700000000000,
      },
    };

    const event = makeEvent(
      { userId: "u1", spaceId: "space-1", storyPoints: {} },
      { userId: "u1", spaceId: "space-1", storyPoints: after }
    );
    await handler(event);

    const courseEntry = rtdbUpdates[0]["courseLeaderboard/space-1/u1"];
    expect(courseEntry.percentage).toBe(0);
  });
});

describe("onUserStoryPointProgressWrite — student summary recalculation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rtdbUpdates.length = 0;
    mockFirestore.transaction.get.mockResolvedValue({
      data: () => ({}),
    });
  });

  it("should run a Firestore transaction to update student summary", async () => {
    const after = {
      sp1: {
        status: "completed",
        pointsEarned: 10,
        totalPoints: 10,
        percentage: 100,
        completedAt: 1700000000000,
      },
    };

    const event = makeEvent(
      { userId: "u1", spaceId: "s1", storyPoints: {} },
      { userId: "u1", spaceId: "s1", storyPoints: after }
    );
    await handler(event);

    // runTransaction should have been called
    expect(mockFirestore.db.runTransaction).toHaveBeenCalled();
  });

  it("should merge summary data with set + merge: true", async () => {
    const after = {
      sp1: {
        status: "completed",
        pointsEarned: 10,
        totalPoints: 10,
        percentage: 100,
        completedAt: 1700000000000,
      },
    };

    // Seed existing summary for the transaction.get()
    mockFirestore.transaction.get.mockResolvedValue({
      data: () => ({
        autograde: { averageScore: 0.75, subjectBreakdown: {} },
        levelup: { averageCompletion: 60, subjectBreakdown: {} },
      }),
    });

    const event = makeEvent(
      { userId: "u1", spaceId: "s1", storyPoints: {} },
      { userId: "u1", spaceId: "s1", storyPoints: after }
    );
    await handler(event);

    expect(mockFirestore.transaction.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        studentId: "u1",
        tenantId: "tenant-1",
        strengthAreas: ["Mathematics"],
      }),
      { merge: true }
    );
  });
});
