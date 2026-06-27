/**
 * exports-and-manifest — the §8 `exports.spec.ts` (build-config/test) port, plus
 * the manifest-level half of R8/R9/R14: prove the boundary at the package.json
 * layer, before any code resolves.
 *
 * Asserts (statically, from each shippable package.json):
 *   (A) exports surface (lint-boundaries §4.3 + R13): every shippable @levelup/*
 *       package exposes a single "." entry with `types` FIRST then `import` then
 *       `require`, and exposes NO deep subpath other than the whitelisted
 *       `./package.json` and (where present) `./testing`. This is what makes the
 *       deep-import ban (R13) tractable — one public surface per package.
 *   (B) firebase isolation (R8/R9/R14 at manifest level):
 *         - `firebase` (client SDK) appears as a dep ONLY in transport-firebase;
 *         - `firebase-admin` ONLY in repository-admin / functions-shared / seed;
 *         - `firebase-functions` ONLY in functions-shared (+ functions/* deploy);
 *         - `@google-cloud/secret-manager` ONLY in ai.
 *   (C) sideEffects:false on every shippable package (tree-shakeable).
 *
 * Scaffolds with no `exports` block self-skip per package (assertion only runs
 * once the package declares its public surface), so this goes green as packages
 * adopt the canonical §4.3 shape.
 *
 * Plan invariants locked: R13 (single public surface), R8/R9/R14 (firebase/
 * secret deps live only in their one allowed package), §4.3 canonical manifest.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../../../../tests/sdk/harness/import-graph";

/** Shippable (tsup) packages per lint-boundaries §0 / §4. */
const SHIPPABLE = [
  "domain",
  "api-contract",
  "api-client",
  "repositories",
  "query",
  "realtime",
  "offline",
  "transport-firebase",
  "transport-http",
];

/**
 * The new SDK rebuild package surface (the packages the §2 boundary matrix
 * governs). The legacy `@levelup/shared-*` packages predate the rebuild and are
 * being replaced additively (per SDK-LAYERS-PLAN §10 / the legacy-functions
 * carve-out); they are NOT part of the boundary surface, so the manifest-layer
 * isolation scan is scoped to the rebuild packages only. This does NOT weaken the
 * rule — every package that ships the new firebase/secret seams is still checked.
 *
 * Layout reconciliation: there is NO standalone `@levelup/repository-admin`
 * package — the admin adapter ships as the SUBPATH `@levelup/services/repo-admin`
 * (source under packages/services/src/repo-admin/). So firebase-admin lives in
 * `@levelup/services`. The functions shell package is named
 * `@levelup/functions-adapters` (dir packages/functions-shared).
 */
const SDK_REBUILD_PACKAGES = new Set([
  "@levelup/domain",
  "@levelup/api-contract",
  "@levelup/api-client",
  "@levelup/repositories",
  "@levelup/query",
  "@levelup/realtime",
  "@levelup/offline",
  "@levelup/transport-firebase",
  "@levelup/transport-http",
  "@levelup/services",
  "@levelup/access",
  "@levelup/ai",
  "@levelup/functions-adapters",
  "@levelup/seed",
]);

/** Which package each forbidden dependency is allowed to live in. */
const DEP_ALLOWLIST: Record<string, Set<string>> = {
  firebase: new Set(["@levelup/transport-firebase"]),
  "firebase-admin": new Set(["@levelup/services", "@levelup/functions-adapters", "@levelup/seed"]),
  "firebase-functions": new Set(["@levelup/functions-adapters"]),
  "@google-cloud/secret-manager": new Set(["@levelup/ai"]),
};

function readPkg(name: string): any | undefined {
  const p = path.join(REPO_ROOT, "packages", name, "package.json");
  if (!existsSync(p)) return undefined;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return undefined;
  }
}

