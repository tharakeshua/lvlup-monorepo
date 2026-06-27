# V4+V5+V6 Cycle 3 Plan — Core Experience Feature Completion

## Scope

Cycle 3 addresses the highest-impact remaining gaps across V4 (Learning
Platform), V5 (AutoGrade & AI), and V6 (Digital Testing) to bring these
verticals to production-grade quality.

---

## V4 — Learning Platform & Content Engine

### Task 4.1: Content Versioning Types & Tracking

**Files**: `packages/shared-types/src/levelup/space.ts`,
`packages/shared-types/src/content/item.ts` **What**: Add `version` field to
Space and UnifiedItem, add `ContentVersion` type for tracking revision history
**Acceptance**: Types compile, existing code unaffected

### Task 4.2: Space Rating & Review System

**Files**: `packages/shared-types/src/levelup/space-review.ts` (new),
`packages/shared-hooks/src/queries/useSpaceReviews.ts` (new),
`functions/levelup/src/callable/save-space-review.ts` (new),
`apps/student-web/src/components/spaces/SpaceReviewSection.tsx` (new),
`apps/student-web/src/pages/SpaceViewerPage.tsx` **What**: Students can rate
(1-5 stars) and review spaces; aggregate rating shown on space cards
**Acceptance**: Students can submit/edit reviews, average rating displayed

### Task 4.3: Enhanced Error & Empty States

**Files**: `apps/student-web/src/pages/SpacesListPage.tsx`,
`apps/student-web/src/pages/SpaceViewerPage.tsx`,
`apps/student-web/src/pages/StoryPointViewerPage.tsx` **What**: Proper error
boundaries, retry buttons, descriptive empty states with CTAs **Acceptance**:
Each page handles error/empty states gracefully

## V5 — AutoGrade & AI Pipeline

### Task 5.1: Grading Audit Trail UI

**Files**: `apps/teacher-web/src/pages/exams/GradingReviewPage.tsx` **What**:
Show override history timeline (who changed what, when, original vs new score)
in expanded question view **Acceptance**: Override history visible with
timestamps

### Task 5.2: Retry Failed Questions UI

**Files**: `apps/teacher-web/src/pages/exams/GradingReviewPage.tsx` **What**:
Add "Retry AI Grading" button for failed questions that calls the existing
`gradeQuestion` callable in retry mode **Acceptance**: Teachers can retry failed
questions from the UI

## V6 — Digital Testing & Assessment

### Task 6.1: Class-Level Test Analytics for Teachers

**Files**: `apps/teacher-web/src/pages/ClassTestAnalyticsPage.tsx` (new),
`apps/teacher-web/src/App.tsx` (route) **What**: Aggregate test analytics per
class — average scores, pass rates, topic weaknesses, student performance
distribution **Acceptance**: Teachers see class-level test insights

### Task 6.2: Question Bank → Test Import Enhancement

**Files**: `apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx` **What**: Add
"Import from Question Bank" button in space editor that lets teachers browse and
import questions into story points **Acceptance**: Teachers can import question
bank items into test story points

---

## Implementation Order

1. Task 4.1 (types — foundational)
2. Task 4.2 (ratings — new feature)
3. Task 4.3 (error states — polish)
4. Task 5.1 (audit trail — visibility)
5. Task 5.2 (retry — usability)
6. Task 6.1 (class analytics — insight)
7. Task 6.2 (question import — workflow)
