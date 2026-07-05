/**
 * Parity-gap reads for super-admin PLATFORM analytics/system pages.
 *
 * Several platform-only datasets have NO callable in @levelup/api-contract and so
 * cannot go through @levelup/query. This module (mirroring `reads-tenant.ts`) is
 * the ONLY place in apps/super-admin's platform pages allowed to touch
 * `firebase/firestore` directly — it reads through the shared-services Firebase
 * handle and is consumed from pages via a plain TanStack `useQuery`.
 *
 * REPORTED SDK GAPS (no callable equivalent — need contract additions):
 *   • platformActivityLog        → `listPlatformActivity` (global super-admin feed)
 *   • tenants.stats.totalSpaces  → not surfaced by usePlatformSummary().kpis
 *   • users.lastLoginAt (7d)     → no active-user-count callable
 *   • platformHealthSnapshots    → no read/write callable (live-probe diagnostics)
 *   • live health probes         → inherently raw (auth/firestore/functions ping)
 *   • cross-tenant LLM cost       → useCostSummary() is claim-tenant-scoped only;
 *                                   no platform-wide per-tenant cost roll-up callable
 */
import {
  collection,
  getDocs,
  query,
  limit as fsLimit,
  where,
  doc,
  setDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import {
  getFirebaseServices,
  callSaveTenant,
  callGetPlatformSummary,
} from "@levelup/shared-services";
import type { Tenant, DailyCostSummary, PlatformActivityLog } from "@levelup/domain";
import { getSdk } from "./api";

/**
 * Health-summary shape returned by the `getSummary` callable (scope:'health').
 * Defined locally — it's a callable RESPONSE contract type, not a domain entity,
 * and lived only in the legacy shared-types package (which the app no longer depends on).
 */
export interface HealthSummaryResponse {
  snapshots: Array<{ date: string; status: string }>;
  errorCount24h: number;
}

// ===========================================================================
// DashboardPage — global platform activity feed (GAP: platformActivityLog)
// ===========================================================================

export async function listPlatformActivity(max = 10): Promise<PlatformActivityLog[]> {
  // U2.4+5 cutover: the direct `platformActivityLog` read is rules-denied —
  // the v1 callable is the sanctioned (and canonical-view) path.
  const { api } = getSdk();
  const res = await api.analytics.listPlatformActivity({ limit: max });
  return res.items as PlatformActivityLog[];
}

// ===========================================================================
// DashboardPage — totals NOT exposed by usePlatformSummary().kpis
// (GAP: tenants.stats.totalSpaces + users.lastLoginAt 7-day active count)
// ===========================================================================

export interface PlatformExtraStats {
  totalSpaces: number;
  activeUsers7d: number;
}

export async function getPlatformExtraStats(): Promise<PlatformExtraStats> {
  const { db } = getFirebaseServices();

  const tenantsSnap = await getDocs(collection(db, "tenants"));
  const tenants = tenantsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Tenant);
  const totalSpaces = tenants.reduce((sum, t) => sum + (t.stats?.totalSpaces ?? 0), 0);

  // Active users (last 7 days) — count users with recent lastLoginAt.
  let activeUsers7d = 0;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  try {
    const usersSnap = await getDocs(
      query(collection(db, "users"), where("lastLoginAt", ">=", sevenDaysAgo))
    );
    activeUsers7d = usersSnap.size;
  } catch {
    // lastLoginAt index may not exist yet — degrade gracefully.
  }

  return { totalSpaces, activeUsers7d };
}

// ===========================================================================
// SystemHealthPage — live probes + 30-day history
// (GAP: platformHealthSnapshots read/write + health live probes have no callable)
// ===========================================================================

export type ServiceStatus = "operational" | "degraded" | "down";

export interface ProbeResult {
  status: ServiceStatus;
  latencyMs?: number;
  detail?: string;
}

export interface HealthData {
  probes: {
    auth: ProbeResult;
    firestore: ProbeResult;
    functions: ProbeResult;
    aiPipeline: ProbeResult;
  };
  metrics: {
    avgResponseMs: number | null;
    totalUsers: number | null;
    activeTenants: number | null;
  };
  checkedAt: string;
}

