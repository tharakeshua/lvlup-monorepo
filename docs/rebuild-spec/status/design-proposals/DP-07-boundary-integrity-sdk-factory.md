# DP-7 · `createLevelUpSdk()` factory + green boundary gate

**Wave:** W3 (the hand-off into Phase 2) · **Status:** design-only ·
**Evidence:** R1 (LB-01/02/04/05), R4 (Q-GUARD-1).

## Problem

All **8 apps** import `api-client` + `repositories` + `transport-firebase`
directly from their composition roots (`apps/*/src/sdk/{api,firebase}.ts`),
bypassing `@levelup/query`. The boundary lint test
(`lint-boundaries/.../import-graph-boundaries.test.ts`, rule R7) has **no
composition-root carve-out → 8 failing tests → the guard is effectively
disabled** (catches no regressions while red). The wiring is also duplicated 8×.
Secondary: the tier-check silently skips `functions-adapters` (stale name in the
TIERS table — a future upward dep would pass undetected) (LB-02); comments cite
a non-existent `@levelup/repositories-admin` (LB-05).

## Target design

Extract a single **composition package** (e.g. `@levelup/sdk` or
`@levelup/client`) exporting:

```ts
export function createLevelUpSdk(config: SdkConfig): {
  queryClient: QueryClient;
  provider: LevelUpProvider; // wires transport → api-client → repositories → query
};
```

It wires `transport-firebase` → `api-client` (incl. `storage`, see DP-1) →
`repositories` → the `query` provider **once**. Apps import **only
`@levelup/query` + `@levelup/domain`** (+ this factory at the composition root).
Then:

- The R7 boundary test goes **green and load-bearing** — no carve-out needed
  (apps no longer reach past `query`).
- Register `functions-shared`→`functions-adapters` in the TIERS map so
  upward-dep regressions are actually caught (LB-02).
- Fix the stale `@levelup/repositories-admin` comments →
  `@levelup/services/repo-admin` (LB-05).
- Reconcile declared-vs-actual deps: `repositories` declares `api-client` but
  never imports it; `query` declares `offline`/`realtime` unused (resolve under
  DP-8).

## Why this is the Phase-1 → Phase-2 seam

It is exactly what the 8 apps will consume in Phase 2. Land it last in Phase 1
(after DP-1, since the factory wires the canonical transport), then verify
per-app during the Phase-2 app reviews.

## Migration

1. Author the factory package (depends on
   transport-firebase/api-client/repositories/query).
2. Replace each app's `src/sdk/*` hand-wiring with `createLevelUpSdk(config)` (8
   apps; can be worktree-isolated/parallel in Phase 2).
3. Flip the R7 test to green; remove any temporary carve-out.

## Tests

- Boundary import-graph test green with no app-level carve-out.
- TIERS map includes `functions-adapters`; an injected upward dep fails the
  test.

## Closes

LB-01/Q-GUARD-1, LB-02, LB-04, LB-05, + the 8× wiring duplication.
