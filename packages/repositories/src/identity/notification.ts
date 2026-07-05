/**
 * `notificationRepo` (SDK-LAYERS-PLAN §4.1, identity.md "notificationRepo").
 *
 * `list` (cursor) + `markRead(id)`/`markAllRead()` (✅ conservative-optimistic —
 * flip `isRead` + decrement badge, §4.4) + `getBadge` one-shot read +
 * `subscribeBadge(cb)` realtime pass-through (`v1.notification.badge`, RTDB).
 * Preferences read/save live here too (C2 — notification preferences).
 *
 * NOTE: the `manageNotifications` facade is DELETED (MERGE-NOTIF-FACADE); the
 * five split callables are canonical — `markNotificationRead` takes the
 * `{mode:'one',notificationId}|{mode:'all'}` discriminator.
 */
import type {
  Notification,
  NotificationPreferences,
  NotificationBadgeState,
} from "@levelup/domain";
import type {
  ApiClient,
  MarkNotificationReadResponse,
  PageRequest,
  SaveNotificationPreferencesRequest,
  SubscriptionHandle,
} from "../internal/api-types.js";
import { paginate, type PageBag } from "../internal/paginate.js";

export interface NotificationRepo {
  list(filter?: PageRequest): Promise<PageBag<Notification>>;
  paginate(filter?: PageRequest): Promise<PageBag<Notification>>;
  /** ✅ optimistic: flip `isRead`, decrement badge, rollback on error. */
  markRead(id: string): Promise<MarkNotificationReadResponse>;
  /** ✅ optimistic mark-all. */
  markAllRead(): Promise<MarkNotificationReadResponse>;
  getBadge(): Promise<NotificationBadgeState>;
  /** Realtime badge pass-through (`v1.notification.badge`, RTDB). */
  subscribeBadge(cb: (state: NotificationBadgeState) => void): SubscriptionHandle;
  getPreferences(): Promise<NotificationPreferences>;
  savePreferences(input: SaveNotificationPreferencesRequest): Promise<NotificationPreferences>;
}

/** No-op handle used when the client has no realtime transport wired. */
const NOOP_HANDLE: SubscriptionHandle = { unsubscribe() {}, id: "noop", active: false };

export function createNotificationRepo(api: ApiClient): NotificationRepo {
  return {
    list: (filter = {}) => paginate(api.identity.listNotifications, filter),
    paginate: (filter = {}) => paginate(api.identity.listNotifications, filter),
    markRead: (id) => api.identity.markNotificationRead({ mode: "one", notificationId: id }),
    markAllRead: () => api.identity.markNotificationRead({ mode: "all" }),
    getBadge: () => api.identity.getNotificationBadge({}),
    subscribeBadge: (cb) =>
      api.subscribe
        ? api.subscribe("v1.notification.badge", {}, (payload) =>
            cb(payload as NotificationBadgeState)
          )
        : NOOP_HANDLE,
    getPreferences: () => api.identity.getNotificationPreferences({}),
    savePreferences: (input) => api.identity.saveNotificationPreferences(input),
  };
}
