# PR Review A — backend/auth (PRs #31, #30 · closed-PR salvage #22, #12, #13, #14)

**Reviewer:** be-backend (PRREV-A2) · **Date:** 2026-07-18 · **Method:** local
`gh pr view/diff` + `git show origin/{main,staging}` only — **nothing posted to
GitHub**. Author of all PRs: `tharakeshua`; all target `main`.

## Context that drives every verdict

- Per the owner bulk-close (2026-07-17), only #29–#35 remain open. From this
  lane: **#31 and #30 are OPEN** (full reviews below); **#12, #13, #14, #22 are
  CLOSED-UNMERGED** (salvage notes at the end).
- `staging` is authoritative and prod-deployed; each fix is judged against
  **both** main (the PR base) and staging.
- #31/#22 are **the same commit** — head SHA `316967f` on both (org branch
  `lvlup-gg/fix/p0-auth-membership-v2` vs the fork). #22 is correctly closed as
  the duplicate.
- Deployed Firestore rules (identical on main and staging,
  `firestore.rules:736-738`): `v2_userMemberships` is
  **`allow read, write: if false`** — the U2.4/U2.5 deny-all posture on all v2\_
  roots. This kills #31's central mechanism (details below).
- The v1 on-call adapter
  (`packages/functions-shared/src/adapters/on-call.ts:64`) strips only
  `__apiVersion`/`__idempotencyKey`; **no request schema in the levelup module
  declares `tenantId`** (claim-derived,
  `api-contract/src/callables/levelup/_shared.ts:11`). Tenant always comes from
  claims server-side.

---

## PR #31 — read v2\_ memberships and send targetTenantId — **REQUEST-CHANGES (extract 1 real fix; the titular mechanism is dead-on-arrival)**

`lvlup-gg/fix/p0-auth-membership-v2` · +1020/−392 · 34 files · **CONFLICTING** ·
CI: Lint/Type-Check/Build all FAILURE.

Three unrelated payloads travel together: (A) the shared-services auth seam, (B)
~20 student-web files, (C) 6× `.env.production` + a heal script.

### A1. `switchActiveTenant` rewire — ✅ the one fix to extract

`auth-callables.ts` + `useAuthHooks.ts` retarget the legacy `switchActiveTenant`
callable to **`v1-identity-switchActiveTenant`** and rename the arg to
**`targetTenantId`**. This matches the contract exactly
(`api-contract/src/callables/identity/users.ts:66`:
`{ targetTenantId: zTenantId }.strict()`), and it is **needed on staging too**:
staging's `shared-services/auth/auth-callables.ts:110` still calls the legacy
`'switchActiveTenant'` with `{tenantId}`, and the legacy function surface is
deleted per the owner's full-API-reset decision — every school login that goes
through shared-stores `switchTenant` is calling a nonexistent function. Extract
this (plus the matching test updates) onto a clean staging-cut branch.

### A2. Client-side v2\_ membership reads — ❌ cannot work against deployed rules

The new `collection-prefix.ts` (+ `membership-service.ts` candidates loop, +
`VITE_LVLUP_COLLECTION_PREFIX=v2_` in six `.env.production` files) makes the
**web client query `v2_userMemberships` directly via the Firestore SDK**. Two
independent blockers:

1. **Deployed rules deny it.** `v2_userMemberships` is explicit deny-all on both
   branches (`firestore.rules:736-738`). The candidates loop treats
   `permission-denied` as "collection missing" and **silently falls through to
   bare `userMemberships`** — i.e. in production this PR's titular behavior
   never executes; login only works if a **legacy mirror row** exists in the
   unprefixed collection. That re-couples auth to legacy data the owner has
   declared nonexistent, and masks the misconfiguration it claims to fix
   ("Missing or insufficient permissions" becomes "No active membership", which
   is _wrong_ when the v2\_ row exists but is unreadable).
2. **Architecture.** The platform rule is callable-SDK-only — zero direct client
   Firestore on v2* roots (AD-11/AD-12; the deny-all posture is deliberate, e.g.
   the answer-key trap). The correct fix for membership resolution is the server
   path staging's SDK migration already uses: `v1.identity.getMe` /
   `evaluateTenantAccess` return the caller's memberships with claims-derived
   tenancy. If shared-stores must keep working during the transition, route
   `getUserMemberships` through those callables — do not open v2* rules for
   client reads (that would need an explicit ADR, not a fallback chain in a PR).

