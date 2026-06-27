import {
  Activity,
  Server,
  Database,
  Zap,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  runHealthChecks,
  fetchHealthHistory,
  type ServiceStatus,
  type HealthData,
} from "../sdk/reads-platform";
import {
  Button,
  PageHeader,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Alert,
  AlertDescription,
  AlertTitle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@levelup/shared-ui";

/**
 * Live health probes + 30-day history. SDK GAPS: the live probes (firestore
 * latency / auth.currentUser / functions ping) and `platformHealthSnapshots`
 * read+write have no callable, and useHealthSummary() returns a single snapshot
 * (not the 30-day history + errorCount24h this page needs) — so both reads live
 * in `sdk/reads-platform.ts` and are consumed here via plain TanStack useQuery.
 */
function useHealthChecks() {
  return useQuery<HealthData>({
    queryKey: ["platform", "healthChecks"],
    queryFn: runHealthChecks,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });
}

function useHealthHistory() {
  return useQuery({
    queryKey: ["platform", "healthHistory"],
    queryFn: fetchHealthHistory,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

const statusConfig: Record<
  ServiceStatus,
  {
    icon: typeof CheckCircle2;
    label: string;
    colorClass: string;
    bgClass: string;
    dotClass: string;
  }
> = {
  operational: {
    icon: CheckCircle2,
    label: "Operational",
    colorClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/50",
    dotClass: "bg-emerald-500",
  },
  degraded: {
    icon: AlertTriangle,
    label: "Degraded",
    colorClass: "text-amber-600 dark:text-amber-400",
    bgClass: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/50",
    dotClass: "bg-amber-500",
  },
  down: {
    icon: XCircle,
    label: "Down",
    colorClass: "text-red-600 dark:text-red-400",
    bgClass: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800/50",
    dotClass: "bg-red-500",
  },
};

const healthDotColors: Record<string, string> = {
  healthy: "bg-emerald-500",
  degraded: "bg-amber-500",
  down: "bg-red-500",
};

export default function SystemHealthPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useHealthChecks();
  const { data: healthHistory, isLoading: isHistoryLoading } = useHealthHistory();

  const overallStatus: ServiceStatus = !data
    ? "operational"
    : Object.values(data.probes).some((p) => p.status === "down")
      ? "down"
      : Object.values(data.probes).some((p) => p.status === "degraded")
        ? "degraded"
        : "operational";

  const overallLabels: Record<ServiceStatus, string> = {
    operational: "All Systems Operational",
    degraded: "Some Services Degraded",
    down: "Service Disruption Detected",
  };

  const services = data
    ? [
        {
          name: "Firebase Auth",
          icon: Server,
          description: "Authentication service",
          result: data.probes.auth,
        },
        {
          name: "Firestore",
          icon: Database,
          description: "Primary database",
          result: data.probes.firestore,
        },
        {
          name: "Cloud Functions",
          icon: Zap,
          description: "Serverless compute",
          result: data.probes.functions,
        },
        {
          name: "AI Grading Pipeline",
          icon: Activity,
          description: "Gemini AI evaluation",
          result: data.probes.aiPipeline,
        },
      ]
    : [];

  const overallConfig = statusConfig[overallStatus];

  // Build the 30-day snapshot array (pad with empty days if fewer than 30)
  const snapshotsForDisplay = (() => {
    const snapshots = healthHistory?.snapshots ?? [];
    // Create a map of date -> status
    const statusMap = new Map<string, string>();
    for (const s of snapshots) {
      statusMap.set(s.date, s.status);
    }

    // Generate last 30 dates
    const days: Array<{ date: string; status: string }> = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      days.push({
        date: dateStr,
        status: statusMap.get(dateStr) ?? "no-data",
      });
    }
    return days;
  })();

  // Error rate display value
  const errorRateValue = (() => {
    if (isHistoryLoading) return null;
    if (!healthHistory) return "--";
    return String(healthHistory.errorCount24h);
  })();

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Health"
        description="Monitor platform services and infrastructure status"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "Checking..." : "Refresh"}
          </Button>
        }
      />

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to run health checks</AlertTitle>
          <AlertDescription className="flex items-center gap-2">
            {error instanceof Error ? error.message : "An unexpected error occurred."}
            <Button variant="link" className="h-auto p-0" onClick={() => refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Overall status banner */}
      <Card className={`border ${isLoading || isFetching ? "" : overallConfig.bgClass}`}>
        <CardContent className="p-6">
          {isLoading || isFetching ? (
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-6 w-48" />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${overallStatus === "operational" ? "bg-emerald-100 dark:bg-emerald-900/50" : overallStatus === "degraded" ? "bg-amber-100 dark:bg-amber-900/50" : "bg-red-100 dark:bg-red-900/50"}`}
                >
                  <overallConfig.icon className={`h-4 w-4 ${overallConfig.colorClass}`} />
                </div>
                <div>
                  <p className={`font-semibold ${overallConfig.colorClass}`}>
                    {overallLabels[overallStatus]}
                  </p>
                </div>
              </div>
              {data && (
                <p className="text-muted-foreground text-xs">Last checked: {data.checkedAt}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Service cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          : services.map((svc) => {
              const cfg = statusConfig[svc.result.status];
              return (
                <Card key={svc.name} className="transition-shadow hover:shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                          <svc.icon className="text-muted-foreground h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium">{svc.name}</p>
                          <p className="text-muted-foreground text-sm">{svc.description}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <div
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.bgClass} ${cfg.colorClass}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotClass}`} />
                          {cfg.label}
                        </div>
                        {svc.result.latencyMs !== undefined && (
                          <span className="text-muted-foreground text-xs tabular-nums">
                            {svc.result.latencyMs}ms
                          </span>
                        )}
                      </div>
                    </div>
                    {svc.result.detail && (
                      <p className="text-muted-foreground bg-muted/50 mt-3 rounded-md px-3 py-2 text-xs">
                        {svc.result.detail}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {/* 30-Day Uptime History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">30-Day Uptime History</CardTitle>
        </CardHeader>
        <CardContent>
          {isHistoryLoading ? (
            <div className="flex items-center gap-1">
              {Array.from({ length: 30 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-2 rounded-sm" />
              ))}
            </div>
          ) : (
            <TooltipProvider>
              <div className="flex items-end gap-1">
                {snapshotsForDisplay.map((day) => (
                  <Tooltip key={day.date}>
                    <TooltipTrigger asChild>
                      <div
                        className={`h-8 w-2 rounded-sm transition-colors ${
                          day.status === "no-data"
                            ? "bg-muted"
                            : (healthDotColors[day.status] ?? "bg-muted")
                        }`}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">
                        {day.date}: {day.status === "no-data" ? "No data" : day.status}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
              <div className="text-muted-foreground mt-2 flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  Healthy
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                  Degraded
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                  Down
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="bg-muted inline-block h-2 w-2 rounded-full" />
                  No data
                </div>
              </div>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>

      {/* Platform Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                label: "Avg Response Time",
                value:
                  isLoading || isFetching
                    ? null
                    : data?.metrics.avgResponseMs !== null
                      ? `${data?.metrics.avgResponseMs}ms`
                      : "--",
                sub: "Firestore read latency",
              },
              {
                label: "Total Users",
                value:
                  isLoading || isFetching
                    ? null
                    : data?.metrics.totalUsers !== null
                      ? data?.metrics.totalUsers?.toLocaleString()
                      : "--",
                sub:
                  data?.metrics.activeTenants !== null
                    ? `across ${data?.metrics.activeTenants} active tenant${data?.metrics.activeTenants !== 1 ? "s" : ""}`
                    : undefined,
              },
              {
                label: "Errors (24h)",
                value: errorRateValue,
                sub: healthHistory
                  ? `${healthHistory.errorCount24h} error${healthHistory.errorCount24h !== 1 ? "s" : ""} in the last 24 hours`
                  : "Loading error data...",
              },
            ].map((metric) => (
              <div key={metric.label} className="bg-muted/30 rounded-lg border p-4">
                <p className="text-muted-foreground text-sm">{metric.label}</p>
                {metric.value === null ? (
                  <Skeleton className="mt-1 h-8 w-16" />
                ) : (
                  <p className="mt-1 text-2xl font-bold tabular-nums">{metric.value}</p>
                )}
                {metric.sub && <p className="text-muted-foreground mt-1 text-xs">{metric.sub}</p>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
