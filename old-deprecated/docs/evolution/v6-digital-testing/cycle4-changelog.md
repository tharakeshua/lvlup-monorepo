# V6 Digital Testing & Assessment — Cycle 4 Changelog

**Cycle:** 4 **Vertical:** V6 — Digital Testing & Assessment **Engineer:**
Learning Engineer **Completion:** ~87% → ~95% **Date:** 2026-03-08

---

## Module 1: Dynamic Adaptive Testing

### New File

- `packages/shared-services/src/levelup/adaptive-engine.ts` — Pure-function
  adaptive question selection algorithm

### Changes

- **`packages/shared-types/src/levelup/story-point.ts`**
  - Added `maxConsecutiveSameDifficulty` to `AdaptiveConfig` (default 5,
    prevents stagnation)

- **`packages/shared-types/src/levelup/test-session.ts`**
  - Added `AdaptiveState` interface (tracks `currentDifficulty`,
    `consecutiveCorrect`, `consecutiveIncorrect`, `answeredByDifficulty`)
  - Added `adaptiveState?: AdaptiveState` to `DigitalTestSession`

- **`packages/shared-services/src/levelup/index.ts`**
  - Re-exports adaptive engine functions

- **`functions/levelup/src/callable/start-test-session.ts`**
  - Seeds `adaptiveState` on session creation when adaptive config is enabled

- **`apps/student-web/src/pages/TimedTestPage.tsx`**
  - Tracks `localAdaptiveState` in React state, initialized from session
  - `handleSaveAndNext()` calls `updateAdaptiveState()` and
    `selectNextQuestion()` for real-time difficulty-based question selection
  - Results view shows difficulty progression chart for adaptive tests

- **`apps/teacher-web/src/components/spaces/StoryPointEditor.tsx`**
  - Full adaptive config UI: initial difficulty, adjustment mode
    (gradual/aggressive), min questions per difficulty, max consecutive same
    difficulty

### Acceptance

- [x] Adaptive mode shifts difficulty based on consecutive correct/incorrect
      answers
- [x] `difficultyAdjustment: 'gradual'` requires 3 consecutive; `'aggressive'`
      requires 2
- [x] `minQuestionsPerDifficulty` respected before shifting
- [x] `difficultyProgression` visible in results analytics
- [x] Non-adaptive tests unaffected

---

## Module 2: Test Scheduling & Access Windows

### Changes

- **`packages/shared-types/src/levelup/story-point.ts`**
  - Added `AssessmentSchedule` interface (`startAt`, `endAt`,
    `lateSubmissionGraceMinutes`)
  - Added `schedule?: AssessmentSchedule` to `AssessmentConfig`

- **`functions/levelup/src/callable/start-test-session.ts`**
  - Enforces schedule window: rejects with `failed-precondition` if before
    `startAt` or after `endAt`

- **`apps/teacher-web/src/components/spaces/StoryPointEditor.tsx`**
  - Date/time pickers for start and end dates
  - Late submission grace period input (minutes)
  - "Clear Schedule" button

- **`apps/student-web/src/pages/TestsPage.tsx`**
  - `getScheduleStatus()` helper computes Scheduled/Active/Closed from schedule
    config
  - `TestCard` shows schedule badge and appropriate icon (CalendarClock for
    scheduled, Lock for closed)
  - Shows "Opens {date}" for scheduled tests

- **`apps/student-web/src/pages/TimedTestPage.tsx`**
  - Landing view shows schedule banners (Scheduled with date, Closed with
    message)
  - "Start Test" button disabled when outside availability window

### Acceptance

- [x] Teachers can set start/end dates on assessment story points
- [x] Students cannot start tests outside the availability window
- [x] Test list shows schedule status (Scheduled / Active / Closed)
- [x] Tests without schedule work as before

---

## Module 3: Question Bank Create & Edit UI

### New File

- `apps/teacher-web/src/components/question-bank/QuestionBankEditor.tsx` — Full
  question editor sheet

### Changes

- **`apps/teacher-web/src/pages/spaces/QuestionBankPage.tsx`**
  - "Add Question" button opens QuestionBankEditor in create mode
  - Edit (pencil icon) button per question opens editor in edit mode
  - Duplicate (copy icon) button clones question data into create mode (new item
    with cleared ID)
  - Integrates QuestionBankEditor component

### QuestionBankEditor Features

- Question type selector (all 15 types)
- Content editor (textarea)
- Type-specific data editors:
  - MCQ/MCAQ: option list with add/remove, correct answer toggle (single for
    MCQ, multi for MCAQ)
  - True/False: correct answer selector
  - Numerical: answer + tolerance inputs
  - Other types: preserves existing questionData
- Classification: subject, difficulty, Bloom's level
- Base points input
- Topics & tags with add/remove chips
- Explanation/solution editor
- Validation: requires content, difficulty, subject; MCQ requires ≥2 options and
  ≥1 correct

### Acceptance

- [x] Teachers can create new question bank items from the UI
- [x] Teachers can edit existing question bank items
- [x] Teachers can duplicate a question bank item
- [x] Question type-specific editors for MCQ, MCAQ, True/False, Numerical
- [x] Validation prevents saving incomplete questions

---

## Module 4: Teacher Test Preview

### New File

- `apps/teacher-web/src/pages/TestPreviewPage.tsx` — Test preview page

### Changes

- **`apps/teacher-web/src/App.tsx`**
  - Added route: `/spaces/:spaceId/story-points/:storyPointId/preview`
  - Lazy-loads TestPreviewPage

