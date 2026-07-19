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
import { randomUUID } from "node:crypto";
import type { TenantId, UserId, ExamId, SpaceId, JsonValue } from "@levelup/domain";
import type { AiRepos } from "./repos-seam.js";
import { PROMPTS, renderPrompt, type AiPurpose, type PromptKey } from "./prompts/registry.js";
import type {
  LLMProvider,
  ProviderImage,
  ProviderMessage,
  ProviderToolCall,
  ProviderToolDecl,
} from "./provider/provider.js";
import { createGeminiProvider } from "./provider/gemini.js";
import { resolveImages, type AiImageRef, type AiImageStore } from "./images/image-store.js";
import {
  resolveModelPolicy,
  validateProviderModel,
  type ModelPolicyId,
  type ResolvedModelPolicy,
} from "./models.js";
import {
  createSecretResolver,
  createUserSecretResolver,
  type SecretResolver,
  type UserSecretResolver,
} from "./secrets/secret-manager.js";
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
import {
  canonicalPurpose,
  defaultFeature,
  type CanonicalTokenUsage,
  type LlmAttemptRecord,
  type LlmAttemptCost,
  type LlmFeature,
  type LlmRequestFinalization,
  type LlmRequestRecord,
  type LlmTelemetrySink,
  type LlmTelemetryWriteError,
  type LlmUsageContext,
  type SanitizedLlmError,
} from "./telemetry/types.js";

// ---------------------------------------------------------------------------
// Public seam types (what services see)
// ---------------------------------------------------------------------------

export type AiDeveloperTextPart = {
  type: "text";
  text: string;
  provenance: "agent_config";
};

export type AiUserTextPart = {
  type: "text";
  text: string;
  provenance: "learner" | "trusted_context";
};

export type AiAssistantTextPart = {
  type: "text";
  text: string;
  provenance: "model_output";
};

export type AiImagePart = { type: "image"; image: AiImageRef };

export type AiToolCallPart = {
  type: "tool_call";
  callId: string;
  name: string;
  args: Record<string, unknown>;
};

export type AiToolResultPart = {
  type: "tool_result";
  callId: string;
  name: string;
  result: JsonValue;
};

/**
 * Role-preserving model history. The gateway validates and forwards these parts
 * without flattening function calls/results into a pseudo-user prompt.
 */
export type AiMessage =
  | { role: "developer"; parts: AiDeveloperTextPart[] }
  | { role: "user"; parts: Array<AiUserTextPart | AiImagePart> }
  | { role: "assistant"; parts: Array<AiAssistantTextPart | AiToolCallPart> }
  | { role: "tool"; parts: AiToolResultPart[] };

export interface AiRequest {
  purpose?: AiPurpose;
  /** Operation label for the audit log, e.g. 'relmsEvaluation'. */
  operation?: string;
  promptKey: PromptKey;
  /** Stable product surface used for cost allocation. Defaults from promptKey. */
  feature?: LlmFeature;
  /** Prompt revision recorded with the request; defaults to `${promptKey}:1`. */
  promptVersion?: string;
  variables: Record<string, JsonValue>;
  /** Stable platform policy for conversation/evaluation calls; never a raw provider model. */
  modelPolicyId?: ModelPolicyId;
  /** Complete typed history. Legacy calls without it adapt to one user message. */
  messages?: AiMessage[];
  /**
   * Vision inputs. Services pass STORAGE PATHS (`{ storagePath }`); the gateway
   * resolves them to inline base64 via the injected `imageStore` right before
   * the provider call (bytes never transit the services layer). Pre-encoded
   * `{ base64, mimeType }` refs pass through untouched.
   */
  images?: AiImageRef[];
  /** JSON Schema for structured output. */
  responseSchema?: unknown;
  /**
   * Tool declarations (chat agents — AI-EVALUATION-CORE-PLAN.md Phase 4).
   * Mutually exclusive with `responseSchema` (Gemini rejects the combination);
   * the gateway fails fast when both are set. Cost/usage is charged exactly
   * once on the containing provider attempt — tool calls are never billed rows.
   */
  tools?: ProviderToolDecl[];
  /** Whether the model may invoke declared tools. Defaults to provider behavior. */
  toolChoice?: "auto" | "none";
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** When true, free-text input/output is moderated (default for ai_chat). */
  moderate?: boolean;
}

export interface AiCallContext {
  tenantId: TenantId;
  uid: UserId;
  role?: string;
  resourceType?: string;
  resourceId?: string;
  /** Injected clock (ISO). Defaults to wall-clock when omitted. */
  now?: () => string;
  /** Optional rollup correlation ids written to the call log. */
  examId?: ExamId;
  spaceId?: SpaceId;
  submissionId?: string;
  questionId?: string;
  storyPointId?: string;
  itemId?: string;
  chatSessionId?: string;
  testSessionId?: string;
  attemptId?: string;
  /** Full causation metadata for delayed/background workflows. */
  usage?: Partial<LlmUsageContext>;
  credentialOwner?: "platform" | "tenant" | "user";
}

