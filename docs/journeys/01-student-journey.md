# 01 — Student Journey (`apps/student-web`)

**Port:** `4570` (`vite.config.ts`, `host: "127.0.0.1"`, `strictPort: true`)  
**Local URL:** http://127.0.0.1:4570  
**Allowed roles:** `student` (B2B shell); any authenticated user without school membership → B2C `/consumer`  
**Credentials:** see [`TEST_CREDENTIALS.md`](../../TEST_CREDENTIALS.md) (e.g. school `GRN001`, roll `2025001` / `aarav.patel@greenwood.edu`, consumer `consumer@gmail.test`)

---

## Login start (exact steps)

### B2B school student

1. Open http://127.0.0.1:4570/login
2. **School code** view → enter code → `lookupTenantByCode` + `evaluateTenantAccess` (blocks invalid / inactive / trial-expired)
3. **Credentials** view → school name shown; tabs:
   - **Roll Number** (default) + password, **or**
   - **Email** + password
4. Submit → `loginWithSchoolCode` (shared-stores):
   - Lookup tenant by code (uppercase normalize)
   - If credential has `@` → email; else derive `{roll}@{tenantId}.levelup.internal`
   - Firebase `signIn` → `getMembership` must be `active`
   - `callSwitchActiveTenant(tenantId)` → `getIdToken(true)` to pick up JWT claims
5. Land on `/` (Dashboard) inside `AppLayout`

### B2C consumer (no school)

1. On login: **“Don’t have a school code? Sign in as learner”**
2. Email + password **or** Google → navigate `/consumer` (`ConsumerLayout`)
3. Signup view also present for consumer registration

### Session hydration

- `useAuthStore.initialize()` on App mount (Firestore user + memberships + claims)
- Tenant doc via `useTenantStore.subscribe(currentTenantId)`
- **Note:** Student app does **not** always call `v1.identity.getMe` the way teacher/admin SDK session does; hydration is store-centric. Tenant switch: `useAuthStore.switchTenant` → `callSwitchActiveTenant`

---

## Guards / empty & error states

| Condition | Behavior |
|-----------|----------|
| Loading | Full-screen spinner |
| No Firebase user | Redirect `/login` with `from` location |
| `allowedRoles=["student"]` but **no** membership | Redirect **`/consumer`** (consumer escape hatch) |
| Wrong role **with** membership | Inline **Access Denied** — “You don’t have permission to access this page.” |
| Unknown route | `NotFoundPage` |
| School code gate | Invalid code, trial expired, inactive school, lookup failure |

`StudyPlannerPage.tsx` exists under `pages/` but is **not present** in `App.tsx` routes (orphan page).

---

## Full route tree (`App.tsx`)

### B2B — `RequireAuth allowedRoles={["student"]}` + `AppLayout`

| Path | Page | Purpose |
|------|------|---------|
| `/` | DashboardPage | Assigned spaces, recent activity, progress snapshot |
| `/spaces` | SpacesListPage | Browse learning spaces |
| `/spaces/:spaceId` | SpaceViewerPage | Space overview / sections |
| `/spaces/:spaceId/story-points/:storyPointId` | StoryPointViewerPage | Content + practice + AI tutor chat |
| `/spaces/:spaceId/test/:storyPointId` | TimedTestPage | Timed assessment session |
| `/spaces/:spaceId/test/:storyPointId/analytics` | TestAnalyticsPage | Post-test analytics |
| `/spaces/:spaceId/practice/:storyPointId` | PracticeModePage | Untimed practice |
| `/results` | ProgressPage | LevelUp learning progress (label “Progress” in nav) |
| `/exams/:examId/results` | ExamResultPage | Released autograde per-question feedback |
| `/notifications` | NotificationsPage | Inbox (header bell; not in sidebar) |
| `/leaderboard` | LeaderboardPage | Rankings (RTDB live) |
| `/tests` | TestsPage | Scheduled class tests across spaces |
| `/settings` | SettingsPage | Notification preferences |
| `/profile` | ProfilePage | Student profile |

