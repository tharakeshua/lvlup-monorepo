# Student — Tests (List)

> Conforms to **Lyceum** (Direction A — "Modern Scholarly"). See
> `../00-FOUNDATION.md`. Tokens cited by semantic name; never re-pasted. Student
> tone: clear, planning-oriented, encouraging — never punitive.

---

## 1. Purpose & primary user

**Primary user:** a **learner** — a B2B school **student** (tenant-scoped, role
`student`). (The B2C consumer learner reaches the same component when their
`platform_public` spaces contain assessment-type story points; B2B is the
dominant case for scheduled/proctored tests.)

**Job-to-be-done:** "Show me every test I have to take across all my spaces,
when each one is open, how many attempts I have left, and what I scored — so I
can plan what to do next and not miss a window." This is the learner's
**planning surface** for timed assessments — a calm, scannable schedule, not a
wall of pressure. It answers _what can I start now_, _what's coming up_, _what's
done_, and _what's locked_ at a glance, then routes into the timed-test landing
gate to actually begin.

---

## 2. Entry points & route

**Route (B2B):** `/tests` → `TestsPage`. Reached from the Sidebar ("Tests"), the
mobile **Tabbar**, the Dashboard "Upcoming tests" rail, and a per-space "Tests"
affordance on the space detail track.

**Reads (all via `@levelup/api-client`, Zod-validated, timestamps normalized to
epoch-ms at the repo edge — UI never touches Firestore):**

- `v1.levelup.testSessions.list` (`testSessions.list`) — the learner's
  prior/active test sessions across spaces, keyed by `storyPointId`. Supplies
  **attempts used**, **best score**, **last attempt status**, and any
  **active/in-progress** session to resume. This is the authoritative attempt +
  score history (replaces today's per-space client recompute).
- `v1.levelup.listStoryPoints` — the assessment-type story points (`type` ∈
  `timed_test` | `test`) for each of the learner's published, class-assigned
  spaces. Supplies the test's `title`, `assessmentConfig` (`durationMinutes`,
  `maxAttempts`, `passingPercentage`,
  `schedule.startAt/endAt/lateSubmissionGraceMinutes`,
  `retryConfig.cooldownMinutes`, `retryConfig.lockAfterPassing`) and
  `stats.totalQuestions`. (Replaces today's `useStoryPoints(tenantId, spaceId)`
  fan-out per space.)
- `v1.levelup.getSpaceProgress` (`scope: allSpaces`) — per-space progress map
  used to group/label tests by their parent space and to surface mastery context
  next to each test row.

**Server-derived status (critical):** the **schedule / attempt / cooldown /
lock** state for each test is **computed server-side** and returned as a single
resolved status enum per test — `available` · `scheduled` (opens later) ·
`closed` (window ended) · `cooldown` (retry timer running) · `locked` (passed +
`lockAfterPassing`, or attempts exhausted) · `completed` · `in_progress`
(resumable). The client renders the returned status; it does **not** recompute
open/closed from the device clock (today's `getScheduleStatus` does `Date.now()`
math on raw timestamps — this is removed; status is authoritative, mirroring the
server-authoritative timer rule).

**Writes:** none. Read-only planning + navigation. Starting/resuming a test
happens on the timed-test landing gate (`/spaces/:spaceId/test/:storyPointId`),
which owns `startTestSession`.

**Query keys:** hierarchical factory — `testSessionKeys.list(ctx, learnerId)`,
`storyPointKeys.assessments(ctx)`, `progressKeys.allSpaces(ctx, learnerId)`;
`enabled` gated on a resolved `LearnerContext`.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (B2B: Sidebar + Topbar; mobile: bottom Tabbar +
compact header). Page gutters per FOUNDATION §4 (mobile 16 / tablet 24 / desktop
32), max content width 1200.

