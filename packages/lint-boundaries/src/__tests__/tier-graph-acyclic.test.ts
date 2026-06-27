/**
 * tier-graph-acyclic — the §8 `tier-graph-acyclic.test.ts` fast pre-graph guard
 * (lint-boundaries.md §8 / R1 fast-fail before depcruise).
 *
 * Asserts (statically, from package.json + tiers.json, NO build needed):
 *   (1) the tier table forms a DAG (no tier may transitively depend on itself);
 *   (2) every `@levelup/*` dependency declared in every shippable package.json
 *       respects `allowedTiers(tierOf(pkg))` — i.e. no package declares an
 *       upward/sideways @levelup dependency in its manifest;
 *   (3) the 5-tier spine domain←api-contract←api-client←repositories←query holds
 *       in BOTH the tier table and the declared deps.
 *
 * This is the cheapest possible R1 enforcement: it reads manifests, so it catches
 * a bad dependency edge before `tsc`/`tsup`/depcruise ever run.
 *
 * Plan invariant locked: R1 strictly-downward (manifest-level), the §1 tier DAG.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../../../../tests/sdk/harness/import-graph";

// Mirror of the §1 tier table (also exported by @levelup/eslint-config/tiers).
const TIERS: Record<string, string> = {
  "@levelup/domain": "t0-domain",
  "@levelup/api-contract": "t1-contract",
  "@levelup/api-client": "t2-client",
  "@levelup/repositories": "t3-repos",
  "@levelup/query": "t4-query",
  "@levelup/realtime": "t4-query",
  "@levelup/offline": "t4-query",
  "@levelup/transport-firebase": "t-transport",
  "@levelup/transport-http": "t-transport",
  "@levelup/services": "t-server",
  "@levelup/access": "t-server",
  "@levelup/ai": "t-server",
  "@levelup/functions-shared": "t-server",
  "@levelup/repository-admin": "t-server",
  "@levelup/seed": "t-server",
};

const ALLOWED: Record<string, string[]> = {
  "t0-domain": [],
  "t1-contract": ["t0-domain"],
  "t2-client": ["t0-domain", "t1-contract"],
  "t3-repos": ["t0-domain", "t1-contract", "t2-client"],
  "t4-query": ["t0-domain", "t1-contract", "t2-client", "t3-repos", "t4-query"],
  "t-transport": ["t0-domain", "t1-contract"],
  "t-app": ["t0-domain", "t4-query"],
  "t-server": ["t0-domain", "t1-contract", "t-server"],
};

function readPkg(pkgDir: string): any | undefined {
  const p = path.join(pkgDir, "package.json");
  if (!existsSync(p)) return undefined;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return undefined;
  }
}

/** Every package dir under packages/ that has a package.json with a @levelup name. */
function levelupPackages(): { dir: string; name: string; pkg: any }[] {
  const root = path.join(REPO_ROOT, "packages");
  if (!existsSync(root)) return [];
  const out: { dir: string; name: string; pkg: any }[] = [];
  for (const d of readdirSync(root)) {
    const dir = path.join(root, d);
    const pkg = readPkg(dir);
    if (pkg?.name?.startsWith("@levelup/") && TIERS[pkg.name])
      out.push({ dir, name: pkg.name, pkg });
  }
  return out;
}

describe("tier-graph-acyclic (R1 fast pre-graph guard)", () => {
  it("the tier table forms a DAG (no tier reaches itself transitively, except the self-allow on t4/t-server)", () => {
    // t4-query and t-server intentionally self-allow (sibling packages within a tier).
    // The DAG property we assert: no tier can reach a STRICTLY-higher tier.
    const order = ["t0-domain", "t1-contract", "t2-client", "t3-repos", "t4-query"];
    const rank = (t: string): number => order.indexOf(t);
    for (const [tier, deps] of Object.entries(ALLOWED)) {
      const r = rank(tier);
      if (r === -1) continue; // transport/app/server handled separately
      for (const dep of deps) {
        const dr = rank(dep);
        if (dr === -1) continue;
        expect(dr <= r, `${tier} may not depend on higher tier ${dep}`).toBe(true);
      }
    }
  });

  it("the 5-tier spine is exactly domain ← api-contract ← api-client ← repositories ← query", () => {
    expect(TIERS["@levelup/domain"]).toBe("t0-domain");
    expect(ALLOWED["t1-contract"]).toEqual(["t0-domain"]);
    expect(ALLOWED["t2-client"]).toEqual(["t0-domain", "t1-contract"]);
    expect(ALLOWED["t3-repos"]).toEqual(["t0-domain", "t1-contract", "t2-client"]);
    expect(ALLOWED["t4-query"]).toContain("t3-repos");
  });

  it("t-transport may depend on t0/t1 ONLY (it implements the seam)", () => {
    expect([...ALLOWED["t-transport"]].sort()).toEqual(["t0-domain", "t1-contract"]);
  });

  it("t-server may NEVER depend on a client tier (t2/t3/t4/t-transport)", () => {
    const allowed = new Set(ALLOWED["t-server"]);
    for (const c of ["t2-client", "t3-repos", "t4-query", "t-transport", "t-app"]) {
      expect(allowed.has(c)).toBe(false);
    }
  });

  it("every declared @levelup/* dependency in every package.json respects allowedTiers", () => {
    const pkgs = levelupPackages();
    const violations: string[] = [];
    for (const { name, pkg } of pkgs) {
      const myTier = TIERS[name];
      const allowed = new Set(ALLOWED[myTier] ?? []);
      const deps = { ...(pkg.dependencies ?? {}), ...(pkg.peerDependencies ?? {}) };
      for (const dep of Object.keys(deps)) {
        if (!dep.startsWith("@levelup/")) continue;
        const depTier = TIERS[dep];
        if (!depTier) continue; // tooling pkgs (eslint-config etc.) not in the tier DAG
        if (depTier === myTier) continue; // sibling within tier (t4/t-server self-allow)
        if (!allowed.has(depTier)) {
          violations.push(`${name} (${myTier}) declares ${dep} (${depTier}) — not in allowedTiers`);
        }
      }
    }
    expect(violations, `manifest tier violations:\n${violations.join("\n")}`).toEqual([]);
  });

  it("repository-admin, if/when present, is a SEPARATE package from repositories (RN-purity split)", () => {
    const adminDir = path.join(REPO_ROOT, "packages", "repository-admin");
    const reposDir = path.join(REPO_ROOT, "packages", "repositories");
    expect(existsSync(reposDir)).toBe(true);
    if (existsSync(adminDir)) {
      const admin = readPkg(adminDir);
      const repos = readPkg(reposDir);
      expect(admin?.name).toBe("@levelup/repository-admin");
      expect(repos?.name).toBe("@levelup/repositories");
      // the pure client repos must NOT depend on the admin (firebase-admin) package.
      const reposDeps = Object.keys(repos?.dependencies ?? {});
      expect(reposDeps).not.toContain("@levelup/repository-admin");
      expect(reposDeps).not.toContain("firebase-admin");
    }
  });
});
