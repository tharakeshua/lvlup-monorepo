# V4 Learning Platform — Cycle 3 Combined Pass 1 Changelog

## Summary

Cycle 3 Combined Pass 1 adds item-level drag-and-drop reordering, animated
progress bars, and space completion celebrations to the Learning Platform.

---

## Changes

### F1: Item-Level Drag-and-Drop Reordering

- Added `SortableItem` component with drag handle using @dnd-kit
- Items within expanded story points can now be reordered via drag-and-drop
- Order persists to Firestore via batch writes with optimistic updates
- Rollback on failure preserves previous order

**Files modified:**

- `apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx` — Added SortableItem
  component, handleItemDragEnd handler, wrapped items in SortableContext

### F2: Animated Progress Bars

- Added `animate` prop to ProgressBar component
- When animate=true, bar fills from 0 to target using CSS transition (700ms
  ease-out)
- Increased default transition duration from 300ms to 700ms for smoother feel
- Uses requestAnimationFrame for mount-time animation trigger

**Files modified:**

- `apps/student-web/src/components/common/ProgressBar.tsx` — Added animate prop,
  useEffect for animation, useState for displayPercent

### U1: Space Completion Celebration

- CelebrationBurst confetti triggers when student reaches 100% space progress
- Uses shared-ui CelebrationBurst component with confetti variant
- One-time trigger (won't re-fire after shown)
- Overall progress bar uses animate prop for smooth fill on page load

**Files modified:**

- `apps/student-web/src/pages/SpaceViewerPage.tsx` — Added CelebrationBurst
  import, celebration state, trigger on 100% completion, animate prop on
  progress bar

---

## Build Status

- `pnpm --filter=teacher-web exec -- tsc --noEmit` — PASS (0 errors)
- `pnpm --filter=student-web exec -- tsc --noEmit` — PASS (0 errors)

## Files Summary

| Category    | Created | Modified |
| ----------- | ------- | -------- |
| Teacher-Web | 0       | 1        |
| Student-Web | 0       | 2        |
| **Total**   | **0**   | **3**    |
