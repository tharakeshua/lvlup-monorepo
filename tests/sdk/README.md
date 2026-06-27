# tests/sdk — SDK-rebuild test infrastructure

Test infrastructure for the Auto-LevelUp SDK rebuild, authored against the
FROZEN plan (`docs/rebuild-spec/specs/SDK-LAYERS-PLAN.md` +
`sdk-plan/layers/*.md` + `status/testing-infra.md`). The `@levelup/*` packages
are built on parallel tracks; these tests import the plan's **API surface** and
self-skip cleanly while a layer is still a scaffold, then go green as each layer
lands (a later validation phase runs + fixes them).

> Author-only constraint honored: this directory + the co-located
> `packages/*/src/__tests__/*.test.ts` files + the root
> `vitest.sdk.workspace.ts` are the entire footprint. No
> `package.json`/`tsconfig`/`src` non-test file or root config was edited;
> `packages/seed` was not written into.

---

## The three test layers and how they are wired

| Layer           | Where                                                       | Env               | Substrate                                                                                                              | Gates it enforces                                                                                                                                                                                       |
| --------------- | ----------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **UNIT**        | `packages/<pkg>/src/__tests__/*.test.ts`                    | node, no emulator | the **fakes** in `tests/sdk/fakes` (fake Transport, fake ApiClient, in-memory Repos, fake AiGateway, entity factories) | per-layer logic: api-client validation/retry/idempotency, repo shaping/N+1/cursor, service `fn(input,ctx)` invariants                                                                                   |
| **CONTRACT**    | also `packages/<pkg>/src/__tests__/*.test.ts` (pure layers) | node, no emulator | Zod-registry introspection + `tests/sdk/fixtures`                                                                      | `registry-integrity`, `no-tenant-id-in-request` (T8 walker), `authority-flag-coverage` (T9), `allowed-transitions-enum`, `DomainName` totality, `optimistic-allowlist`, `subscription-sources` coverage |
| **INTEGRATION** | `tests/sdk/{contract,integration,security}/*.test.ts`       | **emulator**      | the **harness** (`tests/sdk/harness`) + seeded contract tenant                                                         | per-callable emulator contract loop (T1), repos conformance two-driver (T6), triggers-async reducers (T4), access policy table (T5), seed idempotency/determinism (T2), realtime projection authority   |

Why "contract" appears in two rows: the _pure_ contract assertions
(introspecting the Zod registries) live co-located in `packages/api-contract`
and need no emulator. The _per-callable round-trip_ contract test
(`def.responseSchema.parse( liveResponse)`) needs the emulator + seed and lives
under `tests/sdk/contract`.

---

## Directory map

```
vitest.sdk.workspace.ts            # root: enumerates the @levelup/* packages + tests/sdk
tests/sdk/
├── vitest.config.ts               # the `sdk-integration` project (emulator; fileParallelism:false)
├── tsconfig.json
├── harness/
│   ├── emulator.ts                # host/ports/projectId (demo-levelup), Admin+client apps, clear/teardown
│   ├── seed.ts                    # imports @levelup/seed → loadDemoSeed()/loadContractTenant()
│   ├── auth-context.ts            # (1) signInAsDemoUser/mintIdToken (Auth emulator + claims)
│   │                              # (2) makeAuthContext/makeSystemContext (server ctx over fakes)
│   ├── fixtures-ids.ts            # deterministic ids + FIXED_CLOCK_ISO + demo-user/content keys
│   ├── global-setup.ts            # vitest globalSetup: connect → clear → seed → teardown
│   ├── per-test-setup.ts          # requireEmulators()/requireSeed() skip-guards + auth reset
│   └── index.ts
├── fakes/
│   ├── fake-transport.ts          # records invoke() calls, returns canned ResOf, drives subscriptions
│   ├── fake-api-client.ts         # namespaced fake ApiClient + wrapTransport(realClient)
│   ├── in-memory-repos.ts         # Repos fake: tx()/idempotency/outbox/answerKeys/cursor (T6)
│   ├── fake-ai-gateway.ts         # deterministic generate(); always logs cost; quota gate (T6/#12)
│   ├── entity-factories.ts        # valid @levelup/domain entities (validated against the schema)
│   ├── repos-driver.ts            # T6 two-driver abstraction (in-memory + emulator)
│   └── index.ts
├── fixtures/                      # per-callable request/response examples (T1)
│   ├── callable-fixture.ts        # CallableFixture shape + CALLABLE_FIXTURES registry + registerFixture
│   ├── identity.fixtures.ts
│   ├── levelup.fixtures.ts
│   ├── autograde.fixtures.ts
│   ├── analytics.fixtures.ts
│   ├── ordering.ts                # write-before-read seed-state ordering
│   └── index.ts                   # barrel — loads all fixture files
├── contract/
│   └── callable-contract.test.ts  # T1 emulator loop: responseSchema.parse(liveResponse)
├── integration/
│   ├── auth-context.integration.test.ts
│   ├── repos-conformance.test.ts  # T6 — one file, two drivers
│   ├── triggers-async.contract.test.ts # T4 reducers
│   └── seed.idempotency.test.ts   # T2 — double-seed no-op + claims parity
└── security/
    └── realtime-projection-authority.test.ts # MERGE-REALTIME-AUTHORITY / SEC-10
```

