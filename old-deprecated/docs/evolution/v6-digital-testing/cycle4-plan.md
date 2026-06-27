# V6 Digital Testing & Assessment — Cycle 4 Plan

**Cycle:** 4 **Vertical:** V6 — Digital Testing & Assessment **Engineer:**
Learning Engineer **Current Completion:** ~87% (after Cycle 3) **Target
Completion:** ~95% **Status:** Planning → Implementation

---

## Audit Summary

### What's Complete (87%)

- Full test session lifecycle (start → in-progress → submit → evaluate)
- Timer with auto-submit, server time offset, 3 urgency thresholds, pulse
  animations
- Section-based navigation with grouped navigator, jump-to-unanswered
- All 15 question types (9 auto-evaluatable + 6 AI-evaluatable)
- Question bank with difficulty tagging, search, filtering, import to story
  points
- Student analytics (topic, difficulty, Bloom's, section breakdowns, attempt
  comparison, time trends)
- Evaluation rubric presets management UI (create/edit/delete/filter by
  category)
- Auto-save on every answer change with save status indicator
- Review answers screen with section labels
- Network status banner during tests (offline/online detection)
- Confetti celebration on passing results
- Score counter animation (ease-out cubic, 1.2s)
- Race condition guard (isSubmitting ref)
- Timer accessibility (aria-live, accessible status indicators)
- Class-level test analytics for teachers (score distribution, question
  insights, weak topics)
- PDF reports for exam results, class summaries, student progress, class report
  cards

### Remaining Gaps (→ Cycle 4 Scope)

| Gap                                | Impact | Current State                                                                                 |
| ---------------------------------- | ------ | --------------------------------------------------------------------------------------------- |
| Dynamic adaptive testing           | High   | Static difficulty ordering only; `difficultyAdjustment` config unused, no real-time branching |
| Test scheduling & access windows   | High   | Only draft/published toggle; no time windows for test availability                            |
| Question bank CRUD from teacher UI | Medium | List/import/delete exist but no create/edit UI for bank items                                 |
| Teacher test preview               | Medium | Space-level preview exists but no test-taking simulation                                      |
| Student weak-area recommendations  | Medium | Analytics show breakdowns but no actionable study recommendations                             |
| Retry cooldown & passing lock      | Low    | Max attempts enforced but no cooldown period or auto-lock after passing                       |

---

## Implementation Plan

### Module 1: Dynamic Adaptive Testing [L]

**Goal:** Replace static difficulty ordering with real-time adaptive question
selection during test-taking.

**Files to modify:**

- `packages/shared-types/src/levelup/test-session.ts` — adaptive state tracking
- `packages/shared-types/src/levelup/story-point.ts` — enhance AdaptiveConfig
- `functions/levelup/src/callable/start-test-session.ts` — adaptive initial
  ordering with branching metadata
- `apps/student-web/src/pages/TimedTestPage.tsx` — dynamic question reordering
  on answer submit

**Files to create:**

- `packages/shared-services/src/levelup/adaptive-engine.ts` — adaptive selection
  algorithm

**Changes:**

1. **Adaptive engine** (`adaptive-engine.ts`):

   ```typescript
   interface AdaptiveState {
     currentDifficulty: "easy" | "medium" | "hard";
     consecutiveCorrect: number;
     consecutiveIncorrect: number;
     answeredByDifficulty: Record<string, number>;
   }

   function getNextDifficulty(
     state: AdaptiveState,
     config: AdaptiveConfig
   ): "easy" | "medium" | "hard";

   function selectNextQuestion(
     state: AdaptiveState,
     remainingQuestions: Array<{ id: string; difficulty: string }>,
     config: AdaptiveConfig
   ): string; // returns next questionId
   ```

   - **Gradual mode**: Shift difficulty after 3 consecutive correct/incorrect
   - **Aggressive mode**: Shift difficulty after 2 consecutive correct/incorrect
   - Respect `minQuestionsPerDifficulty` before allowing level shift
   - Track `difficultyProgression` array for post-test visualization

2. **Enhanced AdaptiveConfig** (`story-point.ts`):

   ```typescript
   interface AdaptiveConfig {
     enabled: boolean;
     initialDifficulty: "easy" | "medium" | "hard";
     difficultyAdjustment: "gradual" | "aggressive";
     minQuestionsPerDifficulty?: number; // default 2
     maxConsecutiveSameDifficulty?: number; // default 5, prevents stagnation
   }
   ```

