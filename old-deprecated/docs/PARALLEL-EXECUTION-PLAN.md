# Parallel Execution Plan: Complete Testing & UI/UX Implementation

**Date:** 2026-02-27 **Status:** PENDING APPROVAL **Coordinator:** Architect
Lead

---

## 1. Current Project Status Assessment

### What's Done

- **Monorepo structure** (`pnpm` workspace) with `packages/`, `apps/`,
  `functions/`, `LevelUp-App/`
- **Shared Types** (`@levelup/shared-types`) — Identity, Tenant, Content,
  LevelUp, AutoGrade, Progress, Notification, Constants, Callable types
- **Shared Services** (`@levelup/shared-services`) — Firebase config, Auth
  (callables, tenant-lookup, membership), Firestore, Storage, Realtime DB, AI
  (LLM wrapper, secret-manager, cost-tracker, logger), Reports, AutoGrade exam
  callables
- **Shared Hooks** (`@levelup/shared-hooks`) — Auth hooks, Data hooks (Firestore
  doc/collection, RTDB), UI hooks, Query hooks (20+ TanStack Query hooks)
- **Shared Stores** (`@levelup/shared-stores`) — auth-store, tenant-store,
  ui-store (Zustand)
- **Shared UI** (`@levelup/shared-ui`) — 50+ shadcn/ui components, auth
  components, chart components, layout components, metric tracking hooks
- **Shared Utils** (`@levelup/shared-utils`) — CSV, PDF, validation, formatting,
  date utilities
- **Legacy LevelUp-App** — Full working app with 25+ services (Courses,
  StoryPoints, Progress, Chat, Agents, Leaderboard, TimedTest, etc.), 20+ pages,
  question answerers for 16 types
- **Legacy AutoGrade** — Scanner app, Client admin, Super admin
- **New App Shells** — teacher-web, student-web, admin-web, parent-web,
  super-admin (scaffolded with basic pages/routes)
- **Callable API** — Redesigned consolidated API using upsert `save*` pattern
  (SaveTenant, SaveClass, SaveStudent, SaveTeacher, SaveParent,
  SaveAcademicSession, SaveSpace, SaveStoryPoint, SaveItem, ManageNotifications)
- **E2E Test stubs** — Playwright specs for admin-web, student-web, parent-web,
  teacher-web, super-admin
- **Cloud Functions** — Progress aggregation (onUserStoryPointProgressWrite), AI
  chat, leaderboard updates
- **Vitest configured** — Base config with 60% coverage thresholds, workspace
  setup
- **2 Integration tests** exist: `membership-service.integration.test.ts`,
  `tenant-lookup.integration.test.ts`

### What's Missing (Gaps)

1. **ZERO unit tests** for service layer, stores, hooks, utilities
2. **ZERO integration tests** for Firebase services (except 2 auth-related)
3. **New app UIs** are mostly scaffolded but not fully built out (teacher-web,
   student-web)
4. **Cloud Functions** for AutoGrade pipeline and LevelUp operations not yet
   ported to new architecture
5. **State management** not wired to new Firebase backend in new apps
6. **E2E tests** are stubs that need real implementation

---

## 2. Execution Waves

### WAVE 1: Foundation Testing (Firebase Backend) — 7 Workers

Test the entire Firebase repository/service layer against actual Firebase. Unit
tests + integration tests for every service, collection, and callable.

### WAVE 2: State & Hooks Testing — 3 Workers

Test Zustand stores, TanStack Query hooks, and React hooks that bridge Firebase
to UI.

### WAVE 3: UI/UX Flows — 3-4 Workers

Design and build complete UI/UX flows for the new apps, based on existing
LevelUp-App and AutoGrade patterns.

---

## 3. Detailed Task Breakdown

### WAVE 1: Firebase Service Layer Testing (7 Workers in Parallel)

---

#### Worker 1: "Auth Service Tester"

**Scope:** Authentication, Identity & Tenant Lookup **Files to test:**

- `packages/shared-services/src/auth/auth-callables.ts` — All callable wrappers
  (switchActiveTenant, createOrgUser, updateTeacherPermissions, createTenant,
  bulkImport, etc.)
