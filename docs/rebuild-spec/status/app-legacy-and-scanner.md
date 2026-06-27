# Status Report: Legacy LevelUp-App + Planned Scanner-App

**Scope:** (1) The legacy standalone `LevelUp-App/` — what it is, its
architecture, and the concepts it pioneered that the new monorepo inherited or
still needs; (2) the planned `scanner-app`
(`requirements/scanner-app/requirements.md`) — its intended role (exam
answer-sheet capture & upload into the AutoGrade pipeline), how it overlaps with
what already exists, and what should carry forward.

Repo root: `/Users/subhang/Desktop/Projects/auto-levleup`

---

## PART A — Legacy `LevelUp-App/`

### A.1 What it is

`LevelUp-App/` is the **original, single-app monolith** that pioneered the
entire "LevelUp" learning experience (gamified, story-point-based courses with
rich question types and timed tests). It is a Vite + React 18 + TypeScript SPA
that predates the monorepo split. Everything the new `apps/student-web` /
`apps/teacher-web` + `packages/shared-types/src/levelup/*` now do was first
prototyped here.

It is **not** a monorepo internally — `src/apps/` does not exist. It is one app
with a `src/` tree organized by layer + feature. The earlier assignment guess of
a "src/apps structure" is incorrect; the real structure is documented below.

Key meta:

- Stack (per `LevelUp-App/docs/CORE_ARCHITECTURE.md` and `package.json`): React
  18, React Router v6, **Redux Toolkit** (state), **Firebase Firestore +
  Realtime Database (RTDB)** (hybrid persistence), shadcn/ui + Tailwind, React
  Hook Form + Zod, TanStack Query.
- Routes defined in `LevelUp-App/src/App.tsx`.
- Domain model in `LevelUp-App/src/domain/models.ts`.

### A.2 Architecture (layered + feature modules)

From `LevelUp-App/docs/CORE_ARCHITECTURE.md`, the layers are: Pages/Routes →
Features → Components → **Services (class-based singletons)** → Redux state →
Firebase (Firestore + RTDB).

Source tree (`LevelUp-App/src/`):

- `domain/` — `models.ts` (core domain: `Space`, `StoryPoint`, enums for
  `SpaceDifficulty`, `DimensionLevel` Silver/Gold/Platinum/Diamond,
  `ScopeType`), `view.ts`.
- `features/` — feature modules: `questions/` (the big one —
  chat/dialogs/overlays/ page components, hooks
  `useQuestionState`/`useQuestionSubmission`/
  `useQuestionTracking`/`useQuestionNavigation`, utils `answerValidation`,
  `questionEvaluator`, `scoringHelpers`, `feedbackSounds`), `story-point/`,
  `timed-test/`, `mock-test/`.
- `services/` — **class-based singleton services**, one per concern (see A.4).
- `pages/` — route pages: `Home`, `Course`, `StoryPoint`, `StoryPointDashboard`,
  `PracticeRange`, `PracticeRangeItem`, `TimedTest*` (detail/question/practice/
  results), `OrgsPage`, `OrgAdminPage`, `SuperAdminPage`, `Settings`, `Store`,
  `Scan`, plus `course-admin/` (AdminDashboard, ItemDashboard).
- `store/` — Redux store + `slices/coursesSlice.ts` (only one slice — most state
  lives in services + React Query).
- `types/` — `items.ts` (the flexible item model), `timedTest.ts`,
  `organizations.ts`, `chatSession.ts`, `itemAnalytics.ts`, `practiceRange.ts`.
- `contexts/` — `AuthContext`, `OrgContext`, `OnboardingContext`,
  `LoginDialogContext` (auth/tenant context via React Context, not a store).
