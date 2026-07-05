/**
 * Unit tests for callable/manage-notifications.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Stable mocks ────────────────────────────────────────────────────────────
const mockGet = vi.fn();
const mockUpdate = vi.fn();
const mockBatchUpdate = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
const mockTransaction = vi.fn().mockImplementation((cb: any) => Promise.resolve(cb(0)));
const mockRtdbSet = vi.fn().mockResolvedValue(undefined);

const stableDb: any = {
  doc: vi.fn(() => ({ get: mockGet, update: mockUpdate })),
  collection: vi.fn(() => ({
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    startAfter: vi.fn().mockReturnThis(),
    get: mockGet,
  })),
  batch: vi.fn(() => ({
    update: mockBatchUpdate,
    commit: mockBatchCommit,
  })),
};

const mockRtdb: any = {
  ref: vi.fn(() => ({
    transaction: mockTransaction,
    set: mockRtdbSet,
  })),
};

vi.mock("firebase-admin", () => {
  const fsFn: any = () => stableDb;
  fsFn.FieldValue = {
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
    increment: vi.fn((n: number) => n),
  };
  return {
    default: { firestore: fsFn, database: () => mockRtdb },
    firestore: fsFn,
    database: () => mockRtdb,
  };
});

vi.mock("firebase-functions/v2/https", () => ({
  onCall: vi.fn((_opts: any, handler: any) => handler),
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock("../../utils/rate-limit", () => ({
  enforceRateLimit: vi.fn(),
}));

vi.mock("../../utils/parse-request", () => ({
  parseRequest: vi.fn((data: any) => data),
}));

import { manageNotifications } from "../../callable/manage-notifications";

const handler = manageNotifications as any;

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(data: Record<string, unknown>, auth?: { uid: string } | null) {
  return {
    data,
    auth: auth === null ? undefined : (auth ?? { uid: "user-1" }),
    rawRequest: {} as any,
  };
}

function makeFakeDoc(id: string, data: Record<string, unknown>, ref?: any) {
  return {
    id,
    ref: ref ?? {},
    exists: true,
    data: () => data,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("manageNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ───────────────────── Auth ─────────────────────

  it("rejects unauthenticated request", async () => {
    await expect(
      handler(makeRequest({ tenantId: "tenant-1", action: "list" }, null))
    ).rejects.toThrow("Must be logged in");
  });

  it("rejects when tenantId is missing", async () => {
    await expect(handler(makeRequest({ action: "list" }))).rejects.toThrow("tenantId is required");
  });

  // ───────────────────── Action: list ─────────────────────

  describe("action: list", () => {
    it("lists notifications with default limit 20", async () => {
      const notifDocs = [
        makeFakeDoc("n1", {
          type: "assignment",
          title: "New Assignment",
          body: "You have homework",
          isRead: false,
          createdAt: new Date("2025-01-01"),
          entityType: "space",
          entityId: "space-1",
          actionUrl: "/space/1",
        }),
        makeFakeDoc("n2", {
          type: "grade",
          title: "Grade posted",
          body: "Grade for Test 1",
          isRead: true,
          createdAt: new Date("2025-01-02"),
          entityType: "submission",
          entityId: "sub-1",
          actionUrl: null,
        }),
      ];

      const mockSnap = { docs: notifDocs, size: 2 };

      // collection().where().orderBy().limit().get()
      const chainMock = {
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        startAfter: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnap),
      };
      stableDb.collection.mockReturnValue(chainMock);

      const result = await handler(makeRequest({ tenantId: "tenant-1", action: "list" }));

      expect(result.notifications).toHaveLength(2);
      expect(result.notifications[0]).toEqual({
        id: "n1",
        type: "assignment",
        title: "New Assignment",
        body: "You have homework",
        isRead: false,
        createdAt: new Date("2025-01-01").toISOString(),
        entityType: "space",
        entityId: "space-1",
        actionUrl: "/space/1",
      });
      expect(result.notifications[1].isRead).toBe(true);
      // 2 results < 20 limit, so no nextCursor
      expect(result.nextCursor).toBeUndefined();

      // Verify the chain: where -> orderBy -> limit(20)
      expect(chainMock.where).toHaveBeenCalledWith("recipientId", "==", "user-1");
      expect(chainMock.orderBy).toHaveBeenCalledWith("createdAt", "desc");
      expect(chainMock.limit).toHaveBeenCalledWith(20);
    });

    it("respects custom limit capped at 50", async () => {
      const chainMock = {
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ docs: [], size: 0 }),
      };
      stableDb.collection.mockReturnValue(chainMock);

      await handler(makeRequest({ tenantId: "tenant-1", action: "list", limit: 100 }));

      // limit is capped at 50
      expect(chainMock.limit).toHaveBeenCalledWith(50);
    });

    it("returns nextCursor when results fill the page", async () => {
      // Generate exactly 20 docs (default page size)
      const docs = Array.from({ length: 20 }, (_, i) =>
        makeFakeDoc(`n-${i}`, {
          type: "info",
          title: `Notification ${i}`,
          body: "",
          isRead: false,
          createdAt: new Date("2025-01-01"),
          entityType: null,
          entityId: null,
          actionUrl: null,
        })
      );

      const chainMock = {
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ docs, size: 20 }),
      };
      stableDb.collection.mockReturnValue(chainMock);

      const result = await handler(makeRequest({ tenantId: "tenant-1", action: "list" }));

      expect(result.nextCursor).toBe("n-19");
    });

    it("uses cursor for pagination when provided", async () => {
      const cursorDoc = { exists: true };
      stableDb.doc.mockReturnValue({ get: vi.fn().mockResolvedValue(cursorDoc) });

      const chainMock = {
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        startAfter: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ docs: [], size: 0 }),
      };
      stableDb.collection.mockReturnValue(chainMock);

      await handler(makeRequest({ tenantId: "tenant-1", action: "list", cursor: "last-id" }));

      // Should fetch the cursor document
      expect(stableDb.doc).toHaveBeenCalledWith("tenants/tenant-1/notifications/last-id");
      expect(chainMock.startAfter).toHaveBeenCalledWith(cursorDoc);
    });

    it("defaults isRead to false when field is undefined", async () => {
      const notifDoc = makeFakeDoc("n1", {
        type: "info",
        title: "Test",
        body: "Body",
        // isRead not set at all
        createdAt: new Date("2025-01-01"),
        entityType: null,
        entityId: null,
        actionUrl: null,
      });

      const chainMock = {
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ docs: [notifDoc], size: 1 }),
      };
      stableDb.collection.mockReturnValue(chainMock);

      const result = await handler(makeRequest({ tenantId: "tenant-1", action: "list" }));

      expect(result.notifications[0].isRead).toBe(false);
    });
  });

  // ───────────────────── Action: markRead (single) ─────────────────────

  describe("action: markRead (single)", () => {
    it("marks single notification as read and decrements RTDB count", async () => {
      // Notification exists, belongs to user, is unread
      const notifSnap = {
        exists: true,
        data: () => ({ recipientId: "user-1", isRead: false }),
      };
      stableDb.doc.mockReturnValue({
        get: vi.fn().mockResolvedValue(notifSnap),
        update: mockUpdate,
      });

      const result = await handler(
        makeRequest({
          tenantId: "tenant-1",
          action: "markRead",
          notificationId: "notif-1",
        })
      );

      expect(result).toEqual({ success: true });
      expect(mockUpdate).toHaveBeenCalledWith({
        isRead: true,
        readAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      });

      // RTDB transaction to decrement unread count
      expect(mockRtdb.ref).toHaveBeenCalledWith("notifications/tenant-1/user-1/unreadCount");
      expect(mockTransaction).toHaveBeenCalled();
    });

    it("decrements RTDB count correctly (never below 0)", async () => {
      const notifSnap = {
        exists: true,
        data: () => ({ recipientId: "user-1", isRead: false }),
      };
      stableDb.doc.mockReturnValue({
        get: vi.fn().mockResolvedValue(notifSnap),
        update: mockUpdate,
      });

      // Simulate transaction callback with current = 0
      mockTransaction.mockImplementation((cb: any) => Promise.resolve(cb(0)));

      await handler(
        makeRequest({
          tenantId: "tenant-1",
          action: "markRead",
          notificationId: "notif-1",
        })
      );

      // The transaction callback should return Math.max(0-1, 0) = 0
      const txCallback = mockTransaction.mock.calls[0][0];
      expect(txCallback(0)).toBe(0);
      expect(txCallback(5)).toBe(4);
      expect(txCallback(null)).toBe(0);
    });

    it("skips update when notification is already read", async () => {
      const notifSnap = {
        exists: true,
        data: () => ({ recipientId: "user-1", isRead: true }),
      };
      stableDb.doc.mockReturnValue({
        get: vi.fn().mockResolvedValue(notifSnap),
        update: mockUpdate,
      });

      const result = await handler(
        makeRequest({
          tenantId: "tenant-1",
          action: "markRead",
          notificationId: "notif-1",
        })
      );

      expect(result).toEqual({ success: true });
      // Should NOT call update since already read
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockRtdb.ref).not.toHaveBeenCalled();
    });

    it("throws not-found when notification does not exist", async () => {
      stableDb.doc.mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: false }),
        update: mockUpdate,
      });

      await expect(
        handler(
          makeRequest({
            tenantId: "tenant-1",
            action: "markRead",
            notificationId: "missing",
          })
        )
      ).rejects.toThrow("Notification not found");
    });

    it("throws permission-denied when notification belongs to another user", async () => {
      const notifSnap = {
        exists: true,
        data: () => ({ recipientId: "other-user", isRead: false }),
      };
      stableDb.doc.mockReturnValue({
        get: vi.fn().mockResolvedValue(notifSnap),
        update: mockUpdate,
      });

      await expect(
        handler(
          makeRequest({
            tenantId: "tenant-1",
            action: "markRead",
            notificationId: "notif-1",
          })
        )
      ).rejects.toThrow("Not your notification");
    });
  });

  // ───────────────────── Action: markRead (all) ─────────────────────

  describe("action: markRead (all)", () => {
    it("marks all unread notifications as read and resets RTDB count", async () => {
      const unreadDocs = [
        makeFakeDoc("n1", { isRead: false }, { path: "n1" }),
        makeFakeDoc("n2", { isRead: false }, { path: "n2" }),
        makeFakeDoc("n3", { isRead: false }, { path: "n3" }),
      ];

      const chainMock = {
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ empty: false, docs: unreadDocs }),
      };
      stableDb.collection.mockReturnValue(chainMock);

      const result = await handler(
        makeRequest({
          tenantId: "tenant-1",
          action: "markRead",
          markAllRead: true,
        })
      );

      expect(result).toEqual({ success: true });

      // batch.update called for each unread doc
      expect(mockBatchUpdate).toHaveBeenCalledTimes(3);
      expect(mockBatchCommit).toHaveBeenCalled();

      // RTDB reset to 0
      expect(mockRtdb.ref).toHaveBeenCalledWith("notifications/tenant-1/user-1/unreadCount");
      expect(mockRtdbSet).toHaveBeenCalledWith(0);
    });

    it("skips batch when no unread notifications exist", async () => {
      const chainMock = {
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
      };
      stableDb.collection.mockReturnValue(chainMock);

      const result = await handler(
        makeRequest({
          tenantId: "tenant-1",
          action: "markRead",
          markAllRead: true,
        })
      );

      expect(result).toEqual({ success: true });
      expect(mockBatchUpdate).not.toHaveBeenCalled();
      expect(mockBatchCommit).not.toHaveBeenCalled();
      expect(mockRtdbSet).not.toHaveBeenCalled();
    });

    it("processes unread notifications in batches of 450", async () => {
      // Create 500 unread docs to test batching
      const unreadDocs = Array.from({ length: 500 }, (_, i) =>
        makeFakeDoc(`n-${i}`, { isRead: false }, { path: `n-${i}` })
      );

      const chainMock = {
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ empty: false, docs: unreadDocs }),
      };
      stableDb.collection.mockReturnValue(chainMock);

      await handler(
        makeRequest({
          tenantId: "tenant-1",
          action: "markRead",
          markAllRead: true,
        })
      );

      // Should create 2 batches: 450 + 50
      expect(stableDb.batch).toHaveBeenCalledTimes(2);
      expect(mockBatchCommit).toHaveBeenCalledTimes(2);
    });
  });

  // ───────────────────── Invalid action ─────────────────────

  it("rejects invalid action type", async () => {
    await expect(handler(makeRequest({ tenantId: "tenant-1", action: "delete" }))).rejects.toThrow(
      'action must be "list" or "markRead"'
    );
  });
});
