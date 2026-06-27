/**
 * `notificationCenterRepo` ⊕ — cross-entity VIEW repo (SDK-LAYERS-PLAN §4.1,
 * notification.md "notificationCenterRepo (cross-entity view repo)"). Lives under
 * `src/views/**` — the only sanctioned composition surface (R6 exception,
 * asserted by repo-isolation.static.test.ts). It is the ONLY place the
 * `Notification` and `Announcement` entities meet.
 *
 *   inbox(filter?) → NotificationCenterView
 *     The unified bell-dropdown / inbox view rendered across all 8 apps. Merges
 *     the FIRST PAGE of notifications + the published announcements targeted at
 *     me + the badge `unreadCount` into ONE time-ordered view model, in a SINGLE
 *     BOUNDED batched fan-out (parallel `listNotifications` + `listAnnouncements`
 *     + `getNotificationBadge`) — collapsing the N+1 the UI would otherwise do.
 *
 * Returns `{ items: InboxItem[], unreadCount }` where `InboxItem` is the
 * discriminated `{ kind:'notification' } | { kind:'announcement' }` shape the UI
 * renders without re-joining the two streams. Calls the injected api-client
 * directly; never imports the sibling `notificationRepo`/`announcementRepo`
 * modules (R6 — views compose via batched read CALLABLES, not sibling repos).
 */
import type { Announcement, Notification, NotificationType } from "@levelup/domain";
import type { ApiClient } from "../internal/api-types.js";

/**
 * The list-view projection of an announcement: the persisted `Announcement` plus
 * the server-derived `isReadByMe` flag (notification.md — the list response adds
 * `isReadByMe`, never exposes the deprecated `readBy` array, D6).
 */
export type AnnouncementListItem = Announcement & { isReadByMe?: boolean };

/** A merged inbox row — discriminated on `kind` so the UI renders without re-joining. */
export type InboxItem =
  | {
      kind: "notification";
      id: string;
      title: string;
      body: string;
      type: NotificationType;
      isRead: boolean;
      createdAt: string;
      actionUrl?: string;
      notification: Notification;
    }
  | {
      kind: "announcement";
      id: string;
      title: string;
      body: string;
      isRead: boolean;
      createdAt: string;
      announcement: AnnouncementListItem;
    };

/** The shaped notification-center view the bell dropdown / inbox consumes. */
export interface NotificationCenterView {
  items: InboxItem[];
  unreadCount: number;
}

export interface NotificationCenterFilter {
  /** Page size threaded to BOTH leaf list reads (opaque cursor stays per-stream). */
  limit?: number;
}

export interface NotificationCenterRepo {
  inbox(filter?: NotificationCenterFilter): Promise<NotificationCenterView>;
}

/** ISO-8601 strings sort lexicographically === chronologically; missing → epoch. */
function createdAtKey(iso: string | undefined): string {
  return iso ?? "";
}

function shapeNotification(n: Notification): InboxItem {
  const item: InboxItem = {
    kind: "notification",
    id: n.id as string,
    title: n.title,
    body: n.body,
    type: n.type,
    isRead: n.isRead ?? false,
    createdAt: n.createdAt as string,
    notification: n,
  };
  if (n.actionUrl !== undefined) item.actionUrl = n.actionUrl;
  return item;
}

function shapeAnnouncement(a: AnnouncementListItem): InboxItem {
  // Announcements surface on the inbox by publish time; fall back to createdAt.
  const at = (a.publishedAt as string | null | undefined) ?? (a.createdAt as string);
  return {
    kind: "announcement",
    id: a.id as string,
    title: a.title,
    body: a.body,
    isRead: a.isReadByMe ?? false,
    createdAt: at,
    announcement: a,
  };
}

export function createNotificationCenterRepo(api: ApiClient): NotificationCenterRepo {
  const id = api.identity;

  return {
    inbox: async (filter = {}) => {
      const limit = filter.limit;
      const pageReq = limit !== undefined ? { limit } : {};

      // ONE bounded, parallel fan-out — never an O(N) per-item read (PC-14).
      const [notifPage, annPage, badge] = await Promise.all([
        id.listNotifications(pageReq),
        id.listAnnouncements({ scope: "tenant", status: "published", ...pageReq }),
        id.getNotificationBadge({}),
      ]);

      const notifItems = (notifPage.items ?? []).map(shapeNotification);
      const annItems = ((annPage.items as AnnouncementListItem[] | undefined) ?? []).map(
        shapeAnnouncement
      );

      // Merge + sort time-descending (newest first) by ISO createdAt.
      const items = [...notifItems, ...annItems].sort((a, b) =>
        createdAtKey(b.createdAt) < createdAtKey(a.createdAt) ? -1 : 1
      );

      return { items, unreadCount: badge.unreadCount ?? 0 };
    },
  };
}
