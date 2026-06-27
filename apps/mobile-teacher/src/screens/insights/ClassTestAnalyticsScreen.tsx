/**
 * Class test analytics (class-test-analytics).
 *
 * Pick an exam, then see its headline stats (avg %, pass rate, median, graded
 * coverage), the grade distribution, the hardest questions (lowest average), and
 * topic-level performance. Read-only; analytics are server-aggregated.
 *
 * Data:
 *  - useExams()             → exam picker (infinite list).
 *  - useExamAnalytics(examId) → ExamAnalytics for the selected exam.
 *
 * GATE-B: analytics is a derived doc → NOT_FOUND until an exam has graded
 * submissions. Soft-miss falls through to an "awaiting results" empty card.
 */
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useExamAnalytics, useExams } from "@levelup/query";
import { asExamId } from "@levelup/domain";

import {
  Button,
  Card,
  DistributionBar,
  EmptyState,
  FilterChips,
  Icon,
  MetricCard,
  MiniBarChart,
  Screen,
  SectionHeader,
  Skeleton,
  type ChartDatum,
} from "../../components";
import { isHardError } from "../../lib/query-status";
import { flattenPages, num, obj, pct, pick, round1, str } from "./_shared/readers";

/* ---------- readers ---------- */
interface ExamOption {
  id: string;
  title: string;
}
function readExamOption(raw: Record<string, unknown>): ExamOption {
  return {
    id: str(pick(raw, ["id", "examId", "uid", "_id"])),
    title: str(pick(raw, ["title", "name", "examName"]), "Untitled exam"),
  };
}

const GRADE_ORDER = ["A", "B", "C", "D", "E", "F"];

/** Sort key for a grade letter — known grades in A→F order, unknown ones last. */
function gradeRank(label: string): number {
  const i = GRADE_ORDER.indexOf(label);
  return i < 0 ? GRADE_ORDER.length : i;
}

/** Grade-distribution segments (A–F) → DistributionBar (auto-colored by letter). */
function gradeSegments(
  scoreDistribution: Record<string, unknown>
): { label: string; value: number }[] {
  const grades = obj(pick(scoreDistribution, ["gradeDistribution"]));
  const entries = Object.entries(grades)
    .map(([k, v]) => ({ label: k.toUpperCase(), value: num(v) }))
    .filter((s) => s.value > 0);
  if (entries.length > 0) {
    return entries.sort((a, b) => gradeRank(a.label) - gradeRank(b.label));
  }
  // fall back to score buckets
  const buckets = pick(scoreDistribution, ["buckets"]);
  if (Array.isArray(buckets)) {
    return buckets
      .map((b) => ({
        label: str(pick(obj(b), ["label"]), ""),
        value: num(pick(obj(b), ["count"])),
      }))
      .filter((s) => s.value > 0);
  }
  return [];
}

/** Hardest questions: lowest avg/max ratio first. */
function hardestQuestions(questionAnalytics: Record<string, unknown>): ChartDatum[] {
  return Object.entries(questionAnalytics)
    .map(([key, raw], i) => {
      const r = obj(raw);
      const avg = num(pick(r, ["avgScore"]));
      const max = num(pick(r, ["maxScore"]), 1) || 1;
      return { ratio: pct((avg / max) * 100), label: `Q${i + 1}`, key };
    })
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 6)
    .map((q) => ({ value: round1(q.ratio), label: q.label }));
}

