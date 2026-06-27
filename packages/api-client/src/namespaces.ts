/**
 * Registry-derived namespacing (api-client-core.md §1 / §3.2 / §6.1).
 *
 * `buildNamespaces` derives the `api.<module>.<op>` object FROM the live
 * `CALLABLES` registry at construction time — grouping by `def.module` and taking
 * the operation segment of the name. This guarantees the runtime surface matches
 * the compile-time `ApiClient` mapped type and can never drift from the registry
 * (the `namespaces.contract.test` asserts exhaustiveness + no collisions).
 */
import { CALLABLES, CALLABLE_NAMES } from "@levelup/api-contract";
import type { CallableName } from "@levelup/api-contract";
import type { CallFn } from "./types.js";

/** `v1.levelup.saveSpace` → `saveSpace` (handles multi-dot ops defensively). */
export function operationOf(name: string): string {
  return name.split(".").slice(2).join(".");
}

/**
 * Build the grouped `{ identity, levelup, autograde, analytics }` surface. `call`
 * is the per-callable factory from `create-client.ts`; each method is `call(name)`.
 */
export function buildNamespaces(
  call: <N extends CallableName>(name: N) => CallFn<N>
): Record<string, Record<string, CallFn<CallableName>>> {
  const ns: Record<string, Record<string, CallFn<CallableName>>> = {};
  for (const name of CALLABLE_NAMES) {
    const def = CALLABLES[name];
    const mod = def.module;
    const op = operationOf(name);
    (ns[mod] ??= {})[op] = call(name) as CallFn<CallableName>;
  }
  return ns;
}
