/**
 * Consumer (B2C) Home Dashboard — "My learning" home for a self-serve learner.
 *
 * The signed-in consumer's landing surface: a warm greeting, a horizontal
 * "Continue learning" row of the spaces they're enrolled in, a stats strip
 * derived from their cross-domain summary, a "Recommended for you" rail pulled
 * from the store, and a CTA into the full store.
 *
 * Data (all via @levelup/query / app SDK — never Firestore directly):
 *  - `useSession()` (app SDK)                  → signed-in identity { uid, email, displayName }.
 *  - `useStudentSummary(uid)` (@levelup/query) → cross-domain learner summary (typed `unknown`).
 *  - `useSpaces()` (@levelup/query)            → the learner's enrolled spaces (typed `unknown`).
 *  - `useStoreSpaces({})` (@levelup/query)     → purchasable store spaces to recommend (typed `unknown`).
 *
 * Every hook payload is `unknown`, so all field access goes through the small
 * defensive readers below: nothing crashes on undefined, list envelopes are
 * unwrapped, and missing fields fall back gracefully. The screen renders
 * loading / error / empty / success states.
 */
import { useRouter } from "expo-router";
import { useSpaces, useStoreSpaces, useStudentSummary } from "@levelup/query";
import { asUserId } from "@levelup/domain";
import { ScrollView, Text, View } from "react-native";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  ProgressBar,
  Screen,
  SectionHeader,
  Skeleton,
  StatTile,
} from "../../components";

import { routes } from "../../lib/routes";
import { useSession } from "../../sdk/session";

/* ---------------- defensive readers ---------------- */
const num = (v: unknown, d = 0): number => (typeof v === "number" && isFinite(v) ? v : d);
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

/** Unwrap a list hook payload that may be `T[]`, `{ items }`, `{ spaces }`, or `{ data }`. */
function asList(v: unknown): Record<string, unknown>[] {
  if (Array.isArray(v)) return v.map(obj);
  const o = obj(v);
  for (const key of ["items", "spaces", "results", "data", "docs"]) {
    if (Array.isArray(o[key])) return (o[key] as unknown[]).map(obj);
  }
  return [];
}

/** First present value across candidate keys. */
function pick(source: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (source[k] !== undefined && source[k] !== null) return source[k];
  }
  return undefined;
}

/* ---------------- per-record field shapes ---------------- */
interface SpaceView {
  id: string;
  title: string;
  description: string;
  points: number;
  progress: number;
  spark: boolean;
}

interface StoreView {
  id: string;
  title: string;
  description: string;
  price: string;
}

function readSpace(raw: Record<string, unknown>): SpaceView {
  return {
    id: str(pick(raw, ["id", "spaceId", "uid", "_id"])),
    title: str(pick(raw, ["title", "name", "displayName"]), "Untitled space"),
    description: str(pick(raw, ["description", "subtitle", "summary", "tagline"])),
    points: num(pick(raw, ["storyPoints", "points", "lessons", "lessonCount", "totalPoints"])),
    progress: Math.max(
      0,
      Math.min(100, num(pick(raw, ["progress", "progressPct", "percentComplete", "completion"])))
    ),
    spark: pick(raw, ["isNew", "featured", "spark"]) === true,
  };
}

function formatPrice(raw: unknown): string {
  if (typeof raw === "string" && raw.trim()) return raw;
  const cents = pick(obj(raw), ["priceCents", "amountCents"]);
  if (typeof cents === "number" && cents > 0) {
    return "₹" + Math.round(cents / 100).toLocaleString("en-IN");
  }
  const n = num(raw, 0);
  if (n <= 0) return "Free";
  return "₹" + n.toLocaleString("en-IN");
}

function readStore(raw: Record<string, unknown>): StoreView {
  return {
    id: str(pick(raw, ["id", "spaceId", "uid", "_id"])),
    title: str(pick(raw, ["title", "name", "displayName"]), "Untitled space"),
    description: str(pick(raw, ["description", "subtitle", "summary", "tagline"])),
    price: formatPrice(pick(raw, ["price", "priceLabel", "priceCents", "amountCents", "amount"])),
  };
}