```
┌─ AppShell (Sidebar | Topbar: search ⌘K · notifications · profile) ───────────┐
│                                                                              │
│  ┌─ Page header ─────────────────────────────────────────────────────────┐  │
│  │  H1 "Tests"                                  [ count Badge: "5 tests" ] │  │
│  │  calm planning subhead: "Your scheduled tests across every space."      │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─ Filter / group bar (gap-2, wraps) ───────────────────────────────────┐  │
│  │  Status chips: All · Available · Upcoming · Completed · Locked          │  │
│  │                                   | Sort ▾ (Window · Space · Status)    │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  WEB ≥ md ── DataTable ─────────────────────────────────────────────────────┐│
│  │ Test            │ Space    │ Status   │ Window        │ Attempts │ Best  ││ │
│  │ ─────────────── │ ──────── │ ──────── │ ───────────── │ ──────── │ ───── ││ │
│  │ Arrays Quiz     │ DSA      │ ▣ Avail. │ Closes Jun 22 │ 1 / 3    │  82%  ││ │
│  │ Big-O Test      │ DSA      │ ◷ Upcom. │ Opens Jun 24  │ 0 / 2    │   —   ││ │
│  │ Mock 1          │ Sys Des  │ ✓ Done   │ Closed        │ 2 / 2    │  91%  ││ │
│  │ Mid-term        │ LLD      │ ⟳ Cooldn │ Retry in 18m  │ 1 / 3    │  64%  ││ │
│  │ Final           │ LLD      │ 🔒 Locked│ —             │ 2 / 2    │  88%  ││ │
│  └────────────────────────────────────────────────────── row → landing gate ┘│
│                                                                              │
│  MOBILE < md ── stacked SubmissionCard-style cards (one per test) ───────────│
│  │  [Test title]                              [status Badge w/ icon]       │ │
│  │  Space · {n} questions · {duration} min                                 │ │
│  │  Window line · Attempts {used}/{max} · GradePill {best}                 │ │
│  │  (whole card → landing gate; disabled affordance when locked/closed)    │ │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Responsive behavior:**

- **< sm (640):** single-column stacked cards. Status chips horizontally scroll;
  Sort collapses to an IconButton → bottom **Sheet**. Card meta wraps to 2–3
  lines.
- **sm–md (640–1023):** stacked cards, wider; two cards may share a row at the
  upper end only if the design system's card min-width allows — default is
  single column for scannability.
- **≥ md (768):** **DataTable** appears (columns: Test · Space · Status · Window
  · Attempts · Best). Sortable headers (Window, Status, Best, Space); status is
  a labeled **Badge** cell.
- **≥ lg (1024):** DataTable full width within the 1200 max; optional sticky
  header row on scroll.

**Row/card anatomy:** test title (Fraunces sm/base) → parent **space**
(secondary) → **status Badge** (icon + label, color from the relevant semantic
token) → **Window** cell ("Closes {date}", "Opens {date}", "Retry in {mm}", or
"—") → **Attempts** "{used} / {max}" (Spline Mono numerals) → **Best** rendered
as **GradePill** (mono score, grade-scale color) or "—" if never attempted. The
whole row/card is the navigation target into the landing gate.

---

## 4. Components used (FOUNDATION §5 only)

- **AppShell**, **Sidebar**, **Topbar**, **Tabbar** (mobile), **CommandPalette**
  (⌘K, web only) — navigation.
- **DataTable** (data, web ≥ md) — owns sort/filter/selection plumbing; renders
  the test rows. Columns: Test, Space, Status, Window, Attempts, Best.
- **SubmissionCard** (domain, mobile / can also be the table's mobile fallback)
  — the stacked per-test card; reused so attempt/score framing matches the rest
  of the learner app.
- **Badge** (data) — the **status** chip on every row/card (`available` /
  `scheduled` / `closed` / `cooldown` / `locked` / `completed` / `in_progress`),
  each paired with an icon + text label (never color alone).
- **GradePill** (domain) — the **best score** per test, mono numeral on the
  grade scale (`grade.A`…`grade.F`); "—" when no attempt exists.
- **Chip/Tag** (data) — the status filter chips (All · Available · Upcoming ·
  Completed · Locked) at the top.
- **Select** (primitive) — the Sort control (Window · Space · Status).
- **EmptyState** (data) — no-tests and empty-after-filter variants.
- **ErrorState** (data, distinct from empty) — load failure with Retry.
- **Skeleton** (data) — loading table rows / stacked cards.
- **Button** (primitive) — `ghost` Retry; row "Start"/"Resume"/"Review"
  affordance is the row link itself (no separate primary button needed in the
  row, but `in_progress` rows may show a `spark` **Button** "Resume").
- **Tooltip** (container) — explains _why_ a row is locked/closed/cooling-down
  on hover/long-press.

**Proposed FOUNDATION additions:** none. The status semantics are fully
expressible with **Badge** (icon + label + semantic token) and the
**GradePill** + **SubmissionCard** domain components already in §5. (A dedicated
"TestStatusBadge" is _not_ proposed — it would be a `Badge` variant map, which
is configuration, not a new component.)

---

## 5. States

- **Loading (skeleton):** H1 + subhead render immediately. Web ≥ md: a
  **DataTable** with 4–6 **Skeleton** rows (matching column widths). Mobile: 3–4
  **Skeleton** **SubmissionCard** placeholders. `testSessions.list`,
  `listStoryPoints`, and `getSpaceProgress` may resolve independently — render
  rows as soon as the assessment story points land; show a small inline spinner
  in the **Attempts** / **Best** cells until `testSessions.list` resolves (see
  Partial). No layout shift.
- **Empty — no tests:** **EmptyState** with the ClipboardList-family
  illustration. Heading "No tests scheduled" + warm body: _"You don't have any
  tests right now. When your teacher schedules one, it'll appear here with its
  dates and details — you'll have plenty of notice."_ No CTA (the student can't
  self-create a test).
- **Empty after filtering:** tests exist but the active status chip yields none
  → lighter inline **EmptyState** — _"No tests match this filter. Try 'All' to
  see everything."_ + a "Clear filter" ghost action. (Never the cold no-tests
  copy.)
- **Error:** **ErrorState** (not EmptyState) — heading "We couldn't load your
  tests" + body "Check your connection and try again." + ghost **Button**
  "Retry" → `refetch`. If `listStoryPoints` succeeds but `testSessions.list`
  fails, do **not** error the whole page — render rows with "—" attempts/best
  and a quiet inline note (see Partial).
- **Partial:** assessment story points present, sessions/progress still loading
  or failed → rows show "—" in Attempts/Best with a quiet "Score syncing…"
  microcopy; never block the list on attempt history. Status defaults to the
  schedule-derived value the server can compute without session data.
- **Success:** populated, filterable, sortable list of tests with resolved
  per-row status, attempts, window, and best score.

**Per-row status-gated affordances (server-derived, never client-computed):**

- `available` — row is an active link → landing gate; "Start" intent. If a prior
  attempt exists and attempts remain, intent reads "Retake".
- `in_progress` — row shows a `spark` "Resume" affordance → landing gate, which
  reconciles the active session.
- `scheduled` — row visible but **not** startable; tapping shows a Tooltip
  "Opens {date} {time}"; the landing gate (if reached) holds the start CTA
  disabled.
- `cooldown` — row shows "Retry in {mm:ss}"; not startable until the server says
  so. The countdown shown is the server-returned remaining cooldown
  (display-only, not client-trusted for gating).
- `closed` — window ended; row is non-interactive for starting (may still link
  to **Review** if results released).
- `locked` — passed + `lockAfterPassing`, or attempts exhausted; row is
  non-interactive for starting, links to **Review** if available. Uses the
  **AnswerKeyLock**-adjacent lock affordance to make the locked state legible.
- `completed` — done; row links to results **Review**
  (`/spaces/:spaceId/test/:storyPointId/analytics` or the results view), never
  to a fresh start unless retakes remain.

**Permission/role-gated variations:** B2B is primary. If the same component
serves B2C via `LearnerContext`, the only divergence is the data source (tenant
vs `platform_public`) and empty copy; there is no in-row role gating beyond the
published + class-assigned scoping done server-side in `listStoryPoints`.

---

## 6. Interactions & motion

- **Row/card hover/press:** web row hover raises a subtle `bg.surface` →
  `bg.surface-sunken` row tint (or `e1 → e2` on the mobile card) over
  `motion.fast` with `ease.standard`; on web, hover **prefetches** the
  timed-test landing chunk + that test's session/config (per the prefetch map).
  Mobile uses a press scale/opacity state (no hover). Activating an
  `available`/`in_progress`/`completed` row navigates to the landing gate /
  review; `scheduled`/`cooldown`/`closed`/`locked` rows do not navigate to a
  start — they surface a Tooltip/Sheet explaining the state.
- **Status filter (Chip):** selecting a status chip filters rows client-side;
  the table/list re-flows with a subtle `motion.base` layout transition
  (`ease.standard`). Active chip uses `brand.primary` fill + `text.on-accent`.
- **Sort (Select):** changing sort re-orders rows with the same subtle
  transition. **Default sort = Window** (soonest-closing `available` and
  soonest-opening `scheduled` first) so the most time-sensitive test is at the
  top — the planning default.
- **Cooldown countdown:** `cooldown` rows tick down their "Retry in {mm:ss}"
  using the server-returned remaining time + the RTDB `.info/serverTimeOffset`
  skew correction (same mechanism as the runner's TimerBar) — display-only; the
  server, not this ticker, decides when the test becomes `available`. On
  reaching zero, the row **does not** silently flip to available; a quiet
  `refetch` re-resolves the authoritative status.
- **No optimistic writes** (read-only screen). Retry simply re-runs the query.
- **No celebratory motion here.** This is a planning surface, not a gamification
  moment. A test at `completed` with a passing best score shows a calm
  `status.success` Badge + GradePill — **NOT** a **CelebrationBurst**. The one
  celebratory moment (spring pop + marigold `spark` burst) belongs to the test
  _result_ surface (first pass / XP / streak), not this list. Respect
  `prefers-reduced-motion`: filter/sort reflow and hover tints cross-fade
  instantly; no spring anywhere.

---

## 7. Content & copy

- **H1:** "Tests".
- **Subhead:** "Your scheduled tests across every space." (Calm,
  planning-oriented.)
- **Count badge:** "5 tests" (singular "1 test").
- **Status filter chips:** "All", "Available", "Upcoming", "Completed",
  "Locked". (Cooldown rolls under "Available"'s sibling grouping or shows within
  "All"; the chip set stays short and scannable.)
- **Sort options:** "Window" (default), "Space", "Status".
- **Column headers (web):** "Test", "Space", "Status", "Window", "Attempts",
  "Best".
- **Status Badge labels (each with an icon):**
  - "Available" (status.info / `brand.primary` chrome) — startable now.
  - "Opens {date}" / "Upcoming" (`status.info` with a calendar-clock icon) —
    scheduled.
  - "Closed" (`text.muted` / neutral with a lock-line icon) — window ended.
  - "Retry in {mm:ss}" (`status.warning`, with a refresh icon) — cooldown.
  - "Locked" (`text.muted` neutral, lock icon) — passed-and-locked or attempts
    used up.
  - "Completed" (`status.success`, check icon) — done.
  - "In progress" (`spark`, play icon) — resumable.
- **Window cell copy:** "Closes {Mon DD, h:mm a}", "Opens {Mon DD, h:mm a}",
  "Retry in {mm:ss}", or "—". (Dates use the learner's locale; numerals in
  Spline Mono.)
- **Attempts cell:** "{used} / {max}" (e.g. "1 / 3"); if unlimited, "{used}
  attempts". Tooltip: "You've used {used} of {max} attempts."
- **Best cell (GradePill):** "{percentage}%" on the grade scale, or "—" with
  tooltip "No attempt yet — ready when you are."
- **Row intent verbs:** "Start" (first attempt, available), "Retake"
  (available + prior attempt + attempts remain), "Resume" (in_progress),
  "Review" (completed/closed/locked with results), "Opens {date}" (scheduled,
  non-action).
- **Tooltips for non-startable states (warm, explanatory — never scolding):**
  - Scheduled: "This test opens {date} at {time}. We'll be ready when it does."
  - Cooldown: "Take a breather — you can retry in {mm:ss}."
  - Locked (passed): "Nice work — you've passed this one, so it's locked. Open
    Review to see how you did."
  - Locked (no attempts left): "You've used all your attempts for this test.
    Open Review to revisit your work."
  - Closed: "This test's window has closed."
- **Empty (no tests):** "No tests scheduled" / "You don't have any tests right
  now. When your teacher schedules one, it'll appear here with its dates and
  details — you'll have plenty of notice."
- **Empty (filtered):** "No tests match this filter." — action "Clear filter".
- **Error:** "We couldn't load your tests" / "Check your connection and try
  again." — action "Retry".
- **Tone:** scores are precise (exact %, exact attempt counts, exact dates) but
  framing is kind — "ready when you are" for un-attempted, "Nice work" for
  passed, "Take a breather" for cooldown. Never "Failed" / "Wrong" / "Overdue"
  as a primary label; "Closed" is the neutral term for a missed window.

---

## 8. Domain rules surfaced

- **Schedule / attempt / cooldown / lock states are server-derived.** The single
  resolved status per test comes from the server (computed against
  `assessmentConfig.schedule`, `maxAttempts`, `retryConfig.cooldownMinutes`,
  `retryConfig.lockAfterPassing`, and the learner's session history). The client
  renders it; it does **not** recompute open/closed/expiry from the device
  clock. (Removes today's client-side `Date.now()` schedule math.) Every status
  is shown as a **labeled Badge with an icon** — never color alone (FOUNDATION
  §2 contrast rule).
- **Timer is server-authoritative (downstream).** This list never starts a
  countdown; the cooldown "Retry in {mm:ss}" ticker is a display of
  server-returned remaining time with `.info/serverTimeOffset` skew correction,
  and it **does not gate** start — a quiet `refetch` re-resolves authoritative
  status. The real, server-authoritative **TimerBar** lives in the test runner,
  reached through the landing gate.
- **Answer-key never shown.** This list shows status, attempts, and **best
  score** only — never any item correctness or stored answers. Even for
  `completed`/`locked` tests, the "Best" GradePill is an aggregate score, not
  item-level keys. Item-level feedback/explanations (server-returned) appear
  only on the downstream results/review surface, and only post-submission for
  released results. The **AnswerKeyLock** visual is reused to make `locked`
  legible.
- **Links route into the timed-test landing gate, never straight into a running
  test.** Rows route to `/spaces/:spaceId/test/:storyPointId` (the
  landing/instructions gate), which owns the start CTA, schedule re-check, and
  `startTestSession`. The list never bypasses that gate.
- **Gamification one-moment is NOT here.** No **CelebrationBurst** on this
  planning surface; passing is a calm `status.success` Badge. All motion stays
  subtle per FOUNDATION §4.
- **Tenant isolation.** `listStoryPoints` / `testSessions.list` /
  `getSpaceProgress` are tenant-scoped server-side from the caller's
  active-tenant claim (B2B) or `platform_public` + `consumerProfile` (B2C). The
  client passes no `tenantId` in the body. The UI cannot read another tenant's
  tests or another learner's sessions (`testSessions.list` is scoped to the
  caller's `uid`).
- **Published + class-assigned only (B2B).** Only `status: published` assessment
  story points in spaces assigned to the student's class are returned — enforced
  server-side.

---

## 9. Accessibility

- **Landmarks/order:** `main` region; focus order = H1 → status filter chips →
  Sort Select → first row/card → … . **SkipToContent** lands on the H1.
  **RouteAnnouncer** announces "Tests, {n} tests" on navigation, and announces
  the active filter result count when a chip changes.
- **DataTable (web):** a proper `<table>` with `<th scope="col">` headers;
  sortable headers expose `aria-sort`. Each row is keyboard-focusable;
  `Enter`/`Space` activates the row's primary intent (Start/Resume/Review) for
  actionable statuses. Non-actionable rows
  (`scheduled`/`cooldown`/`closed`/`locked`) are still focusable and announce
  their status + reason via the row's accessible name (e.g. "Big-O Test, DSA,
  Upcoming, opens June 24, not yet available").
- **Mobile cards:** each **SubmissionCard** is a single semantic pressable with
  an accessible name combining test title + space + status + best ("Arrays Quiz,
  DSA, available, best 82 percent, 1 of 3 attempts used").
- **Status Badge:** conveys state with **icon + text label**, never color alone;
  `role` text is read by SR. The cooldown ticker uses `aria-live="off"`
  (visual-only) to avoid spamming SR with per-second updates; the row's status
  is re-announced only on `refetch` resolution.
- **GradePill:** accessible label "Best score {percentage} percent"; "—" reads
  "No attempt yet".
- **Chips/Select:** standard Radix keyboard semantics; active chip exposes
  `aria-pressed`; Select fully keyboard-operable; mobile Sort Sheet traps focus
  and restores on close.
- **Tooltips:** lock/cooldown/scheduled explanations are keyboard- and
  SR-reachable (Radix Tooltip on focus, not hover-only).
- **Contrast:** all text/bg pairs meet WCAG AA (body 4.5:1, large/UI 3:1) per
  FOUNDATION §2; `border.focus` (indigo @35%) ring on every focusable.
- **Reduced motion:** `prefers-reduced-motion` disables filter/sort reflow
  animation, hover row tint transition, and any countdown easing (instant
  updates); no spring anywhere.
- **Touch targets:** ≥44px for chips, sort control, and each row/card hit area.

---

## 10. Web ↔ mobile divergence (FOUNDATION §6)

- **Primary layout:** web ≥ md = **DataTable** (Test · Space · Status · Window ·
  Attempts · Best); mobile = stacked **SubmissionCard**-style cards (same data,
  reflowed) — the canonical table→cards divergence.
- **Shell:** web = Sidebar + Topbar; mobile = bottom **Tabbar** + compact
  header.
- **Find/search:** web has **CommandPalette (⌘K)** + Topbar search to jump to a
  test by name; **mobile has no ⌘K** — find is the in-page status chips +
  scroll.
- **Hover → press:** web row hover tint + landing-gate **prefetch**; mobile
  press state, prefetch on viewport-enter instead.
- **Sort control:** web inline **Select**; mobile collapses to an IconButton →
  bottom **Sheet** with the same options.
- **Status filter chips:** web wrap; mobile horizontal scroll row.
- **Tooltips:** web on hover/focus; mobile via long-press → bottom **Sheet**
  (Radix Tooltip has no mobile hover).
- Component **names/props are 1:1** between `shared-ui` (web) and `ui-native`
  (mobile); only the renderer differs (DataTable on web maps to a card list on
  RN behind the same headless `useDataTable` state).

---

## 11. Claude-design prompt (ready to paste)

```
Design the "Tests (List)" screen for the Auto-LevelUp STUDENT web app, conforming STRICTLY
to the Lyceum design system in docs/rebuild-spec/design/00-FOUNDATION.md (Direction A —
"Modern Scholarly"). Do not invent tokens, fonts, colors, radii, shadows, motion, or
component variants — compose only from FOUNDATION §2/§3/§4/§5 and cite tokens by semantic
name.

