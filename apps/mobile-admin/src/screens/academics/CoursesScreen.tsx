/**
 * CoursesScreen — course catalog + subject coverage + store listings.
 *
 * Design: docs/rebuild-spec/design/build/prototypes/admin/courses.card.html
 * Route:  /admin/academics/courses
 * Data:   useSpaces() (tenant catalog, live today) grouped into subject coverage,
 *         and useStoreSpaces() (marketplace listings — soft-misses to empty).
 *
 * Tabbed: "Catalog" (tenant spaces) / "Store" (importable listings). Authoring
 * is web-only. Defensive: any stat/field may be absent.
 */
import { useMemo, useState } from "react";
import { Linking, View } from "react-native";
import { useSpaces, useStoreSpaces } from "@levelup/query";

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
  StatTile,
  Tabs,
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
  stats?: { storyPointCount?: number; itemCount?: number; enrolledCount?: number };
}

function CourseList({
  rows,
  loading,
  hardError,
  emptyTitle,
  emptyBody,
  onRetry,
  onPress,
}: {
  rows: SpaceRow[];
  loading: boolean;
  hardError: boolean;
  emptyTitle: string;
  emptyBody: string;
  onRetry?: () => void;
  onPress: () => void;
}) {
  if (loading) {
    return (
      <View className="gap-2 py-2">
        <Skeleton variant="rect" />
        <Skeleton variant="rect" />
      </View>
    );
  }
  if (hardError) {
    return (
      <EmptyState
        icon="alert-triangle"
        title="Couldn't load courses"
        body="Something went wrong reading the catalog."
        action={
          onRetry ? (
            <Button size="sm" variant="secondary" onPress={onRetry}>
              Retry
            </Button>
          ) : undefined
        }
      />
    );
  }
  if (rows.length === 0) {
    return <EmptyState icon="book-open" title={emptyTitle} body={emptyBody} />;
  }
  return (
    <View>
      {rows.map((c, i) => {
        const sb = statusBadge(c.status ?? "draft");
        const meta = [c.type && titleCase(c.type), c.subject, `${num(c.stats?.itemCount, 0)} items`]
          .filter(Boolean)
          .join("  ·  ");
        return (
          <ListRow
            key={str(c.id) || String(i)}
            title={str(c.title, "Untitled course")}
            subtitle={meta}
            leading={<Icon name="book-open" size={18} />}
            trailing={<Badge variant={sb.variant}>{sb.label}</Badge>}
            onPress={onPress}
          />
        );
      })}
    </View>
  );
}

export default function CoursesScreen() {
  const spacesQ = useSpaces({});
  const storeQ = useStoreSpaces({});

  const courses = useMemo(() => listOf<SpaceRow>(spacesQ.data), [spacesQ.data]);
  const store = useMemo(() => listOf<SpaceRow>(storeQ.data), [storeQ.data]);

  const [showCoverage, setShowCoverage] = useState(true);

  const published = courses.filter((c) => str(c.status) === "published").length;

  // subject coverage: total vs published per subject.
  const coverage = useMemo(() => {
    const map = new Map<string, { total: number; pub: number }>();
    for (const c of courses) {
      const subject = str(c.subject, "Uncategorized");
      const entry = map.get(subject) ?? { total: 0, pub: 0 };
      entry.total += 1;
      if (str(c.status) === "published") entry.pub += 1;
      map.set(subject, entry);
    }
    return Array.from(map.entries()).map(([subject, v]) => ({ subject, ...v }));
  }, [courses]);

  const openWeb = () => Linking.openURL(WEB_AUTHOR_URL).catch(() => {});

  return (
    <Screen scroll>
      <TopBar
        title="Courses"
        subtitle="Catalog & coverage"
        right={
          <Button size="sm" variant="secondary" trailingIcon="external-link" onPress={openWeb}>
            New on web
          </Button>
        }
      />

      <View className="flex-row flex-wrap gap-3">
        <View className="min-w-[46%] flex-1">
          <StatTile
            label="Courses"
            value={spacesQ.isLoading ? "…" : String(courses.length)}
            icon="book-open"
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
            label="Subjects"
            value={spacesQ.isLoading ? "…" : String(coverage.length)}
            icon="folder"
          />
        </View>
        <View className="min-w-[46%] flex-1">
          <StatTile
            label="Store"
            value={storeQ.isLoading ? "…" : String(store.length)}
            icon="store"
          />
        </View>
      </View>

      {/* subject coverage */}
      {coverage.length > 0 && (
        <Card className="gap-1">
          <SectionHeader
            title="Subject coverage"
            action={
              <Button size="sm" variant="ghost" onPress={() => setShowCoverage((v) => !v)}>
                {showCoverage ? "Hide" : "Show"}
              </Button>
            }
          />
          {showCoverage &&
            coverage.map((c) => (
              <ListRow
                key={c.subject}
                title={c.subject}
                subtitle={`${c.pub}/${c.total} published`}
                leading={<Icon name="folder" size={18} />}
                trailing={
                  <Badge
                    variant={c.pub === c.total ? "success" : "neutral"}
                  >{`${c.pub}/${c.total}`}</Badge>
                }
                chevron={false}
              />
            ))}
        </Card>
      )}

      <Card className="gap-1">
        <Tabs
          items={[
            {
              key: "catalog",
              label: "Catalog",
              content: (
                <CourseList
                  rows={courses}
                  loading={spacesQ.isLoading}
                  hardError={isHardError(spacesQ)}
                  emptyTitle="No courses yet"
                  emptyBody="Courses authored on the web will appear here."
                  onRetry={() => spacesQ.refetch()}
                  onPress={openWeb}
                />
              ),
            },
            {
              key: "store",
              label: "Store",
              content: (
                <CourseList
                  rows={store}
                  loading={storeQ.isLoading}
                  hardError={isHardError(storeQ)}
                  emptyTitle="No store listings"
                  emptyBody="Marketplace courses available to import will appear here."
                  onRetry={() => storeQ.refetch()}
                  onPress={openWeb}
                />
              ),
            },
          ]}
        />
      </Card>
    </Screen>
  );
}
