# Exams Overview — Admin (`tenantAdmin`)

> **Design system:** Lyceum. Conforms to
> `docs/rebuild-spec/design/00-FOUNDATION.md`. All colors, type, spacing, radii,
> elevation, motion, and components are cited by semantic token / §5 component
> name — no raw hex, no invented variants. Register: **precise / credible admin
> chrome** (the serious register), not the playful student register. **Area:**
> `admin` · **Slug:** `exams-overview` · **Audience:** tenant administrators
> (one tenant, scoped). Super-admin operates the platform control plane, not
> this screen (see §8).

---

## 1. Purpose & primary user

**Primary user:** a tenant administrator (`tenantAdmin` role) — a school/academy
admin scoped to exactly **one** tenant. (Super-admin may view a tenant's exams
via cross-tenant impersonation, but that is a control-plane affordance, not a
feature of this screen; see §8 and §10.)

**Job-to-be-done:** _"Give me one authoritative, tenant-wide view of every exam
my teachers have created — what state each one is in (draft → scheduled →
grading → results released → archived), when it runs, how far grading has
progressed, and how the AI-grading confidence and results are shaking out — so I
can spot stuck pipelines, ungraded backlogs, low-confidence exams that need
human review, and overdue results, and route the right teacher to act."_

**Critical scope boundary — oversight, not authoring.** Exam authoring (creating
exams, uploading question papers, editing rubrics, grading/overriding answers,
releasing results) lives in the **teacher app**, not here. This admin screen is
**read / oversight only**: it surfaces status, schedule, grading progress, and
confidence/results summaries across teachers, with deep-links _into_ the
relevant exam detail for whoever has authoring rights. The admin never sees
answer keys (§8) and never overrides a grade from here.

The current live page (`apps/admin-web/src/pages/ExamsOverviewPage.tsx`) is a
thin read-only table: search + status-pill filter over `useExams(tenantId)`,
columns Title / Subject / Total Marks / Status / Created By (resolved via
`useTeachers`), client-side sort + paginate (25/page). This rebuild **keeps that
spine** and adds the oversight columns the scope calls for — grading progress,
confidence summary, schedule, results-released state — plus a KPI strip and
richer empty/error/partial states. It also corrects the live page's status
vocabulary to the real domain enum (see §8: the live filter list
`draft|scheduled|active|grading|completed` does **not** match `ExamStatus`).

---

## 2. Entry points & route

**Route:** `/exams` (`ExamsOverviewPage`), declared in
`apps/admin-web/src/App.tsx`, rendered inside the authenticated `AppLayout`
shell (`AppShell` + `AppSidebar`, nav group **Overview**). Gated by
`RequireAuth allowedRoles={["tenantAdmin"]}` with the
`currentMembership.tenantId === currentTenantId` assertion (status report §1;
auth-access §1.7).

**Entry points:**

- `AppSidebar` → Overview → **Exams**.
- Dashboard "exams needing attention" / activity tiles deep-linking here
  (optionally pre-filtered, e.g. `?status=grading`).
- ⌘K command palette (web-only) → "Go to exams" / "Find exam…".
- Breadcrumb: Dashboard › Exams.
- Notifications referencing an exam (grading complete, dead-letter / failed
  grading) → land here or on the exam row.

**Reads (via `packages/shared-hooks` → `api-client`, per `specs/common-api.md`
§3.3, §5.3 — no direct Firestore reads in the rebuild; `tenantId` is derived
server-side from `ctx.activeTenantId`, never sent in the body, per common-api
§4.4).**

The live page uses the broad `useExams(tenantId)` + `useTeachers(tenantId)`
hooks and filters/sorts client-side. In the rebuild this maps onto the new
server-aggregated read endpoints:

