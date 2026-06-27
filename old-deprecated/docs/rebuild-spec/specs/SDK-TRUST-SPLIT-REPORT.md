# SDK Trust-Split Verification Report

**Phase 5 (integrate) — Track B, Step 2.** Verifies the trust split +
no-direct-Firestore + end-to-end typecheck across the rebuilt `@levelup/*` SDK.

- **Arbiter:** `docs/rebuild-spec/specs/SDK-LAYERS-PLAN.md` (FROZEN) +
  `sdk-plan/layers/lint-boundaries.md` (§2 boundary matrix R1–R14).
- **Date:** 2026-06-21
- **Verdict:** ALL CHECKS PASS. No boundary violation found. Tests not weakened;
  no `any` casts introduced.

| #   | Check                                                                                        | Result   |
| --- | -------------------------------------------------------------------------------------------- | -------- |
| 1   | Boundary lint over `packages/*` (trust split + no-direct-Firestore)                          | **PASS** |
| 2   | Client bundle excludes services/server (`firebase-admin` / `@levelup/services` / answer-key) | **PASS** |
| 3   | Full per-package typecheck of all 14 new packages                                            | **PASS** |
| 4   | RN-purity: domain / api-contract / query have no DOM/node-only/firebase deps                 | **PASS** |

---

## Layout reconciliation (vs §2 matrix)

The plan's standalone `packages/repository-admin` ships in the built tree as the
**subpath** `@levelup/services/repo-admin` (source under
`packages/services/src/repo-admin/`). That directory — and only it — is the
allowed ADMIN Firestore site (R8 carve-out). `packages/transport-firebase/` is
the allowed CLIENT firebase/firestore seam (realtime subscriptions). Legacy
`@levelup/shared-*` packages predate the rebuild and are additive-replaced
(SDK-LAYERS-PLAN §10); they are outside the new boundary surface and excluded
from the scan. This reconciliation does not weaken any rule for a rebuild
package.

---

## Check 1 — Boundary lint (trust split + no-direct-Firestore)

Per-package `eslint.config.mjs` wiring + `lint` scripts are a later migration
step (lint-boundaries §9.7); the boundary enforcement is delivered NOW as the
`@levelup/lint-boundaries` vitest suite — the documented vitest analogue of the
CI `pnpm depcruise` + RN-purity gates (R1–R14 import-graph + manifest
assertions).

**Command:** `env -u NODE_ENV HUSKY=0 pnpm -F @levelup/lint-boundaries test`
**Result:** 7 test files passed, 133 tests passed, 4 skipped (0 failed).

Coverage and evidence:

- `import-graph-boundaries.test.ts` (51 tests) — R3 (domain/api-contract pure),
  R4 (client pkgs no firebase), R5 (query is the only React), R8 (firestore only
  in admin adapter), R9 (services no firebase-functions), R12 (server never
  imports client brain), R13 (no deep/internal imports), R14 (no secrets in
  client), R2 (transport injected at root only), R7 (apps import only
  query+domain). All GREEN.
- `rn-purity-gate.test.ts` (6 tests) — GREEN (see Check 4).
- `boundary-presets.table.test.ts` (22), `tier-graph-acyclic.test.ts` (6),
  `exports-and-manifest.test.ts` (42), `repo-and-server-structure.test.ts` (5),
  `depcruise-config.test.ts` (3, 2 skipped) — all GREEN.
- **Skipped (4):** `rule-no-optimistic-on-authority` (R10) and
  `rule-no-tenant-id-field` (R11) self-skip — these are AST custom-rule modules
  not yet authored (separate from the import-graph gates). The import-graph
  trust-split rules are NOT skipped. (Noted, not a Track-B blocker.)

**Direct-Firestore site audit (R8).** Grepped all rebuild-package source (excl
tests/node_modules/dist) for `firebase-admin` / `firebase/firestore` /
`@google-cloud/firestore`:

- `services/src/repo-admin/**` — the ONLY admin direct-Firestore site
  (authority.ts, batch-writer.ts, entity-repo.ts, firestore.ts, item-repo.ts,
  progress.ts, tx.ts). Sanctioned carve-out.
- `transport-firebase/src/{config/firebase-services.ts, subscribe/subscribe-via-firestore.ts}`
  — the sanctioned CLIENT firebase seam (`firebase/firestore`). Allowed for
  transport-firebase only.
- `functions-shared/src/outbox/cloud-tasks.ts` — imports
  `firebase-admin/functions` (Cloud Tasks task-queue enqueue), NOT firestore;
  t-server package, compliant with R8/R9 (R8 bans Firestore, not all of
  firebase-admin; functions-shared is not in the R9 services/access/ai set).
- `ai/src/repos-seam.ts`, `services/src/shared/context.ts` — matches are JSDoc
  comments asserting the package may NOT import firebase-admin. Not imports.

No client/pure package (domain, api-contract, api-client, repositories, query,
realtime, offline) imports `firebase/*`; only transport-firebase does. No client
package imports `@levelup/services` internals or `firebase-admin`. The
repo-admin adapter is the only direct-Firestore site. **R3/R4/R8/R9/R12 hold.**

