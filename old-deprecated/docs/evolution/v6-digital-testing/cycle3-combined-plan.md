# V6 Digital Testing — Cycle 3 Combined Pass 1

## Current State: ~80%

### Already Complete

- Full test session lifecycle (start → in-progress → submit → evaluate)
- Timer with auto-submit + server time offset
- Section-based navigation with progress
- All 15 question types
- Question bank with difficulty tagging, search, filtering
- Student analytics (topic, difficulty, Bloom's, section breakdowns)
- Auto-save on every answer change
- Review answers screen
- CelebrationBurst component exists
- Timer accessibility (cycle2)
- Race condition guard (cycle2)
- Accessible status indicators (cycle2)
- Jump to unanswered (cycle2)
- Class-level test analytics for teachers (cycle3 prior)
- Question bank import enhancement (cycle3 prior)

### Gaps to Address

## Tasks

### Feature Tasks

#### F1: Wire Confetti to Test Results [S]

**Files**: `apps/student-web/src/pages/TimedTestPage.tsx` **What**: Show
CelebrationBurst confetti when student passes a test **Acceptance**: Confetti
triggers on results view when score >= passing percentage

#### F2: Evaluation Preset Management UI [M]

**Files**: `apps/teacher-web/src/pages/RubricPresetsPage.tsx` (new),
`apps/teacher-web/src/App.tsx` **What**: Teacher page to view, create, edit,
delete rubric presets **Acceptance**: Teachers can manage rubric presets from
the UI

#### F3: Network Status Banner [S]

**Files**: `apps/student-web/src/components/test/NetworkStatusBanner.tsx` (new),
`apps/student-web/src/pages/TimedTestPage.tsx` **What**: Detect online/offline
status, show banner when connection lost during test **Acceptance**: Banner
shows on disconnect, hides on reconnect

### Quality Tasks

#### Q1: Auto-Save Indicator [S]

**Files**: `apps/student-web/src/pages/TimedTestPage.tsx` **What**: Show subtle
"saving..." / "saved" indicator when answers auto-save **Acceptance**: User sees
save status feedback

### UX Polish Tasks

#### U1: Score Counter Animation [S]

**Files**: `apps/student-web/src/pages/TimedTestPage.tsx` **What**: Animate
score percentage counting up in results view **Acceptance**: Score number
animates from 0 to actual value

## Implementation Order

1. F1 (confetti)
2. F3 (network banner)
3. Q1 (save indicator)
4. U1 (score animation)
5. F2 (rubric presets page)
