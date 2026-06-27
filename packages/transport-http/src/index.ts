/**
 * `@levelup/transport-http` — public surface (FUTURE stub, transport-realtime layer §5).
 *
 * The typed-but-unwired REST/SSE/WS `Transport` shape. Documented now so the seam stays
 * swap-ready (scanner-rn / REST / third parties later); **no implementation in v1**. Same
 * `Transport` interface as `@levelup/transport-firebase`, so app code never changes when the
 * transport is swapped.
 */
export { createHttpTransport } from "./create-http-transport.js";
export type { HttpTransportOptions } from "./create-http-transport.js";

export { invokeViaHttp, callableToHttpPath } from "./invoke/invoke-via-http.js";
export { subscribeViaSSE } from "./subscribe/subscribe-via-sse.js";
export { subscribeViaWebSocket } from "./subscribe/subscribe-via-ws.js";
export { httpServerTimeOffset } from "./server-time/server-time.js";

// Re-export the seam types this package implements (canonical home: @levelup/api-contract).
export type {
  Transport,
  SubscriptionHandle,
  SubscriptionCallbacks,
  TransportError,
} from "./seam.js";
