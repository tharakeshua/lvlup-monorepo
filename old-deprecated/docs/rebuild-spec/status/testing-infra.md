# Testing & Infrastructure — STATUS Report

Scope: Playwright e2e, Vitest unit/integration/schema tests, Turbo/pnpm
workspace, CI (`.github`), seeding (`scripts/seed-emulator.ts`), and the
Firebase deploy flow (`scripts/prepare-functions-deploy.ts`).

---

## 1. What currently exists & how it's architected

### 1.1 Monorepo / workspace topology

- **pnpm workspace** (`pnpm-workspace.yaml`): `apps/*`, `packages/*`,
  `functions/*`, `scripts`, `website`. Package manager pinned `pnpm@9.0.0`, node
  `>=20` (`package.json:54-58`).
- **Turbo orchestration** (`turbo.json`): tasks `build`, `dev` (persistent,
  uncached), `lint`, `typecheck`, `test`, `test:coverage`, `clean`, `deploy`.
  `build`/`test`/`typecheck` all `dependsOn: ["^build"]` so upstream packages
  build first. Build outputs cached (`dist/**`, `.next/**`, `build/**`);
  coverage cached as `coverage/**`.
- **Inconsistency**: root `package.json:6-10` declares a `workspaces` field
  (`apps/*`,`packages/*`,`functions/*`) that **omits** `scripts` and `website`
  and conflicts with the pnpm-workspace.yaml source of truth. The npm
  `workspaces` key is vestigial under pnpm.
- **Two parallel legacy repos** also live in-tree with their own configs:
  `LevelUp-App/` (own `vite.config.ts`, `vitest.config.ts`, `firebase.json`) and
  `autograde/` (own `firebase.json`, multiple sub-apps incl. `scanner-app`).
  These are not part of the active pnpm workspace test/build graph.

### 1.2 Unit / coverage tests (Vitest)

- **Base config** `vitest.config.base.ts`: v8 coverage, reporters
  `text/json/html/lcov`, global 75% threshold on
  lines/functions/branches/statements; excludes tests, configs, `scripts/`,
  mocks.
- **Workspace config** `vitest.workspace.ts` uses deprecated `defineWorkspace`
  across `.`, `packages/*`, `apps/*`, `functions/*`.
- **Per-package configs** exist for every shared package and every function
  codebase:
  `packages/{shared-stores,shared-types,shared-services,shared-utils,shared-hooks,shared-ui}/vitest.config.ts`
  and `functions/{autograde,identity,levelup,analytics}/vitest.config.ts`.
  Function configs set local 80% thresholds and
  `include: ['src/__tests__/**/*.test.ts']` (e.g.
  `functions/autograde/vitest.config.ts`).
- **Test counts (src `*.test.ts`)**: functions/identity 34, functions/levelup
  27, functions/autograde 18, functions/analytics 18; shared-services 24,
  shared-utils 6, shared-hooks 4, shared-stores 4, shared-types 1, shared-ui 1.
  `functions/shared` and `functions/test-utils` have 0.
- **Backend test style**: pure-unit with hand-rolled `vi.mock('firebase-admin')`
  stubs (see `functions/identity/src/__tests__/.../on-student-deleted.test.ts`
  header) — fast, no emulator, but brittle and duplicated across files.
- **Frontend gap**: **zero** `*.test.ts(x)` files in any `apps/*` and **no**
  `test:` block in any app `vite.config.ts` (`apps/student-web/vite.config.ts`
  is build-only). React components, pages, hooks-in-apps, and route guards have
  no unit coverage.

### 1.3 Schema validation tests

- Single suite `packages/shared-types/src/__tests__/callable-schemas.test.ts`,
  run via `pnpm test:schemas` / a dedicated `schema-tests` CI job
  (`packages/shared-types/vitest.config.ts`,
  `include: ['src/__tests__/**/*.test.ts']`). shared-types is the domain source
  of truth, so this is the most load-bearing schema gate, but it is a single
  file against a large schema surface.

### 1.4 Integration tests (Firebase emulator)

- Dir `tests/integration/` with its **own** `package.json`
  (`@levelup/integration-tests`, separate `node_modules`, `package-lock.json` —
  npm not pnpm) and `vitest.config.ts` (`fileParallelism:false`, 30s timeouts).
