/**
 * import-graph — a tiny, dependency-free static import scanner used by the
 * lint-boundaries "lint gates as tests" (SDK-LAYERS-PLAN §1.2 dependency edges +
 * sdk-plan/layers/lint-boundaries.md §2 boundary matrix R1–R14, §5 dependency-
 * cruiser DAG, §6 RN-purity).
 *
 * Why a hand-rolled scanner and not dependency-cruiser/esbuild: those run as
 * CI shell steps (lint-boundaries §8.1) and need a built graph + installed dev
 * deps. These are *vitest* assertions that must run with `pnpm install` NOT
 * having happened yet (author-only constraint) and while most packages are
 * scaffolds. So we read `.ts` source text and extract the module specifiers of
 * every static/dynamic import + re-export + `require`, with zero deps.
 *
 * This is deliberately conservative: it matches specifier *strings*, not a
 * resolved module graph. It will not catch a transitive leak (that is what the
 * CI dependency-cruiser + RN-purity bundle steps in §5/§6 are for). It DOES
 * catch every direct import-path boundary violation, which is the bulk of the
 * R-matrix and the part that can be proven without installing/building.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

/** Repo root = three levels up from tests/sdk/harness/. */
export const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");

export interface ImportRef {
  /** absolute file the import was found in */
  file: string;
  /** repo-relative file path (posix) */
  rel: string;
  /** the raw module specifier, e.g. 'firebase/firestore' or '@levelup/api-client' */
  specifier: string;
  /** the line text (trimmed) for diagnostics */
  line: string;
}

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "lib",
  "build",
  ".next",
  "coverage",
  ".turbo",
  ".git",
  "__tests__", // test files may import firebase fakes etc. — never a boundary violation
]);

const SOURCE_EXT = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);

/** Recursively list source files under `dir` (skips node_modules/dist/tests). */
export function listSourceFiles(dir: string, opts?: { includeTests?: boolean }): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  const includeTests = opts?.includeTests ?? false;
  const walk = (d: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(d);
    } catch {
      return;
    }
    for (const name of entries) {
      if (SKIP_DIRS.has(name) && !(includeTests && name === "__tests__")) continue;
      const full = path.join(d, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walk(full);
      } else if (SOURCE_EXT.has(path.extname(name))) {
        // skip *.test.* and *.spec.* and d.ts by default
        if (!includeTests && /\.(test|spec)\.[cm]?[jt]sx?$/.test(name)) continue;
        if (name.endsWith(".d.ts")) continue;
        out.push(full);
      }
    }
  };
  walk(dir);
  return out;
}

const IMPORT_RE = [
  // import ... from 'x'  |  import 'x'  |  export ... from 'x'
  /(?:^|\n)\s*(?:import|export)\b[^;\n]*?from\s*['"]([^'"]+)['"]/g,
  /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g,
  // import('x')  (dynamic)
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // require('x')
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

/** Extract every imported module specifier from a single source file. */
export function importsOf(file: string): ImportRef[] {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const rel = path.relative(REPO_ROOT, file).split(path.sep).join("/");
  const refs: ImportRef[] = [];
  for (const re of IMPORT_RE) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const specifier = m[1];
      // best-effort line text
      const idx = m.index;
      const lineStart = text.lastIndexOf("\n", idx) + 1;
      const lineEnd = text.indexOf("\n", idx);
      const line = text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim();
      refs.push({ file, rel, specifier, line });
    }
  }
  return refs;
}

/** Scan a set of roots (absolute dirs) and return every import ref. */
export function scanImports(roots: string[], opts?: { includeTests?: boolean }): ImportRef[] {
  const refs: ImportRef[] = [];
  for (const root of roots) {
    for (const f of listSourceFiles(root, opts)) refs.push(...importsOf(f));
  }
  return refs;
}

/** Absolute path of an SDK package's `src` dir (may not exist yet). */
export function pkgSrc(pkg: string): string {
  return path.join(REPO_ROOT, "packages", pkg, "src");
}

/** Absolute path of an app's `src` dir. */
export function appSrc(app: string): string {
  return path.join(REPO_ROOT, "apps", app, "src");
}

