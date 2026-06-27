/**
 * Notifications — learner notification center (mobile-student).
 *
 * Translated from the web design prototype `mobile-family/_build/notifications.viewjs`
 * into idiomatic React Native + NativeWind, wired to real data.
 *
 * Data (ALL via `@levelup/query`):
 *   - useNotifications()            → the notification feed (returns `unknown`;
 *                                     unwrapped defensively, may be `T[]`,
 *                                     `{ items: T[] }`, `{ notifications: T[] }`,
 *                                     or `{ data: T[] }`).
 *   - useMarkNotificationRead()     → mark one row read (optimistic in the hook).
 *   - useMarkAllNotificationsRead() → "Mark all read" TopBar action (optimistic).
 *
 * States handled: loading (Skeleton rows), error (EmptyState + retry),
 * empty (warm "You're all caught up" EmptyState), success (FlatList of ListRows).
 *
 * Each notification is read defensively — id / title / body|message /
 * read|isRead / createdAt / type are all best-effort with safe fallbacks.
 */
import { useCallback, useMemo } from "react";
import { FlatList, View, Text } from "react-native";
import { useRouter } from "expo-router";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@levelup/query";
import { routes } from "../../lib/routes";
import { isHardError } from "../../lib/query-status";
import {
  Screen,
  TopBar,
  Button,
  Icon,
  Badge,
  ListRow,
  Skeleton,
  EmptyState,
} from "../../components";

/* ----------------------------- defensive readers ----------------------------- */

const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const bool = (v: unknown): boolean => v === true;
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

/** Unwrap the various list envelopes a `unknown` list hook may return. */
function asList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.map(obj);
  const o = obj(data);
  for (const key of ["items", "notifications", "results", "data", "list"]) {
    const v = o[key];
    if (Array.isArray(v)) return v.map(obj);
  }
  return [];
}

/* ----------------------------- notification model ---------------------------- */

interface Notif {
  id: string;
  title: string;
  body: string;
  read: boolean;
  type: string;
  time: string;
  /** ms epoch for sorting; 0 when unknown. */
  ts: number;
  /** best-effort linked entity ids */
  spaceId: string;
  examId: string;
  storyPointId: string;
}

/** lucide-react-native icon name per notification type. */
function typeIcon(type: string): string {
  switch (type) {
    case "exam_results_released":
      return "graduation-cap";
    case "submission_graded":
      return "clipboard-check";
    case "new_space_assigned":
    case "space_published":
      return "unlock";
    case "new_exam_assigned":
      return "file-clock";
    case "deadline_reminder":
      return "calendar-clock";
    case "student_at_risk":
      return "life-buoy";
    case "streak":
      return "flame";
    case "achievement":
      return "award";
    default:
      return "bell";
  }
}

