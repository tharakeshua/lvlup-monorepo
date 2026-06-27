# Core App Logic — Implementation Plan

## Unified LevelUp + AutoGrade B2B SaaS Platform

**Date:** 2026-02-24 **Status:** Approved — Ready for Implementation **Scope:**
Full-stack (shared types + Cloud Functions + all 5 app frontends + real Gemini
AI)

---

## Design Decisions (Locked)

| Decision                   | Choice                                                                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Scope                      | Full stack — types, functions, all 5 apps                                                                                        |
| RubricCriterion schema     | LevelUp's rich version: `id, name, description, maxPoints, weight, levels[]`                                                     |
| EvaluationDimension schema | AutoGrade's full version: `icon, priority, promptGuidance, enabled, isDefault, isCustom, ...` + LevelUp's `weight, scoringScale` |
| AI integration             | Real Gemini API integration (not stubs)                                                                                          |
| Grading pipeline           | Firestore triggers (works with emulator, no Cloud Tasks dependency)                                                              |
| State management           | Zustand (client state) + TanStack Query (server state)                                                                           |
| Routing                    | React Router v7                                                                                                                  |
| Legacy code                | Fresh build, ignore LevelUp-App/ and autograde/ directories                                                                      |
| Teacher UX                 | Unified sidebar: Dashboard, Spaces, Exams, Students, Analytics, Settings                                                         |
| Scanner app                | Deferred — web upload only for now                                                                                               |
| Dual scoring               | Both `maxMarks` and `totalPoints` always available on items                                                                      |
| Real-time                  | Core CRUD first; RTDB leaderboards/live progress as follow-up                                                                    |

---

## Implementation Phases

### Phase A: Shared Types Package (Foundation)

**Owner:** Architect Lead **Depends on:** Identity types (already done)

1. **Content types** — `packages/shared-types/src/content/`
   - `rubric.ts` — UnifiedRubric, RubricCriterion, EvaluationDimension,
     RubricScoringMode
   - `item.ts` — UnifiedItem, ItemType, ItemPayload, all 15 question subtypes, 7
     material subtypes, InteractivePayload, AssessmentPayload,
     DiscussionPayload, ProjectPayload, CheckpointPayload
   - `item-metadata.ts` — ItemMetadata, ItemAnalytics, BloomsLevel
   - `evaluation.ts` — UnifiedEvaluationResult, RubricBreakdownItem,
     FeedbackItem

2. **LevelUp types** — `packages/shared-types/src/levelup/`
   - `space.ts` — Space, SpaceType
   - `story-point.ts` — StoryPoint, StoryPointType, StoryPointSection
   - `agent.ts` — Agent, AgentType, EvaluationObjective
   - `test-session.ts` — DigitalTestSession, TestSessionStatus, TestSubmission,
     TestAnalytics
   - `progress.ts` — SpaceProgress, StoryPointProgress, ItemProgressEntry,
     PracticeProgress
   - `chat.ts` — ChatSession, ChatMessage

3. **AutoGrade types** — `packages/shared-types/src/autograde/`
   - `exam.ts` — Exam, ExamStatus, ExamGradingConfig
   - `exam-question.ts` — ExamQuestion, SubQuestion
   - `submission.ts` — Submission, SubmissionPipelineStatus
   - `question-submission.ts` — QuestionSubmission, QuestionGradingStatus
   - `evaluation-settings.ts` — EvaluationFeedbackRubric (EvaluationSettings)
   - `dead-letter.ts` — GradingDeadLetterEntry
   - `exam-analytics.ts` — ExamAnalytics

4. **Shared enums & constants** — `packages/shared-types/src/constants/`
   - `grades.ts` — Grade calculation helpers
   - `pipeline-status.ts` — Pipeline status constants

### Phase B: Cloud Functions — AutoGrade Pipeline

**Owner:** AutoGrade Engineer **Depends on:** Phase A

Directory: `functions/autograde/`

1. **Callable functions:**
   - `createExam` — Exam CRUD with validation
   - `updateExam` — Update exam metadata
   - `extractQuestions` — Upload question paper → Gemini extraction →
     ExamQuestion docs
   - `publishExam` — Status transition with validation
   - `uploadAnswerSheets` — Create Submission doc, trigger pipeline
   - `retryFailedQuestions` — Re-enqueue failed question grading
   - `manualGradeQuestion` — Teacher grade override with reason
   - `releaseExamResults` — Batch update resultsReleased
   - `deleteExam` — Soft delete / archive

