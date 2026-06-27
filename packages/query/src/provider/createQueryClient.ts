/**
 * `makeQueryClient` — the ONE default cache policy (query-infra.md §3.3).
 *
 * Owned by the provider so every app uses the same default policy + the same
 * `QueryCache.onError` wiring. RN-portable: `refetchOnWindowFocus:false`
 * (RN has no `window`), mutations never auto-retry (idempotency is server-side).
 */
import { QueryClient, QueryCache } from "@tanstack/react-query";
import {
  defaultRetry,
  shouldThrowOnError,
  globalQueryErrorHandler,
} from "../error/error-policy.js";
import type { ApiProviderOptions } from "./types.js";

export function makeQueryClient(opts?: ApiProviderOptions): QueryClient {
  const throwToBoundary = opts?.throwReadErrorsToBoundary ?? true;
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: opts?.defaultStaleTimeMs ?? 30_000,
        gcTime: opts?.defaultGcTimeMs ?? 5 * 60_000,
        retry: opts?.retry ?? defaultRetry,
        throwOnError: throwToBoundary
          ? (error, query) => shouldThrowOnError(error, query as { state?: { data?: unknown } })
          : false,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) =>
        globalQueryErrorHandler(error, query as { state?: { data?: unknown } }),
    }),
  });
}
