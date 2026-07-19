/**
 * `@levelup/api-contract` — the wire SSOT public surface.
 *
 * `@levelup/domain` ← **`@levelup/api-contract`** ← api-client ← repositories ←
 * query ← apps. Pure TS + Zod, zero firebase/DOM/React/node coupling. This
 * barrel re-exports the entire contract surface (callable frame + registry,
 * error model, pagination, transitions, subscriptions, invalidation roots, meta).
 */

// ---- callable frame ----
export type {
  CallableDef,
  ApiModule,
  RateTier,
  AuthMode,
  IdempotencyKeyHint,
} from "./callable-def";
export { API_MODULES, RATE_TIERS, defineCallable } from "./callable-def";

// ---- registry ----
export {
  CALLABLES,
  CALLABLE_NAMES,
  getCallable,
  callablesForModule,
  AUTHORITY_CALLABLES,
  OPTIMISTIC_ALLOWLIST,
  OPTIMISTIC_COUNTER_ALLOWLIST,
} from "./registry";
export type { CallableName, ReqOf, ResOf } from "./registry";

// ---- invalidation roots ----
export { DOMAIN_NAMES, INVALIDATION_GRAPH, unknownInvalidationRoots } from "./domains";
export type { DomainName, InvalidationRule } from "./domains";

// ---- error model ----
export type { AppErrorCode } from "./errors";
export { APP_ERROR_CODES, DEFAULT_RETRYABLE } from "./errors";
export type { ApiErrorDetails, ValidationError, JsonValue } from "./errors";
export { ApiErrorDetailsSchema, isApiErrorDetails } from "./errors";
export type { FunctionsErrorCode } from "./errors";
export { APP_ERROR_TO_HTTPS, HTTPS_TO_APP_ERROR } from "./errors";
export { ERROR_MESSAGES, ERROR_RECOVERY_HINTS } from "./errors";

// ---- pagination ----
export { PageRequest, pageResponse, withPaging } from "./pagination";
export type { PageRequestInput, PageRequestParsed, PageResponse } from "./pagination";

// ---- save-response envelope (canonical home: callables/core/_shared) ----
export { SaveResponseSchema } from "./callables/core/_shared";
export type { SaveResponse } from "./callables/core/_shared";

// ---- conversational AI callable contracts (learner-safe projection surface) ----
export * from "./callables/levelup/_conversation-shared";
export * from "./callables/levelup/start-conversation";
export * from "./callables/levelup/send-conversation-turn";
export * from "./callables/levelup/finish-conversation";
export * from "./callables/levelup/get-conversation";
export * from "./callables/levelup/list-conversations";
export * from "./callables/levelup/abandon-conversation";

// ---- generateContent draft gate (server validates every model draft) ----
export { GeneratedItemSchema } from "./callables/levelup/generate-content";
export type { GeneratedItem } from "./callables/levelup/generate-content";

// ---- transitions (re-exported from @levelup/domain) ----
export { ALLOWED_TRANSITIONS, canTransition, assertTransition } from "./transitions";
export type { TransitionMap, TransitionDomain, TransitionEntity } from "./transitions";

// ---- subscriptions (owned by the subscriptions module barrel) ----
export * from "./subscriptions/index";

// ---- transport seam (DP-1 canonical home: src/transport/) ----
export type {
  Transport,
  StorageTransport,
  UploadBytesInput,
  BinaryBlobLike,
  SubscriptionHandle,
  SubscriptionCallbacks,
  SubscriptionListener,
  SubscriptionStatus,
  Callable,
} from "./transport/index";

// ---- meta ----
export { API_VERSION, callableName, parseCallableName, RATE_LIMITS } from "./meta";
export type { ApiVersion, RateLimitConfig } from "./meta";
