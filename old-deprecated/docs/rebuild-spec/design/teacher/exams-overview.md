# Exams Overview (Operational Monitoring)

> The teacher/admin operational monitoring list of exams across classes: read
> each exam's status, submission progress, awaiting-review backlog, and
> results-release state at a glance — then deep-link into grading or detail.
> Monitoring, not authoring or grading.

**Route** `/exams` · **Roles** `teacher`, `tenantAdmin` · **Primary APIs**
`exams.list` (repo read) · `submissions` counts (repo read / denormalized
`ExamStats`) · `analytics.getSummary` scope `class` (repo read, optional teaser)
→ `v1.autograde.saveExam` status transition (callable write — Release results)

> Conforms to `docs/rebuild-spec/design/00-FOUNDATION.md` ("Lyceum / Modern
> Scholarly"). All tokens, type, spacing, radius, elevation, motion, and
> components are cited by semantic name from FOUNDATION — none are invented
> here. Staff register: precise, credible, calm.

---

## 1. Purpose & primary user

**Primary user:** a `teacher` monitoring exams across the classes they manage,
or a `tenantAdmin` overseeing every exam in the tenant.

**Job-to-be-done:** _"Across all my exams, show me where each one stands —
collecting submissions, awaiting my review, or ready to release — so I know what
needs my attention next and can jump straight into grading or release results."_

This is an **operational monitoring index**, not the authoring surface and not
the grading workbench. The screen answers, in order: _Which exams exist and what
is each one's status? How many submissions are in vs. expected? How many are
awaiting review? Which results are released?_ It then **links out**:

- **"Open"** → exam detail (`/exams/:examId`, EXAMS area) for
  authoring/config/question paper.
- **"Review submissions"** → grading (`/exams/:examId/submissions`, EXAMS area).
- **"New exam"** → the exam create wizard (`/exams/new`, EXAMS area).

The one operational mutation it performs in-place is **Release results** — an
outward-facing status transition (results become visible to students), gated by
config and confirmed.

There is **no XP/streak/celebration chrome** — this is staff tooling. The only
place gamification state would ever appear is a read-only student view
elsewhere; never here.

**Role split:**

- `teacher` — sees only exams whose `classIds` intersect their managed classes
  (claim `classIds` / `managedClassIds`, 15-class JWT-overflow fallback). May
  review and (if permitted) release results for those exams.
- `tenantAdmin` — sees all exams in the active tenant, plus a "Teacher / owner"
  column. Same row actions, tenant-wide scope.

---

## 2. Entry points & route

**Route:** `/exams` (under `PlatformLayout`, in the **Exams** nav group). Row's
"Open" → `/exams/:examId`; "Review submissions" → `/exams/:examId/submissions`.

**Entry points:**

- Sidebar **Exams → Exams** (route-manifest `navMeta` derived; active state by
  longest-prefix match in the shell — note `/exams` must not also light up while
  on a nested `/exams/:examId`, handled by the shell's prefix logic).
- Dashboard "Exams" / "Awaiting review" summary card → "View all exams".
- Command palette (⌘K) → "Exams", plus "New exam" as a palette action.
- Breadcrumb root for `/exams/:examId` and `/exams/new` (Exams → {exam title} /
  New exam).
- Class detail page (`/classes/:classId`) "Exams" tab → links into `/exams`
  pre-filtered by that class.
- Deep link / browser back from exam detail or grading.

**APIs powering it** (all via `@levelup/api-client` repositories / callables; no
direct Firestore — see `specs/webapps-design.md` §5.1, `specs/common-api.md`
§3.3):

- **Read — exam list:** `exams.list` (`ExamsRepo.list`, backed by
  `v1.autograde.listExams`). Server scopes to `ctx.activeTenantId` from claims
  and, for a `teacher`, intersects exam `classIds` with the caller's managed
  classes (overflow fallback). `tenantId` is never in the request body and never
  shown. Uses the unified cursor pagination fragment (`common-api.md` §7).
- **Read — submission progress counts:** primarily the denormalized `ExamStats`
  carried on each `Exam` (`stats.totalSubmissions`, `stats.gradedSubmissions`,
  `stats.avgScore`, `stats.passRate`) — **server-maintained, not
  client-recomputed**. The **expected** count (roster size for the assigned
  classes) and the **awaiting-review** count derive server-side from the
  submission pipeline; where a precomputed field is absent, the list endpoint
  projects them. The client never fans out `getCountFromServer` per exam.
- **Read — class avg teaser (optional):** `analytics.getSummary` scope `class`
  for the exam's class(es), surfacing `avgScore`/`passRate` as a small teaser
  once `results_released`. Server-authoritative; lazily fetched per visible
  page, never blocking the row.
- **Write — Release results:** `v1.autograde.saveExam`
  (`api.autograde.saveExam`) with the status transition to `results_released`.
  The server enforces the `ALLOWED_TRANSITIONS` state machine, honors
  `gradingConfig.releaseResultsAutomatically`, recomputes/freezes the released
  projection, and fires the `onExamResultsReleased` analytics trigger. No client
  Firestore write. No other exam mutation happens on this screen.

---

## 3. Layout (wireframe-as-text)

Renders inside `PlatformLayout` (`@levelup/shared-ui/layout`): persistent
`AppSidebar` (lg+), `Topbar` (tenant switcher, ⌘K search, `NotificationBell`,
profile), `SkipToContent`, `RouteAnnouncer`, `AppBreadcrumb` (Exams),
`OfflineBanner` slot. Page content sits in the shell's main region at max
content width 1200, page gutters 32 (desktop) / 24 (tablet) / 16 (mobile).

```
┌───────────────────────────────────────────────────────────────────────────┐
│ PageHeader region                                                           │
│  ┌───────────────────────────────┐                 ┌──────────────────────┐ │
│  │ H1  "Exams"        (Fraunces)  │                 │ [+ New exam] (Button │ │
│  │ subtitle (text.secondary)      │                 │   variant=primary)   │ │
│  └───────────────────────────────┘                 └──────────────────────┘ │
│  gap-2 below header                                                          │
├───────────────────────────────────────────────────────────────────────────┤
│ Toolbar region (DataTable controls)                                         │
│  [🔎 Search exam title / subject ]  [Class ▾] [Status ▾]   right: [count]   │
│  active filters as removable chips ─────────────────────────────────────────│
├───────────────────────────────────────────────────────────────────────────┤
│ DataTable region (Card, radius lg, e1)                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ Exam ▴ │ Class(es) │ Status │ Marks │ Submissions │ Awaiting │ Results │ ⋯ ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │ Unit 3 Test │ 10-A     │ ●Grading   │ 40/15 │ ▰▰▰▰▱ 28/32 │ ⚠ 12 │ Held  │⋯││
│  │ Mid-term    │ 9-A, 9-B │ ●Collecting│ 80/30 │ ▰▰▱▱▱ 14/56 │  —   │ Held  │⋯││
│  │ Quiz 1      │ 10-B     │ ●Released  │ 20/8  │ ▰▰▰▰▰ 30/30 │  0   │ ✓ Live│⋯││
│  │ Pop Quiz    │ 10-A     │ ○Draft     │ 15/6  │     —       │  —   │  —    │⋯││
│  │ … (rows clickable → /exams/:examId)                                     ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│  Pagination (right-aligned)                                                  │
└───────────────────────────────────────────────────────────────────────────┘
```

**Grid / columns (DataTable):**

1. **Exam** — `title` (UI medium, `Schibsted Grotesk`) + muted `subject`
   caption; links to `/exams/:examId`. Sortable, primary sort. Secondary line
   shows `examDate` (relative, e.g. "in 2 days" / "3 days ago") via the shared
   timestamp formatter.
2. **Class(es)** — `Badge` pill per assigned class (e.g. `10-A`); overflow
   collapses to `+N` with a `Tooltip` listing the rest. Filterable.
3. **Status** — `Badge` (pill) with status dot + label from the operational
   status map (see §7). Color from the domain status scale, **always** paired
   with dot icon + text (never color-only). Sortable.
4. **Marks** — `totalMarks` / `passingMarks` rendered mono (`Spline Sans Mono`),
   e.g. `40 / 15` with a tiny "pass" sublabel. Sortable by total.
5. **Submissions** — `ProgressBar` + mono `received/expected` (e.g. `28/32`).
   Fill is neutral `brand.primary`; bar is **progress**, not performance, so it
   does **not** use the `grade.*` scale. From `stats.totalSubmissions` vs
   server-projected expected. Sortable by received.
6. **Awaiting review** — mono count of submissions/questions needing human
   review (`status.warning` chip with ⚠ when ≥1; muted `0` when none; `—` when
   the exam isn't in a gradable state). Sortable. Deep-links to grading on
   click.
7. **Results** — release state: `Held` (muted), `✓ Live` (`status.success`,
   results released), or `Auto` (a small `Badge` indicating
   `releaseResultsAutomatically` is on and release will/did happen
   automatically). `—` for non-applicable states (draft). Sortable.
8. **Row actions** — trailing `IconButton` `⋯` `DropdownMenu`: **Open** ·
   **Review submissions** · **Release results** (conditional, see §5/§8) ·
   **View analytics** (when released).

A 9th **Teacher / owner** column (`Avatar` + name, resolved from the exam's
owning teacher) is inserted before "Status" **only for `tenantAdmin`**.

**Responsive behavior (mobile-first):**

- **`lg` (≥1024):** full `DataTable`, all columns; sidebar persistent; sticky
  table header within the card.
- **`md` (768–1023):** sidebar collapses to icon rail (shell behavior); table
  drops **Marks** and **Class(es)** into the row's expandable detail; keeps
  Exam, Status, Submissions, Awaiting, Results. Horizontal scroll is a fallback,
  not the default.
- **`sm` (<768):** **table → stacked `Card` list** (one card per exam, the
  canonical web↔mobile divergence). Each card: title + status `Badge`; a
  `ProgressBar` with `received/expected`; an "Awaiting N" chip
  (`status.warning`) when relevant; results-state `Badge`; class chips + marks
  as muted caption; whole card taps → exam detail; trailing `⋯` for actions
  (Review submissions / Release results). `MobileBottomNav` shows; ⌘K
  unavailable. Search collapses to a leading icon that expands a full-width
  `Input`; filters move into a `Sheet` ("Filters"). "New exam" becomes a sticky
  bottom-right primary `Button` / header `+`.

---

## 4. Components used (from FOUNDATION §5 / shared-ui inventory)

All from FOUNDATION §5 and the `specs/webapps-design.md` §2.2 inventory:

- **`PlatformLayout` / `AppShell` / `AppSidebar` / `Topbar` / `AppBreadcrumb` /
  `MobileBottomNav`** (`@levelup/shared-ui/layout`) — the shell.
- **`DataTable`** + headless **`useDataTable`** (`@levelup/shared-ui/data`) —
  owns search, filter, sort, selection, pagination. **Replaces** the live
  `ExamListPage` hand-rolled filter/`Table` plumbing. Includes built-in
  **`Pagination`**.
- **`Button`** — variant `primary` for "New exam" (deep ink `brand.primary`,
  **not** `spark`; spark is reserved for gamification, which this staff surface
  does not use); `ghost`/`secondary` for row/toolbar actions.
- **`Input`** (search), **`Select`** (Class, Status filters) — primitives. Radix
  `Select`: never use empty `""` as a value (use an explicit `"all"` sentinel).
- **`Badge` / `Chip`** (pill) — exam status, class chips, results state, owner.
  Status `Badge` pairs a status dot + label.
- **`ProgressBar`** — submissions received/expected (progress semantics, neutral
  `brand.primary` fill — **not** `grade.*`).
- **`Avatar`** — owner (admin column).
- **`DropdownMenu`** — row `⋯` actions.
- **`ConfirmDialog`** (`@levelup/shared-ui/data`) — the Release-results
  confirmation (outward-facing, high-consequence).
- **`EmptyState`** and **`ErrorState`** (distinct components,
  `@levelup/shared-ui/data`) — empty vs. error are not the same surface.
- **`Skeleton`** — loading rows and per-cell count placeholders (partial state).
- **`Toast` (sonner)** — release confirmation / error feedback.
- **`Card`** — table container (radius `lg`, elevation `e1`) and the `sm`
  stacked-card variant.
- **`Tooltip`** — truncated class lists, status help ("Collecting submissions —
  open for student attempts"), disabled-action reasons, `Auto`-release
  explanation.
- **`InlineAlert` / `Banner`** (`@levelup/shared-ui/feedback`) — optional
  one-line banner when ≥1 exam is "ready to release" (a gentle operational
  nudge), dismissible.

**Domain components surfaced read-only:** none of the heavy grading components
(`RubricBreakdown`, `ConfidenceBadge`, `ManualOverrideControl`, `AnswerKeyLock`)
appear here — they belong to the grading workbench this screen links out to.
**No answer-key data is ever present on this surface.**

**Proposed addition:** none required. The submissions cell composes
`ProgressBar` + mono text; if the "progress fraction + bar" pairing recurs
across exam/assignment screens, promote a small `ProgressFractionCell` to
`@levelup/shared-ui/charts` — but for this screen, compose from existing
primitives; do not add a token or variant.

---

## 5. States

**Loading (skeleton):** `DataTable` renders header + N (≈8) `Skeleton` rows at
row height; toolbar controls render disabled. On `sm`, 4–5 skeleton `Card`s. No
spinner-only screen.

**Partial (the common steady state):** the exam list (`exams.list`) resolves
fast with each exam's denormalized `ExamStats`. The **awaiting-review** and
**expected** counts (and the optional released `avgScore`/`passRate` teaser) may
resolve a beat later — those cells show inline cell-level `Skeleton` until they
land, while the rest of the row is interactive. If an exam has **no stats yet**
(just created, no submissions, or nightly/trigger aggregation not run), show `—`
(not `0`) with a `Tooltip` "No submissions yet" / "Stats update as submissions
arrive." Zeros are reserved for genuine zeros (e.g. a graded exam with 0
awaiting review shows `0`, not `—`).

**Empty:**

- _Teacher, no exams in managed classes:_ `EmptyState` — icon (file/clipboard),
  title **"No exams yet"**, body **"Exams assigned to your classes will appear
  here. Create one to get started."** Primary `Button` "New exam" shown **only
  if** the teacher has create permission; otherwise the body omits the create
  line and shows no CTA.
- _Admin, tenant has no exams:_ title **"No exams yet"**, body **"Create your
  first exam to start collecting and grading submissions."**, primary `Button`
  "New exam".
- _Filtered to nothing:_ title **"No exams match your filters"**, body **"Try a
  different search term or clear the class/status filters."**, secondary
  `Button` "Clear filters". (Distinct from the no-data empty — never shows the
  create CTA.)

**Error:** `ErrorState` (distinct from empty) — title **"Couldn't load exams"**,
body maps `error.details.code` via `ERROR_MESSAGES`/`ERROR_RECOVERY_HINTS`
(`common-api.md` §6). Generic fallback: **"Something went wrong loading your
exams. Check your connection and try again."** Primary `Button` "Retry". A
per-row count fetch failure degrades only those cells to `—` + a small inline
tooltip; it never blanks the whole table. `TENANT_SUSPENDED` /
`PERMISSION_DENIED` surface their specific recovery copy.

**Success:** populated `DataTable` (or card list). Sticky header; sortable
columns show direction caret; active filters show as removable chips below the
toolbar; optional "ready to release" `InlineAlert` when applicable.

**Permission-gated variants by role:**

- `teacher` — list pre-scoped to exams in managed classes; **no** "Teacher /
  owner" column. Row `⋯` shows Open / Review submissions always; **Release
  results** shown only when the exam is releasable AND the teacher has the
  release permission (`TeacherPermissions` — e.g.
  `canManageExams`/`canReleaseResults`); otherwise the item is hidden (not
  disabled) and a tooltip on the row's results cell explains "Release is managed
  by an administrator." "New exam" hidden if the teacher lacks create
  permission.
- `tenantAdmin` — full tenant list; "Teacher / owner" column; all row actions
  available where the state machine permits; "New exam" always available.
  Cross-tenant data never appears (server-scoped by `ctx.activeTenantId`).

**Release-results affordance state matrix** (the affordance honors the
server-enforced state machine and config):

- Status `draft` / `question_paper_uploaded` / `question_paper_extracted` /
  `published` (collecting) → Release **not offered** (no results to release).
- Status `grading` with awaiting-review > 0 → Release **offered but cautioned**
  (ConfirmDialog notes ungraded submissions remain).
- Status `grading`/`completed` with awaiting-review = 0 → Release **offered**
  (the normal path).
- `gradingConfig.releaseResultsAutomatically === true` → Results column shows
  `Auto`; manual Release is **hidden** (or shown disabled with a tooltip
  "Results release automatically when grading completes"); the server is the
  authority.
- Status already `results_released` → Release replaced by **View analytics**;
  results state shows `✓ Live`.

---

## 6. Interactions & motion (cite FOUNDATION motion tokens)

**Search / filter / sort** (via `useDataTable`):

- Typing in search debounces (~`base` 220ms feel) then re-filters; matched rows
  reflow with `ease.standard`. Search matches `title` and `subject`.
- Class / Status `Select` apply immediately; active filters render as removable
  chips (enter `fast` 160ms, `ease.entrance`).
- Column sort toggles asc→desc→none; caret rotates `fast` with `ease.standard`.
  Sort is client-side over the loaded page; large tenants paginate server-side
  via the §7 cursor fragment.

**Row → detail:** click anywhere on a row (except the `⋯` menu and the
interactive Awaiting/Results cells) navigates to `/exams/:examId`. Hover raises
the row to `bg.surface-sunken` and triggers route **prefetch** (warm the lazy
chunk). `PageTransition` runs the `page` 420ms transition. Whole row is a single
link target (Enter on a focused row).

**Awaiting-review cell → grading:** clicking the awaiting count (or "Review
submissions" in the `⋯` menu) prefetches and navigates to
`/exams/:examId/submissions`.

**Release results (the one in-place mutation):**

- Trigger from row `⋯` → "Release results" opens a `ConfirmDialog` — overlay
  fade + content scale-in at `fast`/`base` with `ease.entrance`, elevation `e3`.
- Copy is **outward-facing and explicit** (results become visible to students):
  see §7. When awaiting-review > 0, the dialog adds a caution line with the
  ungraded count.
- Confirm → calls `v1.autograde.saveExam` status transition. The button shows an
  inline spinner ("Releasing…"). **No optimistic flip** — releasing is
  high-consequence and student-visible, so the row updates only on the server's
  confirmed transition (the state machine + `onExamResultsReleased` trigger must
  succeed). On success → `Toast` "Results released — now visible to students,"
  the Results cell animates to `✓ Live` (`fast`, `ease.entrance`), Status
  updates to Released, and the awaiting cell settles. On failure
  (`INVALID_TRANSITION`, `PERMISSION_DENIED`, `FEATURE_DISABLED`) →
  `useApiError` toast with the recovery hint; row unchanged.
- This is the **only** write on the screen; there is **no** un-release
  affordance here (reverting a release is a deliberate detail-page operation,
  not a quick row action).

**Feedback:** confirmations via sonner `Toast`; errors via `useApiError` → toast
with recovery hint. Reduced-motion: replace scale/slide with opacity-only
cross-fades; disable row-raise translate; the Released-cell change is an instant
swap with a brief opacity fade.

**No celebratory motion:** results release does **not** get the gamification
spring/marigold burst — that single celebratory moment is reserved for student
XP/level events (FOUNDATION §4). Here, release feedback is a calm toast + subtle
badge change.

---

## 7. Content & copy (staff tone — precise, credible, calm)

**Page header**

- H1: **Exams**
- Subtitle: **"Monitor status, submissions, and results across your classes."**
  (teacher) / **"All exams in this tenant."** (admin) — count as a muted suffix,
  e.g. _"18 exams"_.

**Toolbar**

- Search placeholder: **"Search by title or subject"**
- Filters: **Class** ("All classes"), **Status** ("All statuses" → Draft /
  Collecting / Grading / Completed / Released / Archived)
- CTA: **New exam**
- Optional banner: **"{n} exams are graded and ready to release."** with a
  "Review" affordance (jumps to the filtered Grading/Completed view).

**Status map (operational labels over canonical `EXAM_STATUSES`):**

- `draft`, `question_paper_uploaded`, `question_paper_extracted` → **Draft**
  (muted dot; "Not yet open to students").
- `published` → **Collecting** (`status.info`; "Open — students can submit").
- `grading` → **Grading** (`status.warning`; "Submissions in, review in
  progress").
- `completed` → **Graded** (`status.success`; "Grading complete — results
  held").
- `results_released` → **Released** (`status.success`, filled; "Results visible
  to students").
- `archived` → **Archived** (muted).

(The task brief's shorthand — draft/scheduled/active/grading/results*released —
maps to these: \_active*=Collecting, _scheduled_=Draft with a future `examDate`.
The canonical enum is the source of truth; these are display labels.)

**Column headers:** Exam · Class(es) · Teacher / owner (admin) · Status · Marks
· Submissions · Awaiting review · Results · (actions, unlabeled)

**Cell copy:** no submissions yet → `—` (tooltip **"No submissions yet."**);
marks **"{total} / {passing}"** with sr-only "{passing} to pass"; submissions
**"{received} / {expected}"** (sr-only "{received} of {expected} submissions
received"); awaiting chip sr-only **"{n} submissions awaiting review"**; results
states **Held** / **Released** / **Auto** with tooltips ("Held — results not yet
visible to students" / "Released — visible to students" / "Auto — results
release automatically when grading completes").

**Row menu:** Open · Review submissions · Release results · View analytics

**Empty states** (see §5 for full copy): "No exams yet" (teacher / admin) · "No
exams match your filters".

**Error:** title **"Couldn't load exams"**; generic body **"Something went wrong
loading your exams. Check your connection and try again."**; CTA **"Retry"**.

**Release results `ConfirmDialog`**

- Title: **"Release results to students?"**
- Body: **"Students in {class(es)} will be able to see their scores and feedback
  for "{exam title}". This is visible to students immediately and can't be
  quietly undone."**
- Caution line (only if awaiting-review > 0): **"{n} submissions are still
  awaiting review. Released results won't include grades for those until they're
  reviewed."**
- Buttons: **Cancel** · **Release results** (primary).
- Success toast: **"Results released — now visible to students."**

Tone notes: no exclamation marks, no XP/streak/celebration language, no
"Awesome!"/"Great job!". Direct, second-person, professional. Release copy is
deliberately explicit about student visibility and irreversibility-in-place.

---

## 8. Domain rules surfaced

- **Tenant isolation:** every read is scoped to `ctx.activeTenantId` (from
  claims) server-side. `tenantId` is never a form field and never shown.
  Cross-tenant exams can never appear; switching tenants in the `Topbar`
  re-scopes the whole list.
- **Role + managed-class scoping:** `teacher` sees only exams whose `classIds`
  intersect their managed classes (claim `classIds` / `managedClassIds`, with
  the `MAX_CLAIM_CLASS_IDS = 15` overflow fallback to the membership doc).
  `tenantAdmin` sees all. Teacher-only UI (no owner column, gated Release/New)
  is conditioned on role + `TeacherPermissions`.
- **Status state machine is server-enforced:** the Release action requests a
  transition via `v1.autograde.saveExam`; the server validates it against
  `ALLOWED_TRANSITIONS` (and throws `INVALID_TRANSITION` otherwise). The UI
  offers the affordance only for states where release is valid (§5 matrix), but
  the **server is the authority** — the client never flips status locally.
- **Results-release gating:** `gradingConfig.releaseResultsAutomatically`
  governs the affordance. When `true`, the Results cell shows `Auto` and the
  manual Release action is hidden/disabled — release happens server-side when
  grading completes. Manual release is only for exams configured to hold
  results.
- **Results-released visibility is a student-facing projection:** the
  `onExamResultsReleased` trigger computes/freezes the released analytics; until
  release, students see no scores. This screen surfaces the _state_
  (Held/Released/Auto) but renders no student-visible data and performs no
  student-facing recompute.
- **Server-authoritative stats:** submissions received, expected,
  awaiting-review, avg score, and pass rate come from denormalized `ExamStats` /
  server-projected counts / `analytics.getSummary`. The client **never**
  recomputes them and **never** fans out `getCountFromServer` per exam.
- **Answer-key protection:** answer keys live in the server-only subcollection
  and are never read on the client; **nothing on this monitoring surface exposes
  answer keys or question-paper answers.** Drilling into grading uses the
  protected `gradeQuestion`/`getItemForEdit` paths in the EXAMS area, not this
  screen.
- **Reads via repos, writes via callables:** list/count/teaser reads go through
  `@levelup/api-client` repositories; the single mutation (Release results) goes
  through `v1.autograde.saveExam`. No direct client Firestore writes (no
  `writeBatch`/`updateDoc`).
- **Out of scope here:** authoring (question paper, config, rubric) lives in
  exam detail/create (EXAMS area); grading/review lives in the grading workbench
  (EXAMS area). This screen only **links out**. Spaces authoring is the SPACES
  area, also out of scope.

---

## 9. Accessibility

- **Focus order:** Skip-to-content → H1 → "New exam" → (optional
  ready-to-release banner) → search → filters → table header (sortable headers
  are buttons) → rows (each a single focusable link target) → interactive
  Awaiting/Results cells → row `⋯` menus → pagination. Logical, top-to-bottom,
  left-to-right.
- **Keyboard:** Tab/Shift-Tab throughout; Enter on a focused row navigates to
  detail; the awaiting cell and "Review submissions" are Enter-activatable;
  sortable headers toggle on Enter/Space and expose `aria-sort`; `⋯` menu is a
  Radix `DropdownMenu` (arrow-key navigable, Esc to close); the Release
  `ConfirmDialog` traps focus, Esc cancels, focus returns to the invoking
  control, and the primary "Release results" button is **not** auto-focused (the
  safer Cancel pattern for consequential actions — focus lands on the
  dialog/Cancel).
- **ARIA / semantics:** `DataTable` renders a real `<table>` with
  `<th scope="col">`; `aria-sort` on sorted columns; row links use `aria-label`
  ("Open {exam title}"); icon-only controls (`⋯`, search, awaiting chip) have
  `aria-label`; the status `Badge` and results `Badge` expose status as **dot +
  text** (never color-only) with sr-only descriptions; the submissions
  `ProgressBar` has `role="progressbar"` with `aria-valuenow/min/max` and an
  sr-only "{received} of {expected}"; `EmptyState`/`ErrorState` use
  `role="status"`/`role="alert"`; the post-release toast and badge change
  announce via `aria-live` and `RouteAnnouncer` covers navigation.
- **Contrast:** all text/bg pairs meet WCAG AA (4.5:1 body, 3:1 large/UI) using
  FOUNDATION semantic tokens; status conveyed by dot + label + color, never
  color alone; the submissions bar pairs `brand.primary` fill with a visible
  mono fraction.
- **Reduced motion:** honor `prefers-reduced-motion` — replace row-raise
  translate, dialog scale, chip slide, and the Released-cell change with
  opacity-only fades; no parallax/auto-animation; never use the gamification
  spring here.
- **Touch targets:** ≥44px for row actions, filter triggers, awaiting/results
  interactive cells, and card taps (`sm`).

---

## 10. Web↔mobile divergence (RN parity notes)

- **Table → cards:** web `DataTable` at `lg`/`md`; at `sm` and on the teacher RN
  surface, the same `useDataTable` headless logic drives a **stacked `Card`
  list** (one card per exam). Component **names/props match 1:1** between
  `shared-ui` (web) and `ui-native`; only the renderer differs (FOUNDATION §6).
  The headless `useDataTable` (search/filter/sort/page state) is reused
  verbatim.
- **Hover → press:** row-hover prefetch + raise becomes long-press / on-mount
  prefetch on RN; the whole card is the press target.
- **⌘K → none:** no command palette on mobile/RN; "New exam" is a header `+` /
  sticky FAB; filters live in a bottom `Sheet`.
- **Release confirm:** the `ConfirmDialog` becomes a native action sheet / modal
  on RN with identical copy; the consequential-action focus pattern (no
  auto-focus on the destructive-ish primary) is preserved.
- **Navigation:** RN consumes the identical route manifest via the
  `react-navigation` renderer; row tap pushes the Exam Detail screen, the
  awaiting chip pushes the Grading screen (no breadcrumb; native back).
- **Data layer identical:** both call the same `@levelup/api-client`
  repos/callables (`exams.list`, `analytics.getSummary`,
  `v1.autograde.saveExam`) and `shared-hooks/headless` hooks — no Firestore SDK
  path coupling, so the screen's logic is RN-ready unchanged.
- **Motion:** web uses CSS/`framer-motion` with FOUNDATION durations/eases; RN
  uses Reanimated with the same duration tokens (spring reserved for
  gamification, not used here).

---

## 11. Claude-design prompt

```
You are designing the "Exams Overview (Operational Monitoring)" screen for the
Auto-LevelUp TEACHER operational web portal.

CONFORM EXACTLY to the Lyceum / "Modern Scholarly" design system in
docs/rebuild-spec/design/00-FOUNDATION.md. Use ONLY its tokens and components —
do not invent colors, fonts, spacing, radii, or component variants. Cite tokens by
semantic name (bg.canvas, bg.surface, bg.surface-sunken, text.primary/secondary/muted,
border.subtle, brand.primary, status.info/warning/success/error). Fonts: Fraunces
(display/H1), Schibsted Grotesk (UI/body/table), Spline Sans Mono (numerics: marks,
submission fractions, counts). Radius lg cards / md inputs+buttons / pill badges.
Elevation e1 card at rest, e3 dialog. Motion: fast 160ms / base 220ms / page 420ms with
ease.standard & ease.entrance; honor prefers-reduced-motion. Tone: STAFF — precise,
credible, calm. NO XP/streak/celebration chrome, NO spark accent, NO celebratory spring
(reserved for student gamification); "New exam" is a standard primary (brand.primary) button.

BUILD this screen, route /exams, inside PlatformLayout (AppSidebar + Topbar + AppBreadcrumb).
This is an OPERATIONAL MONITORING list — NOT authoring or grading. It links out: row "Open"
→ /exams/:examId, "Review submissions" → /exams/:examId/submissions, "New exam" → /exams/new.
Compose from @levelup/shared-ui only:
- Header: H1 "Exams" (Fraunces) + muted subtitle + count; primary Button "New exam" (top-right).
  Optional dismissible InlineAlert "{n} exams are graded and ready to release."
- Toolbar: Input search ("Search by title or subject"); Select filters Class / Status
  (use "all" sentinel, never empty ""); active filters as removable chips.
- DataTable (with useDataTable: search/filter/sort/paginate) columns:
  Exam (title + subject caption + relative examDate, link to /exams/:examId),
  Class(es) (Badge chips + "+N" overflow Tooltip), [Teacher/owner — Avatar, admin only],
  Status (Badge: dot + operational label — Draft / Collecting / Grading / Graded / Released /
  Archived — color from status.* but NEVER color-only), Marks (mono "total / passing"),
  Submissions (ProgressBar + mono "received/expected", neutral brand.primary fill — NOT grade.*),
  Awaiting review (mono count; status.warning ⚠ chip when ≥1, "0" when none, "—" when N/A;
  click → grading), Results (Held / "✓ Live" / Auto badge), trailing ⋯ DropdownMenu
  (Open / Review submissions / Release results[conditional] / View analytics[when released]).
  Sticky header; sortable columns with aria-sort; Pagination right-aligned.
- Release results: ConfirmDialog (outward-facing) titled "Release results to students?",
  body explains students will see scores/feedback immediately and it can't be quietly undone;
  add a caution line with the ungraded count when awaiting-review > 0; primary "Release results".
  Calls v1.autograde.saveExam status transition — NO optimistic flip; update the row only on
  server confirmation; success Toast "Results released — now visible to students."

STATES: loading (Skeleton rows), partial (Awaiting/expected/teaser cells show cell-level
Skeleton until they resolve; no-submission exams show "—" + tooltip "No submissions yet",
never "0"; genuine zeros show "0"), empty (teacher/admin: "No exams yet" + New exam CTA if
permitted; filtered: "No exams match your filters" + Clear filters), error (ErrorState distinct
from empty: "Couldn't load exams" + Retry). Permission gating: teacher sees only exams in
managed classes, no owner column, Release shown only when state-valid AND permitted (else hidden
with tooltip); tenantAdmin sees all + owner column.

RELEASE AFFORDANCE STATE MATRIX (server state machine is the authority): not offered for
draft/collecting; offered-but-cautioned during grading with awaiting>0; offered when graded with
awaiting=0; when gradingConfig.releaseResultsAutomatically is true show "Auto" and hide manual
Release; when already results_released show "✓ Live" and replace Release with "View analytics".

RESPONSIVE: lg full table; md drops Marks/Class(es) into expandable detail; sm collapses to a
stacked Card list (one card/exam: title + status Badge, submissions ProgressBar + fraction,
Awaiting chip, Results badge, class chips + marks caption, ⋯ menu), search collapses to an icon,
filters move into a Sheet, "New exam" becomes a sticky primary button. Touch targets ≥44px.

DOMAIN RULES to honor: tenantId is derived from claims server-side — never a field, never shown;
cross-tenant data never appears. Teacher scope = exams whose classIds intersect managed classes
(15-class overflow fallback). All submission/awaiting/score stats are server-authoritative
(denormalized ExamStats + analytics.getSummary) — NEVER recomputed on the client, NO per-exam
getCountFromServer. The status state machine is server-enforced (ALLOWED_TRANSITIONS via
v1.autograde.saveExam). Results-release honors releaseResultsAutomatically/gradingConfig and is
student-visible. NO answer keys anywhere on this surface. Reads via @levelup/api-client repos;
the only write is the Release-results callable — no direct client Firestore writes. Do not embed
authoring or grading; link out only.

A11y: real <table> with scope+aria-sort; rows are single Enter-activatable links with aria-label;
icon buttons + awaiting chip labeled; status/results Badges convey state as dot + text (never
color-only); ProgressBar has role=progressbar + aria-valuenow + sr-only "received of expected";
ConfirmDialog traps focus and does NOT auto-focus the primary Release button; WCAG AA contrast;
reduced-motion = opacity-only, no spring. Output clean, accessible React + the shared-ui
components, mapped to the Lyceum tokens.
```
