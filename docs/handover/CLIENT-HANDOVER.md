# LvlUp — Client Handover Pack

**Date:** 2026-07-13 (refreshed after authentic live QA)  
**Verdict:** **Live route QA: 55 PASS / 0 FAIL / 2 SKIP** across Teacher / Student / Admin / Parent on ports **4568–4571**.  
**Honesty rule:** No 100% / production-complete claims. Remaining yellow items (notifications 500, occasional analytics 403) are non-blocking.  
**Source of truth:** [`QA-LIVE-EVIDENCE.md`](./QA-LIVE-EVIDENCE.md) + [`tmp/QA-HANDOVER-AUTHENTIC.json`](../../tmp/QA-HANDOVER-AUTHENTIC.json) (screenshots: `tmp/qa-handover-*.png`).

---

## 1. Executive summary

LvlUp is a multi-app Firebase monorepo (teacher / student / parent / school admin / super-admin) backed by Cloud Functions (`sdk-v1` + legacy codebases) on project `lvlup-ff6fa` (`asia-south1`).

What you can show with confidence (Playwright-authenticated, screenshot-backed):

- **Teacher** Priya — 18 PASS / 0 FAIL / 2 SKIP (space edit + exam detail deep links skipped — no visible links).
- **Student** Aarav — 11 PASS / 0 FAIL including Algebra Foundations space viewer.
- **Admin** Greenwood — 16 PASS / 0 FAIL (dashboard, users, classes, exams, spaces, analytics, staff, …).
- **Parent** Suresh — 10 PASS / 0 FAIL (dashboard, children, progress, alerts, settings, …).
- Vite apps on `127.0.0.1`: admin **4568** · teacher **4569** · student **4570** · parent **4571**.
- P0 HMR fix: SessionContext singleton on **teacher** ([PR #25](https://github.com/subhangR/lvlup-monorepo/pull/25)) and **admin** ([PR #26](https://github.com/subhangR/lvlup-monorepo/pull/26); also in [PR #19](https://github.com/subhangR/lvlup-monorepo/pull/19)) — prevents `useAuthSession` crash after Vite HMR.
- P0 identity fix: `callSwitchActiveTenant` → `v1-identity-switchActiveTenant` with `{ targetTenantId }`.

What you should **not** promise as “done”:

- Polished production release (notifications still 500; analytics can 403 occasionally).
- Upstream `main` merge of all fork fixes (open PRs **#4–#25+**).
- Frictionless Firebase deploys (direct ActAs IAM still missing).
- Zero dual-tenant drift for GRN001 (prefer school-code lookup → canonical tenantId).

---

## 2. What works (evidence-backed)

| Area | Status | Notes |
|------|--------|-------|
| Teacher route sweep | **55/0/2 suite — Teacher 18P** | `tmp/qa-handover-teacher-*.png` + retests |
| Student route sweep | **11 PASS** | Dashboard, spaces, Algebra Foundations viewer |
| Admin route sweep | **16 PASS** | Users / classes / exams / spaces / analytics / staff |
| Parent route sweep | **10 PASS** | Child Aarav surfaces (progress, alerts, settings) |
| Live callables (prior 2h) | **GREEN** | getMe, switchActiveTenant, listSpaces/classes/students |
| Local Vite apps | **GREEN** | Ports 4568–4571 |
| SessionContext HMR (teacher+admin) | **Shipped on fork PRs** | #25 teacher; admin dedicated + #19 bundle |
| `callSwitchActiveTenant` | Shipped | `{ targetTenantId }` against `v1-identity-switchActiveTenant` |

Journey reference (product maps, not QA proof): `docs/journeys/`.

---

## 3. What does not work / is fragile (yellow, non-blocking)

| Area | Status | Evidence |
|------|--------|----------|
| `v1-identity-listNotifications` | **YELLOW** | **500 INTERNAL_ERROR** — does not block dashboards |
| `v1-analytics-getChildSummary` | **YELLOW** | Occasional **403**; student spaces path still works |
| Teacher deep links skipped | SKIP (2) | `/spaces/:id/edit`, `/exams/:id` — no link visible in list UI |
| Function redeploy / IAM | **YELLOW** | ActAs still missing for direct adminsdk deploy |
| Ghost GRN001 memberships | **YELLOW** | Prefer canonical `tn_greenwood_524e429639` |
| Student chat `/chat` (earlier) | Known gap | 404 in older journey pack — not in this suite |
| Exam extract E2E / Add Question | PARTIAL (prior) | Re-verify before claiming AI extract |

---

## 4. Credentials (no secrets copied here)

**Do not paste passwords into client-facing emails.**  
Use repo-root **[`TEST_CREDENTIALS.md`](../../TEST_CREDENTIALS.md)** for Greenwood demo accounts (school code `GRN001`).

Primary demo personas (all authentic-QA green):

- Teacher — Priya (`apps/teacher-web`, port **4569**)
- Student — Aarav (`apps/student-web`, port **4570**) — Algebra Foundations
- School admin — `admin@greenwood.edu` (`apps/admin-web`, port **4568**)
- Parent — Suresh (`apps/parent-web`, port **4571**) — child Aarav Patel
- Super admin — see `TEST_CREDENTIALS.md` (port **4567**)

---

## 5. How to run the apps (local demo)

Prerequisites: Node ≥ 20, `pnpm` ≥ 9, Firebase project access for live callables.

```bash
pnpm install
# From repo root — run the apps you need:
pnpm --filter @levelup/super-admin dev    # :4567
pnpm --filter @levelup/admin-web dev      # :4568
pnpm --filter @levelup/teacher-web dev    # :4569
pnpm --filter @levelup/student-web dev    # :4570
pnpm --filter @levelup/parent-web dev     # :4571
```

Bind to `127.0.0.1` as used in QA. Apps talk to deployed Functions on `asia-south1-lvlup-ff6fa.cloudfunctions.net` (not emulators unless you intentionally point env at emulators).

Product journeys: `docs/journeys/LVLUP-JOURNEY-GUIDE.md` (HTML/PDF companion in same folder).

Re-run authentic suite: `tests/e2e/qa-handover-authentic.spec.ts` (see config sibling).

---

## 6. Known blockers (communicate honestly)

### A. Maintainer PR merge

- Mega PR: **[#4](https://github.com/subhangR/lvlup-monorepo/pull/4)** — `tharakeshua:main` → `subhangR:main`
- Topic PRs: **#5–#26** — see [`GITHUB-PR-INDEX.md`](./GITHUB-PR-INDEX.md)
- Until merged, upstream `main` does **not** include fork CI/identity/QA fixes. Demos should use fork tip / known branches.

### B. sdk-v1 redeploy / IAM

- Direct deploy as Firebase Admin SDK SA still fails without **`iam.serviceAccounts.ActAs`** on `lvlup-ff6fa@appspot.gserviceaccount.com`.
- Working path: TokenCreator → impersonated ADC as appspot SA — not durable CI forever.

### C. Data / membership heals (demo only)

- Safe heals applied for Priya / Aarav / Admin / Suresh (passwords, memberships, claims). **No `tenantCodes` rewrite.**
- Canonical tenant: `tn_greenwood_524e429639` · code `GRN001`.

### D. Yellow non-blockers for demo day

- Expect notification bell / listNotifications may error (500).
- Expect occasional analytics 403; do not treat as demo-killer if dashboards and spaces load.

---

## 7. Recommended client demo script

1. **Teacher** login (GRN001 / Priya) → Dashboard → Spaces → open Algebra Foundations → Content.
2. **Student** login (Aarav) → Dashboard → Spaces → open **Algebra Foundations**.
3. **Admin** login → Dashboard → Users / Classes / Staff.
4. **Parent** login (Suresh) → Dashboard showing child Aarav Patel → Progress / Alerts.
5. Optionally show Teacher Exams → New Exam → upload step; stop before claiming extract AI unless re-verified live.
6. If notifications/analytics glitch, call them known yellow — dashboards still usable.

---

## 8. Pack contents

| File | Purpose |
|------|---------|
| [`CLIENT-HANDOVER.md`](./CLIENT-HANDOVER.md) | This executive brief |
| [`QA-AUTHENTIC-STATUS.md`](./QA-AUTHENTIC-STATUS.md) | PASS/FAIL/SKIP scorecard |
| [`QA-LIVE-EVIDENCE.md`](./QA-LIVE-EVIDENCE.md) | Per-route authentic results |
| [`GITHUB-PR-INDEX.md`](./GITHUB-PR-INDEX.md) | Open PRs fork → upstream (#4–#25+) |
| Machine report | `tmp/QA-HANDOVER-AUTHENTIC.json` |
| Screenshots | `tmp/qa-handover-*.png` (61 files) |
| Canvas | Cursor canvas `lvlup-client-handover.canvas.tsx` — open beside chat |

---

## 9. Bottom line for the client

This is a **real multi-role MVP** with live Firebase backends. Authentic Playwright QA is **55 PASS / 0 FAIL / 2 SKIP** across all four Greenwood demo roles. It is **not** a polished production release — notifications 500, occasional analytics 403, and open PR merges remain — but the demo pack should treat Teacher / Student / Admin / Parent as **green for live route coverage**.
