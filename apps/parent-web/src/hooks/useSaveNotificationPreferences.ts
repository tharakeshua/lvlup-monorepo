import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveNotificationPrefs } from "../sdk/reads-notification-prefs";
import type { NotificationPreferences } from "./useNotificationPreferences";

// SDK GAP (accepted, app-local exception — see src/sdk/reads-notification-prefs.ts):
// the 5 boolean toggles persist to the bespoke
// `tenants/{tid}/notificationPreferences/{uid}` doc (firestore isolated under
// src/sdk). This hook stays firestore-clean and preserves its original mutate
// variables shape ({tenantId,userId,prefs}) + onSuccess invalidation, so the
// toggles persist exactly as before the migration (no behaviour change).
export function useSaveNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      tenantId,
      userId,
      prefs,
    }: {
      tenantId: string;
      userId: string;
      prefs: NotificationPreferences;
    }) => saveNotificationPrefs(tenantId, userId, prefs),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tenants", variables.tenantId, "notificationPreferences", variables.userId],
      });
    },
  });
}
