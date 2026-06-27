/**
 * Analytics scheduler services (analytics.md §"Schedulers"). Thin over the
 * server-only services; idempotent. `(input, ctx: SystemContext) => Promise<void>`.
 *   - dailyCostAggregation (5 0 * * *): delta-based monthly roll-up + budget alert.
 *   - nightlyAtRiskDetection (0 2 * * *): paginated; sets flags only (notify via the
 *     milestone path).
 *   - generateInsights (30 2 * * *): per student; fixed 5-active cap.
 */
import type { SystemContext } from "../../shared/context.js";
import { aggregateDailyCostService } from "../cost-and-report.js";
import { detectAtRiskService, generateInsightsService } from "../recompute.js";
import { generateInsightsForStudent, type InsightContext } from "../rules.js";

export interface SchedulerTenantInput {
  tenantId: string;
}

/** Daily cost aggregation for a tenant (the scheduler fans out per tenant). */
export async function dailyCostAggregationService(
  input: SchedulerTenantInput,
  ctx: SystemContext
): Promise<void> {
  const date = ctx.now().slice(0, 10);
  await aggregateDailyCostService({ tenantId: input.tenantId, date }, ctx);
}

/** Nightly at-risk detection — paginated 500/page; sets flags only. */
export async function nightlyAtRiskDetectionService(
  input: SchedulerTenantInput,
  ctx: SystemContext
): Promise<void> {
  let cursor: string | undefined;
  do {
    const page = await ctx.repos.tenants.list(input.tenantId, {
      filter: (d) => d["_kind"] === "studentSummary",
      cursor,
      limit: 500,
    });
    if (page.items.length > 0) {
      await detectAtRiskService({ tenantId: input.tenantId, summaries: page.items }, ctx);
    }
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
}

/** Per-student insight generation — fixed 5-active cap + deterministic deletes. */
export async function generateInsightsScheduler(
  input: SchedulerTenantInput,
  ctx: SystemContext
): Promise<void> {
  let cursor: string | undefined;
  do {
    const page = await ctx.repos.tenants.list(input.tenantId, {
      filter: (d) => d["_kind"] === "studentSummary",
      cursor,
      limit: 200,
    });
    for (const summary of page.items) {
      const ctxIn = buildInsightContext(summary);
      const seeds = generateInsightsForStudent(ctxIn);
      if (seeds.length > 0) {
        await generateInsightsService(
          { tenantId: input.tenantId, studentId: summary["studentId"] as string, seeds },
          ctx
        );
      }
    }
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
}

function buildInsightContext(summary: Record<string, unknown>): InsightContext {
  const levelup = summary["levelup"] as Record<string, unknown> | undefined;
  return {
    weakTopics: (summary["weaknessAreas"] as { id: string; title: string; score: number }[]) ?? [],
    upcomingExams: [],
    streakDays: (levelup?.["streakDays"] as number | undefined) ?? 0,
    improved: false,
    isAtRisk: (summary["isAtRisk"] as boolean | undefined) ?? false,
  };
}
