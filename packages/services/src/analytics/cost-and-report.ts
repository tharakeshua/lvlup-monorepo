/**
 * `aggregateDailyCostService`, `dismissInsightService`, `generateReportService`
 * (analytics.md §"services/server"). Cost roll-up is delta-based + idempotent and
 * emits an `ai_budget_alert` on 80%/100% breach. `dismissInsight` is the ONLY
 * client-facing write in this domain. `generateReport` is a server-authoritative
 * PDF artifact (1h signed URL).
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize } from "@levelup/access";
import type { AuthContext, SystemContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import { enqueueOutboxEvent } from "../shared/side-effects.js";
import { xrepos } from "../shared/extended-repos.js";

const COST_DAILY = "costDaily";
const COST_MONTHLY = "costMonthly";
const INSIGHT = "insight";

export interface AggregateDailyCostInput {
  tenantId: string;
  date: string; // YYYY-MM-DD
}

/**
 * Delta-based `increment(new-old)` idempotent monthly roll-up; emits
 * `ai_budget_alert` (outbox) on 80%/100% budget breach (fixes the silent warn).
 */
export async function aggregateDailyCostService(
  input: AggregateDailyCostInput,
  ctx: SystemContext
): Promise<void> {
  const { tenantId, date } = input;
  const now = ctx.now();
  const month = date.slice(0, 7);

  // Read the day's LlmCallLog rows (written by @levelup/ai), aggregate by purpose/model.
  const logs = (
    await ctx.repos.tenants.list(tenantId, {
      filter: (d) => d["_kind"] === "llmCallLog" && String(d["createdAt"]).slice(0, 10) === date,
      limit: 1000,
    })
  ).items;

  const totalCostUsd = logs.reduce(
    (sum, l) => sum + ((l["costUSD"] as number | undefined) ?? 0),
    0
  );
  const totalInputTokens = logs.reduce((s, l) => s + ((l["inputTokens"] as number) ?? 0), 0);
  const totalOutputTokens = logs.reduce((s, l) => s + ((l["outputTokens"] as number) ?? 0), 0);

  // Daily doc (idempotent overwrite).
  const dailyId = `${COST_DAILY}_${date}`;
  const prevDaily = await ctx.repos.tenants.get(tenantId, dailyId);
  const prevCost = (prevDaily?.["totalCostUsd"] as number | undefined) ?? 0;
  await ctx.repos.tenants.upsert(
    tenantId,
    {
      id: dailyId,
      _kind: COST_DAILY,
      date,
      totalCalls: logs.length,
      totalInputTokens,
      totalOutputTokens,
      totalCostUsd,
      computedAt: now,
    },
    now
  );

  // Monthly roll-up by delta.
  const monthlyId = `${COST_MONTHLY}_${month}`;
  const prevMonthly = await ctx.repos.tenants.get(tenantId, monthlyId);
  const monthlyCost =
    ((prevMonthly?.["totalCostUsd"] as number | undefined) ?? 0) + (totalCostUsd - prevCost);
  const budget = (prevMonthly?.["budgetLimitUsd"] as number | undefined) ?? 0;
  const usedPct = budget > 0 ? (monthlyCost / budget) * 100 : 0;
  await ctx.repos.tenants.upsert(
    tenantId,
    {
      id: monthlyId,
      _kind: COST_MONTHLY,
      month,
      totalCostUsd: monthlyCost,
      budgetLimitUsd: budget,
      budgetUsedPercent: usedPct,
      computedAt: now,
    },
    now
  );

  // Budget-alert on breach (outbox — not a silent warn).
  const alreadySent = (prevMonthly?.["budgetAlertSent"] as boolean | undefined) ?? false;
  if (budget > 0 && usedPct >= 80 && !alreadySent) {
    await ctx.repos.tenants.upsert(
      tenantId,
      { id: monthlyId, _kind: COST_MONTHLY, budgetAlertSent: true },
      now
    );
    await ctx.repos.tx(async (tx) => {
      enqueueOutboxEvent(tx, {
        type: "ai.budget.alert",
        tenantId,
        payload: { month, usedPct, breach: usedPct >= 100 ? "hard" : "soft" },
        createdAt: now,
      });
    });
  }
}

