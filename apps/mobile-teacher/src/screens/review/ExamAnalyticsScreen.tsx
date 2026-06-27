/**
 * ExamAnalyticsScreen — read-only performance projection for one exam.
 *
 * Design: docs/rebuild-spec/design/build/prototypes/teacher/exam-analytics.card.html
 *         (+ prototypes/exams/exam-analytics-results.card.html)
 * Data:   useExamAnalytics(examId) → ExamAnalytics (analytics-fn authored; may not
 *         exist until grading completes → NOT_FOUND is a benign empty, not error).
 *
 * Reads examId. Renders KPI metric cards, the score distribution, per-question
 * difficulty (avg %), topic performance and a class breakdown — all from the
 * analytics doc, defensively (records may be empty / partial).
 */
import { useMemo } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useExamAnalytics } from "@levelup/query";

import { Card, DistributionBar, Icon, MetricCard, MiniBarChart, Screen } from "../../components";
import { isHardError } from "../../lib/query-status";
import { ErrorCard, ListSkeleton, MissingParam, Section, num, pct, round1 } from "./_shared";

interface QAnalytics {
  avgScore?: number;
  maxScore?: number;
  attemptCount?: number;
}
interface ClassBreakdown {
  avgPercentage?: number;
  avgScore?: number;
  submissionCount?: number;
}
interface TopicPerf {
  topic?: string;
  avgPercentage?: number;
  questionCount?: number;
}
interface Analytics {
  totalSubmissions?: number;
  gradedSubmissions?: number;
  avgScore?: number;
  avgPercentage?: number;
  passRate?: number;
  medianScore?: number;
  scoreDistribution?: {
    buckets?: Array<{ label?: string; count?: number }>;
    gradeDistribution?: Record<string, number>;
  };
  questionAnalytics?: Record<string, QAnalytics>;
  classBreakdown?: Record<string, ClassBreakdown>;
  topicPerformance?: Record<string, TopicPerf>;
}

function entries<T>(rec: Record<string, T> | undefined): Array<[string, T]> {
  return rec ? Object.entries(rec) : [];
}

export default function ExamAnalyticsScreen() {
  const params = useLocalSearchParams<{ examId?: string }>();
  const examId = typeof params.examId === "string" ? params.examId : undefined;

  const query = useExamAnalytics(examId ?? "");
  const a = query.data as Analytics | undefined;

  const gradeSegments = useMemo(() => {
    const gd = a?.scoreDistribution?.gradeDistribution;
    if (gd && Object.keys(gd).length > 0) {
      return Object.entries(gd).map(([label, value]) => ({ label, value: num(value) }));
    }
    const buckets = a?.scoreDistribution?.buckets;
    if (Array.isArray(buckets))
      return buckets.map((b) => ({ label: b.label ?? "", value: num(b.count) }));
    return [];
  }, [a]);

  const questionBars = useMemo(() => {
    return entries<QAnalytics>(a?.questionAnalytics)
      .map(([k, v], i) => {
        const max = num(v.maxScore);
        const avgPct = max > 0 ? (num(v.avgScore) / max) * 100 : num(v.avgScore);
        return { label: `Q${i + 1}`, value: round1(avgPct), key: k };
      })
      .slice(0, 20);
  }, [a]);

  const topicRows = useMemo(
    () =>
      entries<TopicPerf>(a?.topicPerformance).map(([k, v]) => ({
        label: v.topic ?? k,
        value: round1(num(v.avgPercentage)),
      })),
    [a]
  );

  const classRows = useMemo(() => entries<ClassBreakdown>(a?.classBreakdown), [a]);

  if (!examId) return <MissingParam what="exam" />;
  if (query.isLoading) return <ListSkeleton />;
  if (isHardError(query)) return <ErrorCard onRetry={() => void query.refetch()} />;

  // NOT_FOUND (analytics not computed yet) is a soft miss → friendly empty.
  if (!a) {
    return (
      <Screen className="bg-canvas" contentClassName="gap-4 p-4">
        <Text className="font-display text-text-primary text-2xl">Analytics</Text>
        <Card className="items-center gap-2 py-10">
          <Icon name="bar-chart-3" size={26} color="#756E61" />
          <Text className="font-display text-text-primary text-base">No analytics yet</Text>
          <Text className="text-text-muted px-6 text-center text-sm">
            Performance analytics are computed once grading completes and results are processed.
          </Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen className="bg-canvas" contentClassName="gap-5 p-4">
      <Text className="font-display text-text-primary text-2xl">Analytics</Text>

      <View className="flex-row flex-wrap gap-3">
        <MetricCard
          className="min-w-[44%] flex-1"
          label="Submissions"
          value={String(num(a.totalSubmissions))}
          caption={`${num(a.gradedSubmissions)} graded`}
          icon={<Icon name="users" size={16} />}
        />
        <MetricCard
          className="min-w-[44%] flex-1"
          label="Average"
          value={pct(a.avgPercentage)}
          caption={`avg ${round1(num(a.avgScore))} pts`}
          icon={<Icon name="gauge" size={16} />}
        />
        <MetricCard
          className="min-w-[44%] flex-1"
          label="Pass rate"
          value={pct(a.passRate)}
          tone={num(a.passRate) >= 60 ? "success" : "warning"}
          icon={<Icon name="check-circle-2" size={16} />}
        />
        <MetricCard
          className="min-w-[44%] flex-1"
          label="Median"
          value={String(round1(num(a.medianScore)))}
          caption="points"
          icon={<Icon name="git-commit-horizontal" size={16} />}
        />
      </View>

      {gradeSegments.length > 0 ? (
        <Section title="Grade distribution">
          <Card className="gap-3">
            <DistributionBar segments={gradeSegments} rows showValues />
          </Card>
        </Section>
      ) : null}

      {questionBars.length > 0 ? (
        <Section title="Per-question average">
          <Card className="gap-2">
            <MiniBarChart
              data={questionBars.map((q) => ({ label: q.label, value: q.value }))}
              height={120}
              showLabels
              maxValue={100}
              color="#423A82"
            />
            <Text className="text-2xs text-text-muted">
              Average score as % of max, per question.
            </Text>
          </Card>
        </Section>
      ) : null}

      {topicRows.length > 0 ? (
        <Section title="Topic performance">
          <Card>
            <DistributionBar segments={topicRows} rows showValues />
          </Card>
        </Section>
      ) : null}

      {classRows.length > 0 ? (
        <Section title="By class">
          <Card className="gap-2">
            {classRows.map(([cls, v], i) => (
              <View
                key={cls}
                className={`flex-row items-center justify-between ${i > 0 ? "border-border-subtle border-t pt-2" : ""}`}
              >
                <Text className="text-text-secondary text-sm">{cls}</Text>
                <Text className="text-text-primary text-sm">
                  {pct(v.avgPercentage)} · {num(v.submissionCount)} subs
                </Text>
              </View>
            ))}
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}