function getTodayDateString(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function deriveOverallStatus(probes: HealthData["probes"]): ServiceStatus {
  const statuses = Object.values(probes).map((p) => p.status);
  if (statuses.some((s) => s === "down")) return "down";
  if (statuses.some((s) => s === "degraded")) return "degraded";
  return "operational";
}

function mapServiceStatusToHealthStatus(status: ServiceStatus): "healthy" | "degraded" | "down" {
  if (status === "operational") return "healthy";
  return status;
}

async function writeHealthSnapshot(probes: HealthData["probes"]): Promise<void> {
  const { db } = getFirebaseServices();
  const dateStr = getTodayDateString();
  const overall = deriveOverallStatus(probes);
  const healthStatus = mapServiceStatusToHealthStatus(overall);

  const services: Record<string, { status: string; latencyMs?: number }> = {};
  for (const [key, probe] of Object.entries(probes)) {
    services[key] = {
      status: probe.status,
      ...(probe.latencyMs !== undefined ? { latencyMs: probe.latencyMs } : {}),
    };
  }

  await setDoc(doc(db, "platformHealthSnapshots", dateStr), {
    date: dateStr,
    status: healthStatus,
    services,
    checkedAt: new Date(),
  });
}

export async function runHealthChecks(): Promise<HealthData> {
  const { db } = getFirebaseServices();
  const auth = getAuth();

  let firestoreResult: ProbeResult;
  let tenants: Tenant[] = [];
  const fsStart = performance.now();
  try {
    const snap = await getDocs(query(collection(db, "tenants"), fsLimit(50)));
    const latencyMs = Math.round(performance.now() - fsStart);
    tenants = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Tenant);
    firestoreResult = { status: "operational", latencyMs };
  } catch {
    const latencyMs = Math.round(performance.now() - fsStart);
    firestoreResult = { status: "down", latencyMs, detail: "Firestore unavailable" };
  }

  const authResult: ProbeResult =
    auth.currentUser !== null
      ? { status: "operational" }
      : { status: "degraded", detail: "No authenticated user" };

  let functionsResult: ProbeResult;
  try {
    await callSaveTenant({ data: {} });
    functionsResult = { status: "operational" };
  } catch (err: unknown) {
    const code =
      (typeof err === "object" && err !== null && "code" in err
        ? (err as Record<string, string>).code
        : "") ?? "";
    if (
      code === "functions/unavailable" ||
      code === "functions/internal" ||
      !code.startsWith("functions/")
    ) {
      functionsResult = { status: "down", detail: `Functions endpoint unreachable (${code})` };
    } else {
      functionsResult = { status: "operational" };
    }
  }

  const aiActive = tenants.some((t) => t.settings?.geminiKeySet === true);
  const aiResult: ProbeResult =
    firestoreResult.status === "down"
      ? { status: "down", detail: "Cannot reach Firestore" }
      : aiActive
        ? { status: "operational" }
        : { status: "degraded", detail: "No tenants with AI configured" };

  const totalUsers = tenants.reduce(
    (sum, t) => sum + (t.stats?.totalStudents ?? 0) + (t.stats?.totalTeachers ?? 0),
    0
  );
  const activeTenants = tenants.filter((t) => t.status === "active").length;

  const probes = {
    auth: authResult,
    firestore: firestoreResult,
    functions: functionsResult,
    aiPipeline: aiResult,
  };

  // Write snapshot to Firestore on each manual health check (non-critical).
  try {
    await writeHealthSnapshot(probes);
  } catch {
    // Don't fail the health check if the snapshot write fails.
  }

  return {
    probes,
    metrics: {
      avgResponseMs: firestoreResult.latencyMs ?? null,
      totalUsers: tenants.length > 0 ? totalUsers : null,
      activeTenants: tenants.length > 0 ? activeTenants : null,
    },
    checkedAt: new Date().toLocaleTimeString(),
  };
}

/**
 * 30-day health history + 24h error count. NOTE: useHealthSummary() returns a
 * single `{ snapshot }`, NOT the multi-day history + errorCount the page needs,
 * so we reuse the platform-scoped getSummary wrapper here (shared-services).
 */
export async function fetchHealthHistory(): Promise<HealthSummaryResponse> {
  const result = await callGetPlatformSummary({ scope: "health" });
  return result.healthSummary ?? { snapshots: [], errorCount24h: 0 };
}

// ===========================================================================
// LLMUsagePage — cross-tenant platform LLM usage roll-up
// (GAP: useCostSummary() is claim-tenant-scoped; no platform-wide per-tenant cost)
// ===========================================================================

export interface PlatformLlmRange {
  label: string;
  start: string;
  end: string;
}

export interface TenantCostData {
  tenantId: string;
  tenantName: string;
  tenantCode: string;
  status: string;
  totalCost: number;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  budgetLimitUsd?: number;
  budgetUsedPercent?: number;
}

export interface PlatformLlmUsage {
  month: string;
  platformTotalCost: number;
  platformTotalCalls: number;
  platformTotalInput: number;
  platformTotalOutput: number;
  tenantCosts: TenantCostData[];
  dailyTrend: Array<{ date: string; cost: number; calls: number; label: string }>;
  byPurpose: Array<{ name: string; calls: number; costUsd: number }>;
  activeTenants: number;
}