- `integrations/firebase/` — Firebase config (`db`, `rtdb`).
- Supporting roots (outside `src/`): `pdf-churner/` (Python textbook → question
  extraction pipeline, the ancestor of AutoGrade's extraction prompts),
  `cloud-functions/`, `datav2/`, `scripts/`, `specs/`, and a very large `docs/`
  (80+ markdown design notes).

### A.3 Entities / schemas / collections / routes (with paths)

**Domain types** (`LevelUp-App/src/domain/models.ts`):

- `User`, `Space` (`type: 'default' | 'practice_range'`), `StoryPoint` (with
  `sections[]`), enums `SpaceDifficulty`, `DimensionLevel`
  (Silver/Gold/Platinum/Diamond — the gamification tiers), `ScopeType`
  (Quest/StoryPoint/Space), `CodeStatus` (redemption codes).

**Flexible item model** (`LevelUp-App/src/types/items.ts`) — the single most
important inherited concept:

- `ItemType = 'question' | 'material' | 'interactive' | 'assessment' | 'discussion' | 'project' | 'checkpoint'`.
- `QuestionPayload.questionType` covers ~16 types:
  `mcq, mcaq, true-false, text, code, material, matching, fill-blanks, fill-blanks-dd, paragraph, jumbled, audio, group-options, chat_agent_question, numerical, image_evaluation`.
- `MaterialPayload` (text/video/pdf/link/interactive/story/rich, with a
  Medium-style `richContent.blocks[]` rich-text model), `InteractivePayload`,
  `AssessmentPayload` (with `rubric[]`), `DiscussionPayload`, `ProjectPayload`.
- Items validated with **Zod** (`ItemDTOSchema`).

**Timed-test types** (`LevelUp-App/src/types/timedTest.ts`): `TimedTestSession`,
`TimedTestSubmission`, `TimedTestResults`, `TimedTestAttemptSummary` —
server-timed sessions, one-attempt enforcement.

**Org/tenant types** (`LevelUp-App/src/types/organizations.ts`): `OrgDTO`
(school/institute with `code` join code, `adminUids[]`, `ownerUid`),
`OrgGroupDTO`, `UserOrgRecord` (`{userId}_{orgId}`), centralized `userRoles`.

**Firestore collections (FLAT / global — no tenant scoping):** confirmed by
`grep` over `services/`: `courses`, `storyPoints`, `sections`, `items`,
`practiceItems`, `attempts`, `progress` — all top-level. Multi-tenancy was
bolted on later via `orgs`, `userRoles`, `userOrgs` rather than path scoping.
Rules: `LevelUp-App/firestore.rules` keys access off a global `userRoles/{uid}`
doc (`isSuperAdmin`, `orgAdmin[orgId]`).

**Realtime Database (RTDB)** is used in parallel for live/aggregated data:
`LeaderboardService`, `ResumeProgressService`, `UserCourseProgressService`,
`MetricsService`, `PracticeRangeProgressService` all read/write `rtdb`
(`LevelUp-App/src/integrations/firebase/config`). RTDB rules:
`LevelUp-App/database.rules.json`.

**Routes** (`LevelUp-App/src/App.tsx`): `/home`, `/store`, `/settings`, `/orgs`,
`/orgs/:orgId/admin`, `/super-admin`, `/courses/:id` (+ `admin`,
`sp/:storyPointId/admin`), `/courses/:id/sp/:storyPointId(/item/:itemId)`,
`/practice/:id(/item/:itemId)`, timed-test routes
`/courses/:courseId/sp/:storyPointId/timed-test/...`, and `/scan/:tagId`.

**Important: the legacy `/scan/:tagId` is NOT exam scanning.** Per
`LevelUp-App/src/pages/Scan.tsx`, it is a **QR/short-link tag redirector** —
looks up a `LinkTagsService` tag and redirects. There is **no answer-sheet
scanning in the legacy app**; that capability is net-new in the planned
scanner-app.

**Services** (class singletons, `LevelUp-App/src/services/`):
`agents/AgentsService`, `ai/questionGenerationTools`, `chat/ChatSessionService`,
`content/ContentService`,
`courses/{CoursesService, CourseContentService, RedemptionService, UserCourseInventoryService}`,
`items/ItemsService`, `leaderboard/LeaderboardService`,
`metrics/MetricsService`,
`organizations/{OrgsService, OrgGroupsService, UserOrgsService, UserRolesService}`,
`practiceRange/{PracticeRangeItemsService, PracticeRangeProgressService}`,
`progress/{AttemptsService, ProgressService, ResumeProgressService, UserCourseProgressService, UserStoryPointProgressService}`,
`storyPoints/{StoryPointsService, StoryPointSectionsService}`,
`timedTest/{TimedTestSessionService, AnswerEvaluator}`, `users/UsersService`.
Each has a matching test in `services/__tests__/`.

### A.4 Concepts the legacy app pioneered (inherited by / still needed in monorepo)

Already inherited into `packages/shared-types/src/levelup/*` and `content/*`:

- **Space → StoryPoint → Item hierarchy.** Now `levelup/space.ts`,
  `levelup/story-point.ts`, `content/item.ts`.
- **Flexible polymorphic Item model** (question/material/interactive/etc with
  type-specific payloads). Now `content/item.ts` + `content/item-metadata.ts`;
  the 15-question-type taxonomy survives (see the `content-item-generator`
  skill).
- **Timed tests / test sessions** with server timing + one-attempt rule. Now
  `levelup/test-session.ts`.
- **Question bank / AI question generation** (`ai/questionGenerationTools`,
  `pdf-churner/`). Now `levelup/question-bank.ts` and the AutoGrade extraction
  prompts (`functions/autograde/src/prompts/extraction.ts`).
- **Chat / agent question type** (`chat_agent_question`, `ChatSessionService`,
  `AgentsService`). Now `levelup/chat.ts`, `levelup/agent.ts`.
- **Gamification tiers** (Silver/Gold/Platinum/Diamond `DimensionLevel`,
  leaderboards, redemption codes/store). Partly inherited into
  `gamification/achievement.ts`; **leaderboards/RTDB live progress and the
  redemption-code "Store" economy are NOT yet fully ported** and remain a gap.
- **Practice Range** (flat, ungated item list mode of a Space). The
  `type: 'practice_range'` distinction exists in legacy `Space`; verify parity
  in `levelup/space.ts`.
- **Item analytics** (`types/itemAnalytics.ts`, per-item
  difficulty/discrimination) — overlaps with `analytics/*` but the granular
  per-item stats concept should carry forward.

### A.5 Strengths worth keeping

- **The Item abstraction** — one polymorphic content unit with typed payloads
  and Zod validation is a genuinely good design and is the backbone of the
  platform.
- **Feature-module structure** (`features/questions/` with co-located
  components + hooks + utils) reads well and maps cleanly to the new monorepo
  apps.
- **Class-based singleton services** isolate all Firestore access from UI — a
  clean seam that the monorepo should preserve (as `packages/shared-services`).
- **Server-timed test sessions + one-attempt enforcement** (anti-cheat) is
  mature logic worth lifting wholesale.
- **Rich content blocks** (Medium-style `richContent.blocks[]`) for materials.
- **Extensive design docs** in `LevelUp-App/docs/` — institutional memory.

### A.6 Pain points / tech debt / inconsistencies

- **Flat global collections, no tenant scoping.** `courses`, `items`,
  `progress`, etc. are top-level; multi-tenancy was retrofitted via
  `orgs`/`userRoles` rather than `/tenants/{tenantId}/...` paths. The new
  monorepo correctly uses tenant path scoping (`/tenants/{tenantId}/...`); the
  legacy model does not migrate cleanly and is a security/isolation liability.
- **Dual persistence (Firestore + RTDB).** Progress, leaderboards, metrics, and
  resume-state live in RTDB while content lives in Firestore — two sources of
  truth, two rule files (`firestore.rules` + `database.rules.json`), and
  consistency headaches. The new stack should consolidate (Firestore +
  derived/aggregated docs or a single analytics path).
- **State sprawl.** Redux Toolkit but only ONE slice (`coursesSlice.ts`); the
  rest is React Context + service singletons + TanStack Query — three
  overlapping state patterns. The new monorepo standardizes on **Zustand 5**
  (per scanner reqs and `packages/shared-stores`); legacy Redux is dead weight.
- **`questionData: any`** in `QuestionPayload` (`types/items.ts:25`) — escapes
  the type system for the most important field. Should be a discriminated union.
- **Auth/role model duplicated.** `userRoles/{uid}` global doc with
  `isSuperAdmin`/`orgAdmin[orgId]` map vs the monorepo's
  `userMemberships/{uid}_{tenantId}` + custom claims. Two incompatible RBAC
  models.
- **Root-level clutter.** Python scripts, `debug_re.py`, `rtdb.json` dumps,
  `fix_latex_files.py`, multiple `*.timestamp-*.mjs` Vite artifacts, 80+ ad-hoc
  docs — large surface, hard to onboard.
- **`/scan/:tagId` overloads the word "scan"** with QR-redirect semantics that
  collide with the new exam-scanner meaning — a naming hazard for the rebuild.

---

## PART B — Planned `scanner-app`

### B.1 Intended role

Per `requirements/scanner-app/requirements.md` ("AutoGrade Scanner Portal
v1.0"): a **standalone, mobile-first PWA** for school staff ("scanners") to
**photograph or upload physical exam answer sheets** and feed them into the
**AutoGrade OCR + AI grading pipeline**. Workflow:
`Login → Select Exam → Select Student → Capture/Upload images → Submit`. Stack:
Vite + React 18 + TS strict + Tailwind + **Zustand 5** + RHF + Zod 4 + React
Router 6 + Firebase, react-hot-toast, KaTeX/react-markdown. Port **4574**.

Core features (FR-xxx): three-credential login (school code + username +
password), session persistence to localStorage, exam list (status `ready` /
`question_paper_uploaded`), class-filtered student list, **camera capture with
overlay guides + file/PDF upload**, image preview grid + full-screen viewer,
**client-side compression (max 1920px, 85% JPEG)**, upload to Cloud Storage, and
creation of a **submission document** for the grading pipeline. NFRs emphasize
mobile usability (44px touch targets, fixed bottom submit bar), camera
permissions, offline resilience (images held in memory until submit), and
tenant-membership security.

### B.2 What already exists in the monorepo (the scanner is partly pre-wired)

The scanner is **not greenfield** — the backend contract already exists:

- **`scanner` is a first-class role** in
  `packages/shared-types/src/identity/ membership.ts:15` (`TenantRole`) and
  surfaces in claims (`identity/claims.ts:22` `scannerId`) and tenant features
  (`identity/tenant.ts:37` `scannerAppEnabled: boolean`).
- **A scanners collection + rules exist:** `firestore.rules` lines ~224–230
  define `/scanners/{scannerId}` (read if
  `resource.data.authUid == request.auth.uid`; writes Cloud-Functions-only).
  Scanners are created by `functions/identity/src/callable/create-org-user.ts`.
- **The upload callable already accepts scanner uploads.**
  `functions/autograde/src/callable/upload-answer-sheets.ts` validates with
  `UploadAnswerSheetsRequestSchema`
  (`packages/shared-types/src/schemas/callable-schemas.ts:649`) and calls
  `assertAutogradePermission(..., { allowScanner: true })`. It writes the
  submission to `tenants/{tenantId}/submissions/{id}` with
  `answerSheets.uploadSource = 'scanner'`, `pipelineStatus: 'uploaded'`.
- **The submission schema is fixed:**
  `packages/shared-types/src/autograde/submission.ts` — `Submission` with
  `answerSheets: { images, uploadedAt, uploadedBy, uploadSource }`,
  `pipelineStatus`, denormalized `studentName`/`rollNumber`/`classId`.
- **Downstream pipeline is built:**
  `functions/autograde/src/triggers/ on-submission-created.ts`,
  `pipeline/{process-answer-mapping, process-answer- grading, finalize-submission}.ts`,
  and the Panopticon/Relms/extraction prompts in
  `functions/autograde/src/prompts/`.

So the scanner-app frontend's job is to **call the existing `uploadAnswerSheets`
callable** with storage paths under `tenants/{tenantId}/...`, after uploading
compressed images to that storage namespace.

### B.3 Overlap & contradictions to resolve before building

The requirements doc was written against an **older data model** and
**contradicts the current backend** in several places. These MUST be reconciled
in the rebuild:

| Requirements doc says                                                                                                  | Current backend reality                                                                                                                 | Action                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Validate against `clients` collection; `clients/{clientId}/scanners`, `/exams`, `/students`, `/submissions` (§2.1, §4) | Model is **`tenants/{tenantId}/...`**; scanners are **top-level `/scanners/{scannerId}`** (`firestore.rules:224`)                       | Rewrite all paths to `tenants/{tenantId}/...`; treat `clients` as legacy naming.                |
| Exam statuses `ready` / `question_paper_uploaded` (FR-014)                                                             | Upload callable requires exam status **`published`** or `grading` (`upload-answer-sheets.ts:48-53`)                                     | Filter exams by `published`/`grading`.                                                          |
| Frontend "creates a submission document in Firestore" directly (FR-038)                                                | Submission is created **server-side** by the `uploadAnswerSheets` callable (rules: scanner clients cannot write `submissions` directly) | Frontend uploads images to Storage, then calls the callable; does NOT write Firestore directly. |
| "Cloud Functions (us-central1 region)" (FR-046)                                                                        | Functions run in **`asia-south1`** (`upload-answer-sheets.ts:17`)                                                                       | Use `asia-south1`.                                                                              |
| Generate submission IDs client-side (FR-042)                                                                           | Server allocates the doc ID (`subRef = ...doc()`)                                                                                       | Drop client ID generation.                                                                      |
| `clients` school-code auth (FR-002)                                                                                    | Auth is membership-based: `userMemberships/{uid}_{tenantId}` + custom claims (`identity/membership.ts`)                                 | Auth against tenant code → membership with `role: 'scanner'`, `status: 'active'`.               |

### B.4 Strengths of the scanner plan worth keeping

- **Mobile-first PWA + camera capture with alignment overlays + client-side
  compression** is exactly right for OCR throughput and is not yet built
  anywhere.
- **Denormalized submission (student/exam/scanner info)** aligns with how the
  backend already denormalizes `studentName`/`rollNumber`.
- **Clear linear workflow** (exam → student → upload) maps directly to existing
  exam/class/student entities.
- **Duplicate-submission guard** — already enforced server-side
  (`upload-answer-sheets.ts:64-79` throws `already-exists`); the UI should
  surface it gracefully.

### B.5 Pain points / risks in the plan as written

- **Stale `clients` data model** (see B.3) — biggest risk; building to the doc
  verbatim would produce an app that cannot talk to the live backend.
- **Direct Firestore writes** for submissions violate the current security rules
  (scanner clients are read-only on submissions) and bypass validation/rate
  limits.
- **localStorage session persistence** (FR-005/006, NFR-014) must be reconciled
  with Firebase Auth's own persistence + custom claims (don't store
  credentials).
- **No mention of offline queue durability** beyond in-memory state (NFR-017) —
  for poor-connectivity schools, captured images should survive a tab close
  (IndexedDB), not just a network blip.
- **us-central1 region mismatch** would silently fail callable calls.

---

## PART C — Recommendations for a fresh rebuild

**Cross-cutting (both legacy LevelUp + scanner):**

1. **Adopt the monorepo tenant model end-to-end.** All data under
   `tenants/{tenantId}/...`; auth via `userMemberships/{uid}_{tenantId}` +
   custom claims; no flat global collections, no `clients`, no separate
   `userRoles` doc.
2. **A single common API layer = the existing callable contracts.** Both web
   apps and future React Native apps should call typed Cloud Functions
   (`functions/autograde`, `functions/identity`, etc.) validated by
   `packages/shared-types/src/schemas/*`. Never write business-critical docs
   (submissions, grades) directly from clients — go through callables so RN and
   web share one trust boundary, one validation path, and one rate limiter.
3. **Consolidate state on Zustand 5** (`packages/shared-stores`); retire legacy
   Redux + the Context-as-store pattern.
4. **Kill the Firestore/RTDB split.** Move leaderboards/live-progress/metrics
   off RTDB into Firestore + aggregated/analytics docs (or a single chosen
   realtime path) so there is one source of truth and one rules file.
5. **Share types via `packages/shared-types`.** The legacy `types/items.ts`,
   `timedTest.ts`, `organizations.ts` should be fully represented in `levelup/*`
   / `content/*`; replace `questionData: any` with a discriminated union keyed
   on `questionType`.
6. **React Native readiness:** keep all Firebase access in framework-agnostic
   service functions (`packages/shared-services`) and callable wrappers in
   `packages/shared-hooks`, so RN imports the same data layer; isolate web-only
   bits (camera DOM APIs, drag-and-drop) behind a thin platform adapter.

**LevelUp legacy specifically:** 7. Port the **missing gamification economy**
(Silver/Gold/Platinum/Diamond tiers, leaderboards, redemption codes / Store) and
**per-item analytics** into the monorepo — these are pioneered concepts not yet
fully carried forward. 8. Preserve **server-timed test sessions + one-attempt
enforcement** and the **rich-content block model** verbatim (they are
mature). 9. Salvage `LevelUp-App/docs/` design notes and `pdf-churner/`
extraction prompts into the AutoGrade/extraction lineage, then archive the
legacy app.

**Scanner-app specifically:** 10. **Add `apps/scanner-web/`** to the monorepo
(no app exists today). Treat the requirements doc as intent, but build against
the live contract: - Auth: tenant code → membership `role === 'scanner'`,
`status === 'active'`; gate on `tenant.features.scannerAppEnabled`. - List exams
with status `published`/`grading`; list class-scoped active students. - Upload
compressed images to `tenants/{tenantId}/...` Storage namespace, then call
**`uploadAnswerSheets`** (region `asia-south1`) — never write the submission doc
directly. - Surface server errors (`already-exists`, `failed-precondition`) as
friendly UI states. 11. **Offline-durable capture queue** (IndexedDB) so
captures survive tab close; retry the callable on reconnect. This makes the
scanner a strong **React Native** candidate later (same callable, same offline
queue concept). 12. **Rename to avoid "scan" collision** with the legacy
`/scan/:tagId` QR redirector — e.g. "answer-sheet upload" / "exam intake".
