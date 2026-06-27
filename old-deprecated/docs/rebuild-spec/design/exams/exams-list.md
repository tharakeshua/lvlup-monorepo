# Exams List

_The exam index hub — a tenant-scoped, status-aware dashboard where teachers and
admins triage every Exam, jump into grading review, and launch the create-exam
wizard._

## 1. Purpose & primary user

**Primary user:** Teacher (subject owner) and Admin, role-gated by
`canCreateExams`.

**Job-to-be-done:** "Show me every exam I own or co-own in this tenant, at a
glance, so I can (a) see which ones need my attention right now — submissions
awaiting review, grading in progress, failures — (b) find a specific exam fast
by subject/class/date, and (c) start a new exam." This is the landing surface
for the entire EXAMS (AutoGrade) area; almost every other exam screen is reached
through a row here.

The screen is a **triage and navigation hub**, not a data-entry surface. Its
core value is making the pipeline state of many exams legible at once —
especially surfacing exams in `grading`, `completed` (graded, awaiting release),
and any failure-adjacent states so review work is never silently stuck.

## 2. Entry points & route

**Route:** `/exams` (teacher-web). Rendered inside `AppShell`; the Sidebar
"Exams" nav item is active.

**Entry points:**

- Primary nav (Sidebar → Exams).
- `CommandPalette` (⌘K) → "Go to Exams" and "Create exam".
- Post-create redirect: after the `/exams/new` wizard publishes, the user
  returns here (or to the new exam detail).
- Breadcrumb root for all `/exams/:examId*` screens (`Exams / {title}`).

**Reads (common-API repos — live, tenant-scoped):**

- `exams.list` — the exam collection for the active tenant. Supplies `title`,
  `subject`, `topics[]`, `classIds[]`, `examDate`, `status` (`ExamStatus`),
  `stats?{totalSubmissions, gradedSubmissions, avgScore, passRate}`,
  `createdBy`, `updatedAt`.
- Class label resolution: classIds → human names via the classes repo (or
  denormalized labels on the Exam). Subjects/topics come straight off the doc.

**Writes / actions invoked from this screen:**

- `saveExam` (mode delete/archive) — row-level "Archive" / "Delete draft"
  actions; server enforces the `ExamStatus` machine and
  `POST_PUBLISH_LOCKED_FIELDS`. The list never mutates locked fields; it only
  triggers status transitions the server authorizes.
- Navigation only for everything else: row click → `/exams/:examId`
  (exam-detail-overview); "Review submissions" quick action →
  `/exams/:examId/submissions`.
- "Create exam" CTA → `/exams/new`.

No grading callables (`gradeQuestion`, `extractQuestions`, `uploadAnswerSheets`)
are invoked here — those live downstream. This screen is read-mostly.

## 3. Layout — wireframe-as-text

Within `AppShell` (Sidebar left, Topbar top with tenant switcher / search /
notifications / profile). Content column capped at max width 1200, page gutters
per breakpoint (mobile 16 / tablet 24 / desktop 32).

### lg (≥1024) — DataTable primary

```
┌─ AppShell ────────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (tenant · ⌘K search · notif · profile)                    │
│         ├──────────────────────────────────────────────────────────────────┤
│ [Exams]*│  Exams                                    [ + Create exam ]       │  ← h1 (Fraunces) + spark CTA
│         │  Manage and review every assessment in this tenant.              │  ← subtitle text.secondary
│         │                                                                   │
│         │  ┌ Filter bar (sticky) ───────────────────────────────────────┐  │
│         │  │ [🔍 Search title/subject] [Status ▾][Subject ▾][Class ▾]   │  │
│         │  │                                   [Sort: Date newest ▾]     │  │
│         │  └─────────────────────────────────────────────────────────────┘  │
│         │                                                                   │
│         │  ┌ DataTable ─────────────────────────────────────────────────┐  │
│         │  │ Exam            Classes      Date     Status     Subs  Avg  ⋮│  │
│         │  ├─────────────────────────────────────────────────────────────┤  │
│         │  │ Calculus Mid…   [10A][10B]  12 Jun   ◐ Grading   24/30  68% ⋮│  │
│         │  │ Organic Chem…   [11C]       09 Jun   ✓ Released  28/28  74% ⋮│  │
│         │  │ Physics Unit…   [10A]       —        ✎ Draft     —      —   ⋮│  │
│         │  │ History Term…   [12A][12B]  02 Jun   ⚑ Review    19/31  —   ⋮│  │
│         │  └─────────────────────────────────────────────────────────────┘  │
│         │  [ Pagination ‹ 1 2 3 › ]                  Showing 1–25 of 142    │
└─────────┴──────────────────────────────────────────────────────────────────┘
```

