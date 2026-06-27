/**
 * `checkUsageQuota` — the HARD pre-check before any provider call
 * (server-shared.md §4.4, REVIEW §6 AI row: "quota a hard pre-check"). Enforces
 * a per-tenant monthly USD budget and a daily call cap. Cost/quota stays
 * server-enforced regardless of whose key it is (platform key vs tenant BYO-key).
 *
 * Fast path reads the materialized `costSummaries/{daily|monthly}` docs; if a
 * summary is missing (not yet aggregated today) it falls back to summing the raw
 * `llmCallLogs` for the window. On breach it throws `QUOTA_EXCEEDED` (an
 * `AiGatewayError`, mapped to `HttpsError` by functions-shared).
 */
import type { TenantId } from "@levelup/domain";
import type { AiRepos } from "../repos-seam.js";
import { aiDisabled, quotaExceeded } from "../errors.js";

/** Plan defaults applied when the tenant doc doesn't set explicit caps. */
export const DEFAULT_MONTHLY_BUDGET_USD = 100;
export const DEFAULT_DAILY_CALL_CAP = 5000;

export interface QuotaCheckResult {
  allowed: true;
  monthlyBudgetUsd: number;
  monthlySpendUsd: number;
  dailyCallCap: number;
  dailyCalls: number;
}

function dayBounds(nowIso: string): { dateYmd: string; dayStart: string; dayEnd: string } {
  const d = new Date(nowIso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const dateYmd = `${y}-${m}-${day}`;
  const dayStart = `${dateYmd}T00:00:00.000Z`;
  const nextDay = new Date(Date.UTC(y, d.getUTCMonth(), d.getUTCDate() + 1));
  return { dateYmd, dayStart, dayEnd: nextDay.toISOString() };
}

function monthBounds(nowIso: string): { monthYm: string; monthStart: string; monthEnd: string } {
  const d = new Date(nowIso);
  const y = d.getUTCFullYear();
  const mIdx = d.getUTCMonth();
  const monthYm = `${y}-${String(mIdx + 1).padStart(2, "0")}`;
  const monthStart = `${monthYm}-01T00:00:00.000Z`;
  const monthEnd = new Date(Date.UTC(y, mIdx + 1, 1)).toISOString();
  return { monthYm, monthStart, monthEnd };
}

export async function checkUsageQuota(
  repos: AiRepos,
  tenantId: TenantId,
  nowIso: string
): Promise<QuotaCheckResult> {
  const cfg = await repos.tenants.getUsageConfig(tenantId);
  if (cfg?.aiEnabled === false) {
    throw aiDisabled("AI is disabled for this tenant", { tenantId });
  }

  const monthlyBudgetUsd =
    cfg?.monthlyBudgetUsd && cfg.monthlyBudgetUsd > 0
      ? cfg.monthlyBudgetUsd
      : DEFAULT_MONTHLY_BUDGET_USD;
  const dailyCallCap =
    cfg?.dailyCallCap && cfg.dailyCallCap > 0 ? cfg.dailyCallCap : DEFAULT_DAILY_CALL_CAP;

  // ---- Monthly spend (summary fast-path → raw fallback) ----
  const { monthYm, monthStart, monthEnd } = monthBounds(nowIso);
  const monthlySummary = await repos.costSummaries.monthly(tenantId, monthYm);
  const monthlySpendUsd =
    monthlySummary?.totalCostUsd ?? (await repos.llm.sumCostUsd(tenantId, monthStart, monthEnd));

  if (monthlySpendUsd >= monthlyBudgetUsd) {
    throw quotaExceeded("Monthly AI budget exceeded", {
      tenantId,
      monthlyBudgetUsd,
      monthlySpendUsd,
    });
  }

  // ---- Daily call count (summary fast-path → raw fallback) ----
  const { dateYmd, dayStart, dayEnd } = dayBounds(nowIso);
  const dailySummary = await repos.costSummaries.daily(tenantId, dateYmd);
  const dailyCalls =
    dailySummary?.totalCalls ?? (await repos.llm.countCalls(tenantId, dayStart, dayEnd));

  if (dailyCalls >= dailyCallCap) {
    throw quotaExceeded("Daily AI call cap exceeded", { tenantId, dailyCallCap, dailyCalls });
  }

  return { allowed: true, monthlyBudgetUsd, monthlySpendUsd, dailyCallCap, dailyCalls };
}