- `packages/shared-services/src/auth/tenant-lookup.ts` — lookupTenantByCode,
  getTenantById
- `packages/shared-services/src/auth/membership-service.ts` — getMemberships,
  getUserProfile
- `packages/shared-services/src/firebase/config.ts` — Firebase initialization,
  getFirebaseServices

**Test files to create:**

```
packages/shared-services/src/__tests__/auth-callables.test.ts
packages/shared-services/src/__tests__/auth-callables.integration.test.ts
packages/shared-services/src/__tests__/firebase-config.test.ts
```

**Test cases (~30):**

- Firebase initialization with valid/invalid config
- switchActiveTenant success, invalid tenant, unauthorized
- createOrgUser for each role type (student, teacher, parent, scanner,
  tenantAdmin)
- createOrgUser with missing required fields
- createTenant with valid data, duplicate tenantCode
- updateTeacherPermissions success and unauthorized
- bulkImportStudents with valid CSV, invalid data, partial failures
- bulkImportParents with valid CSV, link validation
- lookupTenantByCode with valid/invalid/empty code
- getTenantById existing/non-existing
- getMemberships for user with single/multiple memberships
- getUserProfile with claims verification

---

#### Worker 2: "Firestore Service Tester"

**Scope:** Core Firestore CRUD operations **Files to test:**

- `packages/shared-services/src/firestore/index.ts` — Org-scoped CRUD (get, set,
  update, delete, batch, query)

**Test files to create:**

```
packages/shared-services/src/__tests__/firestore-service.test.ts
packages/shared-services/src/__tests__/firestore-service.integration.test.ts
```

**Test cases (~25):**

- getDoc by org-scoped path, existing/non-existing
- setDoc with new data, overwrite existing
- updateDoc partial update, field deletion
- deleteDoc existing/non-existing
- batchWrite (create + update + delete in one batch)
- queryDocs with where, orderBy, limit, startAfter
- Server timestamp utility functions
- Org-scoped path construction (ensures `organizations/{orgId}/` prefix)
- Multi-tenant isolation verification (orgA cannot read orgB data)
- Complex query with multiple where clauses
- Pagination with cursor-based queries

---

#### Worker 3: "Storage & RTDB Tester"

**Scope:** Firebase Storage + Realtime Database services **Files to test:**

- `packages/shared-services/src/storage/index.ts` — Org-scoped file operations
- `packages/shared-services/src/realtime-db/index.ts` — Org-scoped RTDB
  operations

**Test files to create:**

```
packages/shared-services/src/__tests__/storage-service.test.ts
packages/shared-services/src/__tests__/storage-service.integration.test.ts
packages/shared-services/src/__tests__/rtdb-service.test.ts
packages/shared-services/src/__tests__/rtdb-service.integration.test.ts
```

**Test cases (~25):**

- Storage: upload blob, upload base64, upload data URL
- Storage: getDownloadUrl for existing/non-existing file
- Storage: deleteFile existing/non-existing
- Storage: listDirectory with/without files
- Storage: org-scoped path verification
- RTDB: get/set/update/delete at org-scoped paths
- RTDB: push to list, read list
- RTDB: real-time subscription (onValue), verify callback fires
- RTDB: unsubscribe cleanup
- RTDB: transaction operations
- RTDB: org-scoped path verification
- Cross-tenant isolation for both Storage and RTDB

---

#### Worker 4: "LevelUp Services Tester (Legacy)"

**Scope:** All LevelUp-App service files that directly interact with Firestore
**Files to test:**

- `LevelUp-App/src/services/courses/CoursesService.ts`
- `LevelUp-App/src/services/courses/CourseContentService.ts`
- `LevelUp-App/src/services/courses/UserCourseInventoryService.ts`
- `LevelUp-App/src/services/courses/RedemptionService.ts`
- `LevelUp-App/src/services/storyPoints/StoryPointsService.ts`
- `LevelUp-App/src/services/storyPoints/StoryPointSectionsService.ts`
- `LevelUp-App/src/services/content/ContentService.ts`
- `LevelUp-App/src/services/items/ItemsService.ts`

