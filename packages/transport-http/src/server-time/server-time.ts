/**
 * `httpServerTimeOffset` — FUTURE stub shape (transport-realtime layer §5.1).
 *
 * `GET /v1/server-time` → offset; an SSE keep-alive tracks drift. **NOT IMPLEMENTED in v1.**
 * In v1 the server clock is sourced from `@levelup/transport-firebase` over `/.info/serverTimeOffset`.
 */
import type { SubscriptionHandle } from "../seam.js";
import type { HttpTransportOptions } from "../create-http-transport.js";
import { makeStubHandle } from "../subscribe/stub-handle.js";

export function httpServerTimeOffset(
  _opts: HttpTransportOptions,
  _cb: (offsetMs: number) => void
): SubscriptionHandle {
  // Stub: inert handle; the future impl polls/streams the server-time endpoint.
  return makeStubHandle("server-time");
}
