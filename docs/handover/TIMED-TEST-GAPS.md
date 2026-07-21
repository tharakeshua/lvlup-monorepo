# Timed Test Architecture — Remaining Gaps (2026-07-21)

## Fixed in this change

| Area                                          | Root cause                                                                                               | Fix                                                                |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Timer stuck on "Waiting for server deadline…" | `TimedTestPage` read `serverDeadline.seconds` (Firestore shape) but sdk-v1 returns canonical ISO strings | `timestampInputToMillis()` via `@levelup/domain` adapter           |
| Schedule gates ignored / wrong                | UI used legacy `startAt`/`endAt` + `.seconds`; views emit `opensAt`/`closesAt` ISO                       | `assessmentScheduleBounds()` with dual-field support               |
| Wrong session duration                        | `startTestSessionService` read top-level `durationMinutes` only                                          | Read `assessmentConfig.durationMinutes` first                      |
| Missing server preconditions                  | sdk-v1 lacked schedule / max-attempts / retry cooldown checks present in legacy callable                 | `assertTimedTestPreconditions()` in service                        |
| `questionOrder` crash on Start                | list summaries omit `questionOrder`                                                                      | Already on develop: `resolveQuestionOrder` + `liveSession` hydrate |

## QA as Aarav (student :4570)

Credentials: `aarav.patel@greenwood.edu` / `Test@12345` (school `GRN001`).

1. **Spaces path:** Login → Spaces → **Algebra Foundations** → **Linear
   Equations** (timed_test module) → **Start Test**.
2. **Expect:** Countdown timer appears (not "Waiting for server deadline…");
   question navigator shows Q1…Qn; Save & Next works.
3. **Submit:** Answer at least one question → Submit Test → results view with
   score grid.
4. **Resume:** Refresh mid-test → session resumes with same order and remaining
   time.
5. **Tests hub:** `/tests` lists timed tests when assigned (may still be empty
   if seed/list wiring incomplete — use Spaces deep-link as fallback).

## QA as Priya (teacher :4569)

Credentials: `priya.sharma@greenwood.edu` / `Test@12345`.

1. **Create timed module:** Spaces → edit space → add story point type **Timed
   Test** → add question items → set **Duration** in assessment config → publish
   space.
2. **Assign:** Ensure target class can see the published space.
3. **Verify student path:** Confirm Aarav sees the module under Spaces
   (timed_test icon) and can start without timer error.

## Remaining gaps (not in this PR)

1. **`/tests` empty list** — student tests page may show zero cards until
   class/space list seed wiring is fixed (`fix/student-tests-assigned-seed`).
2. **Parent notifications** — `new_exam_assigned` rows may not appear in parent
   UI (`fix/parent-test-notifications`).
3. **Teacher space editor HMR** — `useAuthSession is not defined` on hot reload
   (PR #25 / `fix/teacher-session-hmr-context`).
4. **Dual backend** — legacy `functions/levelup/start-test-session.ts` still
   exists alongside sdk-v1; production should route 100% through sdk-v1
   callables.
5. **`useTestSessionDeadline` RTDB stream** — optional enhancement for countdown
   resync; page currently derives deadline from session view + `useServerTime`
   offset.
6. **Quiz vs timed_test** — `quiz` story points still route to standard
   story-point viewer, not `TimedTestPage` (by design unless product changes).
7. **Submissions map on session view** — sdk-v1 stores answers in subcollection;
   results breakdown may show "Not attempted" until getTestSession joins
   submissions (verify after submit).

## Re-run automated gate

```bash
node scripts/heal-greenwood-assign-take.mjs
pnpm exec playwright test --config=tests/e2e/qa-assign-take-flow.config.ts
pnpm --filter @levelup/services test
pnpm --filter student-web test   # if configured
```
