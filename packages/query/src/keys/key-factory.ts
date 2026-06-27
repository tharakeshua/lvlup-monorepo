/**
 * `createKeyFactory(domain)` — the one way to mint hierarchical query keys
 * (query-infra.md §4.1, SDK-LAYERS-PLAN §4.2).
 *
 * Conventions (lint-checked by `key-factory.contract.test.ts`):
 *   1. Root is EXACTLY the `DomainName` string — never `['tenants', tenantId, …]`.
 *      `tenantId` is implicit (one provider = one active tenant; §4.4).
 *   2. The 2nd element is a finite "kind" ∈ {'list','infinite','detail'} so the
 *      invalidation graph can fan out by kind.
 *   3. Filters/params are the LAST element and are OBJECTS (stable via React
 *      Query structural sharing) — never positional scalars.
 *   4. Branded IDs are stringified at the boundary (the array stores `string`).
 */
import type { DomainName, KeyFactory } from "./types.js";

/** Mint a `KeyFactory` for one domain root. */
export function createKeyFactory<D extends DomainName>(domain: D): KeyFactory<D> {
  return {
    root: () => [domain] as const,
    all: () => [domain] as const,
    list: <F extends object>(filter?: F) =>
      [domain, "list", (filter ?? {}) as F | Record<string, never>] as const,
    infinite: <F extends object>(filter?: F) =>
      [domain, "infinite", (filter ?? {}) as F | Record<string, never>] as const,
    detail: (id: string) => [domain, "detail", String(id)] as const,
    sub: (id: string, kind: string, params?: object) =>
      [domain, "detail", String(id), kind, params ?? {}] as const,
  };
}
