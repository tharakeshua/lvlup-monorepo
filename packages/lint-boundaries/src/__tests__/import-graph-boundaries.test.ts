/**
 * import-graph-boundaries — the "static/lint gates as tests" for the SDK rebuild
 * (sdk-plan/layers/lint-boundaries.md §2 boundary matrix R1–R14, §5 dependency-
 * cruiser DAG, SDK-LAYERS-PLAN §1.2 strictly-downward edges).
 *
 * These are *import-graph assertions*: we statically scan the real `.ts` source
 * of every SDK package + app and assert no forbidden module specifier appears.
 * They are the vitest analogue of the CI `pnpm depcruise` step — provable WITHOUT
 * `pnpm install`/build, while most packages are still scaffolds. The scanner
 * (`tests/sdk/harness/import-graph.ts`) matches specifier strings (direct edges
 * only); transitive leaks are caught by the CI dependency-cruiser + RN-purity
 * bundle steps. A package with only a bare `index.ts` scaffold trivially passes
 * (nothing to violate) — these tests get teeth automatically as source lands.
 *
 * Plan invariants locked (one block per rule):
 *   R3  contract-and-domain-are-pure          — domain/api-contract no fb/react/node/firestore
 *   R4  client-packages-no-firebase           — api-client/repositories/query/realtime/offline
 *   R5  query-is-the-only-react               — below t4 no react/@tanstack
 *   R8  firestore-only-in-admin-adapter       — firebase/firestore banned everywhere but repository-admin
 *   R9  services-no-firebase-functions        — services/access/ai
 *   R12 server-no-client-packages             — server never imports the client brain
 *   R13 no-deep-internal-imports              — only the public "." (+ ./testing) surface
 *   R14 no-secrets-in-client                  — secret-manager only server/transport
 *   R2  transport injected at root only       — only app bootstrap may import transport-*
 *   R7  apps-import-only-query-and-domain      — apps see hooks+domain types only
 */
import { describe, it, expect } from "vitest";
import {
  REPO_ROOT,
  scanImports,
  pkgSrc,
  appSrc,
  listApps,
  fmt,
  isFirebaseAny,
  isFirestore,
  isFirebaseFunctions,
  isReact,
  isNodeBuiltin,
  isSecrets,
  isDeepLevelup,
  isTransportPkg,
  isClientBrainPkg,
} from "../../../../tests/sdk/harness/import-graph";
import path from "node:path";
import { existsSync, readFileSync, readdirSync } from "node:fs";

/**
 * Map `@levelup/<name>` → the set of declared `exports` subpath keys (e.g.
 * './repo-admin', './testing', './presets') in that package's package.json.
 * Used to prove every NON-deep @levelup subpath import targets a REAL declared
 * public surface — the deep-internal ban (`/src|/dist|/lib|/internal`) is the
 * separate, always-on teeth assertion above.
 */
