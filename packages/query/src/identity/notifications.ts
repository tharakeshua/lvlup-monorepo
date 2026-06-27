/**
 * Identity — notification hooks (identity.md "Query hooks").
 *
 *   useNotifications()             → notificationRepo.list
 *   useNotificationBadge()         → realtime badge via useSubscription (server-projection)
 *   useMarkNotificationRead()      → ✅ CONSERVATIVE OPTIMISTIC: flip `isRead` on the
 *                                    targeted notification + decrement the badge
 *                                    unreadCount; rollback on error (the ONLY ✅ surface
 *                                    in this domain besides mark-all + mark-announcement)
 *   useMarkAllNotificationsRead()  → ✅ optimistic mark-all
 *
 * The optimistic recipes are built through `defineMutation` so the runtime guard
 * (+ the lint) confirm `markNotificationRead` is allow-listed.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { Repositories } from "@levelup/repositories";
import { useApi } from "../provider/useApi.js";
import { defineMutation } from "../mutation/define-mutation.js";
import { patchDetail } from "../mutation/recipes/patch-detail.js";
import { decrementBadge } from "../mutation/recipes/increment-counter.js";
import { notificationKeys, notificationBadgeKeys } from "../keys/registry.js";

interface NotificationRepo {
  list(filter?: object): Promise<unknown>;
  markRead(id: string): Promise<unknown>;
  markAllRead(): Promise<unknown>;
}
const notif = (repos: Repositories): NotificationRepo =>
  (repos as unknown as Record<string, NotificationRepo>).notificationRepo;

const badgeKey = notificationBadgeKeys.detail("me");
const listKey = notificationKeys.list({});

export function useNotifications(filter?: object): UseQueryResult<unknown> {
  const { repos } = useApi();
  return useQuery({
    queryKey: notificationKeys.list(filter ?? {}),
    queryFn: () => notif(repos).list(filter),
  });
}

/**
 * Mark one notification read. ✅ optimistic: flip `isRead` on the targeted row
 * (list-patch) AND decrement the badge counter; both roll back on error. The
 * `onSettled` invalidation (notifications + notificationBadge roots) reconciles
 * with the server afterwards.
 */
export const useMarkNotificationRead = defineMutation<{ notificationId: string }, unknown>({
  callable: "v1.identity.markNotificationRead",
  run: (repos, vars) => notif(repos as Repositories).markRead(vars.notificationId),
  optimistic: {
    apply: (qc, vars, keys) => {
      // flip isRead on the targeted notification in the list
      const listPatch = patchDetail<{ notificationId: string }, unknown, unknown[]>(
        keys.notifications.list({}),
        (prev, v) =>
          (Array.isArray(prev) ? prev : []).map((n) =>
            (n as { id?: string }).id === v.notificationId ? { ...(n as object), isRead: true } : n
          )
      );
      const badge = decrementBadge(badgeKey);
      const listCtx = listPatch.apply(qc, vars, keys);
      const badgeCtx = badge.apply(qc, vars, keys);
      return { listCtx, badgeCtx };
    },
    rollback: (qc, ctx) => {
      const c = ctx as { listCtx: unknown; badgeCtx: unknown };
      patchDetail(listKey, (p) => p).rollback(qc, c.listCtx as never);
      decrementBadge(badgeKey).rollback(qc, c.badgeCtx as never);
    },
  },
});

/** Mark all notifications read. ✅ optimistic: zero the badge; rollback on error. */
export const useMarkAllNotificationsRead = defineMutation<void, unknown>({
  callable: "v1.identity.markNotificationRead",
  run: (repos) => notif(repos as Repositories).markAllRead(),
  optimistic: {
    apply: (qc, _vars, keys) => {
      const badge = patchDetail<void, unknown, { unreadCount?: number }>(
        keys.notificationBadge.detail("me"),
        (prev) => ({ ...(prev ?? {}), unreadCount: 0 })
      );
      return { badgeCtx: badge.apply(qc, undefined as void, keys) };
    },
    rollback: (qc, ctx) => {
      const c = ctx as { badgeCtx: unknown };
      patchDetail(badgeKey, (p) => p).rollback(qc, c.badgeCtx as never);
    },
  },
});