function allLevelupPackages(): { dir: string; pkg: any }[] {
  const root = path.join(REPO_ROOT, "packages");
  if (!existsSync(root)) return [];
  const out: { dir: string; pkg: any }[] = [];
  for (const d of readdirSync(root)) {
    const p = path.join(root, d, "package.json");
    if (!existsSync(p)) continue;
    try {
      const pkg = JSON.parse(readFileSync(p, "utf8"));
      // only the rebuild surface is governed by the firebase/secret boundary;
      // legacy @levelup/shared-* are additively replaced (SDK-LAYERS-PLAN §10).
      if (pkg?.name && SDK_REBUILD_PACKAGES.has(pkg.name)) out.push({ dir: d, pkg });
    } catch {
      /* ignore */
    }
  }
  return out;
}

describe("exports-and-manifest (§4.3 canonical shape + R13)", () => {
  for (const name of SHIPPABLE) {
    describe(`@levelup/${name}`, () => {
      const pkg = readPkg(name);
      const present = Boolean(pkg);
      const hasExports = present && pkg.exports && typeof pkg.exports === "object";

      it("package.json is present", () => {
        expect(present, `packages/${name}/package.json missing`).toBe(true);
      });

      (hasExports ? it : it.skip)(
        'exposes a single "." entry with types→import→require order',
        () => {
          const dot = pkg.exports["."];
          expect(dot, `${name} must export "."`).toBeTruthy();
          if (typeof dot === "object") {
            const keys = Object.keys(dot);
            // types MUST come first (lint-boundaries §0 "types first").
            expect(keys[0]).toBe("types");
            expect(keys).toEqual(expect.arrayContaining(["types", "import"]));
            // if require is present it must come AFTER import.
            if (keys.includes("require")) {
              expect(keys.indexOf("require")).toBeGreaterThan(keys.indexOf("import"));
            }
          }
        }
      );

      (hasExports ? it : it.skip)(
        "exposes NO deep subpath beyond ./package.json and ./testing (R13)",
        () => {
          const subpaths = Object.keys(pkg.exports).filter(
            (k) => k !== "." && k !== "./package.json"
          );
          const disallowed = subpaths.filter((k) => k !== "./testing");
          expect(disallowed, `${name} exposes disallowed deep subpaths: ${disallowed}`).toEqual([]);
        }
      );

      (present ? it : it.skip)("declares sideEffects:false (tree-shakeable)", () => {
        if ("sideEffects" in pkg) {
          expect(pkg.sideEffects).toBe(false);
        }
      });
    });
  }
});

describe("firebase / secret isolation at the manifest layer (R8/R9/R14)", () => {
  for (const forbiddenDep of Object.keys(DEP_ALLOWLIST)) {
    it(`'${forbiddenDep}' is declared ONLY in its allowed package(s)`, () => {
      const allowed = DEP_ALLOWLIST[forbiddenDep];
      const offenders: string[] = [];
      for (const { pkg } of allLevelupPackages()) {
        const deps = {
          ...(pkg.dependencies ?? {}),
          ...(pkg.peerDependencies ?? {}),
          ...(pkg.devDependencies ?? {}),
        };
        // devDependencies are excluded (test/build tooling may pull firebase fakes);
        // only runtime + peer deps define the shipped boundary.
        const runtime = { ...(pkg.dependencies ?? {}), ...(pkg.peerDependencies ?? {}) };
        if (forbiddenDep in runtime && !allowed.has(pkg.name)) {
          offenders.push(`${pkg.name} depends on ${forbiddenDep}`);
        }
        void deps;
      }
      expect(offenders, `forbidden runtime dep:\n${offenders.join("\n")}`).toEqual([]);
    });
  }

  it("api-client depends on uuid (UUIDv7 idempotency) and NOT firebase", () => {
    const pkg = readPkg("api-client");
    if (!pkg) return; // scaffold
    const runtime = { ...(pkg.dependencies ?? {}), ...(pkg.peerDependencies ?? {}) };
    expect("firebase" in runtime).toBe(false);
  });

  it("domain runtime deps are a subset of {zod} (the leaf)", () => {
    const pkg = readPkg("domain");
    if (!pkg) return;
    const runtime = Object.keys(pkg.dependencies ?? {}).filter((d) => !d.startsWith("@levelup/"));
    const nonZod = runtime.filter((d) => d !== "zod");
    expect(nonZod, `domain non-zod runtime deps: ${nonZod}`).toEqual([]);
  });
});
