/**
 * Identity — the unified notification-center inbox hook (notification.md
 * §Query hooks: `useNotificationCenter`).
 *
 *   useNotificationCenter(filter?) → notificationCenterRepo.inbox()
 *
 * Reads the merged bell-dropdown / inbox view-model (first page of notifications
 * + published announcements targeted at me + the badge `unreadCount`) in ONE
 * bounded batched fan-out — the N+1-collapse the cross-entity VIEW repo owns.
 * Read-only (the mark-read mutations live in `notifications.ts`/`announcements.ts`).
 * Keyed under the `notifications` DomainName root so it is invalidated alongside
 * the feed + announcement mark-read fanouts.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { Repositories } from "@levelup/repositories";
import { useApi } from "../provider/useApi.js";
import { notificationKeys } from "../keys/registry.js";

interface NotificationCenterRepoSlice {
  inbox(filter?: object): Promise<unknown>;
}
const center = (repos: Repositories): NotificationCenterRepoSlice =>
  (repos as unknown as Record<string, NotificationCenterRepoSlice>).notificationCenterRepo;

/** The merged notification-center inbox (notifications ⊕ announcements + badge). */
export function useNotificationCenter(filter?: object): UseQueryResult<unknown> {
  const { repos } = useApi();
  return useQuery({
    queryKey: notificationKeys.sub("center", "inbox", filter ?? {}),
    queryFn: () => center(repos).inbox(filter),
  });
}
