# 02 — Teacher Journey (`apps/teacher-web`)

**Port:** `4569` (`vite.config.ts`, `host: "127.0.0.1"`, `strictPort: true`)  
**Local URL:** http://127.0.0.1:4569  
**Allowed roles:** `teacher`, `tenantAdmin`  
**Credentials:** see [`TEST_CREDENTIALS.md`](../../TEST_CREDENTIALS.md) (e.g. `priya.sharma@greenwood.edu` / `Test@12345` / school `GRN001`)

---

## Login start (exact steps)

1. Open http://127.0.0.1:4569/login
2. **School code** → `useLookupTenantByCode` + `evaluateTenantAccess`
3. **Email + password** → `loginWithSchoolCode(schoolCode, email, password)` via `useAuthSession()`
4. Resolve tenant membership → switch active tenant → navigate `from` or `/`

### Session

- Owned by `<SessionProvider>` in `main.tsx` (Firebase auth handle + `useMe()` → **`v1.identity.getMe`**)
- Tenant switch: `meRepo.switchTenant` → **`v1.identity.switchActiveTenant`** + token refresh
- React Query cache reset on tenant switch (SDK pattern)

---

## Guards / empty & error states

| Condition | Behavior |
|-----------|----------|
| Loading | Centered “Loading...” |
| No auth | Redirect `/login` with `from` |
| Wrong role | Inline **Access Denied** (no consumer redirect) |
| Unknown route | `NotFoundPage` |

---

## Full route tree (`App.tsx`)

| Path | Page | Purpose |
|------|------|---------|
| `/login` | LoginPage | Auth |
| `/` | DashboardPage | Teacher home / overview |
| `/spaces` | SpaceListPage | List learning spaces |
| `/spaces/:spaceId/edit` | SpaceEditorPage | Author story points & items |
| `/spaces/:spaceId/story-points/:storyPointId/preview` | TestPreviewPage | Preview timed test as teacher |
| `/question-bank` | QuestionBankPage | Tenant question bank CRUD |
| `/rubric-presets` | RubricPresetsPage | Reusable rubrics |
| `/exams` | ExamListPage | Paper / autograde exams |
| `/exams/new` | ExamCreatePage | Create exam + QP upload |
| `/exams/:examId` | ExamDetailPage | Review AI rubric, publish, release |
| `/exams/:examId/submissions` | SubmissionsPage | Upload sheets, pipeline status |
| `/exams/:examId/submissions/:submissionId` | GradingReviewPage | AI + manual grade review |
| `/classes` | ClassesPage | Teacher’s classes |
| `/classes/:classId` | ClassDetailPage | Roster / class detail |
| `/analytics/classes` | ClassAnalyticsPage | Class metrics |
| `/analytics/exams` | ExamAnalyticsPage | Exam metrics |
| `/analytics/spaces` | SpaceAnalyticsPage | Space metrics |
| `/analytics/tests` | ClassTestAnalyticsPage | Class test analytics (**routed; not in sidebar**) |
| `/assignments` | AssignmentTrackerPage | Exam / assignment pipeline board |
| `/grading` | BatchGradingPage | Batch grading queue |
| `/students` | StudentsPage | Student list |
| `/students/:studentId/report` | StudentReportPage | Per-student report / PDF |
| `/settings` | SettingsPage | Teacher settings |
| `/notifications` | NotificationsPage | Inbox (bell; not sidebar primary) |

---

## Sidebar nav (`AppLayout.tsx`)

| Group | Label | Path |
|-------|-------|------|
| **Overview** | Dashboard | `/` |
| **Content** | Spaces | `/spaces` |
| | Question Bank | `/question-bank` |
| | Exams | `/exams` |
| | Rubric Presets | `/rubric-presets` |
| | Assignments | `/assignments` |
| | Batch Grading | `/grading` |
| **Analytics** | Class Analytics | `/analytics/classes` |
| | Exam Analytics | `/analytics/exams` |
| | Space Analytics | `/analytics/spaces` |
| **People** | Classes | `/classes` |
| | Students | `/students` |
| **System** | Settings | `/settings` |

**Mobile bottom nav:** Home `/` · Spaces `/spaces` · Exams `/exams` · Students `/students` · Analytics `/analytics/classes`

**Footer:** `RoleSwitcher` (teacher + tenantAdmin memberships) + Sign Out

---

## Major screens + primary mutations

| Screen | Purpose | Primary CTAs / callables |
|--------|---------|--------------------------|
| SpaceList / SpaceEditor | Author spaces, story points, items | `saveSpace` · `saveStoryPoint` · `saveItem` · `createItem` · `importFromBank` · publish/archive |
| QuestionBank | Tenant bank CRUD | `saveQuestionBankItem` · `listQuestionBank` |
| RubricPresets | Reusable rubrics | `saveRubricPreset` |
| ExamCreate | New exam + question paper | `saveExam` · Storage `requestUploadUrl` |
| ExamDetail | AI rubric review, publish, release | `extractQuestions` · `saveExam` · `releaseResults` |
| Submissions | Answer sheets + pipeline | `uploadAnswerSheets` · `releaseResults` |
| GradingReview / BatchGrading | AI + manual review | `gradeQuestion` · manual overrides |
| AssignmentTracker | Pipeline status board | Read aggregation |
| ClassDetail | Roster | `saveStudent` · `saveClass` (as permitted) |
| StudentReport | Per-student PDF | `v1.analytics.generateReport` |
| Analytics pages | Class/exam/space/tests | `getSummary` / analytics hooks |
| Notifications | Inbox | `manageNotifications` |

---

## AI on this journey (heaviest role)

| Feature | Callable / pipeline | Model tier |
|---------|---------------------|------------|
| Extract questions from QP (vision) | `v1.autograde.extractQuestions` | **pro** |
| Answer mapping after upload | pipeline `process-answer-mapping` | **flash** |
| RELMS grading | pipeline + `v1.autograde.gradeQuestion` | **pro** |
| Content drafts | `v1.levelup.generateContent` | content draft prompt |
| Insights / at-risk on analytics | schedulers + `getSummary` | **rule engines — no LLM** |

Teacher must **review** AI grades before **`releaseResults`**. Students and parents only see released results.

---

## How teacher connects to other roles

| Connection | Mechanism |
|------------|-----------|
| Admin provisions classes / teachers / students | Memberships, `classIds`, permissions claims |
| Student learns from teacher spaces / tests | Student `/spaces`, `/tests` |
| Student + parent see exam results | After `releaseResults` |
| Admin oversight | Exams/spaces overview, AI usage, analytics |
| Super-admin | Platform LLM usage / tenants — not teacher UI |

**In-app portal links to other role apps:** not present.