Column set: **Exam** (title + subject sub-line + topic chips, truncated),
**Classes** (class `Chip`s, +N overflow), **Date** (`examDate`, mono, em-dash if
unset), **Status** (status `Badge`, icon+label), **Submissions**
(`gradedSubmissions/totalSubmissions`, mono, with a thin `ProgressBar`
underlay), **Avg** (`stats.avgScore`% mono, em-dash pre-grading), **⋮** row menu
(`IconButton` → `Popover`).

### md (768–1023) — condensed table

Same DataTable; collapse Subject into the Exam cell and drop the Avg column into
the row menu / detail. Classes shown as a single chip + "+N". Filter bar wraps
to two rows; Sort moves under filters.

### sm (<768) — stacked SubmissionCard-style grid

Table → vertical list of `Card`s (one exam per card). Filter bar collapses to a
Search input + a "Filters" `Button` opening a `Drawer/Sheet` with
Status/Subject/Class/Sort controls. CTA "Create exam" becomes a sticky
bottom-right `Button` (spark). Each card:

```
┌ Card ───────────────────────────────────┐
│ Calculus Midterm        ◐ Grading        │  ← title (Fraunces) + status Badge
│ Mathematics · 10A 10B                    │  ← subject · class chips
│ 12 Jun 2026                              │  ← examDate (mono)
│ ▓▓▓▓▓▓▓░░░  24/30 graded · avg 68%       │  ← ProgressBar + Stat
│              [Review] [⋮]                 │  ← quick action + menu
└──────────────────────────────────────────┘
```

## 4. Components used

From the Lyceum inventory only:

- **Navigation:** `AppShell`, `Sidebar`, `Topbar`, `Breadcrumb` (root crumb),
  `CommandPalette` (⌘K entries), `Tabbar` (mobile shell), `RoleSwitcher` (if
  multi-role).
