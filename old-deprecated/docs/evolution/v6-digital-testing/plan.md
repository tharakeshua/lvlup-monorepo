# V6: Digital Testing & Assessment — Evolution Plan

**Cycle:** 1 **Vertical:** V6 — Digital Testing & Assessment **Engineer:**
Learning Engineer **Dependencies:** V4 (Learning Platform) ✅, V5 (AutoGrade &
AI Pipeline) ✅ — both complete **Status:** Planning → Implementation

---

## Audit Summary

### Current State

The digital testing infrastructure is **functionally complete** with:

- `DigitalTestSession` type tracking student test/quiz/practice attempts
- `startTestSession` callable with session creation, max attempts, shuffling,
  resume
- `submitTestSession` callable with auto-evaluation, AI evaluation trigger,
  progress update
- `TimedTestPage.tsx` with question navigator, countdown timer, keyboard
  navigation
- `TestsPage.tsx` listing available tests across enrolled spaces
- 15 question types supported (9 auto-evaluatable + 6 AI-evaluatable)
- `QuestionNavigator` + `CountdownTimer` components
- 5-status question tracking (not_visited, not_answered, answered,
  marked_for_review, answered_and_marked)
- Per-question time tracking and analytics
- Rubric system with 4 scoring modes and inheritance chain
- `UnifiedEvaluationResult` with structured feedback

### Gaps Identified

1. **Section Navigation**: `StoryPoint.sections` exist but are unused in test
   flow. No section-based navigation or grouping in `TimedTestPage`.

2. **Timer Polish**: CountdownTimer works but lacks urgency indicators (color
   shift at 5min/1min), and auto-submit doesn't save pending (unsaved) answers
   before submitting.

3. **Question Bank**: No reusable question bank. Questions are created directly
   within story points with no way to browse, search, or reuse across spaces. No
   Bloom's taxonomy tagging on items.

4. **Evaluation Presets**: Rubrics exist but no preset/template system. Teachers
   must configure rubrics from scratch each time. No quick-apply for common
   patterns.

5. **Student Analytics**: Basic results view exists (percentage, points,
   per-question breakdown, topic analysis). No attempt-over-attempt comparison,
   no time analysis visualization, no learning progression charts.

6. **Adaptive Testing**: No difficulty-based question selection. All questions
   are served in fixed or shuffled order regardless of student performance.

7. **Test Management (Teacher)**: No dedicated test/quiz management page. Tests
   are created as story point types within spaces, but teachers lack a unified
   view of all tests and their results.

---

## Implementation Plan

### Module 1: Test Session Lifecycle Polish (Functions + Student Web)

**Files to modify:**

- `functions/levelup/src/callable/start-test-session.ts` — return section
  mapping
- `functions/levelup/src/callable/submit-test-session.ts` — pre-submit answer
  save, analytics computation
- `apps/student-web/src/pages/TimedTestPage.tsx` — section nav, resume position,
  auto-submit improvement
- `apps/student-web/src/components/test/QuestionNavigator.tsx` — section
  grouping
- `packages/shared-types/src/levelup/test-session.ts` — add section tracking
  fields

**Changes:**

1. **Section-based navigation** in `TimedTestPage.tsx`:
   - Group questions by `sectionId` in the QuestionNavigator
   - Add section tabs/headers showing section title and progress
     (answered/total)
   - Allow jumping to first question of a section
   - Show current section label in the timer bar

2. **Resume to last position**:
   - On session resume, set `currentIndex` to the last visited (or first
     unanswered) question
   - Store `lastVisitedIndex` in session doc for accurate resume

3. **Auto-submit answer save**:
   - Before auto-submit on timeout, save any pending unsaved answer to the
     session
   - In `handleTimeUp`, call `saveAnswer` for the current question if modified,
     then submit

4. **Enhanced analytics computation** in `submitTestSession`:
   - Compute `sectionBreakdown` alongside existing `topicBreakdown`
   - Add `averageTimePerQuestion` to TestAnalytics
   - Compute `difficultyBreakdown` using item difficulty metadata

5. **Types update** (`test-session.ts`):
   - Add
     `sectionBreakdown?: Record<string, { correct: number; total: number; points: number; maxPoints: number }>`
     to `TestAnalytics`
   - Add `averageTimePerQuestion?: number` to `TestAnalytics`
   - Add `lastVisitedIndex?: number` to `DigitalTestSession`
   - Add `sectionMapping?: Record<string, string>` to `DigitalTestSession`
     (itemId → sectionId)