export async function getPlatformLlmUsage(range: PlatformLlmRange): Promise<PlatformLlmUsage> {
  const { db } = getFirebaseServices();

  const tenantsSnap = await getDocs(collection(db, "tenants"));
  const tenants = tenantsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Tenant);

  // U2.4+5 cutover: the direct `dailyCostSummaries` read was rules-denied AND
  // off-canon (U3.3: ONE `costSummaries` collection, `daily_*` ids). The v1
  // `getCostSummary` callable reads the canonical store; `tenantOverride` is the
  // sanctioned super-admin cross-tenant path.
  const { api } = getSdk();
  const tenantCostResults = await Promise.all(
    tenants.map(async (tenant) => {
      try {
        const res = await api.analytics.getCostSummary({
          granularity: "daily",
          range: {
            from: `${range.start}T00:00:00.000Z`,
            to: `${range.end}T23:59:59.999Z`,
          },
          tenantOverride: tenant.id,
        });
        const days = (res.summaries as DailyCostSummary[])
          .filter((s): s is DailyCostSummary => "date" in s)
          .sort((a, b) => b.date.localeCompare(a.date));
        return { tenant, days };
      } catch {
        // A tenant with no summaries (or a transient read failure) contributes
        // zero rather than sinking the whole platform roll-up.
        return { tenant, days: [] as DailyCostSummary[] };
      }
    })
  );

  const tenantCosts: TenantCostData[] = [];
  const allDailyCosts: DailyCostSummary[] = [];
  const byPurposeAgg: Record<string, { calls: number; costUsd: number }> = {};

  for (const { tenant, days } of tenantCostResults) {
    const totalCost = days.reduce((s, d) => s + d.totalCostUsd, 0);
    const totalCalls = days.reduce((s, d) => s + d.totalCalls, 0);
    const totalInputTokens = days.reduce((s, d) => s + d.totalInputTokens, 0);
    const totalOutputTokens = days.reduce((s, d) => s + d.totalOutputTokens, 0);

    for (const day of days) {
      if (day.byPurpose) {
        for (const [purpose, data] of Object.entries(day.byPurpose)) {
          if (!byPurposeAgg[purpose]) {
            byPurposeAgg[purpose] = { calls: 0, costUsd: 0 };
          }
          byPurposeAgg[purpose].calls += data.calls;
          byPurposeAgg[purpose].costUsd += data.costUsd;
        }
      }
    }

    allDailyCosts.push(...days);

    if (totalCost > 0 || totalCalls > 0) {
      const budgetLimit = days[0]?.budgetLimitUsd;
      tenantCosts.push({
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantCode: tenant.tenantCode,
        status: tenant.status,
        totalCost,
        totalCalls,
        totalInputTokens,
        totalOutputTokens,
        budgetLimitUsd: budgetLimit,
        budgetUsedPercent: budgetLimit ? Math.round((totalCost / budgetLimit) * 100) : undefined,
      });
    }
  }

  tenantCosts.sort((a, b) => b.totalCost - a.totalCost);

  const dailyMap = new Map<string, { date: string; cost: number; calls: number }>();
  for (const d of allDailyCosts) {
    const existing = dailyMap.get(d.date);
    if (existing) {
      existing.cost += d.totalCostUsd;
      existing.calls += d.totalCalls;
    } else {
      dailyMap.set(d.date, { date: d.date, cost: d.totalCostUsd, calls: d.totalCalls });
    }
  }
  const dailyTrend = Array.from(dailyMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      ...d,
      label: d.date.slice(5),
      cost: Math.round(d.cost * 100) / 100,
    }));

  const platformTotalCost = tenantCosts.reduce((s, t) => s + t.totalCost, 0);
  const platformTotalCalls = tenantCosts.reduce((s, t) => s + t.totalCalls, 0);
  const platformTotalInput = tenantCosts.reduce((s, t) => s + t.totalInputTokens, 0);
  const platformTotalOutput = tenantCosts.reduce((s, t) => s + t.totalOutputTokens, 0);

  const byPurpose = Object.entries(byPurposeAgg)
    .map(([name, data]) => ({ name, ...data, costUsd: Math.round(data.costUsd * 100) / 100 }))
    .sort((a, b) => b.costUsd - a.costUsd);

  return {
    month: range.label,
    platformTotalCost,
    platformTotalCalls,
    platformTotalInput,
    platformTotalOutput,
    tenantCosts,
    dailyTrend,
    byPurpose,
    activeTenants: tenantCosts.length,
  };
}
