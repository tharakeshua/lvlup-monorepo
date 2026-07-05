/**
 * The AI gateway seam (server-shared.md §4.2). Services call `ctx.ai.generate(...)`
 * — they NEVER construct a provider or read a Secret Manager key. One `generate()`
 * call runs the full server-authoritative sequence:
 *
 *   moderate(input) → checkUsageQuota → isCircuitOpen guard → getApiKey →
 *   provider.call (with retry) → recordSuccess/Failure → estimateCost → logLLMCall
 *
 * All AI cost is server-computed and audited (REVIEW §6 AI row). The gateway is
 * the single consumer of providers, secrets, cost, quota, circuit-breaker, prompts
 * and moderation; nothing below it is exported to clients.
 */
import type { TenantId, UserId, ExamId, SpaceId, JsonValue } from "@levelup/domain";
import type { AiRepos } from "./repos-seam.js";
import { PROMPTS, renderPrompt, type AiPurpose, type PromptKey } from "./prompts/registry.js";
import type { LLMProvider } from "./provider/provider.js";
import { createGeminiProvider } from "./provider/gemini.js";
import { resolveImages, type AiImageRef, type AiImageStore } from "./images/image-store.js";
import { createSecretResolver, type SecretResolver } from "./secrets/secret-manager.js";
import { checkUsageQuota } from "./cost/usage-quota.js";
import {
  buildTokenUsage,
  estimateCost,
  type CostBreakdown,
  type TokenUsage,
} from "./cost/cost-tracker.js";
import { logLLMCall } from "./cost/llm-logger.js";
import {
  classifyError,
  createCircuitBreaker,
  type CircuitBreaker,
} from "./reliability/fallback-handler.js";
import { withRetry } from "./reliability/retry.js";
import { moderateText, type ModerationCategory } from "./moderation/moderation.js";
import { aiDisabled, providerFailed, isAiGatewayError } from "./errors.js";

// ---------------------------------------------------------------------------
// Public seam types (what services see)
// ---------------------------------------------------------------------------

export interface AiRequest {
  purpose: AiPurpose;
  /** Operation label for the audit log, e.g. 'relmsEvaluation'. */
  operation: string;
  promptKey: PromptKey;
  variables: Record<string, JsonValue>;
  /**
   * Vision inputs. Services pass STORAGE PATHS (`{ storagePath }`); the gateway
   * resolves them to inline base64 via the injected `imageStore` right before
   * the provider call (bytes never transit the services layer). Pre-encoded
   * `{ base64, mimeType }` refs pass through untouched.
   */
  images?: AiImageRef[];
  /** JSON Schema for structured output. */
  responseSchema?: unknown;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** When true, free-text input/output is moderated (default for ai_chat). */
  moderate?: boolean;
}

export interface AiCallContext {
  tenantId: TenantId;
  uid: UserId;
  role: string;
  resourceType: string;
  resourceId: string;
  /** Injected clock (ISO). Defaults to wall-clock when omitted. */
  now?: () => string;
  /** Optional rollup correlation ids written to the call log. */
  examId?: ExamId;
  spaceId?: SpaceId;
}

export interface AiResponse<T = unknown> {
  data: T;
  /** Raw text completion (always present). */
  text: string;
  tokenUsage: TokenUsage;
  cost: CostBreakdown;
  model: string;
  moderation?: { input: ModerationCategory[]; output: ModerationCategory[] };
}

