# DP-10 · Test & build hygiene matched to risk

**Wave:** W4 (locks the new invariants in) · **Status:** design-only ·
**Evidence:** R4 (Q-TEST-1/2/3, Q-BUILD-1/2/3, Q-DEP-1/2).

## Problem

Coverage is **inverted vs risk** — the two fattest, most business-critical
packages are the least tested:

- `services/src/**` — 74 files / 11,328 LOC / **11 tests** (grading, analytics
  aggregation, repo-admin writes, idempotency). Single largest correctness risk.
  ("services is thin" = thin in _tests_, not code.) (Q-TEST-1)
- `functions-shared/src/**` — 21 files / **0 tests** (the transport↔services
  boundary: error mapping, dedupe, on-call/on-document/schedule adapters). Bugs
  here corrupt every function's contract. (Q-TEST-2)
- Thin coverage on `ai`/`offline`/`transport-http`/`access` (Q-TEST-3).

Build/hygiene footguns:

- **Inconsistent typecheck strategy** — 4 packages source-mapped vs 9
  tsc-against-`dist` → "typecheck passed but against stale dist" (Q-BUILD-1).
- **`query` vitest non-hermetic** — false-RED under `NODE_ENV=production`
  (`act() not supported`; 99/99 pass under `development`) (Q-BUILD-3).
- `query` declares `offline`+`realtime` but imports neither (Q-DEP-1 — resolve
  with DP-8); `firebase-admin` version drift `^12.7.0` vs `^12.0.0` (Q-DEP-2);
  dir/name mismatch `functions-shared`→`functions-adapters` (Q-BUILD-2).

## Target design

1. **Coverage prioritized by risk** (DI-friendly → fakes are tractable):
   - `services`: grading, repo-admin writes, idempotency, the new honest-tx
     paths (DP-4).
   - `functions-adapters`: error mapping, dedupe, the
     on-call/on-document/schedule adapters.
2. **Parity tests the new design makes cheap** (these double as regression
   guards for the other DPs):
   - `FLAT_COLLECTION` ↔ `createRepos` map (DP-4 / SVC-1).
   - registry-derives-all (DP-2).
   - `ItemView` is answer-free (DP-3).
   - provisioned-membership `tenantCode` non-empty (DP-6).
   - no-synonym-`DomainName` + no-duplicate-bag-key + realtime key-parity
     (DP-8).
   - subscription prefix == write prefix under `v2_` (DP-9).
3. **Standardize typecheck** to source-mapped across all packages (kill the
   stale-dist footgun) (Q-BUILD-1).
4. **Pin `query` vitest `NODE_ENV`** so the suite is hermetic (Q-BUILD-3).
5. **Hygiene:** rename `functions-shared`→`functions-adapters` + register in
   TIERS (with DP-7); align `firebase-admin`; reconcile declared-vs-actual deps.

## Why W4

Coverage comes last so the tests assert the _new_ invariants (post-DP-1..9), not
the old shapes — otherwise they'd be rewritten mid-flight.

## Closes

Q-TEST-1, Q-TEST-2, Q-TEST-3, Q-BUILD-1, Q-BUILD-2, Q-BUILD-3, Q-DEP-1, Q-DEP-2.
