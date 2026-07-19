import { Link } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { useCurrentUser, useCurrentTenantId, useCurrentTenant } from "@/sdk/identity";
import {
  useExams,
  useSpaces,
  useClasses,
  useStudents,
  useTeachers,
  useCostSummary,
  useApi,
  analyticsQueryKeys,
} from "@levelup/query";
import type {
  Tenant,
  Exam,
  Space,
  Class,
  Student,
  Teacher,
  ClassProgressSummary,
} from "@levelup/shared-types";
import { ScoreCard, SimpleBarChart, Badge } from "@levelup/shared-ui";
import {
  Users,
  GraduationCap,
  BookOpen,
  ClipboardList,
  AlertTriangle,
  DollarSign,
  BarChart3,
  ArrowRight,
  Settings,
} from "lucide-react";
import QuotaUsageCard from "../components/dashboard/QuotaUsageCard";
import { pageItems } from "@/lib/utils";

/**
 * Per-class progress summaries via the query SDK (tenant-implicit / claims-scoped).
 * `useClassSummary` is single-class; this fans it out over the class ids with
 * `useQueries` (rules-of-hooks-safe for a dynamic list), mirroring the legacy
 * `useClassSummaries`.
 */
function useClassSummaries(classIds: string[]) {
  const { repos } = useApi();
  const summaryRepo = (
    repos as unknown as {
      summaryRepo: { getClass(classId: string): Promise<ClassProgressSummary> };
    }
  ).summaryRepo;
  return useQueries({
    queries: classIds.map((classId) => ({
      queryKey: analyticsQueryKeys.classSummary(classId),
      queryFn: () => summaryRepo.getClass(classId),
    })),
  });
}

