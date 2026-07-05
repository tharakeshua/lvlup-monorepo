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
  tokensUsed: number;
  costUsd: number;
  model: string;
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
    tokensUsed: res.tokenUsage?.totalTokens ?? 0,
    costUsd: res.cost?.totalCostUsd ?? 0,
    model: res.model,
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
