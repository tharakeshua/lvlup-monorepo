# Package Boundaries, Lint Enforcement & Build/Bundle Topology — Layer Plan

> **Layer key:** `lint-boundaries` **Package:** `@levelup/eslint-config`
> (extended) + a new `@levelup/build-config` (tsup/tsc presets) + root CI
> guards. This layer is **cross-cutting tooling**, not a runtime layer in the
> cake; it _enforces_ the cake. **Owns:** the `no-restricted-imports` boundary
> matrix; the per-package ESLint flat-config presets; `package.json`
> `exports`/`imports`/`sideEffects`/`types` conventions; the tsup/tsc build
> presets and the `import`/`types` export conditions; the RN-purity CI bundle
> check; the monorepo `packages/` workspace layout; the dependency-cruiser graph
> guard; and the contract/lint _tests_ that fail CI when a boundary is violated.
> **Does NOT own:** any runtime symbol consumed by app code (those live in
> `domain`/`api-contract`/`api-client`/`repositories`/`query`/`realtime`/`transport-*`);
> business logic; schemas. This layer only constrains _who may import what_ and
> _how packages are built/shipped_. **Sources reconciled:**
> `specs/SDK-SERVER-DESIGN.md` §1.1–§1.3 (layer cake + dependency rules), §6
> (transport injection / RN reuse), §7.2 (risks: tenantId leak, answer-key leak,
> optimistic-on-authority, repo god-object, RN coupling); `specs/common-api.md`
> §2 (architecture), §5.1 (transport seam), §11 (migration);
> `status/REVIEW-domain-data-model.md` §6 (13-item authority boundary), §7 (top
> risks). Live tooling verified: `packages/eslint-config/{index,react,node}.js`,
> root `package.json` workspaces, `pnpm-workspace.yaml`, `turbo.json`.
>
> **Principle applied:** LEAN UI + LEAN-AUTHORITATIVE SERVER + FAT SDK is only
> _real_ if it is mechanically enforced. Architecture diagrams rot; lint rules
> and CI bundle checks do not. This layer turns every §1.3 dependency rule and
> every §6 authority-boundary line into a build-time failure. The five
> non-negotiable principles each get at least one mechanical guard here:
>
> 1. Fat-SDK / lean-UI → apps may import only `@levelup/query` +
>    `@levelup/domain` (boundary matrix R7).
> 2. Strictly-downward trust layering → the `dependency-cruiser` DAG +
>    per-package `no-restricted-imports` (R1–R6).
> 3. No Firestore outside the admin adapter → `firebase/firestore` banned
>    everywhere except `@levelup/repository-admin` (R8) + the RN bundle check.
> 4. Services never import `firebase-functions`; onCall is a thin adapter →
>    `firebase-functions` banned in
>    `@levelup/services`/`@levelup/access`/`@levelup/ai` (R9).
> 5. Conservative optimistic only → a custom lint rule flags optimistic config
>    on `⚷` (authority) callables (R10).

---

## 0. Locked decisions (this layer)

