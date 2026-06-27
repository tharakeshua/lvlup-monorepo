/**
 * SpacesListScreen — the Learn tab landing ("My Spaces").
 *
 * Design: docs/rebuild-spec/design/build/app/mobile-family/_build/spaces-list.viewjs
 * Data:   useSpaces() (CONTENT slice). Progress rings hydrate from whatever the
 *         list projection carries (we NEVER block the grid on progress — the
 *         space-detail screen owns authoritative progress).
 *
 * Self-contained: navigates via expo-router + ../../lib/routes; the shell mounts
 * this default export under the Learn tab.
 */
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSpaces } from "@levelup/query";

import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  ProgressRing,
  Screen,
  SearchField,
} from "../../components";
import { routes } from "../../lib/routes";
import { ErrorState, ListSkeleton } from "./_shared/states";
import {
  asArray,
  difficultyMeta,
  masteryBand,
  spaceTypeMeta,
  toSpaceCard,
  type SpaceCardModel,
} from "./_shared/normalize";
import type { SpaceProgressView, SpaceView } from "./_shared/types";

type SortKey = "recent" | "progress" | "az";

const SORT_OPTS: { value: SortKey; label: string; icon: string }[] = [
  { value: "recent", label: "Recent", icon: "history" },
  { value: "progress", label: "Progress", icon: "trending-up" },
  { value: "az", label: "A–Z", icon: "arrow-down-up" },
];

/** One space card — rich tile matching the design (tags · meta · mastery ring). */
function SpaceTile({ card, onPress }: { card: SpaceCardModel; onPress: () => void }) {
  const band = masteryBand(card.percentage);
  const tm = spaceTypeMeta(card.type);
  const dm = difficultyMeta(card.difficulty);
  const complete = card.percentage >= 100;
  return (
    <Card interactive onPress={onPress} className="overflow-hidden p-0">
      {/* banner */}
      <View className={`h-16 ${complete ? "bg-spark/30" : "bg-brand-subtle"}`} />
      <View className="gap-2 p-4">
        <View className="flex-row flex-wrap items-center gap-2">
          <Badge variant="brand" icon={<Icon name={tm.icon} size={12} />}>
            {tm.label}
          </Badge>
          {dm ? <Chip>{dm.label}</Chip> : null}
          {complete ? (
            <Badge variant="success" icon={<Icon name="check-circle" size={12} />}>
              Completed
            </Badge>
          ) : null}
        </View>

        <Text className="font-display text-text-primary text-lg" numberOfLines={2}>
          {card.title}
        </Text>

        <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
          {card.subject ? <Text className="text-text-muted text-xs">{card.subject}</Text> : null}
          {card.subject ? <View className="bg-border-strong h-1 w-1 rounded-full" /> : null}
          <Text className="text-text-muted text-xs">{card.storyPointCount} story points</Text>
          {card.rating != null ? (
            <>
              <View className="bg-border-strong h-1 w-1 rounded-full" />
              <View className="flex-row items-center gap-1">
                <Icon name="star" size={11} color="#E8972B" />
                <Text className="text-text-muted text-xs">{card.rating.toFixed(1)}</Text>
              </View>
            </>
          ) : null}
        </View>

        {/* footer: mastery */}
        <View className="border-border-subtle mt-1 flex-row items-center justify-between border-t pt-3">
          <View className="flex-row items-center gap-1.5">
            <Icon name={band.icon} size={14} color="#756E61" />
            <Text className="text-text-muted text-xs">{band.word}</Text>
          </View>
          <ProgressRing
            value={card.percentage}
            size={44}
            label={card.percentage === 0 ? "—" : `${card.percentage}%`}
          />
        </View>
      </View>
    </Card>
  );
}

