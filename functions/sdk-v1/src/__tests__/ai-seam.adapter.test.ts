/**
 * REGRESSION (Issue3 — "AI-based questions are not working"). Pins the RESULT-shape
 * adapter that `bootstrap.ts` installs (`makeAiSeam` / `adaptAiResult` in
 * `src/ai-seam.ts`).
 *
 * The bug: `@levelup/services` reads `ai.json` / `ai.costUsd` / `ai.tokensUsed`,
 * but the concrete `@levelup/ai` gateway returns `{ data, cost:{totalCostUsd},
 * tokenUsage:{totalTokens} }`. The `as unknown as PortAiGateway` cast at the wiring
 * boundary silences the divergence — with NO adapter (or a regressed one) `ai.json`
 * is `undefined` at runtime and every AI-graded answer collapses to score:0/empty.
 * There is NO compile guard on the mapping, so this test is the guard: it FAILS if
 * `data → json` (or usage/cost/model) is dropped or renamed.
 */
import { describe, it, expect } from "vitest";
import { adaptAiResult, makeAiSeam } from "../ai-seam.js";

/** A raw `@levelup/ai` `AiResponse` as the concrete gateway returns it. */
function fakeGatewayResult() {
  return {
    data: { score: 7, feedback: "well reasoned", correctness: 0.7 },
    text: '{"score":7}',
    tokenUsage: {
      inputTokens: 120,
      outputTokens: 40,
      cachedInputTokens: 12,
      totalTokens: 160,
      source: "provider" as const,
    },
    cost: {
      inputCostUsd: 0.001,
      outputCostUsd: 0.002,
      totalCostUsd: 0.003,
      currency: "USD",
      pricingVersion: "2026-07-18",
    },
    model: "gemini-2.0-flash",
    requestId: "gateway-request-1",
    moderation: { input: ["prompt_injection"], output: [] },
  };
}

describe("AI seam adapter (bootstrap res.data → services ai.json)", () => {
  it("maps the FULL result shape: data→json, tokenUsage.totalTokens→tokensUsed, cost.totalCostUsd→costUsd, text/model pass through", () => {
    const raw = fakeGatewayResult();
    const out = adaptAiResult(raw as never);

    // The load-bearing mapping — services read `ai.json`, NOT the gateway's `data`.
    expect(out.json).toBe(raw.data);
    expect(out.json).toEqual({ score: 7, feedback: "well reasoned", correctness: 0.7 });

    // The rest of the seam services depend on.
    expect(out.text).toBe('{"score":7}');
    expect(out.tokensUsed).toBe(160);
    expect(out.costUsd).toBe(0.003);
    expect(out.model).toBe("gemini-2.0-flash");

    // Metadata parity for continuation causation / cached-token aggregation.
    expect(out.requestId).toBe("gateway-request-1");
    expect(out.tokenUsage).toEqual(raw.tokenUsage);
    expect(out.tokenUsage?.cachedInputTokens).toBe(12);
    expect(out.cost).toEqual(raw.cost);
    expect(out.moderation).toEqual(raw.moderation);

    // The adapted object exposes exactly the services-seam keys (no stray `data`).
    expect(Object.keys(out).sort()).toEqual([
      "cost",
      "costUsd",
      "json",
      "model",
      "moderation",
      "requestId",
      "text",
      "tokenUsage",
      "tokensUsed",
    ]);
    expect("data" in out).toBe(false);
  });

  it("json carries the structured payload verbatim (a NON-undefined value — the exact Issue3 symptom)", () => {
    const out = adaptAiResult(fakeGatewayResult() as never);
    expect(out.json).not.toBeUndefined();
    expect((out.json as { score: number }).score).toBe(7);
  });

  it("passes toolCalls through when present; omits the key entirely when absent", () => {
    const withCalls = adaptAiResult({
      ...fakeGatewayResult(),
      toolCalls: [
        {
          callId: "gemini:call-1",
          name: "record_observation",
          args: { dimensionId: "clarity" },
        },
      ],
    } as never);
    expect(withCalls.toolCalls).toEqual([
      {
        callId: "gemini:call-1",
        name: "record_observation",
        args: { dimensionId: "clarity" },
      },
    ]);

    const without = adaptAiResult(fakeGatewayResult() as never);
    expect("toolCalls" in without).toBe(false);
  });

  it("defaults usage/cost to 0 when the gateway omits them (never NaN/undefined)", () => {
    const out = adaptAiResult({
      data: { ok: true },
      text: "raw",
      model: "m",
    } as never);
    expect(out.tokensUsed).toBe(0);
    expect(out.costUsd).toBe(0);
    expect(out.json).toEqual({ ok: true });
  });

  it("makeAiSeam wraps a concrete gateway so generate() returns the adapted shape", async () => {
    const raw = fakeGatewayResult();
    let seenReq: unknown;
    let seenCtx: unknown;
    const fakeGateway = {
      async generate(req: unknown, ctx: unknown) {
        seenReq = req;
        seenCtx = ctx;
        return raw;
      },
    };
    const seam = makeAiSeam(fakeGateway as never);
    const req = { promptKey: "evaluator", operation: "grade" };
    const ctx = { tenantId: "t1", uid: "u1" };
    const out = await seam.generate(req, ctx);

    // req/ctx pass through untouched to the concrete gateway...
    expect(seenReq).toBe(req);
    expect(seenCtx).toBe(ctx);
    // ...and the result is the adapted (data→json) shape services consume.
    expect(out.json).toBe(raw.data);
    expect(out.tokensUsed).toBe(160);
    expect(out.costUsd).toBe(0.003);
    expect(out.model).toBe("gemini-2.0-flash");
    expect(out.requestId).toBe("gateway-request-1");
    expect(out.tokenUsage?.cachedInputTokens).toBe(12);
    expect(out.moderation).toEqual(raw.moderation);
  });
});
