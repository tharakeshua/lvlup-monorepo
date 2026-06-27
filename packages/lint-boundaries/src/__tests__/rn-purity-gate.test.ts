/**
 * rn-purity-gate — the vitest analogue of lint-boundaries.md §6 RN-purity CI
 * bundle check (the irreplaceable gate / SDK-LAYERS-PLAN §1.2 RN-purity gate /
 * SDK-SERVER §7.2 "RN pulls in a web/node-only dep transitively").
 *
 * The CI gate (§6) bundles `@levelup/query` (which transitively pulls
 * repositories → api-client → api-contract → domain) with an esbuild
 * `conditions:['react-native']` resolver and FAILS if firebase / firebase-admin /
 * firebase-functions / any `node:` builtin / any DOM-only global resolves into
 * the graph. That needs a built bundle + installed deps — out of scope here.
 *
 * This test approximates the same invariant statically: it walks the *source* of
 * the entire RN-pure tier set (domain, api-contract, api-client, repositories,
 * query) and asserts NONE of their import specifiers is firebase*, a node:
 * builtin, secret-manager, or a DOM-only lib. Because workspace `@levelup/*` deps
 * are always `external` and consumed through the public surface (R13), the union
 * of these packages' direct imports IS the resolvable graph's leaf set — so a
 * textual union scan catches the same leak the bundle would, minus 3rd-party
 * transitive deps (which the CI bundle step still owns).
 *
 * Plan invariants locked: domain/api-contract/api-client/repositories/query are
 * RN-clean — no firebase, no firebase-admin/functions, no node: builtins, no
 * secret-manager, no DOM-only deps. (RN-purity gate, §6.2 steps 3-4.)
 */
import { describe, it, expect } from "vitest";
import {
  pkgSrc,
  scanImports,
  fmt,
  isFirebaseAny,
  isNodeBuiltin,
  isSecrets,
} from "../../../../tests/sdk/harness/import-graph";

/** The RN-pure transitive surface rooted at @levelup/query (§6.1 entry graph). */
const RN_PURE_TIERS = [
  "domain",
  "api-contract",
  "api-client",
  "repositories",
  "query",
  "realtime",
  "offline",
];

/** DOM-only libs that must never resolve into the RN graph (§6.2 step 3). */
const DOM_ONLY = new Set([
  "jsdom",
  "happy-dom",
  "react-dom",
  "react-dom/client",
  "@testing-library/dom",
]);

describe("RN-purity gate (§6 — domain→query stay RN-clean)", () => {
  const allRefs = RN_PURE_TIERS.flatMap((p) => scanImports([pkgSrc(p)]));

  it("the RN-pure surface imports NO firebase / firebase-admin / firebase-functions", () => {
    const bad = allRefs.filter((r) => isFirebaseAny(r.specifier));
    expect(bad, `firebase in RN-pure graph:\n${fmt(bad)}`).toEqual([]);
  });

  it("the RN-pure surface imports NO node: builtin (no fs/path/process/Buffer/crypto)", () => {
    const bad = allRefs.filter((r) => isNodeBuiltin(r.specifier));
    expect(bad, `node builtin in RN-pure graph:\n${fmt(bad)}`).toEqual([]);
  });

  it("the RN-pure surface imports NO @google-cloud/secret-manager (R14)", () => {
    const bad = allRefs.filter((r) => isSecrets(r.specifier));
    expect(bad, fmt(bad)).toEqual([]);
  });

  it("the RN-pure surface imports NO DOM-only library", () => {
    const bad = allRefs.filter((r) => DOM_ONLY.has(r.specifier));
    expect(bad, `DOM-only import in RN-pure graph:\n${fmt(bad)}`).toEqual([]);
  });

  it("only @levelup/query (+realtime) may import react among the RN-pure tiers (R5)", () => {
    const belowQuery = ["domain", "api-contract", "api-client", "repositories"];
    const bad = belowQuery
      .flatMap((p) => scanImports([pkgSrc(p)]))
      .filter((r) => r.specifier === "react" || r.specifier === "react-dom");
    expect(bad, `react below the query tier:\n${fmt(bad)}`).toEqual([]);
  });

  it('every RN-pure tier consumes @levelup deps only through the public "." surface (no deep paths — keeps the graph resolvable as external)', () => {
    const deep = allRefs.filter((r) =>
      /^@levelup\/[^/]+\/(src|dist|lib|internal)(\/|$)/.test(r.specifier)
    );
    expect(deep, `deep @levelup import breaks the external-only graph:\n${fmt(deep)}`).toEqual([]);
  });
});
