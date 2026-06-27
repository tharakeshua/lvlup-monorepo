/**
 * Teacher home dashboard (teacher-dashboard).
 *
 * The signed-in teacher's command surface: a greeting, three KPI tiles (classes,
 * submissions awaiting review, at-risk students), a "needs your attention" rail
 * cross-linking into grading + assignments, a compact class list, and the latest
 * announcement. Pure read screen.
 *
 * Data (all via @levelup/query — never Firestore):
 *  - useSession()          → identity { uid, displayName, email }.
 *  - useClasses()          → the teacher's classes (count + list).
 *  - useExams()            → exams, to derive an awaiting-review count defensively.
 *  - useLearningInsights() → at-risk / attention insights feed (count).
 *  - useAnnouncements()    → latest announcement.
 *
 * GATE-B: the teacher callables are partially live, so every read can come back
 * empty/NOT_FOUND. `isHardError` gates the error UI; otherwise we render zeros.
 */
import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { useAnnouncements, useClasses, useExams, useLearningInsights } from "@levelup/query";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  ListRow,
  MetricCard,
  ProgressBar,
  Screen,
  SectionHeader,
  Skeleton,
} from "../../components";
import { routes } from "../../lib/routes";
import { isHardError } from "../../lib/query-status";
import { useSession } from "../../sdk/session";
import {
  asList,
  bool,
  firstName,
  flattenPages,
  num,
  obj,
  pct,
  pick,
  relTime,
  str,
} from "../insights/_shared/readers";

/* ---------- per-record readers ---------- */
interface ClassRow {
  id: string;
  name: string;
  students: number;
  progress: number;
  atRisk: number;
}
function readClass(raw: Record<string, unknown>): ClassRow {
  return {
    id: str(pick(raw, ["id", "classId", "uid", "_id"])),
    name: str(pick(raw, ["name", "className", "title", "displayName"]), "Untitled class"),
    students: num(pick(raw, ["studentCount", "studentsCount", "enrolledCount", "memberCount"])),
    progress: pct(pick(raw, ["averageCompletion", "progress", "avgProgress", "completion"])),
    atRisk: num(pick(raw, ["atRiskCount", "atRiskStudents", "riskCount"])),
  };
}

function isAtRisk(raw: Record<string, unknown>): boolean {
  const type = str(pick(raw, ["type", "insightType", "category"])).toLowerCase();
  return (
    bool(pick(raw, ["isAtRisk", "atRisk"])) || type.includes("risk") || type.includes("struggl")
  );
}

function awaitingReviewOf(raw: Record<string, unknown>): number {
  return num(
    pick(raw, [
      "needsReviewCount",
      "awaitingReviewCount",
      "pendingReviewCount",
      "awaitingCount",
      "ungradedCount",
    ])
  );
}

/* ---------- loading skeleton ---------- */
function LoadingState() {
  return (
    <View className="gap-6">
      <View className="gap-2">
        <Skeleton width="60%" height={28} />
        <Skeleton width="40%" height={14} />
      </View>
      <View className="flex-row gap-3">
        {[0, 1, 2].map((i) => (
          <View key={i} className="flex-1">
            <Skeleton width="100%" height={92} />
          </View>
        ))}
      </View>
      <Skeleton width="100%" height={120} />
      <Skeleton width="100%" height={160} />
    </View>
  );
}

