# QA Assign → Take → Notify Flow (Authentic)

**Generated:** 2026-07-13T06:12:13.771Z (Playwright)  
**Refreshed:** 2026-07-13 (human review of screenshots — runner self-labels
downgraded where body contradicts)  
**Rule:** PASS only with screenshot/report evidence. No fabricated greens.  
**No tenantCodes rewrite.** Seed heal used
`scripts/heal-greenwood-assign-take.mjs` +
`scripts/heal-parent-test-notification.mjs` (v2\_ paths only).

Machine report: `tmp/QA-ASSIGN-TAKE-FLOW.json`  
Screenshots: `tmp/qa-e2e-assign-take-*.png` (15 files)

---

## Authentic scorecard (after screenshot review)

| Step                                    | Role          | Runner | Authentic  | Evidence                                                                                                                                           |
| --------------------------------------- | ------------- | ------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login + spaces (Algebra visible)        | Teacher Priya | PASS   | **PASS**   | `01`/`02`                                                                                                                                          |
| Algebra space editor `/spaces/.../edit` | Teacher       | FAIL   | **FAIL**   | `03` — `ReferenceError: useAuthSession is not defined` (needs teacher SessionContext HMR PR #25)                                                   |
| Classes list                            | Teacher       | PASS   | **PASS**   | `04`                                                                                                                                               |
| Login                                   | Student Aarav | PASS   | **PASS**   | `05`                                                                                                                                               |
| `/tests` list                           | Student       | PASS   | **YELLOW** | `06` — `testLinks=0` (empty / no cards); deep-link still works                                                                                     |
| Spaces list Algebra                     | Student       | PASS   | **YELLOW** | `07` — `hasAlgebra=false` in list text                                                                                                             |
| Linear Equations landing + Start button | Student       | PASS   | **PASS**   | `08` — Algebra Foundations → Linear Equations, Start Test visible                                                                                  |
| Start Test (no `questionOrder` crash)   | Student       | PASS   | **YELLOW** | `09` — **no questionOrder crash**, but UI shows **“Waiting for server deadline… The test timer could not be started”** — not a full in-runner take |
| Progress page                           | Student       | PASS   | **PASS**   | `11` — loads (no graded attempt proven)                                                                                                            |
| Login / alerts / child-progress         | Parent Suresh | PASS   | **PASS**   | `12`/`14`/`16`                                                                                                                                     |
| Notifications (test assigned)           | Parent        | PASS   | **FAIL**   | `15` — UI **“No notifications yet”**; heal wrote Firestore doc but list UI empty; also `summaries is not defined` pageerror                        |

**Authentic chain verdict:** **PARTIAL**

| Sequence goal                                                   | Status                                                                   |
| --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1. Teacher has timed test / Algebra Foundations assigned        | **PARTIAL** — spaces list OK; editor blocked by HMR `useAuthSession`     |
| 2. Student sees test + Start Test without `questionOrder` crash | **PARTIAL** — landing + Start OK, no crash; timer/deadline blocks runner |
| 3. Parent sees notification / alert for test prep               | **FAIL** on notifications list; alerts surface OK                        |
| 4. Progress updates after attempt                               | **NOT PROVED** — no completed attempt                                    |

---

## Credentials (TEST_CREDENTIALS.md)

- School: `GRN001`
- Teacher :4569 — `priya.sharma@greenwood.edu` / `Test@12345`
- Student :4570 — `aarav.patel@greenwood.edu` / `Test@12345`
- Parent :4571 — `suresh.patel@gmail.com` / `Test@12345`

Healed entities:

- Space: `spc_greenwood-space-space-algebra_1d2ab9a5be` (Algebra Foundations)
- Timed SP: `stp_greenwood-storypoint-space-algebra-sp-eq_86801b99d6` (Linear
  Equations)
- Parent notif id: `ntf_greenwood-parent-aarav-test_handover01`

---

## Fixes in this window

| File                                           | Why                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------- |
| `apps/student-web/src/pages/TimedTestPage.tsx` | list summaries omit `questionOrder` — `liveSession` + `getTestSession` + guards |
| `apps/student-web/src/hooks/useTestSession.ts` | Tolerate already-unwrapped `startTestSession` payload                           |
| `apps/student-web/src/pages/TestsPage.tsx`     | Drop illegal `classIds[]` on `listSpaces`; unwrap `{ items }`                   |
| `apps/*/vite.config.ts`                        | Bind teacher/student/parent to `127.0.0.1` for Windows Playwright               |

Related open PRs (fork → upstream): teacher HMR **#25**, parent notify /
listNotifications (branch `fix/parent-test-notifications`), student
questionOrder (`fix/student-test-question-order`).

---

## Remaining blockers

1. Teacher space editor: merge/apply SessionContext HMR singleton (PR #25).
2. Student Start Test: fix server deadline / live countdown projection so runner
   enters after start.
3. Parent `/notifications`: list healed `new_exam_assigned` rows; fix
   `summaries is not defined`.
4. Student `/tests` should surface Algebra timed tests without deep-link
   (seed/list wiring).

---

## How to re-run

```bash
node scripts/heal-greenwood-assign-take.mjs
node scripts/heal-parent-test-notification.mjs
# apps on 127.0.0.1:4569/4570/4571
pnpm exec playwright test --config=tests/e2e/qa-assign-take-flow.config.ts
```