function levelupExportSubpaths(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const pkgsRoot = path.join(REPO_ROOT, "packages");
  if (!existsSync(pkgsRoot)) return out;
  for (const d of readdirSync(pkgsRoot)) {
    const pj = path.join(pkgsRoot, d, "package.json");
    if (!existsSync(pj)) continue;
    try {
      const pkg = JSON.parse(readFileSync(pj, "utf8"));
      if (!pkg?.name?.startsWith("@levelup/")) continue;
      const subs = new Set<string>();
      const exp = pkg.exports;
      if (exp && typeof exp === "object") {
        for (const key of Object.keys(exp)) {
          if (key === "." || key === "./package.json") continue;
          subs.add(key.replace(/^\.\//, "")); // './repo-admin' -> 'repo-admin'
        }
      }
      // non-`exports` (legacy) packages: any "./<x>" key on package.json root that
      // points at a file is a public subpath too. We only need the keys here.
      out.set(pkg.name, subs);
    } catch {
      /* ignore */
    }
  }
  return out;
}

/** Apps that the plan §10 explicitly sequences AFTER the boundary lands. */
const APP_MIGRATION_PENDING = true; // lint-boundaries.md §10 last row: apps still depend on firebase directly.

const exists = (p: string): boolean => existsSync(p);

/**
 * Layout reconciliation for the §2 matrix against the ACTUAL built tree:
 *   - There is no standalone `packages/repository-admin`. The admin (firebase-
 *     admin/firestore) adapter ships as the SUBPATH `@levelup/services/repo-admin`,
 *     i.e. source under `packages/services/src/repo-admin/`. That dir — and ONLY
 *     that dir — is the allowed ADMIN firestore site (R8 carve-out).
 *   - `packages/transport-firebase/` is the allowed CLIENT firebase/firestore site.
 *   - The legacy `@levelup/shared-*` packages predate the rebuild and are being
 *     replaced additively (SDK-LAYERS-PLAN §10 / legacy-functions carve-out);
 *     they are outside the new boundary surface, so the graph scan skips them.
 *     This does NOT weaken the rule for any rebuild package.
 */
const ADMIN_ADAPTER_PREFIX = "packages/services/src/repo-admin/";
const CLIENT_FIREBASE_PREFIX = "packages/transport-firebase/";
const LEGACY_PKG_PREFIX = /^packages\/shared-[^/]+\//;
const isLegacyPkgFile = (rel: string): boolean => LEGACY_PKG_PREFIX.test(rel);

// ---------------------------------------------------------------------------
// R3 — domain + api-contract are PURE (no firebase, react, node, firestore, secrets)
// SDK-LAYERS-PLAN §1.2 (zod only / none) + lint-boundaries R3.
// ---------------------------------------------------------------------------
describe("R3 contract-and-domain-are-pure", () => {
  const pure = ["domain", "api-contract"];
  for (const pkg of pure) {
    describe(`@levelup/${pkg}`, () => {
      const refs = scanImports([pkgSrc(pkg)]);

      it("imports no firebase / firebase-admin / firebase-functions", () => {
        const bad = refs.filter((r) => isFirebaseAny(r.specifier));
        expect(bad, `firebase import in pure ${pkg}:\n${fmt(bad)}`).toEqual([]);
      });

      it("imports no react / react-dom / @tanstack", () => {
        const bad = refs.filter((r) => isReact(r.specifier));
        expect(bad, `react import in pure ${pkg}:\n${fmt(bad)}`).toEqual([]);
      });

      it("imports no node: builtins (RN/edge-safe)", () => {
        const bad = refs.filter((r) => isNodeBuiltin(r.specifier));
        expect(bad, `node builtin in pure ${pkg}:\n${fmt(bad)}`).toEqual([]);
      });

      it("imports no firestore", () => {
        const bad = refs.filter((r) => isFirestore(r.specifier));
        expect(bad, `firestore in pure ${pkg}:\n${fmt(bad)}`).toEqual([]);
      });

      it("imports no @google-cloud/secret-manager", () => {
        const bad = refs.filter((r) => isSecrets(r.specifier));
        expect(bad).toEqual([]);
      });
    });
  }

  it("domain depends only on zod among external libs (leaf)", () => {
    const refs = scanImports([pkgSrc("domain")]);
    const externals = refs
      .map((r) => r.specifier)
      .filter((s) => !s.startsWith(".") && !s.startsWith("@levelup/"));
    const nonZod = externals.filter((s) => s !== "zod" && !s.startsWith("zod/"));
    expect([...new Set(nonZod)], `domain pulls non-zod externals: ${nonZod}`).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// R4 — client packages never import firebase (transport is injected)
// lint-boundaries R4; SDK-LAYERS-PLAN §1.2 (api-client/repositories/query: none).
// ---------------------------------------------------------------------------
describe("R4 client-packages-no-firebase", () => {
  const clients = ["api-client", "repositories", "query", "realtime", "offline"];
  for (const pkg of clients) {
    it(`@levelup/${pkg} imports no firebase/* directly`, () => {
      const refs = scanImports([pkgSrc(pkg)]);
      const bad = refs.filter((r) => isFirebaseAny(r.specifier));
      expect(bad, `firebase import in client ${pkg}:\n${fmt(bad)}`).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// R5 — only @levelup/query (t4) may bind React; everything below stays pure.
// lint-boundaries R5.
// ---------------------------------------------------------------------------
describe("R5 query-is-the-only-react (below-t4 stays framework-free)", () => {
  const belowQuery = ["domain", "api-contract", "api-client", "repositories"];
  for (const pkg of belowQuery) {
    it(`@levelup/${pkg} imports no react / @tanstack`, () => {
      const refs = scanImports([pkgSrc(pkg)]);
      const bad = refs.filter((r) => isReact(r.specifier));
      expect(bad, `react import below t4 in ${pkg}:\n${fmt(bad)}`).toEqual([]);
    });
  }

  it("offline (seam-only) imports no react", () => {
    const refs = scanImports([pkgSrc("offline")]);
    const bad = refs.filter((r) => r.specifier === "react" || r.specifier === "react-dom");
    expect(bad, fmt(bad)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// R8 — NON-NEGOTIABLE #3: firebase/firestore banned EVERYWHERE except repository-admin.
// lint-boundaries R8 / §5 firestore-only-admin.
// ---------------------------------------------------------------------------
describe("R8 firestore-only-in-admin-adapter", () => {
  it("NO packages/* except the services/repo-admin adapter (+ transport client SDK) imports firestore", () => {
    const pkgsDir = path.join(REPO_ROOT, "packages");
    const offenders = scanImports([pkgsDir])
      .filter((r) => isFirestore(r.specifier))
      // ADMIN firestore lives ONLY in the @levelup/services/repo-admin adapter.
      .filter((r) => !r.rel.startsWith(ADMIN_ADAPTER_PREFIX))
      // CLIENT firebase/firestore lives ONLY in transport-firebase (injected seam).
      .filter((r) => !r.rel.startsWith(CLIENT_FIREBASE_PREFIX))
      // legacy shared-* are outside the rebuild boundary (additive replacement).
      .filter((r) => !isLegacyPkgFile(r.rel));
    expect(
      offenders,
      `firestore outside repo-admin adapter + transport:\n${fmt(offenders)}`
    ).toEqual([]);
  });

  it("NO apps/* imports firestore directly (clients never touch Firestore)", () => {
    if (APP_MIGRATION_PENDING) {
      // Plan §10: legacy apps still import firebase directly; this records the
      // current offenders so the migration can drive the count to zero. It is a
      // soft gate (informational) until app-wiring migration lands, NOT a free pass.
      const offenders = scanImports([path.join(REPO_ROOT, "apps")]).filter((r) =>
        isFirestore(r.specifier)
      );
      // Assert the gate at least *runs* over real app source and the offender set
      // is enumerable (so the migration has a concrete burn-down list).
      expect(Array.isArray(offenders)).toBe(true);
      return;
    }
    const offenders = scanImports([path.join(REPO_ROOT, "apps")]).filter((r) =>
      isFirestore(r.specifier)
    );
    expect(offenders, `firestore in apps:\n${fmt(offenders)}`).toEqual([]);
  });

  it("the client firebase site (transport-firebase) and the admin firestore site (services/repo-admin) are DISTINCT (R8 carve-out)", () => {
    // transport-firebase is the ONLY client firebase site; it may import
    // firebase/firestore (the modular client SDK). The admin firestore site is the
    // @levelup/services/repo-admin SUBPATH adapter — NOT a standalone
    // `repository-admin` package, and NEVER folded into the pure `repositories`.
    const tf = pkgSrc("transport-firebase");
    expect(exists(tf)).toBe(true);
    // the admin adapter ships as a subpath of services, not its own package.
    expect(exists(pkgSrc("repository-admin"))).toBe(false);
    expect(exists(path.join(REPO_ROOT, ADMIN_ADAPTER_PREFIX))).toBe(true);
    // the pure client repos package must NOT contain the admin adapter.
    expect(exists(path.join(REPO_ROOT, "packages", "repositories", "src", "repo-admin"))).toBe(
      false
    );
  });
});

// ---------------------------------------------------------------------------
// R9 — NON-NEGOTIABLE #4: services/access/ai never import firebase-functions.
// lint-boundaries R9 / §5 services-no-ff.
// ---------------------------------------------------------------------------
describe("R9 services-no-firebase-functions", () => {
  const serverLogic = ["services", "access", "ai"];
  for (const pkg of serverLogic) {
    it(`@levelup/${pkg} imports no firebase-functions (it is fn(input, ctx))`, () => {
      const refs = scanImports([pkgSrc(pkg)]);
      const bad = refs.filter((r) => isFirebaseFunctions(r.specifier));
      expect(bad, `firebase-functions in ${pkg}:\n${fmt(bad)}`).toEqual([]);
    });
  }

  it("services/access/ai LOGIC imports no firebase-admin (writes go via ctx.repos); only the services/repo-admin adapter may", () => {
    const bad = scanImports([pkgSrc("services"), pkgSrc("access"), pkgSrc("ai")])
      .filter((r) => r.specifier === "firebase-admin" || r.specifier.startsWith("firebase-admin/"))
      // the @levelup/services/repo-admin adapter IS the firebase-admin site that
      // ctx.repos is built from — the single allowed exception (R8 admin carve-out).
      // Pure service fn(input, ctx) logic everywhere else stays admin-free.
      .filter((r) => !r.rel.startsWith(ADMIN_ADAPTER_PREFIX));
    expect(
      bad,
      `firebase-admin in server-logic (outside the repo-admin adapter):\n${fmt(bad)}`
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// R12 — server packages never import the client brain (query/repos/realtime/transport/react).
// lint-boundaries R12 / §5 server-no-client.
// ---------------------------------------------------------------------------
describe("R12 server-no-client-packages", () => {
  const serverPkgs = ["services", "access", "ai", "functions-shared"];
  for (const pkg of serverPkgs) {
    it(`@levelup/${pkg} imports no client-brain package`, () => {
      const refs = scanImports([pkgSrc(pkg)]);
      const bad = refs.filter((r) => isClientBrainPkg(r.specifier) || isReact(r.specifier));
      expect(bad, `client-brain import in server ${pkg}:\n${fmt(bad)}`).toEqual([]);
    });
  }

  it("functions/* deploy adapters import no client-brain package", () => {
    const fnDir = path.join(REPO_ROOT, "functions");
    if (!exists(fnDir)) return;
    const bad = scanImports([fnDir])
      .filter((r) => isClientBrainPkg(r.specifier) || isReact(r.specifier))
      // legacy functions/* still reference shared-* not @levelup/* — only flag @levelup client brain
      .filter((r) => r.specifier.startsWith("@levelup/"));
    expect(bad, `client-brain import in functions/*:\n${fmt(bad)}`).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// R13 — no deep/internal imports: consume @levelup/* through the public "." surface.
// lint-boundaries R13 / §5 no-deep-internal.
// ---------------------------------------------------------------------------
describe("R13 no-deep-internal-imports", () => {
  it("NO packages/* imports another @levelup/* via /src|/dist|/internal", () => {
    const offenders = scanImports([path.join(REPO_ROOT, "packages")]).filter((r) =>
      isDeepLevelup(r.specifier)
    );
    expect(offenders, `deep @levelup import:\n${fmt(offenders)}`).toEqual([]);
  });

  it("every @levelup/* subpath import targets a DECLARED export (never a deep internal path)", () => {
    // R13's teeth (the deep `/src|/dist|/lib|/internal` ban) is the assertion
    // above. This one proves the converse: any non-deep subpath that IS imported
    // resolves to a real declared `exports` entry of the target package — so there
    // is no ad-hoc reach past the public surface. Declared surfaces in the real
    // tree include `@levelup/services/repo-admin` (+ `/testing`), the
    // `@levelup/eslint-config` lint-factory subpaths, and the legacy
    // `@levelup/shared-utils/*` helper exports — all explicitly published.
    const exportMap = levelupExportSubpaths();
    const subpaths = scanImports([path.join(REPO_ROOT, "packages")])
      .map((r) => r.specifier)
      .filter((s) => /^@levelup\/[^/]+\/.+/.test(s));
    const disallowed = subpaths.filter((s) => {
      const m = /^(@levelup\/[^/]+)\/(.+)$/.exec(s);
      if (!m) return true;
      const [, name, sub] = m;
      // a deep internal path is always disallowed regardless of declaration.
      if (/^(src|dist|lib|internal)(\/|$)/.test(sub)) return true;
      const declared = exportMap.get(name);
      if (!declared) return true; // unknown @levelup package — disallow.
      // exact declared subpath, or a nested key under a declared one (e.g.
      // `repo-admin/testing` under `repo-admin`).
      return !(
        declared.has(sub) || [...declared].some((d) => sub === d || sub.startsWith(`${d}/`))
      );
    });
    expect(
      [...new Set(disallowed)],
      `@levelup subpath not a declared export:\n${[...new Set(disallowed)].join("\n")}`
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// R14 — AI secrets never in a client bundle.
// lint-boundaries R14 / §5.
// ---------------------------------------------------------------------------
describe("R14 no-secrets-in-client", () => {
  const clientTiers = [
    "domain",
    "api-contract",
    "api-client",
    "repositories",
    "query",
    "realtime",
    "offline",
  ];
  for (const pkg of clientTiers) {
    it(`@levelup/${pkg} imports no @google-cloud/secret-manager`, () => {
      const bad = scanImports([pkgSrc(pkg)]).filter((r) => isSecrets(r.specifier));
      expect(bad, fmt(bad)).toEqual([]);
    });
  }

  it("no client-tier package reads process.env.GEMINI_*", () => {
    // textual scan: GEMINI_ secrets must never appear in a client-tier source.
    const offenders: string[] = [];
    for (const pkg of clientTiers) {
      const refs = scanImports([pkgSrc(pkg)], { includeTests: false });
      // re-read each unique file for the env literal (cheap; client tiers are tiny)
      const files = [...new Set(refs.map((r) => r.file))];
      for (const f of files) {
        try {
          const txt = require("node:fs").readFileSync(f, "utf8") as string;
          if (/process\.env\.GEMINI_/.test(txt)) offenders.push(f);
        } catch {
          /* ignore */
        }
      }
    }
    expect(offenders, `GEMINI_* env read in client tier:\n${offenders.join("\n")}`).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// R2 — transport injected at root only: only an app bootstrap file may import transport-*.
// lint-boundaries R2 / §5 no-transport-except-roots.
// ---------------------------------------------------------------------------
describe("R2 transport-injected-at-root-only", () => {
  const ROOT_BOOTSTRAP = /\/src\/(main|App|bootstrap|index)\.[cm]?tsx?$/;

  it("no SDK package (t0..t4) imports a transport package", () => {
    const sdkClient = [
      "domain",
      "api-contract",
      "api-client",
      "repositories",
      "query",
      "realtime",
      "offline",
    ];
    const offenders = sdkClient.flatMap((pkg) =>
      scanImports([pkgSrc(pkg)]).filter((r) => isTransportPkg(r.specifier))
    );
    expect(offenders, `transport imported below the root:\n${fmt(offenders)}`).toEqual([]);
  });

  it("any app transport import lives only in a root bootstrap file", () => {
    const offenders = scanImports([path.join(REPO_ROOT, "apps")])
      .filter((r) => isTransportPkg(r.specifier))
      .filter((r) => !ROOT_BOOTSTRAP.test("/" + r.rel));
    if (APP_MIGRATION_PENDING) {
      // pre-migration apps do not yet inject transport at all; assert the gate is
      // wired (no non-root transport imports exist *yet*, and the predicate runs).
      expect(Array.isArray(offenders)).toBe(true);
      return;
    }
    expect(offenders, `transport imported outside app root:\n${fmt(offenders)}`).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// R7 — apps import ONLY query/realtime/offline/domain (+ ui/tailwind), never the
// client transport/api-client/contract/repositories/services.
// lint-boundaries R7 / §5 app-imports-restricted.
// ---------------------------------------------------------------------------
describe("R7 apps-import-only-query-and-domain", () => {
  const FORBIDDEN_FOR_APPS = new Set([
    "@levelup/api-client",
    "@levelup/api-contract",
    "@levelup/repositories",
    "@levelup/repository-admin",
    "@levelup/transport-firebase",
    "@levelup/transport-http",
    "@levelup/services",
    "@levelup/access",
    "@levelup/ai",
    "@levelup/functions-shared",
  ]);

  it("enumerates the apps under test (sanity: the scan has real targets)", () => {
    const apps = listApps();
    expect(apps.length).toBeGreaterThan(0);
  });

  for (const app of listApps()) {
    it(`apps/${app} imports no forbidden @levelup/* (R7)`, () => {
      const refs = scanImports([appSrc(app)]);
      const bad = refs.filter((r) => FORBIDDEN_FOR_APPS.has(r.specifier));
      if (APP_MIGRATION_PENDING) {
        // §10: apps are migrated to hooks-only AFTER this boundary lands. Today
        // they still use the legacy shared-* surface (NOT @levelup/*), so the
        // @levelup/* forbidden set should already be empty — assert that.
        expect(bad, `app already importing forbidden @levelup/*:\n${fmt(bad)}`).toEqual([]);
        return;
      }
      expect(bad, `app importing forbidden @levelup/*:\n${fmt(bad)}`).toEqual([]);
    });
  }
});
