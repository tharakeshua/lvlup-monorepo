/**
 * Unit tests for onProgressMilestone trigger.
 * Tests milestone detection: first exam, 80% avg, streak, first/all spaces,
 * at-risk transitions, and correct recipients.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSendNotification, mockSendBulkNotifications, mockDocGet, mockCollectionWhereGet } =
  vi.hoisted(() => ({
    mockSendNotification: vi.fn(),
    mockSendBulkNotifications: vi.fn(),
    mockDocGet: vi.fn(),
    mockCollectionWhereGet: vi.fn(),
  }));

vi.mock("../../utils/notification-sender", () => ({
  sendNotification: mockSendNotification,
  sendBulkNotifications: mockSendBulkNotifications,
}));

vi.mock("firebase-admin", () => {
  const firestoreDb = {
    collection: () => ({
      where: () => ({
        get: () => mockCollectionWhereGet(),
        where: () => ({
          get: () => mockCollectionWhereGet(),
          where: () => ({
            get: () => mockCollectionWhereGet(),
            limit: () => ({ get: () => mockCollectionWhereGet() }),
          }),
          limit: () => ({ get: () => mockCollectionWhereGet() }),
        }),
        limit: () => ({ get: () => mockCollectionWhereGet() }),
      }),
    }),
    doc: (path: string) => ({ get: () => mockDocGet(path) }),
  };
  const firestore = Object.assign(() => firestoreDb, {});
  return {
    default: { firestore, initializeApp: vi.fn(), apps: [{}] },
    firestore,
    initializeApp: vi.fn(),
    apps: [{}],
  };
});

vi.mock("firebase-functions/v2/firestore", () => ({
  onDocumentUpdated: (_opts: any, handler: any) => handler,
}));

vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { onProgressMilestone } from "../../triggers/on-progress-milestone";

const handler = onProgressMilestone as unknown as (event: any) => Promise<void>;

function makeEvent(
  beforeData: Record<string, any>,
  afterData: Record<string, any>,
  params = { tenantId: "tenant-1", studentId: "student-1" }
) {
  return {
    data: {
      before: { data: () => beforeData },
      after: { data: () => afterData },
    },
    params,
  };
}

describe("onProgressMilestone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendNotification.mockResolvedValue("notif-id");
    mockSendBulkNotifications.mockResolvedValue(1);
  });

  // ── First exam completed ──────────────────────────────────────────

  it("notifies on first exam completed", async () => {
    await handler(
      makeEvent(
        { autograde: { completedExams: 0 } },
        { autograde: { completedExams: 1 }, studentName: "Alice" }
      )
    );

    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "student-1",
        title: "First Exam Completed!",
      })
    );
  });

  it("does not notify when not first exam", async () => {
    await handler(
      makeEvent({ autograde: { completedExams: 2 } }, { autograde: { completedExams: 3 } })
    );

    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  // ── 80% average threshold ─────────────────────────────────────────

  it("notifies when exam average crosses 80%", async () => {
    await handler(
      makeEvent(
        { autograde: { averagePercentage: 75, completedExams: 3 } },
        { autograde: { averagePercentage: 82, completedExams: 4 } }
      )
    );

    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Outstanding Performance!",
        body: expect.stringContaining("82%"),
      })
    );
  });

  it("does not notify when average was already above 80%", async () => {
    await handler(
      makeEvent(
        { autograde: { averagePercentage: 85, completedExams: 3 } },
        { autograde: { averagePercentage: 90, completedExams: 4 } }
      )
    );

    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("does not notify when average crosses 80% but no exams completed", async () => {
    await handler(
      makeEvent(
        { autograde: { averagePercentage: 0, completedExams: 0 } },
        { autograde: { averagePercentage: 85, completedExams: 0 } }
      )
    );

    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  // ── First space completed ─────────────────────────────────────────

  it("notifies on first space completed", async () => {
    await handler(
      makeEvent({ levelup: { completedSpaces: 0 } }, { levelup: { completedSpaces: 1 } })
    );

    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "First Space Completed!",
      })
    );
  });

  // ── All spaces completed ──────────────────────────────────────────

  it("notifies when all spaces are completed", async () => {
    await handler(
      makeEvent(
        { levelup: { completedSpaces: 4, totalSpaces: 5 } },
        { levelup: { completedSpaces: 5, totalSpaces: 5 } }
      )
    );

    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "All Spaces Completed!",
        body: expect.stringContaining("5"),
      })
    );
  });

  it("does not notify all-spaces when totalSpaces is 0", async () => {
    await handler(
      makeEvent(
        { levelup: { completedSpaces: 0, totalSpaces: 0 } },
        { levelup: { completedSpaces: 0, totalSpaces: 0 } }
      )
    );

    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  // ── 7-day streak ──────────────────────────────────────────────────

  it("notifies when 7-day streak is achieved", async () => {
    await handler(makeEvent({ levelup: { streakDays: 6 } }, { levelup: { streakDays: 7 } }));

    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "7-Day Streak!",
        body: expect.stringContaining("7 days"),
      })
    );
  });

  it("does not notify when streak was already >= 7", async () => {
    await handler(makeEvent({ levelup: { streakDays: 7 } }, { levelup: { streakDays: 8 } }));

    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  // ── At-risk: newly at-risk ────────────────────────────────────────

  it("notifies admins and parents when student becomes at-risk", async () => {
    // teachers query
    mockCollectionWhereGet.mockResolvedValueOnce({ docs: [] });
    // tenantAdmin memberships
    mockCollectionWhereGet.mockResolvedValueOnce({
      docs: [{ data: () => ({ uid: "admin-1" }) }],
    });
    // student doc for parentIds
    mockDocGet.mockResolvedValueOnce({
      data: () => ({ parentIds: ["p1"] }),
    });

    await handler(
      makeEvent(
        { isAtRisk: false },
        { isAtRisk: true, atRiskReasons: ["Low attendance"], studentName: "Bob" }
      )
    );

    expect(mockSendBulkNotifications).toHaveBeenCalledWith(
      ["admin-1"],
      expect.objectContaining({
        recipientRole: "tenantAdmin",
        type: "student_at_risk",
        title: "Student At-Risk Alert",
      })
    );

    expect(mockSendBulkNotifications).toHaveBeenCalledWith(
      ["p1"],
      expect.objectContaining({
        recipientRole: "parent",
        type: "student_at_risk",
        title: "At-Risk Alert for Your Child",
      })
    );
  });

  it("does not notify at-risk when student was already at-risk", async () => {
    await handler(makeEvent({ isAtRisk: true }, { isAtRisk: true, atRiskReasons: ["Still low"] }));

    expect(mockSendBulkNotifications).not.toHaveBeenCalled();
  });

  // ── At-risk recovery ──────────────────────────────────────────────

  it("notifies parents when student recovers from at-risk", async () => {
    mockDocGet.mockResolvedValueOnce({
      data: () => ({ parentIds: ["p1", "p2"] }),
    });

    await handler(makeEvent({ isAtRisk: true }, { isAtRisk: false }));

    expect(mockSendBulkNotifications).toHaveBeenCalledWith(
      ["p1", "p2"],
      expect.objectContaining({
        recipientRole: "parent",
        title: "Good News About Your Child",
      })
    );
  });

  // ── Edge cases ────────────────────────────────────────────────────

  it("returns early when event data is null", async () => {
    await handler({
      data: { before: { data: () => null }, after: { data: () => null } },
      params: {},
    });

    expect(mockSendNotification).not.toHaveBeenCalled();
    expect(mockSendBulkNotifications).not.toHaveBeenCalled();
  });

  it("handles missing autograde and levelup fields gracefully", async () => {
    await handler(makeEvent({}, {}));

    expect(mockSendNotification).not.toHaveBeenCalled();
  });
});