- `tests/integration/setup.ts`: spins Admin SDK + client SDK against emulators
  (auth 9099, firestore 8080, functions 5001), region `asia-south1`;
  `resetEmulators()` clears via emulator REST DELETE endpoints. **Hardcodes real
  project id `lvlup-ff6fa`** (not the CI's `demo-levelup`).
- Suites: `auth-flows.test.ts`, `auth-flow-extended.integration.test.ts`,
  `exam-pipeline.integration.test.ts`, `grading-pipeline.integration.test.ts`,
  `cost-tracking.integration.test.ts`, `leaderboard.integration.test.ts`,
  `space-lifecycle.integration.test.ts`, plus `firestore-rules.test.ts` and
  `firestore-rules/{role-access,tenant-isolation,write-validation}.test.ts`
  (using `@firebase/rules-unit-testing`). Good coverage of multi-tenant
  isolation, claims, pipeline state transitions, and security rules.
- Run scripts (`package.json:19-21`): `test:integration`,
  `test:integration:rules`, `test:integration:flows`. CI starts emulators via
  `firebase emulators:exec --only auth,firestore,functions --project demo-levelup`.

### 1.5 End-to-end tests (Playwright)

- **Root config** `playwright.config.ts`: `testDir: ./tests/e2e`, `workers:1`,
  `fullyParallel:false`, retries 2 in CI / 1 local, 60s default timeout,
  `video:'on'`, `trace:'on-first-retry'`, screenshot only-on-failure. Screenshot
  diff tolerances set for visual regression.
- **~18 projects** mapping per-app `baseURL` to fixed dev ports: super-admin
  4567, admin-web 4568, teacher-web 4569, student-web 4570, parent-web 4571
  (ports match `start.sh:23-27`). Plus `autograde` (300s timeout), `cross-role`,
  `seed-subhang`, per-subject "learner-cycle-4" projects (600s timeouts),
  `feature-audit-c5`, `regression-c3`, mobile (iPhone 14) and tablet (iPad)
  variants grepped by `@mobile`/`@tablet`/`Authentication`, and
  `visual-regression`.
- **Per-app spec files** are very large: `teacher-web.spec.ts` ~152KB,
  `student-web.spec.ts` ~88KB, `parent-web.spec.ts` ~59KB, `super-admin.spec.ts`
  ~53KB, plus `autograde-full-flow.spec.ts`, `cross-role-flows.spec.ts`,
  `visual-regression.spec.ts`, `item-testing.spec.ts`.
- **Helpers** `tests/e2e/helpers/`: `auth.ts` (login flows: direct, school-code
  2-step, roll-number, consumer; logout; retry helpers), `seed-guards.ts`
  (health-check + retry wrappers replacing `test.skip`), `selectors.ts`,
  `autograde-seed.ts` (idempotent Admin-SDK seed for autograde flow,
  emulator-aware via env), `autograde-pipeline-waiter.ts`.
- **One-off "evolution cycle" artifacts**: many `*-cycle-N.spec.ts` + matching
  `*.config.ts` + JSON outputs under `tests/e2e/reports/`
  (`EVOLUTION-FINAL-REPORT.json`, `learner-*-cycle-*.json`, etc.). These are
  throwaway audit harnesses, not a stable regression suite. There are **also
  nested configs**: `tests/e2e/playwright.config.ts` and many per-cycle configs
  duplicating settings.
- **No `webServer`** block in any Playwright config — tests assume dev servers
  are already running on the fixed ports. CI's `e2e` job runs
  `pnpm run test:e2e` **without launching any app**, so it cannot pass as
  written.

### 1.6 Seeding

- **Emulator seed** `scripts/seed-emulator.ts` (~80KB): one super-admin, 2
  tenants (GRN001, RVS002), session, 5 classes, admin + 4 teachers, 20 students,
  8 parents, 5 spaces w/ story points + items, 3 autograde exams, progress +
  chat. Idempotent (clears first). Builds custom claims with
  `MAX_CLAIM_CLASS_IDS = 15` overflow logic. Run via `pnpm seed:emulator`
  (`package.json:23`).
- **Production / config-driven seeds**: `scripts/seed-production.ts` (~86KB),
  `seed-production-enhanced.ts` (~48KB), `seed-subhang.ts`,
  `seed-add-students.ts`, and `scripts/seed-configs/` (subhang-accounts,
  `hi-hld/`, `hi-lld/`, `hi-behavioral/` content modules — ~30 per-topic content
  files). Plus `seed-hi-hld.ts`, `seed-hi-lld.ts`, `attach-hld-diagrams.ts`,
  etc.
- **Ad-hoc migration/fix scripts**: `fix-fill-blanks.ts`,
  `fix-item-payloads.ts`, `fix-teacher-claims.ts`,
  `migrate-items-to-storypoints.ts`, `reset-passwords.ts`,
  `reset-stuck-submissions.ts`, `nuke-progress.ts`, `inspect-*.ts`,
  `scripts/migration/`. No migration framework or versioning — these are loose
  tsx scripts.

### 1.7 Firebase deploy flow

- `firebase.json`: 4 function codebases (`identity`, `autograde`, `levelup`,
  `analytics`), each nodejs20 with pre/post-deploy hooks calling
  `prepare-functions-deploy.ts`. 6 hosting targets (5 apps + website) with
  immutable cache headers + SPA rewrites. Firestore rules+indexes, RTDB rules,
  storage rules, emulators (auth 9099, functions 5001, firestore 8080, db 9000,
  UI 4000, singleProjectMode).
- **`scripts/prepare-functions-deploy.ts`**: works around Firebase CLI's
  inability to resolve pnpm `workspace:*`. `prepare`: builds
  `@levelup/shared-types`, `@levelup/shared-services`,
  `@levelup/functions-shared`; copies their `dist`/`lib` into each function's
  `.local-deps/`; rewrites `workspace:*` → `file:.local-deps/...`; backs up
  `package.json` → `.bak`; compiles function TS. `cleanup`: restores `.bak`,
  removes `.local-deps/`. Handles interrupted runs by restoring `.bak` on next
  prepare. Driven by `npm run deploy:functions` (prepare → deploy → cleanup) and
  Firebase pre/post hooks.
- **`.firebaserc`**: default project `lvlup-ff6fa`, hosting targets mapped to
  per-app sites.

### 1.8 CI / CD (`.github/workflows/`)

- **`ci.yml`** (push/PR to main/develop): jobs `lint` (eslint + prettier
  --check), `typecheck` (turbo), `build` (uploads `*/dist`, `functions/*/lib`
  artifacts, 1d retention), `test` (coverage → Codecov + PR comment),
  `integration` (emulators via
  `firebase emulators:exec ... --project demo-levelup`), `e2e` (playwright +
  report artifacts), `lighthouse` (PR only, `lighthouserc.js`),
  `visual-regression`, `schema-tests`, `coverage-gates` (per-package bash
  thresholds: identity 75, analytics/levelup 80, autograde 75, shared-types 90,
  etc.), `flaky-test-monitor` (greps retry data), `all-checks` aggregate gate.
- **`deploy.yml`** (push to main): `deploy-functions` (build →
  `pnpm run deploy:functions`), `deploy-hosting`
  (`firebase deploy --only hosting`), `preview-deploy` (PR hosting channels,
  7d). Uses `FIREBASE_TOKEN` secret.
- **`flaky` quarantine doc** `tests/FLAKY.md` describes the process; currently
  empty quarantine list. `@flaky` tagging convention defined.
- **Husky** `.husky/pre-commit` → `npx lint-staged` (prettier only). No
  type/lint/test pre-push.
- **Lighthouse** `lighthouserc.js`: 3 runs/url across 5 apps' `/` and `/login`,
  perf/a11y/best-practices/seo as **warn** (non-blocking), desktop preset.

---

## 2. Entities / schemas / collections / APIs / routes involved (with file paths)

- **Domain model source**: `packages/shared-types/src` (identity, tenant,
  content, levelup, autograde, progress, analytics, gamification, notification,
  schemas, callable-types). Schema gate:
  `packages/shared-types/src/__tests__/callable-schemas.test.ts`.
- **Access model exercised by tests**: `firestore.rules` +
  `firestore.indexes.json`, validated by
  `tests/integration/firestore-rules.test.ts` and
  `tests/integration/firestore-rules/{role-access,tenant-isolation,write-validation}.test.ts`.
- **Collections touched by integration/seed**: `users`, tenants, academic
  sessions, classes, teacher/student/parent entities, spaces + storyPoints +
  items, autograde exams/questions/submissions, progress, leaderboard, daily
  cost summaries (see `tests/integration/*.integration.test.ts` and
  `scripts/seed-emulator.ts` header).
- **Callable functions / pipeline states** asserted: auth/claims flows
  (`auth-flows.test.ts`), exam pipeline status transitions
  uploaded→extracted→graded (`exam-pipeline.integration.test.ts`,
  `grading-pipeline.integration.test.ts`), cost quotas
  (`cost-tracking.integration.test.ts`), leaderboard tie-breaking
  (`leaderboard.integration.test.ts`). Functions region `asia-south1`
  (`tests/integration/setup.ts:90`).
- **Routes (E2E baseURLs / ports)**: super-admin 4567, admin-web 4568,
  teacher-web 4569, student-web 4570, parent-web 4571
  (`playwright.config.ts:29-141`, `start.sh:23-27`). Login route patterns
  `/login`, story points `/story-points/` (per MEMORY notes).
- **Deploy entities**: function codebases + hosting targets in `firebase.json`;
  project mapping in `.firebaserc`.

---

## 3. Strengths worth keeping

1. **Layered test pyramid is conceptually right**: pure unit (mocked admin SDK)
   → emulator integration → security-rules tests → Playwright e2e → visual
   regression → Lighthouse. The intent and CI wiring cover the full pyramid.
2. **Strong security-rules + multi-tenant isolation coverage**
   (`firestore-rules/` suite + `auth-flows.test.ts`) — these are the
   highest-risk areas and are tested against real emulator semantics.
3. **Per-package coverage gates** with differentiated thresholds (shared-types
   90%, functions 75–80%) encode where rigor matters most.
4. **The `prepare-functions-deploy.ts` workaround is robust** — idempotent,
   handles interrupted runs, cleanly separates per-codebase deploys. The
   4-codebase split keeps deploy blast radius small.
5. **Emulator-aware, idempotent seed helpers** (`autograde-seed.ts`,
   `seed-emulator.ts`) that build correct custom claims (incl. class-id overflow
   handling) — directly reusable.
6. **E2E auth helpers** (`auth.ts`) already encode every login modality
   (school-code, roll-number, consumer) and resilient retry/health-check
   patterns (`seed-guards.ts`).
7. **Config-driven content seeds** (`scripts/seed-configs/`) separate content
   data from seed logic — a good pattern to formalize.
8. **CI hygiene**: concurrency cancellation, frozen-lockfile installs,
   build-artifact reuse across jobs, flaky-test monitor, Codecov PR comments,
   preview hosting channels.

---

## 4. Pain points / tech debt / inconsistencies

1. **E2E cannot run in CI as configured**: no `webServer` in any Playwright
   config; the CI `e2e` job runs `pnpm run test:e2e` without starting the 5 apps
   or emulators/seed. Tests target hardcoded localhost ports that nothing binds
   in CI.
2. **Project-id mismatch**: integration `setup.ts` hardcodes `lvlup-ff6fa`, but
   CI runs emulators with `--project demo-levelup` →
   claims/paths/rules-unit-testing context can diverge.
3. **Integration suite is a workspace island**: its own `package.json` +
   `package-lock.json` + `node_modules` (npm, not pnpm). Not in the pnpm graph,
   so versions drift (`firebase@^11` here vs Admin `13`), and
   `pnpm install --frozen-lockfile` doesn't manage it.
4. **Zero frontend unit tests**: no app has a Vitest `test:` block or any
   component/page/hook test. All UI confidence rests on heavyweight, flaky e2e.
5. **E2E suite is bloated and partly disposable**: 150KB+ monolithic specs plus
   a large pile of one-off `*-cycle-N` "evolution" specs/configs/JSON reports
   committed under `tests/e2e/`. No clear separation between durable regression
   specs and throwaway audit runs. Many duplicated nested Playwright configs.
6. **`workers:1` + `fullyParallel:false` + 600s timeouts**: e2e is serial and
   extremely slow; some projects allow 5–10 minute single tests. Not viable as a
   PR gate.
7. **Committed build output**: `functions/*/lib` compiled JS + `.js.map` are
   tracked in git (git status shows dozens of modified `lib/*.js`). Build
   artifacts in source control cause noisy diffs and drift vs `src`.
8. **Schema coverage is thin**: one `callable-schemas.test.ts` file guards the
   entire shared-types domain that is the platform's source of truth.
9. **Coverage-gates job is fragile bash**: relies on `bc`,
   `coverage-summary.json` presence, and per-package `cd`; silently continues if
   a package lacks the summary (no `json-summary` reporter is configured in
   `vitest.config.base.ts`, which only emits `text/json/html/lcov`).
10. **No emulator usage in unit tests + hand-rolled `firebase-admin` mocks**
    duplicated across 30+ files → high maintenance, mocks drift from real SDK
    behavior.
11. **Lighthouse uses different ports (4570–4574)** than the canonical app ports
    (4567–4571) and is warn-only (never fails). `numberOfRuns:3` x 5 apps x 2
    urls is slow for a PR.
12. **Secrets in repo**: a Firebase Admin service-account JSON
    (`lvlup-ff6fa-firebase-adminsdk-*.json`) is committed at repo root — a
    security issue and a deploy-config smell.
13. **No flake reality**: `FLAKY.md` quarantine is empty despite serial+retry
    config implying flakiness is the working assumption; monitor only greps JSON
    for `"retry"`.
14. **Two legacy app trees** (`LevelUp-App/`, `autograde/`) carry their own
    firebase.json/vitest/vite configs, inflating the test/build surface and
    confusing "which config is canonical."
15. **`deploy:functions` failure handling**: the npm script uses `;` so cleanup
    runs even on deploy failure, but a crash before cleanup leaves
    `.local-deps/` and `package.json.bak` around (mitigated by next prepare, but
    messy).

---

## 5. Concrete recommendations for the fresh rebuild

### 5.1 Tooling baseline

- Keep **pnpm + Turbo**, but make `pnpm-workspace.yaml` the single source and
  **delete the npm `workspaces` field** from root `package.json`. Adopt **Vitest
  workspace projects** (the v3+ `projects` API in one root config) instead of
  the deprecated `defineWorkspace` + scattered per-package configs; share
  thresholds via one base.
- **Stop committing `functions/*/lib`**: add to `.gitignore`, build in
  CI/predeploy only. Same for any `dist`.
- **Remove the committed service-account JSON**; use Workload Identity
  Federation or a CI secret. Rotate the leaked key.

### 5.2 Common API layer (prerequisite for RN)

- Introduce a **typed API/SDK package** (`packages/api-client`) that wraps every
  callable/HTTP endpoint, generated/validated from the shared-types Zod schemas.
  Both web and future React Native apps consume this one client — no direct
  Firestore SDK calls from UI. This makes the API the testable seam and
  decouples transport (callable vs REST/tRPC gateway).
- **Contract tests**: for every callable, a Vitest contract test that validates
  request/response against the Zod schema (run against emulator). This replaces
  the thin single `callable-schemas.test.ts` and becomes the durable backend
  gate. Co-locate request/response schemas in shared-types and assert both
  directions.

### 5.3 Unit tests

- **Eliminate hand-rolled `firebase-admin` mocks**: extract DB access behind a
  thin repository interface in `functions/shared` and unit-test business logic
  against an in-memory fake; reserve real SDK behavior for emulator integration
  tests.
- **Add frontend unit tests**: give each app/shared-ui package a Vitest + React
  Testing Library setup (`jsdom`), test reducers/stores (`shared-stores`), hooks
  (`shared-hooks`), pure render of critical components and route guards. Target
  60–70% on shared packages, smaller but non-zero on apps.
- Configure the `json-summary` coverage reporter so the per-package gate can
  actually read `coverage-summary.json`; replace the bash gate with Vitest's
  built-in `thresholds` per project (fail fast, no `bc`).

### 5.4 Integration tests

- **Fold `tests/integration` into the pnpm workspace** (no private npm
  lockfile). One firebase project id everywhere — use a fixed demo id (e.g.
  `demo-levelup`) in both `setup.ts` and CI. Provide a single
  `firebase emulators:exec` wrapper script that seeds then runs the suite, so
  it's runnable locally and in CI identically.
- Keep the **security-rules suites** as-is (they're the crown jewel) but
  parameterize project id and run them under the same emulator session as
  integration.

### 5.5 E2E

- **Add a `webServer` array** to Playwright config (or an emulator+app
  orchestration script) so `pnpm test:e2e` boots emulators, seeds, and starts
  all apps deterministically — locally and in CI. Until then the CI e2e job is
  dead weight.
- **Delete the one-off `*-cycle-N` "evolution" specs/configs/JSON** (or move to
  an `archive/`); keep a lean, durable regression suite per role plus
  `cross-role`. Split the 150KB monolith specs into focused files by feature.
- **Re-enable parallelism**: per-app projects can run in parallel with isolated
  seeded tenants (the `autograde-seed.ts` pattern of per-suite idempotent
  tenants generalizes well). Cap per-test timeout to ~90s; investigate any test
  needing 600s.
- **Stabilize selectors**: standardize on `data-testid` across apps (helpers
  already lean this way) to cut flakiness; this also lets the same e2e helpers
  drive future RN apps via Playwright/Detox-style abstractions.
- **Future React Native**: structure e2e helpers as a transport-agnostic
  page-object layer; share the seed + auth-helper + typed API client between web
  Playwright and RN (Detox/Maestro) suites.

### 5.6 Seeding

- Promote the **config-driven seed pattern** (`scripts/seed-configs/`) into a
  first-class `packages/seed` engine: declarative tenant/class/space/exam
  configs + a `BatchWriter`/`ensureAuthUser` core, idempotent, emulator-and-prod
  aware (one code path, env-switched). Consolidate the ~15 ad-hoc
  `seed-*/fix-*/migrate-*` scripts into versioned, named migrations with a tiny
  runner.

### 5.7 CI/CD

- Make `e2e` and `lighthouse` **non-blocking nightly** (or PR-label gated) given
  their cost; keep `lint/typecheck/build/test/integration/schema(contract)` as
  the fast required PR gate.
- Align Lighthouse ports with canonical app ports; consider dropping to 1–2 urls
  in PR, full sweep nightly.
- Keep `prepare-functions-deploy.ts` but add a `trap`/`try-finally` so cleanup
  always runs even on deploy crash; or migrate functions to a bundler
  (esbuild/tsup) that inlines shared deps and removes the `.local-deps` dance
  entirely.
- Retire the two legacy trees (`LevelUp-App/`, `autograde/`) or move them out of
  the active workspace so there is exactly one canonical
  `firebase.json`/test/build graph.

---

## 6. Key file index

- Workspace/build: `package.json`, `pnpm-workspace.yaml`, `turbo.json`,
  `tsconfig.json`
- Unit/coverage: `vitest.config.base.ts`, `vitest.workspace.ts`,
  `packages/*/vitest.config.ts`, `functions/*/vitest.config.ts`
- Schema: `packages/shared-types/src/__tests__/callable-schemas.test.ts`,
  `packages/shared-types/vitest.config.ts`
- Integration:
  `tests/integration/{setup.ts,vitest.config.ts,package.json,*.test.ts}`,
  `tests/integration/firestore-rules/*.test.ts`
- E2E: `playwright.config.ts`, `tests/e2e/*.spec.ts`, `tests/e2e/helpers/*`,
  `tests/e2e/playwright.config.ts`, `tests/FLAKY.md`
- Seed: `scripts/seed-emulator.ts`, `scripts/seed-configs/*`,
  `scripts/seed-production*.ts`, `tests/e2e/helpers/autograde-seed.ts`
- Deploy: `firebase.json`, `.firebaserc`, `scripts/prepare-functions-deploy.ts`,
  `scripts/deploy-functions.sh`
- CI: `.github/workflows/{ci.yml,deploy.yml,README.md}`, `lighthouserc.js`,
  `.husky/pre-commit`
- Access model: `firestore.rules`, `firestore.indexes.json`, `storage.rules`,
  `database.rules.json`