/** Coerce a createdAt-ish value (ISO string | ms number | seconds | Firestore TS) → ms epoch. */
function toMillis(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) {
    // treat 10-digit values as seconds
    return v < 1e12 ? v * 1000 : v;
  }
  if (typeof v === "string") {
    const n = Date.parse(v);
    return isFinite(n) ? n : 0;
  }
  const o = obj(v);
  if (typeof o.seconds === "number") return o.seconds * 1000;
  if (typeof o._seconds === "number") return (o._seconds as number) * 1000;
  if (typeof o.toMillis === "function") {
    try {
      const n = (o.toMillis as () => number)();
      return typeof n === "number" && isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

/** Relative "2h ago" style label. */
function relativeTime(ms: number): string {
  if (!ms) return "";
  const diff = Date.now() - ms;
  if (diff < 0) return "Just now";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function normalize(raw: Record<string, unknown>, idx: number): Notif {
  const ts = toMillis(raw.createdAt ?? raw.created_at ?? raw.timestamp ?? raw.sentAt);
  const read = bool(raw.isRead) || bool(raw.read);
  return {
    id: str(raw.id ?? raw.notificationId ?? raw._id, `notif-${idx}`),
    title: str(raw.title ?? raw.heading, "Notification"),
    body: str(raw.body ?? raw.message ?? raw.description ?? raw.subtitle),
    read,
    type: str(raw.type ?? raw.kind ?? raw.category, "default"),
    time: relativeTime(ts),
    ts,
    spaceId: str(raw.spaceId ?? obj(raw.data).spaceId ?? obj(raw.payload).spaceId),
    examId: str(raw.examId ?? obj(raw.data).examId ?? obj(raw.payload).examId),
    storyPointId: str(
      raw.storyPointId ?? obj(raw.data).storyPointId ?? obj(raw.payload).storyPointId
    ),
  };
}

/* --------------------------------- screen ----------------------------------- */

export default function NotificationsScreen(): React.JSX.Element {
  const router = useRouter();
  const query = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const items = useMemo<Notif[]>(() => {
    const list = asList(query.data).map(normalize);
    // newest first
    return list.sort((a, b) => b.ts - a.ts);
  }, [query.data]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  /** Resolve the in-app destination for a notification, if any. */
  const linkFor = useCallback((n: Notif) => {
    if (n.examId && (n.type === "exam_results_released" || n.type === "new_exam_assigned")) {
      return routes.examResults(n.examId);
    }
    if (n.storyPointId && n.type === "submission_graded") {
      return routes.testResults(n.storyPointId);
    }
    if (n.spaceId && (n.type === "new_space_assigned" || n.type === "space_published")) {
      return routes.space(n.spaceId);
    }
    if (n.type === "achievement") return routes.achievements();
    if (n.type === "streak") return routes.progress();
    return null;
  }, []);

  const onOpen = useCallback(
    (n: Notif) => {
      if (!n.read) markRead.mutate({ notificationId: n.id });
      const dest = linkFor(n);
      if (dest) router.push(dest);
    },
    [markRead, linkFor, router]
  );

  const renderRow = useCallback(
    ({ item: n }: { item: Notif }) => {
      const unread = !n.read;
      return (
        <ListRow
          title={
            <Text
              className={
                unread ? "font-ui text-text-primary font-semibold" : "font-ui text-text-secondary"
              }
            >
              {n.title}
            </Text>
          }
          sub={
            <View className="gap-1">
              {n.body ? (
                <Text className="font-ui text-text-secondary text-sm">{n.body}</Text>
              ) : null}
              <View className="flex-row items-center gap-2">
                {n.time ? <Text className="font-ui text-text-muted text-xs">{n.time}</Text> : null}
                {n.type === "achievement" ? (
                  <Badge variant="spark" icon="sparkles">
                    New badge
                  </Badge>
                ) : null}
              </View>
            </View>
          }
          leading={
            <View
              className="bg-brand-subtle items-center justify-center rounded-full"
              style={{ width: 40, height: 40 }}
            >
              <Icon name={typeIcon(n.type)} size={20} />
            </View>
          }
          trailing={
            unread ? (
              <View
                className="bg-spark rounded-full"
                style={{ width: 10, height: 10 }}
                accessibilityLabel="Unread"
              />
            ) : undefined
          }
          chevron={false}
          onPress={() => onOpen(n)}
        />
      );
    },
    [onOpen]
  );

  /* ------------------------------ TopBar action ------------------------------ */
  const topBarRight = (
    <Button
      variant="ghost"
      size="sm"
      leadingIcon="check-check"
      disabled={unreadCount === 0 || markAll.isPending}
      loading={markAll.isPending}
      onPress={() => markAll.mutate()}
    >
      Mark all read
    </Button>
  );

  /* -------------------------------- loading --------------------------------- */
  if (query.isLoading) {
    return (
      <Screen background="canvas">
        <TopBar title="Notifications" onBack={() => router.back()} />
        <View className="gap-3 px-4 pt-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} className="flex-row items-center gap-3">
              <Skeleton variant="circle" width={40} height={40} />
              <View className="flex-1 gap-2">
                <Skeleton width="78%" height={14} />
                <Skeleton width="55%" height={12} />
                <Skeleton width={64} height={10} />
              </View>
            </View>
          ))}
        </View>
      </Screen>
    );
  }

  /* --------------------------------- error ---------------------------------- */
  // An empty/absent feed for a fresh account is a soft miss → fall through to
  // the empty state. Only a genuine failure errors out.
  if (isHardError(query)) {
    return (
      <Screen background="canvas">
        <TopBar title="Notifications" onBack={() => router.back()} />
        <View className="flex-1 px-4 pt-8">
          <EmptyState
            icon="alert-triangle"
            title="We couldn't load your notifications"
            body="This is on us, not you. Give it another try in a moment."
            action={
              <Button
                variant="primary"
                size="sm"
                leadingIcon="rotate-ccw"
                loading={query.isFetching}
                onPress={() => query.refetch()}
              >
                Try again
              </Button>
            }
          />
        </View>
      </Screen>
    );
  }

  /* --------------------------------- empty ---------------------------------- */
  if (items.length === 0) {
    return (
      <Screen background="canvas">
        <TopBar title="Notifications" onBack={() => router.back()} />
        <View className="flex-1 px-4 pt-8">
          <EmptyState
            icon="check-circle"
            title="You're all caught up"
            body="When your teacher publishes a space, releases results, or you unlock an achievement, it'll show up here. Keep learning!"
            action={
              <Button
                variant="ghost"
                size="sm"
                leadingIcon="arrow-left"
                onPress={() => router.push(routes.home())}
              >
                Back to home
              </Button>
            }
          />
        </View>
      </Screen>
    );
  }

  /* -------------------------------- success --------------------------------- */
  return (
    <Screen background="canvas" scroll={false}>
      <TopBar
        title="Notifications"
        onBack={() => router.back()}
        right={unreadCount > 0 ? topBarRight : undefined}
      />
      <View className="px-4 pb-1 pt-1">
        <Text className="font-ui text-text-muted text-sm" accessibilityRole="text">
          {unreadCount > 0
            ? `You're almost caught up · ${unreadCount} new`
            : "You're all caught up — nothing new right now."}
        </Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        renderItem={renderRow}
        ItemSeparatorComponent={() => <View className="bg-border-subtle h-px" />}
        contentContainerClassName="px-4 pb-8"
        showsVerticalScrollIndicator={false}
        refreshing={query.isFetching}
        onRefresh={() => query.refetch()}
      />
    </Screen>
  );
}