### Module 2: Timer Enhancement (Student Web Components)

**Files to modify:**

- `apps/student-web/src/components/test/CountdownTimer.tsx` — urgency indicators

**Changes:**

1. **Urgency color indicators**:
   - Green (> 5 min remaining)
   - Amber with gentle pulse (1–5 min remaining)
   - Red with faster pulse (< 1 min remaining)
   - Use CSS animation classes, no Framer Motion dependency

2. **Better time display**:
   - Show "HH:MM:SS" format for > 1 hour
   - Show "MM:SS" for < 1 hour
   - Flash seconds when < 30 seconds

3. **Warning callbacks**:
   - Add optional `onWarning` callback at configurable thresholds (5min, 1min)
   - Show toast notification at 5-minute and 1-minute marks

### Module 3: Question Bank (Types + Functions + Teacher Web)

**Files to create:**

- `packages/shared-types/src/levelup/question-bank.ts` — QuestionBankItem type
- `functions/levelup/src/callable/save-question-bank-item.ts` — CRUD callable
- `functions/levelup/src/callable/list-question-bank.ts` — search/filter
  callable
- `apps/teacher-web/src/pages/spaces/QuestionBankPage.tsx` — question bank UI

**Files to modify:**

- `packages/shared-types/src/schemas/callable-schemas.ts` — add schemas
- `packages/shared-types/src/index.ts` — export new types
- `packages/shared-types/src/content/item.ts` — add `bloomsLevel` to
  `QuestionPayload`
- `functions/levelup/src/index.ts` — export new callables
- `apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx` — "Import from Bank"
  button

**Changes:**

1. **QuestionBankItem type** (`question-bank.ts`):

   ```typescript
   interface QuestionBankItem {
     id: string;
     tenantId: string;
     // Question content (same structure as QuestionPayload)
     questionType: QuestionType;
     title?: string;
     content: string;
     questionData: QuestionTypeData;
     // Classification
     subject: string;
     topics: string[];
     difficulty: "easy" | "medium" | "hard";
     bloomsLevel?: BloomsLevel;
     // Usage tracking
     usageCount: number;
     averageScore?: number;
     lastUsedAt?: FirestoreTimestamp;
     // Metadata
     tags: string[];
     createdBy: string;
     createdAt: FirestoreTimestamp;
     updatedAt: FirestoreTimestamp;
   }
   ```

   Collection: `/tenants/{tenantId}/questionBank/{itemId}`

2. **Save question bank item callable** (`save-question-bank-item.ts`):
   - Create/update question bank items (save\* pattern)
   - Support "Save to Bank" action from space editor (clone item to bank)
   - Support "Import from Bank" (clone bank item to story point as UnifiedItem)

3. **List/search question bank callable** (`list-question-bank.ts`):
   - Filter by: subject, topic, difficulty, bloomsLevel, questionType, tags
   - Search by title/content text
   - Sort by: usageCount, averageScore, createdAt
   - Paginated with cursor

4. **Question bank UI** (`QuestionBankPage.tsx`):
   - Searchable, filterable grid/list of bank questions
   - Filters: subject, difficulty, Bloom's level, question type
   - Preview question on click
   - "Add to Space" action (select target space + story point)
   - "Edit" and "Delete" actions
   - Bulk import from space (copy all questions from a story point to bank)

5. **Bloom's taxonomy on items** (`item.ts`):
   - Add `bloomsLevel?: BloomsLevel` to `QuestionPayload`
   - Already have `BLOOMS_LEVELS` constant in `constants/grades.ts`

6. **Import from Bank in SpaceEditorPage**:
   - Add "Import from Question Bank" button in story point item list
   - Opens a picker dialog showing bank questions with filters
   - Selected questions are cloned as UnifiedItems into the story point

### Module 4: Evaluation Presets (Types + Functions + Teacher Web)

**Files to create:**

- `packages/shared-types/src/content/rubric-preset.ts` — RubricPreset type
- `functions/levelup/src/callable/save-rubric-preset.ts` — CRUD callable
- `apps/teacher-web/src/components/rubric/RubricPresetPicker.tsx` — preset
  picker

**Files to modify:**

- `packages/shared-types/src/schemas/callable-schemas.ts` — add schema
- `packages/shared-types/src/index.ts` — export new types
- `functions/levelup/src/index.ts` — export new callable
- `apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx` — integrate preset
  picker into rubric editor

**Changes:**

