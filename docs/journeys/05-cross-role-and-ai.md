# 05 — Cross-Role Connections & AI Surfaces

## Two product tracks

### Autograde (paper exams)

```
Super-admin creates tenant
    → Admin onboards school / session / class / users
    → Teacher creates exam + uploads question paper
    → extractQuestions (vision)
    → Teacher uploads answer sheets (uploadAnswerSheets)
    → mapping + grading pipelines
    → Teacher reviews (gradeQuestion / manual)
    → releaseResults
    → Student /exams/:id/results + Parent /results (+ PDF)
    → Admin oversight (exams, analytics, AI usage)
```

### LevelUp (digital learning)

```
Admin provisions users & classes
    → Teacher authors spaces / story points / items / question bank
    → Student practices, timed tests, tutor chat
    → Parent space/child progress + alerts
    → Admin spaces/courses + analytics
```

**In-app cross-role deep links between portals:** **not present**. Role handoff is via marketing site `APP_URLS` only.

---

## End-to-end actor map

| Step | Actor | App | Key action |
|------|-------|-----|------------|
| 1 | Super-admin | `:4567` | Create / configure tenant |
| 2 | Admin | `:4568` | Onboarding, import users, classes, sessions |
| 3a | Teacher | `:4569` | Author spaces |
| 3b | Teacher | `:4569` | Create exams, extract, grade, release |
| 4 | Student | `:4570` | Learn + take tests + see released results |
| 5 | Parent | `:4571` | View results / progress / alerts / PDF |
| 6 | Admin | `:4568` | Analytics, reports, AI usage |

Roles in domain SSOT: `superAdmin` · `tenantAdmin` · `teacher` · `student` · `parent` · `scanner` · `staff`  
**scanner / staff web apps:** dedicated full SPA journeys **not present** as separate Vite apps in this pack (claims/entities exist; no `apps/scanner-web`).

---

## Auth / session (cross-cutting)

### School code

- Public callable: **`v1.identity.lookupTenantByCode`** (+ legacy `/tenantCodes/{code}` fallback)
- Used on student, teacher, parent, admin login UIs
- Admin: validates code for UX but signs in with email/password only
- Super-admin: no school code

### `getMe`

- Contract: `v1.identity.getMe` → `{ user, memberships, claims, activeTenant? }`
- Teacher/admin: `useMe()` via SessionProvider / identity SDK
- Student/parent/super-admin: often hydrate via `useAuthStore` + Firestore snapshots

### `switchActiveTenant`

- Callable: **`v1.identity.switchActiveTenant`**
- Rebuilds JWT custom claims; client `getIdToken(true)`
- Admin SDK path clears entire React Query cache on switch

### JWT `PlatformClaims` (from `packages/domain`)

| Field | Notes |
|-------|-------|
| `role` | Active tenant role |
| `tenantId` / `tenantCode` | Active school |
| `teacherId` / `studentId` / `parentId` / `staffId` / `scannerId` | Role entity ids |
| `classIds` | Max 15 in claim; `classIdsOverflow` if more |
| `studentIds` | Parent linked children |
| `permissions` / `staffPermissions` | Granular maps |
| `isSuperAdmin` | Platform flag |

Collections: production often uses `LVLUP_COLLECTION_PREFIX` → **`v2_*`** deny-all client rules → Admin SDK callables.

Demo school codes (documented): **`GRN001`**, **`SUB001`**, emulator **`SPR001`** — see [`TEST_CREDENTIALS.md`](../../TEST_CREDENTIALS.md).

---

## AI surfaces

### Provider reality

- Production: **Gemini only** via `@levelup/ai` → `createGeminiProvider` → `generateContent`
- OpenAI/Anthropic: not production paths (test/future only)
- Clients **never** receive API keys (lint boundaries)

### AI-rated / AI-related callables

