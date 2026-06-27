# Scanner · Scan History (History tab)

Anchors to Lyceum (Modern Scholarly). See `00-FOUNDATION.md` §7 and the Lyceum
token/component reference — tokens are referenced, not duplicated here.

## 1. Purpose & user

A read-only ledger of everything this **scanner** has submitted, with live
pipeline progress. The user is front-desk / invigilation staff who
batch-captures answer sheets dozens of times an hour and wants reassurance that
earlier submissions actually landed and are moving through the grading pipeline.
This screen never reveals grades or answer keys — only _where in the pipeline_
each submission is. Calm, glanceable, grouped by day so "today's work" is
obvious.

## 2. Entry / route

- Route: `#/history` — the **History** tabbar item.
- Reached from: the History tab, or `nav.go('#/history')` from the
  submit-confirm success screen ("View in history").
- Exit: tapping a row opens a right-side **history-item-detail Drawer**
  (in-view, local state). No forward navigation off this screen; the Drawer
  closes back to the list.

## 3. Layout sketch (390×844, body only — shell paints topbar + tabbar)

```
┌───────────────────────────────┐
│ History            12 subs    │  title (display) + mono count
│ 🔍 Search student / exam…     │  search Input
│ [All] [Today] [By exam]       │  filter Chip row (active = filled)
├───────────────────────────────┤
│ TODAY · 20 Jun                │  date group header (mono eyebrow)
│ ┌ SubmissionCard ───────────┐ │  initials · name
│ │ AK  Aarav Kumar           │ │  meta = exam · N pages · time
│ │     Math UT3 · 3 pg · 9:14 │ │  pipeline Badge (icon+label) →
│ │                  ⟳ Grading │ │  chevron affordance
│ └───────────────────────────┘ │
│ … more rows                   │
│ YESTERDAY · 19 Jun            │
│ ┌ SubmissionCard ─ ✓ Graded ┐ │
│ └───────────────────────────┘ │
└───────────────────────────────┘
   tap row → Drawer (right):
   exam · student · roll · page thumbs ·
   submitted-at (mono) · pipeline Timeline
```

No sticky submit bar here (capture/review own that); the body scrolls.

## 4. Components used

- DS: `Input`, `Chip`, `SubmissionCard`, `Badge`, `Icon`,
  `Drawer{open,onClose,title}`, `Timeline{items}`, `DefinitionList`,
  `EmptyState`, `Skeleton`, `Avatar`.
- Domain: `SubmissionCard` for each row; pipeline status surfaced as a `Badge`
  (icon + label), never color-alone.
- Local: `HistoryView({nav,params,ctx})`; helpers `HistoryFilters` (chip row +
  search), `HistoryRow`, `HistoryDrawer`, `STATUS_META` (status →
  icon/label/badge variant + spin flag), `fmtTime`, `groupByDay`.

## 5. States

- **Loading** — 4 Skeleton submission rows under one group header.
- **Populated** — submissions grouped by submitted-day (Today / Yesterday /
  date), newest first within group.
- **Filter chips** — `All` (default) / `Today` (only today's group) / `By exam`
  (sort/group emphasis by exam). Active chip is filled.
- **Search** — live filter by student name or exam title (case-insensitive);
  filtered-empty → EmptyState `search-x`.
- **Empty** — scanner has submitted nothing yet → EmptyState `inbox`, calm body
  pointing to the Scan tab.
- **Pipeline status** (icon + label, never color alone):
  - `Uploaded` → `clock` (neutral) — images received, awaiting mapping.
  - `Mapping` → `loader` (info, spinning) — pages being matched to questions.
  - `Grading` → `loader` (spark, spinning) — AI/teacher grading in progress.
  - `Graded` → `check-circle` (success) — pipeline complete (no score shown).
- **Drawer open** — local `useState`; one open item at a time; scrim + Esc/Close
  dismiss.

## 6. Interactions

- Type in search → live filter by student name + exam title.
- Tap a filter Chip → switch the visible set (All / Today / By exam);
  single-select.
- Tap a SubmissionCard (whole card ≥44px) → open the right-side Drawer for that
  submission.
- Drawer: shows exam, student, roll (mono), page-thumbnail placeholders,
  submitted-at (mono), and a read-only pipeline `Timeline`. Close via the
  Drawer's X, the scrim, or Esc.
- Keyboard: rows are `role="button"`, `tabIndex=0`, Enter/Space activate; chips
  are buttons.

## 7. Domain rules surfaced

- **Tenant model**: history is scoped to this scanner's tenant and to _their_
  submissions only; reads from `ctx.history`. No cross-tenant or cross-scanner
  data.
- **Answer key / grades hidden**: this screen shows _pipeline progress only_ —
  `Uploaded → Mapping → Grading → Graded`. It never surfaces a score, the answer
  key, per-question marks, or grading detail, even when status is `Graded`.
  WCAG-independent of the secrecy rule.
- **Server-side submit**: every row corresponds to a submission id allocated
  server-side by the `uploadAnswerSheets` callable; the frontend never wrote
  these docs and cannot mutate them here — the view is strictly read-only.
- **Listed scope**: only submissions that successfully reached the server appear
  (failed/queued local captures live in the Queue tab, not here). Region
  `asia-south1` (informational; no call beyond the history read).

## 8. Accessibility

- Each row: `role="button"`, `tabIndex=0`, descriptive `aria-label` (student,
  exam, page count, time, pipeline status), Enter/Space activation.
- Filter chips and search Input are labelled; chips expose active state.
- Pipeline status conveyed with icon + visible text (color-independent) — meets
  WCAG 1.4.1.
- Drawer: labelled title, focus-trappable, scrim click + Esc to close; spinning
  loaders are decorative (status text carries meaning).
- Touch targets ≥44px (rows, chips, drawer close).

## 9. Web ↔ mobile note

Mobile-first PWA screen (390px). On larger viewports the same history renders as
a `DataTable` (columns: student, exam, pages, submitted-at, pipeline status)
with the day grouping demoted to a date-filter control, and the detail Drawer
becoming a right-hand side panel or modal. Pipeline status, the read-only
contract, and grade/answer-key secrecy are identical across form factors.