1. **RubricPreset type** (`rubric-preset.ts`):

   ```typescript
   interface RubricPreset {
     id: string;
     tenantId: string;
     name: string;
     description?: string;
     // The rubric template
     rubric: UnifiedRubric;
     // Classification
     category:
       | "general"
       | "math"
       | "science"
       | "language"
       | "coding"
       | "essay"
       | "custom";
     questionTypes?: QuestionType[]; // which question types this preset is suitable for
     isDefault: boolean; // system-provided vs teacher-created
     // Audit
     createdBy: string;
     createdAt: FirestoreTimestamp;
     updatedAt: FirestoreTimestamp;
   }
   ```

   Collection: `/tenants/{tenantId}/rubricPresets/{presetId}`

2. **Save rubric preset callable** (`save-rubric-preset.ts`):
   - Create/update/delete rubric presets
   - Seed default presets per tenant (general, math, essay, coding)
   - Support "Save as Preset" from existing rubric configuration

3. **Preset picker component** (`RubricPresetPicker.tsx`):
   - Dropdown/dialog showing available presets
   - Filter by category and suitable question types
   - Preview rubric criteria/dimensions on hover
   - "Apply" button fills the rubric editor with preset values
   - "Save Current as Preset" button for saving custom rubrics

4. **Integration into SpaceEditorPage**:
   - Add "Apply Preset" button next to rubric editor at storyPoint and item
     level
   - Show preset name badge if rubric was applied from a preset

### Module 5: Student Analytics Enhancement (Student Web)

**Files to create:**

- `apps/student-web/src/pages/TestAnalyticsPage.tsx` — detailed test analytics
- `apps/student-web/src/components/analytics/AttemptComparison.tsx` — attempt
  comparison

**Files to modify:**

- `apps/student-web/src/pages/TimedTestPage.tsx` — link to analytics from
  results
- `apps/student-web/src/pages/DashboardPage.tsx` — enhanced analytics cards

**Changes:**

1. **Test Analytics Page** (`TestAnalyticsPage.tsx`):
   - Shows all attempts for a specific test (story point)
   - Attempt-over-attempt score progression chart (line chart)
   - Topic breakdown with bar chart (correct/total per topic)
   - Difficulty breakdown (easy/medium/hard performance)
   - Time analysis: average time per question, time vs. correctness scatter
   - Section-wise performance (if sections exist)
   - Bloom's level performance breakdown
   - Best attempt highlight

2. **Attempt comparison component** (`AttemptComparison.tsx`):
   - Side-by-side comparison of 2 selected attempts
   - Per-question delta (improved/declined/same)
   - Score trend visualization

3. **Enhanced results view in TimedTestPage**:
   - Add "View Detailed Analytics" link from results view
   - Show improvement indicator if score improved vs. previous attempt
   - Show section-wise breakdown in results (using new sectionBreakdown)

4. **Dashboard enhancements** (`DashboardPage.tsx`):
   - Add "Recent Test Performance" card with mini trend chart
   - Show topic-level strengths/weaknesses from aggregated test data
   - "Practice Recommendations" based on weak topics

### Module 6: Adaptive Testing Foundation (Types + Functions)

**Files to modify:**

- `packages/shared-types/src/levelup/story-point.ts` — add AdaptiveConfig
- `packages/shared-types/src/levelup/test-session.ts` — add adaptive tracking
- `functions/levelup/src/callable/start-test-session.ts` — adaptive question
  ordering
- `functions/levelup/src/callable/submit-test-session.ts` — adaptive analytics
- `apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx` — adaptive config UI
  toggle

**Changes:**

1. **AdaptiveConfig** on `AssessmentConfig`:

   ```typescript
   interface AdaptiveConfig {
     enabled: boolean;
     initialDifficulty: "easy" | "medium" | "hard";
     difficultyAdjustment: "gradual" | "aggressive";
     minQuestionsPerDifficulty?: number;
   }
   ```

2. **Adaptive question ordering** in `startTestSession`:
   - When `adaptiveConfig.enabled`, sort questions by difficulty starting from
     `initialDifficulty`
   - Group questions by difficulty: easy → medium → hard (or reverse based on
     config)
   - Shuffle within each difficulty group
   - Store `difficultyOrder` in session for analytics

3. **Adaptive tracking** in session:
   - Add `currentDifficultyLevel?: string` to track adaptive state
   - Add
     `difficultyProgression?: Array<{ questionIndex: number; difficulty: string; correct: boolean }>`
     for visualizing adaptation

