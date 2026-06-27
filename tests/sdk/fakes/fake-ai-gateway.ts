/**
 * Fake `AiGateway` (testability.md T6) — deterministic LLM gateway for service
 * unit tests. Services call `ctx.ai.generate(...)`; they never construct a
 * provider or read a Secret Manager key (server-shared.md §4 / §6 AI row).
 *
 * Capabilities:
 *   • DETERMINISTIC `generate()` — returns a canned completion (registered by
 *     prompt key, or a default echo), so grading/extraction/insight services are
 *     reproducible.
 *   • ALWAYS logs a cost record (T-#12: `ctx.ai.generate` always logs a cost
 *     record), surfaced via `costLog` for assertion.
 *   • QUOTA gate: `setQuotaExceeded(true)` makes `generate()` throw
 *     `QUOTA_EXCEEDED` (T-#12: blocked when checkUsageQuota fails).
 *   • Records every call ({ promptKey, input }) for assertion.
 */

export interface AiGenerateInput {
  promptKey?: string;
  prompt?: string;
  input?: unknown;
  [k: string]: unknown;
}

export interface AiGenerateResult {
  text: string;
  json?: unknown;
  tokensUsed: number;
  costUsd: number;
  model: string;
}

export interface CostRecord {
  promptKey: string;
  tokensUsed: number;
  costUsd: number;
  model: string;
  at: string;
}

export interface FakeAiGateway {
  generate(input: AiGenerateInput): Promise<AiGenerateResult>;

  // ---- Test controls ----
  /** Register a canned completion for a prompt key (value or input→result fn). */
  onGenerate(
    promptKey: string,
    responder: Partial<AiGenerateResult> | ((input: AiGenerateInput) => Partial<AiGenerateResult>)
  ): FakeAiGateway;
  /** Toggle the quota gate; when true `generate()` throws QUOTA_EXCEEDED. */
  setQuotaExceeded(v: boolean): FakeAiGateway;
  readonly calls: AiGenerateInput[];
  readonly costLog: CostRecord[];
  reset(): void;
}

export interface FakeAiOptions {
  now?: () => string;
  defaultModel?: string;
}

export function createFakeAiGateway(opts: FakeAiOptions = {}): FakeAiGateway {
  const now = opts.now ?? (() => new Date().toISOString());
  const model = opts.defaultModel ?? "fake-gemini-1.5";
  const responders = new Map<
    string,
    Partial<AiGenerateResult> | ((input: AiGenerateInput) => Partial<AiGenerateResult>)
  >();
  const calls: AiGenerateInput[] = [];
  const costLog: CostRecord[] = [];
  let quotaExceeded = false;

  const gateway: FakeAiGateway = {
    async generate(input) {
      calls.push(input);
      if (quotaExceeded) {
        const err = new Error("QUOTA_EXCEEDED");
        (err as { code?: string }).code = "QUOTA_EXCEEDED";
        throw err;
      }
      const key = input.promptKey ?? "default";
      const responder = responders.get(key);
      const resolved = typeof responder === "function" ? responder(input) : responder;
      const result: AiGenerateResult = {
        text:
          resolved?.text ?? `[fake:${key}] ${JSON.stringify(input.input ?? input.prompt ?? "")}`,
        json: resolved?.json,
        tokensUsed: resolved?.tokensUsed ?? 42,
        costUsd: resolved?.costUsd ?? 0.0001,
        model: resolved?.model ?? model,
      };
      // ALWAYS log cost (invariant #12).
      costLog.push({
        promptKey: key,
        tokensUsed: result.tokensUsed,
        costUsd: result.costUsd,
        model: result.model,
        at: now(),
      });
      return result;
    },

    onGenerate(promptKey, responder) {
      responders.set(promptKey, responder);
      return gateway;
    },
    setQuotaExceeded(v) {
      quotaExceeded = v;
      return gateway;
    },
    get calls() {
      return calls;
    },
    get costLog() {
      return costLog;
    },
    reset() {
      responders.clear();
      calls.length = 0;
      costLog.length = 0;
      quotaExceeded = false;
    },
  };

  return gateway;
}