/** A user's eligible BYOK key (active + enabled), resolved from the DB record. */
export interface ResolvedUserKey {
  provider: string;
  /** Opaque Secret Manager ref (`user-{userId}-{provider}`) — never the value. */
  secretRef: string;
}

/**
 * Port the gateway calls to discover a user's own BYOK key WITHOUT importing
 * Firestore (lint-boundaries: `@levelup/ai` stays data-store free). Services back
 * this with the `userProviderKeys` repo. Returns null when the user has no active,
 * enabled key — in which case resolution falls through to tenant → platform.
 */
export interface UserKeyLookup {
  getEligibleUserKey(userId: string): Promise<ResolvedUserKey | null>;
}

export interface AiResponse<T = unknown> {
  data: T;
  /** Raw text completion (always present). */
  text: string;
  /** Tool invocations the model requested (only when `tools` were declared). */
  toolCalls?: ProviderToolCall[];
  tokenUsage: TokenUsage;
  cost: CostBreakdown;
  model: string;
  moderation?: { input: ModerationCategory[]; output: ModerationCategory[] };
  /** Correlates the product response with the telemetry request timeline. */
  requestId: string;
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
  /**
   * Per-user BYOK key resolver (tests); defaults to GCP Secret Manager. Reads a
   * user's own key by its opaque ref. Fail-closed — a user's key failing never
   * silently falls back to tenant/platform.
   */
  userSecretResolver?: UserSecretResolver;
  /**
   * Discovers a user's eligible BYOK key. Omit to disable BYOK entirely (the
   * gateway then always resolves tenant → platform, exactly as before).
   */
  userKeyLookup?: UserKeyLookup;
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
  /** V2 request/attempt ledger. Omit to keep the gateway telemetry-neutral. */
  telemetry?: LlmTelemetrySink;
  /** Receives isolated telemetry failures for alerting/durable repair. */
  onTelemetryError?: (failure: LlmTelemetryWriteError) => void | Promise<void>;
  /** Deterministic IDs in tests; defaults to UUID v4. */
  idGenerator?: () => string;
  /** Provider name known before secret resolution/request construction. */
  providerName?: "gemini" | "claude";
  /** Injectable deployment environment for deterministic model-policy tests. */
  modelPolicyEnv?: NodeJS.ProcessEnv;
}

