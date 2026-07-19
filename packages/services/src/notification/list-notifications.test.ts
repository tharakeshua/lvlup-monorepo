/**
 * Unit tests for notification projection + list/emit fixes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const prefsByUid = new Map<string, Record<string, unknown>>();

vi.mock("../shared/extended-repos.js", () => ({
  xrepos: () => ({
    notificationReads: {
      getPreferences: async (_t: string, uid: string) => prefsByUid.get(uid) ?? null,
      unreadCount: async () => 1,
    },
    badges: { set: async () => undefined },
    parents: { get: async () => null },
    assignments: { upsert: async () => ({ id: "a", created: true }) },
  }),
}));

import { listNotificationsService, emitNotificationService } from "./notifications.js";
import { projectNotification } from "../shared/projections.js";

const T = "tn_test";
const UID = "uid_parent_1";
const NOW = "2026-07-13T10:00:00.000Z";

function makeCtx() {
  const notifs = new Map<string, Record<string, unknown>>();
  return {
    uid: UID,
    tenantId: T,
    role: "parent" as const,
    now: () => NOW,
    repos: {
      notifications: {
        async list(_tenantId: string, opts: { where?: Record<string, unknown>; limit?: number }) {
          const where = opts.where ?? {};
          const filtered = [...notifs.values()].filter((n) =>
            Object.entries(where).every(([k, v]) => n[k] === v)
          );
          return { items: filtered.slice(0, opts.limit ?? 20), nextCursor: null };
        },
        _store: notifs,
      },
      tx: async (
        fn: (tx: {
          upsert: (c: string, t: string, d: Record<string, unknown>) => void;
        }) => Promise<unknown>
      ) => {
        await fn({
          upsert: (_coll, _tid, data) => {
            const id = String(data["id"] ?? `ntf_${notifs.size + 1}`);
            notifs.set(id, { ...data, id });
          },
        });
      },
      encodeCursor: (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64"),
      decodeCursor: (c: string) => JSON.parse(Buffer.from(c, "base64").toString("utf8")),
    },
  };
}

describe("projectNotification", () => {
  it("maps legacy recipientId + type aliases into strict shape", () => {
    const out = projectNotification(
      {
        id: "n1",
        recipientId: "uid_x",
        type: "exam_published",
        title: "Hi",
        body: "Body",
        isRead: false,
        createdAt: NOW,
        payload: { entityType: "exam", examId: "ex1" },
      },
      T,
      NOW
    );
    expect(out).toMatchObject({
      id: "n1",
      tenantId: T,
      recipientUid: "uid_x",
      type: "new_exam_assigned",
      entityType: "exam",
      entityId: "ex1",
      readAt: null,
    });
  });
});

describe("listNotificationsService", () => {
  beforeEach(() => prefsByUid.clear());

  it("merges recipientUid + legacy recipientId rows and projects", async () => {
    const ctx = makeCtx();
    const store = ctx.repos.notifications._store;
    store.set("a", {
      id: "a",
      tenantId: T,
      recipientUid: UID,
      recipientRole: "parent",
      type: "new_exam_assigned",
      title: "Test assigned to your child",
      body: "Aarav was assigned a test.",
      isRead: false,
      readAt: null,
      createdAt: "2026-07-13T09:00:00.000Z",
    });
    store.set("b", {
      id: "b",
      tenantId: T,
      recipientId: UID,
      recipientRole: "parent",
      type: "results_released",
      title: "Results",
      body: "Out",
      isRead: true,
      createdAt: "2026-07-13T11:00:00.000Z",
    });

    const res = await listNotificationsService({ limit: 20 } as never, ctx as never);
    expect(res.items).toHaveLength(2);
    expect(res.items[0]).toMatchObject({
      id: "b",
      type: "exam_results_released",
      recipientUid: UID,
    });
    expect(res.items[1]).toMatchObject({
      id: "a",
      type: "new_exam_assigned",
      title: "Test assigned to your child",
    });
  });
});

describe("emitNotificationService", () => {
  beforeEach(() => prefsByUid.clear());

  it("does not skip when enabledTypes is an empty array", async () => {
    const ctx = makeCtx();
    prefsByUid.set(UID, { enabledTypes: [] });
    const { created } = await emitNotificationService(
      {
        tenantId: T,
        recipientUids: [UID],
        recipientRole: "parent",
        type: "new_exam_assigned",
        title: "t",
        body: "b",
      },
      ctx as never
    );
    expect(created).toBe(1);
    const doc = [...ctx.repos.notifications._store.values()][0];
    expect(doc).toMatchObject({
      recipientUid: UID,
      recipientId: UID,
      recipientRole: "parent",
      readAt: null,
    });
  });
});
