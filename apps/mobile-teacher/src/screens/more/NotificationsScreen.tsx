/**
 * NotificationsScreen — teacher notification center (mobile-teacher).
 *
 * Translated from the teacher design prototype `prototypes/teacher/notifications`
 * into idiomatic RN + NativeWind, wired to real data.
 *
 * Data (ALL via `@levelup/query`):
 *   - useNotifications()            → the feed (returns `unknown`; unwrapped
 *                                     defensively — may be `T[]`, `{items}`,
 *                                     `{notifications}`, `{results}`, `{data}`).
 *   - useMarkNotificationRead()     → mark one notification row read (optimistic).
 *   - useMarkAllNotificationsRead() → "Mark all read" TopBar action (optimistic).
 *   - useMarkAnnouncementRead()     → announcement-type rows mark via the
 *                                     announcement carve-out (contract).
 *
 * States: loading (Skeleton rows), error (only a HARD error — a soft NOT_FOUND /
 * UNAUTHENTICATED feed for a fresh account falls through to empty), empty
 * ("You're all caught up"), success (FlatList of rows). Every field is read
 * defensively with safe fallbacks.
 */
import { useCallback, useMemo } from "react";
import { FlatList, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";

import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useMarkAnnouncementRead,
} from "@levelup/query";

import {
  Badge,
  Button,
  EmptyState,
  Icon,
  ListRow,
  Screen,
  Skeleton,
  TopBar,
} from "../../components";
import { routes } from "../../lib/routes";
import { isHardError } from "../../lib/query-status";

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
  announcementId: string;
  title: string;
  body: string;
  read: boolean;
  type: string;
  time: string;
  ts: number;
  examId: string;
  classId: string;
  studentId: string;
}

type Tone = "info" | "warn" | "err" | "ok" | "default";

/** Icon + tone per notification type (teacher domain). */
function meta(type: string): { icon: string; tone: Tone } {
  switch (type) {
    case "submission_graded":
    case "grading_complete":
    case "autograde_complete":
      return { icon: "clipboard-check", tone: "ok" };
    case "submission_needs_review":
    case "grading_needs_review":
      return { icon: "file-search", tone: "warn" };
    case "student_at_risk":
      return { icon: "life-buoy", tone: "err" };
    case "exam_results_released":
      return { icon: "graduation-cap", tone: "ok" };
    case "new_exam_assigned":
    case "exam_submitted":
      return { icon: "file-clock", tone: "info" };
    case "deadline_reminder":
      return { icon: "calendar-clock", tone: "warn" };
    case "announcement":
    case "announcement_published":
      return { icon: "megaphone", tone: "info" };
    case "class_joined":
    case "student_joined":
      return { icon: "user-plus", tone: "info" };
    default:
      return { icon: "bell", tone: "default" };
  }
}

const TONE_BG: Record<Tone, string> = {
  info: "bg-info-subtle",
  warn: "bg-warning-subtle",
  err: "bg-error-subtle",
  ok: "bg-success-subtle",
  default: "bg-surface-sunken",
};
const TONE_FG: Record<Tone, string> = {
  info: "#2E5AAC",
  warn: "#B25E09",
  err: "#B42318",
  ok: "#3F7E4E",
  default: "#756E61",
};

/** Coerce a createdAt-ish value → ms epoch. */
function toMillis(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v < 1e12 ? v * 1000 : v;
  if (typeof v === "string") {
    const n = Date.parse(v);
    return isFinite(n) ? n : 0;
  }
  const o = obj(v);
  if (typeof o.seconds === "number") return o.seconds * 1000;
  if (typeof o._seconds === "number") return (o._seconds as number) * 1000;
  return 0;
}

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
  const data = obj(raw.data);
  const payload = obj(raw.payload);
  return {
    id: str(raw.id ?? raw.notificationId ?? raw._id, `notif-${idx}`),
    announcementId: str(raw.announcementId ?? data.announcementId ?? payload.announcementId),
    title: str(raw.title ?? raw.heading, "Notification"),
    body: str(raw.body ?? raw.message ?? raw.description ?? raw.subtitle),
    read: bool(raw.isRead) || bool(raw.read),
    type: str(raw.type ?? raw.kind ?? raw.category, "default"),
    time: relativeTime(ts),
    ts,
    examId: str(raw.examId ?? data.examId ?? payload.examId),
    classId: str(raw.classId ?? data.classId ?? payload.classId),
    studentId: str(raw.studentId ?? data.studentId ?? payload.studentId),
  };
}

/* --------------------------------- screen ----------------------------------- */

export default function NotificationsScreen(): React.JSX.Element {
  const router = useRouter();
  const query = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const markAnnouncementRead = useMarkAnnouncementRead();

  const items = useMemo<Notif[]>(
    () =>
      asList(query.data)
        .map(normalize)
        .sort((a, b) => b.ts - a.ts),
    [query.data]
  );
  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  /** Resolve the in-app destination for a notification, if any. */
  const linkFor = useCallback((n: Notif): Href | null => {
    if (n.examId) {
      if (n.type === "exam_results_released") return routes.examAnalytics(n.examId);
      if (n.type.startsWith("submission") || n.type.startsWith("grading"))
        return routes.gradingReview(n.examId);
      return routes.examAnalytics(n.examId);
    }
    if (n.type === "student_at_risk") {
      return n.studentId ? routes.studentDetail(n.studentId) : routes.atRisk();
    }
    if (n.classId) return routes.classDetail(n.classId);
    if (n.type === "announcement" || n.type === "announcement_published")
      return routes.announcements();
    if (n.type.startsWith("grading") || n.type.startsWith("submission"))
      return routes.gradingQueue();
    return null;
  }, []);

  const onOpen = useCallback(
    (n: Notif) => {
      if (!n.read) {
        markRead.mutate({ notificationId: n.id });
        if (n.announcementId) {
          markAnnouncementRead.mutate({ announcementId: n.announcementId });
        }
      }
      const dest = linkFor(n);
      if (dest) router.push(dest);
    },
    [markRead, markAnnouncementRead, linkFor, router]
  );

  const renderRow = useCallback(
    ({ item: n }: { item: Notif }) => {
      const unread = !n.read;
      const m = meta(n.type);
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
                {n.time ? (
                  <Text className="text-2xs text-text-muted font-mono">{n.time}</Text>
                ) : null}
                {n.type === "student_at_risk" ? (
                  <Badge variant="error" icon="life-buoy">
                    At risk
                  </Badge>
                ) : null}
              </View>
            </View>
          }
          leading={
            <View
              className={`items-center justify-center rounded-full ${TONE_BG[m.tone]}`}
              style={{ width: 40, height: 40 }}
            >
              <Icon name={m.icon} size={20} color={TONE_FG[m.tone]} />
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
            body="Grading updates, at-risk alerts, and submission activity will show up here as your classes get to work."
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
        <Text className="font-ui text-text-muted text-sm">
          {unreadCount > 0
            ? `${unreadCount} new · ${items.length} total`
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
