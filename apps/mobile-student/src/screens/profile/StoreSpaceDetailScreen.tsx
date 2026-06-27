/**
 * Store Space Detail (mobile-student · B2C)
 * -----------------------------------------
 * The purchase / enrolment page for a single store space. Translates the web
 * `store-space-detail` prototype into idiomatic RN + NativeWind (Lyceum "Modern
 * Scholarly"). The web file's "Spec states (reference)" showcase band is NOT
 * reproduced — only the real success view plus genuine loading / error / empty.
 *
 * Data (ONLY via `@levelup/query` — never Firestore directly):
 *  - `useStoreSpace(spaceId)`   → the space document: cover, title, subject,
 *      price, rating, instructor, description, curriculum (story points).
 *  - `useSpaceReviews(spaceId)` → learner reviews (avatar, name, stars, text).
 *
 * Both hook payloads are typed `unknown`, so every field is read through the
 * small defensive helpers below — a missing field degrades to a gentle fallback
 * or is omitted, never a crash. The list hooks may return a bare array or an
 * envelope (`{ items }`, `{ reviews }`, `{ storyPoints }`), all handled.
 *
 * Navigation: the sticky bottom bar's "Buy / Enroll" pushes the checkout modal
 * via `routes.checkout(spaceId)`.
 */
import React, { useCallback } from "react";
import { View, Text, Image } from "react-native";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useStoreSpace, useSpaceReviews } from "@levelup/query";
import { useLocalSearchParams, useRouter } from "expo-router";

import {
  Screen,
  Card,
  Button,
  Icon,
  Avatar,
  Badge,
  Chip,
  Divider,
  Skeleton,
  EmptyState,
} from "../../components";
import { routes } from "../../lib/routes";
import { colors } from "../../theme";

/* ───────────────────────── defensive readers ───────────────────────── */

const num = (v: unknown, d = 0): number => (typeof v === "number" && isFinite(v) ? v : d);
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

/** Pick the first present string among several candidate keys. */
const pick = (o: Record<string, unknown>, keys: string[], d = ""): string => {
  for (const k of keys) {
    const s = str(o[k]);
    if (s) return s;
  }
  return d;
};

/** Pick the first present finite number among several candidate keys. */
const pickNum = (o: Record<string, unknown>, keys: string[], d = 0): number => {
  for (const k of keys) {
    if (typeof o[k] === "number" && isFinite(o[k] as number)) return o[k] as number;
  }
  return d;
};

/** Unwrap a list hook payload: T[] | { items|reviews|spaces|storyPoints: T[] }. */
const asList = (v: unknown): unknown[] => {
  if (Array.isArray(v)) return v;
  const o = obj(v);
  for (const k of ["items", "reviews", "storyPoints", "curriculum", "spaces", "data"]) {
    if (Array.isArray(o[k])) return o[k] as unknown[];
  }
  return [];
};

/** Initials from a display name, e.g. "Priya R." → "PR". */
const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("") || "?";

const formatPrice = (o: Record<string, unknown>): string => {
  // A pre-formatted label wins if present…
  const explicit = pick(o, ["priceLabel", "displayPrice"]);
  if (explicit) return explicit;
  // …otherwise coerce the numeric `price` (live shape is a plain number, not
  // `{ amount, currency }`). Per data-shape rules: price -> Number(price ?? 0).
  const amount = pickNum(o, ["price", "priceAmount", "amount", "cost"], NaN);
  if (!isFinite(amount) || amount <= 0) return "Free";
  const currency = pick(o, ["currency", "currencySymbol"], "₹");
  const sym = currency.length <= 1 ? currency : "₹";
  return `${sym}${amount.toLocaleString()}`;
};

/* ───────────────────────────── stars ───────────────────────────────── */

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  const full = Math.round(value);
  return (
    <View className="flex-row items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon
          key={n}
          name="star"
          size={size}
          color={n <= full ? colors.spark : colors.borderStrong}
        />
      ))}
    </View>
  );
}

