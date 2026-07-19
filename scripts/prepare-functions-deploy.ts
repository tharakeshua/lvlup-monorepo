#!/usr/bin/env node
/**
 * prepare-functions-deploy.ts
 *
 * Resolves pnpm workspace:* dependencies for Firebase Cloud Functions deployment.
 * Firebase CLI cannot handle the workspace:* protocol, so this script:
 *
 *   prepare: Builds shared packages, copies their dist into .local-deps/,
 *            rewrites workspace:* → file: refs, and compiles each function's TS.
 *   cleanup: Restores original package.json and removes .local-deps/.
 *
 * Usage:
 *   npx tsx scripts/prepare-functions-deploy.ts prepare [codebase...]
 *   npx tsx scripts/prepare-functions-deploy.ts cleanup [codebase...]
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, "..");
const FUNCTIONS_DIR = path.join(ROOT_DIR, "functions");
const PACKAGES_DIR = path.join(ROOT_DIR, "packages");

// Workspace packages in packages/
const WORKSPACE_PACKAGES: Record<string, string> = {
  "@levelup/domain": "domain",
  "@levelup/api-contract": "api-contract",
  "@levelup/shared-types": "shared-types",
  "@levelup/shared-services": "shared-services",
};

// Workspace packages in functions/ (sibling function codebases)
const FUNCTIONS_WORKSPACE_PACKAGES: Record<string, string> = {
  "@levelup/functions-shared": "shared",
};

const ALL_CODEBASES = ["identity", "autograde", "levelup", "analytics"];

// ---------------------------------------------------------------------------
// Interruption safety
//
// Once a codebase's package.json has been rewritten to file:.local-deps refs,
// it is in a state that must NEVER be left behind (let alone committed). Track
// every in-flight codebase and restore it from its .bak on ANY abnormal exit
// (Ctrl-C, kill, uncaught error) so the working tree is always returned to its
// committed workspace:* state.
// ---------------------------------------------------------------------------

const IN_FLIGHT = new Set<string>();
let restoring = false;

function restoreInFlight(): void {
  if (restoring) return;
  restoring = true;
  for (const cb of IN_FLIGHT) {
    try {
      cleanupFunction(cb);
    } catch (err) {
      console.error(`  Failed to restore ${cb} on exit:`, err);
    }
  }
  IN_FLIGHT.clear();
}

for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
  process.on(sig, () => {
    console.error(`\n!!! Received ${sig} — restoring package.json files...`);
    restoreInFlight();
    process.exit(1);
  });
}
process.on("uncaughtException", (err) => {
  console.error("\n!!! Uncaught exception — restoring package.json files...", err);
  restoreInFlight();
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function exec(cmd: string, cwd: string = ROOT_DIR): void {
  execSync(cmd, { cwd, stdio: "inherit" });
}

// ---------------------------------------------------------------------------
// Build shared packages (turbo-cached — fast on repeat calls)
// ---------------------------------------------------------------------------

let sharedBuilt = false;

function buildSharedPackages(): void {
  if (sharedBuilt) return;
  console.log(">>> Building shared packages...");
  exec("pnpm run --filter @levelup/domain build");
  exec("pnpm run --filter @levelup/api-contract build");
  exec("pnpm run --filter @levelup/shared-types build");
  exec("pnpm run --filter @levelup/shared-services build");
  exec("pnpm run --filter @levelup/functions-shared build");
  sharedBuilt = true;
  console.log("  Shared packages built\n");
}

// ---------------------------------------------------------------------------
// Prepare a single function codebase for Firebase deploy
// ---------------------------------------------------------------------------

function prepareFunction(codebase: string): void {
  const funcDir = path.join(FUNCTIONS_DIR, codebase);
  if (!fs.existsSync(funcDir)) {
    console.warn(`  Skipping ${codebase} — directory not found`);
    return;
  }

  console.log(`>>> Preparing ${codebase}...`);

  const pkgPath = path.join(funcDir, "package.json");
  const bakPath = path.join(funcDir, "package.json.bak");

  // 1. If a .bak exists from a previous interrupted run, restore it first
  if (fs.existsSync(bakPath)) {
    console.log(`  Restoring package.json from previous backup...`);
    fs.copyFileSync(bakPath, pkgPath);
    fs.unlinkSync(bakPath);
  }

  // 2. Create / clean .local-deps
  const localDepsDir = path.join(funcDir, ".local-deps");
  if (fs.existsSync(localDepsDir)) {
    fs.rmSync(localDepsDir, { recursive: true });
  }
  fs.mkdirSync(localDepsDir, { recursive: true });

  // 3. Read the original package.json and back it up. From the moment a .bak
  //    exists this codebase is "in flight" — if the process dies before cleanup,
  //    the signal/exception handlers restore it from the .bak.
  const pkgRaw = fs.readFileSync(pkgPath, "utf-8");
  const pkg = JSON.parse(pkgRaw);
  fs.writeFileSync(bakPath, pkgRaw);
  IN_FLIGHT.add(codebase);

  // 4. Copy each needed workspace package's dist + patched package.json
  for (const [pkgName, dirName] of Object.entries(WORKSPACE_PACKAGES)) {
    const inDeps = pkg.dependencies?.[pkgName] === "workspace:*";
    const inDevDeps = pkg.devDependencies?.[pkgName] === "workspace:*";
    if (!inDeps && !inDevDeps) continue;

    const srcDir = path.join(PACKAGES_DIR, dirName);
    const destDir = path.join(localDepsDir, dirName);

    // Copy dist/
    const srcDist = path.join(srcDir, "dist");
    if (!fs.existsSync(srcDist)) {
      throw new Error(`${pkgName} dist not found at ${srcDist}. Build shared packages first.`);
    }
    copyDirSync(srcDist, path.join(destDir, "dist"));

    // Copy & patch the shared package's own package.json
    const sharedPkg = JSON.parse(fs.readFileSync(path.join(srcDir, "package.json"), "utf-8"));
    for (const section of ["dependencies", "devDependencies"] as const) {
      if (!sharedPkg[section]) continue;
      for (const [dep, ver] of Object.entries(sharedPkg[section])) {
        if (ver === "workspace:*" && dep in WORKSPACE_PACKAGES) {
          sharedPkg[section][dep] = `file:../${WORKSPACE_PACKAGES[dep]}`;
        }
      }
    }
    // Remove peerDependencies not needed in Cloud Functions
    delete sharedPkg.peerDependencies;
    fs.writeFileSync(path.join(destDir, "package.json"), JSON.stringify(sharedPkg, null, 2));

    console.log(`  Bundled ${pkgName}`);
  }

  // 4b. Copy sibling function workspace packages (e.g. functions-shared)
  for (const [pkgName, dirName] of Object.entries(FUNCTIONS_WORKSPACE_PACKAGES)) {
    const inDeps = pkg.dependencies?.[pkgName] === "workspace:*";
    const inDevDeps = pkg.devDependencies?.[pkgName] === "workspace:*";
    if (!inDeps && !inDevDeps) continue;

    const srcDir = path.join(FUNCTIONS_DIR, dirName);
    const destDir = path.join(localDepsDir, dirName);

    // Copy lib/ (functions-shared uses lib/ not dist/)
    const srcLib = path.join(srcDir, "lib");
    if (!fs.existsSync(srcLib)) {
      // Try building it first
      console.log(`  Building ${pkgName}...`);
      exec("npm run build", srcDir);
    }
    if (fs.existsSync(srcLib)) {
      copyDirSync(srcLib, path.join(destDir, "lib"));
    }

    // Copy & patch the package's own package.json
    const sharedPkg = JSON.parse(fs.readFileSync(path.join(srcDir, "package.json"), "utf-8"));
    // Remove workspace refs from the shared function package too
    for (const section of ["dependencies", "devDependencies"] as const) {
      if (!sharedPkg[section]) continue;
      for (const [dep, ver] of Object.entries(sharedPkg[section])) {
        if (typeof ver === "string" && ver.startsWith("workspace:")) {
          if (dep in WORKSPACE_PACKAGES) {
            sharedPkg[section][dep] = `file:../${WORKSPACE_PACKAGES[dep]}`;
          } else if (dep in FUNCTIONS_WORKSPACE_PACKAGES) {
            sharedPkg[section][dep] = `file:../${FUNCTIONS_WORKSPACE_PACKAGES[dep]}`;
          }
        }
      }
    }
    delete sharedPkg.peerDependencies;
    fs.writeFileSync(path.join(destDir, "package.json"), JSON.stringify(sharedPkg, null, 2));

    console.log(`  Bundled ${pkgName}`);
  }

  // 5. Rewrite function's package.json: workspace:* → file:.local-deps/...
  const allWorkspacePackages = { ...WORKSPACE_PACKAGES, ...FUNCTIONS_WORKSPACE_PACKAGES };
  for (const section of ["dependencies", "devDependencies"] as const) {
    if (!pkg[section]) continue;
    for (const [name, version] of Object.entries(pkg[section])) {
      if (version === "workspace:*" && name in allWorkspacePackages) {
        pkg[section][name] = `file:.local-deps/${allWorkspacePackages[name]}`;
      }
    }
  }
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

  // 6. Build the function's TypeScript (uses existing pnpm-linked node_modules)
  console.log(`  Compiling TypeScript...`);
  exec("npm run build", funcDir);

  console.log(`  ${codebase} ready\n`);
}

// ---------------------------------------------------------------------------
// Cleanup after deploy
// ---------------------------------------------------------------------------

function cleanupFunction(codebase: string): void {
  const funcDir = path.join(FUNCTIONS_DIR, codebase);

  const bakPath = path.join(funcDir, "package.json.bak");
  if (fs.existsSync(bakPath)) {
    fs.copyFileSync(bakPath, path.join(funcDir, "package.json"));
    fs.unlinkSync(bakPath);
  }

  const localDepsDir = path.join(funcDir, ".local-deps");
  if (fs.existsSync(localDepsDir)) {
    fs.rmSync(localDepsDir, { recursive: true });
  }

  IN_FLIGHT.delete(codebase);
  console.log(`  ${codebase} cleaned up`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const [action = "prepare", ...codebaseArgs] = process.argv.slice(2);
const codebases = codebaseArgs.length > 0 ? codebaseArgs : ALL_CODEBASES;

switch (action) {
  case "prepare":
    console.log("=== Preparing Cloud Functions for deployment ===\n");
    buildSharedPackages();
    for (const cb of codebases) {
      prepareFunction(cb);
    }
    console.log("=== All functions prepared ===");
    break;

  case "cleanup":
    console.log("=== Cleaning up after deployment ===\n");
    for (const cb of codebases) {
      cleanupFunction(cb);
    }
    console.log("=== Cleanup complete ===");
    break;

  default:
    console.error(`Unknown action: ${action}. Use "prepare" or "cleanup".`);
    process.exit(1);
}
