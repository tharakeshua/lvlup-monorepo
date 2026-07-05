# DP-9 · Prefix-aware subscriptions + timestamp wire sweep

**Wave:** W3 (blocks any `v2_` client deploy) · **Status:** design-only ·
**Evidence:** R2 (F-NS-01/02, F-TS-01).

## Problem

- **F-NS-01:** `transport-firebase` subscription paths hardcode `tenants/${T}/…`
  (`subscribe/subscription-sources.ts:87-134`) with **zero prefix awareness** —
  there is no `collectionPrefix` in the package. Under
  `LVLUP_COLLECTION_PREFIX=v2_`, writes go to `v2_tenants/…` but **live
  subscriptions read `tenants/…` → realtime split-brain.** Not covered by the
  paths mirror test.
- **F-TS-01:** ~20 wire timestamp fields (`identity/*`, `subscriptions/*`,
  `autograde/*`, `levelup/gamification.ts`) are bare `z.string()` (one is
  `z.string().datetime()` — a 3rd flavor) instead of canonical `zTimestamp`.
  `autograde/_shared.ts` proves the correct pattern; `timestamp.zod.ts`'s header
  claims `zTimestamp` is used (doc-vs-reality drift).
- **F-NS-02:** hardcoded `tenants/` storage paths (same prefix-blindness class).

## Target design

1. **Thread `collectionPrefix()` into `transport-firebase` subscription path
   construction** — single source, identical to the server/seed prefix logic
   (`repo-admin/paths.ts`). Extend the existing paths mirror test to cover
   subscription sources so write-path and subscription-path prefixes can never
   diverge.
2. **Timestamp wire sweep:** convert the ~20 bare-`z.string()` `*At`/deadline
   fields to canonical `zTimestamp`; add a lint rule banning bare
   `z.string()`/`z.string().datetime()` on `*At`/`*Deadline` fields; correct the
   `timestamp.zod.ts` docblock.
3. **Storage paths (F-NS-02):** route through the same prefix-aware path builder
   (ties into DP-1's storage wiring).

## Why W3 / deploy-gated

This is the gate before **any `v2_` client deploy** — without it, real-time
reads silently miss prefixed data. Coordinate with be-infra-deploy (GATE-B) and
be-data-seed (the SUB001 `v2_` data already lives prefixed).

## Migration

- Prefix threading is internal (no wire break) but **deploy-sensitive** — verify
  against the emulator with `LVLUP_COLLECTION_PREFIX=v2_` before any client
  points at prefixed data.
- Timestamp sweep is a wire-type tightening — confirm clients send/receive ISO
  strings (they do at rest) so no break; ship behind the api-contract seam.

## Tests

- Paths mirror test extended to subscription sources (write-path prefix ==
  subscription-path prefix under `v2_`).
- Lint: no bare `z.string()` on `*At` fields.

## Closes

F-NS-01, F-NS-02, F-TS-01.
