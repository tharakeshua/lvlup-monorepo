# DP-8 · Dedupe wave + live realtime + delete dead runtimes

**Wave:** W3 · **Status:** design-only · **Evidence:** R3/R2 (CON-2/4, REPO-5/6,
QRY-1/2/5, MISC-1/2).

## Problem

The deferred "cross-domain dedupe wave" never ran:

- **Synonym `DomainName` roots** in the canonical union
  (`api-contract/domains.ts:19`): `evalSettings`+`evaluationSettings`,
  `deadLetter`+`gradingDeadLetter`, `enrollment`+`enrollments` → invalidating
  one never refetches the other → **silent cache staleness** (CON-2).
- **Duplicate repos colliding on bag keys:** two `LeaderboardRepo`
  (`views/leaderboard.ts:50` vs `analytics/views/leaderboard.ts:39`) collide on
  `leaderboardRepo`; analytics spreads last → silently shadows the gamification
  REST+RTDB composer (REPO-5). Same for `ExamAnalyticsRepo` on
  `examAnalyticsRepo` (REPO-6) — winner = spread order.
- **Duplicate `dismissInsight`** in 2 modules with divergent response shapes,
  both on the optimistic allowlist (CON-4).
- **Cross-domain hook-name collisions** papered over by aliasing in the barrel
  (`query/index.ts:218`) (QRY-5).
- **Realtime keys write where nothing reads:** `studentLevelLive` writes
  `levelKeys.detail("me")` but the read hook keys on `"self"` → live payload
  never lands; `achievementUnlock` writes a key nothing reads (QRY-1);
  inconsistent `"me"` vs `"self"` within one domain
  (`gamification/keys.ts:45,50`) (QRY-2).
- **Dead runtimes duplicated divergently:** `@levelup/realtime`'s
  refcount/dedupe/warm-replay manager is off the live path — `query` ships its
  own `useSubscription` calling `transport.subscribe` directly (MISC-1);
  `@levelup/offline` is dead and duplicated by a divergent copy in
  `api-client/offline.ts` (ISO vs numeric `enqueuedAt`, `execute` vs `deliver`,
  `"syncing"` vs `"flushing"`) (MISC-2).

## Target design

1. **Collapse synonym domain roots** to one canonical name each in `DomainName`;
   update emitters/invalidators. _(CON-2)_
2. **One impl per repo bag key** — delete the shadowed duplicate
   `LeaderboardRepo`/`ExamAnalyticsRepo`; keep the richer composer. _(REPO-5/6)_
3. **One `dismissInsight`** with one response shape. _(CON-4)_ Remove barrel
   aliasing once names are unique. _(QRY-5)_
4. **One exported `SELF` sentinel** so realtime write-keys == read-keys.
   _(QRY-1/2)_
5. **Decide each dead runtime, explicitly:** either route the live path through
   `@levelup/realtime` (refcount/dedupe/warm-replay) and the api-client offline
   copy through `@levelup/offline`, **or delete the unused package**. No
   divergent duplicate may remain. _(MISC-1/2)_ — also resolves DP-7's `query`
   declares-`offline`/`realtime`-unused finding.

## Migration

Mostly internal (no wire break) except the `DomainName` rename, which must
update every emitter + invalidation hint together (a totality test already
exists — extend it).

## Tests

- "no synonym domain roots" assertion on `DomainName`.
- "no duplicate repo bag key" assertion across the repos map.
- realtime: a subscription write-key is read by at least one hook (key-parity
  test).

## Closes

CON-2, CON-4, REPO-5, REPO-6, QRY-1, QRY-2, QRY-5, MISC-1, MISC-2.
