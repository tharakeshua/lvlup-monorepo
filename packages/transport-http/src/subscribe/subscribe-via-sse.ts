/**
 * `subscribeViaSSE` — FUTURE stub shape (transport-realtime layer §5.2).
 *
 * `EventSource(`${baseUrl}/v1/sub/<name>?<params>`)` → `cb.next(validatedPayload)`. Long-lived;
 * needs bearer-token refresh mid-stream (the `getBearerToken` seam supports re-fetch — reconnect-on-401
 * policy is a future-build decision, §9.6). **NOT IMPLEMENTED in v1.**
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

export function subscribeViaSSE<S extends SubscriptionName>(
  _opts: HttpTransportOptions,
  name: S,
  _params: ParamsOf<S>,
  _cb: SubscriptionCallbacks<PayloadOf<S>> | ((payload: PayloadOf<S>) => void)
): SubscriptionHandle {
  // Stub: returns an inert (never-firing) handle. The future impl opens an EventSource,
  // validates each `message` event against SUBSCRIPTIONS[name].payload, and routes errors
  // through cb.error as ApiErrorDetails.
  return makeStubHandle(`sse:${name}`);
}