export function createAiGateway(deps: CreateAiGatewayDeps): AiGateway {
  const repos = deps.repos;
  const secretResolver = deps.secretResolver ?? createSecretResolver({ projectId: deps.projectId });
  const userSecretResolver =
    deps.userSecretResolver ?? createUserSecretResolver({ projectId: deps.projectId });
  const circuit = deps.circuitBreaker ?? createCircuitBreaker();
  const providerFactory =
    deps.providerFactory ??
    ((apiKey: string, model?: string) => createGeminiProvider(apiKey, { defaultModel: model }));
  const maxRetries = deps.maxRetries ?? 3;
  const idGenerator = deps.idGenerator ?? randomUUID;
  const providerName = deps.providerName ?? "gemini";

  async function writeTelemetry(
    stage: LlmTelemetryWriteError["stage"],
    requestId: string,
    write: (() => Promise<void>) | undefined,
    attemptId?: string
  ): Promise<void> {
    if (!write) return;
    try {
      await write();
    } catch (error) {
      try {
        await deps.onTelemetryError?.({
          stage,
          requestId,
          ...(attemptId !== undefined ? { attemptId } : {}),
          error,
        });
      } catch {
        // Alert delivery is isolated for the same reason as telemetry delivery:
        // observability must never change the product response.
      }
    }
  }

  return {
    async generate<T = unknown>(req: AiRequest, ctx: AiCallContext): Promise<AiResponse<T>> {
      // Tools and structured output are mutually exclusive on Gemini — fail
      // fast with a clear error instead of an opaque provider 400.
      if (req.tools && req.tools.length > 0 && req.responseSchema !== undefined) {
        throw providerFailed("AiRequest cannot set both `tools` and `responseSchema`", {
          retryable: false,
          meta: { tenantId: ctx.tenantId, operation: req.operation ?? req.promptKey },
        });
      }
      if (req.modelPolicyId !== undefined && req.model !== undefined) {
        throw providerFailed("AiRequest cannot set both `modelPolicyId` and legacy `model`", {
          retryable: false,
          meta: { tenantId: ctx.tenantId, operation: req.operation ?? req.promptKey },
        });
      }
      if (req.toolChoice !== undefined && req.toolChoice !== "auto" && req.toolChoice !== "none") {
        throw providerFailed("AiRequest toolChoice must be `auto` or `none`", {
          retryable: false,
          meta: { tenantId: ctx.tenantId, operation: req.operation ?? req.promptKey },
        });
      }
      if (req.messages !== undefined) validateAiMessages(req.messages);

      const nowIso = (ctx.now ?? (() => new Date().toISOString()))();
      const template = PROMPTS[req.promptKey];
      const effectivePurpose = req.purpose ?? template.purpose;
      const operation = req.operation ?? req.promptKey;
      let policy: ResolvedModelPolicy | undefined;
      let model: string;
      try {
        policy =
          req.modelPolicyId !== undefined
            ? resolveModelPolicy(
                req.modelPolicyId,
                effectivePurpose,
                deps.modelPolicyEnv ?? process.env
              )
            : undefined;
        if (policy && policy.provider !== providerName) {
          throw new Error(
            `Model policy "${policy.id}" requires provider "${policy.provider}", not "${providerName}"`
          );
        }
        model = policy?.model ?? req.model ?? template.defaultModel;
        validateProviderModel(providerName, model, deps.modelPolicyEnv ?? process.env);
      } catch (error) {
        throw providerFailed("AI model configuration is invalid", {
          retryable: false,
          meta: {
            tenantId: ctx.tenantId,
            operation,
            ...(req.modelPolicyId !== undefined ? { modelPolicyId: req.modelPolicyId } : {}),
          },
          cause: error,
        });
      }

      const isConversationRequest =
        req.messages !== undefined ||
        req.promptKey === "conversationTutor" ||
        req.promptKey === "conversationQuestionHelp" ||
        req.promptKey === "conversationAssessment";
      if (isConversationRequest && req.moderate !== true) {
        throw providerFailed("Conversational AI requests must set `moderate: true`", {
          retryable: false,
          meta: { tenantId: ctx.tenantId, operation },
        });
      }
      const circuitKey = `${ctx.tenantId}:${model}`;
      const requestId = idGenerator();

      // Credential precedence: user BYOK → tenant → platform. Resolved BEFORE the
      // quota check because BYOK bypasses tenant/platform quota. A user's OWN key
      // is fail-closed downstream (never silently falls back). A failing *lookup*
      // (not the key) is treated as "no user key" so availability is preserved.
      let credentialOwner: "platform" | "tenant" | "user" = ctx.credentialOwner ?? "tenant";
      let userKey: ResolvedUserKey | null = null;
      if (deps.userKeyLookup && ctx.uid) {
        try {
          userKey = await deps.userKeyLookup.getEligibleUserKey(String(ctx.uid));
        } catch {
          userKey = null;
        }
        if (userKey) credentialOwner = "user";
      }

      const rootRequestId = ctx.usage?.rootRequestId ?? requestId;
      const traceId = ctx.usage?.traceId ?? rootRequestId;
      const actorUserId = ctx.usage?.actorUserId ?? String(ctx.uid ?? "<system>");
      const actorRole = ctx.usage?.actorRole ?? ctx.role ?? "unknown";
      const feature = req.feature ?? defaultFeature(req.promptKey);
      const templateVersion = "version" in template ? template.version : undefined;
      const promptVersion = req.promptVersion ?? templateVersion ?? `${req.promptKey}:1`;
      const related = {
        ...(ctx.examId !== undefined ? { examId: String(ctx.examId) } : {}),
        ...(ctx.submissionId !== undefined ? { submissionId: ctx.submissionId } : {}),
        ...(ctx.questionId !== undefined ? { questionId: ctx.questionId } : {}),
        ...(ctx.spaceId !== undefined ? { spaceId: String(ctx.spaceId) } : {}),
        ...(ctx.storyPointId !== undefined ? { storyPointId: ctx.storyPointId } : {}),
        ...(ctx.itemId !== undefined ? { itemId: ctx.itemId } : {}),
        ...(ctx.chatSessionId !== undefined ? { chatSessionId: ctx.chatSessionId } : {}),
        ...(ctx.testSessionId !== undefined ? { testSessionId: ctx.testSessionId } : {}),
        ...(ctx.attemptId !== undefined ? { attemptId: ctx.attemptId } : {}),
        ...ctx.usage?.related,
      };
      const requestRecord: LlmRequestRecord = {
        schemaVersion: 2,
        requestId,
        rootRequestId,
        ...(ctx.usage?.parentRequestId !== undefined
          ? { parentRequestId: ctx.usage.parentRequestId }
          : {}),
        traceId,
        tenantId: String(ctx.tenantId),
        actorUserId,
        ...(ctx.usage?.initiatedByUserId !== undefined
          ? { initiatedByUserId: ctx.usage.initiatedByUserId }
          : {}),
        ...(ctx.usage?.subjectUserId !== undefined
          ? { subjectUserId: ctx.usage.subjectUserId }
          : {}),
        billingUserId:
          ctx.usage?.billingUserId ??
          ctx.usage?.subjectUserId ??
          ctx.usage?.initiatedByUserId ??
          actorUserId,
        actorRole,
        ...(ctx.usage?.initiatorRole !== undefined
          ? { initiatorRole: ctx.usage.initiatorRole }
          : {}),
        purpose: canonicalPurpose(effectivePurpose, req.promptKey),
        feature,
        operation,
        promptKey: req.promptKey,
        promptVersion,
        ...(ctx.usage?.agentId !== undefined ? { agentId: ctx.usage.agentId } : {}),
        resourceType: ctx.resourceType ?? "operation",
        resourceId: ctx.resourceId ?? operation,
        related,
        provider: providerName,
        requestedModel: model,
        credentialOwner,
        status: "reserved",
        pricingVersion: estimateCost(unavailableUsage(), model).pricingVersion,
        createdAt: nowIso,
      };
      const requestStartedAt = Date.now();
      let attemptCount = 0;
      let successfulAttemptId: string | undefined;
      let finalUsage = unavailableUsage();
      let finalCost = estimateCost(finalUsage, model);

      await writeTelemetry(
        "create_request",
        requestId,
        deps.telemetry ? () => deps.telemetry!.createRequest(requestRecord) : undefined
      );

      const finalize = async (
        status: LlmRequestFinalization["status"],
        options: {
          resolvedModel?: string;
          error?: SanitizedLlmError;
        } = {}
      ): Promise<void> => {
        const completedAt = (ctx.now ?? (() => new Date().toISOString()))();
        const record: LlmRequestFinalization = {
          requestId,
          status,
          ...(options.resolvedModel !== undefined ? { resolvedModel: options.resolvedModel } : {}),
          attemptCount,
          ...(successfulAttemptId !== undefined ? { successfulAttemptId } : {}),
          tokens: toCanonicalUsage(finalUsage),
          estimatedCostUsd: finalCost.totalCostUsd,
          pricingVersion: finalCost.pricingVersion,
          latencyMs: Date.now() - requestStartedAt,
          ...(options.error !== undefined ? { error: options.error } : {}),
          completedAt,
        };
        await writeTelemetry(
          "finalize_request",
          requestId,
          deps.telemetry ? () => deps.telemetry!.finalizeRequest(record) : undefined
        );
      };

      // (1) MODERATE free-text input (default-on for chat; mandatory for a
      // typed conversational step). In typed history, only learner-provenance
      // user text is moderated — trusted context and tool output are handled by
      // their server-side construction/sanitization paths.
      const shouldModerate = isConversationRequest
        ? true
        : (req.moderate ?? template.purpose === "ai_chat");
      let inputCategories: ModerationCategory[] = [];
      if (shouldModerate) {
        const raw = req.messages
          ? learnerTextForModeration(req.messages)
          : JSON.stringify(req.variables);
        const m = moderateText(raw);
        inputCategories = m.categories;
        if (!m.allowed) {
          const err = aiDisabled("Input blocked by content moderation", {
            tenantId: ctx.tenantId,
            categories: m.categories,
          });
          await finalize("rejected_moderation", { error: sanitizeError(err) });
          throw err;
        }
      }

      // (2) HARD quota pre-check (monthly budget + daily cap). SKIPPED for BYOK:
      //     a user paying their own provider is not charged against tenant/platform
      //     budget (owner decision 2026-07-18).
      if (credentialOwner !== "user") {
        try {
          await checkUsageQuota(repos, ctx.tenantId, nowIso);
        } catch (err) {
          const policyRejection =
            isAiGatewayError(err) &&
            (err.code === "QUOTA_EXCEEDED" || err.code === "FEATURE_DISABLED");
          const wrapped =
            policyRejection || isAiGatewayError(err)
              ? err
              : providerFailed("AI quota check failed", {
                  retryable: true,
                  meta: { tenantId: ctx.tenantId, operation },
                  cause: err,
                });
          await finalize(policyRejection ? "rejected_quota" : "failed", {
            error: sanitizeError(wrapped),
          });
          throw wrapped;
        }
      }

      // (3) Circuit-breaker guard.
      if (circuit.isCircuitOpen(circuitKey)) {
        const err = providerFailed("AI provider circuit is open", {
          retryable: true,
          meta: { tenantId: ctx.tenantId, model },
        });
        await finalize("circuit_open", { error: sanitizeError(err) });
        throw err;
      }

      // (4) Resolve the per-tenant key (Secret Manager / env override).
      let provider: LLMProvider;
      let rendered: ReturnType<typeof renderPrompt>;
      try {
        // BYOK: read the user's OWN key by ref (fail-closed — any failure throws
        // here and is finalized as `failed`, never falling back to tenant/platform).
        // Otherwise resolve tenant → platform via the existing resolver.
        const apiKey = userKey
          ? await userSecretResolver.getKeyByRef(userKey.secretRef)
          : await secretResolver.getApiKey(ctx.tenantId);
        provider = providerFactory(apiKey, model);
        rendered = renderPrompt(req.promptKey, req.variables);
      } catch (err) {
        const wrapped = isAiGatewayError(err)
          ? err
          : providerFailed("AI provider configuration failed", {
              retryable: false,
              meta: { tenantId: ctx.tenantId, model, operation },
              cause: err,
            });
        await finalize("failed", { error: sanitizeError(wrapped) });
        throw wrapped;
      }

      let providerOut: Awaited<ReturnType<LLMProvider["call"]>> | undefined;
      try {
        // Resolve `{ storagePath }` refs → inline base64 (P0-B seam) and adapt a
        // legacy prompt to exactly one user message. Typed history is forwarded
        // role-by-role; image refs across both channels share one byte budget.
        // This sits outside withRetry so retrying a transient provider failure
        // never re-downloads bytes or rebuilds a different history.
        const providerInputMessages = await buildProviderMessages(req, rendered.user, {
          ...(deps.imageStore !== undefined ? { store: deps.imageStore } : {}),
          ...(deps.maxTotalImageBytes !== undefined
            ? { maxTotalBytes: deps.maxTotalImageBytes }
            : {}),
        });
        providerOut = await withRetry(
          async () => {
            attemptCount += 1;
            const attemptId = idGenerator();
            const attemptStartedAt = Date.now();
            const attemptCreatedAt = (ctx.now ?? (() => new Date().toISOString()))();
            try {
              const output = await provider.call({
                model,
                system: rendered.system,
                messages: providerInputMessages.messages,
                ...(providerInputMessages.images !== undefined
                  ? { images: providerInputMessages.images }
                  : {}),
                temperature: policy?.temperature ?? req.temperature ?? template.defaultTemperature,
                ...(policy !== undefined
                  ? { maxTokens: policy.maxTokens }
                  : req.maxTokens !== undefined
                    ? { maxTokens: req.maxTokens }
                    : {}),
                ...(req.responseSchema !== undefined ? { responseSchema: req.responseSchema } : {}),
                ...(req.tools && req.tools.length > 0 ? { tools: req.tools } : {}),
                ...(req.toolChoice !== undefined ? { toolChoice: req.toolChoice } : {}),
              });
              const usage = buildTokenUsage(output.usage);
              const cost = estimateCost(usage, output.model);
              const completedAt = (ctx.now ?? (() => new Date().toISOString()))();
              const attempt = buildAttemptRecord(requestRecord, {
                attemptId,
                attemptNumber: attemptCount,
                model: output.model,
                status: "success",
                retryable: false,
                usage,
                cost,
                latencyMs: Date.now() - attemptStartedAt,
                createdAt: attemptCreatedAt,
                completedAt,
              });
              await writeTelemetry(
                "record_attempt",
                requestId,
                deps.telemetry ? () => deps.telemetry!.recordAttempt(attempt) : undefined,
                attemptId
              );
              successfulAttemptId = attemptId;
              finalUsage = usage;
              finalCost = cost;
              return output;
            } catch (err) {
              const retryable = classifyError(err) === "transient";
              const completedAt = (ctx.now ?? (() => new Date().toISOString()))();
              const attempt = buildAttemptRecord(requestRecord, {
                attemptId,
                attemptNumber: attemptCount,
                model,
                status: isTimeout(err) ? "timeout" : "error",
                retryable,
                usage: unavailableUsage(),
                cost: estimateCost(unavailableUsage(), model),
                latencyMs: Date.now() - attemptStartedAt,
                error: sanitizeError(err),
                createdAt: attemptCreatedAt,
                completedAt,
              });
              await writeTelemetry(
                "record_attempt",
                requestId,
                deps.telemetry ? () => deps.telemetry!.recordAttempt(attempt) : undefined,
                attemptId
              );
              throw err;
            }
          },
          {
            maxAttempts: maxRetries,
            isRetryable: (e) => classifyError(e) === "transient",
          }
        );
        circuit.recordSuccess(circuitKey);
      } catch (err) {
        if (classifyError(err) === "transient") circuit.recordFailure(circuitKey);
        const latencyMs = Date.now() - requestStartedAt;
        // Keep the client-facing error stable, but put the provider's sanitized
        // status/message in Cloud Logging so production failures are actionable.
        // Never log request payloads, prompts, image bytes, or credentials.
        console.error("[ai-gateway] provider call failed", {
          requestId,
          tenantId: ctx.tenantId,
          operation,
          model,
          error: providerErrorForLog(err),
        });
        // Audit the failed call (best-effort).
        await safeLogFailure(repos, ctx, operation, model, latencyMs, err, requestId, deps);
        const wrapped = isAiGatewayError(err)
          ? err
          : providerFailed("AI provider call failed", {
              retryable: classifyError(err) === "transient",
              meta: { tenantId: ctx.tenantId, model, operation },
              cause: err,
            });
        await finalize("failed", { error: sanitizeError(wrapped) });
        throw wrapped;
      }

      const latencyMs = Date.now() - requestStartedAt;
      const usage = buildTokenUsage(providerOut.usage);
      const cost = estimateCost(usage, providerOut.model);

      // (5) Moderate model OUTPUT for chat (never block the learner mid-flow,
      //     but record + redact).
      let outputCategories: ModerationCategory[] = [];
      if (shouldModerate) {
        outputCategories = moderateText(providerOut.text).categories;
      }

      // (6) Audit-log the successful call (cost-rollup source).
      await writeTelemetry("legacy_log", requestId, () =>
        logLLMCall(repos, {
          tenantId: ctx.tenantId,
          functionName: operation,
          model: providerOut.model,
          usage,
          cost,
          latencyMs,
          status: "success",
          userId: ctx.uid,
          ...(ctx.examId !== undefined ? { examId: ctx.examId } : {}),
          ...(ctx.spaceId !== undefined ? { spaceId: ctx.spaceId } : {}),
        })
      );
      await finalize("succeeded", { resolvedModel: providerOut.model });

      const data = template.structured
        ? (providerOut.json as T)
        : (providerOut.text as unknown as T);

      return {
        data,
        text: providerOut.text,
        ...(providerOut.toolCalls && providerOut.toolCalls.length > 0
          ? { toolCalls: providerOut.toolCalls }
          : {}),
        tokenUsage: usage,
        cost,
        model: providerOut.model,
        requestId,
        ...(shouldModerate
          ? { moderation: { input: inputCategories, output: outputCategories } }
          : {}),
      };
    },
  };
}

