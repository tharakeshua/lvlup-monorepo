/**
 * AnnouncementsScreen — broadcast notices to the academy.
 *
 * Design: docs/rebuild-spec/design/build/prototypes/admin/announcements.card.html
 * Route:  /admin/more/announcements
 * Data:   useAnnouncements(filter) (list) + useSaveAnnouncement() (create/publish).
 *         Both are admin-comms callables — until they deploy they soft-miss to
 *         empty (per lib/query-status), so the screen shows the zero state, never
 *         an error card.
 */
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAnnouncements, useSaveAnnouncement } from "@levelup/query";

import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  ListRow,
  Modal,
  Screen,
  SectionHeader,
  Skeleton,
  TextField,
  TopBar,
} from "../../components";
import type { BadgeVariant } from "../../components";
import { isHardError } from "../../lib/query-status";
import { fmtDate, humanize, listOf, pickStr } from "./_shared";

type StatusKey = "all" | "published" | "draft" | "archived";

const FILTERS: { key: StatusKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Draft" },
  { key: "archived", label: "Archived" },
];

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  published: "success",
  draft: "neutral",
  archived: "warning",
  scheduled: "info",
};

export default function AnnouncementsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<StatusKey>("all");
  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const listQ = useAnnouncements({});
  const saveMut = useSaveAnnouncement();

  const all = useMemo(() => listOf(listQ.data), [listQ.data]);
  const rows = useMemo(() => {
    if (filter === "all") return all;
    return all.filter((a) => (pickStr(a, "status") ?? "").toLowerCase() === filter);
  }, [all, filter]);

  const resetCompose = () => {
    setTitle("");
    setBody("");
    setComposeOpen(false);
  };

  const onPublish = (status: "draft" | "published") => {
    if (!title.trim()) return;
    saveMut.mutate(
      { title: title.trim(), body: body.trim(), status, audience: "everyone" },
      {
        onSuccess: () => {
          resetCompose();
          void listQ.refetch();
        },
      }
    );
  };

  return (
    <Screen scroll>
      <TopBar
        title="Announcements"
        subtitle="Broadcast notices to your academy"
        onBack={() => router.back()}
        right={
          <Button
            size="sm"
            variant="primary"
            leadingIcon="plus"
            onPress={() => setComposeOpen(true)}
          >
            New
          </Button>
        }
      />

      {/* Status filter */}
      <View className="flex-row flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Chip key={f.key} active={filter === f.key} onPress={() => setFilter(f.key)}>
            {f.label}
          </Chip>
        ))}
      </View>

      <Card className="gap-1">
        <SectionHeader
          title="Notices"
          subtitle={rows.length > 0 ? `${rows.length} shown` : undefined}
        />
        {listQ.isLoading ? (
          <View className="gap-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </View>
        ) : isHardError(listQ) ? (
          <EmptyState
            icon="alert-triangle"
            title="Couldn't load announcements"
            body="The directory service may be momentarily unavailable. Try again shortly."
            action={
              <Button size="sm" variant="secondary" onPress={() => void listQ.refetch()}>
                Retry
              </Button>
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="megaphone"
            title={filter === "all" ? "No announcements yet" : "No announcements match this filter"}
            body={
              filter === "all"
                ? "Broadcast your first notice to students and staff."
                : "Try a different status filter."
            }
            action={
              filter === "all" ? (
                <Button size="sm" variant="primary" onPress={() => setComposeOpen(true)}>
                  New announcement
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onPress={() => setFilter("all")}>
                  Clear filter
                </Button>
              )
            }
          />
        ) : (
          rows.map((a, i) => {
            const id = pickStr(a, "id", "announcementId") ?? `row-${i}`;
            const t = pickStr(a, "title", "subject") ?? "Untitled notice";
            const status = (pickStr(a, "status") ?? "draft").toLowerCase();
            const audience = humanize(pickStr(a, "audience", "scope")) ?? "Everyone";
            const rec = a as Record<string, unknown>;
            const created = fmtDate(rec.createdAt ?? rec.publishedAt ?? rec.updatedAt) ?? undefined;
            const sub = [audience, created].filter(Boolean).join(" · ");
            return (
              <ListRow
                key={id}
                title={t}
                subtitle={sub || undefined}
                leading={<Icon name="megaphone" size={18} />}
                trailing={
                  <Badge variant={STATUS_VARIANT[status] ?? "neutral"}>
                    {humanize(status) ?? status}
                  </Badge>
                }
              />
            );
          })
        )}
      </Card>

      <Text className="text-2xs text-text-muted px-1 pb-2">
        Announcements light up once the admin communications service deploys.
      </Text>

      {/* Compose modal */}
      <Modal
        open={composeOpen}
        onClose={resetCompose}
        title="New announcement"
        footer={
          <View className="flex-row justify-end gap-2">
            <Button variant="ghost" size="sm" onPress={resetCompose}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={saveMut.isPending}
              disabled={!title.trim()}
              onPress={() => onPublish("draft")}
            >
              Save draft
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={saveMut.isPending}
              disabled={!title.trim()}
              onPress={() => onPublish("published")}
            >
              Publish
            </Button>
          </View>
        }
      >
        <View className="gap-3">
          <TextField
            label="Title"
            required
            placeholder="Exam timetable update"
            value={title}
            onChangeText={setTitle}
          />
          <TextField
            label="Body"
            placeholder="Write your notice…"
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={4}
          />
          {saveMut.isError ? (
            <Text className="text-error text-xs">
              Couldn't save the announcement. Please try again.
            </Text>
          ) : null}
        </View>
      </Modal>
    </Screen>
  );
}
