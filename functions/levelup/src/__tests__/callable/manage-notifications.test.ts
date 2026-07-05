/**
 * Unit tests for callable/manage-notifications.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

// ---------------------------------------------------------------------------
// Stable DB singleton — admin.firestore() always returns this same object.
// ---------------------------------------------------------------------------

const stableDb = {
  doc: vi.fn(),
  collection: vi.fn(),
  batch: vi.fn(() => ({
    update: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  })),
};

const stableRtdb = {
  ref: vi.fn(() => ({
    transaction: vi.fn().mockImplementation((cb: any) => Promise.resolve(cb(0))),
    set: vi.fn().mockResolvedValue(undefined),
  })),
};

vi.mock("firebase-admin", () => {
  const fsFn: any = () => stableDb;
  fsFn.FieldValue = {
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
  };
  const dbFn: any = () => stableRtdb;
  dbFn.ServerValue = { TIMESTAMP: { ".sv": "timestamp" } };
  return {
    default: { firestore: fsFn, database: dbFn },
    firestore: fsFn,
    database: dbFn,
  };
});

vi.mock("firebase-functions/v2/https", async () => {
  const actual = await vi.importActual<any>("firebase-functions/v2/https");
  return { ...actual, onCall: vi.fn((_opts: any, handler: any) => handler) };
});

vi.mock("../../utils/rate-limit", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
}));

import { manageNotifications } from "../../callable/manage-notifications";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function callHandler(data: Record<string, any>, auth: { uid: string } | null = { uid: "user-1" }) {
  return (manageNotifications as any)({ data, auth });
}

function makeNotifDoc(overrides: Record<string, any> = {}) {
  const base = {
    type: "space_published",
    title: "New Space",
    body: "Check it out",
    isRead: false,
    // Realistic Firestore Timestamp duck (real Timestamps carry toMillis).
    createdAt: {
      toDate: () => new Date("2026-01-01"),
      toMillis: () => new Date("2026-01-01").getTime(),
    },
    entityType: "space",
    entityId: "space-1",
    actionUrl: "/spaces/space-1",
    recipientId: "user-1",
    ...overrides,
  };
  return {
    id: overrides.id ?? "notif-1",
    data: () => base,
    ref: { update: vi.fn().mockResolvedValue(undefined) },
    exists: true,
  };
}

function setupListQuery(docs: any[] = [], size?: number) {
  const mockQuery = {
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    startAfter: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue({ docs, size: size ?? docs.length }),
  };
  stableDb.collection.mockReturnValue(mockQuery);
  return mockQuery;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("manageNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Auth & validation
  // -------------------------------------------------------------------------

  it("throws unauthenticated when no auth provided", async () => {
    await expect(callHandler({ tenantId: "t1", action: "list" }, null)).rejects.toThrow(
      "Must be logged in"
    );
  });

  it("throws when tenantId is missing", async () => {
    // Schema-level validation message (wire schema rejects before the handler body).
    await expect(callHandler({ tenantId: "", action: "list" })).rejects.toThrow(
      "tenantId: ID cannot be empty"
    );
  });

  it("throws on invalid action", async () => {
    setupListQuery(); // prevent firestore error
    await expect(callHandler({ tenantId: "t1", action: "delete" })).rejects.toThrow(
      "Invalid request: action"
    );
  });

  // -------------------------------------------------------------------------
  // LIST
  // -------------------------------------------------------------------------

  describe("list", () => {
    it("returns paginated notifications with default limit", async () => {
      const docs = [makeNotifDoc({ id: "n1" }), makeNotifDoc({ id: "n2" })];
      setupListQuery(docs);

      const result = await callHandler({ tenantId: "t1", action: "list" });

      expect(result.notifications).toHaveLength(2);
      expect(result.notifications[0].id).toBe("n1");
      expect(result.notifications[0].title).toBe("New Space");
      expect(result.notifications[0].isRead).toBe(false);
      // B8 round-trip: Firestore Timestamp at rest → canonical ISO out.
      expect(result.notifications[0].createdAt).toBe(new Date("2026-01-01").toISOString());
    });

    it("caps limit at 50 even if higher is requested", async () => {
      const mockQuery = setupListQuery();

      await callHandler({ tenantId: "t1", action: "list", limit: 100 });

      expect(mockQuery.limit).toHaveBeenCalledWith(50);
    });

    it("uses default limit of 20 when not specified", async () => {
      const mockQuery = setupListQuery();

      await callHandler({ tenantId: "t1", action: "list" });

      expect(mockQuery.limit).toHaveBeenCalledWith(20);
    });

    it("returns nextCursor when page is full", async () => {
      const docs = Array.from({ length: 20 }, (_, i) => makeNotifDoc({ id: `n-${i}` }));
      setupListQuery(docs, 20);

      const result = await callHandler({ tenantId: "t1", action: "list", limit: 20 });

      expect(result.nextCursor).toBe("n-19");
    });

    it("returns no nextCursor when page is not full", async () => {
      setupListQuery([makeNotifDoc({ id: "n1" })], 1);

      const result = await callHandler({ tenantId: "t1", action: "list", limit: 20 });

      expect(result.nextCursor).toBeUndefined();
    });

    it("paginates using cursor when provided", async () => {
      const cursorDocSnap = { exists: true };
      stableDb.doc.mockReturnValue({ get: vi.fn().mockResolvedValue(cursorDocSnap) });
      const mockQuery = setupListQuery();

      await callHandler({ tenantId: "t1", action: "list", cursor: "last-notif-id" });

      expect(mockQuery.startAfter).toHaveBeenCalledWith(cursorDocSnap);
    });

    it("returns empty list when user has no notifications", async () => {
      setupListQuery([], 0);

      const result = await callHandler({ tenantId: "t1", action: "list" });

      expect(result.notifications).toEqual([]);
      expect(result.nextCursor).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // MARK READ (single)
  // -------------------------------------------------------------------------

  describe("markRead — single", () => {
    it("marks a single unread notification as read", async () => {
      const notif = makeNotifDoc({ recipientId: "user-1", isRead: false });
      stableDb.doc.mockReturnValue({
        get: vi.fn().mockResolvedValue(notif),
        update: vi.fn().mockResolvedValue(undefined),
      });

      const result = await callHandler({
        tenantId: "t1",
        action: "markRead",
        notificationId: "notif-1",
      });

      expect(result).toEqual({ success: true });
    });

    it("decrements RTDB unread count when marking as read", async () => {
      const notif = makeNotifDoc({ recipientId: "user-1", isRead: false });
      stableDb.doc.mockReturnValue({
        get: vi.fn().mockResolvedValue(notif),
        update: vi.fn().mockResolvedValue(undefined),
      });

      await callHandler({
        tenantId: "t1",
        action: "markRead",
        notificationId: "notif-1",
      });

      // RTDB transaction should have been called for unread count
      expect(stableRtdb.ref).toHaveBeenCalled();
    });

    it("skips update if notification is already read", async () => {
      const notif = makeNotifDoc({ recipientId: "user-1", isRead: true });
      const mockUpdate = vi.fn();
      stableDb.doc.mockReturnValue({
        get: vi.fn().mockResolvedValue(notif),
        update: mockUpdate,
      });

      const result = await callHandler({
        tenantId: "t1",
        action: "markRead",
        notificationId: "notif-1",
      });

      expect(result).toEqual({ success: true });
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("throws not-found for non-existent notification", async () => {
      stableDb.doc.mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: false, data: () => null }),
      });

      await expect(
        callHandler({
          tenantId: "t1",
          action: "markRead",
          notificationId: "bad-id",
        })
      ).rejects.toThrow("Notification not found");
    });

    it("throws permission-denied when marking another users notification", async () => {
      const notif = makeNotifDoc({ recipientId: "other-user" });
      stableDb.doc.mockReturnValue({
        get: vi.fn().mockResolvedValue(notif),
      });

      await expect(
        callHandler({
          tenantId: "t1",
          action: "markRead",
          notificationId: "notif-1",
        })
      ).rejects.toThrow("Not your notification");
    });
  });

  // -------------------------------------------------------------------------
  // MARK ALL READ
  // -------------------------------------------------------------------------

  describe("markRead — markAllRead", () => {
    it("marks all unread notifications as read in batches", async () => {
      const unreadDocs = [{ ref: {} }, { ref: {} }];
      const mockQuery = {
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ empty: false, docs: unreadDocs }),
      };
      const mockBatch = { update: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
      stableDb.collection.mockReturnValue(mockQuery);
      stableDb.batch.mockReturnValue(mockBatch);

      const result = await callHandler({
        tenantId: "t1",
        action: "markRead",
        markAllRead: true,
      });

      expect(result).toEqual({ success: true });
      expect(mockBatch.update).toHaveBeenCalledTimes(2);
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it("does nothing when there are no unread notifications", async () => {
      const mockQuery = {
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
      };
      stableDb.collection.mockReturnValue(mockQuery);

      const result = await callHandler({
        tenantId: "t1",
        action: "markRead",
        markAllRead: true,
      });

      expect(result).toEqual({ success: true });
    });

    it("resets RTDB unread count to 0 after marking all read", async () => {
      const unreadDocs = [{ ref: {} }];
      const mockQuery = {
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ empty: false, docs: unreadDocs }),
      };
      const mockBatch = { update: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
      stableDb.collection.mockReturnValue(mockQuery);
      stableDb.batch.mockReturnValue(mockBatch);

      await callHandler({
        tenantId: "t1",
        action: "markRead",
        markAllRead: true,
      });

      // RTDB ref should be called to reset unread count
      expect(stableRtdb.ref).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Cursor edge case
  // -------------------------------------------------------------------------

  describe("list — cursor edge cases", () => {
    it("ignores cursor when cursor doc does not exist", async () => {
      stableDb.doc.mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: false }),
      });
      const mockQuery = setupListQuery([makeNotifDoc({ id: "n1" })], 1);

      const result = await callHandler({
        tenantId: "t1",
        action: "list",
        cursor: "nonexistent-id",
      });

      // startAfter should NOT have been called since cursor doc doesn't exist
      expect(mockQuery.startAfter).not.toHaveBeenCalled();
      expect(result.notifications).toHaveLength(1);
    });
  });
});