export default function DashboardPage() {
  const user = useCurrentUser();
  const tenantId = useCurrentTenantId();
  const tenant = useCurrentTenant().data as Tenant | undefined;
  const exams = pageItems<Exam>(useExams({}).data);
  const spaces = pageItems<Space>(useSpaces({}).data);
  const classes = pageItems<Class>(useClasses({}).data);
  const students = pageItems<Student>(useStudents({}).data);
  const teachers = pageItems<Teacher>(useTeachers({}).data);

  // Fetch class summaries for at-risk count and chart
  const classIds = classes.map((c) => c.id);
  const classSummaryResults = useClassSummaries(classIds);
  const classSummaries = classSummaryResults.map((r) => r.data).filter(Boolean);

  // AI cost summary (today)
  const today = new Date().toISOString().split("T")[0];
  const todayCosts = useCostSummary("daily", { date: today! }).data ?? [];
  const todayCost = todayCosts[0]?.totalCostUsd ?? 0;

  const stats = tenant?.stats;
  const atRiskCount = classSummaries.reduce((sum, cs) => sum + (cs?.atRiskCount ?? 0), 0);

  // Class performance chart data
  const classChartData = classSummaries
    .filter((cs) => cs != null)
    .map((cs) => ({
      label: cs!.className || cs!.classId.slice(0, 8),
      value: (cs!.autograde.averageClassScore ?? 0) * 100,
    }));

  const subscription = tenant?.subscription;
  const usage = tenant?.usage;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">School Admin Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Welcome back, {user?.displayName || user?.email || "Admin"}
          {tenant ? ` — ${tenant.name}` : ""}
        </p>
      </div>

      {/* Onboarding incomplete banner */}
      {tenant && tenant.onboarding?.completed !== true && (
        <div className="flex items-center justify-between rounded-lg border border-amber-500/50 bg-amber-50 p-4 dark:bg-amber-950/20">
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Complete your school setup
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Finish the onboarding wizard to unlock all features.
            </p>
          </div>
          <Link
            to="/onboarding"
            className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
          >
            Complete Setup <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* Overview Stats — 2-col on mobile */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Link to="/users" className="block">
          <ScoreCard
            label="Total Students"
            value={students.length || stats?.totalStudents || 0}
            icon={Users}
          />
        </Link>
        <Link to="/users" className="block">
          <ScoreCard
            label="Total Teachers"
            value={teachers.length || stats?.totalTeachers || 0}
            icon={GraduationCap}
          />
        </Link>
        <Link to="/classes" className="block">
          <ScoreCard label="Classes" value={classes.length} icon={GraduationCap} />
        </Link>
        <Link to="/spaces" className="block">
          <ScoreCard
            label="Total Spaces"
            value={spaces.length || stats?.totalSpaces || 0}
            icon={BookOpen}
          />
        </Link>
        <Link to="/exams" className="block">
          <ScoreCard
            label="Total Exams"
            value={exams.length || stats?.totalExams || 0}
            icon={ClipboardList}
          />
        </Link>
        <Link to="/analytics" className="block">
          <ScoreCard
            label="At-Risk Students"
            value={atRiskCount}
            icon={AlertTriangle}
            trend={atRiskCount > 0 ? "down" : "neutral"}
            trendValue={atRiskCount > 0 ? "Needs attention" : "All good"}
          />
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Class Performance — always visible with empty state */}
        <div className="bg-card rounded-lg border p-5">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="text-muted-foreground h-4 w-4" />
            <h2 className="font-semibold">Class Performance (Avg Exam Score)</h2>
          </div>
          {classChartData.length > 0 ? (
            <div role="img" aria-label="Bar chart showing average exam scores per class">
              <SimpleBarChart data={classChartData} maxValue={100} height={200} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BarChart3 className="text-muted-foreground h-8 w-8" />
              <p className="text-muted-foreground mt-2 text-sm">
                No performance data available yet
              </p>
            </div>
          )}
        </div>

        {/* AI Cost + Tenant Info */}
        <div className="space-y-4">
          {/* AI Cost Card */}
          <div className="bg-card rounded-lg border p-4">
            <div className="mb-3 flex items-center gap-2">
              <DollarSign className="text-muted-foreground h-4 w-4" />
              <h3 className="font-semibold">AI Cost Summary</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground text-xs">Today&apos;s Spend</p>
                <p className="text-xl font-bold">${todayCost.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Today&apos;s Calls</p>
                <p className="text-xl font-bold">{todayCosts[0]?.totalCalls ?? 0}</p>
              </div>
            </div>
          </div>

          {/* Tenant Info */}
          <div className="bg-card rounded-lg border p-4">
            <h3 className="mb-3 font-semibold">Tenant Info</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tenant Code</dt>
                <dd className="font-mono font-medium">{tenant?.tenantCode || tenantId || "--"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Plan</dt>
                <dd className="capitalize">{tenant?.subscription?.plan || "--"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="capitalize">{tenant?.status || "--"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Contact</dt>
                <dd>{tenant?.contactEmail || "--"}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Subscription Usage / Quota Visualization (T5) */}
      {tenant && (
        <div className="bg-card rounded-lg border p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="text-muted-foreground h-4 w-4" />
              <h2 className="font-semibold">Subscription Usage</h2>
            </div>
            <div className="flex items-center gap-2">
              {subscription?.plan && (
                <Badge variant="outline" className="capitalize">
                  {subscription.plan}
                </Badge>
              )}
              <Link to="/settings" className="text-primary text-xs hover:underline">
                View details
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <QuotaUsageCard
              label="Students"
              current={usage?.currentStudents ?? stats?.totalStudents ?? 0}
              max={subscription?.maxStudents}
            />
            <QuotaUsageCard
              label="Teachers"
              current={usage?.currentTeachers ?? stats?.totalTeachers ?? 0}
              max={subscription?.maxTeachers}
            />
            <QuotaUsageCard
              label="Spaces"
              current={usage?.currentSpaces ?? stats?.totalSpaces ?? 0}
              max={subscription?.maxSpaces}
            />
            <QuotaUsageCard
              label="Exams / month"
              current={usage?.examsThisMonth ?? 0}
              max={subscription?.maxExamsPerMonth}
            />
            <QuotaUsageCard
              label="AI calls / month"
              current={usage?.aiCallsThisMonth ?? 0}
              max={undefined}
            />
          </div>
          {subscription?.expiresAt && (
            <p className="text-muted-foreground mt-3 text-xs">
              Subscription expires:{" "}
              {typeof subscription.expiresAt === "object" && "toDate" in subscription.expiresAt
                ? (subscription.expiresAt as { toDate: () => Date }).toDate().toLocaleDateString()
                : String(subscription.expiresAt)}
            </p>
          )}
        </div>
      )}

      {/* Features — theme-aware colors */}
      {tenant?.features && Object.keys(tenant.features).length > 0 && (
        <div className="bg-card rounded-lg border p-4">
          <h3 className="mb-3 font-semibold">Features</h3>
          <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            {Object.entries(tenant.features).map(([key, enabled]) => (
              <div key={key} className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${enabled ? "bg-primary" : "bg-muted-foreground/30"}`}
                />
                <span className="text-muted-foreground">
                  {key.replace(/([A-Z])/g, " $1").replace("Enabled", "")}
                  {!enabled && " (off)"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