function firstName(name: string, email: string): string {
  const base = name.trim() || email.trim();
  if (!base) return "there";
  const part = base.split(/[\s@.]+/).filter(Boolean)[0];
  if (!part) return "there";
  return part.charAt(0).toUpperCase() + part.slice(1);
}

/* ---------------- enrolled-space card (continue learning rail) ---------------- */
function EnrolledCard({ space, onPress }: { space: SpaceView; onPress: () => void }) {
  const completed = space.progress >= 100;
  return (
    <Card onPress={onPress} className="mr-3 w-64 gap-3">
      <View className="flex-row items-start justify-between gap-2">
        <View className="bg-brand-subtle h-11 w-11 items-center justify-center rounded-lg">
          <Icon name="git-branch" size={22} />
        </View>
        {completed ? (
          <Badge variant="success" icon="check-circle">
            Completed
          </Badge>
        ) : space.spark ? (
          <Badge variant="spark" icon="sparkles">
            New
          </Badge>
        ) : null}
      </View>
      <View className="gap-1">
        <Text className="font-display text-text-primary text-base font-semibold" numberOfLines={2}>
          {space.title}
        </Text>
        {space.description ? (
          <Text className="font-ui text-text-muted text-xs" numberOfLines={2}>
            {space.description}
          </Text>
        ) : null}
      </View>
      <View className="gap-1.5">
        <ProgressBar value={space.progress} />
        <View className="flex-row items-center justify-between">
          <Text className="text-2xs text-text-muted font-mono">
            {completed ? "Done" : `${space.progress}% complete`}
          </Text>
          {space.points > 0 ? (
            <Text className="text-2xs text-text-muted font-mono">{space.points} lessons</Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

/* ---------------- store-space card (recommended rail) ---------------- */
function StoreCard({ space, onPress }: { space: StoreView; onPress: () => void }) {
  return (
    <Card onPress={onPress} className="mr-3 w-60 gap-3">
      <View className="bg-spark/20 h-11 w-11 items-center justify-center rounded-lg">
        <Icon name="sparkles" size={22} />
      </View>
      <View className="gap-1">
        <Text className="font-display text-text-primary text-base font-semibold" numberOfLines={2}>
          {space.title}
        </Text>
        {space.description ? (
          <Text className="font-ui text-text-muted text-xs" numberOfLines={2}>
            {space.description}
          </Text>
        ) : null}
      </View>
      <View className="flex-row items-center justify-between">
        <Text className="text-text-primary font-mono text-sm font-semibold">{space.price}</Text>
        <Icon name="arrow-right" size={16} />
      </View>
    </Card>
  );
}

/* ---------------- loading skeleton (matches success geometry) ---------------- */
function LoadingState() {
  return (
    <View className="gap-6">
      <View className="gap-2">
        <Skeleton width="55%" height={28} />
        <Skeleton width="40%" height={14} />
      </View>
      <View className="gap-3">
        <Skeleton width="45%" height={18} />
        <View className="flex-row">
          {[0, 1].map((i) => (
            <View key={i} className="mr-3">
              <Skeleton width={256} height={150} />
            </View>
          ))}
        </View>
      </View>
      <View className="flex-row gap-3">
        {[0, 1, 2].map((i) => (
          <View key={i} className="flex-1">
            <Skeleton width="100%" height={72} />
          </View>
        ))}
      </View>
      <View className="gap-3">
        <Skeleton width="50%" height={18} />
        <View className="flex-row">
          {[0, 1].map((i) => (
            <View key={i} className="mr-3">
              <Skeleton width={240} height={130} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/* ---------------- screen ---------------- */
export default function ConsumerDashboardScreen() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const uid = asUserId(user?.uid ?? "");

  const summaryQuery = useStudentSummary(uid);
  const spacesQuery = useSpaces();
  const storeQuery = useStoreSpaces({});

  const summary = obj(summaryQuery.data);
  const enrolled = asList(spacesQuery.data)
    .map(readSpace)
    .filter((s) => s.id);
  const recommendedIds = new Set(enrolled.map((s) => s.id));
  const recommended = asList(storeQuery.data)
    .map(readStore)
    .filter((s) => s.id && !recommendedIds.has(s.id))
    .slice(0, 8);

  const greetingName = firstName(str(user?.displayName), str(user?.email));

  /* summary-derived stats */
  const spacesEnrolled = num(
    pick(summary, ["enrolledSpaces", "spacesEnrolled", "spaceCount"]),
    enrolled.length
  );
  const xp = num(pick(summary, ["xp", "totalXp", "points", "storyPointsEarned"]));
  const streak = num(pick(summary, ["streak", "streakDays", "currentStreak"]));

  const isLoading = sessionLoading || (Boolean(uid) && spacesQuery.isLoading && !spacesQuery.data);
  const isError = spacesQuery.isError;

  const retry = (): void => {
    void summaryQuery.refetch();
    void spacesQuery.refetch();
    void storeQuery.refetch();
  };

  /* --- error: enrolled spaces failed to load --- */
  if (isError) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-off"
          title="We couldn't load your learning home"
          body="Let's try that again — this one's on us, not you."
          action={
            <Button variant="primary" leadingIcon="rotate-cw" onPress={retry}>
              Try again
            </Button>
          }
        />
      </Screen>
    );
  }

  /* --- loading --- */
  if (isLoading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  /* --- signed out / no identity --- */
  if (!uid) {
    return (
      <Screen>
        <EmptyState
          icon="user"
          title="You're signed out"
          body="Sign in to pick up where you left off."
          action={
            <Button
              variant="primary"
              leadingIcon="log-in"
              onPress={() => router.push(routes.login())}
            >
              Sign in
            </Button>
          }
        />
      </Screen>
    );
  }

  const hasEnrolled = enrolled.length > 0;
  const hasRecommended = recommended.length > 0;

  return (
    <Screen>
      <View className="gap-6">
        {/* GREETING */}
        <View className="gap-1">
          <Text className="font-display text-text-primary text-2xl font-semibold">
            Welcome back, {greetingName}
          </Text>
          <Text className="font-ui text-text-muted text-sm">Pick up where you left off.</Text>
        </View>

        {/* CONTINUE LEARNING */}
        {hasEnrolled ? (
          <View className="gap-3">
            <SectionHeader
              title="Continue learning"
              actions={
                <Button
                  variant="ghost"
                  size="sm"
                  trailingIcon="arrow-right"
                  onPress={() => router.push(routes.spaces())}
                >
                  All spaces
                </Button>
              }
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 4 }}
            >
              {enrolled.map((space) => (
                <EnrolledCard
                  key={space.id}
                  space={space}
                  onPress={() => router.push(routes.space(space.id))}
                />
              ))}
            </ScrollView>
          </View>
        ) : (
          <EmptyState
            icon="compass"
            title="Your learning starts here"
            body="You haven't enrolled in any spaces yet. Explore the store to find a topic you're excited about — your progress will live right here."
            action={
              <Button
                variant="spark"
                leadingIcon="store"
                onPress={() => router.push(routes.store())}
              >
                Explore the store
              </Button>
            }
          />
        )}

        {/* STATS STRIP */}
        <View className="flex-row gap-3">
          <View className="flex-1">
            <StatTile icon="layers" label="My spaces" value={String(spacesEnrolled)} />
          </View>
          <View className="flex-1">
            <StatTile icon="zap" label="XP earned" value={String(xp)} />
          </View>
          <View className="flex-1">
            <StatTile icon="flame" label="Day streak" value={String(streak)} />
          </View>
        </View>

        {/* RECOMMENDED FOR YOU */}
        {hasRecommended ? (
          <View className="gap-3">
            <SectionHeader
              title="Recommended for you"
              subtitle="Handpicked spaces to grow your skills"
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 4 }}
            >
              {recommended.map((space) => (
                <StoreCard
                  key={space.id}
                  space={space}
                  onPress={() => router.push(routes.storeSpace(space.id))}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* STORE CTA */}
        <Card className="bg-brand-subtle gap-3">
          <View className="flex-row items-center gap-2">
            <Icon name="store" size={18} />
            <Text className="font-display text-text-primary text-base font-semibold">
              Browse the full store
            </Text>
          </View>
          <Text className="font-ui text-text-muted text-sm">
            Discover every space and find your next topic.
          </Text>
          <Button
            variant="primary"
            block
            trailingIcon="arrow-right"
            onPress={() => router.push(routes.store())}
          >
            Open the store
          </Button>
        </Card>

        <View className="h-6" />
      </View>
    </Screen>
  );
}
