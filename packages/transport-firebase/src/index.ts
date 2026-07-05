/**
 * `@levelup/transport-firebase` — public surface (transport-realtime.md §2.2 index.ts).
 *
 * The ONLY client package allowed to import `firebase/{app,functions,firestore,
 * database,auth,storage}` (principle 3). Implements the `Transport` contract; the
 * realtime layer consumes the `subscribe`/`serverTimeOffset` half, api-client the
 * `invoke`/`refreshToken`/`storage` half — neither knows this concrete impl.
 */

// ---- public factory ----
export { createFirebaseTransport } from "./create-firebase-transport.js";
export type { FirebaseTransportOptions } from "./create-firebase-transport.js";

// ---- services + config ----
export type { FirebaseTransportServices } from "./config/firebase-services.js";
export {
  DEFAULT_REGION,
  resolveRegion,
  type FunctionsRegion,
  type RegionOptions,
  type EmulatorConfig,
} from "./config/region.js";

// ---- the Transport contract this package implements (re-exported until
//      api-contract publishes src/transport/transport.ts; the typecheck/fix wave
//      collapses these to the api-contract import) ----
export type {
  Transport,
  StorageTransport,
  SubscriptionHandle,
  SubscriptionCallbacks,
  SubscribeCallback,
  UploadBytesInput,
  TransportError,
} from "./transport-contract.js";

// ---- auth seam (authRepo backing — the only firebase/auth wrap) ----
export {
  createFirebaseAuthHandle,
  type FirebaseAuthHandle,
  type AuthUserSnapshot,
  type SignInResult,
} from "./auth/auth-handle.js";

// ---- coverage-test surface (the wire-location table) ----
export {
  SUBSCRIPTION_SOURCES,
  type SourceDescriptor,
  type RtdbSourceDescriptor,
  type SubscriptionBackend,
} from "./subscribe/subscription-sources.js";

// ---- low-level units (exported for unit tests + future reuse, NOT app consumption) ----
export { invokeViaCallable, toDeployedCallableId } from "./invoke/invoke-via-callable.js";
export { unwrapCallableError } from "./invoke/normalize-callable-error.js";
export { subscribeViaRTDB } from "./subscribe/subscribe-via-rtdb.js";
export { validatePayload, PayloadValidationError } from "./subscribe/validate-payload.js";
export { toTransportError } from "./subscribe/to-transport-error.js";
