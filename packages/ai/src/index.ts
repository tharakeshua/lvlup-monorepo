// @levelup/ai — the server LLM provider seam.
//
// One injected gateway (`ctx.ai`) over a pluggable provider (Gemini today),
// per-tenant Secret Manager key resolution, server-computed cost + hard quota
// pre-check + LlmCallLog audit, a circuit breaker, a typed prompt registry, and
// lightweight content moderation. Imported by `@levelup/services` only; never in a
// client bundle (REVIEW §6 AI row). Depends downward on `@levelup/domain` +
// `@levelup/api-contract`; data access is via the injected `Repos` slice
// (`@levelup/repository-admin`), never `firebase-admin` directly.

// --- The gateway seam (what services consume) ---
export {
  createAiGateway,
  type AiGateway,
  type AiRequest,
  type AiCallContext,
  type AiResponse,
  type AiMessage,
  type AiDeveloperTextPart,
  type AiUserTextPart,
  type AiAssistantTextPart,
  type AiImagePart,
  type AiToolCallPart,
  type AiToolResultPart,
  type CreateAiGatewayDeps,
  type UserKeyLookup,
  type ResolvedUserKey,
} from "./gateway.js";

// --- Errors ---
export {
  AiGatewayError,
  isAiGatewayError,
  quotaExceeded,
  aiDisabled,
  providerFailed,
} from "./errors.js";

// --- Provider seam ---
export type {
  LLMProvider,
  ProviderInput,
  ProviderOutput,
  ProviderImage,
  ProviderMessage,
  ProviderTextPart,
  ProviderImagePart,
  ProviderToolDecl,
  ProviderToolCall,
  ProviderToolCallPart,
  ProviderToolResultPart,
  ProviderTokenUsage,
} from "./provider/provider.js";
export { createGeminiProvider, type GeminiOpts } from "./provider/gemini.js";
export { createStubProvider } from "./provider/stub.js";

// --- Model defaults (env-overridable; gemini-1.5-* is retired) ---
export {
  DEFAULT_PRO_MODEL,
  DEFAULT_FLASH_MODEL,
  resolveModelDefaults,
  resolveModelPolicy,
  validateProviderModel,
  type ModelDefaults,
  type ModelPolicyId,
  type ResolvedModelPolicy,
} from "./models.js";

// --- Image seam (storage-path → inline bytes, resolved by the gateway) ---
export {
  resolveImages,
  inferMimeType,
  createStubImageStore,
  DEFAULT_MAX_TOTAL_IMAGE_BYTES,
  type AiImageRef,
  type AiImageStore,
  type ResolveImagesOptions,
} from "./images/image-store.js";

// --- Secrets ---
export {
  createSecretResolver,
  createSecretWriter,
  createUserSecretResolver,
  createUserSecretWriter,
  createNamedSecretWriter,
  PLATFORM_GEMINI_SECRET_NAME,
  secretNameFor,
  userSecretNameFor,
  type SecretResolver,
  type SecretResolverOptions,
  type SecretWriter,
  type SecretWriterOptions,
  type UserSecretResolver,
  type UserSecretWriter,
  type UserSecretWriterOptions,
  type UserSecretWriteResult,
  type NamedSecretWriter,
} from "./secrets/secret-manager.js";
export { validateProviderKey, type KeyValidationResult } from "./secrets/validate.js";

// --- Cost / quota ---
export {
  estimateCost,
  buildTokenUsage,
  MODEL_PRICING,
  PRICING_VERSION,
  type TokenUsage,
  type CostBreakdown,
} from "./cost/cost-tracker.js";
export { logLLMCall, type LogLLMCallParams } from "./cost/llm-logger.js";
export {
  checkUsageQuota,
  DEFAULT_MONTHLY_BUDGET_USD,
  DEFAULT_DAILY_CALL_CAP,
  type QuotaCheckResult,
} from "./cost/usage-quota.js";

// --- Reliability ---
export { withRetry, type RetryOptions } from "./reliability/retry.js";
export {
  createCircuitBreaker,
  classifyError,
  type CircuitBreaker,
  type CircuitBreakerOptions,
  type CircuitState,
} from "./reliability/fallback-handler.js";

// --- Prompts ---
export {
  PROMPTS,
  PROMPT_KEYS,
  CONVERSATION_PROMPT_VERSIONS,
  renderPrompt,
  type PromptKey,
  type PromptTemplate,
  type AiPurpose,
} from "./prompts/registry.js";

// --- Moderation ---
export {
  moderateText,
  redactPii,
  type ModerationResult,
  type ModerationCategory,
  type ModerateOptions,
} from "./moderation/moderation.js";

// --- Repos seam (the narrow Repos slice the gateway needs) ---
export type {
  AiRepos,
  LlmRepo,
  TenantsReadRepo,
  CostSummariesReadRepo,
  TenantUsageConfig,
  LogLlmCallParams,
} from "./repos-seam.js";

// --- V2 LLM telemetry ledger ---
export {
  canonicalPurpose,
  defaultFeature,
  type CanonicalTokenUsage,
  type LlmAttemptCost,
  type LlmAttemptRecord,
  type LlmAttemptStatus,
  type LlmCanonicalPurpose,
  type LlmFeature,
  type LlmRelatedResources,
  type LlmRequestFinalization,
  type LlmRequestRecord,
  type LlmRequestStatus,
  type LlmTelemetrySink,
  type LlmTelemetryWriteError,
  type LlmUsageContext,
  type SanitizedLlmError,
} from "./telemetry/types.js";
