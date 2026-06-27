/**
 * Identity — notification preferences + badge one-shot fallback
 * (notification.md §Query hooks).
 *
 *   useNotificationPreferences()      → notificationRepo.getPreferences (read; fills
 *                                       defaults: all types enabled, no mute)
 *   useSaveNotificationPreferences()  → ❌ NEVER optimistic (settings round-trip);
 *                                       invalidates `notificationPreferences`
 *   useNotificationBadgeQuery()       → one-shot badge read seeding
 *                                       `notificationBadge.detail('me')` BEFORE the
 *                                       realtime `useNotificationBadge()` subscription
 *                                       warms up (notification.md §useNotificationBadge)
 *
 * The save mutation routes through `defineMutation` so its invalidation goes via
 * the graph; it carries NO `optimistic` recipe (the lint + runtime guard need no
 * exemption — settings writes round-trip; §5.5 excludes them).
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { Repositories } from "@levelup/repositories";
import { useApi } from "../provider/useApi.js";
import { defineMutation } from "../mutation/define-mutation.js";
import { notificationPreferencesKeys, notificationBadgeKeys } from "../keys/registry.js";

interface NotificationRepoSlice {
  getPreferences(): Promise<unknown>;
  savePreferences(input: unknown): Promise<unknown>;
  getBadge(): Promise<unknown>;
}
const notif = (repos: Repositories): NotificationRepoSlice =>
  (repos as unknown as Record<string, NotificationRepoSlice>).notificationRepo;

/** Read the caller's notification preferences (defaults filled server-side). */
export function useNotificationPreferences(): UseQueryResult<unknown> {
  const { repos } = useApi();
  return useQuery({
    queryKey: notificationPreferencesKeys.detail("me"),
    queryFn: () => notif(repos).getPreferences(),
  });
}

/**
 * One-shot badge read — seeds `notificationBadge.detail('me')` so web/RN render
 * the badge once on load before the realtime subscription warms up. Pairs with
 * the realtime `useNotificationBadge()`.
 */
export function useNotificationBadgeQuery(): UseQueryResult<unknown> {
  const { repos } = useApi();
  return useQuery({
    queryKey: notificationBadgeKeys.detail("me"),
    queryFn: () => notif(repos).getBadge(),
  });
}

/** Save notification preferences. ❌ NEVER optimistic — settings round-trip. */
export const useSaveNotificationPreferences = defineMutation<unknown, unknown>({
  callable: "v1.identity.saveNotificationPreferences",
  run: (repos, vars) => notif(repos as Repositories).savePreferences(vars),
});
