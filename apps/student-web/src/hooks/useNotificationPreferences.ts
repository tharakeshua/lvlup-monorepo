import { useNotificationPreferences as useSdkNotificationPreferences } from "@levelup/query";

export interface NotificationPreferences {
  emailNotifs: boolean;
  pushNotifs: boolean;
  examResults: boolean;
  achievementAlerts: boolean;
  leaderboardUpdates: boolean;
  streakReminders: boolean;
}

export const DEFAULT_PREFS: NotificationPreferences = {
  emailNotifs: true,
  pushNotifs: true,
  examResults: true,
  achievementAlerts: true,
  leaderboardUpdates: true,
  streakReminders: true,
};

/**
 * Read the caller's notification preferences via the SDK. Tenant/user scope is
 * implicit in the SDK auth context, so the legacy `tenantId`/`userId` params are
 * preserved for call-site compatibility but only gate enablement.
 */
export function useNotificationPreferences(tenantId: string | null, userId: string | null) {
  const ready = !!tenantId && !!userId;
  const query = useSdkNotificationPreferences();
  const merged: NotificationPreferences = {
    ...DEFAULT_PREFS,
    ...((query.data as Partial<NotificationPreferences> | undefined) ?? {}),
  };
  return {
    ...query,
    data: ready ? merged : DEFAULT_PREFS,
  };
}
