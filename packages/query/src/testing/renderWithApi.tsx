/**
 * Test harness helpers (query-infra.md §1 testing).
 *
 * `makeTestQueryClient()` — a `QueryClient` with retries off + zero gc for
 * deterministic hook tests. `createApiWrapper(opts)` — a wrapper component that
 * mounts `<ApiProvider>` with mock repos + a no-op transport/notify, suitable for
 * `renderHook(..., { wrapper })`. We intentionally do NOT import
 * `@testing-library/react` here so the package builds without it; tests bring
 * their own `renderHook` and pass this wrapper.
 */
import { createElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { QueryClient } from "@tanstack/react-query";
import { ApiProvider } from "../provider/ApiProvider.js";
import type { NotifyAdapter, Transport, ApiProviderProps } from "../provider/types.js";
import { makeMockRepos } from "./makeMockRepos.js";
import type { Repositories } from "@levelup/repositories";

/** A `QueryClient` tuned for tests (no retries, immediate gc). */
export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

/** A no-op notify adapter (override with spies in tests). */
export function makeNoopNotify(): NotifyAdapter {
  return { error: () => undefined, success: () => undefined };
}

/** A no-op transport (override `invoke`/`subscribe` per test as needed). */
export function makeNoopTransport(): Transport {
  return {
    invoke: async () => undefined,
    subscribe: () => ({ unsubscribe: () => undefined, id: "noop", active: true }),
    serverTimeOffset: () => ({ unsubscribe: () => undefined, id: "noop", active: true }),
    refreshToken: async () => undefined,
  };
}

export interface ApiWrapperOptions {
  repos?: Repositories;
  transport?: Transport;
  notify?: NotifyAdapter;
  queryClient?: QueryClient;
  isDev?: boolean;
}

/**
 * Build a `wrapper` component for `renderHook`/`render`. Returns
 * `{ wrapper, queryClient, repos, notify }` so tests can assert against the
 * same instances they injected.
 */
export function createApiWrapper(options: ApiWrapperOptions = {}): {
  wrapper: (props: { children: ReactNode }) => ReactElement;
  queryClient: QueryClient;
  repos: Repositories;
  notify: NotifyAdapter;
  transport: Transport;
} {
  const queryClient = options.queryClient ?? makeTestQueryClient();
  const repos = options.repos ?? makeMockRepos();
  const notify = options.notify ?? makeNoopNotify();
  const transport = options.transport ?? makeNoopTransport();

  const wrapper = ({ children }: { children: ReactNode }): ReactElement =>
    createElement(ApiProvider, {
      api: {},
      repos,
      transport,
      notify,
      queryClient,
      isDev: options.isDev ?? false,
      children,
    } satisfies ApiProviderProps);

  return { wrapper, queryClient, repos, notify, transport };
}