**Test files to create:**

```
LevelUp-App/src/services/__tests__/CoursesService.test.ts
LevelUp-App/src/services/__tests__/CourseContentService.test.ts
LevelUp-App/src/services/__tests__/UserCourseInventoryService.test.ts
LevelUp-App/src/services/__tests__/RedemptionService.test.ts
LevelUp-App/src/services/__tests__/StoryPointsService.test.ts
LevelUp-App/src/services/__tests__/ContentService.test.ts
LevelUp-App/src/services/__tests__/ItemsService.test.ts
```

**Test cases (~35):**

- CoursesService: listAll, listPublic, listByOwner, getById, create, update,
  delete, slug validation
- CourseContentService: storyPoint ordering, content tree building
- UserCourseInventoryService: has, add, listByUser, listAdminsByCourse,
  archive/unarchive, subscribe
- RedemptionService: generate code, redeem code, validate code, expired code
- StoryPointsService: CRUD, reorder, listByCourse
- StoryPointSectionsService: CRUD, reorder within story point
- ContentService: getByStoryPoint, getByType
- ItemsService: CRUD by type, listByStoryPoint, difficulty filtering

---

#### Worker 5: "Progress & Leaderboard Services Tester"

**Scope:** Progress tracking, leaderboard, timed tests **Files to test:**

- `LevelUp-App/src/services/progress/ProgressService.ts`
- `LevelUp-App/src/services/progress/UserStoryPointProgressService.ts`
- `LevelUp-App/src/services/progress/UserCourseProgressService.ts`
- `LevelUp-App/src/services/progress/AttemptsService.ts`
- `LevelUp-App/src/services/progress/ResumeProgressService.ts`
- `LevelUp-App/src/services/leaderboard/LeaderboardService.ts`
- `LevelUp-App/src/services/timedTest/TimedTestSessionService.ts`

**Test files to create:**

```
LevelUp-App/src/services/__tests__/ProgressService.test.ts
LevelUp-App/src/services/__tests__/UserStoryPointProgressService.test.ts
LevelUp-App/src/services/__tests__/UserCourseProgressService.test.ts
LevelUp-App/src/services/__tests__/AttemptsService.test.ts
LevelUp-App/src/services/__tests__/LeaderboardService.test.ts
LevelUp-App/src/services/__tests__/TimedTestSessionService.test.ts
```

**Test cases (~35):**

- ProgressService: listByUserAndScope, upsert, getById, remove, scope filtering
- UserStoryPointProgress: track question solved, calculate points, tier mapping
- UserCourseProgress: aggregate across story points, percentage calculation
- AttemptsService: record attempt, get attempts, attempt limits
- ResumeProgressService: save/load resume state
- LeaderboardService: get leaderboard, update score, ranking calculation
- TimedTestSessionService: startSession, submitSession, getAnySession, enforce
  single attempt, timeout handling, question order tracking, submission
  recording

---

#### Worker 6: "Organization & Chat Services Tester"

**Scope:** Organization management, agents, chat, metrics **Files to test:**

- `LevelUp-App/src/services/organizations/OrgsService.ts`
- `LevelUp-App/src/services/organizations/OrgGroupsService.ts`
- `LevelUp-App/src/services/organizations/UserOrgsService.ts`
- `LevelUp-App/src/services/organizations/UserRolesService.ts`
- `LevelUp-App/src/services/chat/ChatSessionService.ts`
- `LevelUp-App/src/services/agents/AgentsService.ts`
- `LevelUp-App/src/services/metrics/MetricsService.ts`
- `LevelUp-App/src/services/practiceRange/PracticeRangeItemsService.ts`
- `LevelUp-App/src/services/practiceRange/PracticeRangeProgressService.ts`

**Test files to create:**