| Need                                                    | Rebuild callable (common-api §3.3)                                                                                                     | Notes                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paginated exam list across the tenant                   | `v1.autograde.listExams`                                                                                                               | Admin gets the **full** projection (not the released-only student/parent projection). Uses the unified pagination fragment (common-api §7): `{ cursor, limit }` → `{ items, nextCursor, total }`. Server-side filter by `status`, `subject`, `classId`, `academicSessionId`, `examDate` range, `createdBy`. |
| Per-exam denormalized stats (grading progress, results) | included in `listExams` item projection                                                                                                | From `Exam.stats` (`totalSubmissions`, `gradedSubmissions`, `avgScore`, `passRate`) on the exam doc — server-authoritative, computed by the grading pipeline, never client-derived (§8).                                                                                                                    |
| Confidence summary per exam                             | `v1.autograde.getExam` (on row expand / detail) **or** a `confidenceSummary` rollup in the `listExams` projection _(proposed, see §4)_ | Confidence is per-question-submission (`Submission.scoutingResult.confidence`); the **per-exam confidence rollup** — counts of low/med/high needing review — must be aggregated **server-side** (common-api §2 "kills N+1 fan-outs"), surfaced to the admin as a summary only, never raw answer data.       |
| Teacher (createdBy) resolution                          | folded into `listExams` projection (`createdByName`) **or** `v1.identity.listTeachers`                                                 | The live page builds a `teacherMap` from `useTeachers` keyed on `teacher.uid`/`displayName`/`email`. In the rebuild the server resolves the display name into the exam projection to avoid the extra round-trip.                                                                                            |
| Class / academic-session labels for filters             | `v1.identity.listClasses`, `v1.identity.listAcademicSessions`                                                                          | Populate filter dropdown options (grade/section, session).                                                                                                                                                                                                                                                  |
| KPI strip (tenant exam health)                          | `v1.analytics.getSummary` `{ scope: 'health' }` (or a lightweight count from `listExams { total }`)                                    | Counts: exams by status, total awaiting grading, low-confidence exam count, overdue-results count. Server-side aggregation (common-api §3.3 analytics).                                                                                                                                                     |

**Writes:** **none.** This is an oversight read screen. The only state changes
it triggers are client-local (filters, sort, pagination, column visibility) — no
callable mutations. Any action that _would_ mutate (release results, retry
grading, override) is delegated by deep-linking into the teacher app's
exam-detail screen, where authorization is re-checked server-side.

---

## 3. Layout — wireframe-as-text

