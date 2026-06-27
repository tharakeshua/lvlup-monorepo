/**
 * Space analytics (space-analytics).
 *
 * Pick a content space, then see its shape (story points / items), how far
 * learners have progressed, the points on offer, and the reviews learners have
 * left (average rating + recent comments).
 *
 * Data:
 *  - useSpaces()                → space picker (LIVE — spaceRepo.list is deployed).
 *  - useSpaceProgress(spaceId)  → aggregate progress for the space (defensive).
 *  - useSpaceReviews(spaceId)   → reviews + ratings for the space.
 *
 * Space docs are real; progress/reviews may be sparse → defensive reads + empty
 * states throughout.
 */
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useSpaceProgress, useSpaceReviews, useSpaces } from "@levelup/query";
import { asSpaceId } from "@levelup/domain";

import {
  Button,
  Card,
  EmptyState,
  FilterChips,
  Icon,
  MetricCard,
  ProgressBar,
  Screen,
  SectionHeader,
  Skeleton,
  Sparkline,
} from "../../components";
import { isHardError } from "../../lib/query-status";
import { asList, num, obj, pct, pick, relTime, round1, str } from "./_shared/readers";

/* ---------- readers ---------- */
interface SpaceOption {
  id: string;
  title: string;
  points: number;
  items: number;
}
function readSpaceOption(raw: Record<string, unknown>): SpaceOption {
  return {
    id: str(pick(raw, ["id", "spaceId", "uid", "_id"])),
    title: str(pick(raw, ["title", "name", "displayName"]), "Untitled space"),
    points: num(pick(raw, ["storyPoints", "storyPointCount", "points", "totalPoints"])),
    items: num(pick(raw, ["itemCount", "items", "totalItems", "lessonCount"])),
  };
}

interface ReviewView {
  id: string;
  author: string;
  rating: number;
  comment: string;
  when: string;
}
function readReview(raw: Record<string, unknown>): ReviewView {
  return {
    id: str(pick(raw, ["id", "reviewId", "_id"])),
    author: str(pick(raw, ["authorName", "studentName", "userName", "displayName"]), "Learner"),
    rating: Math.max(0, Math.min(5, num(pick(raw, ["rating", "stars", "score"])))),
    comment: str(pick(raw, ["comment", "body", "text", "review"])),
    when: relTime(pick(raw, ["createdAt", "updatedAt", "submittedAt"])),
  };
}

function stars(rating: number): string {
  const full = Math.round(rating);
  return "★★★★★".slice(0, full) + "☆☆☆☆☆".slice(0, 5 - full);
}

/* ---------- loading ---------- */
function LoadingState() {
  return (
    <View className="gap-6">
      <Skeleton width="55%" height={26} />
      <Skeleton width="100%" height={40} />
      <View className="flex-row gap-3">
        {[0, 1].map((i) => (
          <View key={i} className="flex-1">
            <Skeleton width="100%" height={92} />
          </View>
        ))}
      </View>
      <Skeleton width="100%" height={120} />
    </View>
  );
}