```
LevelUp-App/src/services/__tests__/OrgsService.test.ts
LevelUp-App/src/services/__tests__/OrgGroupsService.test.ts
LevelUp-App/src/services/__tests__/UserOrgsService.test.ts
LevelUp-App/src/services/__tests__/ChatSessionService.test.ts
LevelUp-App/src/services/__tests__/AgentsService.test.ts
LevelUp-App/src/services/__tests__/MetricsService.test.ts
LevelUp-App/src/services/__tests__/PracticeRangeService.test.ts
```

**Test cases (~30):**

- OrgsService: CRUD, list by owner, access control
- OrgGroupsService: CRUD, list by org, member management
- UserOrgsService: join org, leave org, list user orgs
- UserRolesService: assign role, remove role, check permissions
- ChatSessionService: create session, send message, load history, delete session
- AgentsService: CRUD, list by course, default evaluator
- MetricsService: record event, query events, aggregation
- PracticeRangeItems: CRUD, list by course, progress tracking
- PracticeRangeProgress: record progress, calculate completion

---

#### Worker 7: "Callable API & AutoGrade Services Tester"

**Scope:** Callable wrappers and AutoGrade service layer **Files to test:**

- `packages/shared-services/src/autograde/exam-callables.ts`
- `packages/shared-services/src/autograde/index.ts`
- `packages/shared-services/src/reports/pdf-callables.ts`
- `packages/shared-services/src/reports/index.ts`
- `packages/shared-services/src/ai/llm-wrapper.ts`
- `packages/shared-services/src/ai/cost-tracker.ts`
- `packages/shared-services/src/ai/llm-logger.ts`
- `packages/shared-types/src/callable-types.ts` (type validation tests)

**Test files to create:**

```
packages/shared-services/src/__tests__/exam-callables.test.ts
packages/shared-services/src/__tests__/exam-callables.integration.test.ts
packages/shared-services/src/__tests__/pdf-callables.test.ts
packages/shared-services/src/__tests__/llm-wrapper.test.ts
packages/shared-services/src/__tests__/cost-tracker.test.ts
packages/shared-services/src/__tests__/llm-logger.test.ts
packages/shared-types/src/__tests__/callable-types.test.ts
```

**Test cases (~30):**

- ExamCallables: createExam, updateExam, extractQuestions, publishExam,
  uploadAnswerSheets, retryFailedQuestions, releaseResults
- PDFCallables: generateReport, generateBulkReport
- LLMWrapper: generateContent success, retry on failure, structured output,
  timeout handling
- CostTracker: token counting, cost estimation by model
- LLMLogger: log call, query logs, cleanup old logs
- Callable types: validate SaveTenantRequest, SaveClassRequest,
  SaveStudentRequest, SaveTeacherRequest, SaveParentRequest, SaveSpaceRequest,
  SaveStoryPointRequest, SaveItemRequest shapes

---

### WAVE 1.5: Shared Utilities Testing (Part of Wave 1, Worker 7 overflow)

**Files to test:**

- `packages/shared-utils/src/csv.ts`
- `packages/shared-utils/src/pdf.ts`
- `packages/shared-utils/src/validation.ts`
- `packages/shared-utils/src/formatting.ts`
- `packages/shared-utils/src/date.ts`

**Test files to create:**

```
packages/shared-utils/src/__tests__/csv.test.ts
packages/shared-utils/src/__tests__/validation.test.ts
packages/shared-utils/src/__tests__/formatting.test.ts
packages/shared-utils/src/__tests__/date.test.ts
```

**Test cases (~25):**

- CSV: parse valid student CSV, parse parent CSV, handle errors, validate
  warnings
- Validation: email, phone, URL, empty string, range, XSS sanitization
- Formatting: currency, number, percentage, truncation, case conversions, byte
  size, initials
- Date: formatDate, formatTime, relativeTime, isToday, isPast, addDays,
  startOfDay, endOfDay

---

### WAVE 2: State Management & Hooks Testing (3 Workers)

---

#### Worker 8: "Zustand Stores Tester"

**Scope:** All Zustand stores **Files to test:**

- `packages/shared-stores/src/auth-store.ts`
- `packages/shared-stores/src/tenant-store.ts`
- `packages/shared-stores/src/ui-store.ts`

