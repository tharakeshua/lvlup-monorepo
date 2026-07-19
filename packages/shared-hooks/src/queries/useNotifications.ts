import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { ref, onValue } from "firebase/database";
import { getFirebaseServices } from "@levelup/shared-services";
import type { Notification } from "@levelup/shared-types";

export type { Notification } from "@levelup/shared-types";

interface GetNotificationsResponse {
  notifications: Notification[];
  hasMore: boolean;
  lastId: string | null;
}

/**
 * Fetch paginated notifications from Cloud Function.
 */
export function useNotifications(
  tenantId: string | null,
  userId: string | null,
  options?: { unreadOnly?: boolean; limit?: number }
) {
  return useQuery<GetNotificationsResponse>({
    queryKey: ["tenants", tenantId, "notifications", userId, options?.unreadOnly ?? false],
    queryFn: async () => {
      if (!tenantId || !userId) return { notifications: [], hasMore: false, lastId: null };
      const { functions } = getFirebaseServices();
      const callable = httpsCallable<
        { tenantId: string; unreadOnly?: boolean; limit?: number },
        GetNotificationsResponse
      >(functions, "getNotifications");
      const result = await callable({
        tenantId,
        unreadOnly: options?.unreadOnly,
        limit: options?.limit ?? 20,
      });
      return result.data;
    },
    enabled: !!tenantId && !!userId,
    staleTime: 30_000,
  });
}

/**
 * Real-time RTDB subscription for unread notification count.
 */
export function useUnreadCount(tenantId: string | null, userId: string | null) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!tenantId || !userId) {
      setCount(0);
      return;
    }

    const { rtdb } = getFirebaseServices();
    const countRef = ref(rtdb, `notifications/${tenantId}/${userId}/unreadCount`);

    const unsub = onValue(countRef, (snap) => {
      setCount(snap.val() ?? 0);
    });

    return () => unsub();
  }, [tenantId, userId]);

  return count;
}

/**
 * Mark a single notification as read.
 */
export function useMarkRead() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<
    { tenantId: string; notificationId: string },
    { success: boolean; markedCount: number }
  >(functions, "markNotificationRead");

  return useMutation({
    mutationFn: async (params: { tenantId: string; notificationId: string }) => {
      const result = await callable(params);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tenants", variables.tenantId, "notifications"],
      });
    },
  });
}

/**
 * Mark all notifications as read.
 */
export function useMarkAllRead() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<{ tenantId: string }, { success: boolean; markedCount: number }>(
    functions,
    "markNotificationRead"
  );

  return useMutation({
    mutationFn: async (params: { tenantId: string }) => {
      const result = await callable(params);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tenants", variables.tenantId, "notifications"],
      });
    },
  });
}
