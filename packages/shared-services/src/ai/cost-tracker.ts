/**
 * Cost Tracker — Token counting and USD cost estimation for Gemini models.
 *
 * Pricing is maintained as a lookup table; add new models as they become available.
 */

// Pricing per 1M tokens in USD (as of Feb 2026)
interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

// Conservative fallback for unknown models (uses mid-tier pricing to avoid undercounting)
const FALLBACK_PRICING: ModelPricing = { inputPer1M: 1.25, outputPer1M: 5.0 };

const MODEL_PRICING: Record<string, ModelPricing> = {
  "gemini-2.5-flash": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "gemini-2.5-flash-lite": { inputPer1M: 0.075, outputPer1M: 0.3 },
  "gemini-2.5-pro": { inputPer1M: 1.25, outputPer1M: 5.0 },
  "gemini-2.0-flash": { inputPer1M: 0.1, outputPer1M: 0.4 },
  "gemini-2.0-flash-lite": { inputPer1M: 0.075, outputPer1M: 0.3 },
  "gemini-1.5-flash": { inputPer1M: 0.075, outputPer1M: 0.3 },
  "gemini-1.5-pro": { inputPer1M: 1.25, outputPer1M: 5.0 },
};

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface CostBreakdown {
  input: number;
  output: number;
  total: number;
  currency: "USD";
}

/**
 * Estimate the USD cost for a given model and token usage.
 */
export function estimateCost(model: string, tokens: TokenUsage): CostBreakdown {
  let pricing = MODEL_PRICING[model];
  if (!pricing) {
    // Unknown model — use a conservative fallback pricing tier to avoid undercounting
    console.error(
      `[CostTracker] Unknown model "${model}"; using fallback pricing. Add this model to MODEL_PRICING.`
    );
    pricing = FALLBACK_PRICING;
  }

  const inputCost = (tokens.input / 1_000_000) * pricing.inputPer1M;
  const outputCost = (tokens.output / 1_000_000) * pricing.outputPer1M;

  return {
    input: parseFloat(inputCost.toFixed(8)),
    output: parseFloat(outputCost.toFixed(8)),
    total: parseFloat((inputCost + outputCost).toFixed(8)),
    currency: "USD",
  };
}

/**
 * Build a TokenUsage object from raw counts reported by the Gemini API.
 */
export function buildTokenUsage(inputTokens: number, outputTokens: number): TokenUsage {
  return {
    input: inputTokens,
    output: outputTokens,
    total: inputTokens + outputTokens,
  };
}

/**
 * Estimate additional tokens consumed by image inputs.
 * Gemini charges ~258 tokens for images up to 384x384px, scaling with resolution.
 * A typical exam page image (1000x1500) ≈ 1000-2000 tokens.
 */
export function estimateImageTokens(imageSizeBytes: number): number {
  // Rough heuristic: ~1 token per 750 bytes of base64-decoded image data
  // Based on Gemini's image tokenization (258 base + resolution scaling)
  const BASE_TOKENS = 258;
  const TOKENS_PER_KB = 1.3;
  const sizeKB = imageSizeBytes / 1024;
  return Math.ceil(BASE_TOKENS + sizeKB * TOKENS_PER_KB);
}

/**
 * Return the list of models that have pricing configured.
 */
export function getSupportedModels(): string[] {
  return Object.keys(MODEL_PRICING);
}
