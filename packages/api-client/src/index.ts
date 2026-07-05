/**
 * `@levelup/api-client` — public surface (api-client-core.md §3).
 *
 * `@levelup/domain` ← `@levelup/api-contract` ← **`@levelup/api-client`** ←
 * `@levelup/repositories` ← `@levelup/query` ← apps.
 *
 * Pure ergonomics + safety: validates requests, normalizes errors, retries
 * idempotent-safe calls, keys idempotency, and re-exposes the realtime seam — so
 * every layer above can be dumb. ZERO authority (no tenantId, no scoring) and
 * ZERO framework (no React, no DOM, no firebase, no node-only API): runs
 * byte-identical on web + React Native.
 */

// ---- the factory + its types ----
export { createApiClient } from "./create-client.js";
export type { ApiClient, ApiClientOptions, CallFn, ModuleOf, OpOf } from "./types.js";

// ---- transport seam (injected; never a concrete import) ----
export type {
  Transport,
  SubscriptionHandle,
  SubscriptionCallbacks,
  SubscriptionListener,
} from "./transport.js";

// ---- error funnel ----
export {
  ApiError,
  normalizeError,
  isApiError,
  fromZodError,
  fromTransportError,
} from "./errors.js";
export type { ApiErrorInit, ApiErrorCode, ClientErrorCode } from "./errors.js";

// ---- validation helpers ----
export { validateRequest, validateResponse, stripUndefinedDeep } from "./validate.js";

// ---- retry ----
export { DEFAULT_RETRY_POLICY, NO_RETRY, isRetryable, withRetry, computeBackoff } from "./retry.js";
export type { RetryPolicy } from "./retry.js";

// ---- idempotency ----
export {
  generateIdempotencyKey,
  attachIdempotencyKey,
  IDEMPOTENCY_ENVELOPE_KEY,
} from "./idempotency.js";
export type { IdempotencyKeyFactory } from "./idempotency.js";

// ---- envelope ----
export { withApiVersion, API_VERSION_ENVELOPE_KEY } from "./envelope.js";

// ---- offline seam ----
export { NoopOfflineQueue, routeThroughQueue } from "./offline.js";
export type { OfflineQueue, QueuedCall } from "./offline.js";

// ---- realtime pass-through ----
export { makeSubscribe } from "./realtime.js";
export type { SubscribeFn } from "./realtime.js";

// ---- namespacing (exported for the contract test + repositories) ----
export { buildNamespaces, operationOf } from "./namespaces.js";

// ---- §3.9 convenience re-exports (so consumers import one package) ----
export type {
  CallableName,
  ReqOf,
  ResOf,
  AppErrorCode,
  ApiErrorDetails,
  SubscriptionName,
  ParamsOf,
  PayloadOf,
} from "@levelup/api-contract";
