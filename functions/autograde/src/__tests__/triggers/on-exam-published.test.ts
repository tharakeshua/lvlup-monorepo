/**
 * Unit tests for onExamPublished trigger.
 * Verifies students notified, non-published status ignored, empty classIds handled.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSendBulkNotifications, mockDocGet } = vi.hoisted(() => ({
  mockSendBulkNotifications: vi.fn(),
  mockDocGet: vi.fn(),
}));

vi.mock("../../utils/notification-sender", () => ({
  sendBulkNotifications: mockSendBulkNotifications,
}));

vi.mock("firebase-admin", () => {
  const firestoreDb = {
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

import { onExamPublished } from "../../triggers/on-exam-published";

const handler = onExamPublished as unknown as (event: any) => Promise<void>;

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

describe("onExamPublished", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendBulkNotifications.mockResolvedValue(2);
  });

  it("sends notifications to students when exam status changes to published", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ studentIds: ["s1", "s2"] }),
    });

    await handler(
      makeEvent(
        { status: "draft", classIds: ["c1"] },
        {
          status: "published",
          title: "Mid-term Math",
          subject: "Math",
          totalMarks: 100,
          classIds: ["c1"],
        }
      )
    );

    expect(mockSendBulkNotifications).toHaveBeenCalledWith(
      ["s1", "s2"],
      expect.objectContaining({
        type: "new_exam_assigned",
        recipientRole: "student",
        title: "New Exam Assigned",
      })
    );
  });

  it("does not trigger when status was already published", async () => {
    await handler(
      makeEvent(
        { status: "published", classIds: ["c1"] },
        { status: "published", classIds: ["c1"] }
      )
    );

    expect(mockSendBulkNotifications).not.toHaveBeenCalled();
  });

  it("does not trigger for non-published status transitions", async () => {
    await handler(
      makeEvent({ status: "draft", classIds: ["c1"] }, { status: "grading", classIds: ["c1"] })
    );

    expect(mockSendBulkNotifications).not.toHaveBeenCalled();
  });

  it("returns early when classIds is empty", async () => {
    await handler(
      makeEvent({ status: "draft", classIds: [] }, { status: "published", classIds: [] })
    );

    expect(mockSendBulkNotifications).not.toHaveBeenCalled();
  });

  it("includes subject and totalMarks in notification body", async () => {
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({ studentIds: ["s1"] }) });

    await handler(
      makeEvent(
        { status: "draft", classIds: ["c1"] },
        {
          status: "published",
          title: "Physics Final",
          subject: "Physics",
          totalMarks: 75,
          classIds: ["c1"],
        }
      )
    );

    const payload = mockSendBulkNotifications.mock.calls[0][1];
    expect(payload.body).toContain("Physics Final");
    expect(payload.body).toContain("Physics");
    expect(payload.body).toContain("75 marks");
  });

  it("handles missing subject and totalMarks gracefully", async () => {
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({ studentIds: ["s1"] }) });

    await handler(
      makeEvent(
        { status: "draft", classIds: ["c1"] },
        { status: "published", title: "Quick Quiz", classIds: ["c1"] }
      )
    );

    const payload = mockSendBulkNotifications.mock.calls[0][1];
    expect(payload.body).toContain("Quick Quiz");
    expect(payload.body).not.toContain("marks");
  });

  it("returns early when event data is null", async () => {
    await handler({
      data: { before: { data: () => null }, after: { data: () => null } },
      params: {},
    });

    expect(mockSendBulkNotifications).not.toHaveBeenCalled();
  });
});
