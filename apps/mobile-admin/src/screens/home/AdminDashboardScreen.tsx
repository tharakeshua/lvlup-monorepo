/**
 * AdminDashboardScreen — the Home tab landing (tenant overview).
 *
 * Design: docs/rebuild-spec/design/build/prototypes/admin/admin-dashboard.card.html
 * Route:  /admin/home
 * Data:   useSpaces() (CONTENT — live today) + the identity rosters
 *         useStudents/useTeachers/useClasses/useExams (admin callables — light
 *         up once SDK-coord deploys the identity group to lvlup-ff6fa; until
 *         then they soft-miss to 0, never an error, per lib/query-status),
 *         useTenant() (tenant-info card) and useCostSummary('daily') (AI-cost
 *         mini-card + budget alert banner).
 *
 * The desktop card is a 6-up KPI grid + class-performance chart + AI-cost +
 * tenant-info + quota meters. On mobile that collapses to: a quota/budget alert
 * banner, a 2-col KPI grid, an AI-cost mini-card, a tenant-info card, and the
 * recent content-spaces list (the GATE-0 render proof — real Subhang data).
 *
 * Self-contained: navigates via expo-router + ../../lib/routes; the shell mounts
 * this default export under the Home tab.
 */
import { useMemo } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  useClasses,
  useCostSummary,
  useExams,
  useSpaces,
  useStudents,
  useTeachers,
  useTenant,
} from "@levelup/query";

import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  KpiGrid,
  ListRow,
  Screen,
  SectionHeader,
  Skeleton,
  StatusPill,
  TopBar,
} from "../../components";
import type { MetricCardProps } from "../../components";
import { routes } from "../../lib/routes";
import { isHardError } from "../../lib/query-status";
import { useSession } from "../../sdk/session";

// ── defensive readers ───────────────────────────────────────────────────────
function listOf<T = Record<string, unknown>>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const items = (res as { items?: unknown[] })?.items;
  return Array.isArray(items) ? (items as T[]) : [];
}

/** Count a list/`{items}`/`{total}` response, or pages of an infinite query. */
function countOf(res: unknown): number | null {
  if (res == null) return null;
  if (Array.isArray(res)) return res.length;
  const obj = res as { items?: unknown[]; total?: number; pages?: unknown[] };
  if (typeof obj.total === "number") return obj.total;
  if (Array.isArray(obj.items)) return obj.items.length;
  if (Array.isArray(obj.pages)) {
    return obj.pages.reduce<number>((sum, p) => {
      const pi = p as { items?: unknown[]; total?: number } | null;
      if (pi && typeof pi.total === "number") return sum + pi.total;
      return sum + (Array.isArray(pi?.items) ? pi!.items!.length : 0);
    }, 0);
  }
  return null;
}

const groupInt = (n: number): string =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const fmtUsd = (n?: number | null): string =>
  n == null || Number.isNaN(n) ? "—" : `$${n.toFixed(2)}`;

