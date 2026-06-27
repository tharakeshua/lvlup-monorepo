/**
 * Repositories — STATIC import-isolation assertion (SDK-LAYERS-PLAN §4.1 R6,
 * repositories.md (3) views/** path-scoped exception).
 *
 * Locked invariant:
 *   "Repos never import sibling repos except declared views (R6 lint)."
 *
 * This is a STATIC source scan (no impl execution): it reads the repositories
 * `src/` tree and asserts that a per-entity repo module does not import another
 * repo module. Only modules under `src/views/**` may compose sibling repos.
 *
 * It self-skips while the package is a scaffold (only the placeholder index.ts +
 * tests present), and only enforces once real repo source files exist — so it
 * locks the invariant the moment the impl lands without flaking before then.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SRC = join(__dirname, "..");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name === "__tests__" || name === "node_modules" || name === "dist") continue;
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (/\.ts$/.test(name) && !/\.test\.ts$/.test(name)) out.push(full);
  }
  return out;
}

/** Heuristic: a file that is (or defines) a repo, excluding barrels/types/utils. */
function looksLikeRepoModule(rel: string): boolean {
  return /repo/i.test(rel) || /\/repos?\//i.test(rel);
}

/** A repo-ish import target inside the package (relative import to another repo). */
const REPO_IMPORT = /import[\s\S]*?from\s+['"](\.[^'"]*repo[^'"]*)['"]/gi;

// Gather real (non-scaffold) repo source files.
const realSrcFiles = existsSync(SRC)
  ? walk(SRC).filter((f) => {
      const rel = relative(SRC, f);
      return rel !== "index.ts"; // placeholder barrel allowed to re-export everything
    })
  : [];

const hasRealImpl = realSrcFiles.some((f) => looksLikeRepoModule(relative(SRC, f)));
const d = hasRealImpl ? describe : describe.skip;

d("repositories · R6 static import isolation", () => {
  it("no per-entity repo module imports a sibling repo (only views/** may compose)", () => {
    const violations: string[] = [];
    for (const file of realSrcFiles) {
      const rel = relative(SRC, file);
      const inViews = rel.split(sep).includes("views");
      if (inViews) continue; // views/** are the sanctioned composers (R6 exception)
      if (!looksLikeRepoModule(rel)) continue;

      const text = readFileSync(file, "utf8");
      let m: RegExpExecArray | null;
      REPO_IMPORT.lastIndex = 0;
      while ((m = REPO_IMPORT.exec(text)) !== null) {
        const target = m[1]!;
        // Importing your own module / a non-repo helper is fine; flag sibling repos.
        if (/repo/i.test(target) && !target.endsWith(rel.replace(/\.ts$/, ""))) {
          violations.push(`${rel} → ${target}`);
        }
      }
    }
    expect(
      violations,
      `R6 violation: non-view repo imports a sibling repo:\n${violations.join("\n")}`
    ).toEqual([]);
  });

  it("view repos live under src/views/** (the only composition surface)", () => {
    // Every file that imports >1 sibling repo must be under views/**.
    const composers: string[] = [];
    for (const file of realSrcFiles) {
      const rel = relative(SRC, file);
      const text = readFileSync(file, "utf8");
      REPO_IMPORT.lastIndex = 0;
      const targets = new Set<string>();
      let m: RegExpExecArray | null;
      while ((m = REPO_IMPORT.exec(text)) !== null) targets.add(m[1]!);
      if (targets.size > 1) composers.push(rel);
    }
    for (const c of composers) {
      expect(c.split(sep).includes("views"), `composer ${c} must be under views/**`).toBe(true);
    }
  });
});
