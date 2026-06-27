/**
 * AnnouncementsComposeScreen — compose + publish announcements (mobile-teacher).
 *
 * Translated from `prototypes/teacher/announcements-compose`. A mobile-friendly
 * composer (title + message + audience + pin) sits above a feed of the teacher's
 * recent announcements.
 *
 * Data (ALL via `@levelup/query`):
 *   - useAnnouncements()     → the existing announcement list (read defensively;
 *                              `unknown` envelope unwrapped; soft NOT_FOUND/
 *                              UNAUTHENTICATED for a fresh tenant → empty feed).
 *   - useSaveAnnouncement()  → publish/save. ⚷ publish lifecycle — NEVER optimistic;
 *                              on success we clear the composer + invalidate runs.
 *
 * The composer always renders (independent of the feed read), so a NOT_FOUND
 * feed on prod (pre GATE-B) never blocks composing.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { useAnnouncements, useSaveAnnouncement } from "@levelup/query";

import {
  Badge,
  Button,
  Card,
  Divider,
  FilterChips,
  Icon,
  ListRow,
  Screen,
  SectionHeader,
  Skeleton,
  TextField,
  TopBar,
} from "../../components";
import { isHardError } from "../../lib/query-status";

/* ------------------------------ constants ------------------------------ */

const SWITCH = { trackOn: "#423A82", trackOff: "#E4DFD2", thumb: "#FFFFFF" } as const;
const TITLE_MAX = 120;
const BODY_MAX = 2000;

const AUDIENCE_OPTIONS = [
  { key: "all", label: "All students", icon: "users" },
  { key: "classes", label: "My classes", icon: "graduation-cap" },
  { key: "staff", label: "Staff", icon: "briefcase" },
];

/* --------------------------- defensive readers -------------------------- */

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const bool = (v: unknown): boolean => v === true;

function asList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.map(obj);
  const o = obj(data);
  for (const key of ["items", "announcements", "results", "data", "list"]) {
    const v = o[key];
    if (Array.isArray(v)) return v.map(obj);
  }
  return [];
}

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
  if (diff < 0) return "Scheduled";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface Ann {
  id: string;
  title: string;
  body: string;
  status: string;
  audience: string;
  pinned: boolean;
  time: string;
  ts: number;
}

function normalize(raw: Record<string, unknown>, idx: number): Ann {
  const ts = toMillis(raw.publishedAt ?? raw.createdAt ?? raw.created_at ?? raw.scheduledFor);
  return {
    id: str(raw.id ?? raw.announcementId ?? raw._id, `ann-${idx}`),
    title: str(raw.title ?? raw.heading, "Untitled announcement"),
    body: str(raw.body ?? raw.message ?? raw.content),
    status: str(raw.status ?? raw.state, "published"),
    audience: str(raw.audience ?? raw.audienceLabel ?? obj(raw.audience).label, ""),
    pinned: bool(raw.pinned ?? raw.isPinned),
    time: relativeTime(ts),
    ts,
  };
}

function statusBadge(status: string): {
  variant: "success" | "warning" | "neutral";
  label: string;
} {
  switch (status) {
    case "published":
    case "live":
      return { variant: "success", label: "Published" };
    case "scheduled":
      return { variant: "warning", label: "Scheduled" };
    case "draft":
      return { variant: "neutral", label: "Draft" };
    default:
      return { variant: "neutral", label: status || "Draft" };
  }
}

/* -------------------------------- screen -------------------------------- */

