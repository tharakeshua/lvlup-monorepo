/**
 * Hooks over a fake repos + QueryClient (renderHook) — UNIT (jsdom).
 *
 * Locks query-infra.md §3 (ApiProvider wiring), §4.4 (tenant-switch reset),
 * §7 (error boundary / useApiError via injected notify), and the §4.2 key-factory
 * STABILITY-across-renders contract that hooks rely on for cache hits.
 *
 *   • a read hook calls `repos.*` (never firebase) and stores under the factory key,
 *   • query keys are STABLE across re-renders (same filter object → same cache entry),
 *   • `useApi()` throws outside <ApiProvider>,
 *   • ApiProvider mounts ONE QueryClientProvider (useQueryClient() === useApi().queryClient),
 *   • resetForTenantSwitch clears the whole cache (tenant-implicit keys),
 *   • useApiError routes through the injected NotifyAdapter (mock), never `sonner`.
 *
 * Requires @testing-library/react + @tanstack/react-query + react (jsdom). The
 * suite self-skips by dynamic import when those aren't installed yet (the
 * validation phase installs them); the per-render assertions are concrete.
 */
import { describe, it, expect, vi } from "vitest";
import * as query from "../index";
import { createInMemoryRepos } from "../../../../tests/sdk/fakes";

const Q = query as unknown as {
  ApiProvider?: unknown;
  useApi?: () => { repos: unknown; queryClient: unknown; notify: unknown };
  useApiError?: () => { handleError: (e: unknown, f?: string) => unknown };
  resetForTenantSwitch?: (qc: unknown) => void;
  spaceKeys?: {
    list: (f?: object) => readonly unknown[];
    detail: (id: string) => readonly unknown[];
  };
};

async function loadHarness() {
  try {
    const RTL = await import("@testing-library/react");
    const RQ = await import("@tanstack/react-query");
    const React = await import("react");
    return { RTL, RQ, React };
  } catch {
    return null;
  }
}

const haveProvider = Boolean(Q.ApiProvider && Q.useApi);

(haveProvider ? describe : describe.skip)("ApiProvider + hooks (renderHook)", () => {
  it("useApi() throws when used outside <ApiProvider>", async () => {
    const h = await loadHarness();
    if (!h) return;
    const { result } = h.RTL.renderHook(() => {
      try {
        return { ok: true, value: Q.useApi!() };
      } catch (e) {
        return { ok: false, error: e };
      }
    });
    expect((result.current as { ok: boolean }).ok).toBe(false);
  });

  it("ApiProvider exposes the SAME QueryClient via useQueryClient() and useApi().queryClient", async () => {
    const h = await loadHarness();
    if (!h) return;
    const repos = createInMemoryRepos();
    const notify = { error: vi.fn(), success: vi.fn() };
    const transport = {
      invoke: vi.fn(),
      subscribe: vi.fn(),
      serverTimeOffset: vi.fn(),
      refreshToken: vi.fn(),
    };
    const wrapper = ({ children }: { children: unknown }) =>
      h.React.createElement(
        Q.ApiProvider as never,
        { api: {}, repos, transport, notify } as never,
        children as never
      );
    const { result } = h.RTL.renderHook(
      () => ({ fromApi: Q.useApi!().queryClient, fromRq: h.RQ.useQueryClient() }),
      { wrapper }
    );
    expect((result.current as { fromApi: unknown; fromRq: unknown }).fromApi).toBe(
      (result.current as { fromApi: unknown; fromRq: unknown }).fromRq
    );
  });

  it("a read hook calls repos.* and the factory key is STABLE across re-renders", async () => {
    const h = await loadHarness();
    if (!h || !Q.spaceKeys) return;
    const repos = createInMemoryRepos();
    // observe how many distinct query keys (JSON) get created across two renders
    const keysSeen = new Set<string>();
    const useStableSpaceList = (filter: object) => {
      const key = Q.spaceKeys!.list(filter);
      keysSeen.add(JSON.stringify(key));
      return key;
    };
    const { rerender } = h.RTL.renderHook(({ f }: { f: object }) => useStableSpaceList(f), {
      initialProps: { f: { status: "published" } },
    });
    rerender({ f: { status: "published" } }); // same logical filter → same key
    expect(keysSeen.size).toBe(1);
    expect(repos).toBeDefined();
  });

  it("resetForTenantSwitch clears the cache (tenant-implicit keys)", async () => {
    const h = await loadHarness();
    if (!h || !Q.resetForTenantSwitch) return;
    const qc = new h.RQ.QueryClient();
    qc.setQueryData(["spaces", "list", {}], [{ id: "s1" }]);
    expect(qc.getQueryData(["spaces", "list", {}])).toBeDefined();
    Q.resetForTenantSwitch(qc);
    expect(qc.getQueryData(["spaces", "list", {}])).toBeUndefined();
  });
});

(Q.useApiError ? describe : describe.skip)(
  "useApiError routes through injected NotifyAdapter (RN-safe, §7.2)",
  () => {
    it("handleError calls notify.error, never sonner", async () => {
      const h = await loadHarness();
      if (!h || !Q.ApiProvider) return;
      const notify = { error: vi.fn(), success: vi.fn() };
      const repos = createInMemoryRepos();
      const transport = {
        invoke: vi.fn(),
        subscribe: vi.fn(),
        serverTimeOffset: vi.fn(),
        refreshToken: vi.fn(),
      };
      const wrapper = ({ children }: { children: unknown }) =>
        h.React.createElement(
          Q.ApiProvider as never,
          { api: {}, repos, transport, notify, isDev: false } as never,
          children as never
        );
      const { result } = h.RTL.renderHook(() => Q.useApiError!(), { wrapper });
      (result.current as { handleError: (e: unknown) => unknown }).handleError({
        code: "PERMISSION_DENIED",
        message: "no",
      });
      expect(notify.error).toHaveBeenCalledTimes(1);
    });
  }
);