- **Header / CTA:** `Button` (variant **spark** for "Create exam" — this is the
  area's hero CTA; spark glow allowed), h1 in Fraunces.
- **Filter bar:** `Input` (search, debounced), `Select` (Status, Subject, Class,
  Sort), optionally `Combobox` for Class when the tenant has many classes,
  `Chip/Tag` for active-filter pills with clear-all.
- **Data:** `DataTable` (sort/filter/paginate/select) as the lg/md primary;
  `Card` grid for sm; `Badge` (status, icon+label), `Chip/Tag` (classes,
  topics), `Stat/KPI` (inline avg/pass-rate), `ProgressBar` (graded/total),
  `Pagination`, `Avatar` (createdBy, optional), `Skeleton` (loading),
  `EmptyState` (no exams / no results).
- **Row actions:** `IconButton` (⋮) → `Popover` menu; `ConfirmDialog` for
  Archive/Delete; `Tooltip` on truncated titles and status icons.
- **Feedback:** `Toast` (sonner) for archive/delete success/failure,
  `InlineAlert/Banner` for a partial-load or tenant-scope warning,
  `LoadingOverlay` only on a destructive action in flight.
- **Domain:** `GradePill` is **not** used at list level (per-exam avg is an
  aggregate `Stat`, not a single graded letter); `ConfidenceBadge` is
  downstream. No proposed additions needed — the screen composes fully from
  existing primitives.

## 5. States

**Loading (skeleton):** Filter bar renders enabled; table body shows 6–8
`Skeleton` rows matching column widths (title shimmer wider, status/date
narrow). On sm, 4–5 skeleton `Card`s. Header + CTA render immediately. Skeletons
use `bg.surface-sunken` shimmer; no layout shift on resolve.

**Empty — no exams in tenant:** `EmptyState` with Fraunces title, body copy, and
a primary **spark** `Button` "Create your first exam". Only shown to
`canCreateExams`; non-creators see a read-oriented variant (see permissions).

**Empty — no results after filter/search:** Distinct `EmptyState` ("No exams
match these filters") with a "Clear filters" ghost `Button`. Never reuse the
first-run empty copy here — it would imply the tenant has no exams.

**Error (load failed):** `InlineAlert` (status.error, icon + label) above the
table: "Couldn't load exams." with a "Retry" `Button` that re-invokes
`exams.list`. Preserve filter state across retry. If the failure is a
tenant-scope/permission error, copy says "You don't have access to exams in this
tenant" and the CTA is hidden.

**Partial:** If `exams.list` returns docs but `stats` is absent or stale for
some rows (e.g. an exam mid-`grading`), those cells render an em-dash with a
`Tooltip` "Stats update as grading completes" rather than `0`. A live `grading`
row shows the `ProgressBar` advancing from `gradingProgress` if available;
otherwise an indeterminate bar with the `◐ Grading` badge. Rows in
failure-adjacent states (`scouting_failed`/`grading_failed` aggregated up, or
any submission `manual_review_needed`) surface a `⚑ Needs review` affordance and
sort toward the top under the default "Attention" sort.

**Success:** Populated DataTable / card grid, `Pagination` reflecting total,
active-filter `Chip`s shown, sort indicator on the active column header.

**Permission / role-gated variations:**

- `canCreateExams === false`: "Create exam" CTA hidden everywhere (header, sm
  sticky button, ⌘K). Row ⋮ menu omits Archive/Delete; rows are click-through
  (read-only review) only. First-run empty state shows a neutral "No exams have
  been created in this tenant yet" without a CTA.
- Admin: identical surface plus a link affordance to `/analytics/exams` and (for
  failure triage) a hint toward the DLQ in `/ai-usage`; not a separate layout.
- Tenant isolation is absolute: the list only ever contains the active tenant's
  exams (`exams.list` is tenant-scoped server-side); switching tenant in the
  Topbar refetches and resets filters.

## 6. Interactions & motion

**Filtering & search:** Search input debounced ~250ms; filters apply
optimistically on the already-loaded page and refetch when crossing
pagination/sort. Active filters render as removable `Chip`s; "Clear all" resets
to default. Filter/sort changes animate row re-order with a subtle list
transition (motion **fast 160ms**, `ease.standard`) — no large springs (springs
are reserved for gamification only).

**Sort:** Default sort = "Attention" (failure/needs-review first, then
`grading`, then `examDate` desc). Header click or the Sort `Select` toggles; the
active column shows a direction caret. Sort changes feel **base 220ms**.

**Row click → detail:** Whole row is the navigation target → `/exams/:examId`.
Page transition uses **page 420ms** `ease.entrance`. ⋮ menu and inline action
buttons `stopPropagation` so they don't trigger navigation.

**Quick action "Review submissions":** On rows with submissions awaiting review,
an inline `Button` (secondary) routes to `/exams/:examId/submissions`. Appears
on hover (lg) / always (sm).

**Archive / Delete (row ⋮):** Opens `ConfirmDialog` (modal, **e3**). Delete is
offered only for `draft`; published+ exams offer Archive. On confirm, optimistic
row removal/dim with a `Toast` "Exam archived — Undo"; Undo within ~6s
re-inserts. The actual mutation is `saveExam`; if the server rejects (status
machine / locked fields), the optimistic change rolls back with an error `Toast`
and `InlineAlert`. Reduced-motion: cross-fade instead of slide-out.

**Create exam:** Spark `Button` → `/exams/new`. Hover lifts with **spark glow**
(hero-CTA only) at **fast 160ms**.

**Reduced motion:** All list re-orders and page transitions degrade to instant
cross-fades; no glow pulse.

## 7. Content & copy

Tone: precise, operational, staff-facing. No exclamation, no encouragement copy
(that register is for students).

- **h1:** "Exams"
- **Subtitle:** "Manage and review every assessment in this tenant."
- **Primary CTA:** "Create exam"
- **Search placeholder:** "Search by title or subject"
- **Filter labels:** "Status", "Subject", "Class", "Sort"
- **Sort options:** "Attention (default)", "Exam date · newest", "Exam date ·
  oldest", "Recently updated", "Title A–Z"
- **Column headers:** "Exam", "Classes", "Date", "Status", "Submissions", "Avg"
- **Status badge labels** (icon + label, never color alone): "Draft", "Paper
  uploaded", "Paper extracted", "Published", "Grading", "Completed", "Results
  released", "Archived". (Vestigial `ocr_*` states are never surfaced.)
- **Submissions cell:** "{gradedSubmissions}/{totalSubmissions} graded";
  pre-submission "No submissions yet" (muted).
- **Needs-review affordance:** "Needs review" with a flag icon.
- **Empty (first run):** Title "No exams yet" · Body "Create an exam to upload a
  question paper, let AutoGrade extract questions, and start grading." · CTA
  "Create your first exam".
- **Empty (no results):** Title "No exams match these filters" · Body "Try a
  different status, subject, or search term." · CTA "Clear filters".
- **Error:** "Couldn't load exams." / "Retry". Permission error: "You don't have
  access to exams in this tenant."
- **Archive confirm:** "Archive this exam? It will be hidden from the active
  list but submissions and results are kept." Buttons "Archive" (danger) /
  "Cancel".
- **Delete (draft only) confirm:** "Delete this draft? This can't be undone."
  Buttons "Delete" (danger) / "Cancel".
- **Toasts:** "Exam archived" (with Undo), "Draft deleted", "Couldn't archive
  exam — try again."

## 8. Domain rules surfaced

- **Server-authoritative status.** Every status `Badge` reflects the
  `ExamStatus` machine governed by `saveExam`; the list renders state, it does
  not compute or override it. Archive/Delete only request transitions the server
  permits.
- **Post-publish field locks.** No editable exam fields appear in the list, so
  `POST_PUBLISH_LOCKED_FIELDS` can't be violated here. The ⋮ menu offers Delete
  only for `draft`; once `published`, only Archive (a status transition, not a
  field edit) is offered.
- **Tenant isolation.** `exams.list` is tenant-scoped; the list can only ever
  show the active tenant's exams. Tenant switch (Topbar) forces a clean refetch
  — no cross-tenant leakage, no stale rows.
- **Answer keys / rubrics / model answers are never rendered here.** The list
  shows aggregates (counts, avg, pass rate) only — no question text, rubric, or
  `modelAnswer`. This is staff UI, but the same guard principle holds: sensitive
  grading material lives only in detail/grading screens, server-gated.
- **Confidence routing drives attention.** Although per-question
  `ConfidenceBadge` is downstream, its _consequence_ surfaces here: exams whose
  submissions contain `needs_review` / `manual_review_needed` questions
  (confidence `<confidenceThreshold` 0.7, or service-degraded grading captured
  in `gradingDeadLetter`) bubble up under the default "Attention" sort and carry
  the "Needs review" flag. The list is the entry point that says "human is
  required over here."
- **Results-release gating is visible.** The `Completed` vs `Results released`
  badges distinguish "graded but not yet visible to students/parents" from
  "released." Teachers can see at a glance which exams still need an explicit
  release before learners can read results.
- **uploadSource awareness.** Counts include submissions from both `web` and
  `scanner` intake; no distinction is drawn at list level.

## 9. Accessibility

- **Semantics:** `DataTable` is a real `<table>` with `<th scope="col">` headers
  and sortable columns exposing `aria-sort`. On sm, the card grid is a
  `<ul>`/`<li>` list; each card is a single primary link with the row menu as a
  sibling control (not nested in the link).
- **Status never by color alone:** every status `Badge` pairs an icon + text
  label; `ProgressBar` carries `aria-label` "{graded} of {total} submissions
  graded". Confidence/attention conveyed by flag icon + "Needs review" text, not
  color.
- **Focus order:** Skip-link → h1 → Create CTA → search → filters → sort → table
  headers → rows (top-to-bottom) → row menus → pagination. Row navigation is
  keyboard-activatable (Enter/Space on focused row); ⋮ menu opens with Enter,
  arrow-navigable, Esc closes and returns focus to the trigger.
- **Keyboard:** ⌘K palette reachable for "Create exam"/"Go to Exams". Sort
  headers operable via keyboard. `ConfirmDialog` traps focus, Esc cancels, focus
  returns to the originating ⋮ trigger.
- **Contrast:** All text/badge/background pairs meet WCAG AA (4.5:1 body, 3:1
  large/UI) per Lyceum tokens; status badges use the semantic `status.*` and
  domain scales which are AA-verified.
- **Reduced motion:** Respect `prefers-reduced-motion` — list re-orders and page
  transitions become instant cross-fades; no spark glow pulse; Toast/Undo still
  functional.
- **Announcements:** Filter/result-count changes announce via an
  `aria-live="polite"` region ("Showing 12 of 142 exams"); archive/delete
  results announce via Toast region.

## 10. Web↔mobile divergence

| Concern         | teacher-web (today)                         | Future RN / scanner-web                                                                                                                            |
| --------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary layout  | `DataTable` (lg/md), `Card` grid (sm)       | Always stacked `SubmissionCard`-style `Card` list                                                                                                  |
| CTA             | Header spark `Button`                       | Sticky bottom FAB-style spark `Button`                                                                                                             |
| Filters         | Inline filter bar                           | "Filters" button → `Drawer/Sheet`                                                                                                                  |
| Interaction     | Hover reveals quick actions, row hover lift | Press states; quick actions always visible or via long-press menu                                                                                  |
| Command palette | ⌘K (`CommandPalette`)                       | None — use `Tabbar` + search                                                                                                                       |
| Sort            | Column-header click + Sort `Select`         | Sort `Select` inside the filter sheet                                                                                                              |
| Row menu        | ⋮ `Popover`                                 | Long-press / overflow sheet                                                                                                                        |
| scanner-web     | n/a                                         | A pared intake variant may surface only exams in `published`/`grading` accepting uploads, with `uploadSource: scanner`; same tokens, fewer columns |

Component **names/props match 1:1** across `shared-ui` and `ui-native`; only the
renderer differs.

## 11. Claude-design prompt

```
Design the "Exams List" screen for Auto-LevelUp's teacher-web app, conforming EXACTLY to the
Lyceum design system (docs/rebuild-spec/design/00-FOUNDATION.md — "Modern Scholarly"). Do not
invent tokens, fonts, or component variants; compose only from the Lyceum inventory and cite
tokens by name.

CONTEXT: This is /exams — the entry hub for the EXAMS (AutoGrade) area. A teacher/admin (gated by
canCreateExams) needs to triage every Exam in the active tenant and start new ones. Data comes
from the tenant-scoped repo read `exams.list`, giving each Exam: title, subject, topics[],
classIds[], examDate, status (ExamStatus: draft | question_paper_uploaded | question_paper_extracted
| published | grading | completed | results_released | archived), and stats{totalSubmissions,
gradedSubmissions, avgScore, passRate}.

LAYOUT: Render inside AppShell (Sidebar + Topbar). Fraunces h1 "Exams" + Schibsted Grotesk subtitle.
A spark-variant Button "Create exam" → /exams/new (hero CTA; spark glow allowed). A sticky filter
bar: search Input (placeholder "Search by title or subject"), Status/Subject/Class Selects, and a
Sort Select defaulting to "Attention". Primary content is a DataTable (lg/md) with columns:
Exam (title + subject + topic Chips), Classes (Chips +N overflow), Date (examDate, Spline Sans Mono),
Status (Badge — icon + label, NEVER color alone), Submissions ("{graded}/{total} graded" mono with a
ProgressBar underlay), Avg (avgScore% mono, em-dash before grading), and a ⋮ row menu (IconButton →
Popover). On sm, collapse the table into stacked Cards (SubmissionCard style) and move filters into a
Drawer/Sheet; CTA becomes a sticky bottom Button. Pagination + "Showing X of Y".

STATES: Skeleton rows on load; two distinct EmptyStates ("No exams yet" first-run with spark CTA vs
"No exams match these filters" with Clear-filters); InlineAlert + Retry on load error; partial state
where mid-grading rows show an em-dash + Tooltip for missing stats and an advancing ProgressBar; rows
needing human review carry a flag icon + "Needs review" and sort to top. If canCreateExams is false,
hide all Create affordances and Archive/Delete; rows are read-only click-through.

INTERACTIONS & MOTION: Debounced search; active filters as removable Chips; row click → /exams/:examId
(page 420ms, ease.entrance); ⋮ → Archive (published+) / Delete (draft only) via ConfirmDialog with an
optimistic Toast + Undo, rolling back on saveExam rejection. List re-orders at fast 160ms, ease.standard.
Reserve springs/glow for gamification only — none here except the CTA's spark glow. Respect
prefers-reduced-motion (instant cross-fades).

DOMAIN RULES: Status is server-authoritative (saveExam state machine) — render, never compute. Tenant
isolation absolute (only active-tenant exams; tenant switch refetches). Never render answer keys,
rubrics, or modelAnswer here. Distinguish "Completed" (graded, not yet visible) from "Results released"
(students/parents can read). Surface confidence-routing consequences: exams with needs_review /
manual_review_needed submissions bubble up under the default Attention sort. Delete only for drafts;
post-publish only Archive (no field edits — POST_PUBLISH_LOCKED_FIELDS).

A11Y: real <table> with aria-sort; status as icon+label+text; ProgressBar aria-label; logical focus
order; keyboard-activatable rows and menus; AA contrast via semantic status.* and domain scales;
aria-live result-count announcements.

Use Fraunces (display/h1, empty-state titles), Schibsted Grotesk (UI/body/labels/table), Spline Sans
Mono (dates, scores, counts). Spacing on the 4px scale, cards radius lg, buttons/inputs radius md,
chips pill, warm-tinted elevation e1 cards / e2 popovers / e3 modals, indigo focus ring. Deliver
production-ready React + Tailwind composing shared-ui components.
```