CONTEXT
- The learner's planning surface for timed tests/quizzes across all their spaces, at route
  /tests (B2B student; same component can serve B2C via LearnerContext). Read-only — rows
  route INTO the timed-test landing gate (/spaces/:spaceId/test/:storyPointId), never
  straight into a running test.
- Data via @levelup/api-client (UI never touches Firestore; timestamps epoch-ms):
  v1.levelup.listStoryPoints (assessment-type story points + assessmentConfig:
  durationMinutes, maxAttempts, passingPercentage, schedule.start/endAt,
  retryConfig.cooldownMinutes/lockAfterPassing, stats.totalQuestions),
  v1.levelup.testSessions.list (attempts used, best score, in-progress/resumable),
  v1.levelup.getSpaceProgress(scope: allSpaces) for parent-space context.
- CRITICAL: each test's status is SERVER-DERIVED and returned as a single enum —
  available | scheduled | closed | cooldown | locked | completed | in_progress. The client
  RENDERS it; it never recomputes open/closed/expiry from the device clock.

LAYOUT
- Inside AppShell (Sidebar + Topbar on web; bottom Tabbar on mobile).
- Page header: H1 "Tests" (Fraunces) + calm subhead "Your scheduled tests across every
  space." + a small count Badge.
- Filter/sort bar: status Chip filters (All · Available · Upcoming · Completed · Locked) and
  a Sort Select (Window [default] · Space · Status).