3. **Session adaptive state** (`test-session.ts`):
   - Add `adaptiveState?: AdaptiveState` to `DigitalTestSession`
   - Update `difficultyProgression` on each answer submission (already defined,
     currently unused)
   - `currentDifficultyLevel` updated in real-time (already defined, currently
     unused)

4. **Server-side**: `startTestSession` seeds initial `adaptiveState` when
   adaptive is enabled. All remaining questions are available in a pool rather
   than a fixed order.

5. **Client-side**: `TimedTestPage.tsx` calls adaptive engine after each answer
   save to determine the next question. The question navigator shows difficulty
   badges on each question.

**Acceptance:**

- [ ] Adaptive mode shifts difficulty based on consecutive correct/incorrect
      answers
- [ ] `difficultyAdjustment: 'gradual'` requires 3 consecutive; `'aggressive'`
      requires 2
- [ ] `minQuestionsPerDifficulty` is respected before shifting
- [ ] `difficultyProgression` array is populated and visible in results
      analytics
- [ ] Non-adaptive tests are unaffected

---

### Module 2: Test Scheduling & Access Windows [M]

**Goal:** Allow teachers to set availability windows for tests (start date/end
date), so tests auto-publish and auto-close.

**Files to modify:**

- `packages/shared-types/src/levelup/story-point.ts` — add scheduling fields to
  AssessmentConfig
- `functions/levelup/src/callable/start-test-session.ts` — enforce schedule
  window
- `apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx` — scheduling UI in
  assessment config
- `apps/student-web/src/pages/TestsPage.tsx` — show scheduled/closed status
- `apps/student-web/src/pages/TimedTestPage.tsx` — block access outside window

**Changes:**

1. **Schedule fields** on `AssessmentConfig`:

   ```typescript
   interface AssessmentSchedule {
     startAt?: FirestoreTimestamp; // test becomes available
     endAt?: FirestoreTimestamp; // test closes (no new attempts)
     lateSubmissionGraceMinutes?: number; // grace for in-progress tests after endAt
   }
   ```

2. **Server enforcement** in `startTestSession`:
   - Check `schedule.startAt` — reject with `failed-precondition` if before
     start
   - Check `schedule.endAt` — reject with `failed-precondition` if after end
   - In-progress sessions: allow submission up to `endAt + graceMinutes`

3. **Teacher UI** in `SpaceEditorPage`:
   - Date/time pickers for start and end dates in the assessment config section
   - Show schedule status badge (Scheduled / Active / Closed)
   - Optional late submission grace period input (minutes)

4. **Student UI**:
   - `TestsPage.tsx`: Show "Available from {date}" for scheduled tests, "Closed"
     for past-end tests
   - `TimedTestPage.tsx`: Landing view blocks "Start Test" with message when
     outside window
   - Show countdown to start if scheduled in future

**Acceptance:**

- [ ] Teachers can set start/end dates on assessment story points
- [ ] Students cannot start tests outside the availability window
- [ ] In-progress tests get grace period after window closes
- [ ] Test list shows schedule status (Scheduled / Active / Closed)
- [ ] Tests without schedule work as before (always available when published)

---

### Module 3: Question Bank Create & Edit UI [M]

**Goal:** Allow teachers to create and edit question bank items directly from
the question bank page, completing the CRUD cycle.

**Files to modify:**

- `apps/teacher-web/src/pages/spaces/QuestionBankPage.tsx` — add create/edit
  functionality

**Files to create:**

- `apps/teacher-web/src/components/question-bank/QuestionBankEditor.tsx` —
  question editor sheet/dialog

**Changes:**

1. **Question bank editor** (`QuestionBankEditor.tsx`):
   - Sheet/dialog form for creating or editing a question bank item
   - Question type selector (all 15 types)
   - Content editor (markdown with preview)
   - Question-type-specific data editor (MCQ options, matching pairs, code test
     cases, etc.)
   - Classification fields: subject, topics (multi-select), difficulty, Bloom's
     level, tags
   - Base points input
   - Explanation/solution editor
   - Reuse existing question rendering components for preview

