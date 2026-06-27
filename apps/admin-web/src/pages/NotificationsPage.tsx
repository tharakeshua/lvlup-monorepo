import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { NotificationsPage as NotificationsPageUI } from "@levelup/shared-ui";
import type { Notification } from "@levelup/shared-types";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@levelup/query";

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const page = data as { items?: Notification[]; nextCursor?: string | null } | undefined;
  const all = page?.items ?? [];
  const notifications = filter === "unread" ? all.filter((n) => !n.isRead) : all;

  return (
    <NotificationsPageUI
      notifications={notifications as unknown as Notification[]}
      isLoading={isLoading}
      hasMore={page?.nextCursor != null}
      filter={filter}
      onFilterChange={setFilter}
      onNotificationClick={(notif) => {
        if (!notif.isRead) markRead.mutate({ notificationId: notif.id });
        if (notif.actionUrl) navigate(notif.actionUrl);
      }}
      onMarkRead={(id) => markRead.mutate({ notificationId: id })}
      onMarkAllRead={() => markAllRead.mutate()}
    />
  );
}
