# PR Review B — student-web (PRs #35, #34, #21, #29, #27, #11, #9)

**Reviewer:** fe-web-student (PRREV-B) · **Date:** 2026-07-13 · **Method:**
local `gh pr diff` / `git show origin/<branch>` only — nothing posted to GitHub.

## Context that drives every verdict

- All 7 PRs target **`main`**. `main` and `staging` have **massively diverged**
  (~1017 files) — `main` carries the autograde/CI line, `staging` the Lyceum
  line. Judge against **`main`** (the PR base).
- **PR #36 was MERGED into `main`** ~20 min before this review (mergeCommit
  `fba978e`, branch `fix/assign-take-qa-evidence`, "assign→take QA —
  questionOrder, ISO deadline, evidence"). #36 is the same author's consolidated
  QA cut and **already merged the frontend questionOrder / TimedTest /
  heal-script work**, which **supersedes large parts of #29 and #27**.
- The three fork PRs **#21, #11, #9** each carry an **identical ~60-file
  out-of-scope pollution block** (built artifact
  `functions/sdk-v1/lib/index.js` + `.map`, `apps/teacher-web/**`,
  `functions/identity/**`, `packages/services/**`, mobile
  `.eslintrc/package.json`, `pnpm-lock.yaml`, tsconfigs). This is **fork
  base-drift**, not intentional change — the fork was cut from a stale `main`,
  so upstream commits re-appear as "additions." Their _intended_ payload is tiny
  and is **already present, clean, in #34**.
- **CI is red on every PR** (Lint/Unit/Integration/E2E/Coverage all fail) — this
  is **repo-wide**, not PR-specific (`main` itself is mid-CI-repair). #21 and
  #34 even share the **same check-run URL** (run `29233217582`) → **same head
  commit**. CI must be re-run after any rebase; red CI here is not a
  distinguishing signal.

### Relationship map

```
#34 (org branch fix/mobile-backend-parity, CLEAN)  ─┬─ subsumes #21 (fork, same head + pollution)
                                                     ├─ subsumes #11 (space-paths.ts — byte-identical)
                                                     └─ subsumes #9  (RequireAuth picker — byte-identical)
#36 (MERGED to main) supersedes ── #29 frontend  &  #27 TestsPage + heal script
   leftover net-new value:  #29 = backend heal   ·   #27 = seed pipeline durationMinutes
```

---

## PR #35 — demo-ready dashboard, progress, profile — **APPROVE-WITH-NITS** (SDK-coord sign-off required)

7 files: `DashboardPage`, `LeaderboardPage`, `ProfilePage`, `ProgressPage`,
`SpacesListPage` +
**`packages/repositories/src/testsession-progress/api-types.ts`** +
**`packages/repositories/src/views/student-summary.ts`**. `MERGEABLE`.

**Correct & good:**

- Drops `classIds` from `useSpaces(...)` across
  Dashboard/Leaderboard/Progress/SpacesList. `listSpaces` request schema is
  strict — `classIds[]` is Zod-rejected and silently empties the list. This is
  the right fix and matches the pattern already landed in `main` (TestsPage). ✅
- Routes analytics to the student entity id:
  `studentEntityId = membership?.studentId ?? user?.uid` passed to
  `useStudentSummary` and `RecommendationsSection`. `getSummary` asserts a
  `stu_*` entity id, not the Firebase uid — this is the documented APP-1/LVL
  fix. ✅
- Empty-count guards (`spaceStatLabel`), skeletons, `EmptyState` fallbacks —
  solid demo polish.

**⚠️ Main concern — scope creep into the shared SDK seam (`student-summary.ts` +
`api-types.ts`):** this is a `packages/repositories` change used by
**parent-web, teacher-web, admin-web**, not just student-web. Three behavior
changes ride along:

