# At-Risk Students

> The teacher's intervention-triage console — one tenant-wide (or class-scoped)
> roster of every student the nightly rule engine has flagged as at-risk,
> sortable by severity, filterable by class and reason, with each row
> deep-linking to the learner's read-only progress and bulk actions to message,
> mark followed-up, or export a report. It is a calm, credible operational
> worklist: it _surfaces_ server-computed risk signals; it never computes,
> overrides, or recomputes risk on the client.

**Route** `/analytics/at-risk` (also reachable from the Dashboard "Needs
attention" attention rows and from Class Analytics' at-risk teaser, with an
optional `?classId=` / `?reason=` pre-filter) · **Roles** `teacher` (managed
classes only) · `tenantAdmin` (all classes) · **Primary APIs**
`analytics.getSummary` (scope `class`, per managed class → at-risk roster) ·
`students.list` (name/class resolution) → `analytics.generateReport` (type
`progress`), `identity.manageNotifications` / notifications write (message /
mark-followed-up)

This spec conforms to `design/00-FOUNDATION.md` ("Lyceum / Modern Scholarly").
Every token, type, spacing, radius, elevation, motion value, and component is
cited by its FOUNDATION semantic name — no new tokens, fonts, colors, or
component variants are introduced. Per FOUNDATION §1 this is a **staff
operational surface**: precise, credible, and **calm — never alarmist**.
`status.warning`/`status.error` are used soberly and always paired with an
icon + label + reason text. There is **no gamification chrome** — XP, streaks,
and level-ups appear nowhere here (a teacher only ever sees a student's
gamification state read-only on the student-detail surface this screen links
to). `spark` is permitted on at most one primary CTA glow.

---

## 1. Purpose & primary user

**Primary user:** a `teacher` (sees only students in the classes they manage) or
a `tenantAdmin` (sees every flagged student in the active tenant). The
job-to-be-done is **triage, not analysis**:

> _"Show me every student who's slipping right now, why each one is flagged, how
> long they've been flagged and whether they're trending worse, sorted so the
> most urgent are on top — then let me act: open the student, message them, mark
> that I've followed up, or pull a report — without me hunting through
> dashboards or judging who's at-risk myself."_

This is the **act-on-risk** surface. It complements (does not replace):

- **Class Analytics & Insights** (`/analytics/classes`) — a single class's
  performance with an at-risk _teaser_. That teaser links _here_ (pre-filtered
  to the class).
- **Teacher Dashboard** (`/`) — surfaces a small "Needs attention" count; its
  rows link _here_.
- **Students Directory** (`/students`) — the full roster (all students, not just
  flagged); this screen is the flagged subset with risk context.
- **Student Detail / Progress** (`/students/:studentId/report`) — a single
  learner's read-only state (the gamification view, exam history, progress).
  Every row here links _out_ to it.

**Explicitly NOT this screen's job** (FOUNDATION + domain rules): computing or
overriding risk (the nightly rule engine owns it — `nightlyAtRiskDetection` +
`at-risk-rules.ts`, be-analytics §1); authoring spaces/items (SPACES area);
grading or releasing exams (EXAMS area); editing rosters (Class Detail); or
rendering any raw submission content, answer keys, or unreleased results. The
client renders flags and acts on them; it never decides them.

**Emotional register:** sober and supportive. At-risk is framed as **signal for
intervention**, never punishment. No red-alert klaxon styling, no large alarming
hero numbers — risk is communicated through clear labels, reason chips, and
restrained `status.warning`/`status.error` accents that always carry text.

---

## 2. Entry points & route

**Route:** `/analytics/at-risk`, gated by
`RequireAuth allow={['teacher','tenantAdmin']}` (FOUNDATION §4 single
config-driven guard; `specs/webapps-design.md` §4.2). It is the **Analytics →
At-risk** nav item (`navMeta.group: 'Analytics'`, label "At-risk"). Filters
(selected class, selected reason, sort) are carried as URL search params
(`?classId=…&reason=…&sort=…`) so a filtered view is a deep-link /
back-button-stable / RN-navigable state — never local-only component state.

**Entry points:**

- **Analytics → At-risk** sidebar item (`AppSidebar`), default = unfiltered
  roster across the caller's reach.
- **From Class Analytics** (`/analytics/classes?classId=…`): the "View all
  at-risk →" teaser link routes to `/analytics/at-risk?classId=…` pre-filtered
  to that class.
- **From the Teacher Dashboard** "Needs attention" attention rows / count →
  `/analytics/at-risk`.
- **From Student Detail** when a student carries an at-risk badge — a "See all
  at-risk students →" back-link.
- `CommandPalette` (⌘K) "At-risk students" → opens the unfiltered roster.

**Reads powering it** (all via `@levelup/api-client` repositories /
`shared-hooks/headless`; UI never touches Firestore or builds collection paths —
`specs/webapps-design.md` §6, common-api §3.3):

- **`analytics.getSummary`** with `scope: 'class'`, one call per class the
  caller can see (or for the single `?classId=` when filtered).
  Membership-checked server-side; returns the precomputed
  **`ClassProgressSummary`** (`classProgressSummaries/{classId}`, written by the
  `onStudentSummaryUpdated` trigger — be-analytics §2), which carries
  `atRiskStudentIds[]` / `atRiskCount`. The per-student detail (`isAtRisk`,
  `atRiskReasons`, `overallScore`, trend, `lastUpdatedAt`/last-active,
  `flaggedAt`/days-flagged) comes from the **`StudentProgressSummary`**
  documents the rule engine writes (`isAtRisk`/`atRiskReasons` set by
  `nightlyAtRiskDetection`; be-analytics §1–2). `tenantId` is derived from
  claims server-side — **never a request field**. _(If the rebuild adds a
  dedicated `scope:'class'` at-risk projection or a roster-shaped endpoint, this
  screen consumes that single call instead of fanning out per class; the
  contract —
  `{studentId, name, classId, className, overallScore, isAtRisk, atRiskReasons, trend, lastActiveAt, flaggedAt}`
  — is identical. The client never assembles the roster by reading raw
  `studentProgressSummaries` itself; be-analytics §4 notes those collections are
  callable-only.)_
