/**
 * The narrow slice of the `@levelup/repository-admin` `Repos` handle that the AI
 * gateway needs. `@levelup/ai` is NOT permitted to import `firebase-admin` (only
 * the admin adapter is) — so cost/quota reads + the `LlmCallLog` write go through
 * `ctx.repos.*` (server-shared.md §4.4 "Direct-Firestore note").
 *
 * The real `Repos` from `@levelup/repository-admin` is a structural superset of
 * this; services pass the same `ctx.repos` they already hold. Declaring the slice
 * locally keeps this package decoupled from the concurrently-built admin adapter
 * while still typechecking today.
 */
import type { TenantId, LlmCallLog, DailyCostSummary, MonthlyCostSummary } from "@levelup/domain";

/** Per-tenant AI usage budget config, read off the tenant doc. */
export interface TenantUsageConfig {
  /** Hard monthly spend cap in USD (0/undefined ⇒ plan default applies). */
  monthlyBudgetUsd?: number;
  /** Hard daily LLM-call cap (0/undefined ⇒ plan default applies). */
  dailyCallCap?: number;
  /** When false the gateway refuses every call (FEATURE_DISABLED). */
  aiEnabled?: boolean;
  /** Whether the tenant supplies its own Gemini key (BYO-key) vs platform key. */
  hasOwnGeminiKey?: boolean;
}

/** Read side of the tenant doc the quota gate consults. */
export interface TenantsReadRepo {
  getUsageConfig(tenantId: TenantId): Promise<TenantUsageConfig | null>;
}

export interface LogLlmCallParams {
  tenantId: TenantId;
  functionName: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUSD: number;
  latencyMs: number;
  status: "success" | "error";
  errorMessage?: string;
  userId?: string;
  examId?: string;
  spaceId?: string;
}

/** Write/read side for LLM call audit logs (the cost-rollup source). */
export interface LlmRepo {
  /** Append-only audit write of a single LLM call. */
  log(params: LogLlmCallParams): Promise<LlmCallLog>;
  /** Sum of `costUSD` across this tenant's calls within [from,to) ISO window. */
  sumCostUsd(tenantId: TenantId, fromIso: string, toIso: string): Promise<number>;
  /** Count of calls for this tenant within [from,to) ISO window. */
  countCalls(tenantId: TenantId, fromIso: string, toIso: string): Promise<number>;
}

/** Read side of the materialized cost summaries (fast-path quota check). */
export interface CostSummariesReadRepo {
  daily(tenantId: TenantId, dateYyyyMmDd: string): Promise<DailyCostSummary | null>;
  monthly(tenantId: TenantId, monthYyyyMm: string): Promise<MonthlyCostSummary | null>;
}

/** The minimal `Repos` slice `createAiGateway` depends on. */
export interface AiRepos {
  tenants: TenantsReadRepo;
  llm: LlmRepo;
  costSummaries: CostSummariesReadRepo;
}