/* ───────────────────────── curriculum row ──────────────────────────── */

const TYPE_ICON: Record<string, string> = {
  learning: "book-open",
  practice: "dumbbell",
  hybrid: "layers",
  assessment: "clipboard-check",
};

function CurriculumRow({ index, item }: { index: number; item: Record<string, unknown> }) {
  const title = pick(item, ["title", "name", "label"], `Lesson ${index + 1}`);
  const type = pick(item, ["type", "kind", "pointType"], "Learning");
  const min = pickNum(item, ["min", "minutes", "durationMin", "estimatedMinutes"], 0);
  const icon = TYPE_ICON[type.toLowerCase()] ?? "book-open";
  return (
    <View className="flex-row items-center gap-3 py-3">
      <View className="bg-brand-subtle h-7 w-7 items-center justify-center rounded-full">
        <Text className="text-brand font-mono text-xs">{index + 1}</Text>
      </View>
      <View className="flex-1">
        <Text className="font-ui text-text-primary text-base">{title}</Text>
        <View className="mt-1 flex-row items-center gap-2">
          <Icon name={icon} size={12} color={colors.textMuted} />
          <Text className="text-text-muted text-xs">{type}</Text>
          {min > 0 ? (
            <>
              <View className="bg-border-strong h-1 w-1 rounded-full" />
              <Text className="text-text-muted font-mono text-xs">~{min} min</Text>
            </>
          ) : null}
        </View>
      </View>
      <Icon name="lock" size={14} color={colors.textMuted} />
    </View>
  );
}

/* ───────────────────────────── review ──────────────────────────────── */

function ReviewItem({ review }: { review: Record<string, unknown> }) {
  const name = pick(review, ["name", "author", "authorName", "userName"], "Learner");
  const text = pick(review, ["text", "comment", "body", "content"]);
  const date = pick(review, ["date", "createdAtLabel", "relativeDate"]);
  const uri = pick(review, ["avatar", "uri", "photoUrl", "avatarUrl"]);
  const rating = pickNum(review, ["rating", "stars", "score"], 0);
  return (
    <View className="flex-row gap-3 py-3">
      <Avatar size="md" uri={uri || undefined} initials={initialsOf(name)} />
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="font-ui text-text-primary font-semibold">{name}</Text>
          {date ? <Text className="text-text-muted text-xs">{date}</Text> : null}
        </View>
        {rating > 0 ? (
          <View className="mt-1">
            <Stars value={rating} size={12} />
          </View>
        ) : null}
        {text ? (
          <Text className="font-ui text-text-secondary mt-1 text-sm leading-5">{text}</Text>
        ) : null}
      </View>
    </View>
  );
}

/* ───────────────────────────── screen ──────────────────────────────── */

