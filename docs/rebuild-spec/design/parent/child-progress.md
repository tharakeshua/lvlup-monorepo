# Parent — Child Progress

Per-child deep dive into a single child's learning trajectory: trends,
strengths/weaknesses, subject breakdown, and generic next-step guidance.

## Purpose & user

A parent (Anita Sharma) opening the deep-dive view for one child to understand
"how is my kid actually doing, and what should we focus on." Read-only. Released
data only. No answer keys.

## Entry / route

- Route: `#/children/:childId/progress` (e.g. `#/children/aarav/progress`).
- Reached from: sidebar `Progress`, dashboard child card "View progress", or
  Children list row.
- Child selector pill `Tabs` (Aarav | Diya) switch `:childId` without leaving
  the screen.

## Layout (text wireframe)

```
ParentShell (sidebar + topbar, active=progress)
└ main
  ├ Child selector — pill Tabs: [ Aarav ] [ Diya ]
  ├ Page header: <Child> · Grade N · avg %        [ Download report ]  (download icon)
  ├ [AT-RISK ONLY] Alert(error) "<Child> needs attention" + reasons list
  ├ Stat strip (4): Overall score · Exams taken · Spaces completed · Current streak
  ├ Strengths | Weaknesses  (two columns of Chips: check / x icons)
  ├ Performance trends  — inline grouped bar chart, last 6 exams (role=img + sr table)
  ├ Subject breakdown — horizontal ProgressBars per subject
  ├ Generic guidance panel — 2–3 recommendation items (labelled "Generic guidance")
  └ Recent activity — Timeline; exam entries deep-link to results/ex_midterm
```

## Components used (CORE-API)

`Tabs` (pill), `Button` (leadingIcon download), `Alert` (error/info), `Stat`,
`Chip`, `ProgressBar`, `Timeline`, `Icon`, `Badge`, `EmptyState`, `Skeleton`.
Trend chart is composed from div bars (no external lib), tokens only.

## States

- **Loading:** Stat strip + chart as `Skeleton` blocks; `aria-busy`.
- **Empty:** child with no released data yet → `EmptyState` ("No released
  results yet") in place of trends/breakdown.
- **Error:** per-section `Alert(error)` with Retry; never blocks the whole page.
- **Success:** full data as wireframed. At-risk child additionally shows the
  error Alert banner.

## Interactions & flows

- Child pill Tabs → swap dataset (Aarav not-at-risk / Diya at-risk). Active
  child also reflected in topbar child chip.
- `Download report` → would export a PDF summary (prototype:
  `go('#/children/<id>/results')`).
- Recent-activity exam rows → `go('#/children/<id>/results/ex_midterm')`.
- Subject rows are informational (no drill on the prototype).

## Domain rules

- **Released-only:** every score/grade shown is a released result; unreleased
  exams are excluded server-side.
- **Answer keys NEVER shown** to parents — no per-question correctness, no keys,
  no rubric internals.
- **Server-derived:** at-risk flag, averages, streak, completion %,
  strengths/weaknesses, and trend series are computed server-side; the parent
  view only renders them.
- Recommendations are labelled **"Generic guidance"** (rule-based, not
  AI/student-specific).

## A11y

- Trend chart wrapper `role="img"` with descriptive `aria-label`; an off-screen
  `<table>` mirrors the data.
- Every status color paired with an icon + text label (at-risk Alert, strength
  check / weakness x chips, streak).
- Stat strip in a labelled `role="group"`; pill Tabs are keyboard-navigable;
  visible focus rings via `--ring-focus`.
- ProgressBars carry numeric `%` text, not color alone.