1. `get()` switches `getChildSummary` → `getSummary{scope:'student'}`.
   **Correct** (students were 403'd by the parent-gated `getChildSummary`).
2. `getMany()` **regresses from ONE batched `getStudentSummaries` server-fan-in
   read (PC-14 / §4.1 "BOUNDED — never one read per member") to a client-side
   `Promise.all` fan-out — one wire call PER student.** A teacher/parent
   dashboard with N children now fires N callables. This is an architecture
   regression on the shared repo (`student-summary.ts:39-46`).
3. `getClassView()` reroutes `getClassSummary` → `getSummary{scope:'class'}`,
   and the change **deletes `getStudentSummaries` + `getClassSummary` from the
   `AnalyticsNamespace` type** (`api-types.ts:220-221`). Any remaining caller of
   those callables breaks the type. → `api-contract`/repositories is the
   **inter-team SSOT seam**. Recommend **Backend/SDK-coord sign-off** before
   merge, and keep `getMany` batched (revert to `getStudentSummaries`) rather
   than N-call fan-out.

**Nits:**

- `continueSpace` hardcodes `/algebra/i.test(s.title)` (`DashboardPage.tsx:113`)
  — demo-specific bias; fine for the demo, flag for removal after.
- `AssignedTestsCounter` renders one hidden component **per space**, each firing
  `useStoryPoints(tenantId, space.id)` just to count tests → N+1 queries on
  dashboard mount. Acceptable at demo scale; note for later (a summary field
  would be cheaper).

**Verdict:** student-web UI is APPROVE-WITH-NITS. The shared
`student-summary.ts`/`api-types.ts` change should be split out or gated on
SDK-coord review (fan-out regression + removed callables affect
parent/teacher/admin).

---

## PR #34 — route conflicts, envelope unwraps, tenant guards — **REQUEST-CHANGES (rebase), then APPROVE** — this is the keeper

19 files, all `apps/student-web/**`. `CONFLICTING`. **This PR is the clean
umbrella that subsumes #21, #11, and #9.** It has genuine net-new value **not**
in `main`:

- **`lib/space-paths.ts`** (new) + B2B/B2C prefix-aware breadcrumb/link routing
  across SpaceViewer/StoryPointViewer/Practice/TimedTest/TestAnalytics —
  **absent from `main`**. (This IS #11's payload, clean.)
- **RequireAuth school-picker / auto-switch** (single eligible membership
  auto-connects; multiple → picker; pure consumer → `/consumer`) — **absent from
  `main`**. (This IS #9's payload, clean.)
- **Real double-unwrap bug fixes:** `main`'s repo `get()` already unwraps
  `{ space }` (`levelup-content/space.ts:66`), yet `main`'s
  `SpaceViewerPage.tsx:53-54` still does `useSpace<{space:Space}>` →
  `spaceData?.space` ⇒ **`space` is always `undefined` on `main`**. #34 fixes
  this (`useSpace<Space>`; `space = spaceData`) for
  SpaceViewer/StoryPointViewer/StoreDetail. **Legit bug fix.**
- Route-conflict fixes: `/profile` → `/consumer/profile` (+ ConsumerLayout nav),
  `/consumer/notifications`, consumer test-analytics route, `/achievements`.
  Referenced pages
  (`AchievementsPage`/`NotificationsPage`/`ConsumerProfilePage`) **all exist on
  `main`** — imports are safe. ✅

**Changes required before merge:**

1. **Rebase** — `CONFLICTING`. #36 already changed `TimedTestPage.tsx` in
   `main`; #34's TimedTestPage edits (breadcrumbs + tenant-guard) will conflict.
2. **Drop the `TestsPage.tsx` hunk.** `main` already has a **more complete**
   TestsPage (per-space `onTestsLoaded`/`showEmpty`/`allSpacesReported` counting
   — 9 matches). #34's TestsPage is the older, simpler variant and **keeps
   `classIds`** (the strict-Zod bug) — merging it would regress `main`. Defer to
   `main`.
3. **Verify tenant-guard relaxations.**
   ChatTutorPanel/QuestionAnswerer/useChatTutor/useTestSession/Practice/StoryPointViewer/TimedTest
   now drop `!!tenantId` guards and pass **`tenantId: currentTenantId ?? ""`**
   to callables. Confirm the deployed callables tolerate an empty `tenantId`
   (server derives tenant from auth) — otherwise B2C users hit validation
   errors. Flag to Backend.

**Verdict:** keep #34 as the single student-web route/envelope/guard PR; rebase,
drop TestsPage, confirm empty-tenant tolerance. Then APPROVE.

---

## PR #21 — repair route conflicts… (fork) — **CLOSE-DUPLICATE (superseded by #34)**

Same branch name (`fix/mobile-backend-parity`) and **same head commit as #34**
(identical CI run URL). 87 files / +1982 / −579: the 19 real student-web files
of #34, **plus the ~68-file pollution block** (built
`functions/sdk-v1/lib/index.js`+`.map`, teacher-web, functions/identity,
packages/services, mobile configs, pnpm-lock, tsconfigs) that is pure fork
base-drift.

**Verdict: CLOSE** as a duplicate of #34. #34 is the same intended change
against a clean base; #21 adds nothing but noise. Do not merge (the
built-artifact `functions/sdk-v1/lib/index.js` edit alone is a red flag).

---

## PR #29 — harden test questionOrder + heal Algebra — **REQUEST-CHANGES / PARTIALLY SUPERSEDED**

10 files. `CONFLICTING`.

**Already in `main` via merged #36 (drop on rebase):**

- `QuestionNavigator.tsx` — `main` already has the
  `Array.isArray(questionOrder)` guard. ✅ superseded.
- `useTestSession.ts` `useStartTest` — `main` already has the "tolerate
  already-unwrapped session" fix (lines 97-99). ✅ superseded.
- `TimedTestPage.tsx` — overlaps/conflicts with #36's merged TimedTest changes.

**Net-new and worth keeping (NOT in `main`):**

- **`functions/levelup/src/callable/start-test-session.ts`** — self-heals an
  in-progress session whose `questionOrder` is empty by rebuilding from
  story-point items and persisting. Legacy backend path; net-new.
- **`packages/services/src/levelup/test-session.ts`** (the **v1/canonical**
  service) — `buildQuestionOrderFromItems` filters to **question items only**
  and sorts by `orderIndex`, heals empty order on resume, and adds
  `fail("FAILED_PRECONDITION", "No questions found…")`. This also **fixes a
  latent correctness bug**: the prior code did `itemsPage.items.map(id)` with
  **no question-only filter**, so materials/other items polluted
  `questionOrder`. Valuable.
- `test-session.ts` repo `computeRuntimeView` defensive `Array.isArray` guard —
  cheap, keep.
- `scripts/heal-algebra-timed-test-items.mjs` — one-off data heal (v2\_ only, no
  tenantCode rewrite) — fine.

**Verdict: REQUEST-CHANGES** — rebase, **drop the now-merged frontend**
(QuestionNavigator/useTestSession/TimedTest), **keep the backend heal**
(`start-test-session.ts` + `services/levelup/test-session.ts` question-only
order + precondition). Best re-cut as a backend-only PR. Note: #29 does **not**
supersede #27 — different concerns.

---

## PR #27 — assigned tests listing + Algebra seed heal — **CLOSE-OBSOLETE / mostly SUPERSEDED**

3 files. `MERGEABLE`.

- **`TestsPage.tsx`** — **fully superseded.** `main` already carries the
  enhanced version (classIds dropped, `{items}` unwrapped, **and** the per-space
  counter/`showEmpty` logic — 9 matches). #27's TestsPage is redundant.
- **`scripts/heal-greenwood-assign-take.mjs`** — **already in `main`** via #36.
  Redundant.
- **`packages/seed/src/engine/pipeline.ts`** — **NET-NEW and the one durable
  win.** Seeds `assessmentConfig.durationMinutes` (+`stats.totalQuestions`) for
  `timed_test`/`test` story points at the SP-creation loop (~line 731). `main`'s
  pipeline only sets `durationMinutes` for **exams** (lines 1004/1232/1255), not
  SP timed tests. This makes seeded timed tests valid for `startTestSession`
  **without** the manual heal scripts — the right long-term fix.

**Verdict: CLOSE this PR** and re-cut a **seed-only** PR containing just the
`pipeline.ts` change (or rebase #27 to drop TestsPage + the heal script). As-is
it's ~⅔ redundant with `main`.

---

## PR #11 — shared B2B/B2C space-path helpers — **CLOSE-DUPLICATE (superseded by #34)**

76 files / +1778 / −552. `CONFLICTING`. Intended payload =
**`apps/student-web/src/lib/space-paths.ts`** + its usage in a few student pages
— which is **byte-identical to and already included in #34** (the file, the
helper signatures, and the page rewrites match). Everything else is the **same
~60-file fork pollution block** as #21/#9 (built
`functions/sdk-v1/lib/index.js`, teacher-web, functions/identity,
packages/services, pnpm-lock…).

