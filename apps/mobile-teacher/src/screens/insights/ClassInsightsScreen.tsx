/**
 * Class analytics & insights hub (class-analytics-insights) — the Insights tab root.
 *
 * Pick a class, then see its headline KPIs (avg score, pass rate, completion,
 * active students), a pass/fail distribution, the latest learning-insight feed,
 * and jump-off cards into the focused sub-screens (at-risk, class tests, space
 * analytics).
 *
 * Data:
 *  - useClasses()              → class picker.
 *  - useClassSummary(classId)  → ClassProgressSummary for the selected class.
 *  - useLearningInsights()     → cross-class insight feed (recent).
 *  - useInsights(studentId)    → reserved (per-student drill-down); not fired here.
 *
 * GATE-B: summary is a derived doc → frequently NOT_FOUND for a fresh class.
 * `isHardError` gates the error card; soft-miss falls through to zeros/empty.
 */
import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { useClassSummary, useClasses, useLearningInsights } from "@levelup/query";
import { asClassId } from "@levelup/domain";

import {
  Button,
  Card,
  DistributionBar,
  EmptyState,
  FilterChips,
  Icon,
  ListRow,
  MetricCard,
  Screen,
  SectionHeader,
  Skeleton,
} from "../../components";
import { routes } from "../../lib/routes";
import { isHardError } from "../../lib/query-status";
import { asList, flattenPages, num, obj, pct, pick, relTime, round1, str } from "./_shared/readers";

/* ---------- readers ---------- */
interface ClassOption {
  id: string;
  name: string;
}
function readClassOption(raw: Record<string, unknown>): ClassOption {
  const grade = str(pick(raw, ["grade"]));
  const section = str(pick(raw, ["section"]));
  const base = str(pick(raw, ["name", "className", "title"]), "Class");
  const suffix = [grade, section].filter(Boolean).join("-");
  return {
    id: str(pick(raw, ["id", "classId", "uid", "_id"])),
    name: suffix && !base.includes(suffix) ? `${base} ${suffix}` : base,
  };
}

interface InsightView {
  id: string;
  title: string;
  description: string;
  priority: string;
  when: string;
}
function readInsight(raw: Record<string, unknown>): InsightView {
  return {
    id: str(pick(raw, ["id", "insightId", "_id"])),
    title: str(pick(raw, ["title", "headline"]), "Insight"),
    description: str(pick(raw, ["description", "body", "detail"])),
    priority: str(pick(raw, ["priority", "severity"]), "normal").toLowerCase(),
    when: relTime(pick(raw, ["createdAt", "generatedAt", "updatedAt"])),
  };
}

const PRIORITY_ICON: Record<string, { icon: string; color: string }> = {
  high: { icon: "alert-triangle", color: "#B23A36" },
  critical: { icon: "alert-octagon", color: "#B23A36" },
  medium: { icon: "info", color: "#B7791F" },
  normal: { icon: "sparkles", color: "#423A82" },
  low: { icon: "sparkles", color: "#756E61" },
};

