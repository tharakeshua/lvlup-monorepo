/**
 * Store Browse (B2C) — "Explore the library" catalog screen.
 *
 * The consumer-learner storefront: a searchable, category-filterable grid of
 * purchasable / free spaces projected from the public catalog. Each card shows a
 * cover, subject, title, description, price (text + explicit currency), rating
 * and story-point/lesson count, and taps through to the space detail
 * (`routes.storeSpace(id)`) where the buy/enroll flow lives.
 *
 * Data:
 *  - `useStoreSpaces(filter)` (@levelup/query) → the catalog list, typed `unknown`.
 *    The active category (and search term) are passed as the `filter`; the result
 *    is ALSO client-filtered defensively in case the backend ignores the filter.
 *
 * Every field is read defensively (id, title/name, description, price, currency,
 * rating, thumbnail/coverUrl, points, subject) with sensible fallbacks — nothing
 * crashes on undefined. States: loading (skeleton grid) / error (EmptyState +
 * retry) / empty (warm EmptyState) / success.
 */
import { useMemo, useState } from "react";
import { Image, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { useStoreSpaces } from "@levelup/query";

import { routes } from "../../lib/routes";
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  Screen,
  SearchField,
  Skeleton,
  TopBar,
} from "../../components";

/* ------------------------------ defensive readers ------------------------------ */

const num = (v: unknown, d = 0): number => (typeof v === "number" && isFinite(v) ? v : d);
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

/** First present (non-null) value across candidate keys. */
function pick(source: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (source[k] !== undefined && source[k] !== null) return source[k];
  }
  return undefined;
}

/** Unwrap the list envelope a `unknown` list hook may return. */
function asList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.map(obj);
  const o = obj(data);
  for (const key of ["items", "spaces", "results", "data", "list"]) {
    const v = o[key];
    if (Array.isArray(v)) return v.map(obj);
  }
  return [];
}

/* ------------------------------- store-space model ------------------------------ */

interface StoreSpace {
  id: string;
  title: string;
  description: string;
  subject: string;
  price: number;
  currency: string;
  rating: number | null;
  reviews: number;
  points: number;
  coverUrl: string;
  free: boolean;
}

function normalize(raw: Record<string, unknown>, idx: number): StoreSpace {
  const id = str(pick(raw, ["id", "spaceId", "slug"]), `space-${idx}`);
  // Live backend shape: `ratingAggregate: { average, count }` (the TS type's
  // `{ averageRating, totalReviews }` is a lie). Read both defensively.
  const agg = obj(pick(raw, ["ratingAggregate", "ratings"]));
  const aggAvg = pick(agg, ["average", "averageRating", "avg"]);
  const ratingRaw =
    typeof aggAvg === "number" ? aggAvg : pick(raw, ["rating", "avgRating", "averageRating"]);
  const rating = typeof ratingRaw === "number" && isFinite(ratingRaw) ? ratingRaw : null;
  const reviewsRaw =
    pick(agg, ["count", "total", "totalReviews"]) ??
    pick(raw, ["reviews", "reviewCount", "ratingsCount"]);
  // Live `price` is a plain number (not `{ amount, currency }`).
  const price = num(pick(raw, ["price", "amount", "cost"]), 0);
  return {
    id,
    title: str(pick(raw, ["title", "name", "label"]), "Untitled space"),
    description: str(pick(raw, ["description", "desc", "summary", "tagline"]), ""),
    subject: str(pick(raw, ["subject", "category", "topic"]), "General"),
    price,
    currency: str(pick(raw, ["currency", "currencyCode"]), "INR"),
    rating,
    reviews: num(reviewsRaw, 0),
    points: num(pick(raw, ["points", "storyPoints", "storyPointCount", "lessons"]), 0),
    coverUrl: str(pick(raw, ["coverUrl", "thumbnail", "thumbnailUrl", "imageUrl"])),
    free: price <= 0,
  };
}

/** Price rendered as text, currency explicit (never color-only). */
function priceText(price: number, currency: string): string {
  if (price <= 0) return "Free";
  const sym = currency === "INR" ? "₹" : currency === "USD" ? "$" : `${currency} `;
  return sym + price.toLocaleString();
}

/* --------------------------------- rating row ---------------------------------- */

function RatingRow({ rating, reviews }: { rating: number | null; reviews: number }) {
  if (rating == null || reviews === 0) {
    return (
      <Badge variant="spark" icon="sparkles">
        New
      </Badge>
    );
  }
  return (
    <View className="flex-row items-center gap-1">
      <Icon name="star" size={13} color="#D97706" />
      <Text className="text-text-secondary font-mono text-xs">
        {rating.toFixed(1)} ({reviews.toLocaleString()})
      </Text>
    </View>
  );
}

/* ---------------------------------- store card --------------------------------- */

