# V6 – Digital Testing & Assessment — Test Report

## Build Verification

| Target                       | Command                                             | Status |
| ---------------------------- | --------------------------------------------------- | ------ |
| `@levelup/shared-types`      | `pnpm run --filter @levelup/shared-types build`     | PASS   |
| `@levelup/shared-types`      | `pnpm run --filter @levelup/shared-types typecheck` | PASS   |
| `@levelup/functions-levelup` | `tsc --noEmit`                                      | PASS   |
| `@levelup/functions-levelup` | `tsc` (build)                                       | PASS   |
| `student-web`                | `tsc --noEmit`                                      | PASS   |
| `student-web`                | `vite build`                                        | PASS   |
| `teacher-web`                | `tsc --noEmit`                                      | PASS   |
| `teacher-web`                | `vite build`                                        | PASS   |

## Modules Implemented

### Module 1: Test Session Lifecycle Polish

- **start-test-session.ts**: Section mapping, adaptive ordering,
  lastVisitedIndex, resume with full session data
- **submit-test-session.ts**: `computeTestAnalytics()` with
  topic/difficulty/blooms/section breakdowns

### Module 2: Timer Enhancement

- **CountdownTimer.tsx**: Urgency colors (green→amber→red→pulse), warning toasts
  at 5min/1min, `onWarning` callback

### Module 3: Question Bank

- **Types**: `QuestionBankItem`, `QuestionBankFilter` in `packages/shared-types`
- **Backend**: `saveQuestionBankItem`, `listQuestionBank`, `importFromBank`
  callables
- **Frontend**: `QuestionBankPage.tsx` with search, filters, preview, delete

### Module 4: Evaluation Presets

- **Types**: `RubricPreset`, `RubricPresetCategory` in `packages/shared-types`
- **Backend**: `saveRubricPreset` callable with default-preset protection
- **Frontend**: `RubricPresetPicker.tsx` with browse/filter/apply and
  save-as-preset

### Module 5: Student Analytics

- **TestAnalyticsPage.tsx**: Score progression, topic/difficulty performance,
  time analysis
- **AttemptComparison.tsx**: Side-by-side attempt comparison with per-question
  delta grid
- **QuestionNavigator.tsx**: Section-based grouping with progress indicators

### Module 6: Adaptive Testing Foundation

- **Types**: `AdaptiveConfig` on `AssessmentConfig`
- **Backend**: `buildAdaptiveOrder()` groups items by difficulty, shuffles
  within groups
- **Session tracking**: `currentDifficultyLevel`, `difficultyProgression` fields

## Files Modified

### packages/shared-types/src/

- `levelup/test-session.ts` — Added AnalyticsBreakdownEntry, sectionBreakdown,
  averageTimePerQuestion, sectionMapping, lastVisitedIndex, adaptive tracking
- `levelup/story-point.ts` — Added AdaptiveConfig interface
- `content/item.ts` — Added bloomsLevel to QuestionPayload
- `schemas/callable-schemas.ts` — 4 new Zod schemas
- `levelup/index.ts` — New exports
- `content/index.ts` — New exports

### packages/shared-types/src/ (new files)

- `levelup/question-bank.ts` — QuestionBankItem, QuestionBankFilter
- `content/rubric-preset.ts` — RubricPreset, RubricPresetCategory

### functions/levelup/src/

- `callable/start-test-session.ts` — Section mapping, adaptive ordering, resume
  enhancements
- `callable/submit-test-session.ts` — computeTestAnalytics with breakdowns
- `callable/save-question-bank-item.ts` — NEW: CRUD for question bank
- `callable/list-question-bank.ts` — NEW: Search/filter/paginate question bank
- `callable/import-from-bank.ts` — NEW: Import bank items into story points
- `callable/save-rubric-preset.ts` — NEW: CRUD for rubric presets
- `index.ts` — 4 new callable exports
- `types/index.ts` — New re-exports
- `package.json` — Added zod@^4.3.6 dependency

### apps/student-web/src/

- `components/test/CountdownTimer.tsx` — Urgency colors, warning toasts
- `components/test/QuestionNavigator.tsx` — Section-based grouping
- `pages/TimedTestPage.tsx` — Section navigation, resume, auto-submit, results
  breakdowns
- `pages/TestAnalyticsPage.tsx` — NEW: Detailed analytics page
- `components/analytics/AttemptComparison.tsx` — NEW: Side-by-side comparison
- `App.tsx` — TestAnalyticsPage route

### apps/teacher-web/src/

- `pages/spaces/QuestionBankPage.tsx` — NEW: Question bank management
- `components/rubric/RubricPresetPicker.tsx` — NEW: Preset picker/saver
- `App.tsx` — QuestionBankPage route

## Issues Found & Resolved

1. **Missing zod dependency**: `functions/levelup/package.json` was missing
   `zod@^4.3.6` (all other function packages had it). This caused Zod 3/4 type
   incompatibility with shared-types schemas. Fixed by adding the dependency.

2. **Stale `.local-deps/shared-types`**: The cached pnpm copy didn't include new
   schemas/types. Fixed by rebuilding shared-types and running `pnpm install`.

3. **Non-existent `useFunctions` hook**: QuestionBankPage and RubricPresetPicker
   used a fictional `useFunctions` hook. Fixed by using the established
   `getFunctions()` + `httpsCallable()` pattern from `firebase/functions`.

4. **Value import from `@levelup/shared-types`**: `BLOOMS_LEVELS` was imported
   as a value in teacher-web, which doesn't have shared-types as a direct
   dependency. Fixed by inlining the constant.

5. **Non-existent `assertRole` function**: New callables used `assertRole` which
   doesn't exist. Fixed by using `assertTeacherOrAdmin` from `../utils/auth`.