/* ---------- screen ---------- */
export default function TeacherDashboardScreen() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();

  const classesQuery = useClasses();
  const examsQuery = useExams();
  const insightsQuery = useLearningInsights();
  const announcementsQuery = useAnnouncements();

  const classes = asList(classesQuery.data)
    .map(readClass)
    .filter((c) => c.id);
  const exams = flattenPages(examsQuery.data);
  const insights = flattenPages(insightsQuery.data);
  const announcements = asList(announcementsQuery.data);

  const classCount = classes.length;
  const studentTotal = classes.reduce((acc, c) => acc + c.students, 0);
  const awaitingReview = exams.reduce((acc, e) => acc + awaitingReviewOf(e), 0);
  const atRiskFromClasses = classes.reduce((acc, c) => acc + c.atRisk, 0);
  const atRiskFromInsights = insights.filter(isAtRisk).length;
  const atRiskCount = Math.max(atRiskFromClasses, atRiskFromInsights);

  const latestAnnouncement = announcements[0];
  const greetingName = firstName(str(user?.displayName), str(user?.email));

  const isLoading = sessionLoading || (classesQuery.isLoading && !classesQuery.data);
  const isError = isHardError(classesQuery);

  const retry = (): void => {
    void classesQuery.refetch();
    void examsQuery.refetch();
    void insightsQuery.refetch();
    void announcementsQuery.refetch();
  };

  if (isError) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-off"
          title="We couldn't load your dashboard"
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

  if (isLoading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="gap-6">
        {/* GREETING */}
        <View className="gap-1">
          <Text className="font-display text-text-primary text-2xl font-semibold">
            Hello, {greetingName}
          </Text>
          <Text className="font-ui text-text-muted text-sm">
            Here's where your classes stand today.
          </Text>
        </View>

        {/* KPI TILES */}
        <View className="flex-row gap-3">
          <View className="flex-1">
            <MetricCard
              icon="users"
              label="Classes"
              value={String(classCount)}
              caption={studentTotal > 0 ? `${studentTotal} students` : "No students yet"}
              onPress={() => router.push(routes.classes())}
            />
          </View>
          <View className="flex-1">
            <MetricCard
              icon="clipboard-check"
              label="To review"
              value={String(awaitingReview)}
              tone={awaitingReview > 0 ? "warning" : "neutral"}
              caption="submissions"
              onPress={() => router.push(routes.gradingQueue())}
            />
          </View>
          <View className="flex-1">
            <MetricCard
              icon="alert-triangle"
              label="At risk"
              value={String(atRiskCount)}
              tone={atRiskCount > 0 ? "error" : "neutral"}
              caption="students"
              onPress={() => router.push(routes.atRisk())}
            />
          </View>
        </View>

        {/* NEEDS ATTENTION */}
        <View className="gap-3">
          <SectionHeader title="Needs your attention" />
          <Card className="gap-1 p-0">
            <ListRow
              leading={<Icon name="clipboard-check" size={20} />}
              title="Grading queue"
              subtitle={
                awaitingReview > 0
                  ? `${awaitingReview} submissions awaiting review`
                  : "All caught up"
              }
              trailing={
                awaitingReview > 0 ? <Badge variant="warning">{awaitingReview}</Badge> : undefined
              }
              onPress={() => router.push(routes.gradingQueue())}
            />
            <ListRow
              leading={<Icon name="list-todo" size={20} />}
              title="Assignment tracker"
              subtitle="Monitor what each class is working on"
              onPress={() => router.push(routes.assignments())}
            />
            <ListRow
              leading={<Icon name="line-chart" size={20} />}
              title="Class insights"
              subtitle="Performance, trends & at-risk students"
              onPress={() => router.push(routes.insights())}
            />
          </Card>
        </View>

        {/* CLASS LIST */}
        <View className="gap-3">
          <SectionHeader
            title="Your classes"
            actions={
              classCount > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  trailingIcon="arrow-right"
                  onPress={() => router.push(routes.classes())}
                >
                  All
                </Button>
              ) : undefined
            }
          />
          {classCount > 0 ? (
            <Card className="gap-3">
              {classes.slice(0, 5).map((c) => (
                <View key={c.id} className="gap-2">
                  <ListRow
                    title={c.name}
                    subtitle={`${c.students} students${c.atRisk > 0 ? ` · ${c.atRisk} at risk` : ""}`}
                    trailing={
                      <Text className="text-text-muted font-mono text-xs">{c.progress}%</Text>
                    }
                    chevron={false}
                    onPress={() => router.push(routes.classDetail(c.id))}
                  />
                  <ProgressBar value={c.progress} />
                </View>
              ))}
            </Card>
          ) : (
            <EmptyState
              icon="users"
              title="No classes yet"
              body="When classes are assigned to you, they'll show up here with live progress."
            />
          )}
        </View>

        {/* LATEST ANNOUNCEMENT */}
        {latestAnnouncement ? (
          <View className="gap-3">
            <SectionHeader
              title="Latest announcement"
              actions={
                <Button
                  variant="ghost"
                  size="sm"
                  trailingIcon="arrow-right"
                  onPress={() => router.push(routes.announcements())}
                >
                  All
                </Button>
              }
            />
            <Card
              className="bg-brand-subtle gap-2"
              onPress={() => router.push(routes.announcements())}
            >
              <View className="flex-row items-center gap-2">
                <Icon name="megaphone" size={16} />
                <Text
                  className="font-display text-text-primary flex-1 text-sm font-semibold"
                  numberOfLines={1}
                >
                  {str(
                    pick(obj(latestAnnouncement), ["title", "subject", "heading"]),
                    "Announcement"
                  )}
                </Text>
              </View>
              <Text className="font-ui text-text-muted text-xs" numberOfLines={2}>
                {str(pick(obj(latestAnnouncement), ["body", "message", "content", "text"]))}
              </Text>
              <Text className="text-2xs text-text-muted font-mono">
                {relTime(
                  pick(obj(latestAnnouncement), ["createdAt", "publishedAt", "sentAt", "updatedAt"])
                )}
              </Text>
            </Card>
          </View>
        ) : null}

        <View className="h-6" />
      </View>
    </Screen>
  );
}