4. **Teacher config UI**:
   - Add "Adaptive Testing" toggle in story point assessment config
   - Show difficulty distribution when adaptive is enabled
   - Require questions to have difficulty metadata set

---

## Implementation Order

1. **Module 1** — Test Session Lifecycle Polish (foundation for all other
   modules)
2. **Module 2** — Timer Enhancement (quick win, no dependencies)
3. **Module 3** — Question Bank (new feature, builds on V4 content model)
4. **Module 4** — Evaluation Presets (builds on existing rubric system)
5. **Module 5** — Student Analytics (depends on Module 1 analytics)
6. **Module 6** — Adaptive Testing (depends on Module 3 difficulty tagging)

## Files Created (New)

| File                                                              | Purpose                        |
| ----------------------------------------------------------------- | ------------------------------ |
| `packages/shared-types/src/levelup/question-bank.ts`              | QuestionBankItem type          |
| `packages/shared-types/src/content/rubric-preset.ts`              | RubricPreset type              |
| `functions/levelup/src/callable/save-question-bank-item.ts`       | Question bank CRUD             |
| `functions/levelup/src/callable/list-question-bank.ts`            | Question bank search/filter    |
| `functions/levelup/src/callable/save-rubric-preset.ts`            | Rubric preset CRUD             |
| `apps/teacher-web/src/pages/spaces/QuestionBankPage.tsx`          | Question bank management UI    |
| `apps/student-web/src/pages/TestAnalyticsPage.tsx`                | Detailed test analytics        |
| `apps/student-web/src/components/analytics/AttemptComparison.tsx` | Attempt comparison component   |
| `apps/teacher-web/src/components/rubric/RubricPresetPicker.tsx`   | Rubric preset picker component |

## Files Modified (Existing)

| File                                                         | Changes                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------- |
| `packages/shared-types/src/levelup/test-session.ts`          | Section breakdown, adaptive tracking, lastVisitedIndex        |
| `packages/shared-types/src/levelup/story-point.ts`           | AdaptiveConfig on AssessmentConfig                            |
| `packages/shared-types/src/content/item.ts`                  | bloomsLevel on QuestionPayload                                |
| `packages/shared-types/src/schemas/callable-schemas.ts`      | New Zod schemas for bank/preset callables                     |
| `packages/shared-types/src/index.ts`                         | Export new types                                              |
| `functions/levelup/src/callable/start-test-session.ts`       | Section mapping, adaptive ordering, lastVisitedIndex          |
| `functions/levelup/src/callable/submit-test-session.ts`      | Section/difficulty analytics, auto-submit improvements        |
| `functions/levelup/src/index.ts`                             | Export new callables                                          |
| `apps/student-web/src/pages/TimedTestPage.tsx`               | Section nav, resume position, auto-submit fix, analytics link |
| `apps/student-web/src/components/test/CountdownTimer.tsx`    | Urgency colors, pulse animations, warning callbacks           |
| `apps/student-web/src/components/test/QuestionNavigator.tsx` | Section grouping                                              |
| `apps/student-web/src/pages/DashboardPage.tsx`               | Enhanced analytics cards                                      |
| `apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx`      | Import from bank, preset picker, adaptive toggle              |

## Coding Standards

- TypeScript strict mode, zero `any`
- Use existing Zod schemas and branded types from `@levelup/shared-types`
- Follow existing patterns: `HttpsError` for callable errors, `admin.firestore`
  for DB access
- All new types exported from `@levelup/shared-types`
- Use shadcn/ui components from `@levelup/shared-ui`
- Non-blocking logging (fire-and-forget for audit logs)
- Rate limit all new callables using existing `enforceRateLimit` utility
- Must pass `pnpm build` and `pnpm lint`

## Acceptance Criteria

- [ ] Test session supports section-based navigation with question grouping
- [ ] Timer shows urgency indicators (green → amber → red) with pulse animation
- [ ] Auto-submit saves pending answer before submission
- [ ] Session resume returns to last visited question
- [ ] Question bank CRUD works: create, update, delete, search, filter
- [ ] Questions can be tagged with difficulty + Bloom's level
- [ ] Import from question bank to story point works
- [ ] Rubric presets can be created, listed, applied to story points/items
- [ ] Default rubric presets seeded for common categories
- [ ] Student analytics page shows attempt comparison and topic breakdown
- [ ] Adaptive testing config available on assessment story points
- [ ] Adaptive question ordering uses difficulty-based selection
- [ ] `pnpm build` passes with zero errors
- [ ] `pnpm lint` passes with zero new errors
