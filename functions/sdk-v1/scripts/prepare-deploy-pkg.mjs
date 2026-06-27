#!/usr/bin/env node
/**
 * Produce a Firebase-deployable `package.json` for the bundled `v1.*` codebase.
 *
 * WHY: Firebase's cloud build runs `npm install` against the uploaded
 * `package.json`. npm rejects the `workspace:*` protocol with
 * `EUNSUPPORTEDPROTOCOL` while CONSTRUCTING the dependency tree — it validates
 * EVERY specifier (including `devDependencies`) before honoring `--omit=dev`, so
 * leaving the `@levelup/*` workspace deps in `devDependencies` still breaks the
 * cloud `npm install`. The bundle (`lib/index.js`, built by tsup just before this
 * script in the predeploy chain) has every `@levelup/*` package INLINED, so the
 * deployed function needs none of them at runtime — only the real npm packages.
 *
 * This runs as the SECOND predeploy step (after `tsup`): it backs up the full
 * workspace `package.json` to `package.json.bak` (firebase-ignored) and rewrites
 * `package.json` to drop every `workspace:`-protocol dep and the local-only
 * `devDependencies`, keeping just the external runtime `dependencies`. The local
 * tsup build already ran against the symlinked workspace deps, so stripping them
 * now does not affect the produced bundle. Restore the full manifest after the
 * deploy with:  `mv package.json.bak package.json` (or `pnpm install`).
 *
 * Idempotent: if `package.json` has no `workspace:` deps it is a no-op (so a
 * re-run, or a deploy after an interrupted one, will not clobber a restored
 * manifest with a stripped backup).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(here, '..', 'package.json');
const bakPath = join(here, '..', 'package.json.bak');

const raw = readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(raw);

const hasWorkspaceDep = (deps = {}) =>
  Object.values(deps).some((v) => typeof v === 'string' && v.startsWith('workspace:'));

if (!hasWorkspaceDep(pkg.dependencies) && !hasWorkspaceDep(pkg.devDependencies)) {
  console.log('[prepare-deploy-pkg] no workspace: deps — package.json already deploy-ready, skipping.');
  process.exit(0);
}

// Back up the canonical (workspace) manifest exactly once per strip.
writeFileSync(bakPath, raw);

const stripWorkspace = (deps = {}) =>
  Object.fromEntries(
    Object.entries(deps).filter(([, v]) => !(typeof v === 'string' && v.startsWith('workspace:'))),
  );

// Runtime deps: keep only the real (non-workspace) npm packages the inlined
// bundle imports. devDependencies are local-build-only (tsup, typescript, the
// @levelup/* workspace pkgs) and are not needed in the cloud at all — drop them.
const deployPkg = {
  ...pkg,
  dependencies: stripWorkspace(pkg.dependencies),
};
delete deployPkg.devDependencies;

writeFileSync(pkgPath, JSON.stringify(deployPkg, null, 2) + '\n');

console.log(
  '[prepare-deploy-pkg] wrote deploy package.json (workspace deps + devDependencies stripped); ' +
    'backup at package.json.bak. Restore with: mv package.json.bak package.json',
);
