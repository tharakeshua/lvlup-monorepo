/**
 * AnalyticsScreen — the Insights tab landing (tenant analytics).
 *
 * Design: docs/rebuild-spec/design/build/prototypes/admin/analytics.card.html
 * Route:  /admin/insights
 * Data:   usePerformanceTrends({ granularity }) — server-aggregated trend points
 *         (the performance chart) and useLearningInsights() — the tenant-wide
 *         personalised-insight stream (the "Insights" feed). `useInsights` is the
 *         per-student variant used in detail screens; the admin overview reads
 *         the tenant feed via useLearningInsights (no student id required).
 *
 * Desktop is a 4-up KPI row + class bar charts + mastery + insights + drill-down.
 * On mobile that collapses to: a trend KPI summary, a performance ColumnChart, a
 * granularity segmented switch, and the insights feed. Reads soft-miss to empty
 * until the analytics callables deploy (GATE-B) — never a hard error.
 */
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useLearningInsights, usePerformanceTrends } from "@levelup/query";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  ListRow,
  Screen,
  SectionHeader,
  SegmentedTabs,
  Skeleton,
  StatTile,
  TopBar,
} from "../../components";
import { routes } from "../../lib/routes";
import { isHardError } from "../../lib/query-status";
import { ColumnChart } from "./_charts";
import {
  flattenPages,
  fmtInt,
  humanize,
  priorityVariant,
  shortDate,
  type InsightRow,
  type TrendPoint,
} from "./_insights-utils";

type Gran = "week" | "month" | "term";
const GRANS: { key: Gran; label: string }[] = [
  { key: "week", label: "Weekly" },
  { key: "month", label: "Monthly" },
  { key: "term", label: "By term" },
];

export default function AnalyticsScreen() {
  const router = useRouter();
  const [gran, setGran] = useState<Gran>("month");

  const trendsQ = usePerformanceTrends({ granularity: gran });
  const insightsQ = useLearningInsights({});

  const points = useMemo<TrendPoint[]>(
    () => (Array.isArray(trendsQ.data) ? (trendsQ.data as TrendPoint[]) : []),
    [trendsQ.data]
  );
  const insights = useMemo<InsightRow[]>(
    () => flattenPages<InsightRow>(insightsQ.data),
    [insightsQ.data]
  );

  const chartData = points.map((p) => ({
    label: p.label ?? shortDate(p.date) ?? "",
    value: typeof p.value === "number" ? p.value : 0,
    display: typeof p.value === "number" ? String(Math.round(p.value)) : "—",
  }));

  // headline summary derived from the trend series (honest, render-only)
  const latest = points.length > 0 ? points[points.length - 1] : undefined;
  const prev = points.length > 1 ? points[points.length - 2] : undefined;
  const latestVal = typeof latest?.value === "number" ? latest.value : null;
  const delta =
    latestVal != null && typeof prev?.value === "number"
      ? Math.round(latestVal - prev.value)
      : null;

  return (
    <Screen scroll>
      <TopBar
        title="Analytics"
        subtitle="Performance, progress & at-risk signals"
        right={
          <Button
            variant="ghost"
            size="sm"
            leadingIcon="file-text"
            onPress={() => router.push(routes.reports())}
          >
            Reports
          </Button>
        }
      />

      {/* Headline KPIs (from the trend series) */}
      <View className="flex-row flex-wrap gap-3">
        <View className="min-w-[46%] flex-1">
          <StatTile
            label="Latest"
            icon="trending-up"
            value={
              trendsQ.isLoading ? "…" : latestVal != null ? String(Math.round(latestVal)) : "—"
            }
            delta={delta != null ? `${delta >= 0 ? "+" : ""}${delta}` : undefined}
            trend={delta == null ? "flat" : delta >= 0 ? "up" : "down"}
          />
        </View>
        <View className="min-w-[46%] flex-1">
          <StatTile
            label="Data points"
            icon="bar-chart-3"
            value={trendsQ.isLoading ? "…" : fmtInt(points.length)}
          />
        </View>
      </View>

      {/* Performance trend chart + granularity switch */}
      <Card className="gap-4">
        <SectionHeader title="Performance trend" subtitle="Server-aggregated · read-only" />
        <SegmentedTabs items={GRANS} value={gran} onChange={(k) => setGran(k as Gran)} block />
        {trendsQ.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : isHardError(trendsQ) ? (
          <EmptyState
            icon="alert-triangle"
            title="Couldn't load trends"
            body="Try again in a moment."
          />
        ) : chartData.length === 0 ? (
          <EmptyState
            icon="bar-chart-3"
            title="No trend data yet"
            body="Performance trends appear once exams are graded and progress is recorded."
          />
        ) : (
          <ColumnChart data={chartData} />
        )}
      </Card>

      {/* Insights feed */}
      <Card className="gap-2">
        <SectionHeader title="Insights" subtitle="Top active signals · server-derived" />
        {insightsQ.isLoading ? (
          <View className="gap-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </View>
        ) : isHardError(insightsQ) ? (
          <EmptyState
            icon="alert-triangle"
            title="Couldn't load insights"
            body="Try again in a moment."
          />
        ) : insights.length === 0 ? (
          <EmptyState
            icon="sparkles"
            title="No insights yet"
            body="Personalised signals appear once learners are active and analytics runs nightly."
          />
        ) : (
          insights.slice(0, 20).map((n, i) => (
            <ListRow
              key={n.id ?? `${n.title}-${i}`}
              title={n.title ?? humanize(n.type) ?? "Insight"}
              subtitle={n.description ?? undefined}
              leading={<Icon name={iconForInsight(n.type)} size={18} />}
              trailing={
                <View className="items-end gap-1">
                  {n.priority ? (
                    <Badge variant={priorityVariant(n.priority)}>{humanize(n.priority)}</Badge>
                  ) : null}
                  {n.createdAt ? (
                    <Text className="text-2xs text-text-muted">{shortDate(n.createdAt)}</Text>
                  ) : null}
                </View>
              }
              chevron={false}
            />
          ))
        )}
      </Card>

      <Text className="text-2xs text-text-muted px-1 pb-2">
        Analytics light up once the tenant analytics callables deploy. Detailed per-class drill-down
        continues on web.
      </Text>
    </Screen>
  );
}

function iconForInsight(type?: string): string {
  switch (type) {
    case "at_risk_intervention":
      return "triangle-alert";
    case "exam_preparation":
      return "file-check";
    case "streak_encouragement":
      return "flame";
    case "improvement_celebration":
      return "party-popper";
    case "cross_system_correlation":
      return "git-compare";
    case "weak_topic_recommendation":
    default:
      return "sparkles";
  }
}