- WEB ≥ md: a DataTable with columns Test · Space · Status · Window · Attempts · Best.
  Status = a labeled Badge (icon + text). Window = "Closes {date}" / "Opens {date}" /
  "Retry in {mm:ss}" / "—". Attempts = "{used} / {max}" in Spline Mono. Best = a GradePill
  (grade-scale %), or "—".
- MOBILE < md: stacked SubmissionCard-style cards (test title, space · {n} questions ·
  {duration} min, window line, attempts, best GradePill, status Badge). Whole row/card →
  landing gate for actionable statuses; non-actionable (scheduled/cooldown/closed/locked)
  show an explanatory Tooltip/Sheet instead.

STATES
- Skeleton table rows / cards while loading; render rows as soon as listStoryPoints resolves
  and show "—" + "Score syncing…" in Attempts/Best until testSessions.list lands (partial —
  never block the list on attempt history).
- Empty: "No tests scheduled" / "You don't have any tests right now. When your teacher
  schedules one, it'll appear here with its dates and details — you'll have plenty of
  notice." (no CTA).
- Empty after filter: "No tests match this filter." + "Clear filter".
- ErrorState (distinct from empty): "We couldn't load your tests" + ghost "Retry".

STATUS BADGES (icon + label, NEVER color alone)
- Available (brand.primary) · Opens {date}/Upcoming (status.info, calendar-clock) · Closed
  (neutral text.muted, lock-line) · Retry in {mm:ss} (status.warning, refresh) · Locked
  (neutral, lock — reuse the AnswerKeyLock affordance) · Completed (status.success, check) ·
  In progress (spark, play — shows a spark "Resume" affordance).

