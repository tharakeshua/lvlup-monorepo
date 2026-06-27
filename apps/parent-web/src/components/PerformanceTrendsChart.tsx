import { useState } from "react";
import { usePerformanceTrends } from "@levelup/query";
import type { StudentId } from "@levelup/domain";
import { Card, CardContent, CardHeader, CardTitle, Skeleton, Button } from "@levelup/shared-ui";
import { TrendingUp } from "lucide-react";

type TimeRange = "7d" | "30d" | "90d" | "all";

/** Local chart-point shape the SVG renderer consumes (adapted from the SDK point). */
interface ChartPoint {
  date: string;
  score: number;
  subject: string;
}

const RANGE_LABELS: Record<TimeRange, string> = {
  "7d": "7 Days",
  "30d": "30 Days",
  "90d": "90 Days",
  all: "All Time",
};

const RANGE_DAYS: Record<TimeRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: 3650,
};

const RANGE_GRANULARITY: Record<TimeRange, "week" | "month" | "term"> = {
  "7d": "week",
  "30d": "month",
  "90d": "month",
  all: "term",
};

function MiniLineChart({ data }: { data: ChartPoint[] }) {
  if (data.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No data available for this time range
      </p>
    );
  }

  const maxScore = Math.max(...data.map((d) => d.score), 100);
  const width = 100;
  const height = 40;
  const padding = 2;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const points = data.map((d, i) => {
    const x = padding + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = padding + chartH - (d.score / maxScore) * chartH;
    return `${x},${y}`;
  });

  const polyline = points.join(" ");

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-48 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Performance trend chart showing ${data.length} data points`}
      >
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((pct) => {
          const y = padding + chartH - (pct / maxScore) * chartH;
          return (
            <line
              key={pct}
              x1={padding}
              x2={width - padding}
              y1={y}
              y2={y}
              stroke="currentColor"
              className="text-muted/20"
              strokeWidth="0.2"
            />
          );
        })}
        {/* Line */}
        <polyline
          points={polyline}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="0.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Dots */}
        {data.map((d, i) => {
          const x = padding + (i / Math.max(data.length - 1, 1)) * chartW;
          const y = padding + chartH - (d.score / maxScore) * chartH;
          return (
            <circle key={i} cx={x} cy={y} r="0.6" fill="hsl(var(--primary))">
              <title>{`${d.date}: ${d.score}% (${d.subject})`}</title>
            </circle>
          );
        })}
      </svg>
      {/* X-axis labels */}
      <div className="text-muted-foreground mt-1 flex justify-between px-1 text-xs">
        <span>{data[0]?.date ?? ""}</span>
        <span>{data[data.length - 1]?.date ?? ""}</span>
      </div>
    </div>
  );
}

export function PerformanceTrendsChart({
  studentId,
}: {
  // tenantId kept for caller parity; the SDK derives tenant from the auth claim.
  tenantId: string | null;
  studentId: string | null;
}) {
  const [range, setRange] = useState<TimeRange>("30d");
  const now = new Date();
  const to = now.toISOString();
  const from = new Date(now.getTime() - RANGE_DAYS[range] * 86_400_000).toISOString();
  const { data: rawTrends, isLoading } = usePerformanceTrends({
    studentId: (studentId ?? "") as StudentId,
    granularity: RANGE_GRANULARITY[range],
    range: { from, to },
  });

  // Read defensively: the SDK point shape differs from the legacy chart shape.
  const trendData: ChartPoint[] = ((rawTrends ?? []) as Array<Record<string, unknown>>).map(
    (p) => ({
      date: String(p.date ?? p.periodStart ?? p.periodEnd ?? ""),
      score: Number(p.value ?? p.avgPercentage ?? p.overallScore ?? 0),
      subject: String(p.subject ?? p.subjectId ?? ""),
    })
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
            Performance Trends
          </CardTitle>
          <div className="flex gap-1">
            {(Object.keys(RANGE_LABELS) as TimeRange[]).map((r) => (
              <Button
                key={r}
                variant={range === r ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setRange(r)}
              >
                {RANGE_LABELS[r]}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full rounded" />
        ) : (
          <MiniLineChart data={trendData ?? []} />
        )}
      </CardContent>
    </Card>
  );
}