2. **QuestionBankPage enhancements**:
   - "Create Question" button → opens editor in create mode
   - Edit action on existing items → opens editor in edit mode with
     pre-populated data
   - "Duplicate" action → opens editor with cloned data (new item)
   - Calls existing `save-question-bank-item` callable for persistence

3. **Validation**:
   - Require at least: questionType, content, difficulty, subject
   - Type-specific validation (MCQ must have >= 2 options and 1 correct answer,
     etc.)

**Acceptance:**

- [ ] Teachers can create new question bank items from the UI
- [ ] Teachers can edit existing question bank items
- [ ] Teachers can duplicate a question bank item
- [ ] Question type-specific editors render correctly for all 15 types
- [ ] Validation prevents saving incomplete questions

---

### Module 4: Teacher Test Preview [S]

**Goal:** Let teachers take a test in preview mode without recording a session,
to verify the student experience before publishing.

**Files to modify:**

- `apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx` — add "Preview Test"
  button
- `apps/student-web/src/pages/TimedTestPage.tsx` — support preview mode flag

**Files to create:**

- `apps/teacher-web/src/pages/TestPreviewPage.tsx` — preview page wrapper

**Changes:**

1. **Preview page** (`TestPreviewPage.tsx`):
   - Renders a read-only test simulation using the story point's items
   - Shows timer (non-enforced), section navigation, question navigator
   - Answers are local-only (not saved to Firestore, no session created)
   - Shows correct answers and explanations after each question (toggle)
   - "Exit Preview" button returns to space editor
   - Banner at top: "Preview Mode — answers are not saved"

2. **SpaceEditorPage**: Add "Preview as Student" button on timed_test story
   points

3. **Route**: `/spaces/:spaceId/story-points/:storyPointId/preview`

**Acceptance:**

- [ ] Teachers can preview any timed_test story point
- [ ] Preview shows timer, sections, question navigation (mirrors student
      experience)
- [ ] No test session is created in Firestore
- [ ] Teachers can reveal answers/explanations during preview
- [ ] Clear "Preview Mode" indicator shown throughout

---

### Module 5: Student Weak-Area Recommendations [S]

**Goal:** Generate actionable study recommendations from test analytics,
pointing students toward topics and difficulty levels where they need
improvement.

**Files to modify:**

- `apps/student-web/src/pages/TestAnalyticsPage.tsx` — add recommendations
  section
- `apps/student-web/src/pages/TimedTestPage.tsx` — add brief recommendations in
  results view

**Files to create:**

- `apps/student-web/src/components/analytics/StudyRecommendations.tsx` —
  recommendations component

**Changes:**

1. **StudyRecommendations component** (`StudyRecommendations.tsx`):
   - Analyzes `TestAnalytics` breakdowns to identify weak areas
   - Rules:
     - Topic with < 50% accuracy → "Focus on {topic}"
     - Difficulty level with < 40% accuracy → "Practice more {difficulty}
       questions"
     - Bloom's level with < 50% → "Work on {bloomsLevel} skills ({description})"
     - Average time > 2× overall average for a topic → "Spend less time on
       {topic} — review fundamentals"
   - Displays as a prioritized list of recommendation cards
   - Each card: icon + title + brief explanation + suggested action
   - Max 5 recommendations, sorted by impact (lowest accuracy first)

2. **TestAnalyticsPage**: Add "Recommended Focus Areas" section below existing
   breakdowns

3. **TimedTestPage results view**: Add compact "Areas to Improve" list (top 3
   weak topics) with link to full analytics

**Acceptance:**

- [ ] Recommendations generated from actual test analytics data
- [ ] At least topic and difficulty recommendations shown
- [ ] No recommendations shown if all areas are > 70% (congratulatory message
      instead)
- [ ] Results view links to detailed analytics page

---

### Module 6: Retry Cooldown & Passing Lock [S]

**Goal:** Allow teachers to configure retry behavior — minimum wait between
attempts and optional auto-lock after passing.

**Files to modify:**

- `packages/shared-types/src/levelup/story-point.ts` — add retry config to
  AssessmentConfig
- `functions/levelup/src/callable/start-test-session.ts` — enforce retry rules
- `apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx` — retry config UI
- `apps/student-web/src/pages/TimedTestPage.tsx` — show cooldown/lock status on
  landing

