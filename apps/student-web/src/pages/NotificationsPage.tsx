import { useState, type ComponentProps } from "react";
import { useNavigate } from "react-router-dom";
import { NotificationsPage as NotificationsPageUI } from "@levelup/shared-ui";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@levelup/query";

type NotificationItem = ComponentProps<typeof NotificationsPageUI>["notifications"][number];

interface NotificationListPage {
  items?: NotificationItem[];
  nextCursor?: string | null;
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data, isLoading } = useNotifications({
    unreadOnly: filter === "unread",
    limit: 50,
  });
  const page = data as NotificationListPage | undefined;

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  return (
    <NotificationsPageUI
      notifications={page?.items ?? []}
      isLoading={isLoading}
      hasMore={Boolean(page?.nextCursor)}
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