- **`apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx`**
  - `SortableStoryPoint` accepts optional `onPreview` prop
  - Eye icon button on test/quiz/timed_test story points navigates to preview
    route

### TestPreviewPage Features

- Blue "Preview Mode" banner with exit button
- Loads story point questions directly from Firestore (no session created)
- Inline question navigator (numbered buttons)
- Question display with type badge, difficulty badge, points
- MCQ/True-False interactive option selection (local only)
- "Show Answers" toggle reveals correct answers and explanations
- Timer display (non-enforced, shows duration and elapsed time)
- Previous/Next navigation

### Acceptance

- [x] Teachers can preview any timed_test story point
- [x] Preview shows timer, question navigation (mirrors student experience)
- [x] No test session is created in Firestore
- [x] Teachers can reveal answers/explanations during preview
- [x] Clear "Preview Mode" indicator shown throughout

---

## Module 5: Student Weak-Area Recommendations

### New File

- `apps/student-web/src/components/analytics/StudyRecommendations.tsx` —
  Recommendations component

### Changes

- **`apps/student-web/src/pages/TestAnalyticsPage.tsx`**
  - Added "Recommended Focus Areas" section before attempt comparison
  - Uses `StudyRecommendations` component with latest session analytics

- **`apps/student-web/src/pages/TimedTestPage.tsx`**
  - Results view shows "Areas to Improve" (top 3 weak topics) with link to full
    analytics

### StudyRecommendations Features

- Analyzes `TestAnalytics` breakdowns to identify weak areas:
  - Topic with < 50% accuracy → "Focus on {topic}"
  - Difficulty level with < 40% accuracy → "Practice more {difficulty}
    questions"
  - Bloom's level with < 50% → "Work on {bloomsLevel} skills"
- Prioritized list sorted by lowest accuracy first
- Max 5 recommendations
- Congratulatory message when all areas > 50%
- Each recommendation: icon + title + description

### Acceptance

- [x] Recommendations generated from actual test analytics data
- [x] Topic, difficulty, and Bloom's recommendations shown
- [x] Congratulatory message when performing well
- [x] Results view links to detailed analytics page

---

## Module 6: Retry Cooldown & Passing Lock

### Changes

- **`packages/shared-types/src/levelup/story-point.ts`**
  - Added `RetryConfig` interface (`cooldownMinutes`, `lockAfterPassing`)
  - Added `retryConfig?: RetryConfig` to `AssessmentConfig`

- **`functions/levelup/src/callable/start-test-session.ts`**
  - Enforces `lockAfterPassing`: checks if any previous session passed, rejects
    if so
  - Enforces `cooldownMinutes`: compares last session's endedAt + cooldown vs
    now, rejects with minutes remaining

- **`apps/teacher-web/src/components/spaces/StoryPointEditor.tsx`**
  - Cooldown minutes input
  - "Lock after passing" toggle switch

- **`apps/student-web/src/pages/TimedTestPage.tsx`**
  - Landing view shows cooldown banner with "retry in X minutes" message
  - Landing view shows "Test Passed — no further attempts" message when locked
  - "Start Test" button disabled with "Unavailable" label when blocked

### Acceptance

- [x] Cooldown period enforced server-side
- [x] Student sees countdown until next attempt
- [x] Lock-after-passing prevents new attempts
- [x] Teachers can configure both settings independently
- [x] Tests without retry config work as before

---

## Files Summary

### New Files (4)

| File                                                                   | Purpose                               |
| ---------------------------------------------------------------------- | ------------------------------------- |
| `packages/shared-services/src/levelup/adaptive-engine.ts`              | Adaptive question selection algorithm |
| `apps/teacher-web/src/components/question-bank/QuestionBankEditor.tsx` | Question bank create/edit editor      |
| `apps/teacher-web/src/pages/TestPreviewPage.tsx`                       | Teacher test preview page             |
| `apps/student-web/src/components/analytics/StudyRecommendations.tsx`   | Weak-area study recommendations       |

### Modified Files (10)

| File                                                          | Changes                                                      |
| ------------------------------------------------------------- | ------------------------------------------------------------ |
| `packages/shared-types/src/levelup/story-point.ts`            | AssessmentSchedule, enhanced AdaptiveConfig, RetryConfig     |
| `packages/shared-types/src/levelup/test-session.ts`           | AdaptiveState interface + field on session                   |
| `packages/shared-services/src/levelup/index.ts`               | Re-export adaptive engine                                    |
| `functions/levelup/src/callable/start-test-session.ts`        | Schedule, retry, adaptive enforcement                        |
| `apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx`       | Preview button on story points                               |
| `apps/teacher-web/src/components/spaces/StoryPointEditor.tsx` | Schedule, retry, adaptive config UI                          |
| `apps/teacher-web/src/pages/spaces/QuestionBankPage.tsx`      | Create/edit/duplicate actions + editor                       |
| `apps/teacher-web/src/App.tsx`                                | Preview route                                                |
| `apps/student-web/src/pages/TimedTestPage.tsx`                | Adaptive reordering, schedule/cooldown/lock, recommendations |
| `apps/student-web/src/pages/TestsPage.tsx`                    | Schedule status display                                      |
| `apps/student-web/src/pages/TestAnalyticsPage.tsx`            | Recommendations section                                      |

## Build Status

- `@levelup/shared-types` — Pass
- `@levelup/shared-services` — Pass
- `@levelup/teacher-web` — Pass
- `@levelup/student-web` — Pass
- `@levelup/functions-levelup` — Pre-existing errors only (import-from-bank,
  list-question-bank, parse-request, rate-limit)
