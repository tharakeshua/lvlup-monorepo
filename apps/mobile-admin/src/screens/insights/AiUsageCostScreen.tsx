/**
 * AiUsageCostScreen — AI / LLM consumption & cost for the tenant.
 *
 * Design: docs/rebuild-spec/design/build/prototypes/admin/ai-usage-cost.card.html
 * Route:  /admin/insights/ai-usage
 * Data:   useCostSummary('monthly') — current-month rollup (KPI strip, budget
 *         panel, cost-by-purpose / cost-by-model breakdowns) and
 *         useCostSummary('daily') — the per-day trend ColumnChart.
 *
 * Desktop is a KPI strip + budget panel + daily trend + purpose/model tables.
 * On mobile that stacks. Every field is guarded (shapes may drift; the cost
 * aggregation scheduler may not have produced a doc yet → soft-miss to empty).
 */
import { useMemo } from "react";
import { Text, View } from "react-native";
import { useCostSummary } from "@levelup/query";

import {
  Badge,
  Card,
  colors,
  EmptyState,
  ProgressBar,
  Screen,
  SectionHeader,
  Skeleton,
  StatTile,
  TopBar,
} from "../../components";
import { isHardError } from "../../lib/query-status";
import { ColumnChart, HBarList, type HBarDatum } from "./_charts";
import {
  fmtCompact,
  fmtInt,
  fmtUsd,
  humanize,
  pickLatestCost,
  shortDate,
  type CostBucket,
  type CostRow,
} from "./_insights-utils";

// Categorical palette from Lyceum semantic tokens (no raw hex).
const PURPOSE_COLORS = [
  colors.brand,
  colors.info,
  colors.success,
  colors.spark,
  colors.error,
  colors.brandHover,
];

