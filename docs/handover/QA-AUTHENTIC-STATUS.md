# QA Authentic Status — LvlUp

**Packed:** 2026-07-12 (refreshed after PLATFORM 2H DRIVER)  
**Rule:** PASS only with screenshot/report evidence. Runner self-labels that contradict body text are **downgraded** here.  
**No fabricated greens.**  
**2h bar verdict:** **MET** — see `tmp/PLATFORM-2H-STATUS.md` (updated 2026-07-12T19:54Z).

Sources consulted:

- **`tmp/PLATFORM-2H-STATUS.md`** (authoritative for 2h DoD)
- `tmp/platform-2h-callable-probe2.json`, `tmp/platform-2h-browser-report.json`, `tmp/platform-2h-parent-report.json`
- Screenshots: `tmp/platform-2h-{teacher,student,admin,parent}.png`
- Prior packs (historical; superseded where they conflict with PLATFORM-2H): `tmp/qa-swarm-*`, `tmp/qa-teacher-wave2-*`, `tmp/qa-student-journey-*`, `tmp/platform-2h-callable-probe.json` (earlier probe — Admin/Parent FAIL; healed since)
- Sibling deploy notes: sdk-v1 revision `v1-identity-listclasses-00007-jar` (prior window; no redeploy this 2h pass)

---

## Role scorecard (honest — 2h bar)

| Role | Overall | Summary |
|------|---------|---------|
| Teacher (Priya) | **PASS (2h)** | Login + dashboard usable on `:4569`; getMe + switchActiveTenant + listSpaces OK |
| Student (Aarav) | **PASS (2h)** | Login + **Algebra Foundations** on `:4570`; listSpaces count=1 (supersedes earlier journey FAIL) |
| Parent (Suresh) | **PASS (2h)** | Browser dashboard shows child Aarav Patel on `:4571` |
| School Admin | **PASS (2h)** | Dashboard + `/users` Teachers 3 / Students 6; listClasses=3, listStudents=6 on `:4568` |
| Cross-role / backend | **PARTIAL** | Identity + content callables GREEN; listNotifications 500; occasional analytics 403 |

**Earlier pack note:** A prior handover snapshot marked Student/Admin FAIL and Parent unverified. That is **stale**. DRIVER heals + `callSwitchActiveTenant` `{ targetTenantId }` fix flipped the 2h DoD rows to GREEN.

---

## Platform 2H — definition of done

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Teacher Priya login + dashboard (`:4569`) | **GREEN** | `tmp/platform-2h-teacher.png` |
| 2 | Student Aarav + ≥1 learning path (`:4570`) | **GREEN** | Algebra Foundations — `tmp/platform-2h-student.png` |
| 3 | Admin Greenwood users/classes (`:4568`) | **GREEN** | Users Teachers 3 / Students 6; API listClasses/listStudents |
| 4 | Parent credentials/data (`:4571`) | **GREEN** | Suresh → Aarav Patel — `tmp/platform-2h-parent.png` |
| 5 | Backend identity + one content path | **GREEN** | `tmp/platform-2h-callable-probe2.json` |
| 6 | Vite apps running 4568–4571 | **GREEN** | Bound `127.0.0.1` |

**Verdict:** 2h bar **MET** (all six rows GREEN).

---

## Still yellow (non-blocking)

| Item | Severity | Notes |
|------|----------|-------|
| `v1-identity-listNotifications` | YELLOW | **500** on admin/parent after login |
| `v1-analytics-getChildSummary` | YELLOW | Occasional **403**; spaces path OK |
| Teacher dashboard cards | YELLOW | Shell usable; some widgets empty/slow |
| Transient getMe 401 | YELLOW | Pre-token race; later 200 |
| Redeploy / IAM ActAs | YELLOW | Documented; live callables already respond |
| Ghost GRN001 tenant ids | YELLOW | Prefer canonical `tn_greenwood_524e429639` |

---

## P0 code fix (this window)