export interface AiGateway {
  /** One call: resolves per-tenant key, checks quota, runs provider, logs cost, applies circuit breaker. */
  generate<T = unknown>(req: AiRequest, ctx: AiCallContext): Promise<AiResponse<T>>;
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export interface CreateAiGatewayDeps {
  repos: AiRepos;
  projectId?: string;
  /** Inject a provider factory (tests) keyed by api-key; defaults to Gemini. */
  providerFactory?: (apiKey: string, model?: string) => LLMProvider;
  /** Inject a secret resolver (tests); defaults to GCP Secret Manager. */
  secretResolver?: SecretResolver;
  /** Inject a circuit breaker (tests). */
  circuitBreaker?: CircuitBreaker;
  /** Retry attempts for transient provider failures. */
  maxRetries?: number;
  /**
   * Storage-read seam for `{ storagePath }` image refs (composition root wraps
   * the Admin SDK bucket; tests inject a fake). When absent, a request carrying
   * storage-path images fails with a clear PRECONDITION_FAILED.
   */
  imageStore?: AiImageStore;
  /** Override the summed raw-byte inline-image budget (default 14MB). */
  maxTotalImageBytes?: number;
}

export function createAiGateway(deps: CreateAiGatewayDeps): AiGateway {
  const repos = deps.repos;
  const secretResolver = deps.secretResolver ?? createSecretResolver({ projectId: deps.projectId });
  const circuit = deps.circuitBreaker ?? createCircuitBreaker();
  const providerFactory =
    deps.providerFactory ??
    ((apiKey: string, model?: string) => createGeminiProvider(apiKey, { defaultModel: model }));
  const maxRetries = deps.maxRetries ?? 3;

  return {
    async generate<T = unknown>(req: AiRequest, ctx: AiCallContext): Promise<AiResponse<T>> {
      const nowIso = (ctx.now ?? (() => new Date().toISOString()))();
      const template = PROMPTS[req.promptKey];
      const model = req.model ?? template.defaultModel;
      const circuitKey = `${ctx.tenantId}:${model}`;

      // (1) MODERATE free-text input (default-on for chat).
      const shouldModerate = req.moderate ?? template.purpose === "ai_chat";
      let inputCategories: ModerationCategory[] = [];
      if (shouldModerate) {
        const raw = JSON.stringify(req.variables);
        const m = moderateText(raw);
        inputCategories = m.categories;
        if (!m.allowed) {
          throw aiDisabled("Input blocked by content moderation", {
            tenantId: ctx.tenantId,
            categories: m.categories,
          });
        }
      }

      // (2) HARD quota pre-check (monthly budget + daily cap).
      await checkUsageQuota(repos, ctx.tenantId, nowIso);

      // (3) Circuit-breaker guard.
      if (circuit.isCircuitOpen(circuitKey)) {
        throw providerFailed("AI provider circuit is open", {
          retryable: true,
          meta: { tenantId: ctx.tenantId, model },
        });
      }

      // (4) Resolve the per-tenant key (Secret Manager / env override).
      const apiKey = await secretResolver.getApiKey(ctx.tenantId);
      const provider = providerFactory(apiKey, model);

      const { system, user } = renderPrompt(req.promptKey, req.variables);
      const startedAt = Date.now();

      let providerOut: Awaited<ReturnType<LLMProvider["call"]>> | undefined;
      try {
        // Resolve `{ storagePath }` refs → inline base64 (P0-B seam). Inside the
        // try so a storage-read/budget failure is audit-logged like any other
        // failed call; resolution is NOT inside withRetry (one download pass).
        const images = await resolveImages(req.images, {
          ...(deps.imageStore !== undefined ? { store: deps.imageStore } : {}),
          ...(deps.maxTotalImageBytes !== undefined
            ? { maxTotalBytes: deps.maxTotalImageBytes }
            : {}),
        });
        providerOut = await withRetry(
          () =>
            provider.call({
              model,
              system,
              user,
              images,
              ...(req.temperature !== undefined
                ? { temperature: req.temperature }
                : { temperature: template.defaultTemperature }),
              ...(req.maxTokens !== undefined ? { maxTokens: req.maxTokens } : {}),
              ...(req.responseSchema !== undefined ? { responseSchema: req.responseSchema } : {}),
            }),
          {
            maxAttempts: maxRetries,
            isRetryable: (e) => classifyError(e) === "transient",
          }
        );
        circuit.recordSuccess(circuitKey);
      } catch (err) {
        if (classifyError(err) === "transient") circuit.recordFailure(circuitKey);
        const latencyMs = Date.now() - startedAt;
        // Audit the failed call (best-effort).
        await safeLogFailure(repos, ctx, req, model, latencyMs, err);
        if (isAiGatewayError(err)) throw err;
        throw providerFailed("AI provider call failed", {
          retryable: classifyError(err) === "transient",
          meta: { tenantId: ctx.tenantId, model, operation: req.operation },
          cause: err,
        });
      }

      const latencyMs = Date.now() - startedAt;
      const usage = buildTokenUsage(providerOut.usage);
      const cost = estimateCost(usage, providerOut.model);

      // (5) Moderate model OUTPUT for chat (never block the learner mid-flow,
      //     but record + redact).
      let outputCategories: ModerationCategory[] = [];
      if (shouldModerate) {
        outputCategories = moderateText(providerOut.text).categories;
      }

      // (6) Audit-log the successful call (cost-rollup source).
      await logLLMCall(repos, {
        tenantId: ctx.tenantId,
        functionName: req.operation,
        model: providerOut.model,
        usage,
        cost,
        latencyMs,
        status: "success",
        userId: ctx.uid,
        ...(ctx.examId !== undefined ? { examId: ctx.examId } : {}),
        ...(ctx.spaceId !== undefined ? { spaceId: ctx.spaceId } : {}),
      });

      const data = template.structured
        ? (providerOut.json as T)
        : (providerOut.text as unknown as T);

      return {
        data,
        text: providerOut.text,
        tokenUsage: usage,
        cost,
        model: providerOut.model,
        ...(shouldModerate
          ? { moderation: { input: inputCategories, output: outputCategories } }
          : {}),
      };
    },
  };
}

async function safeLogFailure(
  repos: AiRepos,
  ctx: AiCallContext,
  req: AiRequest,
  model: string,
  latencyMs: number,
  err: unknown
): Promise<void> {
  const zeroUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  try {
    await logLLMCall(repos, {
      tenantId: ctx.tenantId,
      functionName: req.operation,
      model,
      usage: zeroUsage,
      cost: estimateCost(zeroUsage, model),
      latencyMs,
      status: "error",
      errorMessage: String((err as { message?: string })?.message ?? err),
      userId: ctx.uid,
      ...(ctx.examId !== undefined ? { examId: ctx.examId } : {}),
      ...(ctx.spaceId !== undefined ? { spaceId: ctx.spaceId } : {}),
    });
  } catch {
    // Audit failure must not mask the original provider error.
  }
}