**Test files to create:**

```
packages/shared-stores/src/__tests__/auth-store.test.ts
packages/shared-stores/src/__tests__/tenant-store.test.ts
packages/shared-stores/src/__tests__/ui-store.test.ts
```

**Test cases (~20):**

- auth-store: login sets user, logout clears state, membership switching, role
  checking
- tenant-store: set active tenant, load tenant data, clear on logout
- ui-store: sidebar toggle, modal open/close, toast add/remove/auto-dismiss,
  persistence

---

#### Worker 9: "Shared Hooks Tester"

**Scope:** All shared React hooks **Files to test:**

- `packages/shared-hooks/src/auth/useAuth.ts`
- `packages/shared-hooks/src/data/useFirestoreDoc.ts`
- `packages/shared-hooks/src/data/useFirestoreCollection.ts`
- `packages/shared-hooks/src/data/useRealtimeDB.ts`
- `packages/shared-hooks/src/ui/useMediaQuery.ts`
- `packages/shared-hooks/src/ui/useDebounce.ts`
- `packages/shared-hooks/src/ui/useLocalStorage.ts`
- `packages/shared-hooks/src/ui/useClickOutside.ts`

**Test files to create:**

```
packages/shared-hooks/src/__tests__/useAuth.test.ts
packages/shared-hooks/src/__tests__/useFirestoreDoc.test.ts
packages/shared-hooks/src/__tests__/useFirestoreCollection.test.ts
packages/shared-hooks/src/__tests__/useRealtimeDB.test.ts
packages/shared-hooks/src/__tests__/useMediaQuery.test.ts
packages/shared-hooks/src/__tests__/useDebounce.test.ts
packages/shared-hooks/src/__tests__/useLocalStorage.test.ts
packages/shared-hooks/src/__tests__/useClickOutside.test.ts
```

**Test cases (~25):**

- useAuth: returns user when authenticated, null when not, loading state, error
  state
- useFirestoreDoc: subscribes, returns data, handles missing doc, cleanup
- useFirestoreCollection: subscribes, returns array, handles queries, cleanup
- useRealtimeDB: subscribes, returns data, handles path changes, cleanup
- useMediaQuery: matches query, handles resize
- useDebounce: delays value, updates after delay, resets on new input
- useLocalStorage: read/write, handles missing key, handles invalid JSON
- useClickOutside: fires on outside click, ignores inside click

---

#### Worker 10: "TanStack Query Hooks Tester"

**Scope:** All query hooks in shared-hooks **Files to test:**

- `packages/shared-hooks/src/queries/*.ts` (20+ hooks including useSpaces,
  useExams, useItems, useSubmissions, useProgress, useStudents, useTeachers,
  useParents, useClasses, useAcademicSessions, useNotifications, useInsights,
  useCostSummary)

**Test files to create:**

```
packages/shared-hooks/src/__tests__/queries/useSpaces.test.ts
packages/shared-hooks/src/__tests__/queries/useExams.test.ts
packages/shared-hooks/src/__tests__/queries/useItems.test.ts
packages/shared-hooks/src/__tests__/queries/useSubmissions.test.ts
packages/shared-hooks/src/__tests__/queries/useProgress.test.ts
packages/shared-hooks/src/__tests__/queries/useStudents.test.ts
packages/shared-hooks/src/__tests__/queries/useNotifications.test.ts
```

**Test cases (~25):**

- Each query hook: loading state, success with data, error handling, refetch,
  cache invalidation
- Pagination hooks: next page, previous page, page size
- Mutation hooks: optimistic updates, rollback on error
- Query dependencies: dependent queries fire in order

---

### WAVE 3: UI/UX Flows (3-4 Workers, Starting in Parallel with Wave 1)

---

#### Worker 11: "Teacher Web UI Builder"

**Scope:** Complete teacher-web app UI flows **Reference:** LevelUp-App course
admin pages + AutoGrade client-admin

**Pages to build/complete:**

