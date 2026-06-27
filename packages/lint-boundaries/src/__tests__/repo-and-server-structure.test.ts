/**
 * repo-and-server-structure — the structural boundary rules that need same-package
 * graph awareness rather than a flat specifier ban:
 *
 *   R6  no-sibling-repo (lint-boundaries §2/§5):
 *       a `repositories/src/**` repo file may NOT import another repo file in the
 *       same package EXCEPT files under `src/views/**` (the declared cross-entity
 *       "view" repos). Mitigates the SDK-SERVER §7.2 "repositories becomes a
 *       god-object" risk.
 *
 *   §7 onCall-thinness (lint-boundaries §7 / principle #4):
 *       a `functions/<codebase>/src/callable` adapter file must import exactly one
 *       `@levelup/services` symbol path and contain no `firebase-admin/firestore`
 *       import (writes go through a service → repository-admin). We assert the
 *       weaker, statically-checkable half: callable adapters never import
 *       firebase-admin/firestore directly.
 *
 * Both self-pass while the packages are scaffolds (no repo files / no callable
 * adapters yet) and gain teeth as source lands.
 *
 * Plan invariants locked: R6 (repo non-coupling), §7 (onCall thinness — no direct
 * admin firestore in callable adapters; NON-NEGOTIABLE #4 thin-adapter).
 */
import { describe, it, expect } from "vitest";
import path from "node:path";
import { existsSync } from "node:fs";
import {
  REPO_ROOT,
  listSourceFiles,
  importsOf,
  isFirestore,
  fmt,
} from "../../../../tests/sdk/harness/import-graph";

const reposSrc = path.join(REPO_ROOT, "packages", "repositories", "src");

/**
 * Real `@levelup/repositories` layout (reconciled against the built tree):
 *   packages/repositories/src/
 *     <domain>/            e.g. analytics/, identity/, autograde/, ...
 *       index.ts           the domain BARREL (re-exports its repos — not a leaf)
 *       <entity>.ts        an entity repo LEAF (e.g. student.ts, cost.ts)
 *       api-types.ts | paginate.ts | _kit.ts | seam.ts   shared SUPPORT (not leaves)
 *       <x>-type.ts        a type-only module (not an entity-repo leaf)
 *       views/             cross-entity composition (the R6 carve-out)
 *     views/               top-level cross-entity views (carve-out)
 *     internal/            shared internals (not leaves)
 *     index.ts             package barrel
 *
 * R6 (no god-object): an ENTITY-REPO leaf must not import a SIBLING entity-repo
 * leaf to compose cross-entity data — that must go through `views/**`. Barrels,
 * `views/**`, `internal/**`, and the per-domain shared support/type modules are
 * NOT leaves and may be imported.
 */
const REPO_SUPPORT_BASENAMES = new Set(["api-types", "paginate", "_kit", "seam"]);

/** Is this repo-relative path (or specifier tail) a NON-leaf support module? */
function isRepoNonLeaf(after: string): boolean {
  const a = after.replace(/\\/g, "/");
  if (!a) return true; // the package root barrel
  if (a.startsWith("views/") || a.includes("/views/")) return true; // carve-out
  if (a.startsWith("internal/") || a.startsWith("shared/")) return true;
  // any index barrel at any depth (e.g. `analytics/index.ts`).
  if (/(^|\/)index\.[cm]?tsx?$/.test(a)) return true;
  const base = a
    .split("/")
    .pop()!
    .replace(/\.[cm]?tsx?$/, "");
  if (REPO_SUPPORT_BASENAMES.has(base)) return true; // shared support
  if (/-type$/.test(base)) return true; // type-only module (e.g. story-point-type)
  return false;
}

/** A repo "leaf" file = an entity-repo module (not a barrel/view/support/type). */
function isRepoLeaf(rel: string): boolean {
  const p = rel.replace(/\\/g, "/");
  if (!p.includes("/repositories/src/")) return false;
  const after = p.split("/repositories/src/")[1];
  return !isRepoNonLeaf(after);
}