function StoreCard({ s, onPress }: { s: StoreSpace; onPress: () => void }) {
  return (
    <Card className="overflow-hidden p-0" onPress={onPress}>
      {/* cover */}
      <View className="bg-surface-sunken items-center justify-center" style={{ height: 96 }}>
        {s.coverUrl ? (
          <Image
            source={{ uri: s.coverUrl }}
            resizeMode="cover"
            style={{ width: "100%", height: 96 }}
          />
        ) : (
          <Icon name="book-open" size={30} color="#6366F1" />
        )}
        <View className="absolute right-2 top-2 flex-row gap-1">
          {s.free ? (
            <Badge variant="spark" icon="gift">
              Free
            </Badge>
          ) : null}
        </View>
      </View>

      {/* body */}
      <View className="gap-2 p-3">
        <View className="flex-row flex-wrap items-center gap-1">
          <Badge variant="brand">{s.subject}</Badge>
        </View>
        <Text className="font-display text-text-primary text-base font-semibold" numberOfLines={2}>
          {s.title}
        </Text>
        {s.description ? (
          <Text className="text-text-muted text-xs" numberOfLines={2}>
            {s.description}
          </Text>
        ) : null}

        {/* meta */}
        <View className="flex-row items-center gap-2">
          <Icon name="layers" size={12} color="#6B7280" />
          <Text className="text-text-secondary font-mono text-xs">{s.points} pts</Text>
        </View>

        <RatingRow rating={s.rating} reviews={s.reviews} />

        {/* footer */}
        <View className="mt-1 flex-row items-center justify-between">
          <Text
            className={
              s.free
                ? "text-success font-mono text-sm font-semibold"
                : "text-text-primary font-mono text-sm font-semibold"
            }
          >
            {priceText(s.price, s.currency)}
          </Text>
          <Button
            variant={s.free ? "spark" : "secondary"}
            size="sm"
            leadingIcon={s.free ? "unlock" : "shopping-cart"}
            onPress={onPress}
          >
            {s.free ? "Enroll" : "View"}
          </Button>
        </View>
      </View>
    </Card>
  );
}

/* ------------------------------- loading skeleton ------------------------------ */

function SkeletonCard() {
  return (
    <Card className="overflow-hidden p-0">
      <Skeleton width="100%" height={96} radius={0} />
      <View className="gap-2 p-3">
        <Skeleton width="40%" height={14} />
        <Skeleton width="80%" height={18} />
        <Skeleton width="95%" height={13} />
        <Skeleton width="55%" height={13} />
        <View className="mt-1 flex-row items-center justify-between">
          <Skeleton width={64} height={20} />
          <Skeleton width={72} height={28} />
        </View>
      </View>
    </Card>
  );
}

function LoadingGrid() {
  return (
    <View className="flex-row flex-wrap justify-between gap-y-4">
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ width: "48%" }}>
          <SkeletonCard />
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------ screen ----------------------------------- */

const ALL = "All";

export default function StoreBrowseScreen() {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL);

  // Pass the active facets to the hook; the list is also client-filtered below.
  const filter = useMemo<Record<string, unknown>>(() => {
    const f: Record<string, unknown> = {};
    if (query.trim()) f.search = query.trim();
    if (category !== ALL) f.subject = category;
    return f;
  }, [query, category]);

  const storeQuery = useStoreSpaces(filter);

  const spaces = useMemo<StoreSpace[]>(
    () => asList(storeQuery.data).map(normalize),
    [storeQuery.data]
  );

  const categories = useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const s of spaces) if (s.subject) set.add(s.subject);
    return [ALL, ...Array.from(set)];
  }, [spaces]);

  const filtered = useMemo<StoreSpace[]>(() => {
    const q = query.trim().toLowerCase();
    return spaces.filter((s) => {
      if (category !== ALL && s.subject !== category) return false;
      if (q && !s.title.toLowerCase().includes(q) && !s.subject.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [spaces, query, category]);

  const isLoading = storeQuery.isLoading;
  const isError = storeQuery.isError;

  /* --- error state --- */
  if (isError) {
    return (
      <Screen>
        <TopBar title="Store" />
        <EmptyState
          icon="cloud-off"
          title="We couldn't load the library"
          body="That's on us — give it another go."
          action={
            <Button
              variant="secondary"
              leadingIcon="refresh-cw"
              onPress={() => storeQuery.refetch()}
            >
              Try again
            </Button>
          }
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar title="Store" subtitle="Learn at your own pace" />

      <View className="gap-4">
        {/* search */}
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Search spaces…"
          onClear={() => setQuery("")}
        />

        {/* category chips */}
        {categories.length > 1 ? (
          <View className="flex-row flex-wrap gap-2">
            {categories.map((c) => (
              <Chip key={c} active={category === c} onPress={() => setCategory(c)}>
                {c}
              </Chip>
            ))}
          </View>
        ) : null}

        {/* body */}
        {isLoading ? (
          <LoadingGrid />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="search-x"
            title="No spaces found"
            body={
              query.trim() || category !== ALL
                ? "Try a different subject, or clear your filters."
                : "New spaces land regularly — check back soon."
            }
            action={
              query.trim() || category !== ALL ? (
                <Button
                  variant="secondary"
                  leadingIcon="x"
                  onPress={() => {
                    setQuery("");
                    setCategory(ALL);
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <View className="flex-row flex-wrap justify-between gap-y-4">
            {filtered.map((s) => (
              <View key={s.id} style={{ width: "48%" }}>
                <StoreCard s={s} onPress={() => router.push(routes.storeSpace(s.id))} />
              </View>
            ))}
          </View>
        )}

        <View className="h-6" />
      </View>
    </Screen>
  );
}
