/**
 * `costRepo` — admin AI-cost read + shaping (SDK-LAYERS-PLAN §4.1,
 * analytics.md §costRepo).
 *
 * Cost summaries are server-aggregated (⚷ — `@levelup/ai` writes `LlmCallLog`,
 * the analytics aggregators roll them into `costSummaries/{daily|monthly}/{id}`).
 * This repo only READS via `getCostSummary` and flattens the bounded record-maps
 * (`byPurpose`/`byModel`) into chart rows + a budget band — all derived,
 * computed once, no wire call.
 *
 * Per-entity repo — imports `api` + `@levelup/domain` ONLY; never a sibling repo
 * (R6).
 */
import type { CostBucket, DailyCostSummary, MonthlyCostSummary } from "@levelup/domain";
import type { ApiClient, CostRange, GetCostSummaryResponse } from "./api-types.js";

/** A flattened cost record-map row for charting. */
export interface CostRow {
  key: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

/** Budget band derived from `budgetUsedPercent` (80% warn / 100% over). */
export type BudgetBand = "ok" | "warning" | "over" | "unknown";
export interface BudgetStatus {
  band: BudgetBand;
  usedPercent?: number;
  limitUsd?: number;
  alertSent: boolean;
}

type AnyCostSummary = DailyCostSummary | MonthlyCostSummary;

export interface CostRepo {
  /** Daily summaries — a single `date` or a `range` (server filters). */
  listDaily(filter: { date?: string; range?: CostRange }): Promise<DailyCostSummary[]>;
  /** Monthly summaries — a single `month` or a `range`. */
  listMonthly(filter: { month?: string; range?: CostRange }): Promise<MonthlyCostSummary[]>;
  /** Flatten `byPurpose` into chart rows (derived). */
  computeByPurposeRows(summary: AnyCostSummary): CostRow[];
  /** Flatten `byModel` into chart rows (derived). */
  computeByModelRows(summary: AnyCostSummary): CostRow[];
  /** Derive the 80%/100% budget band once (derived). */
  computeBudgetStatus(summary: AnyCostSummary): BudgetStatus;
}

function flatten(map: Record<string, CostBucket>): CostRow[] {
  return Object.entries(map).map(([key, b]) => ({
    key,
    calls: b.calls,
    inputTokens: b.inputTokens,
    outputTokens: b.outputTokens,
    costUsd: b.costUsd,
  }));
}

export function createCostRepo(api: ApiClient): CostRepo {
  return {
    listDaily: async (filter) => {
      const res: GetCostSummaryResponse = await api.analytics.getCostSummary({
        granularity: "daily",
        ...(filter.date !== undefined ? { date: filter.date } : {}),
        ...(filter.range !== undefined ? { range: filter.range } : {}),
      });
      return res.summaries as DailyCostSummary[];
    },

    listMonthly: async (filter) => {
      const res: GetCostSummaryResponse = await api.analytics.getCostSummary({
        granularity: "monthly",
        ...(filter.month !== undefined ? { month: filter.month } : {}),
        ...(filter.range !== undefined ? { range: filter.range } : {}),
      });
      return res.summaries as MonthlyCostSummary[];
    },

    computeByPurposeRows: (summary) => flatten(summary.byPurpose),

    computeByModelRows: (summary) => flatten(summary.byModel),

    computeBudgetStatus: (summary) => {
      const usedPercent = summary.budgetUsedPercent;
      let band: BudgetBand = "unknown";
      if (typeof usedPercent === "number") {
        band = usedPercent >= 100 ? "over" : usedPercent >= 80 ? "warning" : "ok";
      }
      return {
        band,
        ...(usedPercent !== undefined ? { usedPercent } : {}),
        ...(summary.budgetLimitUsd !== undefined ? { limitUsd: summary.budgetLimitUsd } : {}),
        alertSent: summary.budgetAlertSent === true,
      };
    },
  };
}
