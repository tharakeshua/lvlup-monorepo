import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentUser, useCurrentTenantId } from "@levelup/shared-stores";
import { NotificationsPage as NotificationsPageUI } from "@levelup/shared-ui";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@levelup/query";
import type { Notification } from "@levelup/shared-types";

export default function NotificationsPage() {
  const navigate = useNavigate();
  // tenant/user are claim-derived inside the SDK hooks; kept here only for parity.
  useCurrentTenantId();
  useCurrentUser();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data, isLoading } = useNotifications({
    unreadOnly: filter === "unread",
    limit: 50,
  });
  const notifications = ((data as { items?: Notification[] } | undefined)?.items ??
    []) as Notification[];
  const hasMore = Boolean((data as { nextCursor?: string | null } | undefined)?.nextCursor);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  return (
    <NotificationsPageUI
      notifications={notifications}
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
