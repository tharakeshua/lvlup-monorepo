# QA Authentic Status — LvlUp

**Packed:** 2026-07-13 (authentic live QA refresh)  
**Rule:** PASS only with screenshot/report evidence. Runner self-labels that contradict body text are **downgraded** here.  
**No fabricated greens.**  
**Live suite verdict:** **55 PASS / 0 FAIL / 2 SKIP** — see [`QA-LIVE-EVIDENCE.md`](./QA-LIVE-EVIDENCE.md) + `tmp/QA-HANDOVER-AUTHENTIC.json` (finished 2026-07-12T20:17:54.175Z).

Sources consulted:

- **`tmp/QA-HANDOVER-AUTHENTIC.json`** (authoritative machine report)
- **`docs/handover/QA-LIVE-EVIDENCE.md`** (human-readable per-route)
- Screenshots: `tmp/qa-handover-*.png` + `tmp/qa-handover-retest-*.png` (61 files)
- Prior 2h DRIVER pack (historical context): `tmp/PLATFORM-2H-STATUS.md`, `tmp/platform-2h-*`
- P0 HMR: teacher `apps/teacher-web/src/sdk/session.tsx` (PR #25); admin `apps/admin-web/src/sdk/session.tsx` (dedicated PR + PR #19)

---

## Role scorecard (authentic live suite)

| Role | Overall | PASS / FAIL / SKIP | Summary |
|------|---------|--------------------|---------|
| Teacher (Priya) | **PASS** | 18 / 0 / 2 | Full sidebar + analytics + class detail; skip space-edit & exam-detail (no link) |
| Student (Aarav) | **PASS** | 11 / 0 / 0 | Dashboard, spaces, Algebra Foundations viewer, tests/results/profile |
| School Admin | **PASS** | 16 / 0 / 0 | Users, classes, exams, spaces, analytics, staff, announcements, export |
| Parent (Suresh) | **PASS** | 10 / 0 / 0 | Dashboard, children, progress, alerts, compare, settings |
| **TOTAL** | **PASS** | **55 / 0 / 2** | Zero crashes / pageerrors on PASS routes |

**Earlier pack note:** PLATFORM 2H DoD (login + core surface) remains **MET**. Older FAIL snapshots (student journey, early admin getMe) are **stale**. An intermediate authentic run that reported teacher/student crashes is **superseded** by the 55/0/2 retest after SessionContext HMR fixes.

---

## Authentic suite — definition of done

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Teacher routes usable (`:4569`) | **GREEN** | 18 PASS · `tmp/qa-handover-teacher-*.png` |
| 2 | Student routes + Algebra Foundations (`:4570`) | **GREEN** | 11 PASS · space viewer screenshot |
| 3 | Admin routes (`:4568`) | **GREEN** | 16 PASS · users/classes/staff |
| 4 | Parent routes + child surfaces (`:4571`) | **GREEN** | 10 PASS · dashboard/progress |
| 5 | Zero FAIL in suite | **GREEN** | `QA-HANDOVER-AUTHENTIC.json` totals |
| 6 | Vite apps 4568–4571 | **GREEN** | Bound `127.0.0.1` |

**Verdict:** Authentic live QA **PASS** (55/0/2).

---

## Still yellow (non-blocking)

| Item | Severity | Notes |
|------|----------|-------|
| `v1-identity-listNotifications` | YELLOW | **500** on some roles after login |
| `v1-analytics-getChildSummary` | YELLOW | Occasional **403**; spaces path OK |
| Teacher deep-link skips | SKIP | No visible edit/detail links in list UI |
| Redeploy / IAM ActAs | YELLOW | Documented; live callables already respond |
| Ghost GRN001 tenant ids | YELLOW | Prefer canonical `tn_greenwood_524e429639` |

---

## P0 code fixes (this window)

1. **`callSwitchActiveTenant`** — `packages/shared-services` → `v1-identity-switchActiveTenant` + `{ targetTenantId }`.
2. **Teacher SessionContext HMR** — `globalThis` singleton in `apps/teacher-web/src/sdk/session.tsx` — [PR #25](https://github.com/subhangR/lvlup-monorepo/pull/25).
3. **Admin SessionContext HMR** — same pattern in `apps/admin-web/src/sdk/session.tsx` — [PR #26](https://github.com/subhangR/lvlup-monorepo/pull/26) + included in [PR #19](https://github.com/subhangR/lvlup-monorepo/pull/19) handover bundle.

---

## Teacher — detailed

| Case | Status | Evidence |
|------|--------|----------|
| Login + dashboard | **PASS** | `qa-handover-teacher-01/02-*.png` |
| Spaces / QB / rubrics / exams / classes | **PASS** | teacher-03 … 08 |
| Analytics routes | **PASS** | classes retest + exams/spaces/tests |
| Assignments / grading / students / settings / notifications | **PASS** | teacher-13 … 17 |
| Class detail | **PASS** | teacher-18 |
| Space edit / exam detail deep links | **SKIP** | No link visible |

---

## Student — detailed

| Case | Status | Evidence |
|------|--------|----------|
| Login + dashboard | **PASS** | student-01 + retest dashboard |
| Spaces + Algebra Foundations viewer | **PASS** | retest spaces + student-11 |
| Tests / results / leaderboard / achievements | **PASS** | student-04 … 07 |
| Profile / settings / notifications | **PASS** | student-08 … 10 |

---

## Parent — detailed

| Case | Status | Evidence |
|------|--------|----------|
| Login + dashboard (child Aarav) | **PASS** | parent-01/02 |
| Children / results / progress / child-progress | **PASS** | parent-03 … 06 |
| Alerts / compare / notifications / settings | **PASS** | parent-07 … 10 |

---

## Admin — detailed

| Case | Status | Evidence |
|------|--------|----------|
| Login + dashboard + users + classes | **PASS** | admin-01 … 04 |
| Exams / spaces / AI usage / settings / sessions | **PASS** | admin-05 … 09 |
| Reports / analytics / courses / notifications | **PASS** | admin-10 … 13 |
| Staff / announcements / data-export | **PASS** | admin-14 … 16 |

---

## Counts (evidence aggregation)

| Suite | Result | Authentic note |
|-------|--------|----------------|
| **Live handover authentic** | **55 PASS / 0 FAIL / 2 SKIP** | Authoritative for client pack |
| Platform 2H DoD (prior) | 6/6 GREEN — MET | Still valid for login/core DoD |
| QA swarm teacher critical | 4 PASS / 0 FAIL | Depth evidence |
| Teacher wave2 (prior) | Improved via rubric coerce PR #24 | See teacher scorecard |

---

## What remains after demo-ready authentic QA

1. Fix `listNotifications` 500.
2. Clear or soft-fail remaining analytics 403s.
3. Merge open fork PRs (#4 mega + topic #5–#26) or have client clone fork tip knowingly.
4. Maintainer IAM ActAs for non-impersonated deploys.
5. Optional: surface space-edit / exam-detail links so SKIP routes become testable.
