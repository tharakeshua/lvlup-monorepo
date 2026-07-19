/**
 * Unit tests for onSpacePublished trigger.
 * Verifies students in classIds get notified, non-published status ignored,
 * empty classIds handled.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks (accessible inside vi.mock factories) ─────────────
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

import { onSpacePublished } from "../../triggers/on-space-published";

const handler = onSpacePublished as unknown as (event: any) => Promise<void>;

function makeEvent(
  beforeData: Record<string, any> | null,
  afterData: Record<string, any> | null,
  params: Record<string, string> = { tenantId: "tenant-1", spaceId: "space-1" }
) {
  return {
    data: {
      before: { data: () => beforeData },
      after: { data: () => afterData },
    },
    params,
  };
}

describe("onSpacePublished", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendBulkNotifications.mockResolvedValue(3);
  });

  it("sends notifications to students when status changes to published", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ studentIds: ["s1", "s2", "s3"] }),
    });

    await handler(
      makeEvent(
        { status: "draft", title: "Math Basics", type: "learning", classIds: ["c1"] },
        { status: "published", title: "Math Basics", type: "learning", classIds: ["c1"] }
      )
    );

    expect(mockSendBulkNotifications).toHaveBeenCalledWith(
      ["s1", "s2", "s3"],
      expect.objectContaining({
        type: "space_published",
        recipientRole: "student",
        title: "New Learning Space Available",
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

  it("does not trigger when status changes to non-published", async () => {
    await handler(
      makeEvent({ status: "draft", classIds: ["c1"] }, { status: "archived", classIds: ["c1"] })
    );

    expect(mockSendBulkNotifications).not.toHaveBeenCalled();
  });

  it("returns early when classIds is empty", async () => {
    await handler(
      makeEvent({ status: "draft", classIds: [] }, { status: "published", classIds: [] })
    );

    expect(mockSendBulkNotifications).not.toHaveBeenCalled();
    expect(mockDocGet).not.toHaveBeenCalled();
  });

  it("returns early when event data is null", async () => {
    await handler({
      data: { before: { data: () => null }, after: { data: () => null } },
      params: {},
    });

    expect(mockSendBulkNotifications).not.toHaveBeenCalled();
  });

  it("deduplicates students from multiple classes", async () => {
    mockDocGet
      .mockResolvedValueOnce({ exists: true, data: () => ({ studentIds: ["s1", "s2"] }) })
      .mockResolvedValueOnce({ exists: true, data: () => ({ studentIds: ["s2", "s3"] }) });

    await handler(
      makeEvent(
        { status: "draft", classIds: ["c1", "c2"] },
        { status: "published", title: "Space", type: "learning", classIds: ["c1", "c2"] }
      )
    );

    const recipientIds = mockSendBulkNotifications.mock.calls[0][0] as string[];
    expect(recipientIds).toHaveLength(3);
    expect(new Set(recipientIds).size).toBe(3);
  });

  it("skips non-existing classes gracefully", async () => {
    mockDocGet
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: true, data: () => ({ studentIds: ["s1"] }) });

    await handler(
      makeEvent(
        { status: "draft", classIds: ["missing", "c2"] },
        { status: "published", title: "S", type: "learning", classIds: ["missing", "c2"] }
      )
    );

    const recipientIds = mockSendBulkNotifications.mock.calls[0][0] as string[];
    expect(recipientIds).toEqual(["s1"]);
  });

  it("does not send notifications when classes have no students", async () => {
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({ studentIds: [] }) });

    await handler(
      makeEvent(
        { status: "draft", classIds: ["c1"] },
        { status: "published", title: "S", type: "learning", classIds: ["c1"] }
      )
    );

    expect(mockSendBulkNotifications).not.toHaveBeenCalled();
  });

  it("includes space title and type in notification body", async () => {
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({ studentIds: ["s1"] }) });

    await handler(
      makeEvent(
        { status: "draft", classIds: ["c1"] },
        { status: "published", title: "Algebra 101", type: "assessment", classIds: ["c1"] }
      )
    );

    const payload = mockSendBulkNotifications.mock.calls[0][1];
    expect(payload.body).toContain("Algebra 101");
    expect(payload.body).toContain("assessment");
  });
});