/** Topic performance bars. */
function topicBars(topicPerformance: Record<string, unknown>): ChartDatum[] {
  return Object.entries(topicPerformance)
    .map(([key, raw]) => {
      const r = obj(raw);
      return {
        value: round1(pct(pick(r, ["avgPercentage"]))),
        label: str(pick(r, ["topic"]), key).slice(0, 6),
      };
    })
    .slice(0, 8);
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
export default function ClassTestAnalyticsScreen() {
  const examsQuery = useExams();

  const examOptions = useMemo(
    () =>
      flattenPages(examsQuery.data)
        .map(readExamOption)
        .filter((e) => e.id),
    [examsQuery.data]
  );

  const [selectedId, setSelectedId] = useState<string>("");
  const activeId = selectedId || examOptions[0]?.id || "";

  const analyticsQuery = useExamAnalytics(asExamId(activeId));
  const analytics = obj(analyticsQuery.data);
  const hasAnalytics = Object.keys(analytics).length > 0;

  const avgPct = round1(pct(pick(analytics, ["avgPercentage"])));
  const passRate = round1(pct(pick(analytics, ["passRate"])));
  const median = round1(num(pick(analytics, ["medianScore"])));
  const total = num(pick(analytics, ["totalSubmissions"]));
  const graded = num(pick(analytics, ["gradedSubmissions"]));

  const grades = useMemo(
    () => gradeSegments(obj(pick(analytics, ["scoreDistribution"]))),
    [analytics]
  );
  const hardest = useMemo(
    () => hardestQuestions(obj(pick(analytics, ["questionAnalytics"]))),
    [analytics]
  );
  const topics = useMemo(() => topicBars(obj(pick(analytics, ["topicPerformance"]))), [analytics]);

  const isLoading = examsQuery.isLoading && !examsQuery.data;
  const isError = isHardError(examsQuery);

  if (isError) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-off"
          title="We couldn't load test analytics"
          body="Let's try that again — this one's on us, not you."
          action={
            <Button variant="primary" leadingIcon="rotate-cw" onPress={() => examsQuery.refetch()}>
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
            Test analytics
          </Text>
          <Text className="font-ui text-text-muted text-sm">
            Scores, distributions & the questions that tripped students up.
          </Text>
        </View>

        {examOptions.length === 0 ? (
          <EmptyState
            icon="file-bar-chart"
            title="No exams yet"
            body="Create an exam and grade it — its analytics will appear here once results are in."
          />
        ) : (
          <>
            {/* EXAM PICKER */}
            <FilterChips
              options={examOptions.map((e) => ({ key: e.id, label: e.title }))}
              value={activeId}
              onChange={setSelectedId}
            />

            {!hasAnalytics ? (
              <Card className="items-center gap-2 py-8">
                <Icon name="hourglass" size={26} color="#756E61" />
                <Text className="font-display text-text-primary text-base">Awaiting results</Text>
                <Text className="font-ui text-text-muted px-6 text-center text-sm">
                  Analytics appear once this exam has graded submissions.
                </Text>
              </Card>
            ) : (
              <>
                {/* KPI TILES */}
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <MetricCard icon="target" label="Avg score" value={`${avgPct}%`} />
                  </View>
                  <View className="flex-1">
                    <MetricCard
                      icon="check-circle"
                      label="Pass rate"
                      value={`${passRate}%`}
                      tone={passRate < 60 ? "warning" : "neutral"}
                    />
                  </View>
                </View>
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <MetricCard icon="git-commit" label="Median" value={String(median)} />
                  </View>
                  <View className="flex-1">
                    <MetricCard
                      icon="users"
                      label="Graded"
                      value={`${graded}/${total}`}
                      caption="submissions"
                    />
                  </View>
                </View>

                {/* GRADE DISTRIBUTION */}
                {grades.length > 0 ? (
                  <Card className="gap-3">
                    <SectionHeader title="Grade distribution" />
                    <DistributionBar segments={grades} rows showValues />
                  </Card>
                ) : null}

                {/* HARDEST QUESTIONS */}
                {hardest.length > 0 ? (
                  <Card className="gap-3">
                    <SectionHeader
                      title="Hardest questions"
                      subtitle="Lowest average score first (% of max)"
                    />
                    <MiniBarChart
                      data={hardest}
                      height={110}
                      showValues
                      showLabels
                      color="#B23A36"
                    />
                  </Card>
                ) : null}

                {/* TOPIC PERFORMANCE */}
                {topics.length > 0 ? (
                  <Card className="gap-3">
                    <SectionHeader title="Topic performance" subtitle="Average % by topic" />
                    <MiniBarChart data={topics} height={110} showValues showLabels />
                  </Card>
                ) : null}
              </>
            )}
          </>
        )}

        <View className="h-6" />
      </View>
    </Screen>
  );
}
