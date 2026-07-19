/**
 * FIX-1 P0-B — gateway-level image resolution. Locks that a `{ storagePath }`
 * image ref on `AiRequest` reaches the PROVIDER as real inline base64 bytes
 * resolved through the injected `imageStore` (never the path string), that a
 * missing store fails loudly (and is audit-logged), and that the retired
 * `gemini-1.5-*` generation is no longer any template's default model.
 */
import { describe, it, expect, vi } from "vitest";
import { createAiGateway, type AiCallContext } from "../gateway.js";
import { createSecretResolver } from "../secrets/secret-manager.js";
import { isAiGatewayError } from "../errors.js";
import { PROMPTS } from "../prompts/registry.js";
import { resolveModelDefaults } from "../models.js";
import type { AiRepos } from "../repos-seam.js";
import type { AiImageStore } from "../images/image-store.js";
import type { ProviderInput } from "../provider/provider.js";
import type { TenantId, UserId } from "@levelup/domain";

const NOW = "2026-06-20T10:00:00.000Z";
const PAGE_BYTES = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PAGE_B64 = Buffer.from(PAGE_BYTES).toString("base64");

function makeRepos(): AiRepos & { logged: { status: string }[] } {
  const logged: { status: string }[] = [];
  const base: AiRepos = {
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
        logged.push({ status: p.status });
        return { ...p, id: "log_1" as never, createdAt: NOW as never } as never;
      },
      async sumCostUsd() {
        return 0;
      },
      async countCalls() {
        return 0;
      },
    },
  };
  return Object.assign(base, { logged });
}

const ctx: AiCallContext = {
  tenantId: "t_1" as TenantId,
  uid: "u_1" as UserId,
  role: "teacher",
  resourceType: "exam",
  resourceId: "e_1",
  now: () => NOW,
};

const secretResolver = createSecretResolver({ env: { LEVELUP_AI_KEY: "k" } as never });

function makeProvider() {
  const inputs: ProviderInput[] = [];
  return {
    inputs,
    provider: {
      name: "gemini" as const,
      call: vi.fn(async (input: ProviderInput) => {
        inputs.push(input);
        return {
          text: "[]",
          json: [],
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: input.model,
        };
      }),
    },
  };
}

const imageStore: AiImageStore = {
  async read(path: string) {
    return { bytes: PAGE_BYTES, contentType: path.endsWith(".png") ? "image/png" : "image/jpeg" };
  },
};

describe("gateway image resolution (P0-B)", () => {
  it("resolves { storagePath } refs to REAL inline base64 before the provider call", async () => {
    const { provider, inputs } = makeProvider();
    const gw = createAiGateway({
      repos: makeRepos(),
      secretResolver,
      providerFactory: () => provider,
      imageStore,
    });

    await gw.generate(
      {
        purpose: "question_extraction",
        operation: "questions.extract",
        promptKey: "questionExtraction",
        variables: { examTitle: "Midterm", examType: "standard", mode: "full" },
        images: [{ storagePath: "v2_tenants/t_1/exams/e_1/paper/p1.png" }],
        responseSchema: { type: "array" },
      },
      ctx
    );

    expect(inputs).toHaveLength(1);
    const sent = inputs[0]!.images!;
    expect(sent).toHaveLength(1);
    expect(sent[0]!.base64).toBe(PAGE_B64);
    expect(sent[0]!.base64).not.toContain("v2_tenants"); // never the raw path
    expect(sent[0]!.mimeType).toBe("image/png");
  });

  it("fails loudly (PRECONDITION_FAILED) and audit-logs when no imageStore is wired", async () => {
    const repos = makeRepos();
    const { provider } = makeProvider();
    const gw = createAiGateway({ repos, secretResolver, providerFactory: () => provider });

    await expect(
      gw.generate(
        {
          purpose: "question_extraction",
          operation: "questions.extract",
          promptKey: "questionExtraction",
          variables: { examTitle: "Midterm", examType: "standard", mode: "full" },
          images: [{ storagePath: "some/path.jpg" }],
          responseSchema: { type: "array" },
        },
        ctx
      )
    ).rejects.toSatisfy((e: unknown) => isAiGatewayError(e) && e.code === "PRECONDITION_FAILED");

    expect(provider.call).not.toHaveBeenCalled();
    expect(repos.logged).toEqual([{ status: "error" }]); // failure is audited
  });

  it("still passes pre-encoded { base64 } refs through untouched (no store needed)", async () => {
    const { provider, inputs } = makeProvider();
    const gw = createAiGateway({
      repos: makeRepos(),
      secretResolver,
      providerFactory: () => provider,
    });
    await gw.generate(
      {
        purpose: "answer_grading",
        operation: "grade.ai",
        promptKey: "answerGrading",
        variables: { question: "q", maxMarks: 5, rubric: "r", answer: "a" },
        images: [{ base64: "aGVsbG8=", mimeType: "image/jpeg" }],
        responseSchema: { type: "object" },
      },
      ctx
    );
    expect(inputs[0]!.images).toEqual([{ base64: "aGVsbG8=", mimeType: "image/jpeg" }]);
  });
});

describe("model defaults (retired-generation regression)", () => {
  it("no prompt template defaults to the RETIRED gemini-1.5-* generation", () => {
    for (const [key, t] of Object.entries(PROMPTS)) {
      expect(t.defaultModel, `PROMPTS.${key}.defaultModel`).not.toMatch(/^gemini-1\.5/);
    }
  });

  it("resolveModelDefaults: env overrides win, else current supported defaults", () => {
    expect(resolveModelDefaults({})).toEqual({
      pro: "gemini-3.1-pro-preview",
      flash: "gemini-3.5-flash",
    });
    expect(
      resolveModelDefaults({ LEVELUP_AI_MODEL_PRO: "gemini-9-pro", LEVELUP_AI_MODEL_FLASH: "x" })
    ).toEqual({ pro: "gemini-9-pro", flash: "x" });
  });
});