export default function AiUsageCostScreen() {
  const monthlyQ = useCostSummary("monthly");
  const dailyQ = useCostSummary("daily");

  const month = useMemo<CostRow | null>(() => pickLatestCost(monthlyQ.data), [monthlyQ.data]);
  const dailyRows = useMemo<CostRow[]>(
    () => (Array.isArray(dailyQ.data) ? (dailyQ.data as CostRow[]) : []),
    [dailyQ.data]
  );

  const loading = monthlyQ.isLoading;
  const hardError = isHardError(monthlyQ) && isHardError(dailyQ);
  const hasMonth = month != null;

  // budget panel
  const budgetPct =
    typeof month?.budgetUsedPercent === "number"
      ? Math.max(0, Math.min(100, month.budgetUsedPercent))
      : null;
  const budgetVariant: "brand" | "warning" | "error" =
    budgetPct == null ? "brand" : budgetPct >= 95 ? "error" : budgetPct >= 80 ? "warning" : "brand";

  // breakdowns
  const byPurpose = bucketsToBars(month?.byPurpose);
  const byModel = bucketsToBars(month?.byModel);

  // daily trend
  const dailySorted = [...dailyRows].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const dailyChart = dailySorted.slice(-14).map((r) => ({
    label: shortDate(r.date) || (r.date ?? "").slice(5),
    value: typeof r.totalCostUsd === "number" ? r.totalCostUsd : 0,
    display: fmtUsd(r.totalCostUsd),
  }));

  return (
    <Screen scroll>
      <TopBar title="AI Usage & Cost" subtitle="LLM consumption & spend by month" />

      {budgetPct != null && budgetPct >= 80 ? (
        <Card className="border-status-warning border">
          <View className="flex-row items-start gap-2">
            <Text className="text-text-primary text-sm">
              <Text className="font-semibold">
                Approaching monthly AI budget — {Math.round(budgetPct)}% used.{" "}
              </Text>
              <Text className="text-text-secondary">
                AI grading pauses automatically if the budget is reached.
              </Text>
            </Text>
          </View>
        </Card>
      ) : null}

      {loading ? (
        <View className="gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </View>
      ) : hardError ? (
        <EmptyState
          icon="alert-triangle"
          title="Couldn't load usage"
          body="Try again in a moment."
        />
      ) : !hasMonth && dailyChart.length === 0 ? (
        <EmptyState
          icon="sparkles"
          title="No AI usage yet"
          body="Cost summaries appear once AI grading, evaluation or extraction runs and the nightly aggregation completes."
        />
      ) : (
        <>
          {/* KPI strip */}
          <View className="flex-row flex-wrap gap-3">
            <KpiCell
              label="Total spend"
              icon="dollar-sign"
              value={fmtUsd(month?.totalCostUsd)}
              sub="Month to date"
            />
            <KpiCell
              label="Total calls"
              icon="activity"
              value={fmtInt(month?.totalCalls)}
              sub="All purposes"
            />
            <KpiCell
              label="Input tokens"
              icon="arrow-down"
              value={fmtCompact(month?.totalInputTokens)}
              sub="This month"
            />
            <KpiCell
              label="Output tokens"
              icon="arrow-up"
              value={fmtCompact(month?.totalOutputTokens)}
              sub="This month"
            />
          </View>

          {/* Budget panel */}
          {month?.budgetLimitUsd != null || budgetPct != null ? (
            <Card className="gap-3">
              <View className="flex-row items-end justify-between">
                <SectionHeader title="Monthly budget" />
                {budgetPct != null ? (
                  <Badge variant={budgetVariant === "brand" ? "neutral" : budgetVariant}>
                    {Math.round(budgetPct)}% used
                  </Badge>
                ) : null}
              </View>
              <Text className="text-text-primary font-mono text-xl">
                {fmtUsd(month?.totalCostUsd)}
                {month?.budgetLimitUsd != null ? (
                  <Text className="text-text-muted text-base">
                    {" "}
                    / {fmtUsd(month.budgetLimitUsd)}
                  </Text>
                ) : null}
              </Text>
              {budgetPct != null ? <ProgressBar value={budgetPct} variant={budgetVariant} /> : null}
              <Text className="text-text-secondary text-xs">
                Warns at 80% · grading pauses automatically when the budget is reached.
              </Text>
            </Card>
          ) : null}

          {/* Daily trend */}
          <Card className="gap-3">
            <SectionHeader title="Daily cost" subtitle="$ per day (last 14)" />
            {dailyQ.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : dailyChart.length === 0 ? (
              <EmptyState
                icon="bar-chart-3"
                title="No daily data yet"
                body="Daily cost appears as AI runs each day."
              />
            ) : (
              <ColumnChart data={dailyChart} />
            )}
          </Card>

          {/* Cost by purpose */}
          <Card className="gap-3">
            <SectionHeader title="Cost by purpose" subtitle="Share of spend" />
            {byPurpose.length === 0 ? (
              <EmptyState
                icon="pie-chart"
                title="No breakdown yet"
                body="Spend by purpose appears once AI runs."
              />
            ) : (
              <HBarList data={byPurpose} />
            )}
          </Card>

          {/* Cost by model */}
          {byModel.length > 0 ? (
            <Card className="gap-3">
              <SectionHeader title="Cost by model" subtitle="Share of spend" />
              <HBarList data={byModel} />
            </Card>
          ) : null}
        </>
      )}

      <Text className="text-2xs text-text-muted px-1 pb-2">
        Figures are server-aggregated by the nightly cost-aggregation scheduler.
      </Text>
    </Screen>
  );
}

/** A record of cost buckets → sorted horizontal-bar data (by cost desc). */
function bucketsToBars(rec?: Record<string, CostBucket | undefined>): HBarDatum[] {
  if (!rec || typeof rec !== "object") return [];
  const rows = Object.entries(rec)
    .map(([key, b], i) => {
      const cost = typeof b?.costUsd === "number" ? b.costUsd : 0;
      return {
        label: humanize(key),
        value: cost,
        display: fmtUsd(cost),
        color: PURPOSE_COLORS[i % PURPOSE_COLORS.length],
      } satisfies HBarDatum;
    })
    .filter((r) => r.value > 0);
  rows.sort((a, b) => b.value - a.value);
  return rows;
}

function KpiCell({
  label,
  icon,
  value,
  sub,
}: {
  label: string;
  icon: string;
  value: string;
  sub?: string;
}) {
  return (
    <View className="min-w-[46%] flex-1">
      <StatTile label={label} icon={icon} value={value} delta={sub} />
    </View>
  );
}