MOTION & TONE
- Subtle only: row hover tint / e1→e2 (motion.fast), filter/sort reflow (motion.base,
  ease.standard). Cooldown "Retry in {mm:ss}" ticks down using server-returned remaining
  time + serverTimeOffset skew (display-only, does NOT gate start; refetch re-resolves
  status at zero).
- NO CelebrationBurst here — passing is a calm status.success Badge; the gamification
  one-moment belongs to the result surface. Respect prefers-reduced-motion (no spring,
  instant reflow).
- Warm, planning tone: precise scores/dates, kind framing. Un-attempted Best reads "ready
  when you are"; cooldown reads "Take a breather — you can retry in {mm:ss}"; passed-locked
  reads "Nice work — you've passed this one". Use "Closed" (neutral) for a missed window,
  never "Failed/Overdue".

DOMAIN RULES
- Status is server-derived; no client clock math. Answer keys never shown — only status,
  attempts, and best score; item feedback lives downstream post-submission. Rows route into
  the landing gate, never bypass it. Tenant-isolated, published + class-assigned only,
  server-scoped to the caller's uid.

A11Y
- main landmark; focus order H1 → status chips → sort → rows. Web = real <table> with
  scope="col" headers + aria-sort; non-actionable rows still focusable and announce their
  status + reason. Mobile cards = single pressables named "Title, Space, status, best %,
  {used}/{max} attempts". Status Badge = icon+label; cooldown ticker aria-live off.
  AA contrast, border.focus rings, ≥44px targets, reduced-motion honored.

Deliver: a responsive React + Tailwind implementation using shared-ui components
(DataTable, SubmissionCard, Badge, GradePill, Chip/Tag, Select, EmptyState, ErrorState,
Skeleton, Button, Tooltip) reading the Lyceum tokens. Show the web ≥ md DataTable, the
mobile stacked-card layout, and the no-tests empty + error states, with all seven status
badges represented.
```
