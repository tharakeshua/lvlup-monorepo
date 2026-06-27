/**
 * Boundary lint test — api-client-core.md §2 / §6.7 + lint-boundaries.md.
 *
 * api-client must stay TRANSPORT-AGNOSTIC + FRAMEWORK-FREE so it runs byte-
 * identical on web + React Native (the whole point of the FAT-SDK layering).
 * This statically asserts that NO `src/**` file imports any forbidden module:
 *   • firebase / firebase/* / firebase-functions / firebase-admin  (platform coupling)
 *   • react / @tanstack/react-query                                 (framework)
 *   • @levelup/transport-*                                          (would invert the seam)
 *   • @levelup/repositories | query | realtime | offline (upward)   (no upward imports)
 *   • node-only builtins (fs, path, crypto, os, ...) via bare or node: specifier
 *
 * Runs WITHOUT the impl built (it greps source files), so it is NOT self-skipped —
 * it is a durable gate that fails the moment a forbidden import is introduced.
 *
 * Test files themselves (this dir + *.test.ts) are excluded — they may import
 * the tests/sdk fakes which dynamic-import @levelup/api-client.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirnameLocal = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = join(__dirnameLocal, ".."); // packages/api-client/src

const FORBIDDEN_EXACT = [
  "firebase",
  "firebase/app",
  "firebase/auth",
  "firebase/functions",
  "firebase/firestore",
  "firebase/database",
  "firebase-functions",
  "firebase-admin",
  "react",
  "@tanstack/react-query",
];

const FORBIDDEN_PATTERNS: RegExp[] = [
  /^firebase(\/|$)/,
  /^firebase-functions(\/|$)/,
  /^firebase-admin(\/|$)/,
  /^@levelup\/transport-/,
  /^@levelup\/(repositories|query|realtime|offline)(\/|$)/,
];

const NODE_BUILTINS = [
  "fs",
  "path",
  "os",
  "crypto",
  "child_process",
  "http",
  "https",
  "net",
  "stream",
  "worker_threads",
];

/** Collect all non-test .ts source files under src/. */
function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      out.push(...collectSourceFiles(full));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts") && !entry.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

/** Extract every import/require/dynamic-import specifier from a source file. */
function extractSpecifiers(code: string): string[] {
  const specs: string[] = [];
  const patterns = [
    /import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /export\s+(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) specs.push(m[1]);
  }
  return specs;
}

describe("api-client boundary purity (api-client-core §2 / §6.7)", () => {
  const files = collectSourceFiles(SRC_ROOT);

  it("there is at least one source file to scan (sanity)", () => {
    // index.ts exists from the scaffold; this guards against a glob mistake
    // silently passing the boundary checks.
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const rel = file.slice(SRC_ROOT.length + 1);
    const specs = extractSpecifiers(readFileSync(file, "utf8"));

    it(`${rel} imports no firebase/react/framework module`, () => {
      for (const s of specs) {
        expect(FORBIDDEN_EXACT, `${rel} imports forbidden '${s}'`).not.toContain(s);
        for (const p of FORBIDDEN_PATTERNS) {
          expect(p.test(s), `${rel} imports forbidden pattern '${s}'`).toBe(false);
        }
      }
    });

    it(`${rel} imports no node-only builtin (RN purity)`, () => {
      for (const s of specs) {
        const bare = s.startsWith("node:") ? s.slice(5) : s;
        expect(NODE_BUILTINS, `${rel} imports node builtin '${s}'`).not.toContain(bare);
      }
    });

    it(`${rel} does not import upward @levelup layers`, () => {
      for (const s of specs) {
        expect(
          /^@levelup\/(repositories|query|realtime|offline|transport-)/.test(s),
          `${rel} imports upward '${s}'`
        ).toBe(false);
      }
    });
  }
});
