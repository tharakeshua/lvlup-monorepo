import { useSaveNotificationPreferences as useSdkSaveNotificationPreferences } from "@levelup/query";
import type { NotificationPreferences } from "./useNotificationPreferences";

/**
 * Map the app's per-category boolean toggles onto the server's
 * `enabledTypes: NotificationType[]` model. NOTE (parity gap): the server prefs
 * contract (`{ enabledTypes, muteUntil }`) does NOT model channel toggles
 * (email/push) or the achievement/leaderboard/streak categories — only the
 * exam/grading/deadline notification types have server analogs. The remaining
 * toggles round-trip in the UI but cannot be persisted server-side until the
 * SDK contract grows. See migration report.
 */
const TOGGLE_TO_TYPES: Record<keyof NotificationPreferences, string[]> = {
  examResults: [
    "exam_results_released",
    "new_exam_assigned",
    "submission_graded",
    "grading_complete",
  ],
  streakReminders: ["deadline_reminder"],
  achievementAlerts: [],
  leaderboardUpdates: [],
  emailNotifs: [],
  pushNotifs: [],
};

function toEnabledTypes(prefs: NotificationPreferences): string[] {
  const types = new Set<string>();
  (Object.keys(TOGGLE_TO_TYPES) as Array<keyof NotificationPreferences>).forEach((key) => {
    if (prefs[key]) TOGGLE_TO_TYPES[key].forEach((t) => types.add(t));
  });
  return [...types];
}

/**
 * Save notification preferences via the SDK. Tenant/user scope is implicit in
 * the SDK auth context; the legacy `{ tenantId, userId, prefs }` mutate shape is
 * preserved for call-site compatibility and mapped to the server contract.
 */
export function useSaveNotificationPreferences() {
  const mutation = useSdkSaveNotificationPreferences();

  type Vars = { tenantId: string; userId: string; prefs: NotificationPreferences };

  const mutate = (vars: Vars, options?: Parameters<typeof mutation.mutate>[1]) =>
    mutation.mutate({ enabledTypes: toEnabledTypes(vars.prefs) } as never, options);

  const mutateAsync = (vars: Vars, options?: Parameters<typeof mutation.mutateAsync>[1]) =>
    mutation.mutateAsync({ enabledTypes: toEnabledTypes(vars.prefs) } as never, options);

  return { ...mutation, mutate, mutateAsync };
}
