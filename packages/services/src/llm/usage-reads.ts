/**
 * LLM usage read service — thin stub for Supabase-backed tenant/user rollups.
 * @see docs/llm-tracking/LLM-TRACKING-FRAMEWORK-PLAN.md
 */
import type { AuthContext } from "../shared/context.js";
import { ServiceError } from "../shared/context.js";

export interface LlmUsageRange {
  from: string;
  to: string;
}

export interface TenantLlmUsageSummary {
  tenantId: string;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  byPurpose: Record<string, { calls: number; costUsd: number }>;
  byUser: Array<{ userId: string; displayName?: string; calls: number; costUsd: number }>;
}

export interface UserLlmUsageSummary {
  userId: string;
  tenantId: string;
  totalCalls: number;
  totalCostUsd: number;
  byFeature: Record<string, { calls: number; costUsd: number }>;
}

function notConfigured(): never {
  throw new ServiceError(
    "NOT_CONFIGURED",
    "Supabase LLM usage reads are not wired yet — see docs/llm-tracking/LLM-TRACKING-FRAMEWORK-PLAN.md"
  );
}

export async function getTenantLlmUsage(
  _range: LlmUsageRange,
  _ctx: AuthContext
): Promise<TenantLlmUsageSummary> {
  notConfigured();
}

export async function getUserLlmUsage(
  _userId: string,
  _range: LlmUsageRange,
  _ctx: AuthContext
): Promise<UserLlmUsageSummary> {
  notConfigured();
}

export async function getPlatformLlmUsage(
  _range: LlmUsageRange,
  _ctx: AuthContext
): Promise<{
  platformTotalCost: number;
  platformTotalCalls: number;
  tenantCosts: Array<{ tenantId: string; totalCost: number; totalCalls: number }>;
}> {
  notConfigured();
}