### B2C — `RequireAuth` (any auth) + `ConsumerLayout`

| Path | Page | Purpose |
|------|------|---------|
| `/consumer` | ConsumerDashboardPage | Purchased / My Learning |
| `/my-spaces` | ConsumerDashboardPage | Alias of My Learning |
| `/consumer/spaces/:spaceId` | SpaceViewerPage | Shared viewer |
| `/consumer/spaces/:spaceId/story-points/:storyPointId` | StoryPointViewerPage | Shared |
| `/consumer/spaces/:spaceId/test/:storyPointId` | TimedTestPage | Shared |
| `/consumer/spaces/:spaceId/practice/:storyPointId` | PracticeModePage | Shared |
| `/store` | StoreListPage | Catalog |
| `/store/:spaceId` | StoreDetailPage | Space detail |
| `/store/checkout` | CheckoutPage | Purchase cart |
| `/profile` | ConsumerProfilePage | Consumer profile (**same path** as B2B profile — layout depends on which shell matched) |

---

## Sidebar / bottom nav (`AppLayout.tsx`)

| Label | Path |
|-------|------|
| Dashboard | `/` |
| My Spaces | `/spaces` |
| Tests | `/tests` |
| Progress | `/results` |
| Leaderboard | `/leaderboard` |
| Profile | `/profile` |
| Settings | `/settings` |

**Mobile bottom nav:** Home `/` · Spaces `/spaces` · Tests `/tests` · Rank `/leaderboard` · Profile `/profile`

**Footer:** `RoleSwitcher` (student memberships) + Sign Out → `/login`

### Consumer sidebar (`ConsumerLayout.tsx`)

| Label | Path |
|-------|------|
| My Learning | `/consumer` (also active on `/my-spaces`) |
| Space Store | `/store` |
| Cart (N) | `/store/checkout` *(only if cartCount > 0)* |
| Profile | `/profile` |

App name in consumer sidebar: **LevelUp** (vs **Student** in school layout).

---

## Primary CTAs → callables / APIs

| Action | Callable / hook | Where |
|--------|-----------------|-------|
| Evaluate practice answer | `v1.levelup.evaluateAnswer` | Story point / Practice |
| Record attempt | `v1.levelup.recordItemAttempt` | Story point / Practice |
| AI tutor chat | `v1.levelup.sendChatMessage` | StoryPointViewer |
| Start timed test | `v1.levelup.startTestSession` | TimedTestPage |
| Submit timed test | `v1.levelup.submitTestSession` | TimedTestPage |
| Buy space (B2C) | `v1.levelup.purchaseSpace` | Checkout |
| List store spaces | `v1.levelup.listStoreSpaces` | Store |
| Mark notifications read | notification manage hooks | Notifications |
| Tenant switch | `v1.identity.switchActiveTenant` | RoleSwitcher |

Exam results are **read-only** after teacher `releaseResults` — student does not call Gemini for paper exams.

---

## AI on this journey

- **Tutor chat:** `sendChatMessage` → Gemini **flash** (`aiChat` prompt) via server gateway
- **Practice evaluate:** `evaluateAnswer` AI grading path
- **Not present on student:** question-paper vision, answer-sheet grading, content draft generation
- Client never holds Gemini keys (`VITE_FIREBASE_*` only)

---

## How student connects to other roles

| Upstream | Downstream effect |
|----------|-------------------|
| Admin creates student + class | Membership + claims (`studentId`, `classIds`) |
| Teacher authors / assigns spaces | Spaces appear on Dashboard / My Spaces |
| Teacher creates timed tests | Appear under `/tests` and space test routes |
| Teacher releases exam results | `/exams/:examId/results` becomes available |
| Parent linked via admin | Parent sees this student’s progress/results |
| Admin analytics | Aggregates student progress / AI usage |

**In-app links to teacher/admin/parent portals:** not present — handoff via marketing `APP_URLS` only.