export default function SpacesListScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } = useSpaces<unknown>();

  const [query, setQuery] = useState("");
  const [activeSubject, setActiveSubject] = useState("All");
  const [sort, setSort] = useState<SortKey>("recent");

  const spaces = useMemo(() => asArray<SpaceView>(data), [data]);

  // Cards (progress read defensively from whatever the projection carries).
  const cards = useMemo<SpaceCardModel[]>(
    () =>
      spaces.map((s) => {
        const embedded = (s as { progress?: SpaceProgressView }).progress;
        return toSpaceCard(s, embedded);
      }),
    [spaces]
  );

  const subjects = useMemo(() => {
    const set = new Set<string>();
    cards.forEach((c) => c.subject && set.add(c.subject));
    return ["All", ...Array.from(set)];
  }, [cards]);

  const filtered = useMemo(() => {
    let list = cards.filter((c) => activeSubject === "All" || c.subject === activeSubject);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (c) => c.title.toLowerCase().includes(q) || (c.subject ?? "").toLowerCase().includes(q)
      );
    }
    if (sort === "az") list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "progress") list = [...list].sort((a, b) => b.percentage - a.percentage);
    return list;
  }, [cards, activeSubject, query, sort]);

  if (isLoading)
    return (
      <Screen className="bg-canvas">
        <ListSkeleton count={4} />
      </Screen>
    );
  if (isError)
    return (
      <ErrorState
        title="We couldn't load your spaces"
        body="Check your connection and try again."
        onRetry={() => refetch()}
      />
    );

  return (
    <Screen className="bg-canvas" contentClassName="p-5 gap-4">
      {/* header */}
      <View className="gap-1">
        <View className="flex-row items-center gap-2">
          <Text className="font-display text-text-primary text-2xl">My Spaces</Text>
          <Badge variant="brand">{cards.length}</Badge>
        </View>
        <Text className="text-text-muted text-sm">Pick up where you left off. ✦</Text>
      </View>

      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Search spaces"
        onClear={() => setQuery("")}
      />

      {/* subject filter chips */}
      {subjects.length > 1 ? (
        <View className="flex-row flex-wrap gap-2">
          {subjects.map((subj) => (
            <Pressable key={subj} onPress={() => setActiveSubject(subj)}>
              <Chip active={activeSubject === subj}>{subj}</Chip>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* sort + store */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row gap-2">
          {SORT_OPTS.map((o) => (
            <Pressable key={o.value} onPress={() => setSort(o.value)}>
              <Chip active={sort === o.value}>
                <View className="flex-row items-center gap-1">
                  <Icon name={o.icon} size={13} />
                  <Text className="text-xs">{o.label}</Text>
                </View>
              </Chip>
            </Pressable>
          ))}
        </View>
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<Icon name="store" size={16} />}
          onPress={() => router.push(routes.store())}
        >
          Store
        </Button>
      </View>

      {/* grid (single column on phone) */}
      {filtered.length > 0 ? (
        <View className="gap-4">
          {filtered.map((c) => (
            <SpaceTile key={c.id} card={c} onPress={() => router.push(routes.space(c.id))} />
          ))}
        </View>
      ) : cards.length === 0 ? (
        <View className="py-10">
          <EmptyState
            icon="book-open"
            title="No spaces yet"
            body="Your teacher hasn't assigned any learning spaces yet. Check back soon — they'll show up here the moment they do."
            action={
              <Button
                variant="secondary"
                leadingIcon={<Icon name="store" size={16} />}
                onPress={() => router.push(routes.store())}
              >
                Explore the Store
              </Button>
            }
          />
        </View>
      ) : (
        <View className="py-10">
          <EmptyState
            icon="filter"
            title="No spaces match this filter."
            body="Try ‘All’ to see everything you're learning."
            action={
              <Button
                variant="ghost"
                leadingIcon={<Icon name="x" size={16} />}
                onPress={() => {
                  setActiveSubject("All");
                  setQuery("");
                }}
              >
                Clear filter
              </Button>
            }
          />
        </View>
      )}

      {isRefetching ? (
        <Text className="text-text-muted py-2 text-center text-xs">Refreshing…</Text>
      ) : null}
    </Screen>
  );
}