/* ---------- loading ---------- */
function LoadingState() {
  return (
    <View className="gap-6">
      <Skeleton width="50%" height={26} />
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
export default function ClassInsightsScreen() {
  const router = useRouter();
  const classesQuery = useClasses();

  const classOptions = useMemo(
    () =>
      asList(classesQuery.data)
        .map(readClassOption)
        .filter((c) => c.id),
    [classesQuery.data]
  );

  const [selectedId, setSelectedId] = useState<string>("");
  const activeId = selectedId || classOptions[0]?.id || "";

  const summaryQuery = useClassSummary(asClassId(activeId));
  const insightsQuery = useLearningInsights();

  const summary = obj(summaryQuery.data);
  const autograde = obj(pick(summary, ["autograde"]));
  const levelup = obj(pick(summary, ["levelup"]));

  const avgPct = round1(pct(pick(autograde, ["averagePercentage", "avgPercentage"])));
  const passRate = round1(pct(pick(autograde, ["passRate"])));
  const completion = round1(pct(pick(levelup, ["averageCompletion"])));
  const activeStudents = num(pick(levelup, ["activeStudents"]));
  const studentCount = num(pick(summary, ["studentCount"]));
  const atRiskCount = num(pick(summary, ["atRiskCount"]));
  const examCount = num(pick(autograde, ["examCount"]));

  const passSegments = [
    { label: "Passing", value: passRate },
    { label: "Below", value: Math.max(0, 100 - passRate) },
  ];

  const insights = useMemo(
    () =>
      flattenPages(insightsQuery.data)
        .map(readInsight)
        .filter((i) => i.id || i.title)
        .slice(0, 5),
    [insightsQuery.data]
  );

  const isLoading = classesQuery.isLoading && !classesQuery.data;
  const isError = isHardError(classesQuery);

  if (isError) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-off"
          title="We couldn't load insights"
          body="Let's try that again — this one's on us, not you."
          action={
            <Button
              variant="primary"
              leadingIcon="rotate-cw"
              onPress={() => classesQuery.refetch()}
            >
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

  const hasSummary = Object.keys(summary).length > 0;

  return (
    <Screen>
      <View className="gap-5">
        {/* HEADER */}
        <View className="gap-1">
          <Text className="font-display text-text-primary text-2xl font-semibold">Insights</Text>
          <Text className="font-ui text-text-muted text-sm">How your classes are performing.</Text>
        </View>

        {/* CLASS PICKER */}
        {classOptions.length > 0 ? (
          <FilterChips
            options={classOptions.map((c) => ({ key: c.id, label: c.name }))}
            value={activeId}
            onChange={setSelectedId}
          />
        ) : null}

        {classOptions.length === 0 ? (
          <EmptyState
            icon="line-chart"
            title="No classes to analyze yet"
            body="When classes are assigned to you, their performance analytics will live here."
          />
        ) : (
          <>
            {/* KPI TILES */}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <MetricCard
                  icon="target"
                  label="Avg score"
                  value={hasSummary ? `${avgPct}%` : "—"}
                  caption={examCount > 0 ? `${examCount} exams` : "No exams yet"}
                />
              </View>
              <View className="flex-1">
                <MetricCard
                  icon="check-circle"
                  label="Pass rate"
                  value={hasSummary ? `${passRate}%` : "—"}
                  tone={hasSummary && passRate < 60 ? "warning" : "neutral"}
                  caption={studentCount > 0 ? `${studentCount} students` : " "}
                />
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <MetricCard
                  icon="activity"
                  label="Completion"
                  value={hasSummary ? `${completion}%` : "—"}
                  caption="content mastered"
                />
              </View>
              <View className="flex-1">
                <MetricCard
                  icon="alert-triangle"
                  label="At risk"
                  value={hasSummary ? String(atRiskCount) : "—"}
                  tone={atRiskCount > 0 ? "error" : "neutral"}
                  caption={activeStudents > 0 ? `${activeStudents} active` : "students"}
                  onPress={() => router.push(routes.atRisk())}
                />
              </View>
            </View>

            {/* PASS DISTRIBUTION */}
            {hasSummary ? (
              <Card className="gap-3">
                <SectionHeader
                  title="Pass / fail"
                  subtitle="Share of students at or above passing"
                />
                <DistributionBar segments={passSegments} height={14} />
              </Card>
            ) : (
              <Card className="items-center gap-2 py-6">
                <Icon name="bar-chart-3" size={24} color="#756E61" />
                <Text className="font-ui text-text-muted text-sm">
                  Analytics will appear once this class has graded activity.
                </Text>
              </Card>
            )}

            {/* DRILL-DOWN CARDS */}
            <View className="gap-3">
              <SectionHeader title="Dig deeper" />
              <Card className="gap-1 p-0">
                <ListRow
                  leading={<Icon name="alert-triangle" size={20} />}
                  title="At-risk students"
                  subtitle="Who needs support, and why"
                  onPress={() => router.push(routes.atRisk())}
                />
                <ListRow
                  leading={<Icon name="file-bar-chart" size={20} />}
                  title="Class test analytics"
                  subtitle="Exam scores, distributions & hard questions"
                  onPress={() => router.push(routes.classTests())}
                />
                <ListRow
                  leading={<Icon name="layers" size={20} />}
                  title="Space analytics"
                  subtitle="Progress & reviews across your content"
                  onPress={() => router.push(routes.spaceAnalytics())}
                />
              </Card>
            </View>

            {/* INSIGHT FEED */}
            <View className="gap-3">
              <SectionHeader title="Recent insights" />
              {insights.length > 0 ? (
                <Card className="gap-3">
                  {insights.map((ins) => {
                    const meta = PRIORITY_ICON[ins.priority] ?? PRIORITY_ICON.normal;
                    return (
                      <View key={ins.id || ins.title} className="flex-row gap-3">
                        <Icon name={meta.icon} size={18} color={meta.color} />
                        <View className="flex-1 gap-0.5">
                          <Text
                            className="font-display text-text-primary text-sm font-semibold"
                            numberOfLines={1}
                          >
                            {ins.title}
                          </Text>
                          {ins.description ? (
                            <Text className="font-ui text-text-muted text-xs" numberOfLines={2}>
                              {ins.description}
                            </Text>
                          ) : null}
                          {ins.when ? (
                            <Text className="text-2xs text-text-muted font-mono">{ins.when}</Text>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </Card>
              ) : (
                <Card className="items-center gap-2 py-6">
                  <Icon name="sparkles" size={22} color="#756E61" />
                  <Text className="font-ui text-text-muted text-sm">
                    No insights yet — they appear as students work through content.
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
