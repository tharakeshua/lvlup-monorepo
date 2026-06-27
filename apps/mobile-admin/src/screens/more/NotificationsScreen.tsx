/**
 * NotificationsScreen — updates addressed to the signed-in admin.
 *
 * Design: docs/rebuild-spec/design/build/prototypes/admin/notifications.card.html
 * Route:  /admin/more/notifications
 * Data:   useNotificationCenter() (unread summary) + useNotifications() (the feed).
 *         Admin callables — soft-miss to empty until deployed (lib/query-status).
 *         No server "mark read" mutation is in this lane's contract, so "Mark all
 *         as read" clears the unread state locally (and refetches the feed).
 */
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useNotificationCenter, useNotifications } from "@levelup/query";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  ListRow,
  Screen,
  SectionHeader,
  Skeleton,
  TopBar,
} from "../../components";
import { isHardError } from "../../lib/query-status";
import { fmtDate, listOf, pickBool, pickStr } from "./_shared";

const ICON_FOR: Record<string, string> = {
  budget: "wallet",
  ai: "sparkles",
  exam: "file-text",
  user: "user-plus",
  system: "settings",
  alert: "alert-triangle",
};

function iconFor(category: string | undefined): string {
  if (!category) return "bell";
  const key = Object.keys(ICON_FOR).find((k) => category.toLowerCase().includes(k));
  return key ? ICON_FOR[key] : "bell";
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [locallyRead, setLocallyRead] = useState(false);

  const centerQ = useNotificationCenter({});
  const listQ = useNotifications({});

  const items = useMemo(() => {
    const fromList = listOf(listQ.data);
    return fromList.length > 0 ? fromList : listOf(centerQ.data);
  }, [listQ.data, centerQ.data]);

  const unreadCount = useMemo(() => {
    if (locallyRead) return 0;
    const fromCenter = pickStr(centerQ.data, "unreadCount", "unread");
    if (fromCenter != null && Number.isFinite(Number(fromCenter))) return Number(fromCenter);
    return items.filter((n) => pickBool(n, "read", "isRead") === false).length;
  }, [centerQ.data, items, locallyRead]);

  const loading = listQ.isLoading && centerQ.isLoading;
  const hardError = isHardError(listQ) && isHardError(centerQ);

  const markAllRead = () => {
    setLocallyRead(true);
    void listQ.refetch();
    void centerQ.refetch();
  };

  return (
    <Screen scroll>
      <TopBar
        title="Notifications"
        subtitle="Updates addressed to you"
        onBack={() => router.back()}
        right={
          unreadCount > 0 ? <Badge variant="brand">{`${unreadCount} unread`}</Badge> : undefined
        }
      />

      <Card className="gap-1">
        <SectionHeader
          title="Inbox"
          action={
            unreadCount > 0 ? (
              <Button variant="ghost" size="sm" onPress={markAllRead}>
                Mark all read
              </Button>
            ) : undefined
          }
        />
        {loading ? (
          <View className="gap-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </View>
        ) : hardError ? (
          <EmptyState
            icon="alert-triangle"
            title="Couldn't load notifications"
            body="The notification service may be momentarily unavailable."
            action={
              <Button
                size="sm"
                variant="secondary"
                onPress={() => {
                  void listQ.refetch();
                  void centerQ.refetch();
                }}
              >
                Retry
              </Button>
            }
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon="bell-off"
            title="You're all caught up"
            body="No notifications yet. New updates addressed to you appear here."
          />
        ) : (
          items.map((n, i) => {
            const id = pickStr(n, "id", "notificationId") ?? `n-${i}`;
            const title = pickStr(n, "title", "subject") ?? "Notification";
            const message = pickStr(n, "message", "body", "description");
            const category = pickStr(n, "category", "type", "kind");
            const isRead = locallyRead || pickBool(n, "read", "isRead") === true;
            const when =
              fmtDate(
                (n as Record<string, unknown>).createdAt ?? (n as Record<string, unknown>).timestamp
              ) ?? undefined;
            const sub = [message, when].filter(Boolean).join(" · ");
            return (
              <ListRow
                key={id}
                title={title}
                subtitle={sub || undefined}
                leading={<Icon name={iconFor(category)} size={18} />}
                trailing={!isRead ? <Badge variant="brand" dot /> : undefined}
                chevron={false}
              />
            );
          })
        )}
      </Card>

      <Text className="text-2xs text-text-muted px-1 pb-2">
        Tenant-admin notifications populate once the admin notification service deploys.
      </Text>
    </Screen>
  );
}