// ---- dismissInsight (the ONLY client write) ----
export async function dismissInsightService(
  input: ReqOf<"v1.analytics.dismissInsight">,
  ctx: AuthContext
): Promise<ResOf<"v1.analytics.dismissInsight">> {
  const tenantId = requireTenant(ctx);
  const insight = await findInsight(ctx, tenantId, input.insightId);
  if (!insight) fail("NOT_FOUND", `insight ${input.insightId} not found`);

  const studentId = insight["studentId"] as string;
  // owner (student-self) or parent-of
  const allowed =
    (ctx.role === "student" && ctx.entityIds.studentId === studentId) ||
    (ctx.role === "parent" && ctx.studentIds.includes(studentId)) ||
    ctx.isSuperAdmin;
  if (!allowed) {
    authorize(ctx, "summary.read", { studentId, tenantId }); // throws if not permitted
  }

  const dismissedAt = ctx.now();
  // Insights live in the dedicated `insights` collection (the real adapter); write
  // the dismiss flag there. Keep the generic-store write for the in-memory twin.
  if (insight["_source"] === "dedicated") {
    await xrepos(ctx).analyticsInsights.upsert(
      tenantId,
      { id: insight["id"], dismissed: true, dismissedAt },
      dismissedAt
    );
  } else {
    await ctx.repos.tenants.upsert(
      tenantId,
      { id: insight["id"], _kind: INSIGHT, dismissedAt },
      dismissedAt
    );
  }
  return { id: input.insightId, dismissedAt } as ResOf<"v1.analytics.dismissInsight">;
}

// ---- generateReport (server-authoritative PDF) ----
const REPORT_TTL_MS = 60 * 60 * 1000;

interface SignReportHook {
  renderAndSign(
    type: string,
    refs: { examId?: string; studentId?: string; classId?: string },
    tenantId: string,
    ttlMs: number
  ): Promise<string>;
}

export async function generateReportService(
  input: ReqOf<"v1.analytics.generateReport">,
  ctx: AuthContext
): Promise<ResOf<"v1.analytics.generateReport">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "report.generate", {
    examId: input.examId,
    studentId: input.studentId,
    classId: input.classId,
    tenantId,
  });

  const hook = (ctx as unknown as { reports?: SignReportHook }).reports;
  const refs = { examId: input.examId, studentId: input.studentId, classId: input.classId };
  const pdfUrl = hook
    ? await hook.renderAndSign(input.type, refs, tenantId, REPORT_TTL_MS)
    : `https://storage.local/tenants/${tenantId}/reports/${input.type}-${Date.now()}.pdf`;

  const expiresMs = Date.parse(ctx.now()) + REPORT_TTL_MS;
  const expiresAt = new Date(
    Number.isNaN(expiresMs) ? Date.now() + REPORT_TTL_MS : expiresMs
  ).toISOString();
  return { pdfUrl, expiresAt } as ResOf<"v1.analytics.generateReport">;
}

async function findInsight(
  ctx: AuthContext,
  tenantId: string,
  insightId: string
): Promise<Record<string, unknown> | null> {
  // Dedicated `insights` collection first (the real adapter); tag the source so the
  // dismiss write targets the same place.
  const dedicated = await xrepos(ctx).analyticsInsights.get(tenantId, insightId);
  if (dedicated) return { ...dedicated, _source: "dedicated" };
  const direct = await ctx.repos.tenants.get(tenantId, insightId);
  if (direct && direct["_kind"] === INSIGHT) return direct;
  const page = await ctx.repos.tenants.list(tenantId, {
    filter: (d) => d["_kind"] === INSIGHT && d["id"] === insightId,
    limit: 1,
  });
  return page.items[0] ?? null;
}
