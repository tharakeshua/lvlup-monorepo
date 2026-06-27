# Scanner · Select Student

> Lyceum (Modern Scholarly). Tokens/components by reference — see
> `00-FOUNDATION.md` and the DS bundle (`window.LvlupV0DesignSystem_5d0725`). No
> raw hex; status is always icon + text label.

## Purpose & user

Flow step 2 of the answer-sheet intake. A **scanner** (membership role
`scanner`, status `active`, on a tenant where `features.scannerAppEnabled` is
true) has picked an exam and now picks the **student** whose physical answer
sheet they are about to photograph. Optimised for fast, one-thumb selection at a
desk while holding paper: large search, large tappable rows, roll number
prominent for matching against the sheet header.

## Entry / route

- Route: `#/scan/e/:examId` (flow step 2). `params.examId` is the chosen exam.
- Reached from **Select Exam** (`#/scan`). Back affordance calls `nav.back()`.
- Header title = `ctx.selectedExam.title` (fallback mock if absent).
- Forward: tapping a student →
  `nav.go('#/scan/e/'+params.examId+'/s/'+student.id+'/capture')`.

## Layout sketch (390 wide, scrolls vertically)

```
┌──────────────────────────────────────────┐
│ ‹ back   Mathematics — Mid-Term  (chip)   │  exam header (sticky)
│          Select a student                 │
│ ┌────────────────────────────────────────┐│
│ │ 🔍  Search name or roll number          ││  search input (sticky)
│ └────────────────────────────────────────┘│
│  24 active students            ↕ scroll    │
│ ┌────────────────────────────────────────┐│
│ │ (AV)  Aarav Sharma            ›          ││  student row (≥44px)
│ │       10-A · roll 1024                   ││
│ ├────────────────────────────────────────┤│
│ │ (AV)  Diya Patel   ✓ Submitted  ›        ││  already-submitted warn badge
│ │       10-A · roll 1031                   ││
│ │ … more rows …                            ││
│ └────────────────────────────────────────┘│
└──────────────────────────────────────────┘
```

## Components used (from DS bundle)

- `Input` — search (name / roll), `aria-label`, leading search affordance.
- `Avatar{initials,size:'sm'}` — per-student identity.
- `Chip` — class/section chip per row.
- `Badge{variant}` — "Submitted" warn badge (icon + label) on already-done
  students.
- `Icon` — `chevron-left` (back), `chevron-right` (row affordance), `search`,
  status icons.
- `EmptyState` — no-match and zero-active states.
- `Skeleton` — loading rows.
- `Alert` — inline warn when tapping an already-submitted student
  (confirm-to-recapture).
- `IconButton` — back button (≥44px hit area).
- Custom `select-row` for precise layout (avatar + name + mono roll + class
  chip + chevron).

## States

- **Loading**: 5 skeleton rows (avatar circle + two text bars).
- **Loaded (default)**: scrollable list of active students; count label above
  list.
- **Filtered**: live filter on lowercased name or roll substring; result count
  updates.
- **No match**: `EmptyState` (icon `search-x`) with "Clear search" action.
- **Empty roster**: `EmptyState` (icon `users`) — no active students enrolled.
- **Already-submitted**: subtle `Badge variant="warning"` ("Submitted", icon
  `check`) on the row. Tap still allowed; opens a confirm `Alert`/sheet warning
  that a new capture creates a duplicate, server may reject (`already-exists`).
  One example seeded.
- **Error** (documented state tile): roster load failure → retry.

## Interactions

- Type in search → debounced (mocked instant) substring filter on name + roll.
- Tap an un-submitted row → `nav.go(captureRoute)`.
- Tap an already-submitted row → open local confirm sheet; "Capture anyway"
  proceeds, "Cancel" dismisses. Never silently re-submit.
- Back → `nav.back()`.
- Whole row is the target (≥44px); chevron is decorative.

## Domain rules surfaced

- **Tenant model**: students come from `tenants/{tenantId}/students` scoped to
  the scanner's tenant; only `status:'active'` shown.
- **Answer key hidden**: this surface shows only roster identity (name, roll,
  class). No marks, no answer key, no grades — never shown to the scanner.
- **Server-side submit**: this screen only _navigates_ to capture. The
  submission id and doc are allocated server-side by the `uploadAnswerSheets`
  callable after upload; the frontend never writes the submission doc, and the
  duplicate guard (`already-exists`) lives on the server — the "Submitted" badge
  is an advisory hint, not the source of truth.
- **No roll edits**: scanner cannot mutate roster here; read-only selection.

## Accessibility

- Each row is a `button` with a composed `aria-label` (name, class, roll,
  submitted-state).
- Search `Input` has an explicit `aria-label`; result count is announced via
  `aria-live="polite"`.
- Status badge = icon + visible text ("Submitted"), never colour alone.
- Hit targets ≥44px; visible focus ring via tokenised outline.
- Confirm sheet traps focus and is dismissible.

## Web ↔ mobile note

Mobile-first PWA at 390px: single-column tappable list, sticky exam header +
sticky search, large touch rows. A desktop intake equivalent would render the
same roster as a `DataTable` with inline search and the "Submitted" state as a
status column; selection becomes a row action rather than a full-row tap.