/** True if the package has any non-test source beyond a bare index scaffold. */
export function hasRealSource(pkg: string): boolean {
  const src = pkgSrc(pkg);
  const files = listSourceFiles(src);
  // a scaffold is a single index.ts; "real" source is anything more.
  return files.length > 1 || files.some((f) => !/index\.[cm]?tsx?$/.test(path.basename(f)));
}

/** List of app dir names that exist under apps/. */
export function listApps(): string[] {
  const appsDir = path.join(REPO_ROOT, "apps");
  if (!existsSync(appsDir)) return [];
  return readdirSync(appsDir).filter((n) => existsSync(path.join(appsDir, n, "src")));
}

/** List of SDK package dir names that exist under packages/. */
export function listPackages(): string[] {
  const dir = path.join(REPO_ROOT, "packages");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => existsSync(path.join(dir, n, "src")));
}

// ---- specifier classifiers (the boundary predicates) -----------------------

export const isFirebaseAny = (s: string): boolean =>
  s === "firebase" ||
  s.startsWith("firebase/") ||
  s === "firebase-admin" ||
  s.startsWith("firebase-admin/") ||
  s === "firebase-functions" ||
  s.startsWith("firebase-functions/");

export const isFirestore = (s: string): boolean =>
  s === "firebase/firestore" ||
  s.startsWith("firebase/firestore/") ||
  s === "firebase-admin/firestore" ||
  s.startsWith("firebase-admin/firestore") ||
  s === "@google-cloud/firestore" ||
  s.startsWith("@google-cloud/firestore/");

export const isFirebaseFunctions = (s: string): boolean =>
  s === "firebase-functions" || s.startsWith("firebase-functions/");

export const isFirebaseAdmin = (s: string): boolean =>
  s === "firebase-admin" || s.startsWith("firebase-admin/");

export const isReact = (s: string): boolean =>
  s === "react" ||
  s === "react-dom" ||
  s.startsWith("react-dom/") ||
  s === "@tanstack/react-query" ||
  s.startsWith("@tanstack/");

export const isNodeBuiltin = (s: string): boolean => {
  if (s.startsWith("node:")) return true;
  const bare = s.split("/")[0];
  return NODE_BUILTINS.has(bare);
};

export const isSecrets = (s: string): boolean =>
  s === "@google-cloud/secret-manager" || s.startsWith("@google-cloud/secret-manager/");

export const isDeepLevelup = (s: string): boolean => {
  if (!s.startsWith("@levelup/")) return false;
  // allowed: '@levelup/x' and the declared './testing' subpath; banned: src/dist/internal deep paths
  return /^@levelup\/[^/]+\/(src|dist|lib|internal)(\/|$)/.test(s);
};

export const isTransportPkg = (s: string): boolean =>
  s === "@levelup/transport-firebase" || s === "@levelup/transport-http";

export const isClientBrainPkg = (s: string): boolean =>
  [
    "@levelup/query",
    "@levelup/repositories",
    "@levelup/realtime",
    "@levelup/offline",
    "@levelup/transport-firebase",
    "@levelup/transport-http",
    "@levelup/api-client",
  ].includes(s);

/** node builtins we forbid in the RN-pure graph (lint-boundaries §6.2 step 4). */
export const NODE_BUILTINS = new Set([
  "assert",
  "async_hooks",
  "buffer",
  "child_process",
  "cluster",
  "crypto",
  "dgram",
  "dns",
  "events",
  "fs",
  "http",
  "http2",
  "https",
  "module",
  "net",
  "os",
  "path",
  "perf_hooks",
  "process",
  "querystring",
  "readline",
  "stream",
  "string_decoder",
  "timers",
  "tls",
  "tty",
  "url",
  "util",
  "v8",
  "vm",
  "worker_threads",
  "zlib",
]);

/** Pretty offender list for assertion messages. */
export function fmt(refs: ImportRef[]): string {
  return refs.map((r) => `  ${r.rel}: ${r.specifier}  (${r.line})`).join("\n");
}