The `auth-store.ts` ghost-tenant hardening (prefer
`byLookup ?? byCode ?? getMembership`, populate `allMemberships`, switch to the
_membership's_ tenantId) is sensible defensive logic, but it sits on top of the
broken read path — re-implement it on the callable-backed resolver.

### B. Student-web payload — drop; it duplicates #34

`space-paths.ts`, the RequireAuth auto-switch/school-picker,
`{space}`/`{listing}` double-unwrap fixes, consumer route repairs, and the
`tenantId: currentTenantId ?? ""` guard relaxations are the same payload
REVIEW-B already designated to land via **#34** (the clean student-web
umbrella). Two lanes must not merge the same files. On the `tenantId ?? ""`
question flagged by REVIEW-B: backend-side this is safe **at the wire** —
levelup request schemas don't carry `tenantId` (the hook layer drops it before
invoke) and the server derives tenant from claims; a truly tenant-less
(pure-B2C) caller will get a clean `requireTenant` failure on tenant-scoped
callables rather than a validation error.

### C. Rest

- `.env.production` × 6: only meaningful with the rejected client-read
  mechanism; also deployment config riding on an auth PR.
- `scripts/heal-greenwood-demo-exam.mjs`: v2\_-only, no tenantCode rewrite
  (respects the RR guardrails); ops-script quality is fine, but the hand-built
  exam/submission docs bypass the canonical Zod shapes — acceptable for a demo
  heal, don't generalize.
- Large single→double-quote reformat churn across `auth-callables.ts` and tests
  (the fork-base prettier drift) obscures the real diff.

