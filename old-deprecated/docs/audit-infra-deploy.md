# Infra / Deploy Audit

**Scope:** firebase.json, .firebaserc, firestore.indexes.json,
firestore/storage/database rules, deploy scripts, prepare-functions-deploy,
emulator config, build artifacts. **Date:** 2026-06-27 · **Branch:**
feat/teacher-portal-latex-rendering

## BUILD-HEALTH: 🟢 GREEN

- All 6 app/website `dist/` present & fresh
  (admin/parent/student/super-admin/teacher built Jun 27; parent Apr 30; website
  present). student-web build is complete (158 files incl. KaTeX font assets for
  the LaTeX feature).
- All function `lib/` present (identity, autograde, levelup, analytics, sdk-v1,
  shared).
- Shared packages `dist/` present (shared-types, shared-services).
- No leftover deploy state: **zero** `file:` refs in function package.json,
  **no** `.local-deps/` dirs. (One ignored `functions/sdk-v1/package.json.bak`
  lingers — harmless, gitignored.)
- `firestore.indexes.json` valid JSON: 57 composite indexes / 18 collection
  groups, 1 fieldOverride.

## DONE (healthy / correctly configured)

- **firebase.json** — 5 function codebases (identity, autograde, levelup,
  analytics, sdk-v1), all nodejs20, proper `ignore` lists. 6 hosting targets,
  all with SPA `**→/index.html` rewrites + immutable cache headers on
  js/css/map. firestore/database/storage rules + indexes all wired. Emulators:
  auth 9099, functions 5001, firestore 8080, database 9000, UI 4000,
  singleProjectMode.
- **.firebaserc** — default project `lvlup-ff6fa`; all 6 hosting targets mapped
  to deploy sites.
- **prepare-functions-deploy.ts** — robust: interruption-safe
  (SIGINT/SIGTERM/SIGHUP + uncaughtException restore .bak), idempotent (.bak
  restore-first), turbo-cached shared builds, workspace:\* → file:.local-deps
  rewrite for the 4 classic codebases. Matches HEAD commit "harden … never leave
  file: state".
- **sdk-v1 prepare-deploy-pkg.mjs** — separate path; strips workspace + dev deps
  (tsup bundle inlines @levelup/\* at build), idempotent no-op when already
  clean.
- **.gitignore** — correctly ignores `functions/*/.local-deps` and
  `functions/*/package.json.bak`.
- **database.rules.json** — properly tenant-scoped (tenantId claim + uid/role
  checks).

## NEEDS-REVIEW (no blockers, but risks)

1. **Two parallel deploy mechanisms.** `scripts/deploy-functions.sh` (legacy
   bash, 4 classic only, .local-deps) appears **superseded** by
   `prepare-functions-deploy.ts` (the one wired in firebase.json + npm scripts).
   Dead script → drift/confusion risk. → delete or mark deprecated.
2. **`predeploy: []` empty for the 4 classic codebases.** A bare
   `firebase deploy --only functions` (not via `pnpm deploy:functions`) uploads
   `workspace:*` refs → cloud `npm install` fails (EUNSUPPORTEDPROTOCOL). Safe
   deploy depends entirely on the npm wrapper running `prepare` first. sdk-v1
   (which DOES run prepare in predeploy) is inconsistent with this. Note:
   postdeploy cleanup IS present for the classic 4.
3. **sdk-v1 has no postdeploy restore.** Its predeploy strips package.json →
   .bak, but nothing restores it; `deploy:functions` cleanup covers only
   ALL_CODEBASES (the 4 classic, not sdk-v1). After an sdk-v1 deploy the
   manifest stays stripped until manual `mv package.json.bak package.json`.
   Currently restored (workspace deps present) but the lingering `.bak` shows a
   past deploy — fragile.
4. **Committed compiled output.** `functions/*/lib` (.js/.js.map/.d.ts) is
   git-tracked and shows many `M` entries in status (analytics, autograde).
   `.gitignore` ignores `dist` globally but NOT `lib`, so function build output
   is committed and can drift from src. → gitignore `functions/*/lib` or rely on
   build-on-deploy.
5. **storage.rules is permissive** (out of deploy scope, flagged for security):
   any authenticated user can read/write any path — no tenant scoping, unlike
   database.rules.json. Security gap.

## BLOCKERS

- **None** for deploy mechanics or build. Everything builds and the working tree
  is in clean workspace:\* state.
