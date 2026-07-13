# QA Assign → Take → Notify Flow (Authentic)

Generated: 2026-07-13T10:46:02.718Z

Evidence rule: **PASS only with Playwright screenshot + URL + crash/pageerror
check.**  
Strict gates: `/tests` must list links; Start Test must enter runner; no
`questionOrder is not iterable`.

## Verdict

**Teacher + Student: PASS.** Parent test-prep notification: **GAP** (heal wrote
Firestore doc; UI still empty — sibling `listNotifications` / parent-notify
unfinished).

Playwright: **3 passed** (parent soft-GAP allowed). Scorecard: **14 PASS / 1
FAIL (parent notify)**.

## Sequence proved

1. Teacher Priya — Algebra Foundations timed test on `/spaces` + space editor
   (no `useAuthSession` crash)
2. Student Aarav — `/tests` shows 3 links; Start Test enters runner
   (`inRunner=true`, `questionOrderCrash=false`)
3. Parent Suresh — login + alerts + child-progress OK; notifications empty after
   heal → **GAP**
4. Progress surface after attempt

## Scorecard

| PASS | FAIL | SKIP |
| ---- | ---- | ---- |
| 14   | 1    | 0    |

## Credentials

- School: `GRN001`
- Teacher :4569 — `priya.sharma@greenwood.edu`
- Student :4570 — `aarav.patel@greenwood.edu` (email login; roll `2025001`
  returns Invalid email/password on this seed)
- Parent :4571 — `suresh.patel@gmail.com`

## Seed heal (no tenantCodes rewrite)

- `scripts/heal-greenwood-assign-take.mjs` → Algebra Foundations timed test
  `stp_greenwood-storypoint-space-algebra-sp-eq_86801b99d6` (2 questions)
- `scripts/heal-parent-test-notification.mjs` → wrote
  `ntf_greenwood-parent-aarav-test_handover01` for Suresh authUid (UI still
  empty)

## Key evidence screenshots

| Step                       | File                                                 |
| -------------------------- | ---------------------------------------------------- |
| Teacher spaces (Algebra)   | `tmp/qa-e2e-assign-take-02-teacher-spaces.png`       |
| Teacher space editor       | `tmp/qa-e2e-assign-take-03-teacher-algebra-edit.png` |
| Student `/tests` (3 links) | `tmp/qa-e2e-assign-take-06-student-tests.png`        |
| Start Test in runner       | `tmp/qa-e2e-assign-take-09-student-after-start.png`  |
| Parent notifications (GAP) | `tmp/qa-e2e-assign-take-15-parent-notifications.png` |

## Fixes applied this session

- `TimedTestPage`: `resolveQuestionOrder` + liveSession hydrate;
  **`deadlineToEpochMs`** (ISO `serverDeadline` was treated as missing →
  “Waiting for server deadline…”)
- `TestsPage`: listSpaces without `classIds[]`; unwrap `{ items }`
- `QuestionNavigator`: `Array.isArray` guard
- `SpaceEditorPage`: import `useAuthSession`
- Vite: bind `127.0.0.1` for teacher/student/parent (Windows Playwright)
- E2E: avoid `networkidle` (Firebase websockets); student email login via
  `role=tab`

## Related branches / PRs

- `fix/student-tests-assigned-seed` — `/tests` listing + heal (PR #27 area)
- `fix/student-test-question-order` — questionOrder harden + backend
  start-session
- `fix/parent-test-notifications` — parent notify + listNotifications unblock
  (needed for notify PASS)

## Machine report

See `tmp/QA-ASSIGN-TAKE-FLOW.json`.
