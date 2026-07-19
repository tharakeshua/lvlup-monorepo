/**
 * AI-gateway RESULT-shape adapter (the single sanctioned wiring seam, extracted
 * from `bootstrap.ts` so it can be unit-pinned).
 *
 * WHY THIS EXISTS (Issue3 root cause): `@levelup/services` consumes the gateway
 * through its OWN structural seam (`services/src/shared/ai.ts` `AiGenerateResult`),
 * whose fields are `{ text, json, tokensUsed, costUsd, model }` — every service
 * reads `ai.json` (+ `ai.costUsd` / `ai.tokensUsed`). The concrete `@levelup/ai`
 * gateway returns `AiResponse = { data, text, tokenUsage:{totalTokens},
 * cost:{totalCostUsd}, model }`. These two shapes were NEVER reconciled: the
 * `as unknown as` cast at the wiring boundary silences the divergence, so with no
 * adapter `ai.json` is ALWAYS `undefined` and every AI-graded answer (and autograde
 * grade, and chat token count) collapses to a zeroed/empty result.
 *
 * The cast has NO compile guard — a refactor can silently drop or rename any field
 * mapping and typecheck clean. `__tests__/ai-seam.adapter.test.ts` pins the FULL
 * mapping so a regression here goes red instead of silently zeroing every grade.
 */
import type { AiResponse } from "@levelup/ai";

/** The result shape `@levelup/services` reads (mirror of `services/src/shared/ai.ts` `AiGenerateResult`). */
export interface AiSeamResult {
  text: string;
  /** Parsed structured output — services read THIS (`ai.json`), NOT the gateway's `data`. */
  json: unknown;
  /** Tool invocations the model requested (chat agents; absent when none). */
  toolCalls?: { callId: string; name: string; args: Record<string, unknown> }[];
  tokensUsed: number;
  costUsd: number;
  model: string;
  /** Correlates continuation steps with the gateway's telemetry ledger. */
  requestId?: string;
  /** Full usage metadata; `cachedInputTokens` is needed for turn-level attribution. */
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cachedInputTokens?: number;
    reasoningTokens?: number;
    toolTokens?: number;
    imageTokens?: number;
    source?: "provider" | "estimated" | "unavailable";
  };
  /** Full server-calculated cost metadata, retained for server-side aggregation only. */
  cost?: {
    inputCostUsd: number;
    outputCostUsd: number;
    totalCostUsd: number;
    currency: string;
    pricingVersion?: string;
    pricingFallback?: boolean;
  };
  moderation?: { input: string[]; output: string[] };
}

/** The minimal generate() surface services call (mirror of `services/src/shared/ai.ts` `AiGateway`). */
export interface AiSeamGateway {
  generate(req: unknown, ctx: unknown): Promise<AiSeamResult>;
}

/**
 * Pure RESULT adapter: real `@levelup/ai` `AiResponse` → services `AiGenerateResult`.
 * The `?? 0` fallbacks match the concrete gateway's optional-at-runtime usage/cost.
 */
export function adaptAiResult(res: AiResponse): AiSeamResult {
  return {
    text: res.text,
    json: res.data,
    ...(res.toolCalls && res.toolCalls.length > 0
      ? { toolCalls: adaptToolCalls(res.toolCalls) }
      : {}),
    tokensUsed: res.tokenUsage?.totalTokens ?? 0,
    costUsd: res.cost?.totalCostUsd ?? 0,
    model: res.model,
    ...(res.requestId !== undefined ? { requestId: res.requestId } : {}),
    ...(res.tokenUsage !== undefined ? { tokenUsage: res.tokenUsage } : {}),
    ...(res.cost !== undefined ? { cost: adaptCost(res.cost) } : {}),
    ...(res.moderation !== undefined ? { moderation: res.moderation } : {}),
  };
}

/**
 * The installed workspace declaration can lag the source package during local
 * development. New concrete gateway responses always carry `callId`; preserve
 * it verbatim, with a deterministic compatibility ID only for an old deployed
 * response that predates typed tool continuation.
 */
function adaptToolCalls(
  calls: readonly { name: string; args: Record<string, unknown> }[]
): AiSeamResult["toolCalls"] {
  return calls.map((call, index) => {
    const candidate = call as unknown as { callId?: unknown };
    return {
      callId:
        typeof candidate.callId === "string" && candidate.callId.length > 0
          ? candidate.callId
          : `legacy-tool-call:${index}:${call.name}`,
      name: call.name,
      args: call.args,
    };
  });
}

function adaptCost(cost: NonNullable<AiResponse["cost"]>): NonNullable<AiSeamResult["cost"]> {
  const candidate = cost as unknown as {
    currency?: unknown;
    pricingVersion?: unknown;
    pricingFallback?: unknown;
  };
  return {
    inputCostUsd: cost.inputCostUsd,
    outputCostUsd: cost.outputCostUsd,
    totalCostUsd: cost.totalCostUsd,
    // Cost is USD throughout @levelup/ai. Older workspace declarations did not
    // include the explicit property, so retain the invariant at the seam.
    currency: typeof candidate.currency === "string" ? candidate.currency : "USD",
    ...(typeof candidate.pricingVersion === "string"
      ? { pricingVersion: candidate.pricingVersion }
      : {}),
    ...(typeof candidate.pricingFallback === "boolean"
      ? { pricingFallback: candidate.pricingFallback }
      : {}),
  };
}

/**
 * Wrap a concrete `@levelup/ai` gateway so its result satisfies the services seam.
 * This is the value `bootstrap.ts` injects as `ctx.ai`.
 */
export function makeAiSeam(ai: {
  generate: (req: unknown, ctx: unknown) => Promise<AiResponse>;
}): AiSeamGateway {
  return {
    async generate(req, callCtx) {
      const res = await ai.generate(req, callCtx);
      return adaptAiResult(res);
    },
  };
}