2. **Trigger functions:**
   - `onSubmissionCreated` — Pipeline kickoff: start scouting
   - `onSubmissionUpdated` — Pipeline state machine transitions
   - `onQuestionSubmissionUpdated` — Check if all questions graded → finalize

3. **Pipeline workers (called by triggers):**
   - `processAnswerMapping` — Panopticon scouting (Gemini call)
   - `processAnswerGrading` — RELMS grading per question (Gemini call)
   - `finalizeSubmission` — Aggregate scores, calculate grade

4. **AI prompts:**
   - `prompts/extraction.ts` — Question extraction prompt
   - `prompts/panopticon.ts` — Scouting system + user prompt
   - `prompts/relms.ts` — Dynamic RELMS evaluation prompt builder

### Phase C: Cloud Functions — LevelUp

**Owner:** LevelUp Engineer **Depends on:** Phase A

Directory: `functions/levelup/`

1. **Callable functions:**
   - `createSpace` — Space CRUD
   - `updateSpace` — Update space metadata
   - `publishSpace` — Validate and publish
   - `archiveSpace` — Archive with session cleanup
   - `createStoryPoint` — StoryPoint CRUD
   - `updateStoryPoint` — With reorder support
   - `createItem` / `updateItem` / `deleteItem` — UnifiedItem CRUD
   - `startTestSession` — Create DigitalTestSession, enforce timer
   - `submitTestSession` — Server-validate timing, grade auto-evaluated
     questions
   - `evaluateAnswer` — AI evaluation for paragraph/text/code questions (Gemini
     call)
   - `recordItemAttempt` — Update SpaceProgress
   - `sendChatMessage` — AI tutor chat (Gemini call)

2. **Trigger functions:**
   - `onTestSessionExpired` — Scheduled: find & auto-submit stale sessions
   - `onSpaceDeleted` — Cascade cleanup

3. **AI prompts:**
   - `prompts/evaluator.ts` — Answer evaluation prompt
   - `prompts/tutor.ts` — AI tutor system prompt builder

### Phase D: Shared AI Infrastructure

**Owner:** Analytics Intelligence Engineer **Depends on:** Phase A

Directory: `packages/shared-services/src/ai/`

1. `llm-wrapper.ts` — LLMWrapper class (Gemini API, structured output, retry,
   logging)
2. `secret-manager.ts` — GCP Secret Manager key retrieval
3. `llm-logger.ts` — LLM call logging to Firestore `llmCallLogs`
4. `cost-tracker.ts` — Token counting and cost estimation

### Phase E: Frontend — Shared Infrastructure

**Owner:** Frontend Apps Engineer **Depends on:** Phase A

1. **Zustand stores** — `packages/shared-hooks/src/stores/`
   - `auth-store.ts` — Auth state, active tenant, user profile
   - `tenant-store.ts` — Active tenant context
   - `ui-store.ts` — Sidebar state, modals, toasts

2. **TanStack Query hooks** — `packages/shared-hooks/src/queries/`
   - `useSpaces.ts`, `useSpace.ts` — Space queries
   - `useExams.ts`, `useExam.ts` — Exam queries
   - `useItems.ts` — Item queries with pagination
   - `useSubmissions.ts` — Submission queries
   - `useProgress.ts` — Space progress queries

3. **Shared layout components** — `packages/shared-ui/src/components/layout/`
   - `AppShell.tsx` — Sidebar + header + content area
   - `Sidebar.tsx` — Role-aware navigation sidebar
   - `RoleSwitcher.tsx` — Tenant/role context switcher

4. **React Router setup** per app

### Phase F: Teacher Web (Primary Authoring Surface)

**Owner:** Frontend Apps Engineer + LevelUp Engineer + AutoGrade Engineer
**Depends on:** Phase B, C, E

`apps/teacher-web/src/`

1. **Spaces section:**
   - Space list page (with status filters)
   - Space editor (settings, story points, items, agents, publish controls)
   - Item type editors (all 15 question types + 7 material types)
   - Rubric editor component

