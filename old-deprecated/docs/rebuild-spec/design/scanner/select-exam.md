# Scanner · Select Exam (Scan tab home)

Anchors to Lyceum (Modern Scholarly). See `00-FOUNDATION.md` §7 and the Lyceum
token/component reference — tokens are referenced, not duplicated here.

## 1. Purpose & user

Operator-facing home of the **Scan** flow (flow step 1 of 4). The user is a
**scanner** — front-desk / invigilation staff at a tuition center who
batch-captures handwritten answer sheets. The screen orients them (who am I,
which school) and lets them pick the exam whose sheets they are about to scan.
Calm, fast, glanceable; this person repeats the flow dozens of times an hour.

## 2. Entry / route

- Route: `#/scan` — the Scan tab home and the default landing after login.
- Reached from: app launch (default tab), the Scan tabbar item, or `nav.back()`
  from `#/scan/e/:examId` (select-student).
- Exit: tapping an exam Card → `nav.go('#/scan/e/' + exam.id)`, setting
  `ctx.selectedExam`.

## 3. Layout sketch (390×844, body only — shell paints topbar + tabbar)

```
┌───────────────────────────────┐
│ Dashboard header              │  Avatar(initials) + name + school-code chip
│ [Avatar] Priya Nair           │
│          Sunrise Academy  ⌄    │  code chip (mono) · collapse toggle for guide
├───────────────────────────────┤
│ 1 Pick exam · 2 Pick student  │  4 numbered quick-guide chips (collapsible)
│ 3 Capture   · 4 Submit         │
├───────────────────────────────┤
│ 🔍 Search exams…              │  Input — filters by title / subject
├───────────────────────────────┤
│ ┌ Exam Card (interactive) ───┐│  title · subject Badge
│ │ Mathematics — Unit Test    ││  date(mono) · marks · Q-count
│ │ [Algebra]      [Published] ││  status Badge (icon + label)
│ └────────────────────────────┘│
│ ┌ … more exam cards (date ↓) ┐│
└───────────────────────────────┘
```

No sticky submit bar on this screen (capture/review own that); the body simply
scrolls.

## 4. Components used

- DS: `Avatar`, `Badge`, `Chip`, `Card{interactive}`, `Input`, `Icon`,
  `EmptyState`, `Skeleton`, `Button` (collapse toggle).
- Domain: none rendered here (no answer sheets yet).
- Local: `SelectExamView({nav,params,ctx})`; helpers `Guide` (quick-guide
  chips), `ExamRow` (exam Card), `STATUS_META` (status → icon/label/badge
  variant).

## 5. States

- **Loading** — 3 Skeleton exam tiles (title/meta/badge bars).
- **Populated** — exam Cards ordered by `date` desc.
- **Filtered-empty** — search matches nothing → EmptyState `icon='search-x'`,
  "No exams match", clear-search action.
- **Empty** — no scannable exams → EmptyState `icon='clipboard-list'`, "No exams
  ready to scan yet", calm body.
- **Guide collapsed/expanded** — quick-guide toggles via local `useState`;
  persists nothing.
- Status is shown as Badge with **icon + text** (`Published` = `check-circle`
  info; `Grading` = `pencil-ruler`/`loader` spark) — never color alone.

## 6. Interactions

- Type in search → live filter by title + subject (case-insensitive).
- Tap exam Card (whole card is the ≥44px target) → set `ctx.selectedExam` (via
  `ctx.setSelectedExam` if present, else best-effort) and
  `nav.go('#/scan/e/'+id)`.
- Tap guide chevron → collapse/expand quick guide.
- Keyboard: cards are `role="button"`, `tabIndex=0`, Enter/Space activate.

## 7. Domain rules surfaced

- **Tenant model**: scanner belongs to one tenant; header shows
  `ctx.scanner.school` + `code` chip. Exams are read from that tenant only.
- **Listed exams**: only `status ∈ {published, grading}` are scannable — the
  list never shows draft/archived/closed exams. Surfaced as the `Published` /
  `Grading` status Badge.
- **Answer key hidden**: scanner never sees questions, marks scheme, or answer
  keys — only metadata (title, subject, date, total marks, Q-count). No drill-in
  to content.
- **Server-side submit**: selection here only chooses the exam; the actual
  submission doc is allocated server-side later by the `uploadAnswerSheets`
  callable. This screen writes nothing to the backend.
- Region `asia-south1` (informational; no call on this screen).

## 8. Accessibility

- Each exam Card: `role="button"`, `tabIndex=0`, descriptive `aria-label`
  (title, subject, date, marks, question count, status), Enter/Space activation.
- Search Input has an associated label / `aria-label`.
- Quick-guide toggle button: `aria-expanded`, `aria-controls`.
- Status badges convey state with icon + visible text (color-independent); meets
  WCAG 1.4.1.
- Touch targets ≥44px (cards, chips, toggle).

## 9. Web ↔ mobile note

This is a mobile-first PWA screen (390px). On larger viewports the same data
renders as a denser two-column exam grid or a DataTable with the identical
columns (subject, date, marks, Q-count, status); the dashboard header becomes a
slim toolbar. The interaction model (pick exam → scan flow) is unchanged.
