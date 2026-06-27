/**
 * `ApiProvider` (query-infra.md §3.2).
 *
 * Owns the `QueryClientProvider` (so every app shares one default cache policy +
 * `QueryCache.onError` wiring) AND the `ApiContext` (api/repos/transport/notify/
 * offline/isDev). Apps that already mount a client pass it via `queryClient`.
 */
import { useMemo } from "react";
import type { ReactElement } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ApiContext } from "./ApiContext.js";
import { makeQueryClient } from "./createQueryClient.js";
import type { ApiContextValue, ApiProviderProps } from "./types.js";

export function ApiProvider(props: ApiProviderProps): ReactElement {
  const {
    api,
    repos,
    transport,
    notify,
    offline,
    queryClient: providedClient,
    queryClientOptions,
    isDev,
    children,
  } = props;

  // Options read once; client identity is stable across renders.
  const queryClient = useMemo(
    () => providedClient ?? makeQueryClient(queryClientOptions),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [providedClient]
  );

  const value = useMemo<ApiContextValue>(
    () => ({
      api,
      repos,
      transport,
      notify,
      offline,
      queryClient,
      isDev: isDev ?? false,
    }),
    [api, repos, transport, notify, offline, queryClient, isDev]
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ApiContext.Provider value={value}>{children}</ApiContext.Provider>
    </QueryClientProvider>
  );
}
