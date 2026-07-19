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
  cachedInputTokens?: number;
  reasoningTokens?: number;
  toolTokens?: number;
  imageTokens?: number;
  source?: "provider" | "estimated" | "unavailable";
}

export interface CostBreakdown {
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
  model: string;
  pricingVersion: string;
  pricingFallback: boolean;
}

interface ModelPricing {
  /** USD per 1,000,000 input tokens. */
  inputPerMillion: number;
  /** USD per 1,000,000 output tokens. */
  outputPerMillion: number;
}

/** Per-1M-token USD pricing. Conservative public list prices. */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Current defaults (models.ts): ≤200k-prompt tier list prices.
  "gemini-3.1-pro-preview": { inputPerMillion: 2.0, outputPerMillion: 12.0 },
  "gemini-3.5-flash": { inputPerMillion: 0.75, outputPerMillion: 4.5 },
  // Prior defaults retained for historical cost re-estimation of old call logs.
  "gemini-2.5-pro": { inputPerMillion: 1.25, outputPerMillion: 10.0 },
  "gemini-2.5-flash": { inputPerMillion: 0.3, outputPerMillion: 2.5 },
  "gemini-2.5-flash-lite": { inputPerMillion: 0.1, outputPerMillion: 0.4 },
  // Retired generations kept for historical cost re-estimation of old call logs.
  "gemini-1.5-pro": { inputPerMillion: 1.25, outputPerMillion: 5.0 },
  "gemini-1.5-flash": { inputPerMillion: 0.075, outputPerMillion: 0.3 },
  "gemini-1.5-flash-8b": { inputPerMillion: 0.0375, outputPerMillion: 0.15 },
  "gemini-2.0-flash": { inputPerMillion: 0.1, outputPerMillion: 0.4 },
};

/** Conservative fallback when a model isn't in the table (never bills as free). */
const FALLBACK_PRICING: ModelPricing = { inputPerMillion: 1.25, outputPerMillion: 5.0 };
export const PRICING_VERSION = "gemini-public-2026-07-18";

export function buildTokenUsage(usage: ProviderTokenUsage): TokenUsage {
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens || usage.inputTokens + usage.outputTokens,
    ...(usage.cachedInputTokens !== undefined
      ? { cachedInputTokens: usage.cachedInputTokens }
      : {}),
    ...(usage.reasoningTokens !== undefined ? { reasoningTokens: usage.reasoningTokens } : {}),
    ...(usage.toolTokens !== undefined ? { toolTokens: usage.toolTokens } : {}),
    ...(usage.imageTokens !== undefined ? { imageTokens: usage.imageTokens } : {}),
    source: usage.source ?? "provider",
  };
}

export function estimateCost(usage: TokenUsage, model: string): CostBreakdown {
  const knownPricing = MODEL_PRICING[model];
  const pricing = knownPricing ?? FALLBACK_PRICING;
  const inputCostUsd = (usage.inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCostUsd = (usage.outputTokens / 1_000_000) * pricing.outputPerMillion;
  return {
    inputCostUsd,
    outputCostUsd,
    totalCostUsd: inputCostUsd + outputCostUsd,
    model,
    pricingVersion: PRICING_VERSION,
    pricingFallback: knownPricing === undefined,
  };
}