- **`students.list`** (or the names already embedded in the summary) → resolves
  `studentId` → display name, class name, and avatar for each row. Server-scoped
  to `ctx.classIds` (claim `classIds`/`managedClassIds`, with the
  `classIdsOverflow >15` Firestore fallback per auth-access §1.3) for a
  `teacher`; full tenant set for a `tenantAdmin`. Also powers the **class
  filter** option set.
- **The reason filter** is built from the union of `atRiskReasons` present in
  the loaded roster (a fixed enum — see §7/§8), not a separate fetch.

**Writes** (all callables — no direct client Firestore writes;
`specs/webapps-design.md` §6):

- **`analytics.generateReport`** with `type: 'progress'`, `studentId` (single) —
  for "Generate report" on a row or a bulk selection (one call per selected
  student; rate-limited `'report',5` server-side, be-analytics §1). Returns
  `{ pdfUrl, expiresAt }` — a **1-hour signed URL** (common-api §3.3).
- **Message** — opens a compose affordance that sends via the notification path
  (`identity.manageNotifications` / the server notification-sender, be-analytics
  §1), never a direct write. _(If a v1 direct-message callable is not yet wired,
  "Message" links out to the existing notification/announcement compose surface
  rather than mutating here.)_
- **Mark followed-up** — records a teacher-side acknowledgement (a
  `followedUpAt`/`acknowledgedBy` marker) via a callable. **There is no "clear
  risk" / "remove flag" action** — risk is owned by the nightly rule engine and
  clears only when the next nightly run finds the student no longer matches a
  rule (§8). "Mark followed-up" is an _annotation_, not an override. _(If no
  follow-up callable exists in v1, the action is hidden — never faked with a
  client-only flag.)_

No other mutation is reachable from this surface. There is no inline risk edit,
no stat write-back, no client-side risk computation.

---

## 3. Layout (wireframe-as-text)

Rendered inside `PlatformLayout` → `AppShell` (FOUNDATION §5 Navigation;
`specs/webapps-design.md` §3.1): persistent left `Sidebar`, `Topbar` (tenant
switcher, ⌘K search, `NotificationBell`, profile / `ThemeToggle`), and on mobile
a `Tabbar` (`MobileBottomNav`) replacing the sidebar. This screen owns only the
**main content region**. Page gutters follow FOUNDATION §4 (mobile 16 / tablet
24 / desktop 32); max content width 1200. Vertical rhythm uses `gap` from the
spacing scale — major sections separated by space-8/`32`, intra-section by
space-4/`16`. `bg.canvas` page; the table/cards sit on `bg.surface`, radius
`lg`, elevation `e1` at rest.

```
┌─ AppShell ────────────────────────────────────────────────────────────────────────┐
│ Sidebar │  Topbar: [tenant ▾] ………… [⌘K search] [🔔 bell] [theme] [avatar]          │
│ (nav)   ├───────────────────────────────────────────────────────────────────────────┤
│         │  MAIN  (max-w 1200, gutter 32)                                              │
│         │  ┌─ Page header ───────────────────────────────────────────────────────┐   │
│         │  │ h1 "At-risk students"        "12 of 184 students   ·  Updated 6h ago"│   │
│         │  │ subhead: "Flagged by the nightly review. Sorted by severity."        │   │
│         │  └──────────────────────────────────────────────────────────────────────┘   │
│         │  ┌─ Filter / toolbar row ──────────────────────────────────────────────┐   │
│         │  │ [Class: All classes ▾]  [Reason: All reasons ▾]  [Sort: Severity ▾] …│   │
│         │  │ ……………………………………………………………………… [ search by name ⌕ ]                   │   │
│         │  └──────────────────────────────────────────────────────────────────────┘   │
│         │  ┌─ BulkActionBar  (appears only when ≥1 row selected) ─────────────────┐   │
│         │  │ "3 selected"   [ Message ]  [ Mark followed-up ]  [ Generate report ]│   │
│         │  │                                                          [ Clear ✕ ] │   │
│         │  └──────────────────────────────────────────────────────────────────────┘   │
│         │  ┌─ DataTable ─────────────────────────────────────────────────────────┐   │
│         │  │ ▢  Student        Class      Score  Reasons              Trend  Last │   │
│         │  │                                                                 act. │   │
│         │  │ ▢ ◐ Aisha Khan    10-A       38%   [⚠low score][↓declining] ↓  2d  ⋯ │   │
│         │  │ ▢ ◐ Rohan Mehta   10-B       —     [◷ no activity 9d]      –   9d  ⋯ │   │
│         │  │ ▢ ◐ Sara Iqbal    9-C        24%   [▼low completion]       ↑   1d  ⋯ │   │
│         │  │ …                                                                    │   │
│         │  │  (each row: AtRiskBadge severity dot · reason Chips · Trend arrow ·   │   │
│         │  │   "days flagged" caption under Last active · row →student-detail)     │   │
│         │  └──────────────────────────────────────────────────────────────────────┘   │
│         │  [ Pagination ◂ 1 2 3 ▸ ]                                                   │
└─────────┴───────────────────────────────────────────────────────────────────────────┘
```

