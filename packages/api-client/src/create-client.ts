/**
 * `createApiClient(transport, opts)` — the typed, namespaced SDK assembly
 * (api-client-core.md §3.1 / §4).
 *
 * The end-to-end `call()` path (§4):
 *   1. PRE-FLIGHT VALIDATE (always) — `.strict()` rejects stray fields incl. tenantId.
 *   2. IDEMPOTENCY — one UUIDv7 key per logical call for `def.idempotent`, BEFORE
 *      any retry/queue wrap, so it is stable across attempts + offline replay.
 *   3. DELIVER — `transport.invoke` wrapped by dev response validation.
 *   4. OFFLINE — idempotent mutations may route through the queue (v1: noop).
 *   5. RETRY — only retryable + idempotent-safe; same key on every attempt.
 *   6. NORMALIZE — the outermost boundary funnels EVERY failure into one ApiError
 *      and fires `opts.onError(err, name)`.
 *
 * The ONLY platform difference is `transport`; everything else runs byte-identical
 * web ↔ React Native.
 */
import { API_VERSION, CALLABLES } from "@levelup/api-contract";
import type { CallableDef, CallableName, ReqOf, ResOf } from "@levelup/api-contract";

import { normalizeError } from "./errors.js";
import { withApiVersion } from "./envelope.js";
import { attachIdempotencyKey, generateIdempotencyKey } from "./idempotency.js";
import { buildNamespaces } from "./namespaces.js";
import { routeThroughQueue } from "./offline.js";
import { makeSubscribe } from "./realtime.js";
import { DEFAULT_RETRY_POLICY, NO_RETRY, withRetry, type RetryPolicy } from "./retry.js";
import type { Transport } from "./transport.js";
import type { ApiClient, ApiClientOptions, CallFn } from "./types.js";
import { validateRequest, validateResponse } from "./validate.js";

/**
 * Build the typed, namespaced SDK over an injected transport. See module docblock
 * for the call pipeline.
 */
export function createApiClient(transport: Transport, opts: ApiClientOptions = {}): ApiClient {
  const apiVersion = opts.apiVersion ?? API_VERSION;
  const makeKey = opts.getIdempotencyKey ?? generateIdempotencyKey;
  const policy: RetryPolicy =
    opts.retry === false ? NO_RETRY : (opts.retry ?? DEFAULT_RETRY_POLICY);
  const now = opts.now ?? Date.now;

  function call<N extends CallableName>(name: N): CallFn<N> {
    const def = CALLABLES[name] as unknown as CallableDef<unknown, unknown>;
    return async (data: ReqOf<N>): Promise<ResOf<N>> => {
      try {
        // 1. PRE-FLIGHT VALIDATE — always. Strips/rejects stray fields incl. tenantId.
        const req = validateRequest(name, data);

        // 2. IDEMPOTENCY — generate ONCE (before retry/queue) for idempotent defs.
        const key = def.idempotent ? makeKey(name) : undefined;
        const versioned = withApiVersion(req, def, apiVersion);
        const envelope = key ? attachIdempotencyKey(name, versioned, def, key) : versioned;

        // 3. DELIVER — transport.invoke + dev response validation.
        const deliver = async (): Promise<ResOf<N>> =>
          validateResponse(
            name,
            await transport.invoke(name, envelope as ReqOf<N>),
            !!opts.validateResponses
          );

        // 4. OFFLINE — idempotent mutations may route through the queue.
        const send =
          def.idempotent && opts.offlineQueue && key
            ? (): Promise<ResOf<N>> => routeThroughQueue(opts.offlineQueue, name, req, key, deliver)
            : deliver;

        // 5. RETRY — only retryable + idempotent-safe; same envelope (same key) per attempt.
        return await withRetry(() => send(), policy, { def, now });
      } catch (e) {
        // 6. NORMALIZE — single funnel → ApiError; onError telemetry must not throw.
        const err = normalizeError(e, name);
        try {
          opts.onError?.(err, name);
        } catch {
          /* telemetry hook must never mask the real error */
        }
        throw err;
      }
    };
  }

  const namespaces = buildNamespaces(call as <N extends CallableName>(name: N) => CallFn<N>);

  return {
    ...namespaces,
    subscribe: makeSubscribe(transport, { validateResponses: opts.validateResponses }),
    call,
    // DP-1 (TR-2 runtime-bug fix): expose the transport's Storage capability so
    // `api.storage.*` is defined (storageRepo would TypeError on first upload otherwise).
    storage: transport.storage,
  } as unknown as ApiClient;
}
