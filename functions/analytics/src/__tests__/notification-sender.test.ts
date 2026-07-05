/**
 * Tests for sendNotification and sendBulkNotifications — notification delivery utilities.
 *
 * Covers:
 *  1. sendNotification: creates Firestore doc with correct fields
 *  2. sendNotification: increments RTDB unread count via transaction
 *  3. sendNotification: sets RTDB latest notification
 *  4. sendNotification: returns notification ID
 *  5. sendBulkNotifications: returns 0 for empty recipients
 *  6. sendBulkNotifications: sends to all recipients in batch
 *  7. sendBulkNotifications: handles batching (>450 recipients)
 *  8. sendBulkNotifications: updates RTDB for all recipients
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Stable mock references (defined before vi.mock) ──────────────────────

const mockSet = vi.fn().mockResolvedValue(undefined);
const mockTransaction = vi.fn().mockImplementation((cb) => Promise.resolve(cb(0)));
const mockBatchSet = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
const mockRtdbUpdate = vi.fn().mockResolvedValue(undefined);
const mockRtdbRefSet = vi.fn().mockResolvedValue(undefined);

const stableDb = {
  collection: vi.fn(() => ({
    doc: vi.fn(() => ({ id: "notif-123", set: mockSet })),
  })),
  batch: vi.fn(() => ({ set: mockBatchSet, commit: mockBatchCommit })),
};

const stableRtdb = {
  ref: vi.fn(() => ({
    transaction: mockTransaction,
    set: mockRtdbRefSet,
    update: mockRtdbUpdate,
  })),
};

vi.mock("firebase-admin", () => {
  const fsFn: any = () => stableDb;
  fsFn.FieldValue = { serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP") };
  return {
    default: { firestore: fsFn, database: () => stableRtdb },
    firestore: fsFn,
    database: () => stableRtdb,
  };
});

// ── Import under test (after mocks) ─────────────────────────────────────

import {
  sendNotification,
  sendBulkNotifications,
  type NotificationPayload,
} from "../utils/notification-sender";

// ── Helpers ──────────────────────────────────────────────────────────────

function makePayload(overrides: Partial<NotificationPayload> = {}): NotificationPayload {
  return {
    tenantId: "tenant-1",
    recipientId: "user-1",
    recipientRole: "student",
    type: "exam_graded",
    title: "Exam Graded",
    body: "Your exam has been graded.",
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("sendNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates Firestore doc with correct fields", async () => {
    const payload = makePayload({
      entityType: "exam",
      entityId: "exam-42",
      actionUrl: "/exam/42",
    });

    await sendNotification(payload);

    expect(stableDb.collection).toHaveBeenCalledWith("tenants/tenant-1/notifications");
    expect(mockSet).toHaveBeenCalledTimes(1);

    const docData = mockSet.mock.calls[0][0];
    expect(docData).toMatchObject({
      id: "notif-123",
      tenantId: "tenant-1",
      recipientId: "user-1",
      recipientRole: "student",
      type: "exam_graded",
      title: "Exam Graded",
      body: "Your exam has been graded.",
      entityType: "exam",
      entityId: "exam-42",
      actionUrl: "/exam/42",
      isRead: false,
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
    });
  });

  it("sets entityType, entityId, and actionUrl to null when not provided", async () => {
    const payload = makePayload();

    await sendNotification(payload);

    const docData = mockSet.mock.calls[0][0];
    expect(docData.entityType).toBeNull();
    expect(docData.entityId).toBeNull();
    expect(docData.actionUrl).toBeNull();
  });

  it("increments RTDB unread count via transaction", async () => {
    const payload = makePayload();

    await sendNotification(payload);

    // Should call ref with the correct unread count path
    expect(stableRtdb.ref).toHaveBeenCalledWith("notifications/tenant-1/user-1/unreadCount");
    expect(mockTransaction).toHaveBeenCalledTimes(1);

    // The transaction callback should increment: (current ?? 0) + 1
    const txCallback = mockTransaction.mock.calls[0][0];
    expect(txCallback(null)).toBe(1);
    expect(txCallback(0)).toBe(1);
    expect(txCallback(5)).toBe(6);
  });

  it("sets RTDB latest notification", async () => {
    const payload = makePayload();

    await sendNotification(payload);

    expect(stableRtdb.ref).toHaveBeenCalledWith("notifications/tenant-1/user-1/latest");
    expect(mockRtdbRefSet).toHaveBeenCalledTimes(1);

    const latestData = mockRtdbRefSet.mock.calls[0][0];
    expect(latestData).toMatchObject({
      id: "notif-123",
      title: "Exam Graded",
      type: "exam_graded",
    });
    expect(latestData.createdAt).toEqual(expect.any(Number));
  });

  it("returns notification ID", async () => {
    const payload = makePayload();
    const id = await sendNotification(payload);
    expect(id).toBe("notif-123");
  });
});

describe("sendBulkNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0 for empty recipients array", async () => {
    const basePayload = {
      tenantId: "tenant-1",
      recipientRole: "student" as const,
      type: "announcement",
      title: "Hello",
      body: "Announcement body",
    };

    const count = await sendBulkNotifications([], basePayload);
    expect(count).toBe(0);
    expect(stableDb.batch).not.toHaveBeenCalled();
  });

  it("sends to all recipients in a single batch", async () => {
    const recipients = ["user-1", "user-2", "user-3"];
    const basePayload = {
      tenantId: "tenant-1",
      recipientRole: "student" as const,
      type: "announcement",
      title: "Hello",
      body: "Announcement body",
    };

    const count = await sendBulkNotifications(recipients, basePayload);

    expect(count).toBe(3);
    expect(stableDb.batch).toHaveBeenCalledTimes(1);
    expect(mockBatchSet).toHaveBeenCalledTimes(3);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it("handles batching when recipients exceed 450", async () => {
    // Create 500 recipients to trigger 2 batches (450 + 50)
    const recipients = Array.from({ length: 500 }, (_, i) => `user-${i}`);
    const basePayload = {
      tenantId: "tenant-1",
      recipientRole: "student" as const,
      type: "announcement",
      title: "Hello",
      body: "Announcement body",
    };

    const count = await sendBulkNotifications(recipients, basePayload);

    expect(count).toBe(500);
    // Should create 2 batches: one with 450, one with 50
    expect(stableDb.batch).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalledTimes(2);
    expect(mockBatchSet).toHaveBeenCalledTimes(500);
  });

  it("batch.set is called with correct doc data for each recipient", async () => {
    const recipients = ["user-A"];
    const basePayload = {
      tenantId: "tenant-1",
      recipientRole: "teacher" as const,
      type: "alert",
      title: "Alert",
      body: "Alert body",
      entityType: "student" as const,
      entityId: "student-1",
    };

    await sendBulkNotifications(recipients, basePayload);

    expect(mockBatchSet).toHaveBeenCalledTimes(1);
    const [docRef, docData] = mockBatchSet.mock.calls[0];
    expect(docData).toMatchObject({
      id: "notif-123",
      tenantId: "tenant-1",
      recipientId: "user-A",
      recipientRole: "teacher",
      type: "alert",
      title: "Alert",
      body: "Alert body",
      entityType: "student",
      entityId: "student-1",
      isRead: false,
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
    });
  });

  it("updates RTDB latest for all recipients via ref().update()", async () => {
    const recipients = ["user-1", "user-2"];
    const basePayload = {
      tenantId: "tenant-1",
      recipientRole: "student" as const,
      type: "announcement",
      title: "Hello",
      body: "Announcement body",
    };

    await sendBulkNotifications(recipients, basePayload);

    // ref() is called for the root update
    expect(stableRtdb.ref).toHaveBeenCalled();
    expect(mockRtdbUpdate).toHaveBeenCalledTimes(1);

    const updateArg = mockRtdbUpdate.mock.calls[0][0];
    expect(updateArg).toHaveProperty("notifications/tenant-1/user-1/latest");
    expect(updateArg).toHaveProperty("notifications/tenant-1/user-2/latest");
    expect(updateArg["notifications/tenant-1/user-1/latest"]).toMatchObject({
      title: "Hello",
      type: "announcement",
    });
  });

  it("increments RTDB unread count for each recipient via transaction", async () => {
    const recipients = ["user-1", "user-2"];
    const basePayload = {
      tenantId: "tenant-1",
      recipientRole: "student" as const,
      type: "announcement",
      title: "Hello",
      body: "Announcement body",
    };

    await sendBulkNotifications(recipients, basePayload);

    // Each recipient gets a transaction call for unreadCount
    // ref is called for: root update (1) + unreadCount transactions (2)
    // Plus the ref calls for batch updates
    expect(mockTransaction).toHaveBeenCalledTimes(2);
  });
});