/**
 * Adapt legacy prompt/image input to the provider's message array, or convert
 * already-validated typed history without flattening any tool part. All image
 * references resolve in one pass so a mixed legacy/typed request cannot evade
 * the gateway's total inline-byte ceiling.
 */
async function buildProviderMessages(
  req: AiRequest,
  legacyUser: string,
  imageOptions: Parameters<typeof resolveImages>[1]
): Promise<{ messages: ProviderMessage[]; images?: ProviderImage[] }> {
  const legacyRefs = req.images ?? [];
  const typedRefs = req.messages ? collectMessageImageRefs(req.messages) : [];
  const resolved = await resolveImages([...legacyRefs, ...typedRefs], imageOptions);
  const legacyImages = resolved?.slice(0, legacyRefs.length);

  if (!req.messages) {
    return {
      messages: [{ role: "user", parts: [{ type: "text", text: legacyUser }] }],
      ...(legacyImages !== undefined ? { images: legacyImages } : {}),
    };
  }

  let typedImageIndex = legacyRefs.length;
  const nextResolvedImage = (): ProviderImage => {
    const image = resolved?.[typedImageIndex++];
    if (!image) {
      // This is unreachable after `collectMessageImageRefs` + `resolveImages`,
      // but make a corrupt dynamic input fail loudly rather than silently drop
      // media from model context.
      throw new Error("AI message image could not be resolved");
    }
    return image;
  };

  const messages: ProviderMessage[] = req.messages.map((message): ProviderMessage => {
    switch (message.role) {
      case "developer":
        return {
          role: "developer",
          parts: message.parts.map((part) => ({ type: "text", text: part.text })),
        };
      case "user":
        return {
          role: "user",
          parts: message.parts.map((part) =>
            part.type === "text"
              ? { type: "text", text: part.text }
              : { type: "image", image: nextResolvedImage() }
          ),
        };
      case "assistant":
        return {
          role: "assistant",
          parts: message.parts.map((part) =>
            part.type === "text"
              ? { type: "text", text: part.text }
              : {
                  type: "tool_call",
                  callId: part.callId,
                  name: part.name,
                  args: part.args,
                }
          ),
        };
      case "tool":
        return {
          role: "tool",
          parts: message.parts.map((part) => ({
            type: "tool_result",
            callId: part.callId,
            name: part.name,
            result: part.result,
          })),
        };
    }
  });

  return { messages, ...(legacyImages !== undefined ? { images: legacyImages } : {}) };
}

