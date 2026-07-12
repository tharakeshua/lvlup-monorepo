# LvlUp — Client Handover Pack

**Date:** 2026-07-12 (refreshed after PLATFORM 2H DRIVER)  
**Verdict:** **2h platform readiness bar: MET.** Teacher Priya, Student Aarav (Algebra Foundations), Admin Greenwood, and Parent Suresh all **GREEN** on local ports **4568–4571**.  
**Honesty rule:** No 100% / production-complete claims. Remaining yellow items (notifications 500, occasional analytics 403) are non-blocking for the 2h bar. Source of truth: [`tmp/PLATFORM-2H-STATUS.md`](../../tmp/PLATFORM-2H-STATUS.md).

---

## 1. Executive summary

LvlUp is a multi-app Firebase monorepo (teacher / student / parent / school admin / super-admin) backed by Cloud Functions (`sdk-v1` + legacy codebases) on project `lvlup-ff6fa` (`asia-south1`).

What you can show tomorrow with confidence (DRIVER-verified):

- **Teacher** Priya — login + usable dashboard (`:4569`); `getMe` + `switchActiveTenant` + `listSpaces` OK.
- **Student** Aarav — login + **Algebra Foundations** learning path (`:4570`); `listSpaces` count=1.
- **Admin** Greenwood — dashboard + `/users` Teachers (3) / Students (6); `listClasses`=3, `listStudents`=6 (`:4568`).
- **Parent** Suresh — dashboard shows child **Aarav Patel** (`:4571`).
- Vite apps bound on `127.0.0.1`: admin 4568 · teacher 4569 · student 4570 · parent 4571.
- P0 client fix: `callSwitchActiveTenant` now calls `v1-identity-switchActiveTenant` with `{ targetTenantId }` (was legacy name + `{ tenantId }`).

What you should **not** promise as “done”:

