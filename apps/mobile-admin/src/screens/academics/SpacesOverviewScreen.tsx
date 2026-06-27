/**
 * SpacesOverviewScreen — content spaces overview (LIVE today via useSpaces).
 *
 * Design: docs/rebuild-spec/design/build/prototypes/admin/spaces-overview.card.html
 * Route:  /admin/academics/content
 * Data:   useSpaces() — the real tenant content catalog (12 Subhang spaces today).
 *
 * Admin reviews/triages here; authoring is web-only → every space row + a header
 * CTA route to "Continue on web". Defensive: stats may be absent on any space.
 */
import { useMemo, useState } from "react";
import { Linking, View } from "react-native";
import { useSpaces } from "@levelup/query";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  ListRow,
  Pill,
  Screen,
  SearchField,
  SectionHeader,
  Skeleton,
  StatTile,
  TopBar,
} from "../../components";
import { isHardError } from "../../lib/query-status";
import { listOf, num, statusBadge, str, titleCase } from "./_shared";

const WEB_AUTHOR_URL = "https://app.levelup.academy";

interface SpaceRow {
  id?: string;
  title?: string;
  subject?: string;
  type?: string;
  status?: string;
  description?: string;
  stats?: {
    storyPointCount?: number;
    itemCount?: number;
    enrolledCount?: number;
    completionCount?: number;
  };
}

export default function SpacesOverviewScreen() {
  const spacesQ = useSpaces({});
  const [search, setSearch] = useState("");

  const spaces = useMemo(() => listOf<SpaceRow>(spacesQ.data), [spacesQ.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return spaces;
    return spaces.filter(
      (s) => str(s.title).toLowerCase().includes(q) || str(s.subject).toLowerCase().includes(q)
    );
  }, [spaces, search]);

  const published = spaces.filter((s) => str(s.status) === "published").length;
  const draft = spaces.filter((s) => str(s.status) === "draft").length;
  const totalItems = spaces.reduce((sum, s) => sum + num(s.stats?.itemCount, 0), 0);

  const openWeb = () => Linking.openURL(WEB_AUTHOR_URL).catch(() => {});

  return (
    <Screen scroll>
      <TopBar
        title="Content"
        subtitle="Spaces & courses"
        right={
          <Button size="sm" variant="secondary" trailingIcon="external-link" onPress={openWeb}>
            Author on web
          </Button>
        }
      />

      <View className="flex-row flex-wrap gap-3">
        <View className="min-w-[46%] flex-1">
          <StatTile
            label="Spaces"
            value={spacesQ.isLoading ? "…" : String(spaces.length)}
            icon="layers"
          />
        </View>
        <View className="min-w-[46%] flex-1">
          <StatTile
            label="Published"
            value={spacesQ.isLoading ? "…" : String(published)}
            icon="check-circle"
          />
        </View>
        <View className="min-w-[46%] flex-1">
          <StatTile
            label="Drafts"
            value={spacesQ.isLoading ? "…" : String(draft)}
            icon="file-pen-line"
          />
        </View>
        <View className="min-w-[46%] flex-1">
          <StatTile
            label="Items"
            value={spacesQ.isLoading ? "…" : String(totalItems)}
            icon="list"
          />
        </View>
      </View>

      <SearchField
        value={search}
        onChangeText={setSearch}
        placeholder="Search content…"
        onClear={() => setSearch("")}
      />

      <Card className="gap-1">
        <SectionHeader
          title="Content spaces"
          subtitle={filtered.length ? `${filtered.length} shown` : undefined}
        />

        {spacesQ.isLoading ? (
          <View className="gap-2 py-2">
            <Skeleton variant="rect" />
            <Skeleton variant="rect" />
            <Skeleton variant="rect" />
          </View>
        ) : isHardError(spacesQ) ? (
          <EmptyState
            icon="alert-triangle"
            title="Couldn't load content"
            body="Something went wrong reading the content catalog."
            action={
              <Button size="sm" variant="secondary" onPress={() => spacesQ.refetch()}>
                Retry
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="layers"
            title={spaces.length === 0 ? "No content yet" : "No matches"}
            body={
              spaces.length === 0
                ? "Content spaces authored on the web will appear here."
                : "Try a different search."
            }
            action={
              spaces.length === 0 ? (
                <Button size="sm" trailingIcon="external-link" onPress={openWeb}>
                  Author on web
                </Button>
              ) : undefined
            }
          />
        ) : (
          filtered.map((s, i) => {
            const sb = statusBadge(s.status ?? "draft");
            const meta = [
              s.type && titleCase(s.type),
              s.subject,
              `${num(s.stats?.storyPointCount, 0)} SP`,
              `${num(s.stats?.itemCount, 0)} items`,
            ]
              .filter(Boolean)
              .join("  ·  ");
            return (
              <ListRow
                key={str(s.id) || String(i)}
                title={str(s.title, "Untitled space")}
                subtitle={meta}
                leading={<Icon name="book-open" size={18} />}
                trailing={<Badge variant={sb.variant}>{sb.label}</Badge>}
                onPress={openWeb}
              />
            );
          })
        )}
      </Card>

      <Card className="flex-row items-center gap-3">
        <Icon name="info" size={18} />
        <View className="flex-1">
          <Pill variant="info">Web only</Pill>
        </View>
        <Button size="sm" variant="ghost" trailingIcon="external-link" onPress={openWeb}>
          Open editor
        </Button>
      </Card>
    </Screen>
  );
}
