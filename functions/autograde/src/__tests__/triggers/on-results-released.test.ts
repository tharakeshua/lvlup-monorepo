/**
 * Unit tests for onResultsReleased trigger.
 * Verifies students, parents, and teacher notified; non-released status ignored.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSendBulkNotifications, mockSendNotification, mockDocGet, mockCollectionWhereGet } =
  vi.hoisted(() => ({
    mockSendBulkNotifications: vi.fn(),
    mockSendNotification: vi.fn(),
    mockDocGet: vi.fn(),
    mockCollectionWhereGet: vi.fn(),
  }));

vi.mock("../../utils/notification-sender", () => ({
  sendBulkNotifications: mockSendBulkNotifications,
  sendNotification: mockSendNotification,
}));

vi.mock("firebase-admin", () => {
  const firestoreDb = {
    collection: () => ({
      where: () => ({
        get: () => mockCollectionWhereGet(),
        where: () => ({ get: () => mockCollectionWhereGet() }),
      }),
    }),
    doc: (path: string) => ({ get: () => mockDocGet(path) }),
  };
  const firestore = Object.assign(() => firestoreDb, {
    FieldPath: { documentId: () => "__documentId__" },
  });
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

import { onResultsReleased } from "../../triggers/on-results-released";

const handler = onResultsReleased as unknown as (event: any) => Promise<void>;

function makeEvent(
  beforeData: Record<string, any> | null,
  afterData: Record<string, any> | null,
  params = { tenantId: "tenant-1", examId: "exam-1" }
) {
  return {
    data: {
      before: { data: () => beforeData },
      after: { data: () => afterData },
    },
    params,
  };
}

describe("onResultsReleased", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendBulkNotifications.mockResolvedValue(2);
    mockSendNotification.mockResolvedValue("notif-id");
  });

  it("notifies students when status changes to results_released", async () => {
    mockCollectionWhereGet.mockResolvedValueOnce({
      empty: false,
      docs: [{ data: () => ({ studentId: "s1" }) }, { data: () => ({ studentId: "s2" }) }],
    });
    mockCollectionWhereGet.mockResolvedValueOnce({
      docs: [{ data: () => ({ parentIds: [] }) }, { data: () => ({ parentIds: [] }) }],
    });

    await handler(
      makeEvent(
        { status: "grading" },
        { status: "results_released", title: "Mid-term", subject: "Math", createdBy: "teacher-1" }
      )
    );

    expect(mockSendBulkNotifications).toHaveBeenCalledWith(
      expect.arrayContaining(["s1", "s2"]),
      expect.objectContaining({
        type: "exam_results_released",
        recipientRole: "student",
      })
    );
  });

  it("notifies parents of students who have submissions", async () => {
    mockCollectionWhereGet.mockResolvedValueOnce({
      empty: false,
      docs: [{ data: () => ({ studentId: "s1" }) }],
    });
    mockCollectionWhereGet.mockResolvedValueOnce({
      docs: [{ data: () => ({ parentIds: ["p1", "p2"] }) }],
    });

    await handler(
      makeEvent(
        { status: "grading" },
        { status: "results_released", title: "Final", createdBy: "teacher-1" }
      )
    );

    expect(mockSendBulkNotifications).toHaveBeenCalledTimes(2);
    expect(mockSendBulkNotifications).toHaveBeenCalledWith(
      expect.arrayContaining(["p1", "p2"]),
      expect.objectContaining({
        recipientRole: "parent",
        type: "exam_results_released",
      })
    );
  });

  it("notifies the teacher who created the exam", async () => {
    mockCollectionWhereGet.mockResolvedValueOnce({
      empty: false,
      docs: [{ data: () => ({ studentId: "s1" }) }],
    });
    mockCollectionWhereGet.mockResolvedValueOnce({
      docs: [{ data: () => ({ parentIds: [] }) }],
    });

    await handler(
      makeEvent(
        { status: "grading" },
        { status: "results_released", title: "Quiz", createdBy: "teacher-42" }
      )
    );

    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "teacher-42",
        recipientRole: "teacher",
        type: "exam_results_released",
      })
    );
  });

  it("does not trigger when status was already results_released", async () => {
    await handler(
      makeEvent({ status: "results_released" }, { status: "results_released", title: "X" })
    );

    expect(mockSendBulkNotifications).not.toHaveBeenCalled();
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("does not trigger for non-results_released status", async () => {
    await handler(makeEvent({ status: "grading" }, { status: "completed", title: "X" }));

    expect(mockSendBulkNotifications).not.toHaveBeenCalled();
  });

  it("returns early when no submissions exist", async () => {
    mockCollectionWhereGet.mockResolvedValueOnce({ empty: true, docs: [] });

    await handler(
      makeEvent(
        { status: "grading" },
        { status: "results_released", title: "Empty Exam", createdBy: "teacher-1" }
      )
    );

    expect(mockSendBulkNotifications).not.toHaveBeenCalled();
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("includes subject in notification body when present", async () => {
    mockCollectionWhereGet.mockResolvedValueOnce({
      empty: false,
      docs: [{ data: () => ({ studentId: "s1" }) }],
    });
    mockCollectionWhereGet.mockResolvedValueOnce({
      docs: [{ data: () => ({ parentIds: [] }) }],
    });

    await handler(
      makeEvent(
        { status: "grading" },
        {
          status: "results_released",
          title: "Physics Final",
          subject: "Physics",
          createdBy: "teacher-1",
        }
      )
    );

    const studentPayload = mockSendBulkNotifications.mock.calls[0][1];
    expect(studentPayload.body).toContain("Physics");
  });

  it("returns early when event data is null", async () => {
    await handler({
      data: { before: { data: () => null }, after: { data: () => null } },
      params: {},
    });

    expect(mockSendBulkNotifications).not.toHaveBeenCalled();
  });
});