---

## Check 2 — Client bundle excludes services/server

Grepped the built `dist/` of `api-client`, `repositories`, `query` (incl `.js`,
`.cjs`, `.d.ts`, `.d.cts`, and sourcemaps) for: `firebase-admin`,
`@levelup/services`, `@google-cloud`, `firebase-functions`,
`firebase/firestore`, `answer-key`, `grading-internal`.

- **Hard-forbidden tokens** (`firebase-admin` / `@levelup/services` /
  `@google-cloud` / `firebase-functions` / `firebase/firestore`): **ZERO**
  across all three client dist trees (including sourcemaps). No bare `firebase`
  import in any client dist `.js`/`.cjs` either.
- **`answer-key` matches:** present only as **JSDoc / type-name strings** in
  `repositories/dist/index.d.ts` (lines 637, 646, 648, 819, 1855, 2141) and
  carried into sourcemaps. Every hit documents the answer-key
  _isolation/stripping_ contract, e.g. "must NEVER reach a persisted/offline
  store", "Non-persisted, answer-key-isolated cache key", "Reads only the
  answer-key-stripped projection (server strips evaluatorGuidance/modelAnswer
  for non-authoring roles)". These prove the isolation invariant; they carry
  **no answer-key data and no server import**. Not a leak.

**Result: PASS.** The client bundle physically cannot reach `firebase-admin`,
`@levelup/services`, `@google-cloud`, or any grading-internal/answer-key
payload.

---

## Check 3 — Full workspace typecheck (14 new packages)

**Command (per package):**
`env -u NODE_ENV HUSKY=0 pnpm -F @levelup/<pkg> typecheck`

| Package            | Result |     | Package          | Result |
| ------------------ | ------ | --- | ---------------- | ------ |
| domain             | PASS   |     | repositories     | PASS   |
| api-contract       | PASS   |     | query            | PASS   |
| api-client         | PASS   |     | services         | PASS   |
| transport-firebase | PASS   |     | access           | PASS   |
| transport-http     | PASS   |     | ai               | PASS   |
| realtime           | PASS   |     | functions-shared | PASS   |
| offline            | PASS   |     |                  |        |

All 14 PASS (`tsc --build` / `tsc --noEmit`, exit 0). No regression. Per the
Phase-5 transport name-mapping note, **`transport-firebase` typecheck was re-run
explicitly post-change → PASS (exit 0).** `invoke-via-callable.ts` carries the
dotted contract name (e.g. `v1.levelup.saveSpace`) verbatim into
`httpsCallable`, typed against `CallableName`/`ReqOf`/`ResOf` from
`@levelup/api-contract` — the dotted→ dashed deploy-id reconciliation is a
wire-green/functions concern and does not affect the transport typecheck.
`transport-firebase` own test suite (incl `no-direct-firestore-leak.lint`) =
20/20 GREEN.

---

## Check 4 — RN-purity (domain / api-contract / query)

**Static gate (`rn-purity-gate.test.ts`, 6 tests, GREEN):** scans the union of
the RN-pure tier source (domain, api-contract, api-client, repositories, query,
realtime, offline) and asserts NO import of firebase\*, node: builtin,
`@google-cloud/secret-manager`, or DOM-only lib; and that only query/realtime
bind React (R5).

**Built-dist confirmation:** grepped `domain`/`api-contract`/`query` dist for
`node:` builtins (`fs`/`path`/`crypto`/`os`/`child_process`), DOM-only libs
(`jsdom`/`happy-dom`/`react-dom`), and firebase:

- node:/DOM-only in `.js`/`.cjs`: **none**.
- `firebase` in `.d.ts`: present only as **JSDoc comments** explicitly
  documenting structural duck-typing, e.g. "NO firebase import — the
  FirestoreTimestamp shape is matched structurally", "NEVER imported from
  firebase", "Firebase Callable error code union (re-declared, NOT imported)",
  "NO firebase/transport import, repos are injected". **Zero
  `import`/`from 'firebase'` statements.** The pure tiers mirror firebase shapes
  structurally instead of importing them.

**Result: PASS.** domain/api-contract/query are RN-clean — no DOM, no node-only,
no firebase runtime or type imports.

---

## Notes / non-blocking observations

- R10 (`no-optimistic-on-authority`) and R11 (`no-tenant-id-field`) custom
  ESLint **rule modules** are not yet authored, so their two RuleTester tests
  self-skip. The import-graph trust-split gates (R1–R9, R12–R14) are fully
  active and GREEN. Authoring R10/R11 is the remaining lint-boundaries §9.3
  task; it does not affect the trust-split verified here.
- Per-package `eslint.config.mjs` + `lint` script wiring (§9.7) is pending the
  app-wiring migration (§10); boundary enforcement is currently carried by the
  `@levelup/lint-boundaries` vitest suite, which is the CI gate analogue.
- `functions/*` engine warnings (node 20 wanted vs node 25 local) are
  pre-existing environment warnings, not failures.
