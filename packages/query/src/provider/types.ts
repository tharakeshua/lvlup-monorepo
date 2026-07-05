/**
 * `ApiProvider` context value + props (query-infra.md §3.1).
 *
 * The query layer is platform-neutral: `notify` and `isDev` (the two things the
 * package historically pulled platform-specific — `sonner`, `import.meta.env.DEV`)
 * are PROPS, making the package RN-clean.
 *
 * `ApiClient`/`Repositories` flow in from `@levelup/repositories` (the brain).
 * The `Transport` seam (`invoke` + `subscribe` + `serverTimeOffset` +
 * `refreshToken`) is re-stated structurally here so the package imports neither
 * `@levelup/api-client` directly nor any transport adapter (downward-only).
 */
import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { Repositories } from "@levelup/repositories";
import type {
  SubscriptionName,
  ParamsOf,
  PayloadOf,
  ApiErrorDetails,
  SubscriptionHandle,
  SubscriptionListener,
  SubscriptionCallbacks,
} from "@levelup/api-contract";

/** Structural error carried over the realtime seam. */
export type SeamError = ApiErrorDetails;

/** Canonical subscription sub-types (DP-1: single home in `@levelup/api-contract`). */
export type { SubscriptionHandle, SubscriptionCallbacks };

/**
 * The injected transport seam — a deliberately WIDENED structural view (DP-1
 * NOT-unified case #1). The query layer is downward-only (it cannot import the
 * api-client's `CallableName`-parameterized `invoke`), so `invoke` stays loosened
 * to `(name: string, data: unknown)`; the realtime sub-types (`SubscriptionHandle`,
 * `SubscriptionListener`) are the canonical api-contract ones. The real client is
 * structurally assignable to this view.
 */
export interface Transport {
  invoke(name: string, data: unknown): Promise<unknown>;
  subscribe<S extends SubscriptionName>(
    name: S,
    params: ParamsOf<S>,
    cb: SubscriptionListener<PayloadOf<S>>
  ): SubscriptionHandle;
  serverTimeOffset(cb: (offsetMs: number) => void): SubscriptionHandle;
  refreshToken(forceRefresh?: boolean): Promise<void>;
}

/**
 * A raw api-client handle — kept opaque (DP-1 step 7, intentional). The query
 * layer never reads the client directly (all reads stay in `@levelup/repositories`),
 * so linking it to the real `ApiClient` would buy nothing here; it stays `object`.
 */
export type ApiClientLike = object;

/** Injected, platform-neutral toast/announcer (web: sonner adapter; RN: Toast). */
export interface NotifyAdapter {
  error(message: string, opts?: { description?: string; durationMs?: number }): void;
  success(message: string, opts?: { description?: string }): void;
}

/** Optional offline-queue seam (no-op in v1). */
export interface OfflineQueueLike {
  readonly enqueue?: (...args: never[]) => unknown;
}

export interface ApiProviderOptions {
  defaultStaleTimeMs?: number;
  defaultGcTimeMs?: number;
  retry?: number | ((failureCount: number, error: unknown) => boolean);
  /** Globally make read errors throw to the nearest ApiErrorBoundary (default true). */
  throwReadErrorsToBoundary?: boolean;
}

export interface ApiContextValue {
  /** Raw client for the rare hook that needs it (reads stay in repos). */
  api: ApiClientLike;
  /** The brain — hooks call this. */
  repos: Repositories;
  /** Realtime `subscribe()` seam lives here. */
  transport: Transport;
  /** Also available via `useQueryClient()`; exposed for imperative util. */
  queryClient: QueryClient;
  /** Injected toast/announcer; never `sonner` directly. */
  notify: NotifyAdapter;
  /** Optional offline seam. */
  offline?: OfflineQueueLike;
  /** Replaces `import.meta.env.DEV` (passed in, RN-safe). */
  isDev: boolean;
}

export interface ApiProviderProps {
  api: ApiClientLike;
  repos: Repositories;
  transport: Transport;
  notify: NotifyAdapter;
  /** Bring your own client (tests, micro-frontends) or let the provider make one. */
  queryClient?: QueryClient;
  queryClientOptions?: ApiProviderOptions;
  offline?: OfflineQueueLike;
  isDev?: boolean;
  children: ReactNode;
}
