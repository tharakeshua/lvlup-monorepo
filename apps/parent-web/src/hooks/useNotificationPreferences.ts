import { useQuery } from "@tanstack/react-query";
import {
  getNotificationPrefs,
  DEFAULT_PREFS,
  type NotificationPreferences,
} from "../sdk/reads-notification-prefs";

// Re-export so existing consumers (SettingsPage) keep importing the type +
// defaults from this hook module unchanged.
export { DEFAULT_PREFS };
export type { NotificationPreferences };

// SDK GAP (accepted, app-local exception — see src/sdk/reads-notification-prefs.ts):
// parent-web's 5 boolean toggles have no representation in the identity SDK's
// `{ enabledTypes[], muteUntil }` prefs model, so the bespoke
// `tenants/{tid}/notificationPreferences/{uid}` read/write is isolated under
// src/sdk (the only place firestore is allowed). This hook stays firestore-clean
// and preserves its original signature + return shape.
export function useNotificationPreferences(tenantId: string | null, userId: string | null) {
  return useQuery<NotificationPreferences>({
    queryKey: ["tenants", tenantId, "notificationPreferences", userId],
    queryFn: () => getNotificationPrefs(tenantId!, userId!),
    enabled: !!tenantId && !!userId,
    staleTime: 5 * 60 * 1000,
  });
}