export default function StoreSpaceDetailScreen(): React.ReactElement {
  const { spaceId } = useLocalSearchParams<{ spaceId: string }>();
  const id = spaceId ?? "";
  const router = useRouter();

  const spaceQ = useStoreSpace(id);
  const reviewsQ = useSpaceReviews(id);

  const onBuy = useCallback(() => {
    router.push(routes.checkout(id));
  }, [router, id]);

  /* ---- loading ---- */
  if (spaceQ.isLoading) {
    return (
      <Screen>
        <Skeleton width="100%" height={200} radius={16} />
        <View className="gap-2">
          <Skeleton width="40%" height={14} />
          <Skeleton width="80%" height={28} />
          <Skeleton width="90%" height={14} />
          <Skeleton width="55%" height={14} />
        </View>
        <View className="gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width="100%" height={52} />
          ))}
        </View>
      </Screen>
    );
  }

  /* ---- error ---- */
  if (spaceQ.isError || !spaceQ.data) {
    return (
      <Screen>
        <View className="mt-8">
          <EmptyState
            icon="cloud-off"
            title="We couldn't load this space"
            body="This might be a hiccup on our end. Let's try again."
            action={
              <Button
                variant="spark"
                leadingIcon="refresh-cw"
                onPress={() => {
                  void spaceQ.refetch();
                }}
              >
                Retry
              </Button>
            }
          />
        </View>
      </Screen>
    );
  }

  /* ---- success ---- */
  const space = obj(spaceQ.data);
  const title = pick(space, ["title", "name"], "Untitled space");
  const subject = pick(space, ["subject", "category"]);
  const description = pick(space, ["description", "descriptionText", "summary", "about"]);
  const cover = pick(space, ["coverUrl", "coverImage", "thumbnail", "imageUrl", "cover"]);
  const instructor = pick(
    obj(space.instructor),
    ["name", "displayName"],
    pick(space, ["instructor", "instructorName", "author", "teacherName"])
  );
  const labels = arr(space.labels ?? space.tags)
    .map((l) => str(l))
    .filter(Boolean);
  // Live backend: `ratingAggregate: { average, count }` (TS type lies). Fall back
  // through both shapes per the data-shape rules.
  const ratingAgg = obj(space.ratingAggregate ?? space.ratings);
  const avg =
    pickNum(ratingAgg, ["average", "averageRating"], 0) ||
    pickNum(space, ["avg", "rating", "avgRating", "averageRating"], 0);
  const reviewCount =
    pickNum(ratingAgg, ["count", "totalReviews"], 0) ||
    pickNum(space, ["reviews", "reviewCount", "ratingsCount"], 0);
  const stats = obj(space.stats);
  const learners =
    pickNum(stats, ["enrolledCount", "enrollmentCount"], 0) ||
    pickNum(space, ["learners", "enrolledCount", "studentCount"], 0);
  const price = formatPrice(space);
  const strike = pick(space, ["strike", "originalPrice", "compareAtPrice"]);

  const curriculum = asList(space.storyPoints ?? space.curriculum ?? space.lessons);
  const reviews = asList(reviewsQ.data).map(obj);

  return (
    <SafeAreaView edges={["top", "bottom"]} className="bg-canvas flex-1">
      <ScrollView
        className="bg-canvas flex-1"
        contentContainerClassName="px-5 py-4 gap-5 pb-28"
        showsVerticalScrollIndicator={false}
      >
        {/* back */}
        <View className="flex-row">
          <Button
            variant="ghost"
            size="sm"
            leadingIcon="chevron-left"
            onPress={() => router.back()}
          >
            Back to Store
          </Button>
        </View>

        {/* hero */}
        <View className="gap-3">
          {cover ? (
            <Image
              source={{ uri: cover }}
              className="bg-surface-sunken w-full rounded-xl"
              style={{ height: 200 }}
              resizeMode="cover"
            />
          ) : (
            <View
              className="bg-brand-subtle w-full items-center justify-center rounded-xl"
              style={{ height: 200 }}
            >
              <Icon name="book-open" size={56} color={colors.brand} />
            </View>
          )}

          {(subject || labels.length > 0) && (
            <View className="flex-row flex-wrap gap-2">
              {subject ? <Chip active>{subject}</Chip> : null}
              {labels.map((l, i) => (
                <Chip key={`${l}-${i}`}>{l}</Chip>
              ))}
            </View>
          )}

          <Text className="font-display text-text-primary text-2xl">{title}</Text>

          {instructor ? (
            <View className="flex-row items-center gap-2">
              <Avatar size="sm" initials={initialsOf(instructor)} />
              <Text className="font-ui text-text-secondary text-sm">{instructor}</Text>
            </View>
          ) : null}

          <View className="flex-row flex-wrap items-center gap-2">
            {avg > 0 ? (
              <>
                <Stars value={avg} />
                <Text className="text-text-primary font-mono text-sm">{avg.toFixed(1)}</Text>
              </>
            ) : null}
            {reviewCount > 0 ? (
              <>
                <View className="bg-border-strong h-1 w-1 rounded-full" />
                <Text className="text-text-muted text-sm">
                  <Text className="font-mono">{reviewCount}</Text> reviews
                </Text>
              </>
            ) : null}
            {learners > 0 ? (
              <>
                <View className="bg-border-strong h-1 w-1 rounded-full" />
                <Text className="text-text-muted text-sm">
                  <Text className="font-mono">{learners}</Text> learners
                </Text>
              </>
            ) : null}
          </View>
        </View>

        {/* description */}
        {description ? (
          <View className="gap-2">
            <Text className="font-display text-text-primary text-lg">About this space</Text>
            <Text className="font-ui text-text-secondary text-base leading-6">{description}</Text>
          </View>
        ) : null}

        {/* what you'll learn / curriculum */}
        <View className="gap-1">
          <Text className="font-display text-text-primary text-lg">What you&apos;ll learn</Text>
          {curriculum.length > 0 ? (
            <Card className="mt-2 p-2">
              {curriculum.map((c, i) => (
                <View key={i}>
                  {i > 0 ? <Divider /> : null}
                  <View className="px-2">
                    <CurriculumRow index={i} item={obj(c)} />
                  </View>
                </View>
              ))}
            </Card>
          ) : (
            <Card className="bg-info/5 mt-2 flex-row items-start gap-3">
              <Icon name="info" size={18} color={colors.info} />
              <View className="flex-1">
                <Text className="font-ui text-text-primary font-semibold">
                  Curriculum details coming soon
                </Text>
                <Text className="font-ui text-text-secondary mt-1 text-sm">
                  We&apos;re polishing the lesson outline. The full curriculum unlocks the moment
                  you enrol.
                </Text>
              </View>
            </Card>
          )}
        </View>

        {/* reviews */}
        <View className="gap-1">
          <View className="flex-row items-center justify-between">
            <Text className="font-display text-text-primary text-lg">Ratings &amp; reviews</Text>
            {avg > 0 ? (
              <Badge variant="spark" icon="star">
                {avg.toFixed(1)}
              </Badge>
            ) : null}
          </View>

          {reviewsQ.isLoading ? (
            <View className="mt-2 gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} width="100%" height={72} />
              ))}
            </View>
          ) : reviewsQ.isError ? (
            <Card className="bg-warning/5 mt-2 flex-row items-center justify-between gap-3">
              <Text className="font-ui text-text-secondary flex-1 text-sm">
                Reviews didn&apos;t load — buying still works.
              </Text>
              <Button
                variant="ghost"
                size="sm"
                leadingIcon="refresh-cw"
                onPress={() => {
                  void reviewsQ.refetch();
                }}
              >
                Retry
              </Button>
            </Card>
          ) : reviews.length === 0 ? (
            <View className="mt-2">
              <EmptyState
                icon="message-square-plus"
                title="No reviews yet"
                body="Once you've spent time here, your honest take helps the next learner decide. You could be the first."
              />
            </View>
          ) : (
            <Card className="mt-2 p-2">
              {reviews.map((r, i) => (
                <View key={i}>
                  {i > 0 ? <Divider /> : null}
                  <View className="px-2">
                    <ReviewItem review={r} />
                  </View>
                </View>
              ))}
            </Card>
          )}
        </View>
      </ScrollView>

      {/* sticky bottom bar */}
      <View className="border-border-subtle bg-surface flex-row items-center gap-4 border-t px-5 py-3">
        <View className="flex-1">
          <View className="flex-row items-baseline gap-2">
            <Text className="font-display text-text-primary text-xl">{price}</Text>
            {strike ? (
              <Text className="font-ui text-text-muted text-sm line-through">{strike}</Text>
            ) : null}
          </View>
          <Text className="text-2xs text-text-muted uppercase tracking-wide">Lifetime access</Text>
        </View>
        <Button variant="spark" size="lg" leadingIcon="sparkles" onPress={onBuy}>
          Buy / Enroll
        </Button>
      </View>
    </SafeAreaView>
  );
}