**Verdict: CLOSE** — merge #34 instead. #11's real content is a strict subset of
#34.

---

## PR #9 — auto-switch / school picker on missing membership — **CLOSE-DUPLICATE (superseded by #34)**

69 files / +1718 / −496. `MERGEABLE`. Intended payload =
**`apps/student-web/src/guards/RequireAuth.tsx`** school-picker/auto-switch —
verified **byte-identical to #34's RequireAuth.tsx** (same import of `Button`,
same `eligible`/`switchTenant` logic, same picker JSX). The other ~68 files are
the **same fork pollution block**.

**Verdict: CLOSE** — merge #34 instead. #9's real content is a strict subset of
#34.

---

## Recommended landing sequence

1. **#34** — rebase on `main`, drop the `TestsPage.tsx` hunk, confirm
   empty-`tenantId` callable tolerance → **APPROVE**. This lands space-paths
   (#11), the school picker (#9), and the SpaceViewer/StoreDetail double-unwrap
   fixes in one clean PR.
2. **Close #21, #11, #9** as duplicates/superseded-by-#34 (pollution + no unique
   payload).
3. **#35** — split the shared `student-summary.ts`/`api-types.ts` change for
   SDK-coord review (fan-out regression + removed callables); land the
   student-web UI portion.
4. **#29** — rebase to a **backend-only** PR (start-test-session + services
   test-session heal / question-only order / precondition); drop the #36-merged
   frontend.
5. **#27** — close; re-cut a **seed-only** PR with just `pipeline.ts`
   (`assessmentConfig.durationMinutes` for timed-test SPs).
6. Re-run CI on each after rebase — current red is repo-wide, not diagnostic.

### Architecture/scope flags raised

- **#35**: shared-SDK scope creep — `getMany` batched→N-call fan-out (violates
  PC-14), removed `getStudentSummaries`/`getClassSummary` callables,
  `getClassView` reroute — affects parent/teacher/admin.
- **#34**: `tenantId: ""` passed to callables for B2C — verify backend derives
  tenant from auth.
- **#21/#11/#9**: out-of-scope **built artifact** edits
  (`functions/sdk-v1/lib/index.js`) + broad teacher-web/functions/services churn
  — must never merge as-is.
- **#29**: latent bug fixed — `questionOrder` previously included non-question
  items (no filter) in the v1 service.
