/**
 * The realtime half of the `Transport` seam — re-stated locally.
 *
 * SOURCE OF TRUTH: the canonical `Transport` / `SubscriptionHandle` /
 * `SubscriptionCallbacks` interfaces live in `@levelup/api-contract`
 * (`src/transport/transport.ts`) so the api-client (consumer of `invoke`) and the
 * transport adapters (implementers) share one shape without a cycle (transport-realtime
 * layer §1/§3). `@levelup/realtime` consumes only the `subscribe` / `serverTimeOffset`
 * half. That canonical home is authored on a parallel build wave; until the typecheck/fix
 * wave promotes these symbols into the api-contract barrel, this package re-states the seam
 * exactly (the layer plan explicitly permits re-stating it) so it compiles independently and
 * imports **no** `firebase/*` (all platform knowledge stays in `@levelup/transport-firebase`).
 */
import type {
  Transport,
  SubscriptionName,
  ParamsOf,
  PayloadOf,
  ApiErrorDetails,
} from "@levelup/api-contract";
import type {
  SubscriptionHandle as CanonicalSubscriptionHandle,
  SubscriptionCallbacks as CanonicalSubscriptionCallbacks,
} from "@levelup/api-contract";

/** Structural error shape carried over the seam (api-client owns the concrete `ApiError`). */
export type ApiError = ApiErrorDetails;

/** Canonical handle/callbacks re-exported (DP-1: single home in api-contract). */
export type { CanonicalSubscriptionHandle as SubscriptionHandle };
export type { CanonicalSubscriptionCallbacks as SubscriptionCallbacks };

/**
 * The slice of the `Transport` contract `@levelup/realtime` consumes. The full `Transport`
 * additionally carries `invoke` (api-client), `refreshToken` (meRepo), and `storage` —
 * out of scope here. A `Pick` so it stays LINKED to the canonical `Transport`.
 */
export type RealtimeTransport = Pick<Transport, "subscribe" | "serverTimeOffset">;

export type { SubscriptionName, ParamsOf, PayloadOf };