**Columns (DataTable):**

1. **Select** — row checkbox (drives `BulkActionBar`); header checkbox =
   select-all-on-page.
2. **Student** — `Avatar` + name (Schibsted Grotesk). Whole row links to
   `/students/:studentId/report`.
3. **Class** — class name (`text.secondary`); a `Chip` if multi-class.
   Hidden/condensed when the table is already class-filtered.
4. **Overall score** — `overallScore ×100` as a `GradePill`/mono `%` (Spline
   Sans Mono). Renders **"—"** (not `0%`) when the score is an unbacked stub
   (§5.4, be-analytics §4).
5. **Reasons** — one or more reason `Chip`/`Tag`s, each **icon + label** (e.g. ⚠
   "Low score", ↓ "Declining", ▼ "Low completion", ◷ "No activity"), color-coded
   by reason but never color-only (§7/§8). An `AtRiskBadge` leads the row as the
   at-risk marker; the reason chips elaborate it.
6. **Trend** — a `Trend indicator` arrow (↑ improving `status.success` / ↓
   declining `status.error` / → flat `text.muted`), with an accessible label;
   "—" when trend is unavailable.
7. **Last active** — relative time (`text.secondary`, `<time>`), with a small
   **"Flagged {n}d"** caption beneath (days-flagged, from `flaggedAt`).
8. **Row menu** (⋯) — per-row `DropdownMenu`: "Open student," "Message," "Mark
   followed-up," "Generate report."

**Default sort:** by **severity** (descending) — derived **server-side / from
the precomputed summary** (e.g. reason count, score depth, and days-flagged);
the client orders by the summary's severity signal, it does **not** invent a
severity formula. Secondary sortable columns: score (asc), last active (oldest
first), days-flagged (desc).

**Responsive summary:**

- **sm (<768):** the `DataTable` collapses to **stacked `Card` rows** (one card
  per student): name + avatar + `AtRiskBadge` on top; reason chips wrap below;
  score · trend · last-active · days-flagged as a compact key/value strip; the ⋯
  menu in the card's top-right; a leading checkbox for selection. Filters
  collapse into a single "Filters" `Drawer`/`Sheet` trigger. `BulkActionBar`
  docks to the bottom as a sticky bar.
- **md (768–1023):** table retained but lower-priority columns (Class when
  filtered, days-flagged caption) condense; filters stay inline, wrapping to two
  rows if needed.
- **lg+ (≥1024):** full table within max-w 1200; filters single-row;
  `BulkActionBar` slides in above the table when a selection exists.

---

## 4. Components used

All from FOUNDATION §5 / the `shared-ui` inventory (`specs/webapps-design.md`
§2.2, esp. `@levelup/shared-ui/data` and `/charts`). No new primitives are
introduced.

