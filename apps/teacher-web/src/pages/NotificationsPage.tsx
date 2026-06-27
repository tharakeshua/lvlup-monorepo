import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { NotificationsPage as NotificationsPageUI } from "@levelup/shared-ui";
import {
  useNotificationCenter,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@levelup/query";

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  // The notification-center inbox is tenant/user-scoped server-side from claims
  // (no tenantId/uid args). Filter unread client-side; the mark-read mutations
  // take only a notificationId. (Matches src/layouts/AppLayout.tsx wiring.)
  const { data: inbox, isLoading } = useNotificationCenter();
  const allNotifications =
    (inbox as { notifications?: unknown[] } | undefined)?.notifications ?? [];
  const hasMore = (inbox as { hasMore?: boolean } | undefined)?.hasMore;
  const notifications =
    filter === "unread"
      ? allNotifications.filter((n) => !(n as { isRead?: boolean }).isRead)
      : allNotifications;

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  return (
    <NotificationsPageUI
      notifications={notifications as never}
      isLoading={isLoading}
      hasMore={hasMore}
      filter={filter}
      onFilterChange={setFilter}
      onNotificationClick={(notif) => {
        if (!notif.isRead) {
          markRead.mutate({ notificationId: notif.id });
        }
        if (notif.actionUrl) navigate(notif.actionUrl);
      }}
      onMarkRead={(id) => {
        markRead.mutate({ notificationId: id });
      }}
      onMarkAllRead={() => {
        markAllRead.mutate();
      }}
    />
  );
}