- Polished production release (notifications still 500; analytics can 403 occasionally).
- Upstream `main` merge of fork fixes (PR #4 still open).
- Frictionless Firebase deploys (direct ActAs IAM still missing; prior deploy used appspot impersonation).
- Zero dual-tenant drift for GRN001 (legacy tenant ids may still exist; prefer lookup tenantId on login).

---

## 2. What works (evidence-backed)

| Area | Status | Notes |
|------|--------|-------|
| Teacher login + dashboard | **GREEN** | `tmp/platform-2h-teacher.png` — “Welcome back, Priya Sharma” |
| Student login + Algebra Foundations | **GREEN** | `tmp/platform-2h-student.png` + `/spaces`; `listSpaces`=1 |
| Admin login + users/classes | **GREEN** | Dashboard + `/users`; API `listClasses`=3, `listStudents`=6 |
| Parent login + linked child | **GREEN** | `tmp/platform-2h-parent.png` — Aarav Patel via claims `studentIds` |
| Identity + content callables | **GREEN** | Live `asia-south1`: getMe, switchActiveTenant, lookupTenantByCode, listClasses/listStudents, listSpaces — `tmp/platform-2h-callable-probe2.json` |
| Local Vite apps | **GREEN** | Ports 4568–4571 |
| Teacher deeper flows (prior swarm) | Works | Timed-test story point + exam wizard upload step — `tmp/qa-swarm-*` |
| `callSwitchActiveTenant` P0 fix | Shipped | `packages/shared-services` — `{ targetTenantId }` against `v1-identity-switchActiveTenant` |

Journey reference (product maps, not QA proof): `docs/journeys/`.

---

## 3. What does not work / is fragile (yellow, non-blocking for 2h)

| Area | Status | Evidence |
|------|--------|----------|
| `v1-identity-listNotifications` | **YELLOW** | **500 INTERNAL_ERROR** on admin/parent after login — does not block dashboards |
| `v1-analytics-getChildSummary` | **YELLOW** | Occasional **403**; student spaces path still works |
| Teacher dashboard widgets | **YELLOW** | Shell usable; some overview cards slow/empty |
| Transient `getMe` 401 | **YELLOW** | One unauthenticated probe before token settles; subsequent 200 |
| Function redeploy / IAM | **YELLOW** | No sdk-v1 redeploy this window; live callables already respond. ActAs still missing for direct adminsdk deploy |
| Ghost GRN001 memberships | **YELLOW** | Multiple legacy tenant ids with `tenantCode=GRN001`; heals write canonical `tn_greenwood_*` only — **no `tenantCodes` rewrite** |
| Student chat `/chat` (earlier journey) | Known gap | 404 in older student journey pack — not part of 2h DoD |
| Exam extract E2E / Add Question | PARTIAL (prior) | Re-verify before claiming AI extract |

---

## 4. Credentials (no secrets copied here)

**Do not paste passwords into client-facing emails.**  
Use repo-root **[`TEST_CREDENTIALS.md`](../../TEST_CREDENTIALS.md)** for Greenwood demo accounts (school code `GRN001`). Healed demo password documented in `tmp/PLATFORM-2H-STATUS.md` / `TEST_CREDENTIALS.md`.

Primary demo personas (all DRIVER-green for 2h bar):

- Teacher — Priya (`apps/teacher-web`, port **4569**)
- Student — Aarav (`apps/student-web`, port **4570**) — Algebra Foundations
- School admin — `admin@greenwood.edu` (`apps/admin-web`, port **4568**)
- Parent — Suresh (`apps/parent-web`, port **4571**) — child Aarav Patel
- Super admin — see `TEST_CREDENTIALS.md` (port **4567**)

Alt parent (membership healed, not browser-verified this pass): `rajesh.patel@gmail.com`.

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

---

## 6. Known blockers (communicate honestly)

### A. Maintainer PR merge

- Open PR into upstream: **[#4](https://github.com/subhangR/lvlup-monorepo/pull/4)** — `tharakeshua:main` → `subhangR:main`
- Title: *fix: W0 identity P0s + B-IDN-03 + CI unblock for main*
- Reviewer requested: `kushal10`
- Until merged, upstream `main` does **not** include fork CI/identity fixes. Local/fork tip may be ahead of what client clones from `subhangR`.

See [`GITHUB-PR-INDEX.md`](./GITHUB-PR-INDEX.md).

### B. sdk-v1 redeploy / IAM

- Prior redeploy succeeded via appspot impersonation (revision note: `v1-identity-listclasses-00007-jar`).
- This 2h window did **not** redeploy; live identity + levelup content already respond.
- Direct deploy as Firebase Admin SDK SA still fails without **`iam.serviceAccounts.ActAs`** on `lvlup-ff6fa@appspot.gserviceaccount.com`.
- Working path: TokenCreator → impersonated ADC as appspot SA — not durable CI forever.

### C. Data / membership heals (demo only)

- Safe heals applied for Priya / Aarav / Admin / Suresh / Rajesh (passwords, memberships, claims, users docs). **No `tenantCodes` rewrite.**
- Canonical tenant: `tn_greenwood_524e429639` · code `GRN001`.
- Prefer school-code lookup → canonical tenantId on login (P0 switch fix helps student/parent).

### D. Yellow non-blockers for demo day

- Expect notification bell / listNotifications may error (500).
- Expect occasional analytics 403; do not treat as demo-killer if dashboards and spaces load.

---

## 7. Recommended client demo script

1. **Teacher** login (GRN001 / Priya) → Dashboard → Spaces → open Algebra Foundations → Content.
2. **Student** login (Aarav) → Dashboard → Spaces → open **Algebra Foundations**.
3. **Admin** login → Dashboard → Users (teachers/students counts) / Classes.
4. **Parent** login (Suresh) → Dashboard showing child Aarav Patel.
5. Optionally show Teacher Exams → New Exam → upload step; stop before claiming extract AI unless re-verified live.
6. If notifications/analytics glitch, call them known yellow — dashboards still usable.

---

## 8. Pack contents

| File | Purpose |
|------|---------|
| [`CLIENT-HANDOVER.md`](./CLIENT-HANDOVER.md) | This executive brief |
| [`QA-AUTHENTIC-STATUS.md`](./QA-AUTHENTIC-STATUS.md) | PASS/FAIL/PARTIAL with evidence paths |
| [`GITHUB-PR-INDEX.md`](./GITHUB-PR-INDEX.md) | Open PRs fork → upstream |
| Status source | `tmp/PLATFORM-2H-STATUS.md` — 2h DoD checklist + verdict |
| Canvas | `canvases/lvlup-client-handover.canvas.tsx` — open beside chat in Cursor |

---

## 9. Bottom line for the client

This is a **real multi-role MVP** with live Firebase backends. The **2h readiness bar is MET**: all four Greenwood demo roles login and reach their core surfaces on ports 4568–4571, including student Algebra Foundations. It is **not** a polished production release — notifications 500, occasional analytics 403, PR merge, and IAM remain open — but tomorrow’s demo pack should treat Student/Admin/Parent as **green for the 2h bar**, not the earlier FAIL snapshot.