**Changes:**

1. **Retry config** on `AssessmentConfig`:

   ```typescript
   interface RetryConfig {
     cooldownMinutes?: number; // minimum wait between attempts
     lockAfterPassing?: boolean; // no more attempts after passing
   }
   ```

2. **Server enforcement** in `startTestSession`:
   - If `cooldownMinutes` set: compare `lastSession.endedAt + cooldown` vs `now`
   - If `lockAfterPassing` set: check if any previous session has
     `percentage >= passingPercentage`
   - Reject with `failed-precondition` and descriptive message

3. **Teacher UI**: Add cooldown (minutes input) and "Lock after passing" toggle
   in assessment config

4. **Student UI** (landing view):
   - Show "You can retry in {time}" countdown when in cooldown
   - Show "You've already passed this test" message when locked
   - Disable "Start Test" button with appropriate messaging

**Acceptance:**

- [ ] Cooldown period enforced server-side
- [ ] Student sees countdown until next attempt is available
- [ ] Lock-after-passing prevents new attempts when any prior attempt passed
- [ ] Teachers can configure both settings independently
- [ ] Tests without retry config work as before

---

## Implementation Order

1. **Module 2** — Test Scheduling (independent, high impact for classroom use)
2. **Module 1** — Dynamic Adaptive Testing (most complex, high impact)
3. **Module 3** — Question Bank Create/Edit UI (completes CRUD, medium
   complexity)
4. **Module 4** — Teacher Test Preview (small, high teacher value)
5. **Module 5** — Student Recommendations (small, builds on existing analytics)
6. **Module 6** — Retry Cooldown & Lock (small, quick win)

## Files Summary

### New Files (4)

| File                                                                   | Purpose                               |
| ---------------------------------------------------------------------- | ------------------------------------- |
| `packages/shared-services/src/levelup/adaptive-engine.ts`              | Adaptive question selection algorithm |
| `apps/teacher-web/src/components/question-bank/QuestionBankEditor.tsx` | Question bank create/edit editor      |
| `apps/teacher-web/src/pages/TestPreviewPage.tsx`                       | Teacher test preview page             |
| `apps/student-web/src/components/analytics/StudyRecommendations.tsx`   | Weak-area study recommendations       |

### Modified Files (9)

| File                                                     | Changes                                                          |
| -------------------------------------------------------- | ---------------------------------------------------------------- |
| `packages/shared-types/src/levelup/story-point.ts`       | AssessmentSchedule, enhanced AdaptiveConfig, RetryConfig         |
| `packages/shared-types/src/levelup/test-session.ts`      | AdaptiveState on session                                         |
| `functions/levelup/src/callable/start-test-session.ts`   | Schedule enforcement, adaptive seeding, retry enforcement        |
| `apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx`  | Schedule UI, retry config, preview button                        |
| `apps/teacher-web/src/pages/spaces/QuestionBankPage.tsx` | Create/edit actions, editor integration                          |
| `apps/teacher-web/src/App.tsx`                           | Preview route                                                    |
| `apps/student-web/src/pages/TimedTestPage.tsx`           | Adaptive reordering, cooldown/lock display, mini recommendations |
| `apps/student-web/src/pages/TestsPage.tsx`               | Schedule status display                                          |
| `apps/student-web/src/pages/TestAnalyticsPage.tsx`       | Recommendations section                                          |

## Coding Standards

- TypeScript strict mode, zero `any`
- Use existing Zod schemas and branded types from `@levelup/shared-types`
- Follow existing patterns: `HttpsError` for callable errors, `admin.firestore`
  for DB access
- All new types exported from `@levelup/shared-types`
- Use shadcn/ui components from `@levelup/shared-ui`
- Adaptive engine must be pure functions (testable without Firestore)
- Rate limit enforcement on all callable changes
- Must pass `pnpm build` and `pnpm lint`

## Estimated Completion After Cycle 4: ~95%

### Remaining for Future Cycles (~5%)

- Student-level drill-down in class analytics
- Peer comparison analytics (vs class average)
- Selective question retry (retry only failed questions)
- Question bank sharing across tenants
- Interactive HTML reports (supplement existing PDF)
- Geo/device-based test access restrictions
