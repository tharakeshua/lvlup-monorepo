/**
 * Context accessors (query-infra.md §3.2).
 *
 * `useApi()` throws outside `<ApiProvider>`. Narrow selectors (`useRepos`,
 * `useApiClient`, …) keep hooks from over-subscribing to the whole value.
 */
import { useContext } from "react";
import { ApiContext } from "./ApiContext.js";
import type {
  ApiContextValue,
  ApiClientLike,
  NotifyAdapter,
  OfflineQueueLike,
  Transport,
} from "./types.js";
import type { Repositories } from "@levelup/repositories";
import type { QueryClient } from "@tanstack/react-query";

export function useApi(): ApiContextValue {
  const ctx = useContext(ApiContext);
  if (ctx === null) {
    throw new Error("useApi must be used within <ApiProvider>");
  }
  return ctx;
}

export const useRepos = (): Repositories => useApi().repos;
export const useApiClient = (): ApiClientLike => useApi().api;
export const useTransport = (): Transport => useApi().transport;
export const useNotify = (): NotifyAdapter => useApi().notify;
export const useOffline = (): OfflineQueueLike | undefined => useApi().offline;
export const useIsDev = (): boolean => useApi().isDev;
export const useApiQueryClient = (): QueryClient => useApi().queryClient;
