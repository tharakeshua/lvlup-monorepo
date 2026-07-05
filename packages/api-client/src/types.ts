/**
 * Public types for the api-client surface (api-client-core.md §3.1 / §3.2).
 *
 * The `ApiClient` type is a MAPPED TYPE over the `CALLABLES` registry, so the
 * namespaced surface is exhaustive at compile time with zero manual upkeep: add a
 * callable to the contract and `api.<module>.<op>` appears automatically.
 */
import type {
  CALLABLES,
  CallableName,
  ReqOf,
  ResOf,
  StorageTransport,
} from "@levelup/api-contract";
import type { ApiError } from "./errors.js";
import type { IdempotencyKeyFactory } from "./idempotency.js";
import type { OfflineQueue } from "./offline.js";
import type { RetryPolicy } from "./retry.js";
import type { SubscribeFn } from "./realtime.js";

/** A single callable method: typed req in → typed res out, derived off the registry. */
export type CallFn<N extends CallableName> = (data: ReqOf<N>) => Promise<ResOf<N>>;

/** The owning module of a callable, at the type level: `v1.levelup.saveSpace` → `levelup`. */
export type ModuleOf<N extends CallableName> = (typeof CALLABLES)[N]["module"];

/** The operation segment of a callable name: `v1.levelup.saveSpace` → `saveSpace`. */
export type OpOf<N extends string> = N extends `${string}.${string}.${infer Op}` ? Op : never;

/**
 * The namespaced surface, derived structurally from `CALLABLES` so it can never
 * drift, plus the realtime `subscribe` seam and the dynamic `call(name)` hatch.
 */
export type ApiClient = {
  [M in ModuleOf<CallableName>]: {
    [N in CallableName as ModuleOf<N> extends M ? OpOf<N> : never]: CallFn<N>;
  };
} & {
  /** Typed realtime pass-through (seam; impl in transport-firebase / realtime). */
  subscribe: SubscribeFn;
  /** Escape hatch for a name held dynamically (e.g. repositories). Still validated. */
  call<N extends CallableName>(name: N): CallFn<N>;
  /** Storage capability — the only client Storage site (§3.7). Wired from `transport.storage`. */
  storage: StorageTransport;
};

export interface ApiClientOptions {
  /** DEV: run `responseSchema.parse(res)` to catch server↔client drift. Default false. */
  validateResponses?: boolean;
  /** Override the idempotency-key generator. Stable across retries of one call. */
  getIdempotencyKey?: IdempotencyKeyFactory;
  /** Retry policy for retryable + idempotent-safe calls. `false` disables retries. */
  retry?: RetryPolicy | false;
  /** Optional offline queue; idempotent mutations route through it when present. */
  offlineQueue?: OfflineQueue;
  /** Injected clock for backoff jitter + key seeding (testable). Default `Date.now`. */
  now?: () => number;
  /** Fired on every normalized error (telemetry/log). MUST NOT throw. */
  onError?: (err: ApiError, name: CallableName) => void;
  /** `apiVersion` stamped onto the envelope; defaults to the contract `API_VERSION`. */
  apiVersion?: string;
}
