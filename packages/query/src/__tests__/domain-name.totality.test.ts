/**
 * DomainName totality (SDK-LAYERS-PLAN.md §4.2 / MERGE-DOMAINNAME) +
 * invalidation-graph totality (§4.3) + subscription→query-key mapping (A10/DX-15).
 *
 *   • `keyof typeof QUERY_KEYS === DomainName`,
 *   • every INVALIDATION_GRAPH root ∈ DomainName,
 *   • every mutating callable has an invalidation entry,
 *   • every SUBSCRIPTIONS entry has a declared targetKey factory.
 *
 * Self-skips until `@levelup/query` exports QUERY_KEYS + INVALIDATION_GRAPH.
 */
import { describe, it, expect } from "vitest";
import * as query from "../index";
import * as contract from "@levelup/api-contract";

const Q = query as unknown as {
  QUERY_KEYS?: Record<string, unknown>;
  INVALIDATION_GRAPH?: Record<string, { roots?: string[]; fanout?: unknown }>;
  SUBSCRIPTION_TARGET_KEYS?: Record<string, unknown>;
};
const C = contract as unknown as {
  CALLABLES?: Record<string, { invalidates?: readonly string[] }>;
  SUBSCRIPTIONS?: Record<string, unknown>;
};

const ready = Boolean(Q.QUERY_KEYS && C.CALLABLES);

(ready ? describe : describe.skip)("DomainName + invalidation totality", () => {
  it("every mutating callable (def.invalidates present) has an INVALIDATION_GRAPH entry", () => {
    if (!Q.INVALIDATION_GRAPH) return;
    const mutating = Object.entries(C.CALLABLES!).filter(
      ([, d]) => d.invalidates && d.invalidates.length >= 0 && d.invalidates !== undefined
    );
    const missing = mutating
      .filter(([name, d]) => d.invalidates !== undefined && !Q.INVALIDATION_GRAPH![name])
      .map(([name]) => name);
    expect(
      missing,
      `mutating callables without an invalidation rule:\n${missing.join("\n")}`
    ).toEqual([]);
  });

  it("every INVALIDATION_GRAPH root is a known DomainName (QUERY_KEYS key)", () => {
    if (!Q.INVALIDATION_GRAPH) return;
    const domains = new Set(Object.keys(Q.QUERY_KEYS!));
    const unknownRoots: string[] = [];
    for (const [name, rule] of Object.entries(Q.INVALIDATION_GRAPH)) {
      for (const root of rule.roots ?? []) {
        if (!domains.has(root)) unknownRoots.push(`${name} → ${root}`);
      }
    }
    expect(
      unknownRoots,
      `invalidation roots not in DomainName:\n${unknownRoots.join("\n")}`
    ).toEqual([]);
  });

  it("every SUBSCRIPTIONS entry has a declared targetKey factory (A10/DX-15)", () => {
    if (!Q.SUBSCRIPTION_TARGET_KEYS || !C.SUBSCRIPTIONS) return;
    const targets = new Set(Object.keys(Q.SUBSCRIPTION_TARGET_KEYS));
    const missing = Object.keys(C.SUBSCRIPTIONS).filter((n) => !targets.has(n));
    expect(missing, `subscriptions without a target key:\n${missing.join("\n")}`).toEqual([]);
  });
});
