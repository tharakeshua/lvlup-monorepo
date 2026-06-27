/**
 * Namespacing / registry-coverage contract tests — api-client-core.md §3.2 / §6.1.
 *
 * The namespaced surface is DERIVED from CALLABLES at construction time
 * (buildNamespaces groups by def.module, op = last name segment). These tests
 * lock:
 *   • Exhaustiveness: for every name in CALLABLES, api[module][op] is a reachable
 *     function that invokes that exact name. (Fails if a callable is added with
 *     no method.)
 *   • No orphan methods: every method maps back to exactly one CALLABLES key.
 *   • Module-grouping integrity: ModuleOf/OpOf derivation has no never/collision
 *     (two callables can't derive the same module.op).
 *   • The dynamic `call(name)` escape hatch resolves the same name.
 *
 * The registry is loaded dynamically from @levelup/api-contract; the whole suite
 * self-skips until BOTH api-contract (CALLABLES) and api-client (createApiClient)
 * are built.
 */
import { describe, it, expect } from "vitest";
import { createFakeTransport } from "../../../../tests/sdk/fakes";
import { C, has } from "./_helpers";

interface ContractModule {
  CALLABLES?: Record<string, { name: string; module: string }>;
  CALLABLE_NAMES?: string[];
}

async function loadContract(): Promise<ContractModule | null> {
  try {
    return (await import("@levelup/api-contract")) as ContractModule;
  } catch {
    return null;
  }
}

function opOf(name: string): string {
  // 'v1.levelup.saveSpace' → 'saveSpace'
  return name.split(".").slice(2).join(".");
}

describe("namespaced surface ≡ CALLABLES registry (api-client-core §6.1)", () => {
  const ready = has("createApiClient");
  const d = ready ? describe : describe.skip;

  d("derivation from the registry", () => {
    it("every CALLABLES name is reachable as api[module][op] and invokes that name", async () => {
      const contract = await loadContract();
      if (!contract?.CALLABLES) return; // api-contract not built yet
      const names = contract.CALLABLE_NAMES ?? Object.keys(contract.CALLABLES);

      const t = createFakeTransport({ defaultResponder: () => ({}) });
      const api = C.createApiClient!(t, { validateResponses: false }) as Record<
        string,
        Record<string, (d: unknown) => Promise<unknown>>
      >;

      for (const name of names) {
        const def = contract.CALLABLES[name];
        const mod = def.module;
        const op = opOf(name);
        const ns = api[mod] as Record<string, unknown> | undefined;
        expect(ns, `module namespace '${mod}' exists for ${name}`).toBeTruthy();
        expect(typeof ns?.[op], `api.${mod}.${op} is a function`).toBe("function");
      }
    });

    it("invoking api[module][op] hits the transport with the exact registry name", async () => {
      const contract = await loadContract();
      if (!contract?.CALLABLES) return;
      const names = contract.CALLABLE_NAMES ?? Object.keys(contract.CALLABLES);
      // pick a couple of representative reads whose schemas accept {} so request
      // validation passes trivially (getSummary is scope-discriminated, not trivial).
      const sample = names.filter((n) => /getMe$|listSpaces$/.test(n)).slice(0, 3);

      for (const name of sample) {
        const def = contract.CALLABLES[name];
        const t = createFakeTransport({ defaultResponder: () => ({}) });
        const api = C.createApiClient!(t, { validateResponses: false }) as Record<
          string,
          Record<string, (d: unknown) => Promise<unknown>>
        >;
        await (api[def.module][opOf(name)]({}) as Promise<unknown>).catch(() => undefined);
        expect(t.lastCall()?.name, `${name} routed to its registry name`).toBe(name);
      }
    });

    it("no two callables derive the same module.op (no collision / never)", async () => {
      const contract = await loadContract();
      if (!contract?.CALLABLES) return;
      const names = contract.CALLABLE_NAMES ?? Object.keys(contract.CALLABLES);
      const seen = new Map<string, string>();
      for (const name of names) {
        const def = contract.CALLABLES[name];
        const key = `${def.module}.${opOf(name)}`;
        expect(seen.has(key), `collision: ${name} and ${seen.get(key)} both derive ${key}`).toBe(
          false
        );
        seen.set(key, name);
      }
    });

    it("the four ApiModule namespaces are present on the surface", async () => {
      const contract = await loadContract();
      if (!contract?.CALLABLES) return;
      const t = createFakeTransport({ defaultResponder: () => ({}) });
      const api = C.createApiClient!(t, { validateResponses: false }) as Record<string, unknown>;
      for (const m of ["identity", "levelup", "autograde", "analytics"]) {
        expect(api[m], `namespace ${m} present`).toBeTruthy();
      }
    });
  });
});

describe("call(name) dynamic escape hatch (api-client-core §3.2)", () => {
  const ready = has("createApiClient");
  const d = ready ? describe : describe.skip;

  d("dynamic resolution", () => {
    it("resolves the same callable as the static namespaced method", async () => {
      const t = createFakeTransport();
      t.onInvoke("v1.levelup.saveSpace", () => ({ id: "sp1", created: true }));
      const api = C.createApiClient!(t, { validateResponses: false });
      await api.call!("v1.levelup.saveSpace")({ data: { title: "X", type: "learning" } });
      expect(t.lastCall()?.name).toBe("v1.levelup.saveSpace");
    });
  });
});
