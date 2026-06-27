import { useMemo } from "react";
import { useTenants } from "@levelup/query";
import { Users, TrendingUp, Building2, UserPlus, AlertCircle } from "lucide-react";
import { usePagination } from "../hooks/usePagination";
import {
  StatCard,
  StatusBadge,
  PageHeader,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Progress,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  DataTablePagination,
} from "@levelup/shared-ui";

interface TenantUserStats {
  tenantId: string;
  tenantName: string;
  tenantCode: string;
  status: string;
  students: number;
  teachers: number;
  total: number;
}

interface PlatformUserStats {
  totalUsers: number;
  totalStudents: number;
  totalTeachers: number;
  activeTenants: number;
  totalTenants: number;
  tenantStats: TenantUserStats[];
  usersByPlan: Record<string, number>;
}

/**
 * Super-admin tenant list row (the @levelup/query `useTenants()` projection —
 * api-contract `TenantSummarySchema`). NOTE: `slug` stands in for the legacy
 * `tenantCode`; the projection carries no `contactEmail` or nested `stats`.
 */
interface TenantSummaryRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan?: string;
  totalStudents: number;
  totalTeachers: number;
  createdAt: string;
}

/** `useTenants()` returns a PageBag — read `.items`, defensively. */
function readTenantItems(data: unknown): TenantSummaryRow[] {
  const bag = data as { items?: unknown } | undefined;
  return Array.isArray(bag?.items) ? (bag!.items as TenantSummaryRow[]) : [];
}

function aggregateUserStats(tenants: TenantSummaryRow[]): PlatformUserStats {
  let totalStudents = 0;
  let totalTeachers = 0;
  const usersByPlan: Record<string, number> = {};

  const tenantStats: TenantUserStats[] = tenants.map((t) => {
    const students = t.totalStudents ?? 0;
    const teachers = t.totalTeachers ?? 0;
    totalStudents += students;
    totalTeachers += teachers;

    const plan = t.plan ?? "none";
    usersByPlan[plan] = (usersByPlan[plan] ?? 0) + students + teachers;

    return {
      tenantId: t.id,
      tenantName: t.name,
      tenantCode: t.slug,
      status: t.status,
      students,
      teachers,
      total: students + teachers,
    };
  });

  tenantStats.sort((a, b) => b.total - a.total);

  return {
    totalUsers: totalStudents + totalTeachers,
    totalStudents,
    totalTeachers,
    activeTenants: tenants.filter((t) => t.status === "active").length,
    totalTenants: tenants.length,
    tenantStats,
    usersByPlan,
  };
}

const PLAN_COLORS: Record<string, string> = {
  enterprise: "bg-primary",
  premium: "bg-violet-500",
  basic: "bg-blue-500",
  trial: "bg-amber-500",
  none: "bg-muted-foreground",
};

export default function UserAnalyticsPage() {
  // SDK GAP NOTE: `useTenants()` paginates (limit cap 100) and its projection has
  // no `contactEmail`/nested stats — `slug` stands in for the legacy tenantCode.
  const { data, isLoading, isError, error, refetch } = useTenants({ limit: 100 });
  const stats = useMemo(() => aggregateUserStats(readTenantItems(data)), [data]);

  const tenantStatsList = useMemo(() => stats?.tenantStats ?? [], [stats]);
  const { paginatedItems, currentPage, pageSize, totalItems, setCurrentPage, setPageSize } =
    usePagination(tenantStatsList);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="User Analytics" description="Platform-wide user statistics and growth" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-2 px-4 pb-4 pt-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-5 w-48" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="User Analytics" description="Platform-wide user statistics and growth" />
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to load data</AlertTitle>
          <AlertDescription className="flex items-center gap-2">
            {error instanceof Error ? error.message : "An unexpected error occurred."}
            <Button variant="link" className="h-auto p-0" onClick={() => refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    {
      label: "Total Users",
      value: stats.totalUsers.toLocaleString(),
      icon: Users,
      sub: `${stats.totalTenants} tenants`,
    },
    {
      label: "Students",
      value: stats.totalStudents.toLocaleString(),
      icon: UserPlus,
      sub: `${stats.totalUsers > 0 ? Math.round((stats.totalStudents / stats.totalUsers) * 100) : 0}% of users`,
    },
    {
      label: "Teachers",
      value: stats.totalTeachers.toLocaleString(),
      icon: TrendingUp,
      sub: `${stats.totalUsers > 0 ? Math.round((stats.totalTeachers / stats.totalUsers) * 100) : 0}% of users`,
    },
    {
      label: "Active Tenants",
      value: stats.activeTenants.toString(),
      icon: Building2,
      sub: `of ${stats.totalTenants} total`,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="User Analytics" description="Platform-wide user statistics and growth" />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            icon={card.icon}
            subtext={card.sub}
          />
        ))}
      </div>

      {/* Users by Plan */}
      {Object.keys(stats.usersByPlan).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Users by Subscription Plan</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-4">
              {Object.entries(stats.usersByPlan)
                .sort(([, a], [, b]) => b - a)
                .map(([plan, count]) => {
                  const pct =
                    stats.totalUsers > 0 ? Math.round((count / stats.totalUsers) * 100) : 0;
                  const colorClass = PLAN_COLORS[plan] ?? "bg-muted-foreground";
                  return (
                    <div key={plan} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${colorClass}`} />
                          <span className="font-medium capitalize">{plan}</span>
                        </div>
                        <span className="text-muted-foreground tabular-nums">
                          {count.toLocaleString()} users ({pct}%)
                        </span>
                      </div>
                      <Progress
                        value={Math.min(pct, 100)}
                        className="h-2"
                        indicatorClassName={colorClass}
                      />
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-Tenant Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Users by Tenant</CardTitle>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Sorted by total users, descending
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableCaption className="sr-only">Users by tenant breakdown</TableCaption>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>Tenant</TableHead>
                <TableHead>Code</TableHead>
                <TableHead className="text-right">Students</TableHead>
                <TableHead className="text-right">Teachers</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
                        <Building2 className="text-muted-foreground h-6 w-6" />
                      </div>
                      <h3 className="mt-3 text-sm font-semibold">No tenants found</h3>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((ts) => (
                  <TableRow key={ts.tenantId}>
                    <TableCell className="font-medium">{ts.tenantName}</TableCell>
                    <TableCell>
                      <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
                        {ts.tenantCode}
                      </code>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {ts.students.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {ts.teachers.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {ts.total.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={
                          ts.status as "active" | "trial" | "suspended" | "expired" | "deactivated"
                        }
                      >
                        {ts.status}
                      </StatusBadge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <DataTablePagination
            totalItems={totalItems}
            pageSize={pageSize}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>
    </div>
  );
}