| Area                 | Decision                                                                                                                                                                                                                                                                                                         | Rationale                                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint format        | **Flat config (`eslint.config.mjs`)** monorepo-wide; migrate the legacy `.eslintrc`-style `packages/eslint-config/{index,react,node}.js` into flat presets exported from `@levelup/eslint-config`                                                                                                                | repo already half-migrated (`apps/teacher-web/eslint.config.cjs` is flat); one format kills the dual-config drift                        |
| Boundary mechanism   | **Two layers of defense:** (a) `no-restricted-imports`/`no-restricted-modules` per-package presets (fast, in-editor) + (b) `dependency-cruiser` whole-graph DAG check in CI (catches transitive + cross-package cycles `no-restricted-imports` can't see)                                                        | a path ban is local; only a graph tool proves "downward-only" and "repos don't import repos" globally                                    |
| `tsup` vs `tsc`      | **`tsup` (esbuild) for every shippable package** (`domain`, `api-contract`, `api-client`, `repositories`, `query`, `realtime`, `transport-*`) producing dual ESM+CJS + `.d.ts`; **`tsc --build` (project references) for typecheck only** and for `@levelup/services`/server packages (node target, no bundling) | tsup gives fast dual-format + tree-shakeable `sideEffects:false`; tsc PR graph gives incremental whole-repo typecheck                    |
| Export conditions    | Every package ships `exports` with `types` first, then `import` (ESM), then `require` (CJS); **no deep imports** — single `.` entry per package (plus a `./testing` subpath where a package ships test-only helpers)                                                                                             | one public surface per package makes the boundary lint tractable; deep imports are what let `transport-firebase/dist/internal` leak      |
| RN purity gate       | A dedicated CI job **bundles `@levelup/query` (which transitively pulls domain+api-contract+api-client+repositories) with Metro/esbuild targeting `react-native`** and **fails if `firebase`, `firebase-functions`, `firebase-admin`, any `node:` builtin, or any DOM global resolves into the graph**           | the only proof that "domain/api-contract/query stay pure" — types lie, the resolved module graph doesn't                                 |
| Firestore isolation  | `firebase-admin` + `firebase/firestore` allowed in **exactly one** package: `@levelup/repository-admin` (the server admin adapter). Every client repo talks to `@levelup/api-client` only                                                                                                                        | REVIEW §6 #1–#13: no client may read/write Firestore; the brain (repositories) is split into a pure client half and an admin server half |
| Optimistic guard     | A custom ESLint rule `@levelup/no-optimistic-on-authority` reads `CALLABLES[name].authorityWrite === true` (a new contract flag) and errors if a `useMutation`/optimistic recipe targets it                                                                                                                      | SDK-SERVER §5.5 / §7.2; mechanizes the conservative allow-list                                                                           |
| Repo non-coupling    | `@levelup/repositories` internal rule: a repo file may not import a sibling repo file **except** files under `src/views/**` (the declared cross-entity "view" repos)                                                                                                                                             | SDK-SERVER §7.2 "repositories becomes a god-object" mitigation                                                                           |
| Enforcement severity | All boundary rules are **`error`** (not `warn`) and run in `turbo run lint` + a pre-push hook; the dependency-cruiser + RN-bundle checks are **CI-required status checks**, not local-only                                                                                                                       | a warn-level boundary is a boundary that will be crossed                                                                                 |

---

## 1. Monorepo workspace layout (target `packages/`)

The rebuild splits today's `shared-*` packages into the trust-layered cake. New
tree under `packages/` (existing `shared-*` are migrated/retired per
`common-api.md` §11):

```
packages/
├── domain/                     # @levelup/domain         (was shared-types domain half)
├── api-contract/               # @levelup/api-contract    (was shared-types/schemas + callable-*)
├── api-client/                 # @levelup/api-client      (new)
├── repositories/               # @levelup/repositories    (the client brain; new)
├── repository-admin/           # @levelup/repository-admin (server-only Firestore admin adapter; new)
├── query/                      # @levelup/query           (was shared-hooks, platform-neutral)
├── realtime/                   # @levelup/realtime        (subscribe seam; new)
├── offline/                    # @levelup/offline         (seam-only no-op; new)
├── transport-firebase/         # @levelup/transport-firebase (was shared-firebase/shared-services transport)
├── transport-http/             # @levelup/transport-http  (future; scaffold only)
├── services/                   # @levelup/services        (server use-cases; new, server-only)
├── access/                     # @levelup/access          (authorize(); server-only)
├── ai/                         # @levelup/ai              (LLM seam + secrets; server-only)
├── functions-shared/           # @levelup/functions-shared (parseRequest, rate limit, config; server-only)
├── ui/                         # @levelup/shared-ui       (presentational only; kept)
├── eslint-config/              # @levelup/eslint-config   (EXTENDED — this layer)
├── build-config/               # @levelup/build-config    (NEW — tsup/tsc presets; this layer)
└── tailwind-config/            # @levelup/tailwind-config (kept)
```

**Layer tier tags** (used by the boundary matrix and dependency-cruiser;
declared once in `packages/build-config/tiers.json`):

| Tier          | Packages                                                                          | May import (tiers ≤ self)                         |
| ------------- | --------------------------------------------------------------------------------- | ------------------------------------------------- |
| `t0-domain`   | `domain`                                                                          | (leaf)                                            |
| `t1-contract` | `api-contract`                                                                    | t0                                                |
| `t2-client`   | `api-client`                                                                      | t0, t1                                            |
| `t3-repos`    | `repositories`                                                                    | t0, t1, t2                                        |
| `t4-query`    | `query`, `realtime`, `offline`                                                    | t0, t1, t2, t3                                    |
| `t-transport` | `transport-firebase`, `transport-http`                                            | t0, t1 only (impl the seam)                       |
| `t-app`       | `apps/*`, `apps-rn/*`                                                             | **only** `query`, `realtime`, `offline`, `domain` |
| `t-server`    | `services`, `access`, `ai`, `functions-shared`, `repository-admin`, `functions/*` | t0, t1, t-server; **never** t2–t4 client packages |

> **Why `repository-admin` is a separate package, not a sub-export of
> `repositories`.** The client `@levelup/repositories` must stay pure (RN bundle
> gate). Firestore admin access is the _one_ allowed Firestore site (REVIEW §6)
> and is server-only. Splitting them means the RN/web bundle physically cannot
> reach `firebase-admin`, and the ban is a one-line package rule rather than a
> fragile per-file rule inside a shared package.

---

## 2. The boundary matrix (the heart of this layer)

Encoded as `no-restricted-imports` presets (per tier) **and** as
`dependency-cruiser` `forbidden` rules (whole-graph). Each row R# is a named,
testable rule.

| #       | Rule name                                                    | Applies to                                                                        | Forbids importing                                                                                                                                                                                                                                            | Why (source)                                                                                                       |
| ------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **R1**  | `no-upward-imports`                                          | every package                                                                     | any package in a higher tier (per §1 table)                                                                                                                                                                                                                  | SDK-SERVER §1.3 "no package imports a layer above it"                                                              |
| **R2**  | `no-cross-tier-skip-into-transport`                          | every package except `t-app` roots                                                | `@levelup/transport-firebase`, `@levelup/transport-http`                                                                                                                                                                                                     | transport is injected once at the root only (SDK-SERVER §6)                                                        |
| **R3**  | `contract-and-domain-are-pure`                               | `domain`, `api-contract`                                                          | `firebase`, `firebase/*`, `firebase-admin`, `firebase-functions`, `react`, `react-dom`, `react-native`, `@tanstack/*`, any `node:*` builtin, any DOM lib type                                                                                                | SDK-SERVER §1.3 "domain and api-contract are pure" (RN+functions+seed reuse)                                       |
| **R4**  | `client-packages-no-firebase`                                | `api-client`, `repositories`, `query`, `realtime`, `offline`                      | `firebase`, `firebase/*`, `firebase-admin`, `firebase-functions`                                                                                                                                                                                             | clients never touch Firebase directly; transport is injected                                                       |
| **R5**  | `query-is-the-only-react`                                    | `domain`, `api-contract`, `api-client`, `repositories`, `realtime`, `offline`     | `react`, `react-dom`, `@tanstack/react-query`                                                                                                                                                                                                                | only `query` (t4) may bind React; everything below stays framework-free for RN/node reuse                          |
| **R6**  | `repos-no-sibling-repo`                                      | `repositories/src/**` (not `src/views/**`)                                        | another repo file in the same package outside `src/views/**`                                                                                                                                                                                                 | SDK-SERVER §7.2 god-object mitigation; cross-entity composition only via declared view repos                       |
| **R7**  | `apps-import-only-query-and-domain`                          | `apps/*`, `apps-rn/*`                                                             | `firebase`, `firebase/*`, `@levelup/api-client`, `@levelup/api-contract`, `@levelup/repositories`, `@levelup/transport-*`, `@levelup/services`, `@levelup/access`, `@levelup/ai`, `@levelup/repository-admin`, raw `firebase/firestore`/`firebase/functions` | SDK-SERVER §1.3 "no app imports firebase/_, api-client, transport-_ directly" — apps see only hooks + domain types |
| **R8**  | `firestore-only-in-admin-adapter`                            | every package **except** `@levelup/repository-admin`                              | `firebase/firestore`, `firebase-admin/firestore`, `@google-cloud/firestore`                                                                                                                                                                                  | NON-NEGOTIABLE #3: no direct Firestore anywhere except the repository admin adapter                                |
| **R9**  | `services-no-firebase-functions`                             | `services`, `access`, `ai`                                                        | `firebase-functions`, `firebase-functions/*`                                                                                                                                                                                                                 | NON-NEGOTIABLE #4: services are `fn(input, ctx)`; only `functions/*` onCall adapters import `firebase-functions`   |
| **R10** | `no-optimistic-on-authority` (custom rule)                   | `query/src/**`, `apps/*`                                                          | configuring optimistic `onMutate` for a callable whose contract `authorityWrite===true`                                                                                                                                                                      | NON-NEGOTIABLE #5: never optimistic on grading/publish/lifecycle/purchase                                          |
| **R11** | `no-tenantId-in-request-schema` (custom rule, contract test) | `api-contract/src/callables/**`                                                   | declaring a `tenantId` field on any tenant-scoped request schema (only `tenantOverride` allowed, super-admin defs only)                                                                                                                                      | REVIEW §6 #1 / §7.1 / D2 — the #1 authority boundary                                                               |
| **R12** | `server-no-client-packages`                                  | `services`, `access`, `ai`, `functions-shared`, `repository-admin`, `functions/*` | `@levelup/query`, `@levelup/repositories`, `@levelup/realtime`, `@levelup/offline`, `@levelup/transport-firebase`, `react`, `react-native`                                                                                                                   | server shares only `domain`+`api-contract`; client brain never runs server-side                                    |
| **R13** | `no-deep-internal-imports`                                   | every package                                                                     | any `@levelup/*/src/**`, `@levelup/*/dist/**`, or `@levelup/*/internal` path                                                                                                                                                                                 | force consumption through the public `exports` "." surface; blocks bypassing the boundary via deep paths           |
| **R14** | `no-default-firebase-region-or-secrets-in-client`            | every package except `t-server` + `transport-firebase`                            | `process.env.GEMINI_*`, `firebase-admin`, `@google-cloud/secret-manager`                                                                                                                                                                                     | NON-NEGOTIABLE: AI keys/cost never in a client bundle (REVIEW §6 #2/AI)                                            |

> Rules R1, R2, R6, R7, R8, R9, R12, R13 are graph-checkable and live **also**
> in `dependency-cruiser` (a path-ban can be defeated transitively; the DAG
> can't). R3–R5, R14 are import-path bans best expressed in
> `no-restricted-imports` per preset. R10, R11 require AST/contract logic →
> custom rules + a contract test.

---

## 3. `@levelup/eslint-config` — exported presets

Migrated to flat config. The package becomes the single source of every preset;
each package's `eslint.config.mjs` is a 2-line `export default [...preset]`.

### 3.1 File layout

```
packages/eslint-config/
├── package.json            # name @levelup/eslint-config; type: module; exports map (§3.3)
├── src/
│   ├── base.mjs            # ts + import-order + prettier + consistent-type-imports (port of today's index.js)
│   ├── react.mjs           # base + react/react-hooks/jsx-a11y (port of today's react.js)
│   ├── node.mjs            # base + node env, console allowed (port of today's node.js)
│   ├── boundaries.mjs      # the boundary RESTRICTED-IMPORT factory: restrictedFor(tier, pkgName)
│   ├── presets.mjs         # composed per-tier presets: domainPreset, contractPreset, clientPreset,
│   │                       #   reposPreset, queryPreset, transportPreset, appPreset, serverPreset
│   ├── tiers.mjs           # re-exports tiers.json + tierOf(pkgName) + allowedTiers(tier)
│   └── rules/
│       ├── no-optimistic-on-authority.mjs   # custom rule (R10)
│       └── no-tenant-id-field.mjs           # custom rule (R11) — also runnable as contract test
└── test/
    ├── boundaries.spec.mjs                   # asserts each preset bans the right specifiers (table-driven)
    ├── no-optimistic-on-authority.spec.mjs   # RuleTester valid/invalid cases
    └── no-tenant-id-field.spec.mjs           # RuleTester valid/invalid cases
```

### 3.2 Exported symbols (signature sketches)

```ts
// src/tiers.mjs
export const TIERS: Record<PackageName, Tier>;                 // from tiers.json
export type Tier = 't0-domain'|'t1-contract'|'t2-client'|'t3-repos'|'t4-query'|'t-transport'|'t-app'|'t-server';
export function tierOf(pkg: PackageName): Tier;
export function allowedTiers(tier: Tier): readonly Tier[];      // tiers a given tier may depend on
export function forbiddenPackages(tier: Tier): readonly string[]; // concrete @levelup/* names this tier may not import

// src/boundaries.mjs
export interface RestrictedSpec { paths: { name: string; message: string }[]; patterns: { group: string[]; message: string }[] }
export function restrictedFor(tier: Tier): RestrictedSpec;      // builds the no-restricted-imports config for a tier
export const FIREBASE_BAN: RestrictedSpec;                       // firebase/firebase-admin/firebase-functions
export const REACT_BAN: RestrictedSpec;                          // react/react-dom/@tanstack
export const FIRESTORE_BAN: RestrictedSpec;                      // firebase/firestore + @google-cloud/firestore
export const DEEP_IMPORT_BAN: RestrictedSpec;                    // @levelup/*/src|dist|internal (R13)
export const SECRETS_BAN: RestrictedSpec;                        // secret-manager + GEMINI_* (R14)

// src/presets.mjs  — each is a flat-config array (FlatConfig[])
export const basePreset: FlatConfig[];
export const reactPreset: FlatConfig[];
export const nodePreset: FlatConfig[];
export const domainPreset: FlatConfig[];      // base + R3 (pure) + DEEP_IMPORT_BAN
export const contractPreset: FlatConfig[];    // base + R3 + R11 (no-tenant-id-field) + DEEP_IMPORT_BAN
export const clientPreset: FlatConfig[];      // base + R4 + R5 + R2 + DEEP_IMPORT_BAN  (api-client)
export const reposPreset: FlatConfig[];       // base + R4 + R5 + R6 (no-sibling-repo) + R8 + DEEP_IMPORT_BAN
export const queryPreset: FlatConfig[];       // react + R4 + R8 + R10 (no-optimistic-on-authority) + DEEP_IMPORT_BAN
export const transportPreset: FlatConfig[];   // base (firebase ALLOWED here) + R1(may only import t0/t1) + R13
export const appPreset: FlatConfig[];         // react + R7 (apps-import-only-query-and-domain) + FIRESTORE_BAN + DEEP_IMPORT_BAN
export const serverPreset: FlatConfig[];      // node + R8(except admin) + R9 + R12 + R14 + DEEP_IMPORT_BAN
export const adminAdapterPreset: FlatConfig[];// node + (FIRESTORE_BAN LIFTED) + R12 + R5

// src/rules/no-optimistic-on-authority.mjs  &  src/rules/no-tenant-id-field.mjs
export default { meta, create }: import('eslint').Rule.RuleModule;

// the plugin object the presets register:
export const plugin: { rules: { 'no-optimistic-on-authority': RuleModule; 'no-tenant-id-field': RuleModule } };
```

### 3.3 `package.json` exports for `@levelup/eslint-config`

```jsonc
{
  "name": "@levelup/eslint-config",
  "type": "module",
  "exports": {
    ".": "./src/presets.mjs",
    "./base": "./src/base.mjs",
    "./react": "./src/react.mjs",
    "./node": "./src/node.mjs",
    "./boundaries": "./src/boundaries.mjs",
    "./tiers": "./src/tiers.mjs",
  },
}
```

### 3.4 How a package consumes a preset

```js
// packages/api-contract/eslint.config.mjs
import { contractPreset } from '@levelup/eslint-config';
export default contractPreset;

// apps/teacher-web/eslint.config.mjs
import { appPreset } from '@levelup/eslint-config';
export default [...appPreset, { ignores: ['dist/**'] }];
```

### 3.5 The two custom rules (precise behavior)

**`@levelup/no-optimistic-on-authority` (R10).** AST rule. Targets
`CallExpression` to `useMutation(...)` (or repo `optimistic(...)` recipe).
Resolves the callable name from the `mutationFn` body (`api.<module>.<op>` or
`repos.<x>.<y>`), looks it up against a generated `AUTHORITY_CALLABLES` set
(emitted from `api-contract` at build → a JSON the rule imports). If the
mutation config object contains `onMutate`/`optimisticData`/`optimistic: true`
**and** the callable is in `AUTHORITY_CALLABLES`, report. Authority set = every
callable with `def.authorityWrite === true` (grading, publish/lifecycle,
purchase, bulk, membership, claims). Valid: optimistic on `recordItemAttempt`,
`sendChatMessage`, `manageNotifications:markRead`.

**`@levelup/no-tenant-id-field` (R11).** AST rule + standalone contract test.
Targets `z.object({...})` literals in `api-contract/src/callables/**` whose
variable name matches `*RequestSchema`. Reports any property key `tenantId` (any
nesting under the request root, excluding `tenantOverride`). The same logic runs
in `api-contract`'s contract test by reflecting over `CALLABLES` at runtime: for
each def, `def.requestSchema` is walked; a `tenantId` key on a non-super-admin
def fails. (Defense in depth: the lint rule catches it in-editor, the contract
test catches a schema built dynamically.)

---

## 4. `@levelup/build-config` — tsup/tsc presets (new package)

Centralizes build so every shippable package builds identically (consistent
`import`/`types` conditions, `sideEffects:false`, dual ESM+CJS, `.d.ts`, no
bundled `@levelup/*` workspace deps).

### 4.1 File layout

```
packages/build-config/
├── package.json            # name @levelup/build-config; exports tsup presets + tiers.json
├── tiers.json              # the single tier source (§1) consumed by eslint-config + dependency-cruiser + RN gate
├── src/
│   ├── tsup.base.ts        # defineLibrary(opts): base tsup config (esm+cjs, dts, sourcemap, treeshake, external workspace deps)
│   ├── tsup.pure.ts        # definePureLibrary(): base + target 'es2022', platform 'neutral' (RN/node/web safe)
│   ├── tsup.node.ts        # defineNodeLibrary(): platform 'node', target 'node20', no CJS-interop shims (server pkgs)
│   ├── tsconfig.base.json  # composite + declaration + strict + isolatedModules + verbatimModuleSyntax
│   ├── exports.ts          # standardExports(pkgName): the canonical package.json "exports" block builder
│   └── depcruise.config.cjs # dependency-cruiser ruleset derived from tiers.json (§5)
└── test/
    └── exports.spec.ts     # asserts every shippable package.json exports matches standardExports()
```

### 4.2 Exported symbols

```ts
// src/tsup.base.ts
export function defineLibrary(opts?: {
  entry?: string[];
  platform?: "neutral" | "node";
  extraExternal?: string[];
}): import("tsup").Options;

// src/tsup.pure.ts
export function definePureLibrary(opts?): import("tsup").Options; // platform:'neutral', target:'es2022', external: all @levelup/* + zod
// src/tsup.node.ts
export function defineNodeLibrary(opts?): import("tsup").Options; // platform:'node', target:'node20'

// src/exports.ts
export interface ExportsBlock {
  ".": { types: string; import: string; require: string };
  "./package.json": "./package.json";
}
export function standardExports(): ExportsBlock; // types→import→require, dist paths
export function standardPkgFields(): {
  type: "module";
  sideEffects: false;
  main: string;
  module: string;
  types: string;
  files: string[];
};

// src/depcruise.config.cjs
module.exports = buildDepcruiseConfig(require("./tiers.json")); // §5
```

### 4.3 Canonical `package.json` shape every shippable package adopts

```jsonc
{
  "name": "@levelup/<pkg>",
  "type": "module",
  "sideEffects": false,
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
    },
    "./package.json": "./package.json",
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --build",
    "lint": "eslint src --max-warnings 0",
  },
  "dependencies": {
    /* ONLY strictly-downward @levelup/* + leaf libs (zod, uuid) */
  },
}
```

> **`pure` vs `node` choice per package:** `domain`, `api-contract`,
> `api-client`, `repositories`, `query`, `realtime`, `offline` →
> `definePureLibrary` (platform `neutral`, RN-safe).
> `transport-firebase`/`transport-http` → `definePureLibrary` (they import
> `firebase` which is RN-safe; never bundled into the pure-graph anyway).
> `services`, `access`, `ai`, `functions-shared`, `repository-admin` →
> `defineNodeLibrary` (node-only). Workspace `@levelup/*` deps are always
> `external` (never inlined) so the boundary stays inspectable in the resolved
> graph.

---

## 5. dependency-cruiser — the whole-graph DAG guard

`buildDepcruiseConfig(tiers)` emits a `.dependency-cruiser.cjs` with these
`forbidden` rules (run as `pnpm depcruise packages apps functions --config` in
CI). Each maps to a boundary-matrix row:

```js
forbidden: [
  // R1 — strictly downward
  {
    name: "no-upward-tier",
    severity: "error",
    from: { path: "^packages/([^/]+)/" },
    to: {
      path: "^packages/([^/]+)/",
      moreThanOneDependencyType: false,
      // predicate: tierOf(to) NOT in allowedTiers(tierOf(from)) — implemented via per-pair rules generated from tiers.json
    },
  },
  // R7 — apps may import only query/realtime/offline/domain (+ ui/tailwind)
  {
    name: "app-imports-restricted",
    severity: "error",
    from: { path: "^apps/" },
    to: {
      path: "^packages/(api-client|api-contract|repositories|repository-admin|transport-[^/]+|services|access|ai)/",
    },
  },
  // R8 — firestore only in repository-admin
  {
    name: "firestore-only-admin",
    severity: "error",
    from: { pathNot: "^packages/repository-admin/" },
    to: {
      path: "node_modules/(firebase/firestore|@google-cloud/firestore)|firebase-admin/firestore",
    },
  },
  // R9 — services never import firebase-functions
  {
    name: "services-no-ff",
    severity: "error",
    from: { path: "^packages/(services|access|ai)/" },
    to: { path: "node_modules/firebase-functions" },
  },
  // R12 — server packages never import client brain
  {
    name: "server-no-client",
    severity: "error",
    from: {
      path: "^(packages/(services|access|ai|functions-shared|repository-admin)|functions)/",
    },
    to: { path: "^packages/(query|repositories|realtime|offline|transport-)" },
  },
  // R6 — repos may not import sibling repos except via views/
  {
    name: "no-sibling-repo",
    severity: "error",
    from: { path: "^packages/repositories/src/(?!views/)" },
    to: { path: "^packages/repositories/src/(?!views/|shared/|index)" },
  },
  // R2 — transport injected at root only
  {
    name: "no-transport-except-roots",
    severity: "error",
    from: { pathNot: "^(apps|apps-rn)/[^/]+/src/(main|App|bootstrap)\\." },
    to: { path: "^packages/transport-(firebase|http)/" },
  },
  // R13 — no deep internal imports
  {
    name: "no-deep-internal",
    severity: "error",
    from: {},
    to: {
      path: "^packages/[^/]+/(src|dist)/(?!index)",
      pathNot: "^packages/repositories/src/views",
    },
  },
  // global — no circular deps anywhere
  { name: "no-circular", severity: "error", from: {}, to: { circular: true } },
];
```

> The R1 "strictly-downward" check is the one rule a plain
> `no-restricted-imports` cannot express (it needs the from/to _tier_
> comparison). `buildDepcruiseConfig` expands it into N concrete forbidden pairs
> (`from t2-client → to t3-repos|t4-query|t-app` = error, etc.) generated from
> `tiers.json`, so the rule set is data-driven and stays in sync with §1.

---

## 6. The RN-purity CI bundle check (the irreplaceable gate)

Types can claim purity; only a resolved bundle proves it. A dedicated CI job
builds a throwaway RN-target bundle whose single entry imports the public
surface of `@levelup/query` (which transitively pulls
`repositories → api-client → api-contract → domain`) and asserts the resolved
module graph contains **none** of the forbidden modules.

### 6.1 Layout

```
packages/build-config/rn-bundle-check/
├── entry.ts                 # import * as Q from '@levelup/query'; import * as D from '@levelup/domain'; export { Q, D }
├── check.mjs                # esbuild.build({ platform:'neutral', conditions:['react-native','import'], metafile:true, ... })
│                            #   then scan metafile.inputs for forbidden module ids → exit 1 on any hit
└── forbidden.json           # ["firebase","firebase-admin","firebase-functions","@google-cloud/*","node:*", DOM-only libs]
```

### 6.2 Check logic (signature)

```ts
// check.mjs
export async function runRnPurityCheck(): Promise<{
  ok: boolean;
  offenders: string[];
}>;
//  1. esbuild bundles entry.ts with conditions ['react-native','import'] (forces RN export condition)
//  2. read metafile.inputs keys → resolved file list
//  3. flag any input matching forbidden.json (firebase*, firebase-admin, firebase-functions, node: builtins, document/window DOM-only deps)
//  4. ALSO assert no `process`, `Buffer`, `fs`, `path` from node builtins resolved
//  exit(offenders.length ? 1 : 0)
```

This is wired as a required CI status check (`pnpm rn:purity`). It directly
retires SDK-SERVER §7.2 risk "RN pulls in a web/node-only dep transitively" —
the only mechanical proof that domain/api-contract/api-client/repositories/query
stay RN-clean.

---

## 7. Server boundary specifics (functions/\* onCall thinness)

Beyond R8/R9/R12, two server-side mechanical checks enforce principle #4
("onCall is a thin adapter"):

- **R9 + `onCall-thinness` lint** (in `serverPreset`): a custom-lite rule (or
  `eslint-plugin-boundaries` element type) flags any
  `functions/*/src/callable/**` file that contains business logic — heuristic: a
  callable adapter file may import `firebase-functions` and exactly one
  `@levelup/services` symbol, and its `onCall` body must be ≤ N statements
  (parse ctx → parseRequest → call service → return). Implemented as
  `complexity`/`max-statements` capped on `onCall` callbacks + a ban on
  `firebase-admin/firestore` inside `callable/**` (writes go through a service →
  `repository-admin`).
- **`firebase-functions` allowed ONLY in `functions/*`** (the deploy adapters),
  **never** in `@levelup/services|access|ai` (R9). `repository-admin` may import
  `firebase-admin` but **not** `firebase-functions`.

These keep the server lean-but-authoritative: services stay `fn(input, ctx)` and
transport-agnostic, exactly reusable by a future REST gateway (SDK-SERVER §3.1).

---

## 8. Contract / lint tests this layer requires

| Test                                  | Location             | Asserts                                                                                                                                                                                              | Source guard                         |
| ------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `boundaries.spec.mjs`                 | `eslint-config/test` | each tier preset's `restrictedFor` bans exactly the specifiers in the §2 matrix (table-driven, one row per R#)                                                                                       | R1–R14 stay encoded                  |
| `no-optimistic-on-authority.spec.mjs` | `eslint-config/test` | RuleTester: optimistic on `gradeQuestion`/`saveSpace(status)`/`purchaseSpace` = error; on `recordItemAttempt`/`sendChatMessage` = ok                                                                 | R10 / principle #5                   |
| `no-tenant-id-field.spec.mjs`         | `eslint-config/test` | RuleTester: a `*RequestSchema` with `tenantId` = error; with `tenantOverride` on a super-admin def = ok                                                                                              | R11 / REVIEW #1                      |
| `tenant-id-contract.test.ts`          | `api-contract/test`  | reflects over `CALLABLES`, walks each `requestSchema`, fails if any non-super-admin def declares `tenantId` (runtime, catches dynamically-built schemas)                                             | R11 defense-in-depth                 |
| `authority-flag-coverage.test.ts`     | `api-contract/test`  | every callable in REVIEW §6's authority list (grading, publish, lifecycle, purchase, membership, claims, bulk) has `authorityWrite:true`; the optimistic allow-list callables have it `false`/absent | feeds R10's `AUTHORITY_CALLABLES`    |
| `exports.spec.ts`                     | `build-config/test`  | every shippable `package.json` `exports` deep-equals `standardExports()` (types→import→require, no deep paths)                                                                                       | export-condition consistency         |
| `depcruise` CI step                   | root CI              | `pnpm depcruise` exits 0 (no forbidden edge, no cycle)                                                                                                                                               | R1/R2/R6/R7/R8/R9/R12/R13 graph-wide |
| `rn-purity` CI step                   | root CI              | `runRnPurityCheck().ok === true`                                                                                                                                                                     | RN purity (§6), SDK-SERVER §7.2      |
| `eslint --max-warnings 0` per package | `turbo run lint`     | no boundary `error` anywhere; warnings fail too                                                                                                                                                      | all in-editor R rules                |
| `tier-graph-acyclic.test.ts`          | `build-config/test`  | `tiers.json` forms a DAG and every `@levelup/*` dependency in every `package.json` respects `allowedTiers` (static `package.json` scan, fast pre-graph guard)                                        | R1 fast-fail before depcruise        |

### 8.1 CI wiring (the required gates)

```
turbo run lint typecheck build      # per-package eslint (R3-R6,R9,R10,R11,R13,R14) + tsc PR graph + tsup
pnpm depcruise ...                  # whole-graph (R1,R2,R6,R7,R8,R9,R12,R13 + no-circular)
pnpm rn:purity                      # §6 resolved-bundle purity
pnpm vitest run -- eslint-config api-contract build-config   # the contract/RuleTester tests in §8
```

A pre-push husky hook runs `turbo run lint` (fast local) so most violations
never reach CI; `depcruise` + `rn:purity` are CI-only (heavier).

---

## 9. Migration steps (from today's tooling)

1. **Flat-config migration.** Convert
   `packages/eslint-config/{index,react,node}.js` → `src/{base,react,node}.mjs`;
   add `src/{boundaries,presets,tiers}.mjs`. Add `eslint-plugin-import` is
   already present; add `dependency-cruiser`, `eslint` flat deps.
2. **Author `tiers.json`** (§1) in the new `@levelup/build-config`; both
   eslint-config and depcruise read it (single source).
3. **Write the two custom rules** (`no-optimistic-on-authority`,
   `no-tenant-id-field`) + RuleTester specs.
4. **Add `authorityWrite` flag** to `CallableDef` in `api-contract` (coordinate
   with the api-contract layer plan); seed it from REVIEW §6's list; add
   `authority-flag-coverage.test.ts`.
5. **Create `@levelup/build-config`** with tsup presets + `standardExports`;
   convert each shippable package to `tsup` + the canonical `package.json`
   (§4.3).
6. **Split `repository-admin`** out as the lone Firestore-admin package; lift
   the `FIRESTORE_BAN` only there.
7. **Per-package `eslint.config.mjs`** = `export default <tierPreset>`; delete
   the per-app ad-hoc configs (`apps/teacher-web/eslint.config.cjs` etc.).
8. **Add the RN-purity job** + `depcruise` CI step + tier-graph static test;
   make all three required status checks.
9. **Retire** the dead generic `FirestoreService`/`StorageService` and any
   app-level `firebase/firestore` import as R7/R8 will now hard-fail them
   (common-api §11.7).

---

## 10. Open questions & risks

| Item                                                              | Note / recommendation                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `authorityWrite` flag ownership                                   | This layer _consumes_ it; the **api-contract** layer must _define_ it on `CallableDef`. Coordinate so R10/R11's data source is authoritative. Recommend: api-contract owns it, this layer's test asserts coverage.                                                          |
| Scanner-RN transport                                              | Scanner uses `transport-firebase` in v1 (SDK-SERVER locked). R2 must allow `apps-rn/scanner/src/bootstrap.*` as a permitted transport-import site (root only).                                                                                                              |
| `eslint-plugin-boundaries` vs hand-rolled `no-restricted-imports` | `eslint-plugin-boundaries` can express element-type rules more declaratively than path bans. Recommend evaluating it for R1/R7/R12; keep `dependency-cruiser` as the cross-package/transitive authority regardless (it sees the resolved graph; eslint sees one file).      |
| Deep-import ban vs `./testing` subpaths                           | Some packages ship test helpers (`api-contract/testing`). R13 must whitelist declared subpath exports, not all of `src/**`. The `exports` map is the allow-list; `no-deep-internal` excludes declared subpaths.                                                             |
| RN gate false-negatives                                           | esbuild `conditions:['react-native']` only catches deps that _declare_ an RN condition. A dep with no condition map but a node-only body could slip; mitigate by also scanning for `node:`/`firebase` literal inputs in the metafile (already in §6.2 step 3-4).            |
| Turbo cache vs lint determinism                                   | `depcruise`/`rn:purity` are not turbo tasks (whole-graph, not per-package) — run them as top-level CI scripts so turbo caching can't stale them.                                                                                                                            |
| Pre-existing `firebase` in apps                                   | Today every app `package.json` depends on `firebase` directly (verified in `teacher-web`). R7 + R8 will fail until apps are migrated to inject transport at root and drop the direct dep — sequence this with the app-wiring migration (SDK-SERVER §8 step 10), not before. |
