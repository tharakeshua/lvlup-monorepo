/**
 * The `Transport` seam — re-exported from the canonical home for this package.
 *
 * DP-1: the canonical `Transport` / `SubscriptionHandle` / `SubscriptionCallbacks`
 * / `StorageTransport` interfaces live in `@levelup/api-contract`
 * (`src/transport/`). Both `@levelup/api-client` (consumer) and the transport
 * adapters (implementers) reference one shape without a dependency cycle. This
 * barrel re-exports them under the names this package's internals use.
 *
 * The `error` channel carries the typed `ApiErrorDetails` envelope (the real
 * `ApiError` class is produced by `@levelup/api-client.normalizeError`; this seam
 * only needs the structural error shape).
 */
import type { ApiErrorDetails } from "@levelup/api-contract";

/** Structural error shape carried over the seam (the api-client owns the concrete `ApiError`). */
export type TransportError = ApiErrorDetails;

export type {
  Transport,
  SubscriptionHandle,
  SubscriptionCallbacks,
  StorageTransport,
  UploadBytesInput,
} from "@levelup/api-contract";

export type {
  CallableName,
  ReqOf,
  ResOf,
  SubscriptionName,
  ParamsOf,
  PayloadOf,
} from "@levelup/api-contract";
