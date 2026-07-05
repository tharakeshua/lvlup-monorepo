/**
 * REGRESSION (Issue3 — "AI-based questions are not working"). Proves the AI
 * evaluation path returns a REAL score + feedback end-to-end through the CONCRETE
 * `@levelup/ai` gateway (stub provider — no network), not just the `FakeAiGateway`.
 *
 * The production bug: `@levelup/services` reads `ai.json` / `ai.costUsd` /
 * `ai.tokensUsed`, but the real gateway returns `{ data, cost:{totalCostUsd},
 * tokenUsage:{totalTokens} }`. The `as unknown as` cast in
 * `functions/sdk-v1/src/bootstrap.ts` hid the divergence, so `ai.json` was ALWAYS
 * `undefined` and every AI-graded answer collapsed to score:0/empty. The existing
 * unit suite never caught it because it injects `FakeAiGateway` (which returns
 * `.json`) and the only emulator test uses a deterministic key-matched short
 * answer that never reaches the gateway.
 *
 * This test reproduces the REAL wiring: real `createAiGateway` + stub provider,
 * wrapped by the SAME result-shape adapter bootstrap now installs, and asserts a
 * non-zero score with feedback. It fails against the pre-fix code (raw gateway,
 * no responseSchema).
 */
import { describe, it, expect } from "vitest";
import { createAiGateway, createStubProvider, type AiRepos } from "@levelup/ai";
import { makeAuthContext } from "../../../../tests/sdk/harness/auth-context";
import { localSeedId } from "../../../../tests/sdk/harness/fixtures-ids";
import { makeItem } from "../../../../tests/sdk/fakes/entity-factories";
import { evaluateAnswerService } from "../index";

// Minimal AiRepos slice for the real gateway (quota always-open, cost log captured).
function makeAiRepos(): AiRepos & { logged: unknown[] } {
  const logged: unknown[] = [];
  const repos: AiRepos = {
    tenants: {
      async getUsageConfig() {
        return { aiEnabled: true, monthlyBudgetUsd: 100, dailyCallCap: 100 };
      },
    },
    costSummaries: {
      async daily() {
        return null;
      },
      async monthly() {
        return null;
      },
    },
    llm: {
      async log(p) {
        logged.push(p);
        return { ...p, id: "log_1", createdAt: "2026-06-20T10:00:00.000Z" } as never;
      },
      async sumCostUsd() {
        return 0;
      },
      async countCalls() {
        return 0;
      },
    },
  };
  return Object.assign(repos, { logged });
}

/** The bootstrap.ts result-shape adapter: real AiResponse → services seam. */
function adaptGateway(ai: ReturnType<typeof createAiGateway>) {
  return {
    async generate(req: unknown, callCtx: unknown) {
      const res = await ai.generate(
        req as Parameters<typeof ai.generate>[0],
        callCtx as Parameters<typeof ai.generate>[1]
      );
      return {
        text: res.text,
        json: res.data,
        tokensUsed: res.tokenUsage?.totalTokens ?? 0,
        costUsd: res.cost?.totalCostUsd ?? 0,
        model: res.model,
      };
    },
  };
}

describe("AI evaluation seam (real gateway + stub provider)", () => {
  it("evaluateAnswer returns a REAL non-zero score + feedback for a subjective item", async () => {
    const ctx = makeAuthContext("student") as unknown as {
      tenantId: string;
      repos: { items: { upsert: (t: string, i: unknown, n: string) => Promise<unknown> } };
      now: () => string;
      ai: unknown;
    };

    // Swap the FakeAiGateway for the CONCRETE gateway (stub provider) + adapter —
    // the exact runtime wiring bootstrap.ts installs in prod/emulator.
    const gateway = createAiGateway({
      repos: makeAiRepos(),
      providerFactory: (apiKey, model) => createStubProvider(apiKey, model),
      secretResolver: { getApiKey: async () => "stub-key", invalidate: () => {} },
    });
    ctx.ai = adaptGateway(gateway);

    // Subjective item → routes through the AI grader (not deterministic/key path).
    await ctx.repos.items.upsert(
      ctx.tenantId,
      makeItem({ type: "long_answer", maxScore: 10 }),
      ctx.now()
    );

    const res = (await evaluateAnswerService(
      {
        spaceId: localSeedId("space", "dsa"),
        storyPointId: localSeedId("sp", "arrays"),
        itemId: localSeedId("item", "arrays.q1"),
        answer: "A thorough well-reasoned answer.",
      },
      ctx as never
    )) as { evaluation: { score: number; percentage: number; correctness: number } };

    // BEFORE the fix: score/percentage/correctness were all 0 (ai.json undefined).
    expect(res.evaluation.score).toBeGreaterThan(0);
    expect(res.evaluation.maxScore ?? 10).toBeGreaterThan(0);
    expect(res.evaluation.percentage).toBeGreaterThan(0);
  });
});
