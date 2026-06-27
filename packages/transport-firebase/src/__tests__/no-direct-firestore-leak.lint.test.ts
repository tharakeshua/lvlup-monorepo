/**
 * no-direct-firestore-leak meta-test (transport-realtime.md §8.5 / principle 3).
 *
 * Across the NEW `@levelup/*` SDK layer-cake packages, `firebase/firestore` and
 * `firebase/database` may be imported ONLY under
 * `packages/transport-firebase/src/**` (the single client-Firestore-source rule).
 * This meta-test scans the SDK package set and asserts no OTHER SDK package imports
 * those modules. (The pre-existing legacy packages — shared-services/shared-hooks/
 * shared-stores — predate the rule and are out of scope for this additive layer;
 * the eslint boundary preset enforces it for the SDK packages at lint time too.)
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
// .../packages/transport-firebase/src/__tests__/  → repo root
const REPO_ROOT = join(here, "..", "..", "..", "..");
const PACKAGES_DIR = join(REPO_ROOT, "packages");

/** The new SDK layer-cake packages this rule governs. */
const SDK_PACKAGES = [
  "domain",
  "api-contract",
  "api-client",
  "repositories",
  "query",
  "realtime",
  "offline",
  "transport-firebase",
  "transport-http",
  "access",
];

const ALLOWED_PREFIX = join("packages", "transport-firebase", "src") + sep;
const RESTRICTED =
  /from\s+['"]firebase\/(firestore|database)['"]|import\s+['"]firebase\/(firestore|database)['"]/;

function walk(dir: string, acc: string[]): string[] {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === "__tests__") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(full);
  }
  return acc;
}

describe("single client-Firestore-source rule (§8.5)", () => {
  it("firebase/firestore + firebase/database imported only under transport-firebase/src (across SDK packages)", () => {
    const files = SDK_PACKAGES.flatMap((p) => walk(join(PACKAGES_DIR, p, "src"), []));
    const leaks: string[] = [];
    for (const file of files) {
      const rel = file.slice(REPO_ROOT.length + 1);
      if (rel.startsWith(ALLOWED_PREFIX)) continue;
      const src = readFileSync(file, "utf8");
      if (RESTRICTED.test(src)) leaks.push(rel);
    }
    expect(
      leaks,
      `firebase/firestore|database imported outside transport-firebase:\n${leaks.join("\n")}`
    ).toEqual([]);
  });
});