function collectMessageImageRefs(messages: readonly AiMessage[]): AiImageRef[] {
  return messages.flatMap((message) =>
    message.role === "user"
      ? message.parts.flatMap((part) => (part.type === "image" ? [part.image] : []))
      : []
  );
}

/** Validate dynamic history and enforce call/result continuity before any billable work. */
function validateAiMessages(messages: readonly AiMessage[]): void {
  if (messages.length === 0) throw new Error("AiRequest.messages must not be empty");

  const pendingCalls = new Map<string, string>();
  const seenCallIds = new Set<string>();
  for (const message of messages) {
    const candidate: unknown = message;
    if (!isRecord(candidate) || !Array.isArray(candidate.parts) || candidate.parts.length === 0) {
      throw new Error("Each AI message must contain at least one part");
    }
    const role = candidate.role;
    if (role !== "developer" && role !== "user" && role !== "assistant" && role !== "tool") {
      throw new Error("AI message role is invalid");
    }

    for (const part of candidate.parts) {
      if (!isRecord(part) || typeof part.type !== "string") {
        throw new Error("AI message part is invalid");
      }
      switch (role) {
        case "developer":
          if (
            part.type !== "text" ||
            !isNonEmptyString(part.text) ||
            part.provenance !== "agent_config"
          ) {
            throw new Error("Developer messages may contain only agent_config text");
          }
          break;
        case "user":
          if (part.type === "text") {
            if (
              !isNonEmptyString(part.text) ||
              (part.provenance !== "learner" && part.provenance !== "trusted_context")
            ) {
              throw new Error("User text must carry learner or trusted_context provenance");
            }
          } else if (part.type === "image") {
            if (!isAiImageRef(part.image)) throw new Error("User image part is invalid");
          } else {
            throw new Error("User messages may contain only text or images");
          }
          break;
        case "assistant":
          if (part.type === "text") {
            if (!isNonEmptyString(part.text) || part.provenance !== "model_output") {
              throw new Error("Assistant text must carry model_output provenance");
            }
          } else if (part.type === "tool_call") {
            if (
              !isNonEmptyString(part.callId) ||
              !isNonEmptyString(part.name) ||
              !isJsonRecord(part.args) ||
              seenCallIds.has(part.callId)
            ) {
              throw new Error("Assistant tool call is invalid or reuses a callId");
            }
            seenCallIds.add(part.callId);
            pendingCalls.set(part.callId, part.name);
          } else {
            throw new Error("Assistant messages may contain only text or tool calls");
          }
          break;
        case "tool":
          if (
            part.type !== "tool_result" ||
            !isNonEmptyString(part.callId) ||
            !isNonEmptyString(part.name) ||
            !isJsonValue(part.result)
          ) {
            throw new Error("Tool result is invalid");
          }
          if (pendingCalls.get(part.callId) !== part.name) {
            throw new Error("Tool result must match a preceding assistant tool call");
          }
          pendingCalls.delete(part.callId);
          break;
      }
    }
  }

  if (pendingCalls.size > 0) {
    throw new Error("AI history contains a tool call without a matching tool result");
  }
}