| Region            | Component(s)                                                                                                                                                                                                                                                                      | Notes                                                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Shell             | `AppShell`, `Sidebar`, `Topbar`, `NotificationBell`, `CommandPalette`, `MobileBottomNav` (mobile), `SkipToContent`, `RouteAnnouncer`                                                                                                                                              | Provided by `PlatformLayout`; not rebuilt here.                                                                         |
| Header            | Fraunces `h1` + `text.secondary` subhead + a `lastUpdatedAt` freshness caption (plain `text.secondary`, `<time>`) + a count caption ("{n} of {N} students")                                                                                                                       | No `spark` here; the header is informational.                                                                           |
| Filters / toolbar | `Select`/`Combobox` (Class filter), `Select` (Reason filter), `Select` (Sort), `Input` (name search) — owned by `DataTable`'s built-in search/filter/sort (`useDataTable`), **not** per-page `usePagination`/`useSort` arrays (`specs/webapps-design.md` §2.2, inconsistency #9). | Radix `Select` — never an empty-string value (repo lesson).                                                             |
| Bulk actions      | `BulkActionBar` + `Button` (Message · Mark followed-up · Generate report) + `Checkbox` (row + header)                                                                                                                                                                             | Appears only when ≥1 row selected.                                                                                      |
| Roster            | `DataTable` (sort/filter/paginate/**select**) + `Pagination`                                                                                                                                                                                                                      | The core surface; owns selection, sort, filter, paging.                                                                 |
| Per-row           | `Avatar`, `AtRiskBadge`, `Chip`/`Tag` (reasons), `GradePill` / mono `%` (score), **Trend indicator**, `Badge` (days-flagged caption), `DropdownMenu` + `IconButton` (⋯ row menu), `<time>` (last active)                                                                          | `AtRiskBadge` and reason chips are **read-only** renderings of `isAtRisk`/`atRiskReasons` — never computed client-side. |
| Loading           | `Skeleton`                                                                                                                                                                                                                                                                        | Silhouettes header, filter row, and ~8 table rows.                                                                      |
| Empty             | `EmptyState`                                                                                                                                                                                                                                                                      | The "nice" empty (no one at risk) and the no-results-after-filter empty (distinct copy).                                |
| Error / partial   | `ErrorState`/`InlineAlert`                                                                                                                                                                                                                                                        | Distinct error (read failed) vs partial (some class summaries failed to load).                                          |
| Action feedback   | `Toast` (sonner), `ConfirmDialog` (only for "Mark followed-up" on a large bulk set), button spinner                                                                                                                                                                               | Report/message/follow-up result toasts.                                                                                 |

**Trend indicator** is named in FOUNDATION §5 Data ("Timeline/Trend" family) and
the screen brief; if the team has not yet realized it as a standalone
`shared-ui` export, it is a **trivial composition** — an up/down/flat arrow icon
(`status.success`/`status.error`/`text.muted`) + an accessible label — and
belongs in `@levelup/shared-ui/charts` as pure composition, **not** a new token
or color. **No other addition is required:** the "at-risk row" is a composition
of existing `Avatar` / `AtRiskBadge` / `Chip` / `GradePill` / `Badge` /
`DropdownMenu` parts inside `DataTable`. `AtRiskBadge`, `Chip/Tag`, `Badge`,
`DataTable`, `EmptyState`, `BulkActionBar` all already exist in the
`shared-ui/data` + `/charts` inventory (`specs/webapps-design.md` §2.2).

---

## 5. States

Every state is rendered from the read hooks over `@levelup/api-client`; no state
derives risk, severity, or any metric on the client.

**5.1 Loading (skeleton).** On first load (or filter/sort change that misses
cache), show a `Skeleton` matching the final silhouette: header (title + count +
freshness placeholder), the filter row (three select placeholders + search), and
~8 table rows (checkbox · avatar circle · name bar · class · score · two
reason-chip bars · trend · last-active). Skeleton uses `bg.surface-sunken`
shimmer; no layout shift when data resolves. Filters stay interactive once their
option sources (`students.list` / class list) resolve, even while the roster
reads complete.

**5.2 Empty.**

- **No one at risk** (the happy path — every loaded summary returns no flagged
  students): the headline `EmptyState` — title **"No students at risk —
  nice."**, body **"No one in your classes is currently flagged by the nightly
  review. We'll surface anyone who starts slipping."**, with a calm
  illustration. This is the one place a _positive-neutral_ tone is allowed; it
  is **not** a gamified celebration (no burst, no `spark`, no confetti) — just a
  quiet, reassuring line. The filter row stays visible but inert (or collapses).
- **No results after filtering** (students are at risk, but none match the
  active class/reason/search): a distinct in-table `EmptyState` — title **"No
  students match these filters,"** body **"Try clearing the class or reason
  filter."**, with a **"Clear filters"** `Button`. Keep this separate from the
  true-empty so the teacher knows the filter, not reality, hid the rows.
- **No managed classes** (a `teacher` with zero classes assigned): `EmptyState`
  — title **"No classes assigned,"** body **"You don't manage any classes in
  this tenant yet. Ask your admin to assign you a class."** (Permission-correct:
  server returned an empty class scope.)

**5.3 Error.** If the roster read fails entirely: full-content `ErrorState` —
title **"Couldn't load at-risk students,"** body **"Something went wrong
fetching the flagged roster."** + a **"Retry"** `Button` (refetches). A
`403`/membership-denied on a hand-edited `?classId=` the caller can't access
renders a `RequireAuth`-style **"Access denied"** `InlineAlert` ("You don't have
access to this class.") and resets the class filter to an allowed value.

**5.4 Partial.** Because the roster is assembled from several per-class summary
reads, and because some backend metrics are known stubs (be-analytics §4:
`streakDays:0`, `topicPerformance:{}`, `overallScore` may be unbacked,
`className`=`classId` placeholder):

- **Some class summaries fail** → render the roster from the classes that did
  load and show a dismissible `InlineAlert` above the table: **"Some classes
  couldn't be loaded — this list may be incomplete."** Never silently drop
  classes without saying so.
- **A stubbed/unbacked score** → render **"—"** in the Score column, never a
  misleading `0%`. Sort treats "—" as unknown (sorted last, not as zero).
- **Trend unavailable** → render "—" in the Trend column with an accessible
  "trend unavailable" label, not a flat arrow that could read as "stable."
- **`className` looks like a placeholder** (equals the `classId`) → fall back to
  the class filter's real label (from `students.list`/class list).
- **A reason value not in the known enum** (forward-compat) → render it as a
  neutral `Chip` with a humanized fallback label, never crash or hide the row.

**5.5 Success.** Full render: header with live count + freshness; filters
reflecting the URL params; the `DataTable` of flagged students sorted by
severity; reason chips, trend arrows, scores, last-active + days-flagged per
row; pagination if the roster exceeds a page. Selecting rows reveals the
`BulkActionBar`.

**5.6 Permission-gated variants by role.**

- **`teacher`:** roster is restricted to flagged students in managed classes
  (claim `classIds`/`managedClassIds`, overflow fallback). Class filter lists
  only those classes. Bulk Message / Mark followed-up / Generate report act only
  on students within reach; each callable independently membership-checks
  server-side. No tenant-wide rollup, no AI-cost/quota chrome.
- **`tenantAdmin`:** roster spans all tenant classes (class filter may be long →
  `Combobox` with search). Same actions, same surface — the difference is
  breadth of scope, not extra affordances.
- **Neither role** can override or clear a flag, see answer keys, see raw
  submission content, or see unreleased results — this surface reads precomputed
  flags and aggregates only (§8).

---

## 6. Interactions & motion

Motion is "felt, not seen" (FOUNDATION §4): subtle entrances, **no celebratory
pops** on this staff surface — including the empty state (the "nice." empty is
calm, not a burst). All durations/easings cite FOUNDATION motion tokens.

**6.1 Filter / sort (primary flow).** Changing the Class / Reason / Sort select
or typing in name-search:

- Updates the URL search params (`?classId=…&reason=…&sort=…`) — back/forward
  navigable; RN-portable.
- The table body cross-fades: outgoing rows `ease.exit` over `fast 160ms`,
  incoming rows / skeleton `ease.entrance` over `base 220ms`. The header, filter
  row, and column headers stay fixed (no layout jump).
- Name-search debounces (instant client-side filter over the loaded page; deeper
  search is a server-side filter param). Sort by a column header toggles
  asc/desc with an arrow indicator and an `aria-sort` update.
- React Query caches per filter combination, so returning to a recent filter is
  an instant content swap (no skeleton).

**6.2 Row → student detail.** Clicking a row (outside the checkbox / ⋯ menu)
navigates to `/students/:studentId/report`. Row hover lifts to
`bg.surface-sunken` tint + `e2` cushion over `instant 100ms`; the whole row is a
single link target with a visible focus ring (`border.focus`).

**6.3 Selection + bulk actions.** Toggling a row checkbox (or the header
select-all) slides the `BulkActionBar` in above the table (`ease.entrance`,
`base 220ms`) showing "{n} selected" and the three actions:

- **Message** → opens a compose affordance (Drawer/Sheet or links to the
  notification compose surface). On send: `Toast` "success" — **"Message sent to
  {n} students."** No optimistic table mutation (the roster is unaffected by
  messaging).
- **Mark followed-up** → for a small selection, applies immediately with an
  optimistic per-row **"Followed up"** `Badge` (a quiet annotation,
  `status.info`), rolling back + `Toast` "error" on failure. For a **large**
  bulk selection (e.g. >10), a `ConfirmDialog` first ("Mark {n} students as
  followed-up?") since it's a broad write. **This never clears the at-risk
  flag** — the row stays in the roster, now annotated (§8).
- **Generate report** → fires `analytics.generateReport` (type `progress`) per
  selected student; the bar shows a progress count ("Generating 2 of 3…"). On
  completion, a `Toast` "success" — **"3 reports ready"** with a "Download"
  action (a list/zip or sequential opens of the signed `pdfUrl`s). On partial
  failure, a `Toast` notes how many succeeded. **No optimistic update** — report
  generation is a real server job; the UI reflects the actual callable results.
  Rate-limit (`'report',5`) failures surface a calm "try again in a moment"
  toast.
- **Clear (✕)** deselects all and dismisses the bar (`ease.exit`, `fast 160ms`).

**6.4 Row menu (⋯).** The per-row `DropdownMenu` mirrors the bulk actions for a
single student (Open student · Message · Mark followed-up · Generate report).
Same feedback patterns, scoped to one row.

**6.5 Refresh / freshness.** No auto-refresh — risk is a **nightly** precomputed
signal (be-analytics §1, §3); polling would imply real-time risk, which is
false. The `lastUpdatedAt` freshness caption (and an optional manual "Refresh"
`IconButton`) is the trust signal. The subhead explicitly notes "Flagged by the
nightly review" so the teacher understands cadence. A manual refresh refetches
with a spinner (`base 220ms`).

**6.6 Confirmations.** Only the **large bulk "Mark followed-up"** uses a
`ConfirmDialog`. Messaging and report generation are non-destructive (and
obviously consequential on their own), and navigation is free — **no other
confirmations**. There is no destructive/irreversible action on this surface (no
flag clearing, no deletion).

**Reduced motion:** with `prefers-reduced-motion`, cross-fades become instant
content swaps, the `BulkActionBar` appears without slide, row hover lifts drop
to a border-only change, and the empty state renders statically. (FOUNDATION
§4.)

---

## 7. Content & copy

Staff tone: direct, factual, calm, supportive. No exclamation marks beyond the
single sanctioned reassuring empty-state line, no gamified or punitive copy.

**Headings & labels**

- Page title (`h1`): **"At-risk students"**
- Subhead (`text.secondary`): **"Flagged by the nightly review. Sorted by
  severity."**
- Count caption: **"{n} of {N} students"** (e.g. "12 of 184 students")
- Freshness caption: **"Updated {relativeTime}"** (e.g. "Updated 6 hours ago");
  hover `Tooltip` shows the absolute timestamp (`<time>`).
- Filters: **"Class"** (default option **"All classes"**), **"Reason"** (default
  **"All reasons"**), **"Sort"** (options **"Severity"** (default) / **"Lowest
  score"** / **"Least recently active"** / **"Longest flagged"**), name search
  placeholder **"Search by name"**.
- Column headers: **"Student"**, **"Class"**, **"Score"**, **"Reasons"**,
  **"Trend"**, **"Last active"**.
- Days-flagged caption (under Last active): **"Flagged {n}d"** (e.g. "Flagged
  9d").
- Row menu / bulk actions: **"Open student"**, **"Message"**, **"Mark
  followed-up"**, **"Generate report"**.
- Trend accessible labels: **"Improving"** (↑) / **"Declining"** (↓) /
  **"Stable"** (→) / **"Trend unavailable"** (—).

**Reason chip labels** (the canonical at-risk reason vocabulary — render the
reasons the summary carries; do **not** hardcode/compute them, and humanize via
this map; analytics `AtRiskReason` enum, be-analytics §4):

- `low_exam_score` → **"Low score"** (icon ⚠, `status.error`)
- `declining_performance` → **"Declining"** (icon ↓, `status.warning`)
- `low_space_completion` → **"Low completion"** (icon ▼, `status.warning`)
- `zero_streak` → **"No recent activity"** (icon ◷, `status.warning`) — _the
  rule engine emits `zero_streak` for the 7-day-inactivity rule_
- `no_recent_activity` → **"No recent activity"** (icon ◷, `status.warning`) —
  _declared in the enum but **never produced** by the current rule engine
  (be-analytics §4); map it for forward-compat but do not expect it._
- _Any unknown/future reason_ → humanized title-case fallback, neutral
  `status.info` chip.

**Empty-state copy**

- No one at risk (happy path): title **"No students at risk — nice."** · body
  **"No one in your classes is currently flagged by the nightly review. We'll
  surface anyone who starts slipping."**
- No filter matches: title **"No students match these filters"** · body **"Try
  clearing the class or reason filter."** · action **"Clear filters"**
- No classes assigned: title **"No classes assigned"** · body **"You don't
  manage any classes in this tenant yet. Ask your admin to assign you a
  class."**

**Error / partial copy**

- Roster load failed: title **"Couldn't load at-risk students"** · body
  **"Something went wrong fetching the flagged roster."** · action **"Retry"**
- Access denied (out-of-scope class): **"You don't have access to this class."**
- Partial / incomplete: **"Some classes couldn't be loaded — this list may be
  incomplete."**

**Action feedback copy**

- Message sent: **"Message sent to {n} student(s)."**
- Marked followed-up: **"Marked {n} student(s) as followed-up."**
- Confirm large follow-up: title **"Mark {n} students as followed-up?"** · body
  **"This notes that you've reached out. It won't remove anyone from the at-risk
  list — that happens automatically when their next nightly review improves."**
  · confirm **"Mark followed-up"** · cancel **"Cancel"**
- Reports ready: **"{n} report(s) ready"** · action **"Download"**
- Report/message failed: **"Couldn't complete that. Please try again in a
  moment."**

**Numeric formatting:** scores shown as whole-number `%` (Spline Sans Mono); 0–1
source values (`overallScore`) are formatted ×100 at the view edge; an
unbacked/stub score renders **"—"**, never `0%`. Days-flagged and last-active
are relative times. At-risk count is a count, not a percent.

---

## 8. Domain rules surfaced

- **Risk is computed server-side ONLY — never on the client.**
  `isAtRisk`/`atRiskReasons` come from the **nightly rule engine**
  (`nightlyAtRiskDetection` applying the pure `at-risk-rules.ts`; be-analytics
  §1). The four active rules: **low average exam score (<0.4)**, **zero streak /
  7-day inactivity**, **low space completion (<25%)**, **declining performance
  (3+ exams trending down)**. The UI renders these flags and their reasons
  **verbatim** and **never derives, recomputes, or overrides risk**.
  (FOUNDATION/domain rules; webapps-design §0.)
- **Reason vocabulary is the rule engine's, not the UI's.** The `AtRiskReason`
  enum declares
  `low_exam_score | no_recent_activity | low_space_completion | declining_performance | zero_streak`,
  but the engine **emits only** `low_exam_score`, `zero_streak`,
  `low_space_completion`, `declining_performance` — **`no_recent_activity` is
  dead and never produced** (be-analytics §4). The screen maps whatever reasons
  arrive (§7) and tolerates unknown/future values; it does not assume a fixed
  set or hardcode reason logic.
- **Severity ordering is server/summary-driven.** The default "by severity" sort
  orders on the precomputed signal (reason count, score depth, days-flagged)
  carried by the summary — the client orders, it does not invent a severity
  score.
- **Flags clear only via the next nightly run.** There is **no client (or
  teacher) action to remove a flag**. "Mark followed-up" is a teacher annotation
  (acknowledgement), not an override; the student remains in the roster until
  the rule engine re-evaluates them as no longer at-risk. The confirm copy says
  so explicitly. This keeps risk authoritative and prevents the UI from
  contradicting the engine.
- **Precomputed, read-cheap, server-authoritative.** Every value (score, trend,
  last-active, days-flagged, the roster itself) is read from precomputed summary
  documents (`studentProgressSummaries` / `classProgressSummaries` via
  `analytics.getSummary`); the client never recomputes a statistic and never
  reads raw submissions to build the roster (be-analytics §3–4; those summary
  collections are callable-only access).
- **Tenant isolation.** All reads/writes are scoped to the caller's active
  tenant; `tenantId` is derived from claims server-side, never a form/URL field.
  No cross-tenant student is ever reachable; filters are built from
  tenant-scoped data.
- **Role scoping.** A `teacher` sees only flagged students in managed classes
  (claim `classIds`/`managedClassIds`, with the `classIdsOverflow >15` Firestore
  fallback; auth-access §1.3). A `tenantAdmin` sees all tenant-flagged students.
  `getSummary`/`generateReport`/message/follow-up callables independently
  membership-check server-side — a hand-edited out-of-scope `classId` or
  `studentId` is denied, not silently served (auth-access §1.6).
- **Show only real metrics.** Per §5.4, stubbed/unbacked values (`overallScore`
  stub, `streakDays:0`, `className` placeholder) are rendered as "—" or fall
  back to a real label — never as a misleading zero (be-analytics §4).
- **No answer keys, no raw results, no unreleased data, no authoring/grading.**
  This surface reads aggregates and flags only; it never exposes answer keys
  (Admin-SDK-only; auth-access §2), never renders raw per-question submission
  content, and never surfaces unreleased exam results (the summaries roll up
  released/graded activity). Authoring lives in SPACES, grading in EXAMS — this
  screen only **links out** (to Student Detail, and back to Class Analytics).
- **Calm, not alarmist.** `status.warning`/`status.error` accents are always
  paired with an icon + label + reason text and kept restrained; there is no
  oversized alarm number, no flashing, no red-wash. Risk reads as a worklist,
  not an emergency.

---

## 9. Accessibility

Targets WCAG AA (FOUNDATION §2.4, §3; `specs/webapps-design.md` §2.4).

- **Focus order:** Skip-link → Sidebar → Topbar → main `h1` → freshness/Refresh
  → Class filter → Reason filter → Sort → name search → (header select-all
  checkbox) → `BulkActionBar` actions (when present) → table column-header sort
  buttons → row by row (checkbox → row link → ⋯ menu) → Pagination. Logical
  top-to-bottom, left-to-right within each row.
- **Keyboard:** every filter `Select`/`Combobox` is fully operable (type-ahead,
  arrow, Enter, Esc; Radix `Select` — never an empty-string value, per the
  repo's own lesson). Name search is a labeled `Input`. The `DataTable` is
  keyboard-navigable: column headers are sortable buttons exposing `aria-sort`
  (`ascending`/`descending`/`none`); row checkboxes (Space) toggle selection;
  the row link is reachable by Enter; the ⋯ menu is a `DropdownMenu`
  (arrow/Enter/Esc). `BulkActionBar` buttons are real `<button>`s. The
  `ConfirmDialog` traps focus and returns it to the trigger on close.
- **ARIA & semantics:** the table is a proper `<table>` (or an ARIA grid) with a
  `<caption>`/`aria-label` "At-risk students." Each `AtRiskBadge` and reason
  `Chip` includes its **text label in the accessible name** — reasons are never
  conveyed by color or icon alone. The **Trend** cell exposes a text label
  ("Declining") not just an arrow glyph. Score "—" reads as "score unavailable,"
  not "zero." Last-active uses `<time datetime>`; days-flagged is in the row's
  accessible name ("flagged 9 days ago"). Selection count is announced. Each
  `<section>`/region is labeled by its heading.
- **Contrast & non-color signals:** all text/bg pairs meet AA (FOUNDATION §2).
  **Status is never color-only** — every reason chip pairs
  `status.warning`/`status.error` with an icon **and** a text label; the trend
  arrow pairs color with an accessible direction word; the `AtRiskBadge` carries
  "At-risk" text. Reason chips remain distinguishable in grayscale by icon +
  label.
- **Live regions:** `RouteAnnouncer` announces the route. Filter/sort changes
  announce "{n} students" politely (`aria-live="polite"`). Bulk actions announce
  progress and result ("Generating 2 of 3", "3 reports ready", "Marked 3
  students followed-up"). Toasts are polite, not assertive. The empty "No
  students at risk — nice." is announced calmly, not celebrated.
- **Reduced motion:** honored per §6 — instant content swaps, no `BulkActionBar`
  slide, border-only hover, static empty state.

---

## 10. Web↔mobile divergence (RN parity)

Component **names and props match 1:1** between `shared-ui` (web) and
`ui-native` (mobile); only the renderer differs (FOUNDATION §6). Parity notes
for this screen:

- **Shell:** web `AppShell` (Sidebar + Topbar) → RN `PlatformLayout` with bottom
  tabs (`MobileBottomNav`); no ⌘K `CommandPalette` on mobile (FOUNDATION §6).
  Filters live in route/nav params, so deep-links (`?classId=`/`?reason=`) carry
  over.
- **Table → cards:** the `DataTable` is the chief divergence. On RN (and at web
  `sm`) it renders as **stacked `Card` rows** — one card per student, with the
  `AtRiskBadge`, reason `Chip`s, score, trend, last-active, days-flagged, and a
  ⋯ action menu laid out vertically. Same headless data (`useDataTable`), native
  presentation. Selection is a leading checkbox / long-press-to-select on RN.
- **Filters:** web inline `Select`/`Combobox` row → RN native picker /
  bottom-sheet `Select`, opened from a "Filters" trigger. Same option sources
  (class list / reason enum), same URL/route params.
- **Bulk actions:** web `BulkActionBar` above the table → RN a sticky bottom
  action bar / contextual action bar when rows are selected. Same actions, same
  callables.
- **Interaction:** hover lifts/tooltips (web) → press states / tap-to-reveal
  (RN). The Generate-report "Download" toast action opens each signed `pdfUrl`
  in the system browser / share sheet on RN rather than a new tab. The ⋯ row
  menu becomes an RN action sheet.
- **Layout:** the table's responsive single-column card stack **is** the default
  RN layout; page gutters map to RN safe-area + the FOUNDATION mobile gutter
  (16). Pagination → RN infinite-scroll or paged list, same data hook.
- **Reduced motion / a11y:** same tokens, same "status never color-only" rule;
  RN uses the platform reduce-motion flag and
  `accessibilityLabel`/`accessibilityRole` equivalents of the web
  aria/`aria-sort` attributes; reason labels and trend direction are spoken, not
  just iconographic.
- **No web-only feature is load-bearing:** filtering, sorting, selection, bulk
  message/follow-up/report, and row navigation all have direct RN equivalents —
  this screen is fully portable.

---

## 11. A Claude-design prompt

```
You are designing ONE screen — "At-Risk Students" — for the Auto-LevelUp TEACHER
operational web portal, in the "Lyceum / Modern Scholarly" design system.

AUTHORITY (read and obey, in order):
1. docs/rebuild-spec/design/00-FOUNDATION.md — the design system. Use ONLY its tokens,
   type families (Fraunces display / Schibsted Grotesk UI / Spline Sans Mono numerics),
   spacing, radius (cards lg, inputs/buttons md, chips/badges pill), elevation (e1 rest /
   e2 hover), and motion tokens (instant 100 / fast 160 / base 220; ease.standard/entrance/
   exit). Do NOT invent colors, fonts, spacing, or component variants. Cite tokens by
   semantic name (bg.canvas, bg.surface, bg.surface-sunken, text.primary/secondary/muted,
   brand.primary, status.warning, status.error, status.info, status.success, border.focus,
   spark). Warm paper neutrals + deep indigo primary; the single marigold "spark" is allowed
   on at most ONE primary CTA glow. NO gamification chrome — this is a calm staff worklist.
2. docs/rebuild-spec/design/teacher/at-risk-students.md — THIS spec. Follow its layout,
   states, copy, columns, and domain rules exactly.

SCREEN
- Route /analytics/at-risk (filters in URL: ?classId=&reason=&sort=). Roles: teacher
  (managed classes only), tenantAdmin (all classes). Inside PlatformLayout → AppShell
  (Sidebar + Topbar; mobile bottom tabs).
- Job: TRIAGE students flagged at-risk by the NIGHTLY rule engine — see who, why, how long,
  and trending which way; sort by severity; act (open / message / mark followed-up / report).

LAYOUT (max-w 1200, desktop gutter 32):
- Header: h1 "At-risk students" (Fraunces) + subhead "Flagged by the nightly review. Sorted
  by severity." + count caption "{n} of {N} students" + freshness "Updated {time}" (text.secondary,
  <time>).
- Filter row: Class select ("All classes"), Reason select ("All reasons"), Sort select
  (Severity default / Lowest score / Least recently active / Longest flagged), name Search input.
  These are DataTable's built-in search/filter/sort — NOT per-page arrays.
- BulkActionBar (only when ≥1 row selected): "{n} selected" + [Message] [Mark followed-up]
  [Generate report] + Clear.
- DataTable columns: checkbox · Student (Avatar + name, whole row → /students/:id/report) ·
  Class · Score (mono %, "—" if stubbed, NEVER 0%) · Reasons (icon+label Chips per atRiskReason,
  color-coded but NEVER color-only) · Trend (↑ status.success / ↓ status.error / → text.muted,
  with accessible word) · Last active (relative <time> + "Flagged {n}d" caption) · ⋯ row menu.
  Default sort = severity (from the summary; do NOT compute severity client-side). Pagination.

REASON CHIPS (render verbatim from atRiskReasons; humanize via this map; do NOT compute):
  low_exam_score → "Low score" (⚠ status.error)
  declining_performance → "Declining" (↓ status.warning)
  low_space_completion → "Low completion" (▼ status.warning)
  zero_streak → "No recent activity" (◷ status.warning)
  (no_recent_activity exists in the enum but is never produced; map for forward-compat.)
  unknown → humanized title-case, status.info.

RULES (non-negotiable):
- Risk is computed SERVER-SIDE ONLY by the nightly rule engine. Render isAtRisk/atRiskReasons
  verbatim via AtRiskBadge + reason Chips. NEVER compute, recompute, or override risk on the client.
- There is NO "clear risk" action. "Mark followed-up" is an annotation only — it does NOT remove
  anyone from the list (a flag clears only when the next nightly review improves). Say so in the
  confirm copy for large bulk follow-ups.
- Every value (score, trend, last-active, days-flagged, the roster) is precomputed/server-authoritative
  (analytics.getSummary). Show ONLY real metrics: "—" for stubbed score/trend, never 0%.
- Tenant-isolated; teacher sees only managed classes; all actions membership-checked server-side.
  Writes: analytics.generateReport (type=progress) → 1-hour signed pdfUrl; message + mark-followed-up
  via callables. No answer keys, no raw results, no destructive actions.
- CALM, not alarmist: status.warning/error always paired with icon + label + reason text; restrained
  accents; no red-wash, no oversized alarm number.

STATES to render: loading skeleton (header + filters + ~8 rows); empty — happy "No students at risk —
nice." (calm, NO burst/spark/confetti) AND distinct "No students match these filters" (Clear filters)
AND "No classes assigned"; error (ErrorState + Retry; access-denied InlineAlert for out-of-scope classId);
partial (some classes failed → InlineAlert "this list may be incomplete"; "—" for stub score/trend);
success (full sorted roster + BulkActionBar on selection).

MOTION: filter/sort = table-body cross-fade (exit fast 160 / entrance base 220), header stays fixed.
BulkActionBar slides in (entrance base 220). Generate report = progress count + result toast, NO
optimistic update. Mark-followed-up = optimistic quiet "Followed up" badge (status.info) with rollback;
ConfirmDialog only for large bulk follow-up. NO auto-refresh (nightly cadence). Respect
prefers-reduced-motion (instant swaps, no slide, static empty).

A11Y: proper <table>/grid with aria-label + aria-sort on sortable headers; AtRiskBadge/reason Chips
carry their TEXT label in the accessible name (never color/icon only); Trend cell exposes a direction
word; score "—" reads "score unavailable"; <time> for last-active; selection count + bulk progress
announced politely; focus order header→filters→bulk bar→table→pagination; reduced-motion honored.

RESPONSIVE: lg+ full table; md condense low-priority columns; sm/RN collapse to stacked Card rows
(one per student: AtRiskBadge + reason chips + score/trend/last-active/days-flagged strip + ⋯ menu),
filters in a Drawer/Sheet, BulkActionBar docked to the bottom.

Deliver responsive React using the shared-ui components named above (DataTable, BulkActionBar,
AtRiskBadge, Chip/Tag, Badge, GradePill, Avatar, Trend indicator, Select/Combobox, Input, Button,
DropdownMenu, ConfirmDialog, EmptyState, ErrorState, InlineAlert, Toast, Skeleton, Pagination,
Card for the mobile stack). No new tokens or variants — compose strictly from FOUNDATION.
```