/* ---------- screen ---------- */
export default function SpaceAnalyticsScreen() {
  const spacesQuery = useSpaces();

  const spaceOptions = useMemo(
    () =>
      asList(spacesQuery.data)
        .map(readSpaceOption)
        .filter((s) => s.id),
    [spacesQuery.data]
  );

  const [selectedId, setSelectedId] = useState<string>("");
  const activeId = selectedId || spaceOptions[0]?.id || "";
  const activeSpace = spaceOptions.find((s) => s.id === activeId);

  const progressQuery = useSpaceProgress(asSpaceId(activeId));
  const reviewsQuery = useSpaceReviews(activeId);

  const progress = obj(progressQuery.data);
  const completion = round1(
    pct(pick(progress, ["averageCompletion", "completion", "progress", "percentComplete"]))
  );
  const activeLearners = num(
    pick(progress, ["activeStudents", "activeLearners", "learnerCount", "enrolledCount"])
  );
  const pointsEarned = num(pick(progress, ["totalPointsEarned", "pointsEarned", "earnedPoints"]));
  const trend = useMemo(() => {
    const raw = pick(progress, ["recentActivity", "trend", "history", "sparkline"]);
    if (Array.isArray(raw)) {
      return raw
        .map((p) =>
          typeof p === "number" ? p : num(pick(obj(p), ["value", "count", "points", "completion"]))
        )
        .filter((n) => isFinite(n));
    }
    return [];
  }, [progress]);

  const reviews = useMemo(
    () =>
      asList(reviewsQuery.data)
        .map(readReview)
        .filter((r) => r.id || r.comment),
    [reviewsQuery.data]
  );
  const avgRating =
    reviews.length > 0 ? round1(reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length) : 0;

  const isLoading = spacesQuery.isLoading && !spacesQuery.data;
  const isError = isHardError(spacesQuery);

  if (isError) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-off"
          title="We couldn't load space analytics"
          body="Let's try that again — this one's on us, not you."
          action={
            <Button variant="primary" leadingIcon="rotate-cw" onPress={() => spacesQuery.refetch()}>
              Try again
            </Button>
          }
        />
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="gap-5">
        {/* HEADER */}
        <View className="gap-1">
          <Text className="font-display text-text-primary text-2xl font-semibold">
            Space analytics
          </Text>
          <Text className="font-ui text-text-muted text-sm">
            How learners are moving through your content.
          </Text>
        </View>

        {spaceOptions.length === 0 ? (
          <EmptyState
            icon="layers"
            title="No spaces yet"
            body="Author a content space — its learner progress and reviews will show up here."
          />
        ) : (
          <>
            {/* SPACE PICKER */}
            <FilterChips
              options={spaceOptions.map((s) => ({ key: s.id, label: s.title }))}
              value={activeId}
              onChange={setSelectedId}
            />

            {/* CONTENT SHAPE */}
            {activeSpace ? (
              <Card className="gap-3">
                <View className="flex-row items-center gap-2">
                  <View className="bg-brand-subtle h-10 w-10 items-center justify-center rounded-lg">
                    <Icon name="git-branch" size={20} />
                  </View>
                  <View className="flex-1">
                    <Text
                      className="font-display text-text-primary text-base font-semibold"
                      numberOfLines={1}
                    >
                      {activeSpace.title}
                    </Text>
                    <Text className="text-2xs text-text-muted font-mono">
                      {activeSpace.points} story points · {activeSpace.items} items
                    </Text>
                  </View>
                  {trend.length > 1 ? <Sparkline values={trend} fill /> : null}
                </View>
                <View className="gap-1.5">
                  <ProgressBar value={completion} />
                  <View className="flex-row items-center justify-between">
                    <Text className="text-2xs text-text-muted font-mono">
                      {completion}% avg completion
                    </Text>
                    {pointsEarned > 0 ? (
                      <Text className="text-2xs text-text-muted font-mono">
                        {pointsEarned} pts earned
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Card>
            ) : null}

            {/* KPI TILES */}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <MetricCard icon="users" label="Active learners" value={String(activeLearners)} />
              </View>
              <View className="flex-1">
                <MetricCard
                  icon="star"
                  label="Avg rating"
                  value={avgRating > 0 ? `${avgRating}` : "—"}
                  caption={reviews.length > 0 ? `${reviews.length} reviews` : "No reviews"}
                />
              </View>
            </View>

            {/* REVIEWS */}
            <View className="gap-3">
              <SectionHeader title="Learner reviews" />
              {reviews.length > 0 ? (
                <Card className="gap-4">
                  {reviews.slice(0, 6).map((r) => (
                    <View key={r.id || r.comment} className="gap-1">
                      <View className="flex-row items-center justify-between">
                        <Text className="font-display text-text-primary text-sm font-semibold">
                          {r.author}
                        </Text>
                        <Text className="text-spark font-mono text-xs">{stars(r.rating)}</Text>
                      </View>
                      {r.comment ? (
                        <Text className="font-ui text-text-secondary text-xs" numberOfLines={3}>
                          {r.comment}
                        </Text>
                      ) : null}
                      {r.when ? (
                        <Text className="text-2xs text-text-muted font-mono">{r.when}</Text>
                      ) : null}
                    </View>
                  ))}
                </Card>
              ) : (
                <Card className="items-center gap-2 py-6">
                  <Icon name="message-square" size={22} color="#756E61" />
                  <Text className="font-ui text-text-muted text-sm">
                    No reviews yet for this space.
                  </Text>
                </Card>
              )}
            </View>
          </>
        )}

        <View className="h-6" />
      </View>
    </Screen>
  );
}