/** Cost summary may be daily or monthly; pick the most recent by date/month. */
interface CostRow {
  date?: string;
  month?: string;
  totalCostUsd?: number;
  totalCalls?: number;
  budgetUsedPercent?: number;
  budgetLimitUsd?: number;
  computedAt?: string;
}
function pickLatestCost(rows: unknown): CostRow | null {
  const arr = Array.isArray(rows) ? (rows as CostRow[]) : [];
  if (arr.length === 0) return null;
  return arr.reduce((best, cur) => {
    const bk = best.date ?? best.month ?? "";
    const ck = cur.date ?? cur.month ?? "";
    return ck >= bk ? cur : best;
  });
}

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { user } = useSession();

  const spacesQ = useSpaces({});
  const studentsQ = useStudents({});
  const teachersQ = useTeachers({});
  const classesQ = useClasses({});
  const examsQ = useExams({});
  const tenantQ = useTenant();
  const costQ = useCostSummary("daily");

  const spaces = useMemo(() => listOf(spacesQ.data), [spacesQ.data]);
  const recentSpaces = spaces.slice(0, 5);

  const todayCost = useMemo(() => pickLatestCost(costQ.data), [costQ.data]);
  const tenant = (tenantQ.data ?? {}) as {
    tenantCode?: string;
    code?: string;
    plan?: string;
    planTier?: string;
    status?: string;
    contactEmail?: string;
    ownerEmail?: string;
    name?: string;
    displayName?: string;
  };

  // Budget banner — only when a real budget % is present and elevated.
  const budgetPct =
    typeof todayCost?.budgetUsedPercent === "number" ? todayCost.budgetUsedPercent : null;
  const showBudgetAlert = budgetPct != null && budgetPct >= 80;

  const kpis: MetricCardProps[] = [
    {
      label: "Students",
      icon: "graduation-cap",
      value: kpiValue(studentsQ),
      onPress: () => router.push(routes.people()),
    },
    {
      label: "Teachers",
      icon: "users",
      value: kpiValue(teachersQ),
      onPress: () => router.push(routes.staff()),
    },
    {
      label: "Classes",
      icon: "school",
      value: kpiValue(classesQ),
      onPress: () => router.push(routes.academics()),
    },
    {
      label: "Spaces",
      icon: "layers",
      value: kpiValue(spacesQ),
      onPress: () => router.push(routes.content()),
    },
    {
      label: "Exams",
      icon: "file-check",
      value: kpiValue(examsQ),
      onPress: () => router.push(routes.exams()),
    },
    {
      label: "AI spend",
      icon: "sparkles",
      accent: "spark",
      value: costQ.isLoading ? "…" : fmtUsd(todayCost?.totalCostUsd),
      caption: "today",
      onPress: () => router.push(routes.aiUsage()),
    },
  ];

  return (
    <Screen scroll>
      <TopBar
        title="Dashboard"
        subtitle={tenant.name ?? tenant.displayName ?? user?.email ?? "Tenant admin"}
        right={
          <Badge variant="brand" icon={<Icon name="shield" size={12} />}>
            Admin
          </Badge>
        }
      />

      {showBudgetAlert ? (
        <Alert variant="warning" icon="triangle-alert" title="Approaching AI budget">
          {`${Math.round(budgetPct!)}% of the AI budget is used. AI grading pauses automatically if the budget is reached.`}
        </Alert>
      ) : null}

      {/* KPI grid (server-authoritative; deep links) */}
      <KpiGrid items={kpis} columns={2} />

      {/* AI cost + tenant info */}
      <View className="flex-row flex-wrap gap-3">
        <Card
          className="min-w-[46%] flex-1 gap-3"
          interactive
          onPress={() => router.push(routes.aiUsage())}
        >
          <SectionHeader title="AI cost" />
          <View className="flex-row justify-between">
            <View className="gap-1">
              <Text className="text-2xs text-text-muted">Today&apos;s spend</Text>
              <Text className="text-text-primary font-mono text-xl">
                {costQ.isLoading ? "…" : fmtUsd(todayCost?.totalCostUsd)}
              </Text>
            </View>
            <View className="gap-1">
              <Text className="text-2xs text-text-muted">Today&apos;s calls</Text>
              <Text className="text-text-primary font-mono text-xl">
                {costQ.isLoading
                  ? "…"
                  : todayCost?.totalCalls != null
                    ? groupInt(todayCost.totalCalls)
                    : "—"}
              </Text>
            </View>
          </View>
          <Text className="text-brand text-xs font-medium">View AI usage →</Text>
        </Card>

        <Card className="min-w-[46%] flex-1 gap-3">
          <SectionHeader title="Tenant" />
          <View className="gap-2">
            <InfoRow label="Code" value={tenant.tenantCode ?? tenant.code ?? "—"} mono />
            <InfoRow label="Plan" value={cap(tenant.plan ?? tenant.planTier) ?? "—"} />
            <View className="flex-row items-center justify-between">
              <Text className="text-text-muted text-sm">Status</Text>
              <StatusPill status={tenant.status ?? "active"} />
            </View>
          </View>
        </Card>
      </View>

      {/* Quick actions */}
      <Card className="gap-3">
        <SectionHeader title="Quick actions" />
        <View className="flex-row flex-wrap gap-2">
          <Button variant="secondary" size="sm" onPress={() => router.push(routes.people())}>
            Manage people
          </Button>
          <Button variant="secondary" size="sm" onPress={() => router.push(routes.academics())}>
            Academics
          </Button>
          <Button variant="secondary" size="sm" onPress={() => router.push(routes.insights())}>
            Insights
          </Button>
          <Button variant="secondary" size="sm" onPress={() => router.push(routes.announcements())}>
            Announce
          </Button>
        </View>
      </Card>

      {/* Recent content (live today via the fat SDK) */}
      <Card className="gap-2">
        <SectionHeader
          title="Content spaces"
          subtitle="Published learning spaces in this tenant"
          action={
            <Button variant="ghost" size="sm" onPress={() => router.push(routes.content())}>
              View all
            </Button>
          }
        />
        {spacesQ.isLoading ? (
          <View className="gap-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </View>
        ) : isHardError(spacesQ) ? (
          <EmptyState
            icon="alert-triangle"
            title="Couldn't load spaces"
            body="Pull to retry in a moment."
          />
        ) : recentSpaces.length === 0 ? (
          <EmptyState
            icon="layers"
            title="No spaces yet"
            body="Content appears here once authored."
          />
        ) : (
          recentSpaces.map((s) => {
            const sp = s as { id?: string; title?: string; name?: string; description?: string };
            return (
              <ListRow
                key={sp.id ?? sp.title}
                title={sp.title ?? sp.name ?? "Untitled space"}
                subtitle={sp.description ?? undefined}
                leading={<Icon name="layers" size={18} />}
                onPress={() => router.push(routes.content())}
              />
            );
          })
        )}
      </Card>

      <Text className="text-2xs text-text-muted px-1 pb-2">
        Tenant rosters populate once the admin identity callables deploy. Content is live via the
        fat SDK against lvlup-ff6fa.
      </Text>
    </Screen>
  );
}

// ── small inline helpers ────────────────────────────────────────────────────
function kpiValue(q: { data?: unknown; isLoading: boolean }): string {
  if (q.isLoading) return "…";
  const n = countOf(q.data);
  return n == null ? "—" : groupInt(n);
}

function cap(v?: string): string | undefined {
  if (!v) return undefined;
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-text-muted text-sm">{label}</Text>
      <Text className={mono ? "text-text-primary font-mono text-sm" : "text-text-primary text-sm"}>
        {value}
      </Text>
    </View>
  );
}