export default function AnnouncementsComposeScreen(): React.JSX.Element {
  const router = useRouter();
  const query = useAnnouncements();
  const save = useSaveAnnouncement();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all");
  const [pinned, setPinned] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const items = useMemo<Ann[]>(
    () =>
      asList(query.data)
        .map(normalize)
        .sort((a, b) => b.ts - a.ts),
    [query.data]
  );

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(id);
  }, [notice]);

  const canPublish = title.trim().length > 0 && body.trim().length > 0 && !save.isPending;

  const submit = useCallback(
    (status: "published" | "draft") => {
      if (!title.trim() || !body.trim()) {
        setNotice("Add a title and a message first.");
        return;
      }
      save.mutate(
        {
          title: title.trim(),
          body: body.trim(),
          audience,
          pinned,
          status,
        },
        {
          onSuccess: () => {
            setTitle("");
            setBody("");
            setPinned(false);
            setAudience("all");
            setNotice(
              status === "published"
                ? "Announcement published to your students."
                : "Saved as a draft."
            );
          },
          onError: () => setNotice("Couldn't save — please try again."),
        }
      );
    },
    [title, body, audience, pinned, save]
  );

  return (
    <Screen background="canvas" scroll>
      <TopBar title="Announcements" onBack={() => router.back()} />

      <View className="gap-6 p-4 pb-12">
        {notice ? (
          <Card className="border-border-subtle bg-brand-subtle flex-row items-center gap-2 border p-3">
            <Icon name="info" size={16} color="#423A82" />
            <Text className="font-ui text-text-secondary flex-1 text-sm">{notice}</Text>
          </Card>
        ) : null}

        {/* composer */}
        <View className="gap-3">
          <SectionHeader title="New announcement" subtitle="Reaches your students in their feed." />
          <Card className="gap-4 p-4">
            <TextField
              label="Title"
              required
              placeholder="e.g. Mid-term schedule update"
              value={title}
              onChangeText={(t) => setTitle(t.slice(0, TITLE_MAX))}
              maxLength={TITLE_MAX}
              leadingIcon="type"
            />
            <TextField
              label="Message"
              required
              placeholder="Write the details your students need to know…"
              value={body}
              onChangeText={(t) => setBody(t.slice(0, BODY_MAX))}
              multiline
              numberOfLines={6}
              maxLength={BODY_MAX}
              hint={`${body.length}/${BODY_MAX}`}
            />

            <View className="gap-2">
              <Text className="font-ui text-text-muted text-xs font-semibold uppercase tracking-wide">
                Audience
              </Text>
              <FilterChips options={AUDIENCE_OPTIONS} value={audience} onChange={setAudience} />
            </View>

            <Divider />

            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="font-ui text-text-primary text-sm font-medium">Pin to top</Text>
                <Text className="font-ui text-text-muted text-xs">
                  Keep this announcement above the rest of the feed.
                </Text>
              </View>
              <Switch
                value={pinned}
                onValueChange={setPinned}
                trackColor={{ true: SWITCH.trackOn, false: SWITCH.trackOff }}
                thumbColor={SWITCH.thumb}
                ios_backgroundColor={SWITCH.trackOff}
                accessibilityLabel={`Pin to top — ${pinned ? "on" : "off"}`}
              />
            </View>

            <View className="flex-row gap-3">
              <Button
                variant="ghost"
                size="md"
                className="flex-1"
                leadingIcon="save"
                disabled={save.isPending}
                onPress={() => submit("draft")}
              >
                Save draft
              </Button>
              <Button
                variant="primary"
                size="md"
                className="flex-1"
                leadingIcon="send"
                loading={save.isPending}
                disabled={!canPublish}
                onPress={() => submit("published")}
              >
                Publish
              </Button>
            </View>
          </Card>
        </View>

        {/* recent feed */}
        <View className="gap-3">
          <SectionHeader title="Recent" />
          {query.isLoading ? (
            <Card className="gap-4 p-4">
              {[0, 1, 2].map((i) => (
                <View key={i} className="gap-2">
                  <Skeleton width="70%" height={14} />
                  <Skeleton width="90%" height={10} />
                  <Skeleton width={80} height={10} />
                </View>
              ))}
            </Card>
          ) : isHardError(query) ? (
            <Card className="items-center gap-2 p-6">
              <Icon name="alert-triangle" size={22} color="#B25E09" />
              <Text className="font-ui text-text-secondary text-sm">
                Couldn't load past announcements.
              </Text>
              <Button
                variant="secondary"
                size="sm"
                leadingIcon="rotate-ccw"
                loading={query.isFetching}
                onPress={() => query.refetch()}
              >
                Try again
              </Button>
            </Card>
          ) : items.length === 0 ? (
            <Card className="items-center gap-2 p-6">
              <Icon name="megaphone" size={22} color="#756E61" />
              <Text className="font-ui text-text-primary text-sm font-semibold">
                No announcements yet
              </Text>
              <Text className="font-ui text-text-muted px-4 text-center text-xs">
                Your published announcements will appear here. Compose your first one above.
              </Text>
            </Card>
          ) : (
            <Card className="px-1 py-1">
              {items.map((a, i) => {
                const b = statusBadge(a.status);
                return (
                  <View key={a.id}>
                    {i > 0 ? <View className="bg-border-subtle h-px" /> : null}
                    <ListRow
                      title={
                        <View className="flex-row items-center gap-2">
                          {a.pinned ? <Icon name="pin" size={13} color="#423A82" /> : null}
                          <Text className="font-ui text-text-primary flex-1 font-semibold">
                            {a.title}
                          </Text>
                        </View>
                      }
                      sub={
                        <View className="gap-1">
                          {a.body ? (
                            <Text numberOfLines={2} className="font-ui text-text-secondary text-sm">
                              {a.body}
                            </Text>
                          ) : null}
                          <View className="flex-row items-center gap-2">
                            <Badge variant={b.variant}>{b.label}</Badge>
                            {a.audience ? (
                              <Text className="font-ui text-2xs text-text-muted">{a.audience}</Text>
                            ) : null}
                            {a.time ? (
                              <Text className="text-2xs text-text-muted font-mono">{a.time}</Text>
                            ) : null}
                          </View>
                        </View>
                      }
                      chevron={false}
                    />
                  </View>
                );
              })}
            </Card>
          )}
        </View>
      </View>
    </Screen>
  );
}
