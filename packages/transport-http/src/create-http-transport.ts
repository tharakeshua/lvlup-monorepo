/**
 * `createHttpTransport` — FUTURE stub factory (transport-realtime layer §5).
 *
 * Returns a `Transport` backed by REST + SSE/WS so the scanner-rn / third-party / pure-REST
 * clients can later swap `createFirebaseTransport` → `createHttpTransport` with **no app-code
 * change** (same `Transport` shape). **NOT IMPLEMENTED in v1** — invoke/subscribe are typed but
 * unwired; this is the shape contract a future build fills in.
 */
import type {
  Transport,
  CallableName,
  ReqOf,
  ResOf,
  SubscriptionName,
  ParamsOf,
  PayloadOf,
  SubscriptionHandle,
  SubscriptionCallbacks,
  StorageTransport,
} from "./seam.js";
import { invokeViaHttp } from "./invoke/invoke-via-http.js";
import { subscribeViaSSE } from "./subscribe/subscribe-via-sse.js";
import { httpServerTimeOffset } from "./server-time/server-time.js";

/**
 * Storage capability stub (DP-1). The canonical `Transport` carries
 * `storage: StorageTransport`; this REST adapter is unwired in v1, so the stub
 * throws loudly rather than silently being `undefined`. A future build replaces
 * it with a signed-PUT-over-REST impl. Marked partial here on purpose.
 */
const HTTP_STORAGE_NOT_IMPLEMENTED: StorageTransport = {
  requestUploadUrl(): never {
    throw new Error("[transport-http] storage.requestUploadUrl not implemented (v1 stub)");
  },
  uploadImage(): never {
    throw new Error("[transport-http] storage.uploadImage not implemented (v1 stub)");
  },
};

export interface HttpTransportOptions {
  /** Base URL of the REST gateway (no trailing slash), e.g. `https://api.levelup.app`. */
  baseUrl: string;
  /** Verified ID/session token, forwarded as `Authorization: Bearer <token>`; re-fetchable for refresh. */
  getBearerToken: () => Promise<string>;
  /** RN/node fetch polyfill seam (defaults to global `fetch`). */
  fetchImpl?: typeof fetch;
}

export function createHttpTransport(opts: HttpTransportOptions): Transport {
  return {
    invoke<N extends CallableName>(name: N, data: ReqOf<N>): Promise<ResOf<N>> {
      return invokeViaHttp(opts, name, data);
    },

    subscribe<S extends SubscriptionName>(
      name: S,
      params: ParamsOf<S>,
      cb: SubscriptionCallbacks<PayloadOf<S>> | ((payload: PayloadOf<S>) => void)
    ): SubscriptionHandle {
      // SSE is the default future stream transport; WS is the bidirectional fallback.
      return subscribeViaSSE(opts, name, params, cb);
    },

    serverTimeOffset(cb: (offsetMs: number) => void): SubscriptionHandle {
      return httpServerTimeOffset(opts, cb);
    },

    refreshToken(_forceRefresh?: boolean): Promise<void> {
      // Stub: the bearer-token seam re-fetches on demand; no cached token to invalidate in v1 shape.
      return Promise.resolve();
    },

    // DP-1: explicit partial — REST storage is unwired in v1 (throws, never silently undefined).
    storage: HTTP_STORAGE_NOT_IMPLEMENTED,
  };
}