```
apps/teacher-web/src/pages/
├── DashboardPage.tsx        — Recent spaces & exams, grading queue, quick stats
├── spaces/
│   ├── SpaceListPage.tsx    — List all teacher spaces with status filters
│   ├── SpaceEditorPage.tsx  — Settings, story points, items, agents, publish
│   └── ItemEditorPage.tsx   — Universal item editor (15 question types + 7 material types)
└── exams/
    ├── ExamListPage.tsx     — List exams with status badges
    ├── ExamCreatePage.tsx   — Exam creation wizard
    ├── ExamDetailPage.tsx   — Question paper upload, AI extraction review, rubric editing
    ├── SubmissionsPage.tsx  — Upload answer sheets, view pipeline status
    └── GradingPage.tsx      — Per-question grading review, override, bulk actions
```

**Key components to create:**

- SpaceCard, ExamCard, ItemTypeSelector, RubricEditor, QuestionPaperUploader
- GradingReviewPanel, SubmissionStatusTracker, ResultReleaseControls

---

#### Worker 12: "Student Web UI Builder"

**Scope:** Complete student-web app UI flows **Reference:** LevelUp-App student
experience

**Pages to complete:**

```
apps/student-web/src/pages/
├── DashboardPage.tsx           — Space cards, progress summary, recommendations
├── SpacesListPage.tsx          — Browse assigned spaces
├── SpaceViewerPage.tsx         — Story points, materials, sections
├── StoryPointViewerPage.tsx    — Items list, difficulty filter, section management
├── TimedTestPage.tsx           — Timer, question navigator, auto-submit
├── PracticeModePage.tsx        — Practice questions with hints
├── ProgressPage.tsx            — Progress charts, tier breakdown, course completion
├── ConsumerDashboardPage.tsx   — B2C store, public spaces
└── StoreDetailPage.tsx         — Space preview, pricing, add to collection
```

**Key components to complete:**

- All 16 QuestionAnswerer components (port from LevelUp-App)
- ChatTutorPanel (AI tutor integration)
- CountdownTimer, QuestionNavigator, ProgressBar
- MaterialViewer (markdown, video, PDF rendering)

---

#### Worker 13: "Admin & Parent Web UI Builder"

**Scope:** admin-web + parent-web + super-admin apps **Reference:** LevelUp-App
org-admin, autograde super-admin

**Admin Web pages:**

```
apps/admin-web/src/pages/
├── DashboardPage.tsx       — Tenant overview, key metrics
├── UsersPage.tsx           — User management (CRUD, bulk import)
├── ClassesPage.tsx         — Class management
├── CoursesPage.tsx         — Course assignment and monitoring
├── AnalyticsPage.tsx       — Analytics dashboard
└── SettingsPage.tsx        — Tenant settings, API keys, subscription
```

**Parent Web pages:**

```
apps/parent-web/src/pages/
├── DashboardPage.tsx       — Children overview, recent activity
├── ChildProgressPage.tsx   — Per-child progress, exam results
├── NotificationsPage.tsx   — Notifications center
└── SettingsPage.tsx        — Profile settings
```

**Super Admin pages:**

```
apps/super-admin/src/pages/
├── DashboardPage.tsx       — Global metrics, tenant list
├── TenantsPage.tsx         — Tenant management (CRUD, suspend/activate)
├── TenantDetailPage.tsx    — Deep dive into specific tenant
├── SystemHealthPage.tsx    — System monitoring
└── SettingsPage.tsx        — Global configuration
```

---

#### Worker 14 (Optional): "Shared UI Components Builder"

**Scope:** Build missing shared UI components needed by all apps

**Components to build:**

- `EntityTable` — Generic data table with sorting, filtering, pagination
- `BulkActionBar` — Bulk selection and actions toolbar
- `StatusBadge` — Universal status badge (active, archived, draft, published,
  etc.)
- `EmptyState` — Configurable empty state component
- `ConfirmDialog` — Reusable confirmation dialog
- `FileUploader` — Drag-and-drop file upload component
- `RichTextEditor` — Markdown editor with toolbar
- `StatsCard` — Dashboard metric card
- `ActivityFeed` — Recent activity timeline

---

## 4. Worker Assignment Summary