Co-located package contract/unit tests (import the fakes/fixtures from here):

```
packages/domain/src/__tests__/{transitions.assertion,brands}.test.ts
packages/api-contract/src/__tests__/{registry-integrity,no-tenant-id-in-request,authority-flag-coverage}.test.ts
packages/api-client/src/__tests__/create-client.test.ts
packages/repositories/src/__tests__/repositories.seam.test.ts
packages/query/src/__tests__/{domain-name.totality,optimistic-allowlist.guard}.test.ts
packages/transport-firebase/src/__tests__/subscription-sources.coverage.test.ts
packages/access/src/__tests__/access-policy.table.test.ts
packages/services/src/__tests__/services.unit.test.ts
packages/seed/src/__tests__/seed.determinism.test.ts
```

---

## Running

```bash
# Pure unit + contract (no emulator) — everything except the integration project
pnpm vitest --config vitest.sdk.workspace.ts run --project @levelup/domain
pnpm vitest --config vitest.sdk.workspace.ts run            # all (integration self-skips if emulators down)

# Integration / per-callable contract loop — under the emulators, project id matches CI
firebase emulators:exec \
  --only auth,firestore,functions,database \
  --project demo-levelup \
  "pnpm vitest run --config tests/sdk/vitest.config.ts"
```

The integration suites SKIP (not fail) when the emulators are unreachable or the
seed engine isn't built yet — so the workspace stays green during the parallel
build. `harness/global-setup.ts` sets `SDK_EMULATORS_DOWN` /
`SDK_SEED_UNAVAILABLE` and `requireEmulators()`/`requireSeed()` read them.

---

## Key design decisions (traceable to the plan)

- **Project id `demo-levelup`** everywhere (not the legacy `lvlup-ff6fa`) —
  matches CI's `--project demo-levelup` and fixes the `testing-infra.md` §4
  mismatch.
- **Single seeded "contract tenant"** with deterministic ids + a **fixed clock**
  (`FIXED_CLOCK_ISO`) backs every contract/integration suite (T1/T2).
- **Fixtures are the T1 gate**: `registry-integrity.test.ts` fails if any
  `CALLABLE_NAMES` entry lacks a fixture; the emulator loop validates the live
  response with `responseSchema.parse`.
- **Fakes are framework-free** and only dynamic-import `@levelup/*` (with a
  fallback), so a co-located test can import them while a downstream package is
  a scaffold.
- **T6 two-driver conformance**: the in-memory `Repos` fake and the
  emulator-backed real `@levelup/repository-admin` run the SAME conformance
  file, so the fake can't diverge on `tx()`/cursor/brand-strip.
- **Authority never optimistic**: `authority-flag-coverage` +
  `optimistic-allowlist` cross-check the ✅ surfaces against the ⚷ set at build
  time.

## Reconciliation TODOs for the validation phase

These are the localized assumptions to confirm once the parallel tracks land:

- `harness/seed.ts#resolveSeedApi` — confirm the real `@levelup/seed` export
  names (`seedAll`/`seedId` vs `runSeed`/`stableId`) and `SeedRunOptions` shape.
- `auth-context.ts#buildClaimsForRole` — replace the mirror with the real
  `@levelup/access` `syncMembershipClaims`/`buildPlatformClaims` so seed claims
  and ctx claims share one builder.
- `fakes/in-memory-repos.ts` — replace with
  `@levelup/repository-admin/testing`'s `createInMemoryRepos()` once it ships;
  point `repos-driver.ts` emulator driver at the real `createRepos()`.
- Tighten the `unknown`-typed contract imports to the real exported types
  (`Transport`, `ApiClient`, `CallableDef`, `CALLABLES`, `SUBSCRIPTIONS`).

```

```