describe("R6 repos-no-sibling-repo (god-object mitigation)", () => {
  it("no repo leaf file imports a sibling repo leaf (cross-entity composition only via views/)", () => {
    if (!existsSync(reposSrc)) return; // scaffold — nothing to check yet
    const files = listSourceFiles(reposSrc);
    const offenders: { rel: string; specifier: string; line: string }[] = [];

    for (const f of files) {
      const rel = path.relative(REPO_ROOT, f).replace(/\\/g, "/");
      // only ENTITY-REPO leaves can be a god-object source. Barrels/views/
      // support/type modules compose freely.
      if (!isRepoLeaf(rel)) continue;
      for (const ref of importsOf(f)) {
        // only relative imports can hit a sibling repo file inside the package.
        if (!ref.specifier.startsWith(".")) continue;
        const target = path.resolve(path.dirname(f), ref.specifier);
        const targetRel = path.relative(REPO_ROOT, target).replace(/\\/g, "/");
        if (!/\/repositories\/src\//.test(targetRel)) continue;
        // the import tail (e.g. `analytics/report.js`) → strip ext for classification.
        const after = (targetRel.split("/repositories/src/")[1] ?? "").replace(
          /\.[cm]?[jt]sx?$/,
          ""
        );
        // allowed sibling targets: barrels, views/**, internal/**, shared support,
        // and type-only modules. Only a sibling ENTITY-REPO leaf is the violation.
        if (isRepoNonLeaf(after)) continue;
        offenders.push({ rel, specifier: ref.specifier, line: ref.line });
      }
    }
    expect(
      offenders,
      `repo leaf importing a sibling repo (use src/views/** instead):\n${offenders.map((o) => `  ${o.rel}: ${o.specifier}`).join("\n")}`
    ).toEqual([]);
  });

  it("a views/** repo MAY compose sibling repos (the declared exception) — sanity that views/ is the carve-out", () => {
    // documents the carve-out against the REAL layout: top-level views/ and
    // per-domain <domain>/views/ are NOT leaves; an entity module IS a leaf.
    expect(isRepoLeaf("packages/repositories/src/views/space-detail-view.ts")).toBe(false);
    expect(isRepoLeaf("packages/repositories/src/analytics/views/summary.ts")).toBe(false);
    expect(isRepoLeaf("packages/repositories/src/analytics/index.ts")).toBe(false); // domain barrel
    expect(isRepoLeaf("packages/repositories/src/analytics/report.ts")).toBe(true); // entity-repo leaf
  });
});

describe("§7 onCall-thinness (functions/* adapters)", () => {
  /**
   * The NEW v1 deploy surface is the `functions/sdk-v1` codebase: thin
   * makeCallable(name, service) shells wired to @levelup/services, with NO direct
   * firestore. The 4 LEGACY codebases — functions/{identity,levelup,autograde,
   * analytics} — are the pre-rebuild fat onCall handlers that the rebuild leaves
   * UNTOUCHED and additive (SDK-LAYERS-PLAN §10 / legacy-functions carve-out), so
   * the thinness gate is scoped to the new surface and skips them.
   */
  const NEW_FN_CODEBASE = "functions/sdk-v1/";
  const LEGACY_FN_CODEBASE = /^functions\/(identity|levelup|autograde|analytics)\//;

  it("no functions/sdk-v1 (new thin-adapter surface) imports firebase-admin/firestore directly", () => {
    const newFnRoot = path.join(REPO_ROOT, "functions", "sdk-v1", "src");
    if (!existsSync(newFnRoot)) return;
    const offenders = listSourceFiles(newFnRoot)
      .flatMap((f) => importsOf(f))
      .filter((r) => isFirestore(r.specifier) || r.specifier === "firebase-admin/firestore");
    expect(offenders, `new v1 adapter touching firestore directly:\n${fmt(offenders)}`).toEqual([]);
  });

  it("no LEGACY functions/*/src/callable adapter regresses to NEW @levelup/services-then-firestore (legacy fat handlers are frozen, not re-touched)", () => {
    // The legacy onCall handlers DO touch firestore directly (that is the old
    // pattern the rebuild replaces). We do not flip them red — but we DO assert
    // they never import the new @levelup/services brain AND firestore in the same
    // file (which would be a half-migrated adapter). This keeps the carve-out
    // honest without breaking the legacy deploy.
    const fnRoot = path.join(REPO_ROOT, "functions");
    if (!existsSync(fnRoot)) return;
    const legacyCallables = listSourceFiles(fnRoot).filter(
      (f) =>
        /\/callable[s]?\//.test(f.replace(/\\/g, "/")) &&
        LEGACY_FN_CODEBASE.test(path.relative(REPO_ROOT, f).replace(/\\/g, "/"))
    );
    const halfMigrated = legacyCallables.filter((f) => {
      const refs = importsOf(f);
      const usesNewBrain = refs.some(
        (r) => r.specifier === "@levelup/services" || r.specifier.startsWith("@levelup/services/")
      );
      const usesFirestore = refs.some((r) => isFirestore(r.specifier));
      return usesNewBrain && usesFirestore;
    });
    expect(
      halfMigrated.map((f) => path.relative(REPO_ROOT, f)),
      `legacy callable importing BOTH @levelup/services and firestore (half-migrated):\n${halfMigrated.join("\n")}`
    ).toEqual([]);
    void NEW_FN_CODEBASE;
  });

  it("the services/repo-admin adapter (+ transport client SDK) is the ONLY firestore site in packages/* (R8)", () => {
    const pkgsRoot = path.join(REPO_ROOT, "packages");
    if (!existsSync(pkgsRoot)) return;
    const offenders = listSourceFiles(pkgsRoot)
      .flatMap((f) => importsOf(f))
      .filter((r) => isFirestore(r.specifier))
      // ADMIN firestore lives ONLY in @levelup/services/repo-admin (the subpath adapter).
      .filter((r) => !r.rel.startsWith("packages/services/src/repo-admin/"))
      // CLIENT firebase/firestore lives ONLY in transport-firebase (injected seam).
      .filter((r) => !r.rel.startsWith("packages/transport-firebase/"))
      // legacy shared-* predate the rebuild boundary (additive replacement).
      .filter((r) => !/^packages\/shared-[^/]+\//.test(r.rel));
    expect(
      offenders,
      `firestore outside the repo-admin adapter + transport:\n${fmt(offenders)}`
    ).toEqual([]);
  });
});
