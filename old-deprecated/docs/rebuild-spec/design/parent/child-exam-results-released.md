# Child Exam Results (Released)

## Purpose & user

Lets a **parent/guardian** (Anita Sharma) review one child's **released** exam
results at Beacon Hill Academy. For the selected child (default Aarav Sharma,
Grade 9) the parent sees a filterable, expandable list of released exam
submissions — per-exam grade, score, subject, date and a short overall comment.
Read-only oversight: the parent never edits scores and never sees answer keys.

## Entry / route

- Route: `#/children/:childId/results` (e.g. `#/children/aarav/results`).
- Shell mode: `shell` (ParentShell sidebar + topbar), active nav = `results`.
- Reached from the dashboard child card "Results" CTA, the Progress screen, or
  sidebar "Exam Results".

## Layout (text wireframe)

```
┌ ParentShell (sidebar + topbar) ─────────────────────────────────────────────┐
│  Exam Results — Aarav Sharma                                                 │
│  Released results only · Grade 9 · DSA, Mathematics, Physics                 │
│                                                                              │
│  [🔒 Answer keys are never shown to parents — released grades + comments]    │
│                                                                              │
│  Subjects:  ( All ) ( DSA ) ( Mathematics ) ( Physics )                      │
│                                                                              │
│  ┌Accordion — released submissions ───────────────────────────────────────┐ │
│  │ ▸ Mid-term · Data Structures   [DSA]  12 Jun 2026   [B 78%] ▓▓▓▓▓▓▓░   │ │
│  │ ▾ Unit Test · Algebra          [Math] 04 Jun 2026   [A 88%] ▓▓▓▓▓▓▓▓   │ │
│  │     Overall: "Strong, methodical work…"   44 / 50 marks                │ │
│  │     Rubric mini: Method 18/20 · Accuracy 14/15 · Presentation 12/15    │ │
│  │     Graded by AutoGrade · teacher reviewed  [View full feedback →]     │ │
│  │ ▸ Quiz · Kinematics            [Physics] 28 May 2026 [C 64%] ▓▓▓▓▓░░░  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Components used (CORE-API)

- `Chip` (subject filter chips, `active` for selection), `Accordion`
  (released-submission rows), `GradePill {grade,score}`, `ProgressBar {value}`
  (score bar), `ConfidenceBadge` (graded-by source), `Badge` (subject + status),
  `RubricBreakdown` (mini per-exam), `Button` ("View full feedback"),
  `EmptyState` (no released results), `Icon`, `AnswerKeyLock` / inline banner,
  `NavItem` (shell).

## States

- **Loading:** rows render as `Skeleton` lines (no layout shift); filter chips
  disabled.
- **Empty:** no released results for the child/filter → `EmptyState` (icon
  `clipboard-x`, "No released results yet", body explaining results appear once
  the teacher releases them).
- **Error:** per-section `Alert variant="error"` with Retry; shell + nav still
  usable.
- **Success:** filtered accordion of released submissions; expanding a row
  reveals overall comment, score/max, rubric mini, graded-by `ConfidenceBadge`,
  and the "View full feedback" CTA.

## Interactions & flows

- Subject chips filter the list client-side over already-released items (no
  refetch implied).
- Expanding an accordion row reveals the per-exam summary (overall comment,
  score/max, rubric mini).
- "View full feedback" → `go('#/children/aarav/results/ex_midterm')`.
- Empty-state secondary action → `go('#/children/aarav/progress')`.
- All CTAs route through `go('#/...')`.

## Domain rules

- **Released-only:** every exam shown is server-released; unreleased/in-grading
  submissions are invisible to parents (never shown as a zero or placeholder
  score).
- **Answer keys are NEVER shown** — the screen surfaces only the released grade,
  score and comment.
- Grades, scores, percentages, rubric scores and graded-by source are
  **server-derived**, display-only — never client-computed or editable.

## A11y

- Single `<h1>` "Exam Results — Aarav Sharma"; filter chips are a labelled
  `group` with pressed state.
- Status colors always paired with icon+label (`GradePill`, `ConfidenceBadge`,
  status `Badge`).
- Accordion rows are keyboard-operable (header buttons toggle, expose expanded
  state).
- Progress/score bars expose `value`; `aria-live` announces filter result
  counts.