Rendered inside `AppShell` (persistent left **Sidebar** + top **Topbar** with
tenant switcher / global search / notifications / profile; status report §1).
The screen owns only the **main content region**. Max content width 1200
(FOUNDATION §4); page gutters mobile 16 / tablet 24 / desktop 32.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ AppShell · Topbar  [tenant ▾]   ⌘K search        🔔 notifications   ◐ theme  ⬤ │
├───────────┬──────────────────────────────────────────────────────────────────┤
│           │  Breadcrumb:  Dashboard ›  Exams                                   │
│  Sidebar  │                                                                    │
│  ───────  │  ┌── Page header ─────────────────────────────────────────────┐   │
│  Overview │  │  Exams Overview                          [ ⤓ Export CSV ]    │   │
│  • Dash   │  │  Oversight of all exams across your academy                 │   │
│  • Users  │  └─────────────────────────────────────────────────────────────┘  │
│  • Classes│                                                                    │
│  • Spaces │  ┌── KPI strip (Stat/KPI ×4) ──────────────────────────────────┐  │
│  •▸Exams  │  │ [Total exams] [Awaiting grading] [Low-confidence ⚠] [Overdue]│  │
│  ───────  │  └─────────────────────────────────────────────────────────────┘  │
│ Management│                                                                    │
│ Analytics │  ┌── Toolbar ──────────────────────────────────────────────────┐  │
│ Config    │  │ [🔎 Search exams…]   Status ▾  Subject ▾  Class ▾  Session ▾ │  │
│           │  │                                          [ Clear filters ]   │  │
│           │  └─────────────────────────────────────────────────────────────┘  │
│           │                                                                    │
│           │  ┌── DataTable ────────────────────────────────────────────────┐  │
│           │  │ Exam ▾ │ Subject │ Class │ Schedule │ Status │ Grading │ Conf │ │
│           │  │────────┼─────────┼───────┼──────────┼────────┼─────────┼──────│ │
│           │  │ Unit 3 │ Physics │ 10-A  │ Jun 24   │[grading]│███░ 18/24│ Conf│ │
│           │  │ Quiz   │ Math    │ 9-B   │ Jun 20   │[results]│████ 30/30│ Conf│ │
│           │  │  …                                                          │ │ │
│           │  └─────────────────────────────────────────────────────────────┘  │
│           │  ┌── Pagination ───────────────────────────────────────────────┐  │
│           │  │  1–25 of 142            ‹ Prev   1 2 3 …   Next ›   25/page ▾ │  │
│           │  └─────────────────────────────────────────────────────────────┘  │
└───────────┴──────────────────────────────────────────────────────────────────┘
```

**Grid / regions (top → bottom), gap `6`/24px between major blocks (FOUNDATION
§4):**

1. **Breadcrumb** (`Breadcrumb`) — Dashboard › Exams.
2. **Page header** — `h1` "Exams Overview" (Fraunces, `2xl`) + secondary
   subtitle (Schibsted, `sm`, `text.secondary`); right-aligned ghost/secondary
   **Export CSV** `Button` (client-side export of the filtered/visible rows).
3. **KPI strip** — 4 × `Stat/KPI` cards (`Card`, radius `lg`, elevation `e1`).
4. **Toolbar** — `Input` search (left, flex-grow) + filter `Select`s (Status /
   Subject / Class / Academic Session) + ghost "Clear filters". Filters drive
   `listExams` server-side query params.
5. **DataTable** (`DataTable`) — sortable, server-paginated. Row = exam;
   clicking a row opens the exam in context (see §6). No row-selection / bulk
   actions (no admin write actions exist on this screen).
6. **Pagination** (`Pagination` / cursor-based) — "X–Y of N", page-size
   selector.

**Responsive behavior:**

- **lg (≥1024) — primary target.** Full multi-column table. KPI strip = 4-up
  row. Toolbar single row.
- **md (768–1023).** KPI strip = 2×2. Toolbar wraps: search full-width on top,
  filter `Select`s on a second row. Table drops the lowest-priority columns
  (Subject, Class collapse into a secondary line under Exam title); keep Exam /
  Schedule / Status / Grading / Confidence.
- **sm (<768) — admin is desktop-first (see §10); narrow is graceful-degrade
  only.** Table → **stacked card list** (Lyceum cross-platform rule, FOUNDATION
  §6): each exam becomes a `Card` with title, a status `Badge`, schedule line, a
  `ProgressBar` grading row, and a `ConfidenceBadge`. Filters collapse into a
  single "Filters" `Button` opening a `Drawer/Sheet`. KPI strip = horizontal
  scroll or 1-up stack.

---

## 4. Components used (FOUNDATION §5 only)

**Navigation / shell:** `AppShell`, `Sidebar`, `Topbar`, `Breadcrumb`,
`CommandPalette` (⌘K, web-only).

**Containers:** `Card` (KPI cards, mobile stacked rows), `Section` (page-header
/ toolbar grouping), `Drawer/Sheet` (mobile filter panel), `Tooltip` (status /
confidence / progress explainers), `Popover` (column-visibility menu, optional).

**Primitives:** `Input` (search), `Select` (Status / Subject / Class / Academic
Session filters; **never use empty-string `""` as a value** — use a sentinel
like `"all"`, per project memory / Radix Select rule), `Button` (Export CSV —
ghost/secondary; Clear filters — ghost), `IconButton` (sort affordances, mobile
filter trigger).

**Data:** `DataTable` (sort / filter / paginate; status report rec B4 — the
shared primitive replacing the live page's `usePagination`/`useSort` plumbing),
`Pagination` (cursor-based), `Stat/KPI` (×4 KPI strip), `Badge` (exam status —
paired with icon + label per §9), `ProgressBar` (grading progress
`gradedSubmissions/totalSubmissions`), `Skeleton` (loading), `EmptyState` (no
exams / no results), `Tooltip`.

**Feedback:** `InlineAlert/Banner` (error / partial-data banner,
`QuotaWarningBanner` already present in `AppLayout`), `Toast` (sonner — for
transient read errors / export-ready).

**Domain components (cross-app, §5):**

- **`GradePill`** — renders the exam-level grade/score summary where a
  representative grade or pass band is shown (uses `grade.A…grade.F` scale;
  FOUNDATION §2.3). Used in the Results/summary column for
  `results_released`/`completed` exams (e.g. avg-grade band, pass rate context).
- **`ConfidenceBadge`** — the per-exam AI-grading **confidence summary** in the
  Confidence column: low / med / high, color-mapped to `confidence.low`
  (red-500, <0.7 → human review), `confidence.med` (amber-500, 0.7–0.9 →
  spot-check), `confidence.high` (green-500, >0.9 → auto-accept) per FOUNDATION
  §2.3. Here it summarizes the _exam's_ aggregate confidence posture (e.g. "12
  answers need review"), driven by server-aggregated
  `Submission.scoutingResult.confidence`. It is read-only oversight — tapping it
  deep-links into the teacher review queue (where the human-in-the-loop actually
  happens), it never reveals answers or keys.
- **`AnswerKeyLock`** (server-only guard visual) — used as the rationale for
  _why_ certain detail is absent; not a visible interactive control here, but
  the screen's contract is "answer keys are server-only" (§8).

**Proposed foundation additions (flagged explicitly):**

1. **`confidenceSummary` rollup field in the `v1.autograde.listExams`
   projection** — so `ConfidenceBadge` can render a per-exam aggregate (counts
   of low/med/high-confidence question submissions) without an N+1 fetch. This
   is a **contract addition** (common-api §3.3), not a new visual token; it
   composes existing `ConfidenceBadge`. If not available at build time, fall
   back to fetching on row-hover/expand via `v1.autograde.getExam`.
2. No new colors/type/spacing/radii/shadows/motion are required. The screen is
   fully composable from existing tokens and §5 components.

---

## 5. States

All skeletons mirror final layout to avoid reflow; all motion respects
`prefers-reduced-motion` (§9). Loading uses `Skeleton`; errors use
`InlineAlert/Banner` + `Toast`.

**Loading (initial).** KPI strip → 4 `Skeleton` stat cards. Table → `Skeleton`
header + ~10 shimmer rows matching column widths (the live page already shows a
5-column table skeleton; the rebuild extends it to the full column set). Toolbar
renders immediately (filters disabled until first page resolves). Skeleton
shimmer ≤ `slow` (320ms) loop, disabled under reduced-motion.

**Empty — tenant has zero exams.** `EmptyState` (centered, Fraunces title): "No
exams yet." Body: "Exams created by your teachers will appear here for
oversight. Authoring happens in the teacher app." No primary CTA (admin does not
author) — optional ghost link "Learn about exam oversight". Icon: neutral
document/clipboard glyph (no spark — serious register).

**Empty — filters/search match nothing.** Distinct copy: "No exams match these
filters." Body: "Try a different status, subject, class, or search term."
Action: ghost **Clear filters** `Button` resets to defaults. (Never reuse the
zero-state copy here — the live page conflates both as "No exams found"; the
rebuild distinguishes them.)

**Partial.** If `listExams` returns the page but the **stats / confidence
rollup** sub-aggregation is still computing or unavailable for some rows: those
cells show an inline "—" with a `Tooltip` "Stats updating" and a subtle
`Skeleton` pill (not a hard error). A dismissible `InlineAlert/Banner` at top:
"Some grading stats are still being computed and will refresh shortly." This
prevents a slow analytics aggregate from blocking the whole table (common-api
§2). If `v1.analytics.getSummary` (KPI strip) fails but `listExams` succeeds,
render the table and degrade the KPI strip to a single muted "Summary
unavailable" stat — the table is the source of truth.

**Error.** If `listExams` itself fails: replace the table region with an
`InlineAlert/Banner` (`status.error`, paired with an error icon + text — never
color-alone, §9): "We couldn't load exams. {recovery hint}." + **Retry**
`Button` (re-runs the query). Error copy/recovery comes from the typed error
model (`error.details.code` → `ERROR_MESSAGES`/`ERROR_RECOVERY_HINTS`,
common-api §6). A `TENANT_SUSPENDED` code shows the tenant-status banner
instead. A `Toast` mirrors transient failures.

**Success.** Full table + KPIs + working filters/sort/pagination.

**Permission-gated variations by role:**

- **`tenantAdmin`** — full screen as specified (read-only oversight, full exam
  projection minus answer keys).
- **`staff`** (if the tenant grants a staff member access to this nav, driven by
  `StaffPermissions` per status report rec E9) — same read-only view, gated by
  `useCan('canViewExams')` _(proposed permission)_; if absent, the **Exams** nav
  item is hidden and a direct `/exams` visit renders the shell's "Access Denied"
  panel.
- **`superAdmin`** — only reaches this screen via cross-tenant impersonation
  (active-tenant claim set to the target tenant). Same UI, but a persistent
  control-plane "Viewing as {tenant}" `InlineAlert/Banner` (rendered by the
  shell, not this screen) makes the cross-tenant context unmistakable (§8).
- **`teacher` / `student` / `parent`** — never routed here; `RequireAuth`
  redirects (auth-access §1.7).

---

## 6. Interactions & motion (FOUNDATION §4 motion tokens)

**Search.** Typing in `Input` debounces ~250ms then issues a fresh `listExams`
query with the search term (server-side, resetting to page 1). The live page
filters client-side over `title`/`subject`; the rebuild pushes this server-side
for tenant-wide correctness across paginated data. Result swap cross-fades at
`fast` (160ms, `ease.standard`).

**Filtering (Status / Subject / Class / Session).** Selecting a `Select` value
updates the query params and refetches page 1. Active filters render as
removable `Chip/Tag`s under the toolbar (optional) with an `instant`/`fast`
enter. "Clear filters" resets all to `"all"` sentinel + clears search. URL syncs
filter state (`?status=grading&class=…`) so views are shareable/deep-linkable
(supports dashboard deep-links, §2).

**Sorting.** Clicking a sortable column header (`Exam title`, `Subject`,
`Schedule/examDate`, `Status`, `Total Marks`) toggles asc/desc; sort is
server-side (cursor pagination resets). The sort indicator (caret) animates
`instant` (100ms). Default sort: `examDate` desc (most recent/upcoming first) —
more useful for oversight than the live page's unsorted default.

**Pagination.** `Pagination` issues the next cursor query; the table content
cross-fades `fast`. Page-size change (25/50/100) refetches.

**Row interaction (read-only).** Hovering a row raises it subtly
(`bg.surface-sunken` tint, no elevation change — restraint). Clicking a row →
navigates to the **exam detail** (in this admin app a read-only exam-oversight
detail, or deep-links into the teacher app's exam page if the admin is also that
exam's authorizer). The grading `ProgressBar` and `ConfidenceBadge` each have a
`Tooltip` on hover; clicking the `ConfidenceBadge` deep-links to the
human-review queue for that exam (where the actual HITL grading lives — not
here). Page transition at `page` (420ms, `ease.entrance`), honoring the shell's
route-transition.

**No optimistic updates / no confirmations.** Because this screen performs **no
mutations**, there are no optimistic writes, no `ConfirmDialog`s, and no
destructive actions. All values are server-authoritative and read-only (§8).
Export CSV is a client-side serialization of currently-visible/filtered rows →
triggers a `Toast` "Export ready" and a download; no server round-trip, no
answer-key data is included.

**Motion discipline.** This is the serious admin register: no spark bursts, no
celebratory springs (those are reserved for student gamification per FOUNDATION
§4). Transitions stay in `instant`/`fast`/`base`; the only "energy" color on the
screen is functional status (`status.*`, `confidence.*`, `grade.*`).

---

## 7. Content & copy (precise admin tone)

**Page header**

- Title (`h1`): **Exams Overview**
- Subtitle: **Oversight of all exams across your academy — status, schedule,
  grading progress, and AI-grading confidence.**

**KPI strip labels** (`Stat/KPI`)

- **Total exams** — count of exams in the active tenant.
- **Awaiting grading** — exams in `grading` / `grading_partial` with ungraded
  submissions remaining.
- **Needs review** — exams with low-confidence question submissions flagged for
  human review (paired with a warning icon, `status.warning` /
  `confidence.low`).
- **Overdue results** — exams `completed`/grading-finished where results have
  **not** been released past their expected window.

**Table column headers**

- **Exam** (title; bold, `text.primary`) · **Subject** · **Class**
  (grade-section) · **Schedule** (`examDate`, mono `Spline Sans Mono` for the
  date/time) · **Status** (`Badge`) · **Grading** (`ProgressBar` + mono
  "graded/total") · **Confidence** (`ConfidenceBadge`) · **Results**
  (`GradePill` / "Released ✓" / "Held") · **Created by** (teacher display name).

**Status `Badge` labels** (real `ExamStatus` enum, §8 — human-readable): `Draft`
· `Question paper uploaded` · `Questions extracted` · `Published` · `Grading` ·
`Completed` · `Results released` · `Archived`. Each pairs an icon with the label
(never color-alone). Color mapping: draft/extracted → neutral (`text.muted` /
`status.info`); published/scheduled → `status.info`; grading → `status.warning`;
completed → `status.success`-leaning neutral; results_released →
`status.success`; archived → muted/`border.strong`.

**Tooltips**

- Grading bar: **"{gradedSubmissions} of {totalSubmissions} submissions
  graded."**
- Confidence: **"AI-grading confidence: {n} answers need human review."** (low)
  / **"Spot-check recommended."** (med) / **"High confidence — auto-accepted."**
  (high).
- Overdue KPI: **"Results finished grading but haven't been released to students
  yet."**

**Empty states**

- Zero exams: title **"No exams yet."** · body **"Exams created by your teachers
  will appear here for oversight. Authoring happens in the teacher app."**
- No filter match: title **"No exams match these filters."** · body **"Try a
  different status, subject, class, or search term."** · action **Clear
  filters**.

**Error copy**

- Load failure: **"We couldn't load exams."** + recovery hint from
  `ERROR_RECOVERY_HINTS` (e.g. "Check your connection and try again.") +
  **Retry**.
- Partial: **"Some grading stats are still being computed and will refresh
  shortly."**
- Tenant suspended: **"This academy is currently inactive. Contact your platform
  administrator."** (`TENANT_SUSPENDED`).

**Tone rules:** declarative, neutral, no exclamation marks, no emoji in product
copy, no student-facing encouragement ("Great job!" is wrong here). Numbers are
exact and server-sourced.

---

## 8. Domain rules surfaced

1. **Tenant isolation (hard rule).** Every read is scoped to the caller's active
   tenant. `tenantId` is **derived server-side from `ctx.activeTenantId`**,
   never accepted from the request body for a normal admin (common-api §4.4). A
   `tenantAdmin` can never see another tenant's exams. Cross-tenant viewing is
   exclusively a super-admin control-plane action with an explicit
   `tenantOverride` that is audited (common-api §4.4; auth-access §1.6).
2. **Oversight, not authoring (RBAC).** This screen exposes **no** exam
   mutations. Authoring, grading, overriding, and result release are teacher-app
   actions, re-authorized server-side via `assertAutogradePermission`
   (auth-access §1.6). The admin UI must not render any control that implies it
   can grade or release from here.
3. **Answer keys are never shown — server-only.** Answer keys live in the
   deny-all `…/items/{id}/answerKeys/**` subcollection (auth-access §2;
   `firestore.rules:314-316`) and the `listExams`/`getExam` projections
   **never** include them. `AnswerKeyLock` is the conceptual guard. The
   confidence summary is an aggregate over grading confidence, not over correct
   answers.
4. **Server-authoritative values.** Grading progress
   (`Exam.stats.gradedSubmissions/totalSubmissions`), `avgScore`, `passRate`,
   confidence rollups, and status are **computed by the grading pipeline and
   read-only here**. The client never derives or caches them as truth; it
   renders what the server returns. Status transitions follow the server's
   `ALLOWED_TRANSITIONS` state machine (common-api §3.1) — the admin cannot move
   an exam between states.
5. **Correct status vocabulary.** The live page's filter list
   (`draft|scheduled|active|grading|completed`) is **wrong/stale** relative to
   the domain enum. The rebuild MUST use the real `ExamStatus` set:
   `draft · question_paper_uploaded · question_paper_extracted · published · grading · completed · results_released · archived`
   (`packages/shared-types/src/constants/grades.ts`). ("Scheduled"/"active" map
   onto `published`; there is no `active`.)
6. **Results-release gating.** Whether students/parents can see results is
   governed by `Submission.resultsReleased` +
   `Exam.gradingConfig.releaseResultsAutomatically`. The admin's **Results**
   column reflects this state (Released / Held) for oversight but cannot toggle
   it.
7. **Quota / cost / feature gating.** Exam oversight is only meaningful where
   the `aiGrading` / `analytics` tenant features are enabled (`TenantFeatures`,
   status report §2). If `aiGrading` is disabled, the Confidence and
   grading-progress columns degrade to "N/A" with a `Tooltip`. The shell's
   `QuotaWarningBanner` (existing) surfaces quota/cost pressure tenant-wide;
   this screen does not itself spend AI budget (it's read-only) but its data
   reflects budget-constrained grading.
8. **Audit logging.** Reads are not audited, but any cross-tenant super-admin
   view of this screen is (the `tenantOverride` path writes to the audit log,
   common-api §9).
9. **Server-side aggregation, no N+1.** The per-exam confidence and grading
   rollups MUST be aggregated server-side (common-api §2) — the client must not
   fan out per-submission reads to compute them (the anti-pattern this rebuild
   explicitly removes).

---

## 9. Accessibility (WCAG AA)

**Contrast.** All text/background pairs meet AA (4.5:1 body, 3:1 large/UI) using
the Lyceum semantic tokens (FOUNDATION §2.4). Status `Badge`s,
`ConfidenceBadge`, `GradePill`, and `ProgressBar` fills use AA-compliant
`status.*` / `confidence.*` / `grade.*` tokens.

**Never status-by-color-alone.** Every status `Badge` pairs an **icon + text
label** (e.g. grading = spinner/clock icon + "Grading"). `ConfidenceBadge` shows
low/med/high **as text and icon**, not just red/amber/green. `ProgressBar` shows
the numeric "graded/total" beside the bar. Overdue/needs-review KPIs include a
warning glyph + word.

**Focus order.** Skip-link → Topbar → Sidebar (current "Exams" marked
`aria-current="page"`) → Breadcrumb → Page header (Export CSV) → Search `Input`
→ filter `Select`s (Status → Subject → Class → Session) → Clear filters → table
column-header sort buttons (left→right) → table rows (top→bottom) → Pagination.
Logical and uninterrupted.

**Keyboard.** Everything operable without a pointer: `Select`s via
Arrow/Enter/Esc (Radix); sortable headers are real `<button>`s toggled by
Enter/Space with `aria-sort` (`ascending`/`descending`/`none`); rows are
keyboard-activatable (Enter opens detail) with a visible `border.focus` ring
(FOUNDATION §4 focus ring); Pagination buttons reachable and labeled. ⌘K opens
the command palette (web-only).

**ARIA / semantics.** `DataTable` renders a semantic `<table>` with `<caption>`
("Exams across {tenant}"), `scope="col"` headers, and `aria-sort` on the active
sort column. KPI cards expose value + label to AT (`aria-label` combining
number + meaning, since the number alone is ambiguous). The partial/error
`InlineAlert` uses `role="status"` (polite) for partial and `role="alert"`
(assertive) for hard errors. A route announcer (already in `AppLayout`)
announces navigation. `ProgressBar` uses `role="progressbar"` with
`aria-valuenow/min/max` and an accessible name "Grading progress".

**Reduced motion.** `prefers-reduced-motion: reduce` disables skeleton shimmer,
cross-fades, sort-caret animation, and page transitions (instant swaps instead)
— per FOUNDATION §4.

**Touch targets.** ≥44px for the mobile filter trigger, `Select`s, pagination
controls, and stacked-card rows (FOUNDATION §4).

---

## 10. Web ↔ mobile divergence

**Admin is primarily a web / desktop product.** This screen is designed for and
optimized at **lg (≥1024)**; there is no dedicated React Native admin app. The
`apps/admin-web` build is responsive for tablet/phone _browsers_ but the
full-width multi-column oversight table is a desktop experience.

Divergences (per FOUNDATION §6 cross-platform rule):

- **Table → stacked cards.** Below `sm`, the `DataTable` degrades to a `Card`
  list (one exam per card: title, status `Badge`, schedule, grading
  `ProgressBar`, `ConfidenceBadge`, results) — table semantics don't fit narrow
  viewports.
- **Inline filters → `Drawer/Sheet`.** On phone, the toolbar `Select`s collapse
  behind a single "Filters" `Button` that opens a bottom `Drawer/Sheet`.
- **Hover → press.** Row hover affordances and `Tooltip`-on-hover become
  tap/long-press on touch; tooltips become tap-to-reveal `Popover`s.
- **⌘K command palette is web-only.** The mobile/touch experience has no command
  palette; navigation is via the sidebar / `MobileBottomNav` (already in
  `AppLayout`). Stated explicitly per FOUNDATION §6.
- **CSV export** is a desktop-browser convenience; on mobile it still works via
  the browser download but is de-emphasized.

No separate `ui-native` parity is required for this admin screen (component
names still match the shared-ui set, but there is no RN admin target). Where a
domain component (`ConfidenceBadge`, `GradePill`, `ProgressBar`) is used, it is
the same component the student/teacher apps use (FOUNDATION §6: names/props
match 1:1).

---

## 11. Claude-design prompt (ready to paste)

```
You are generating the ADMIN "Exams Overview" screen for Auto-LevelUp, using the
Lyceum design system. READ docs/rebuild-spec/design/00-FOUNDATION.md and conform
EXACTLY — do NOT invent colors, fonts, spacing, radii, shadows, motion, or component
variants. Compose ONLY from FOUNDATION §5 components and the semantic tokens; cite
tokens by name (brand.primary, bg.surface, status.*, confidence.*, grade.*, spark),
never paste hex.

CONTEXT
- App: apps/admin-web (Vite + React 18 + TS, TanStack Query, Tailwind reading Lyceum
  @theme tokens, shared-ui). Route: /exams. Role: tenantAdmin (scoped to ONE tenant).
- Register: PRECISE / CREDIBLE admin chrome (serious register) — restraint in chrome,
  NO playful/student energy, NO spark bursts, NO celebratory springs. Functional color
  only (status.*, confidence.*, grade.*).
- This is OVERSIGHT, NOT AUTHORING. The screen performs NO mutations: no create, no
  grading, no result-release, no confirmations, no optimistic updates. Authoring lives
  in the teacher app. Answer keys are NEVER shown (server-only). All grading/score/
  status/confidence values are SERVER-AUTHORITATIVE and read-only.

SHELL & LAYOUT (FOUNDATION §3-§4)
- Render inside AppShell (Sidebar nav group "Overview" → Exams active; Topbar with
  tenant switcher / ⌘K search / notifications / profile). Max width 1200, gutters
  mobile16/tablet24/desktop32.
- Regions top→bottom: Breadcrumb (Dashboard › Exams); Page header (h1 "Exams Overview"
  Fraunces 2xl + subtitle Schibsted sm + ghost "Export CSV" Button); KPI strip
  (4× Stat/KPI cards: Total exams, Awaiting grading, Needs review, Overdue results);
  Toolbar (Input search + Select filters Status/Subject/Class/Academic Session +
  ghost Clear filters — Selects must NOT use "" as a value, use "all" sentinel);
  DataTable; Pagination.

TABLE (DataTable, §5) — columns:
  Exam (bold title) · Subject · Class (grade-section) · Schedule (examDate, mono
  Spline Sans Mono) · Status (Badge, icon+label) · Grading (ProgressBar +
  mono "graded/total") · Confidence (ConfidenceBadge) · Results (GradePill / "Released"
  / "Held") · Created by (teacher name).
- Status enum is the REAL ExamStatus: draft, question_paper_uploaded,
  question_paper_extracted, published, grading, completed, results_released, archived
  (human-readable labels). Do NOT use "scheduled"/"active".
- ConfidenceBadge: low=confidence.low(red), med=confidence.med(amber),
  high=confidence.high(green) — ALWAYS icon+text, never color-alone. It's a per-exam
  AI-grading confidence summary; read-only; click deep-links to the teacher review
  queue. GradePill uses grade.A…grade.F.

DATA (specs/common-api.md — hooks → api-client, NEVER firebase directly; tenantId from
ctx.activeTenantId, NOT body):
- v1.autograde.listExams (paginated {cursor,limit}→{items,nextCursor,total}; server-side
  filter by status/subject/classId/academicSessionId/examDate; full admin projection
  incl. Exam.stats.gradedSubmissions/totalSubmissions/avgScore/passRate and a
  confidenceSummary rollup; createdByName resolved server-side).
- v1.analytics.getSummary {scope:'health'} for the KPI strip.
- NO write callables on this screen.

STATES (§5): skeleton (4 stat cards + ~10 shimmer table rows matching columns); empty-
zero ("No exams yet." — authoring is in the teacher app, no CTA); empty-filtered ("No
exams match these filters." + Clear filters); partial (stats still computing → "—" +
Tooltip + dismissible InlineAlert, table still renders); error (InlineAlert status.error
icon+text + Retry, copy from ERROR_MESSAGES/ERROR_RECOVERY_HINTS); success. Permission:
tenantAdmin full; staff gated by useCan('canViewExams'); superAdmin only via audited
cross-tenant impersonation with a "Viewing as {tenant}" banner.

A11Y (§9, WCAG AA): never status-by-color-alone (icon+label everywhere); semantic table
with caption, scope=col, aria-sort; sortable headers are buttons; rows keyboard-openable
with border.focus ring; KPI cards aria-label number+meaning; InlineAlert role=status
(partial)/alert (error); ProgressBar role=progressbar; honor prefers-reduced-motion
(no shimmer/cross-fade/transition); touch targets ≥44px.

MOTION (§4): instant/fast/base only, ease.standard / ease.entrance. Search debounce
~250ms then server refetch. Sort/filter server-side, cross-fade fast(160ms). Page
transition page(420ms). No spark, no springs.

RESPONSIVE: lg = full table (primary). md = KPI 2×2, toolbar wraps, drop Subject/Class
into a secondary line. sm = table→stacked Cards, filters→Drawer/Sheet, hover→press,
⌘K is web-only (no command palette on touch). Admin is desktop-first; mobile is graceful
degrade.

Output: a single responsive React + Tailwind screen composed from shared-ui / §5
components and Lyceum tokens, with realistic placeholder exam rows, all five states
switchable, and clear TODO markers where v1.autograde.listExams / v1.analytics.getSummary
data binds in.
```
