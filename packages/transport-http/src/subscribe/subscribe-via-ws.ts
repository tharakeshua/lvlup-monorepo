/**
 * `subscribeViaWebSocket` — FUTURE stub shape (transport-realtime layer §5.2).
 *
 * WebSocket fallback for bidirectional / low-latency channels. Same `Transport.subscribe`
 * shape as SSE. **NOT IMPLEMENTED in v1.**
 */
import type {
  SubscriptionName,
  ParamsOf,
  PayloadOf,
  SubscriptionHandle,
  SubscriptionCallbacks,
} from "../seam.js";
import type { HttpTransportOptions } from "../create-http-transport.js";
import { makeStubHandle } from "./stub-handle.js";

export function subscribeViaWebSocket<S extends SubscriptionName>(
  _opts: HttpTransportOptions,
  name: S,
  _params: ParamsOf<S>,
  _cb: SubscriptionCallbacks<PayloadOf<S>> | ((payload: PayloadOf<S>) => void)
): SubscriptionHandle {
  return makeStubHandle(`ws:${name}`);
}