**Verdict: REQUEST-CHANGES.** Extract A1 (switchActiveTenant/`targetTenantId`
rewire) onto a clean staging-cut branch; replace A2 with callable-backed
membership resolution (getMe/evaluateTenantAccess); drop the student-web files
(defer to #34) and the env/prefix plumbing. As-is the PR must not merge to
either branch.

---

## PR #30 — parent test notifications + listNotifications unblock — **REQUEST-CHANGES (backend core is 70% right; re-cut server files onto staging, drop the bundle)**

`lvlup-gg/fix/parent-test-notifications` · +1290/−348 · 24 files ·
**CONFLICTING**.

### What's genuinely good (verified against domain + staging)

- **`projectNotification` (`packages/services/src/shared/projections.ts`)** —
  projects stored docs (legacy `recipientId`, free-form `payload`, outbox type
  aliases) into strict `NotificationSchema`. The 11-value type set **matches
  `packages/domain/src/enums/notification.ts` exactly**, and the legacy-alias
  table (`exam_published→new_exam_assigned`, `graded→submission_graded`, …) is
  the right canonicalization. Keep.
- **Empty-`enabledTypes` mute bug (`notifications.ts` emit)** — real P1: domain
  `NotificationPreferencesSchema` defaults `enabledTypes: [].default([])`, and
  the old guard `if (enabledTypes && !enabledTypes.includes(type)) continue`
  therefore **muted every notification for any user with default prefs**. The
  fix (empty allow-list ⇒ allow all) + the new unit test is correct. Keep.
- **Dual-write `recipientUid` (canonical) + `recipientId` (legacy)** in both
  writers (services emit + `functions/identity/notification-sender.ts`), plus
  `readAt: null` — right transitional shape. (Note the legacy
  `functions/identity` writer is on the deletion list per the API reset; the
  services-side write is the one that matters long-term.)
- **`triggers.ts` type remap** to canonical enum values +
  `recipientRole`/`entityType` pass-through — correct;
  `direct_message`/`announcement`/`progress_milestone → system_announcement` is
  right given the enum has no such members.
- **Indexes:** of the 3 added `notifications` composites,
  `recipientUid+createdAt ASC` is **already on staging** (commit `c67658f`); the
  DESC and `recipientUid+isRead+createdAt` ones are net-new and worth landing
  (staging's DESC/isRead composites still key on legacy `recipientId` only).
- Small legit UI fix: parent `DashboardPage` avg-performance guard (`childRows`
  vs `summaries`).

### What needs changes

1. **`assign.ts` inline fan-out is an unbounded N+1 inside a callable.** Per
   class → `classes.get`, per student → `students.get`, per parent →
   `parents.get`, then **per-parent `emitNotificationService`** (each = prefs
   read + tx + `unreadCount` + badge write), all sequential `await`s in loops. A
   3-class assignment with 30 students × 2 parents ≈ 200+ serial Firestore
   round-trips inside `assignContent` — latency blowup and a timeout risk
   exactly where the teacher clicks "Assign". The codebase already has the right
   pattern: **enqueue one outbox row and fan out in `notification/triggers.ts`
   `deliver()`** (at-least-once + dedupeKey already supported). Also: the bare
   `catch {}` swallows all fan-out failures with no log — notifications will
   silently not arrive.
2. **`listNotifications` rewrite is half-obsolete and its cursor is fragile.**
   The stated motivation ("deployed composites key on legacy recipientId;
   recipientUid+createdAt 500s") is stale on staging — `c67658f` added that
   composite (ASC). The _merge-legacy-`recipientId`-rows_ half still has real
   value while old rows exist, but: the cursor (`findIndex` of the cursor id
   inside a re-fetched window capped at `fetchLimit ≤ 100`) silently loses pages
   beyond 100 merged rows, and a row evicted from the window resets pagination
   to page 1. Prefer: single `recipientUid` query with `orderBy createdAt`
   (index now exists; add the DESC composite from this PR), plus the
   legacy-merge as a bounded transitional read, or a one-off backfill stamping
   `recipientUid` on legacy rows (then delete the merge path).
3. **`dedupeKey` uses the sorted classIds set**
   (`assign:{type}:{id}:{classKey}:student`) — re-assigning the same content
   with an overlapping-but-different class set produces a new key and
   re-notifies already-notified students. Key by content id (+ per-recipient)
   instead.
4. **Scope/bundle:** `ci.yml`, `deploy.yml`, `playwright.config.ts`,
   `visual-regression.spec.ts` (843 lines), preview-server scripts,
   `transport-http` `FetchFunction` type, and the student-web
   `QuestionNavigator`/`TimedTestPage`/`TestsPage`/`useTestSession` hunks
   (quote-reformat churn + overlap with the already-merged #36 line) do not
   belong in a parent-notifications PR and are why it's CONFLICTING. The
   canonical doc-comments deleted from `notifications.ts`/`assign.ts`
   (announcement projection rationale, assignment-row semantics) should be
   restored.
5. `sendDirectMessage` type change to `system_announcement` — correct vs the
   enum, but it erases the direct-message distinction on the wire; if product
   wants DMs distinguishable, that's an enum addition, not a type reuse. Flag
   for SDK-coord.

**Verdict: REQUEST-CHANGES.** Re-cut a **server-only** PR onto a staging-cut
branch: `projections.ts` + `notifications.ts` (emit fixes; simplified list per
(2)) + `triggers.ts` + the two net-new indexes + the new tests, with `assign.ts`
reworked to outbox-based fan-out. Drop the CI/e2e/student-web bundle.

---

## Closed-PR core salvage (#22, #12, #13, #14)

All four were closed unmerged in the 2026-07-17 bulk-close. None of their
content is on main or staging today.

**#22 — CLOSE-DUPLICATE (already closed, correctly).** Identical head commit to
#31 (`316967f`) from the fork remote. Nothing to salvage beyond #31's review
above; one-line disposition: superseded by #31.

**#12 — identity getClass teacher-claim scope — core fix is CORRECT and worth
re-cutting onto staging.** Adds to `getClassService` the same teacher guard
`listClasses` already has on main
(`ctx.role === "teacher" && !ctx.isSuperAdmin && !ctx.classIds.includes(id)` →
`PERMISSION_DENIED`), closing the hole where a teacher could read any class
detail + first roster page by id. Verified: main's `reads.ts` has the
listClasses scope block (lines ~377-384) but **not** the getClass guard;
**staging has _neither_** — `origin/staging reads.ts` contains zero teacher
claim-scoping, so staging's exposure is worse (listClasses _and_ getClass are
tenant-wide for teachers). Re-cut onto staging as a small PR carrying **both**
the listClasses scope port and the getClass guard, plus the 5-case test file
(which is clean and harness-compatible). Admin/staff stay tenant-wide by design
— matches the analytics.getSummary(class) scoping.

**#13 — autograde dead-letter nondestructive resolve — core fix is CORRECT;
staging needs the _bigger_ SVC-4 base first.** Two real hardenings over main's
resolver: (a) idempotent re-resolve of a legacy row lacking `resolutionMethod`
now coerces a valid enum value (`dismissed`) instead of returning `undefined`
and failing the strict wire schema; (b) `retry` on a row with no `submissionId`
now fails `INVALID_ARGUMENT` _before_ marking resolved (previously it enqueued a
pipeline advance for `undefined` and stamped the row resolved). The third change
(patch by `rowId`) is a no-op — the entry is found by `id === input.entryId`, so
they're always equal; the PR body oversells it. Critical staging note:
**staging's `resolveDeadLetterService` still has the destructive
`outbox.drain(tenantId)` + re-enqueue pattern** that SVC-4 killed on main —
resolving one dead-letter on staging drains _every_ outbox row for the tenant
and re-enqueues only the resolved entry. Re-cut onto staging = port main's SVC-4
`list`+single-row-`update` base **plus** #13's two guards, plus both test files.

**#14 — repositories envelope unwraps — core fix is CORRECT and still missing
everywhere it targeted.** Server wire shapes verified: `getStoreSpace` returns
`{ listing }` (`services/levelup/purchase.ts:63`), `getSpace`/`getSpaceProgress`
return `{ space }`/`{ progress }`. Main fixed only `spaceRepo.get`
(`levelup-content/space.ts` unwraps `{space}`); **main's `store.ts:62`
`getStoreSpace` and `views/space-detail-view.ts` fallback still return raw
envelopes — unchanged today — and staging lacks _all_ of it including the
`spaceRepo.get` unwrap** (`origin/staging space.ts`
`get: (id) => lv["getSpace"]!({spaceId:id})`, corroborating FNCLEAN-2).
Practical effect: store detail pages and the space-detail fallback view hand
`{listing:…}`/`{space:…}` objects to callers expecting the entity. The test
changes are sound (the assembly test's call-bound bump 4→5 is justified by
forcing the fallback path; the `{storyPoint}` unwrap test pins existing
behavior). Re-cut onto staging as a small repositories PR: `store.ts` +
`space-detail-view.ts` from #14 **plus** the `spaceRepo.get` unwrap staging is
missing, plus both test files.

---

## Recommended landing sequence (this lane)

1. **Staging-cut small PRs from salvage:** #12 (getClass+listClasses teacher
   scope), #13 (SVC-4 base + guards), #14 (envelope unwraps incl.
   `spaceRepo.get`) — all three are low-risk, tested, and staging is currently
   _worse_ than main on each seam.
2. **#31:** extract the `v1-identity-switchActiveTenant`/`targetTenantId` rewire
   onto staging (school login via shared-stores is calling a deleted function
   today); redesign membership reads as callable-backed; close or fully re-scope
   the PR. Do **not** merge as-is on either branch.
3. **#30:** re-cut server-only (projections/emit/triggers/indexes/tests +
   outboxed assign fan-out) onto staging; drop the CI/e2e/student-web bundle.
4. **#22:** stays closed (duplicate of #31, same SHA).

### Architecture/scope flags raised

- **#31:** client Firestore reads on v2\_ roots vs deny-all rules +
  callable-only architecture — the permission-denied→fallback chain _silently
  masks_ the misconfiguration; membership resolution belongs in
  `v1.identity.getMe`/`evaluateTenantAccess`.
- **#31/#34 overlap:** identical student-web payload in two open PRs — only #34
  should carry it.
- **#30:** unbounded synchronous notification fan-out inside `assignContent` —
  must go through the existing outbox/`deliver()` pattern; silent `catch {}` on
  notify failures.
- **#30:** `direct_message` semantics collapsed into `system_announcement` —
  needs SDK-coord/product ack if DMs should stay distinguishable.
- **Staging gaps discovered while reviewing** (independent of these PRs): no
  teacher claim-scoping in identity reads; destructive dead-letter drain;
  missing `{space}` unwrap in `spaceRepo.get`; legacy `switchActiveTenant`
  callable name in shared-services.
