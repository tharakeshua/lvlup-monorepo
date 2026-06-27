/**
 * Identity — super-admin user search + realtime notification badge hooks.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { Repositories } from "@levelup/repositories";
import { useApi } from "../provider/useApi.js";
import { useSubscription, type UseSubscriptionResult } from "../realtime/useSubscription.js";
import { userSearchKeys } from "../keys/registry.js";

/** Super-admin search across users (batched memberships server-side, no N+1). */
export function useSearchUsers(query: string): UseQueryResult<unknown> {
  const { repos } = useApi();
  return useQuery({
    queryKey: userSearchKeys.list({ q: query }),
    queryFn: () =>
      (
        repos as unknown as Record<string, { search(q: string): Promise<unknown> }>
      ).userSearchRepo.search(query),
    enabled: query.length > 0,
  });
}

/**
 * Realtime unread-notification badge (`v1.notification.badge`, RTDB). Writes the
 * server-maintained slim projection into the badge cache key (server wins). Used
 * by every app's nav bell.
 */
export function useNotificationBadge(): UseSubscriptionResult {
  return useSubscription("v1.notification.badge", {} as never);
}
