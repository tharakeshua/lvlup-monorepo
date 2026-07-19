# LvlUp Complete Product Journey Guide

**Code-sampled · exhaustive role journeys · do not invent screens**

| | |
|--|--|
| **Workspace** | `startup-mvp/lvlup` |
| **Sources** | `apps/*/src/App.tsx`, layout nav, auth/session packages, `packages/ai`, `apps/website`, Firebase hosting, product-journey canvas |
| **Credentials** | [`TEST_CREDENTIALS.md`](../../TEST_CREDENTIALS.md) — never invent secrets beyond that file |
| **Companion files** | `01`–`06` markdown siblings in this folder · `LVLUP-JOURNEY-GUIDE.html` for Print→PDF |

---

## Table of contents

1. [Port & app inventory](#1-port--app-inventory)
2. [Cross-role journey (both product tracks)](#2-cross-role-journey)
3. [Auth, school code, getMe, claims](#3-auth-school-code-getme-claims)
4. [Student journey](#4-student-journey) → detail: [`01-student-journey.md`](./01-student-journey.md)
5. [Teacher journey](#5-teacher-journey) → [`02-teacher-journey.md`](./02-teacher-journey.md)
6. [Parent journey](#6-parent-journey) → [`03-parent-journey.md`](./03-parent-journey.md)
7. [Admin journey](#7-admin-journey) → [`04-admin-journey.md`](./04-admin-journey.md)
8. [Super-admin journey](#8-super-admin-journey)
9. [Marketing website](#9-marketing-website)
10. [AI surfaces & secret/env names](#10-ai-surfaces--secretenv-names)
11. [Access Denied / 403 patterns](#11-access-denied--403-patterns)
12. [Firebase cost & why Firebase](#12-firebase-cost--why-firebase)
13. [Railway + Vercel](#13-railway--vercel)
14. [Not present (explicit)](#14-not-present-explicit)
15. [Demo credentials pointer](#15-demo-credentials-pointer)

---

## 1. Port & app inventory

| App | Path | Dev port | Auth entry | Hosting target |
|-----|------|----------|------------|----------------|
| Super-admin | `apps/super-admin` | **4567** | Email + password + `superAdmin` claim | `super-admin` |
| Admin | `apps/admin-web` | **4568** | School code UX + email/password | `admin-web` |
| Teacher | `apps/teacher-web` | **4569** | School code + email/password | `teacher-web` |
| Student | `apps/student-web` | **4570** | School code + roll/email **or** B2C Google/email | `student-web` |
| Parent | `apps/parent-web` | **4571** | School code + email/password | `parent-web` |
| Website | `apps/website` | **4321** (Astro default) | None (static) | `website` |

Local CORS allowlist also references `4567–4571`. Preview/Lighthouse configs may remap ports; **Vite defaults above are SSOT for local journey testing.**

---

## 2. Cross-role journey

### Autograde (paper)

Admin onboards school → imports users → Teacher creates exam + QP → `extractQuestions` → uploads answer sheets → AI map/grade → teacher review → `releaseResults` → Student exam results + Parent results/PDF → Admin analytics / AI usage.

### LevelUp (digital)

Admin provisions → Teacher authors spaces/items → Student practices/tests/tutor chat → Parent progress/alerts → Admin spaces/courses oversight.

**In-app links between role portals:** not present. Marketing `APP_URLS` is the only cross-role linker.

Full AI + connection detail: [`05-cross-role-and-ai.md`](./05-cross-role-and-ai.md).

---

## 3. Auth, school code, getMe, claims

### School code

- Public: `v1.identity.lookupTenantByCode` (+ legacy tenantCodes fallback)
- Student/teacher/parent: code required for B2B login
- Admin: code validated in UI; **not** passed into Auth `login()`
- Super-admin: **no** school code

### `loginWithSchoolCode` (shared-stores)

1. Lookup tenant (uppercase normalize)  
2. Access gate (`active` / valid trial)  
3. Email or derived roll email `{roll}@{tenantId}.levelup.internal`  
4. Firebase sign-in → active membership  
5. `callSwitchActiveTenant` → `getIdToken(true)`

### `getMe` / session stacks

| Apps | Mechanism |
|------|-----------|
| teacher-web, admin-web | `useMe()` → `v1.identity.getMe` via Session / identity SDK |
| student-web, parent-web, super-admin | `useAuthStore` Firestore hydration (+ claims) |

Response shape: `{ user, memberships, claims, activeTenant? }`.

### `switchActiveTenant`

Rebuilds JWT claims server-side; admin path resets React Query cache.

### Claims fields

`role`, `tenantId`, `tenantCode`, role entity ids (`teacherId`, `studentId`, …), `classIds` (+ overflow), `studentIds` (parent), permission maps, `isSuperAdmin?`.

Roles: `superAdmin` · `tenantAdmin` · `teacher` · `student` · `parent` · `scanner` · `staff`.

Production collections often `v2_*` via `LVLUP_COLLECTION_PREFIX`.

---

## 4. Student journey

**URL:** http://127.0.0.1:4570 · roles: `student` | B2C consumer shell

### Login

B2B: school code → roll **or** email + password → `loginWithSchoolCode`.  
B2C: “Sign in as learner” → email/password or Google → `/consumer`.

### B2B sidebar

Dashboard `/` · My Spaces `/spaces` · Tests `/tests` · Progress `/results` · Leaderboard `/leaderboard` · Profile `/profile` · Settings `/settings`  
(+ Notifications `/notifications` via bell; exam results `/exams/:examId/results`; nested space/story/test/practice routes)

### B2C sidebar

My Learning `/consumer` · Store `/store` · Cart `/store/checkout` · Profile `/profile`

### Key callables

`evaluateAnswer` · `recordItemAttempt` · `sendChatMessage` · `startTestSession` · `submitTestSession` · `purchaseSpace` · `listStoreSpaces`

### AI

Tutor chat (flash) + practice evaluate. No paper-exam Gemini on student.

### Orphan

`StudyPlannerPage.tsx` **exists but is not routed**.

→ Full tree: [`01-student-journey.md`](./01-student-journey.md)

---

## 5. Teacher journey

**URL:** http://127.0.0.1:4569 · roles: `teacher`, `tenantAdmin` · session via `getMe`

### Sidebar groups

- Overview: `/`
- Content: `/spaces` · `/question-bank` · `/exams` · `/rubric-presets` · `/assignments` · `/grading`
- Analytics: `/analytics/classes` · `/analytics/exams` · `/analytics/spaces` (+ routed `/analytics/tests` **not in sidebar**)
- People: `/classes` · `/students`
- System: `/settings` (+ `/notifications` bell)

### Nested routes

Space edit/preview · Exam create/detail/submissions/grading review · Class detail · Student report

### Key callables

Spaces: `saveSpace` · `saveStoryPoint` · `saveItem` · `importFromBank` · `generateContent`  
Bank/rubrics: `saveQuestionBankItem` · `saveRubricPreset`  
Autograde: `saveExam` · `extractQuestions` · `uploadAnswerSheets` · `gradeQuestion` · `releaseResults`  
Analytics: `getSummary` · `generateReport`

### AI

Heaviest: vision extract (pro) → mapping (flash) → grading (pro) → teacher release. Insights are rule-based.

→ [`02-teacher-journey.md`](./02-teacher-journey.md)

---

## 6. Parent journey

**URL:** http://localhost:4571 · role: `parent`

### Sidebar

`/` · `/children` · `/results` · `/progress` · `/child-progress` · `/alerts` · `/compare` · `/notifications` · `/settings`

### Key APIs

`generateReport` (PDF) · linked-children / child-summary hooks · insights/alerts (**no LLM**) · notification manage · `switchActiveTenant`

Parents never author content or run autograde AI.

→ [`03-parent-journey.md`](./03-parent-journey.md)

---

## 7. Admin journey

**URL:** http://localhost:4568 · role: `tenantAdmin` · OnboardingGuard → `/onboarding` if incomplete

### Sidebar

- Management: `/users` · `/classes` · `/exams` · `/spaces` · `/courses` · `/staff` · `/announcements`
- Analytics: `/analytics` · `/reports` · `/ai-usage`
- Config: `/academic-sessions` · `/data-export` · `/settings`
- Also routed: `/notifications`, `/onboarding`, `/classes/:classId`

### Key callables

`saveTenant` · `saveAcademicSession` · `saveClass` · `createOrgUser` · bulk imports · `saveStudent`/`Teacher`/`Parent` · `bulkUpdateStatus` · `saveAnnouncement` · `rolloverSession` · `exportTenantData` · `generateReport` · Gemini key write-only on tenant save

Stricter guard: membership `tenantId` must match active tenant.

→ [`04-admin-journey.md`](./04-admin-journey.md)

---

## 8. Super-admin journey

**URL:** http://localhost:4567 · email-only login · requires `isSuperAdmin` + claim `role === "superAdmin"`

| Nav | Path |
|-----|------|
| Dashboard | `/` |
| Tenants | `/tenants`, `/tenants/:tenantId` |
| User Analytics | `/analytics` |
| Feature Flags | `/feature-flags` |
| Global Presets | `/presets` |
| LLM Usage | `/llm-usage` |
| Announcements | `/announcements` |
| Users | `/users` |
| System Health | `/system` |
| Settings | `/settings` |

Callables: `saveTenant` · deactivate/reactivate · `saveGlobalPreset` · `searchUsers` · announcements · platform settings.  
**Not on marketing APP_URLS.**

---

## 9. Marketing website

Routes: `/` · `/guides` · `/guides/{admin|teacher|student|parent}`  
Portal defaults: `admin|teacher|student|parent.lvlup.academy` via `PUBLIC_*_URL`.  
Pricing page, blog, demo funnel: **not present**.

→ [`06-marketing-infra-firebase-vercel-railway.md`](./06-marketing-infra-firebase-vercel-railway.md)

---

## 10. AI surfaces & secret/env names

| Name | Purpose |
|------|---------|
| `LEVELUP_AI_KEY` / `GEMINI_API_KEY` | Dev override |
| `LEVELUP_AI_MODEL_PRO` / `LEVELUP_AI_MODEL_FLASH` | Model ids |
| `LEVELUP_AI_STUB` | Stub provider |
| `tenant-{tenantId}-gemini` | Secret Manager per-tenant key |
| `geminiApiKey` (write-only on saveTenant) | Onboarding stores secret |
| `settings.geminiKeyRef` / `geminiKeySet` | Pointers only |
| `VITE_FIREBASE_*` | Client Firebase — **no AI keys** |
| `GOOGLE_CLOUD_PROJECT` / `GCLOUD_PROJECT` | SM project |
| `GOOGLE_APPLICATION_CREDENTIALS` | SA for SM |
| `LVLUP_COLLECTION_PREFIX` | `v2_` collections |

AI callables: `extractQuestions` · `uploadAnswerSheets` · `gradeQuestion` · `sendChatMessage` · `evaluateAnswer` · `generateContent`.  
Analytics insights: **no LLM**.

---

## 11. Access Denied / 403 patterns

| App | Behavior |
|-----|----------|
| Unauthenticated | Redirect `/login` |
| student wrong role, no membership | → `/consumer` |
| wrong role (most apps) | Inline Access Denied |
| admin tenant mismatch | Access Denied |
| super-admin missing claim | Access Denied + Sign Out |
| Server cross-tenant | e.g. “Cross-tenant access denied.” |

---

## 12. Firebase cost & why Firebase

Cost drivers: Functions (5 codebases) · Firestore · RTDB · Storage · Auth · Hosting · **Gemini tokens** · Cloud Tasks.  
No Blaze invoice in repo — inference only.  
Firebase-coupled: custom claims, rules on `auth.token.*`, `v2_` deny-all, Storage/Firestore triggers, callables, RTDB, 6 Hosting sites.

---

## 13. Railway + Vercel

| Tier | Scope | Effort |
|------|-------|--------|
| S | Vercel frontends, Firebase backend | ~3–10 eng-days |
| M | Railway HTTP + workers, keep Auth/Firestore | ~1–3 months |
| L | Leave Auth/Firestore | multi-quarter |

Phase 0→3 plan and difficulty matrix: [`06-marketing-infra-firebase-vercel-railway.md`](./06-marketing-infra-firebase-vercel-railway.md).

---

## 14. Not present (explicit)

- Pricing / plans marketing page  
- Super-admin on marketing `APP_URLS`  
- Student `StudyPlannerPage` route  
- Dedicated scanner/staff web apps (claims exist; no Vite app journeys here)  
- In-app “open teacher portal” links between SPAs  
- OpenAI/Anthropic production providers  
- Parent/student Gemini autograde initiation  

---

## 15. Demo credentials pointer

See **[`TEST_CREDENTIALS.md`](../../TEST_CREDENTIALS.md)**:

- Greenwood `GRN001` / default `Test@12345` (admin, teachers, students, parents, superadmin)  
- Roll login example `2025001`  
- Consumer `consumer@gmail.test` / `Consumer123!`  
- Subhang `SUB001`  
- Emulator Springfield `SPR001` with distinct passwords  

Seed: `pnpm seed:production` · emulator `pnpm seed:emulator`.

---

## How to download / Print to PDF

1. Download or zip folder: `docs/journeys/`  
2. Open `LVLUP-JOURNEY-GUIDE.html` in Chrome/Edge  
3. **Ctrl+P** → **Save as PDF** (enable background graphics)  
4. Or print individual `0N-*.md` via VS Code / GitHub / Pandoc if preferred  

---

*Generated from live routers and packages in the lvlup monorepo. If a screen is not listed, treat it as not present unless you find a matching `App.tsx` route.*