| Worker # | Name                          | Wave | Type    | Scope                                   | Est. Test Cases |
| -------- | ----------------------------- | ---- | ------- | --------------------------------------- | --------------- |
| 1        | Auth Service Tester           | 1    | Testing | Auth, Identity, Tenant                  | ~30             |
| 2        | Firestore Service Tester      | 1    | Testing | Core Firestore CRUD                     | ~25             |
| 3        | Storage & RTDB Tester         | 1    | Testing | Storage + Realtime DB                   | ~25             |
| 4        | LevelUp Services Tester       | 1    | Testing | Course, StoryPoint, Content, Items      | ~35             |
| 5        | Progress & Leaderboard Tester | 1    | Testing | Progress, Leaderboard, TimedTest        | ~35             |
| 6        | Org & Chat Services Tester    | 1    | Testing | Orgs, Chat, Agents, Metrics, Practice   | ~30             |
| 7        | Callable & AutoGrade Tester   | 1    | Testing | Callables, AutoGrade, AI, Utils         | ~55             |
| 8        | Zustand Stores Tester         | 2    | Testing | auth-store, tenant-store, ui-store      | ~20             |
| 9        | Shared Hooks Tester           | 2    | Testing | useAuth, useFirestore\*, RTDB, UI hooks | ~25             |
| 10       | TanStack Query Hooks Tester   | 2    | Testing | 20+ query hooks                         | ~25             |
| 11       | Teacher Web UI Builder        | 3    | UI/UX   | teacher-web complete UI                 | N/A             |
| 12       | Student Web UI Builder        | 3    | UI/UX   | student-web complete UI                 | N/A             |
| 13       | Admin & Parent Web Builder    | 3    | UI/UX   | admin-web + parent-web + super-admin    | N/A             |
| 14       | Shared UI Components          | 3    | UI/UX   | Reusable components                     | N/A             |

**Total Workers:** 14 (10 testing + 4 UI/UX) **Total Test Cases:** ~305
**Execution:** Wave 1 + Wave 3 start in parallel. Wave 2 starts when Wave 1 is
~50% done.

---

## 5. Testing Strategy

### Unit Tests (Vitest)

- Mock Firebase SDK for pure unit tests
- Test service logic, data transformations, error handling
- File naming: `*.test.ts`

### Integration Tests (Vitest + Firebase Emulator OR Live)

- Test against actual Firebase (or emulator if available)
- Verify Firestore reads/writes, Auth flows, Storage uploads
- File naming: `*.integration.test.ts`
- Use existing `emulator-setup.ts` pattern from
  `packages/shared-services/src/__tests__/`

### Test Infrastructure

- **Framework:** Vitest (already configured)
- **Coverage target:** 60% minimum (per vitest.config.base.ts)
- **React testing:** @testing-library/react for hooks
- **Mocking:** vitest mocking (`vi.mock`)
- **Firebase:** Use Firebase emulators for integration tests where possible

---

## 6. Dependencies & Execution Order

```
Wave 1 (Testing): Workers 1-7 start immediately in parallel
                   ↓ (50% complete)
Wave 2 (State):   Workers 8-10 start (depend on Wave 1 patterns)

Wave 3 (UI/UX):   Workers 11-14 start immediately in parallel with Wave 1
                   (UI work is independent of testing)
```

---

## 7. Success Criteria

- [ ] All 305+ test cases passing
- [ ] 60%+ code coverage on tested packages
- [ ] All new app pages rendering correctly
- [ ] Teacher-web: full CRUD for spaces, exams, grading review
- [ ] Student-web: full learning experience with all 16 question types
- [ ] Admin-web: tenant management, user management, analytics
- [ ] Parent-web: child progress view, notifications
- [ ] Super-admin: multi-tenant oversight

---

## 8. Communication Protocol

1. Each worker reports completion via maestro task updates
2. Workers encountering blockers report immediately
3. Architect Lead reviews completed test suites
4. UI workers can reference existing LevelUp-App code as patterns
5. All workers use the consolidated callable API types from
   `@levelup/shared-types`