`packages/shared-services` — `callSwitchActiveTenant` → **`v1-identity-switchActiveTenant`** with **`{ targetTenantId }`** (was legacy `switchActiveTenant` + `{ tenantId }`). Dist rebuilt. Unblocked student/parent school login against live identity.

---

## Teacher — detailed (2h + prior depth)

| Case | Status | Evidence |
|------|--------|----------|
| Login + dashboard (2h) | **PASS** | `tmp/platform-2h-teacher.png`, browser report |
| getMe / switch / listSpaces (2h) | **PASS** | Callable probe2 |
| Spaces / timed-test / exam wizard (prior swarm) | PASS | `tmp/qa-swarm-report.json` |
| Wave2 route sweep (prior) | PARTIAL | 16/18; rubric Loading unstable — `tmp/qa-teacher-wave2-report.json` |
| Analytics getSummary 403 (prior) | YELLOW | Occasional; soft-fail UX — not 2h DoD fail |

---

## Student — detailed

| Case | Status | Evidence |
|------|--------|----------|
| Login + Algebra Foundations (2h) | **PASS** | `tmp/platform-2h-student.png`; listSpaces=1 |
| Identity + listSpaces API (2h) | **PASS** | probe2 |
| Earlier full journey (spaces fail / Loading / chat 404) | **SUPERSEDED for 2h bar** | `tmp/qa-student-journey-*` still useful for deep gaps (chat 404, notifications) but **not** the 2h verdict |
| listNotifications / getChildSummary | YELLOW | 500 / occasional 403 |

---

## Parent — detailed

| Case | Status | Evidence |
|------|--------|----------|
| Browser dashboard + child Aarav (2h) | **PASS** | `tmp/platform-2h-parent.png`, `tmp/platform-2h-parent-report.json` |
| Credentials | PASS | `suresh.patel@gmail.com` / GRN001 (see TEST_CREDENTIALS / PLATFORM-2H-STATUS) |
| Earlier probe FAIL / heal-only | **SUPERSEDED** | Older `tmp/platform-2h-callable-probe.json` parent FAIL is stale |
| Alt parent Rajesh | NOT browser-verified | Membership healed only |

---

## Admin — detailed

| Case | Status | Evidence |
|------|--------|----------|
| Login + dashboard + `/users` (2h) | **PASS** | Teachers 3 / Students 6 |
| listClasses / listStudents (2h) | **PASS** | 3 / 6 |
| Earlier getMe user-not-found | **SUPERSEDED** | Users docs + claims healed to `tn_greenwood_524e429639` |
| listNotifications | YELLOW | 500 non-blocking |

---

## Backend / platform-2h

| Check | Status | Evidence |
|-------|--------|----------|
| Teacher/Student/Admin/Parent identity + content | **PASS** | `tmp/platform-2h-callable-probe2.json` |
| `PLATFORM-2H-STATUS.md` checklist | **MET** | All six DoD GREEN |
| Notifications callable | YELLOW / FAIL feature | 500 |
| getChildSummary | YELLOW | Occasional 403 |
| sdk-v1 redeploy this window | Not attempted | Live revisions already serving identity/content |
| IAM ActAs | OPEN | Impersonation workaround still required for direct deploy |

---

## Counts (evidence aggregation)

| Suite | Result | Authentic note |
|-------|--------|----------------|
| **Platform 2H DoD** | **6/6 GREEN — MET** | Authoritative for tomorrow’s client pack |
| QA swarm teacher critical | 4 PASS / 0 FAIL | Still valid depth evidence |
| Teacher wave2 | 16 PASS / 2 FAIL | Rubric unstable |
| Student journey (older) | Mostly FAIL after override | **Superseded** for 2h login+space; keep for chat/notifications depth |
| Parent / Admin (2h browser) | PASS | Screenshots + reports in `tmp/platform-2h-*` |

---

## What remains after “demo-ready 2h”

1. Fix `listNotifications` 500.
2. Clear or soft-fail remaining analytics 403s.
3. PR #4 merged (or client clones fork tip knowingly).
4. Maintainer IAM ActAs for non-impersonated deploys.
5. Optional: re-verify student chat route and exam extract E2E before claiming those features.