| Feature | Callable / service | Prompt / tier | Surface |
|---------|-------------------|---------------|---------|
| Extract questions (vision) | `v1.autograde.extractQuestions` | questionExtraction · **pro** | Teacher ExamDetail |
| Upload sheets (pipeline kickoff) | `v1.autograde.uploadAnswerSheets` | ai pipeline | Teacher Submissions |
| Answer mapping | `process-answer-mapping` | answerMapping · **flash** | After upload |
| RELMS grading | pipeline + `v1.autograde.gradeQuestion` | answerGrading · **pro** | GradingReview / Batch |
| Tutor chat | `v1.levelup.sendChatMessage` | aiChat · **flash** | Student StoryPointViewer |
| Practice evaluate | `v1.levelup.evaluateAnswer` | grading path | Student practice |
| Generate content drafts | `v1.levelup.generateContent` | CONTENT_DRAFT_PROMPT | Teacher content tools |
| Insights / at-risk | `generateInsights` scheduler · `getSummary` | **rules — no LLM** | Teacher/Parent/Admin analytics |

Gateway also: moderation, quota, circuit-breaker, cost logging (`packages/ai/src/gateway.ts`).  
Dual stack: legacy `functions/*/LLMWrapper` still exists beside `sdk-v1` `createAiGateway()`.

### Exact env / secret names (from code)

| Name | Where | Purpose |
|------|-------|---------|
| `LEVELUP_AI_KEY` | `packages/ai` secrets | Dev/emulator override (skip Secret Manager) |
| `GEMINI_API_KEY` | `packages/ai` + legacy shared-services | Same override |
| `LEVELUP_AI_MODEL_PRO` | `packages/ai/models.ts` | Default pro model id (`gemini-2.5-pro`) |
| `LEVELUP_AI_MODEL_FLASH` | `packages/ai/models.ts` | Default flash model id (`gemini-2.5-flash`) |
| `LEVELUP_AI_STUB` | `functions/sdk-v1/bootstrap.ts` | Force stub provider |
| `tenant-{tenantId}-gemini` | GCP Secret Manager (`secretNameFor`) | Per-tenant API key |
| `settings.geminiKeyRef` / `geminiKeySet` | tenant doc | Pointer only — never stores key value |
| `geminiApiKey` | `saveTenant` request (write-only) | Onboarding writes secret |
| `VITE_FIREBASE_*` | `apps/*-web/.env.*` | Client Firebase config only |
| `LVLUP_COLLECTION_PREFIX` | functions / firestore.rules | `v2_` production collections |
| `GOOGLE_CLOUD_PROJECT` / `GCLOUD_PROJECT` | packages/ai, functions | Secret Manager project |
| `GOOGLE_APPLICATION_CREDENTIALS` | functions bootstrap | GCP SA for Secret Manager |

---

## Access Denied / 403 patterns (summary)

| App | Trigger | UI |
|-----|---------|-----|
| All (except nuances below) | No Firebase user | Redirect `/login` |
| student-web | Wrong role, no membership | Redirect `/consumer` |
| student / teacher / parent / admin | Wrong role | Inline Access Denied |
| admin-web | Membership tenant ≠ active tenant | Access Denied |
| super-admin | Missing superAdmin claim/user flag | Access Denied + Sign Out |
| shared-ui | `ErrorState` preset `forbidden` | “Access denied” (available; sparse page usage) |
| Server | e.g. autograde cross-tenant | `'Cross-tenant access denied.'` |

---

## Shared package spine

| Package | Role |
|---------|------|
| `packages/api-contract` | SSOT for v1.* callable names |
| `packages/services` | Business logic for sdk-v1 |
| `packages/ai` | Gemini gateway, prompts, secrets, cost |
| `packages/query` + repositories | UI hooks → repos |
| `packages/shared-stores` | Session used by student/parent/super-admin |
| `functions/sdk-v1` | Additive canonical callables |
| `functions/{identity,autograde,levelup,analytics}` | Domain function codebases |
