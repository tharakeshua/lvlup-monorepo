/**
 * Cost estimation (server-shared.md §4.4). All AI cost is SERVER-computed and
 * audited — never trusted from the client (REVIEW §6 AI row). Pricing is per-1M
 * tokens (USD) by model; unknown models fall back to a conservative default so a
 * new model never bills as free.
 */
import type { ProviderTokenUsage } from "../provider/provider.js";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface CostBreakdown {
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
  model: string;
}

interface ModelPricing {
  /** USD per 1,000,000 input tokens. */
  inputPerMillion: number;
  /** USD per 1,000,000 output tokens. */
  outputPerMillion: number;
}

/** Per-1M-token USD pricing. Conservative public list prices. */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  "gemini-1.5-pro": { inputPerMillion: 1.25, outputPerMillion: 5.0 },
  "gemini-1.5-flash": { inputPerMillion: 0.075, outputPerMillion: 0.3 },
  "gemini-1.5-flash-8b": { inputPerMillion: 0.0375, outputPerMillion: 0.15 },
  "gemini-2.0-flash": { inputPerMillion: 0.1, outputPerMillion: 0.4 },
};

/** Conservative fallback when a model isn't in the table (never bills as free). */
const FALLBACK_PRICING: ModelPricing = { inputPerMillion: 1.25, outputPerMillion: 5.0 };

export function buildTokenUsage(usage: ProviderTokenUsage): TokenUsage {
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens || usage.inputTokens + usage.outputTokens,
  };
}

export function estimateCost(usage: TokenUsage, model: string): CostBreakdown {
  const pricing = MODEL_PRICING[model] ?? FALLBACK_PRICING;
  const inputCostUsd = (usage.inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCostUsd = (usage.outputTokens / 1_000_000) * pricing.outputPerMillion;
  return {
    inputCostUsd,
    outputCostUsd,
    totalCostUsd: inputCostUsd + outputCostUsd,
    model,
  };
}
