# LvlUp Deep QA — 2-Hour Platform Readiness

**Date:** 2026-07-12  
**Framing:** Can the platform demo all primary roles within ~2 hours without a destructive reseed?  
**Interactive canvas:** open [`lvlup-deep-qa-2h.canvas.tsx`](file:///C:/Users/tharakeswara.reddy/.cursor/projects/c-Users-tharakeswara-reddy-Downloads-AI-Brain-Startup-startup-mvp-lvlup/canvases/lvlup-deep-qa-2h.canvas.tsx) beside chat in Cursor  
**Sources:** `tmp/qa-*` live probes, `docs/journeys/*`, `packages/api-contract`, web + Expo apps. Dirty trees left untouched.

---

## Verdict

**Overall readiness: 48 / 100 — not ready for a clean all-role 2-hour demo.**

The callable contract is broad and typed (~140 ops). Teacher web smoke largely works. **Student login is blocked** by v2 vs unprefixed membership path drift. Parent/Autograde E2E cannot close with **zero exams** in Greenwood stats. Fix auth/data seams and one released exam — **do not full-reseed**.

---

## Per-role health scorecards

| Role | Score | Probe status | Top risk |
|------|------:|--------------|----------|
| Teacher | 72 | PARTIAL+ | Analytics 403 noise for unassigned classes |
| Admin (school) | 68 | Code-strong / limited live FAIL | God-mode polish gaps |
| Super-admin | 62 | UI ahead of some callables | Audit/health/billing mismatches |
| Parent | 48 | Memberships exist; no browser PASS JSON | Empty results (0 exams) |
| Student | 32 | **Login FAIL** | Dual-path membership + permissions |
| Cross-role E2E | 28 | Pipelines documented only | Student gate + no portal deep links |
| Mobile native | 42 | Expo shells | Partial callables; no `mobile-parent` |

### Student (32)

- **Probe:** `tmp/qa-student-journey-report.json` — FAIL on `http://127.0.0.1:4570/login` with “Missing or insufficient permissions.”
- **Root cause (heal notes):** `GRN001` → `tn_greenwood_524e429639`, but client login reads bare `userMemberships/{uid}_{tenantId}`. Missing doc → Firestore rules deny instead of clean miss. Claims had pointed at legacy tenant `UVrLA2eNZXwzu1GzyXpF`.
- **After safe heal:** `getMe` OK (`tmp/qa-aarav-getme-after-heal.json`); dual memberships remain (legacy + v2). Switch probe with `{ tenantId }` → validation error expecting **`targetTenantId`**.
- **Code bug:** `packages/shared-services/src/auth/auth-callables.ts` `callSwitchActiveTenant` sends `{ tenantId }` to legacy name `switchActiveTenant`; contract is `v1.identity.switchActiveTenant` + `{ targetTenantId }`.

### Teacher (72)

- **PASS:** Login, dashboard, Algebra Foundations space editor, Timed Test via `v1-levelup-saveStoryPoint` → 200 (`tmp/qa-swarm-report.json`).
- **PARTIAL:** Exam wizard reaches upload step; early draft may not persist callables yet; “Add Question” not always visible.
- **Expected 403s:** `getSummary` for classes outside Priya’s `managedClassIds` (G8-sci, G10-phy) — correct authz, noisy UI (`tmp/qa-teacher-full-final-report.json`, `tmp/qa-priya-getme-after-heal.json`).
- Transient `getMe` 401 before token ready observed.

### Parent (48)

- Parent Auth + `v2_userMemberships` with `parentLinkedStudentIds` present (`tmp/qa-aarav-deep.json`).
- No consolidated browser PASS/FAIL in `tmp/`.
- Journey needs released submissions + progress — Greenwood `stats.totalExams: 0` after heal → `/results` empty by **data**, not missing routes (`docs/journeys/03-parent-journey.md`).

### Admin / Super-admin (68 / 62)

- School admin (`:4568`): onboarding, users/bulk import, classes, staff, sessions/rollover, exams/spaces oversight, announcements, analytics, reports, AI usage, export, settings. Guard: `membership.tenantId === activeTenantId`.
- Super-admin (`:4567`): tenants lifecycle, flags, presets, user search, LLM usage, system health UI. Documented UI/API gaps (audit list, health snapshot, full billing, impersonation UI missing).

### Cross-role (28)

- Autograde + LevelUp actor maps documented (`docs/journeys/05-cross-role-and-ai.md`).
- **No in-app deep links** between portals (marketing `APP_URLS` only).
- Student login failure + zero exams break the shared demo narrative inside two hours.

---

## Data gaps (Firestore / Auth prerequisites)

**Spine:** Firebase Auth → `users/{uid}` → `userMemberships/{uid}_{tenantId}` → JWT claims → callables (tenant from claims; **no `tenantId` in request bodies**). Production often uses `LVLUP_COLLECTION_PREFIX=v2_`.

| Role | Must exist | Without it |
|------|------------|------------|
| All school | `tenantCodes/{CODE}`, active tenant, user + membership, matching claims | Login / Access Denied |
| Student | `studentId`, `classIds`, student + class roster docs | Login fail or empty learning |
| Teacher | `teacherId`, `permissions.managedClassIds`, teacher + class links | Empty classes / 403 analytics |
| Parent | `parentId`, linked student ids on membership/claims | Empty children / results |
| Admin | `tenantAdmin`, onboarding flag, tenant match | Forced onboarding / deny |
| Super-admin | `isSuperAdmin` **and** claim `superAdmin` | Access Denied |
| Autograde loop | Exam → grade → `releaseResults` | Student/parent results empty |
| LevelUp loop | Space → story points → items → class assignment | Student dashboard empty |

**Observed Greenwood drift:** dual `users` / `v2_users`; dual memberships; top-level collection scans empty while nested tenant data exists; student membership reused teacher-shaped `managedClassIds`; duplicate class ID variants in nest probes.

---

## Backend API surface (web + future iOS/Android)

| Domain | ~Count | Demo-critical |
|--------|-------:|---------------|
| identity | 60 | `getMe`, `switchActiveTenant`, `lookupTenantByCode`, org CRUD, bulk import, announcements, `start/endImpersonation`, device tokens |
| levelup | 49 | spaces/story points/items, practice/evaluate, chat, test sessions, store/gamification |
| autograde | 18 | `saveExam`, `extractQuestions`, upload sheets, `gradeQuestion`, `releaseResults` |
| analytics | 13 | `getSummary`, child/parent summaries & alerts, `generateReport`, cost |
| **Realtime** | 9 | chat, progress, leaderboard, grading status, notification badge |

**Auth:** default `authed`; only public callable is `lookupTenantByCode`.  
**Transport:** production `@levelup/transport-firebase`. `@levelup/transport-http` path grammar frozen; `invokeViaHttp` throws (future). No live OpenAPI.  
**Mobile clients:** Expo apps share `api-contract` + `api-client` + `domain` + `query` + Firebase transport — same Zod contracts as web.

---

## Top blockers for “platform works in 2 hours”

| P | Blocker | Safe fix |
|---|---------|----------|
| P0 | Student bare vs `v2_` membership path | Mirror membership/user/tenant from v2 SSOT; sync claims |
| P0 | `callSwitchActiveTenant` sends `tenantId` not `targetTenantId` | Fix shared-services (+ v1 callable name) |
| P0 | Legacy membership still on student | Archive/disable; set `activeTenantId` |
| P1 | Teacher UI calls unassigned class analytics | Filter to `managedClassIds` or expand assignment |
| P1 | Missing CG index `spaces.title` | Deploy index (`tmp/qa-spaces-where.json`) |
| P1 | `totalExams = 0` | One minimal released exam — not full seed |
| P2 | Duplicate class IDs / nest drift | Prefer canonical IDs; heal links only |
| P2 | Super-admin UI ahead of API | Hide fields or ship callables |

---

## Admin “god mode” — exists vs missing

### Exists

- **School admin:** full provisioning hub (users, classes, sessions, announcements, oversight, export, AI cost, Gemini key write-only to Secret Manager).
- **Super-admin:** tenant create/lifecycle, feature flags, presets, global user search, platform announcements, LLM usage / system health **pages**.

### Missing / incomplete

| Capability | Contract | UI |
|------------|----------|-----|
| Impersonation | `startImpersonation` / `endImpersonation` | **None** |
| Full billing | flat `plan` | Card / matrix stub only |
| In-app seed | CLI `packages/seed` | **None** (keep CLI-only) |
| Audit log list | gap | Card present |
| System health snapshot | gap | Page present |
| Cross-portal deep links | N/A | Absent |
| scanner/staff SPA | roles in domain | No dedicated app |

For a 2-hour demo, prefer **school-admin provisioning + teacher content** over super-admin polish.

---

## Mobile readiness

| Surface | Status | 2h demo |
|---------|--------|---------|
| All 5 web apps | Responsive + `MobileBottomNav` + PWA manifests | Yes (student after heal) |
| `mobile-student` | Expo 52 shell | Smoke only |
| `mobile-teacher` | Callables partially live | Avoid |
| `mobile-admin` | Screen matrix; billing stub | Avoid |
| `mobile-parent` | **Absent** | Use parent-web |
| Capacitor | Not present | N/A |

---

## Safe heals only (no destructive seed)

**Do not:** full tenant wipe/reseed, mass Auth deletes, rewrite `tenantCodes`, force-push dirty trees.

| Heal | Proven? | Risk |
|------|---------|------|
| Mirror `v2_userMemberships` → `userMemberships` | Yes (`tmp/qa-aarav-heal.mjs`, Priya heals) | Low (merge) |
| Mirror `v2_users` → `users` + thin `tenants/{id}` | Yes | Low |
| `setCustomUserClaims` to active v2 tenant | Yes | Medium (token refresh) |
| Reset known QA passwords | Yes | Low non-prod |
| Align teacher `managedClassIds` | Partial | Low |
| Deploy `spaces.title` CG index | Console link in probe | Low |
| Code fix: `targetTenantId` + v1 callable | Bug confirmed | Code change + login retest |
| Archive legacy membership `UVrLA2e…` | Observed | Medium |

**Recipe:** abort if v2 membership missing → merge-mirror bare paths → stamp claims → client re-login / `getIdToken(true)`.

Reference (evidence only, not production ops): `tmp/qa-aarav-heal.mjs`, `tmp/qa-priya-heal-v2.mjs`.

---

## Suggested 2-hour triage order

1. Mirror membership + claims for demo students (unblock portal).
2. Fix `switchActiveTenant` payload/name in shared-services path.
3. Filter or align teacher class analytics scope.
4. Deploy spaces collection-group index.
5. Create/release **one** minimal demo exam (targeted write or teacher flow — not full seed).

---

## Evidence index

| Artifact | Role |
|----------|------|
| `tmp/qa-student-journey-report.json` | Student login FAIL |
| `tmp/qa-aarav-heal-report.json` / `qa-aarav-getme-after-heal.json` | Student heal + getMe |
| `tmp/qa-swarm-report.json` | Teacher space + timed test PASS |
| `tmp/qa-teacher-full-final-report.json` | Teacher callables / 403s |
| `tmp/qa-priya-getme-after-heal.json` | Teacher scope after heal |
| `tmp/qa-spaces-where.json` | Missing Firestore index |
| `tmp/qa-aarav-deep.json` | Dual path / parent membership |
| `docs/journeys/01–06-*.md` | Route + callable journey maps |
| `packages/api-contract/src` | Callable SSOT |