2. **Exams section:**
   - Exam list page
   - Exam creation wizard
   - Question paper upload + AI extraction review
   - Rubric editing per question
   - Submission management (upload answer sheets, view pipeline status)
   - Grading review (per-question, override, bulk actions)
   - Result release controls

3. **Dashboard:**
   - Recent spaces & exams
   - Grading queue (submissions needing review)
   - Quick stats

### Phase G: Student Web

**Owner:** Frontend Apps Engineer + LevelUp Engineer **Depends on:** Phase C, E

`apps/student-web/src/`

1. Space viewer (home, story point viewer, material reader)
2. Question answerer (all 15 question types)
3. Timed test runner (5-status navigator, timer, auto-submit)
4. Practice mode
5. Interactive quiz
6. AI tutor chat panel
7. Exam results viewer (when released)
8. Progress dashboard

### Phase H: Admin Web, Parent Web, Super Admin

**Owner:** Frontend Apps Engineer **Depends on:** Phase E, F, G

1. **Admin web:** Tenant management, user management, class management,
   analytics overview
2. **Parent web:** Child's progress view, exam results, notifications
3. **Super admin:** Multi-tenant oversight, global settings

---

## Task Assignments by Team Member

| Team Member                         | Primary Tasks                                            | Phase      |
| ----------------------------------- | -------------------------------------------------------- | ---------- |
| **Architect Lead**                  | Phase A (shared types), coordination, reviews            | A          |
| **AutoGrade Engineer**              | Phase B (AutoGrade functions), teacher-web exam section  | B, F       |
| **LevelUp Engineer**                | Phase C (LevelUp functions), teacher-web spaces section  | C, F       |
| **Analytics Intelligence Engineer** | Phase D (AI infrastructure, LLMWrapper)                  | D          |
| **Frontend Apps Engineer**          | Phase E (shared frontend infra), Phase F-H (all app UIs) | E, F, G, H |

---

## Implementation Order

```
Week 1:  Phase A (types) + Phase D (AI infra) — in parallel
Week 2:  Phase B (AutoGrade CF) + Phase C (LevelUp CF) — in parallel
Week 3:  Phase E (frontend infra) + start Phase F (teacher-web)
Week 4:  Phase F (teacher-web complete) + Phase G (student-web)
Week 5:  Phase H (admin, parent, super-admin) + integration testing
```

---

## File Structure (New Files)

```
packages/shared-types/src/
├── identity/          (EXISTS)
├── content/
│   ├── rubric.ts
│   ├── item.ts
│   ├── item-metadata.ts
│   ├── evaluation.ts
│   └── index.ts
├── levelup/
│   ├── space.ts
│   ├── story-point.ts
│   ├── agent.ts
│   ├── test-session.ts
│   ├── progress.ts
│   ├── chat.ts
│   └── index.ts
├── autograde/
│   ├── exam.ts
│   ├── exam-question.ts
│   ├── submission.ts
│   ├── question-submission.ts
│   ├── evaluation-settings.ts
│   ├── dead-letter.ts
│   ├── exam-analytics.ts
│   └── index.ts
├── constants/
│   ├── grades.ts
│   └── index.ts
└── index.ts

functions/
├── identity/          (EXISTS)
├── autograde/
│   ├── src/
│   │   ├── callable/
│   │   ├── triggers/
│   │   ├── workers/
│   │   ├── prompts/
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
└── levelup/
    ├── src/
    │   ├── callable/
    │   ├── triggers/
    │   ├── prompts/
    │   └── index.ts
    ├── package.json
    └── tsconfig.json

packages/shared-services/src/
├── ai/
│   ├── llm-wrapper.ts
│   ├── secret-manager.ts
│   ├── llm-logger.ts
│   └── index.ts
└── ... (existing)

packages/shared-hooks/src/
├── stores/
│   ├── auth-store.ts
│   ├── tenant-store.ts
│   └── ui-store.ts
├── queries/
│   ├── useSpaces.ts
│   ├── useExams.ts
│   ├── useItems.ts
│   ├── useSubmissions.ts
│   └── useProgress.ts
└── ... (existing)
```