/** Input moderation sees only the learner's untrusted text in typed history. */
function learnerTextForModeration(messages: readonly AiMessage[]): string {
  return messages
    .flatMap((message) =>
      message.role === "user"
        ? message.parts.flatMap((part) =>
            part.type === "text" && part.provenance === "learner" ? [part.text] : []
          )
        : []
    )
    .join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isAiImageRef(value: unknown): value is AiImageRef {
  if (!isRecord(value)) return false;
  if (typeof value.base64 === "string" && typeof value.mimeType === "string") return true;
  return (
    typeof value.storagePath === "string" &&
    (value.mimeType === undefined || typeof value.mimeType === "string")
  );
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && isJsonValue(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

async function safeLogFailure(
  repos: AiRepos,
  ctx: AiCallContext,
  operation: string,
  model: string,
  latencyMs: number,
  err: unknown,
  requestId: string,
  deps: CreateAiGatewayDeps
): Promise<void> {
  const zeroUsage = unavailableUsage();
  try {
    await logLLMCall(repos, {
      tenantId: ctx.tenantId,
      functionName: operation,
      model,
      usage: zeroUsage,
      cost: estimateCost(zeroUsage, model),
      latencyMs,
      status: "error",
      errorMessage: sanitizeError(err).message,
      userId: ctx.uid,
      ...(ctx.examId !== undefined ? { examId: ctx.examId } : {}),
      ...(ctx.spaceId !== undefined ? { spaceId: ctx.spaceId } : {}),
    });
  } catch (error) {
    try {
      await deps.onTelemetryError?.({ stage: "legacy_log", requestId, error });
    } catch {
      // Never mask the provider error.
    }
    // Audit failure must not mask the original provider error.
  }
}

function unavailableUsage(): TokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    source: "unavailable",
  };
}

function toCanonicalUsage(usage: TokenUsage): CanonicalTokenUsage {
  return {
    input: usage.inputTokens,
    output: usage.outputTokens,
    ...(usage.cachedInputTokens !== undefined ? { cachedInput: usage.cachedInputTokens } : {}),
    ...(usage.reasoningTokens !== undefined ? { reasoning: usage.reasoningTokens } : {}),
    ...(usage.toolTokens !== undefined ? { tool: usage.toolTokens } : {}),
    ...(usage.imageTokens !== undefined ? { image: usage.imageTokens } : {}),
    total: usage.totalTokens,
    source: usage.source ?? "provider",
  };
}

function toAttemptCost(cost: CostBreakdown): LlmAttemptCost {
  return {
    inputUsd: cost.inputCostUsd,
    outputUsd: cost.outputCostUsd,
    estimatedTotalUsd: cost.totalCostUsd,
    currency: "USD",
    pricingVersion: cost.pricingVersion,
    ...(cost.pricingFallback ? { pricingFallback: true } : {}),
  };
}

function buildAttemptRecord(
  request: LlmRequestRecord,
  input: {
    attemptId: string;
    attemptNumber: number;
    model: string;
    status: LlmAttemptRecord["status"];
    retryable: boolean;
    usage: TokenUsage;
    cost: CostBreakdown;
    latencyMs: number;
    error?: SanitizedLlmError;
    createdAt: string;
    completedAt: string;
  }
): LlmAttemptRecord {
  return {
    schemaVersion: 2,
    requestId: request.requestId,
    rootRequestId: request.rootRequestId,
    ...(request.parentRequestId !== undefined ? { parentRequestId: request.parentRequestId } : {}),
    traceId: request.traceId,
    tenantId: request.tenantId,
    actorUserId: request.actorUserId,
    ...(request.initiatedByUserId !== undefined
      ? { initiatedByUserId: request.initiatedByUserId }
      : {}),
    ...(request.subjectUserId !== undefined ? { subjectUserId: request.subjectUserId } : {}),
    ...(request.billingUserId !== undefined ? { billingUserId: request.billingUserId } : {}),
    actorRole: request.actorRole,
    ...(request.initiatorRole !== undefined ? { initiatorRole: request.initiatorRole } : {}),
    purpose: request.purpose,
    feature: request.feature,
    operation: request.operation,
    promptKey: request.promptKey,
    promptVersion: request.promptVersion,
    ...(request.agentId !== undefined ? { agentId: request.agentId } : {}),
    resourceType: request.resourceType,
    resourceId: request.resourceId,
    related: request.related,
    provider: request.provider,
    attemptId: input.attemptId,
    attemptNumber: input.attemptNumber,
    model: input.model,
    status: input.status,
    retryable: input.retryable,
    tokens: toCanonicalUsage(input.usage),
    cost: toAttemptCost(input.cost),
    providerLatencyMs: input.latencyMs,
    totalAttemptMs: input.latencyMs,
    ...(input.error !== undefined ? { error: input.error } : {}),
    createdAt: input.createdAt,
    completedAt: input.completedAt,
  };
}

function sanitizeError(error: unknown): SanitizedLlmError {
  if (isAiGatewayError(error)) {
    return { code: error.code, message: error.message.slice(0, 240), retryable: error.retryable };
  }
  const status = (error as { status?: unknown } | null)?.status;
  const code =
    typeof status === "number"
      ? `PROVIDER_${status}`
      : isTimeout(error)
        ? "PROVIDER_TIMEOUT"
        : "PROVIDER_ERROR";
  return {
    code,
    message: isTimeout(error) ? "AI provider request timed out" : "AI provider request failed",
    retryable: classifyError(error) === "transient",
  };
}

function providerErrorForLog(error: unknown): {
  name: string;
  code?: string | number;
  status?: number;
  statusText?: string;
  message: string;
} {
  const candidate = error as {
    name?: unknown;
    code?: unknown;
    status?: unknown;
    statusText?: unknown;
    message?: unknown;
  } | null;
  const rawMessage =
    typeof candidate?.message === "string" ? candidate.message : String(error ?? "Unknown error");
  // Provider SDK errors normally omit credentials, but redact common credential
  // shapes defensively before emitting anything to centralized logs.
  const message = rawMessage
    .replace(/([?&]key=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, "[REDACTED_API_KEY]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]")
    .slice(0, 1_000);
  return {
    name: typeof candidate?.name === "string" ? candidate.name : "Error",
    ...(typeof candidate?.code === "string" || typeof candidate?.code === "number"
      ? { code: candidate.code }
      : {}),
    ...(typeof candidate?.status === "number" ? { status: candidate.status } : {}),
    ...(typeof candidate?.statusText === "string" ? { statusText: candidate.statusText } : {}),
    message,
  };
}

function isTimeout(error: unknown): boolean {
  const candidate = error as { name?: unknown; code?: unknown } | null;
  return candidate?.name === "AbortError" || candidate?.code === "ETIMEDOUT";
}
