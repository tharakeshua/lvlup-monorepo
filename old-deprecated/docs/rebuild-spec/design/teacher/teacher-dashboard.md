# Teacher Dashboard

> The teacher's operational landing surface — "what needs my attention today
> across my classes." A calm, credible monitoring console (not an authoring or
> grading workspace): a KPI strip, an attention-needed feed, a my-classes
> quick-access grid, recent notifications, and (tenantAdmin only) AI-cost/quota
> awareness. It surveys and deep-links; it never authors or grades inline.

**Route** `/` · **Roles** `teacher` (own classes) · `tenantAdmin` (all classes)
· **Primary APIs** `analytics.getSummary` (scope `class`, per managed class) ·
`analytics.dailyCost` (tenantAdmin) · `classes.list` · `exams.list` ·
notifications repo (`identity.manageNotifications` action `list`)

This spec conforms to `design/00-FOUNDATION.md` ("Lyceum / Modern Scholarly").
All tokens, type, spacing, radius, elevation, motion, and components are cited
by their FOUNDATION semantic names — no new tokens or variants are introduced.
Per FOUNDATION §1, staff surfaces read **credible and focused**: restraint in
chrome, no gamification celebration except where a teacher views a student's
read-only state.

---

## 1. Purpose & primary user

**Primary user:** a `teacher` (sees only classes they manage) or a `tenantAdmin`
(sees all classes in the active tenant). Both land here at `/` after auth.

**Job-to-be-done:** _"In under 30 seconds, tell me where my attention is needed
today across my classes, and let me jump straight to the thing that needs it."_
The dashboard is a triage surface — it surveys state and routes the teacher into
the deep surfaces (Class Detail, the EXAMS area, the SPACES area) where the
actual work happens.

**Explicitly NOT this screen's job** (FOUNDATION + domain rules): authoring
spaces/items (that is the SPACES area), grading or releasing exam results (that
is the EXAMS area / GradingReview), editing class rosters (Class Detail), or any
client-side recomputation of stats or risk. The dashboard only _reads
precomputed, server-authoritative summaries_ and links out.

**Emotional register:** precise, calm, professional. No XP meter, streak flame,
level-up burst, or celebratory marigold chrome on this surface. `spark` appears
only on a single primary CTA glow if one is present, never as ambient
decoration.

---

## 2. Entry points & route

**Route:** `/` — the index route of teacher-web, gated by
`RequireAuth allow={['teacher','tenantAdmin']}` (FOUNDATION §4 single
config-driven guard). It is the `home` nav item (`navMeta.group: 'Overview'`,
`mobile: true`).

**Entry points:**

- Default post-login landing (auth-store resolves active tenant → redirect to
  `/`).
- The "Dashboard" sidebar item (`AppSidebar`) and the mobile `MobileBottomNav`
  home tab.
- Logo / app-name click in `Topbar` returns here.
- `CommandPalette` (⌘K) "Go to Dashboard".

**Reads powering it** (all via `@levelup/api-client` repositories / hooks — UI
never touches Firestore; see `specs/common-api.md` §3.3):

- `classes.list` → the set of classes the caller can see. Server scopes this to
  `ctx.classIds` (claim `classIds` / `managedClassIds`, with the
  `classIdsOverflow` fallback when >15 classes) for `teacher`; full tenant set
  for `tenantAdmin`. `tenantId` is derived from claims server-side — never a
  request field.
- `analytics.getSummary` with `scope: 'class'`, called per visible classId
  (membership-checked server-side). Returns the precomputed
  `ClassProgressSummary` (`className`, `studentCount`,
  `autograde.averageClassScore`, `autograde.examCompletionRate`,
  `autograde.{top,bottom}Performers`, `levelup.averageClassCompletion`,
  `levelup.activeStudentRate`, `atRiskStudentIds`, `atRiskCount`,
  `lastUpdatedAt`).
- `exams.list` → exams for visible classes, used purely for **status counts**
  (e.g. submissions awaiting review, results pending release). The dashboard
  reads status, not answer keys or per-question content.
- Notifications repo (`identity.manageNotifications` action `list`) → recent
  notifications feed; shares the same store/query that feeds the `Topbar`
  `NotificationBell` (one source, two surfaces).
- `analytics.dailyCost` → **tenantAdmin only.** Returns `DailyCostSummary`
  (yesterday's LLM spend, month-to-date, and `subscription.monthlyBudgetUsd`
  budget headroom with 80%/100% thresholds). Never requested or rendered for a
  plain `teacher`.

**Writes:** none of substance. The only mutation reachable from this surface is
"mark notification read" (`identity.manageNotifications` action `markRead`) from
the notifications card. All other actions are navigations.

---

## 3. Layout (wireframe-as-text)

Rendered inside `PlatformLayout` → `AppShell` (FOUNDATION §5 Navigation;
`specs/webapps-design.md` §3.1): persistent left `Sidebar` (role-driven nav),
`Topbar` (tenant switcher, ⌘K search, `NotificationBell`,
profile/`ThemeToggle`), and on mobile a `Tabbar` (`MobileBottomNav`) replacing
the sidebar. The dashboard owns only the **main content region**. Page gutters
follow FOUNDATION §4 (mobile 16 / tablet 24 / desktop 32); max content
width 1200. Vertical rhythm uses `gap` from the spacing scale (sections
separated by space-8/`32`).

```
┌─ AppShell ───────────────────────────────────────────────────────────────┐
│ Sidebar │  Topbar: [tenant ▾] ……… [⌘K search] [🔔 bell] [theme] [avatar] │
│ (nav)   ├───────────────────────────────────────────────────────────────┤
│         │  MAIN  (max-w 1200, gutter 32)                                   │
│         │  ┌─ Page header ─────────────────────────────────────────────┐  │
│         │  │ h1 "Dashboard"   ·  subline "Good morning, {name}" + date  │  │
│         │  │                                   [ View analytics → ]     │  │
│         │  └────────────────────────────────────────────────────────────┘ │
│         │  ┌─ KPI STRIP (Stat/KPI ×4, grid) ───────────────────────────┐  │
│         │  │ ▸Active classes  ▸Students taught  ▸Avg class perf  ▸Await │  │
│         │  │   12               338               74%            9 review │  │
│         │  └────────────────────────────────────────────────────────────┘ │
│         │  ┌─ ADMIN ONLY: AI cost / quota banner (QuotaWarningBanner) ──┐  │
│         │  │ only if tenantAdmin AND month-to-date ≥ 80% of budget      │  │
│         │  └────────────────────────────────────────────────────────────┘ │
│         │  ┌─ 2-col region (lg) ───────────────────────────────────────┐  │
│         │  │ ┌ ATTENTION NEEDED (Card, 60%) ┐ ┌ RECENT (Card, 40%) ──┐ │  │
│         │  │ │ InsightCard / row list:       │ │ Notifications (5)     │ │  │
│         │  │ │  • At-risk students (AtRisk   │ │  • row · time · read  │ │  │
│         │  │ │    Badge + reasons)           │ │  • row …              │ │  │
│         │  │ │  • Exams awaiting review →    │ │  [ View all → ]       │ │  │
│         │  │ │  • Results pending release →  │ └───────────────────────┘ │  │
│         │  │ │  • Low-performing classes →   │  ┌ AI USAGE (admin only) ┐ │  │
│         │  │ │  [ See all attention items ]  │  │ Stat: $ today · MTD   │ │  │
│         │  │ └───────────────────────────────┘  │ ProgressBar vs budget │ │  │
│         │  │                                     └───────────────────────┘ │  │
│         │  └────────────────────────────────────────────────────────────┘ │
│         │  ┌─ MY CLASSES (quick-access grid of Card) ──────────────────┐  │
│         │  │ [ClassCard] [ClassCard] [ClassCard] [ClassCard]            │  │
│         │  │  name·#students·avg%·atRisk chip → /classes/:id            │  │
│         │  └────────────────────────────────────────────────────────────┘ │
└─────────┴───────────────────────────────────────────────────────────────┘
```

**Region order & grid:**

1. **Page header** — `h1` "Dashboard" (Fraunces display) + a secondary subline
   (Schibsted, `text.secondary`) with greeting + today's date; a trailing ghost
   `Button` "View analytics →" (right-aligned on md+, stacks under header on
   sm).
2. **KPI strip** — four `Stat/KPI` cards in a grid: `grid-cols-1` (sm) →
   `grid-cols-2` (md) → `grid-cols-4` (lg+). `gap` = space-4/`16`.
3. **Admin cost banner** — `QuotaWarningBanner` (`InlineAlert` family), rendered
   _only_ for `tenantAdmin` _only when_ month-to-date ≥ 80% of budget.
   Full-width, sits above the two-column region.
4. **Two-column region** — `grid-cols-1` (sm/md) → `lg:grid-cols-[3fr_2fr]`
   (lg+). Left = **Attention needed** `Card`; right = a stacked column of
   **Recent notifications** `Card` and (admin) **AI usage** `Card`. `gap` =
   space-6/`24`.
5. **My classes grid** — `Card`-based class tiles: `grid-cols-1` (sm) →
   `grid-cols-2` (md) → `grid-cols-3` (lg) → `grid-cols-4` (xl). `gap` =
   space-4/`16`.

**Responsive summary:**

- **sm (<768):** single column throughout; KPI cards stack 1-up then 2-up;
  two-column region collapses to attention-needed first, then recent, then
  (admin) AI usage; class grid 1-up. Header CTA wraps below the title.
- **md (768–1023):** KPIs 2×2; attention/recent stack vertically (attention
  first); class grid 2-up.
- **lg+ (≥1024):** KPIs 4-up; attention(3fr)/recent(2fr) side-by-side; class
  grid 3–4 up. Content centered within max-w 1200.

Cards use radius `lg` and elevation `e1` at rest, `e2` on hover (FOUNDATION §4).
Background is `bg.canvas`; cards are `bg.surface`.

---

## 4. Components used

All from FOUNDATION §5 / the `shared-ui` inventory (`specs/webapps-design.md`
§2.2). No new primitives.

| Region               | Component(s)                                                                                                                                  | Notes                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Shell                | `AppShell`, `Sidebar`, `Topbar`, `NotificationBell`, `CommandPalette`, `MobileBottomNav` (mobile), `SkipToContent`, `RouteAnnouncer`          | Provided by `PlatformLayout`; not rebuilt here.                                                                |
| Header               | `Button` (ghost variant, "View analytics →"), `Breadcrumb` (optional, single crumb)                                                           | Fraunces `h1`; `spark` never used here.                                                                        |
| KPI strip            | `Stat/KPI` ×4 (a.k.a. `StatCard`/`ScoreCard`)                                                                                                 | Mono numerics (Spline Sans Mono) for the values per FOUNDATION §3. Optional trend caption in `text.secondary`. |
| Attention feed       | `Card` + `InsightCard` rows, `AtRiskBadge`, `Badge`/`Chip`, `Avatar`, `Button` (ghost row-link), `GradePill`/`ScoreCard` micro for class-perf | `AtRiskBadge` renders `isAtRisk` + reasons read-only; never computed client-side.                              |
| Recent notifications | `Card`, `Timeline` or simple row list, `Badge` (unread dot), `Avatar`, `Button` (ghost "View all →")                                          | Shares the notifications query with the bell.                                                                  |
| AI usage (admin)     | `Card`, `Stat/KPI`, `ProgressBar`, `QuotaWarningBanner`                                                                                       | Rendered only for `tenantAdmin`.                                                                               |
| My classes           | `Card` (class tile), `Stat`/inline metric, `AtRiskBadge`/`Chip`, `Avatar`                                                                     | Each tile is a link to `/classes/:classId`.                                                                    |
| Loading              | `Skeleton`                                                                                                                                    | Matches the final layout silhouette.                                                                           |
| Empty / error        | `EmptyState`, `ErrorState`/`InlineAlert`                                                                                                      | Distinct empty vs error states.                                                                                |
| Feedback             | `Toast` (sonner)                                                                                                                              | Only for the rare notification "mark read" confirmation; otherwise silent.                                     |

**Proposed addition — none required.** The "ClassCard" tile is composed from the
existing `Card` + `Stat` + `AtRiskBadge`; it is not a new primitive. If the team
prefers a named `ClassCard` composite it can be added to `shared-ui/data`, but
it is purely a composition of §5 parts and is **not** a new token/variant. No
new component is mandated by this screen.

---

## 5. States

The dashboard composes several independent data sources, so it is designed for
**partial** readiness, not all-or-nothing.

**Loading (skeleton).** On first mount with no cached data, render the full
layout silhouette in `Skeleton` (FOUNDATION §5): four KPI skeleton blocks, an
attention-feed skeleton (header bar + 4 row blocks), a notifications skeleton
(header + 3 rows), and a class-grid skeleton (3–4 tiles). The region wrapper
carries `role="status"` `aria-label="Loading dashboard"`. Skeletons fade out and
content fades in with `ease.entrance` over `base` (220ms). No spinner overlay.

**Partial.** Each card resolves independently from its own query:

- KPIs that depend only on `classes.list` (Active classes, Students taught)
  render as soon as that resolves; "Avg class performance" and "Awaiting review"
  keep a small inline `Skeleton` on just their numeric until
  `analytics.getSummary`/`exams.list` settle.
- The attention feed shows a per-row `Skeleton` while class summaries stream in
  (it fans out one `getSummary` per class).
- Recent notifications and My-classes render independently; one slow source
  never blocks the others.

**Empty.** Per-region `EmptyState` (FOUNDATION §5), each with a Fraunces title +
`text.secondary` body + an optional ghost CTA:

- _No managed classes_ (a `teacher` with empty `classIds`): whole-page
  `EmptyState` — "No classes assigned yet" — directing them to ask their admin
  (no "create class" CTA for a plain teacher). A `tenantAdmin` with zero classes
  gets "No classes in this tenant yet" with a "Create a class" CTA → `/classes`.
- _Nothing needs attention_ (the good state): attention card shows a calm,
  affirming `EmptyState` — "You're all caught up" — with a check icon in
  `status.success`, no alarm color.
- _No notifications_: "No recent notifications."
- _No exams yet_: the exam-derived attention rows simply omit; no error.

**Error.** Distinct from empty (FOUNDATION §5 / `specs` §2.2 `ErrorState`). A
failed query renders an in-card `ErrorState`/`InlineAlert` (`status.error`,
icon + label, never color-alone) scoped to that card with a "Retry" `Button`
(ghost) that refetches just that query. Errors are read from
`error.details.code` (`specs/common-api.md` §6) and mapped to safe copy; a
whole-page failure (e.g. `classes.list` rejects) shows a single page-level
`ErrorState` with retry. Errors are never silently rendered as empty.

**Permission-gated variants by role:**

- **`teacher`:** sees only their managed classes (server-scoped via
  `ctx.classIds` + overflow fallback). The **AI cost/quota** card and the admin
  `QuotaWarningBanner` are **absent entirely** (not just disabled). KPIs and
  feeds reflect only their classes. No cross-tenant or cross-teacher data ever
  appears.
- **`tenantAdmin`:** sees all classes in the active tenant; the AI usage card
  and quota banner render (banner only past the 80% threshold). Otherwise
  identical layout.
- Any deep-link CTA that targets a permission-gated action (e.g. release
  results) is itself gated downstream by `TeacherPermissions` in the EXAMS area;
  the dashboard only links, so it does not itself need to hide links by
  sub-permission, but it _omits_ the AI/cost surface by role as above.

---

## 6. Interactions & motion

**Core flow (triage → deep link).** Every attention-feed row, class tile,
notification, and KPI-with-target is a navigation, not an inline mutation:

- At-risk student row → `/students/:studentId/report` (read-only student report,
  including read-only gamification state).
- "Exams awaiting review" row → `/exams` filtered, or directly to
  `/exams/:examId/submissions`.
- "Results pending release" row → `/exams/:examId` (release happens there, gated
  by permission — not here).
- "Low-performing class" row / any class tile → `/classes/:classId`.
- "View analytics →" → `/analytics/classes`.

**Motion (FOUNDATION §4 tokens, "felt not seen"):**

- Section entrance: staggered `FadeIn` using `ease.entrance` over `base`
  (220ms), each region delayed ~60–100ms after the previous (header → KPIs →
  attention/recent → classes). Respect `prefers-reduced-motion` → no stagger,
  instant render.
- Card hover: elevation `e1` → `e2` and a 1px border shift to `border.strong`
  over `fast` (160ms) `ease.standard`. Cursor pointer on whole-card links.
- Skeleton → content crossfade over `base`.
- Page navigation away uses the shell `PageTransition` (`page` 420ms) — owned by
  `PlatformLayout`, not this screen.
- **No celebratory motion.** Per FOUNDATION §4 the one spring/marigold-burst
  moment is reserved for student gamification; this staff surface never uses it.

**Feedback & optimistic updates:**

- This is a read surface; there are no optimistic writes for KPIs/feeds (stats
  are server-authoritative — the client never recomputes risk, scores, or
  counts).
- Marking a notification read (from the recent card) is the only mutation:
  optimistic — the unread dot clears immediately and the `NotificationBell`
  count decrements via the shared query; on failure it rolls back and a `Toast`
  (sonner, `status.error`) reports "Couldn't update notification." Success is
  silent.
- "Retry" on a card error refetches only that query with a brief inline
  `Skeleton`.

**Confirmations:** none required on this surface (no destructive actions live
here). `CommandPalette` (⌘K) opens the global palette for
jump-to-class/exam/student/space; Esc closes it (`ease.exit`).

**Refresh semantics:** React Query defaults (`refetchOnWindowFocus: false`); a
manual refresh is available via re-navigation. At-risk flags and summaries
update only when the nightly rule engine / triggers recompute them server-side —
the dashboard surfaces `lastUpdatedAt` from `ClassProgressSummary` in
`text.muted` so the teacher knows the freshness, and never implies live
recomputation.

---

## 7. Content & copy

Tone: direct, professional, calm (FOUNDATION §1 staff register). Numerals in
mono.

**Header**

- h1: `Dashboard`
- Subline: `Good morning, {firstName}.` (time-of-day aware: Good morning /
  afternoon / evening) followed by `· {Weekday}, {Month} {D}`. Fallback name:
  the display name, then email local-part, then `Teacher`.
- CTA: `View analytics →`

**KPI strip** (label · value · optional caption)

- `Active classes` · `{n}` · (admin caption: `across this tenant`; teacher:
  `you manage`)
- `Students taught` · `{n}` · `{n} at risk` (caption in `status.warning` if any,
  else `text.muted`)
- `Avg class performance` · `{pct}%` · `last updated {relative}` (from averaged
  `autograde.averageClassScore` across visible summaries)
- `Submissions awaiting review` · `{n}` · `across {m} exams`

**Attention needed (card title):** `Attention needed`

- Subhead when populated: `{n} items across your classes`
- At-risk row: `{Student name}` · `AtRiskBadge` · reasons rendered from
  `atRiskReasons` (e.g. "Low recent scores · Zero streak · Inactive") — strings
  come verbatim from the server rule engine, never re-worded or recomputed.
- Exam-review row: `{Exam title}` · `{n} submissions awaiting review` → links to
  submissions.
- Results-pending row: `{Exam title}` · `Results ready to release` (only when
  grading complete and not yet released; respects `releaseResultsAutomatically`
  gating — if auto-release is on, this row never appears).
- Low-performing class row: `{Class name}` · `Avg {pct}% — below {threshold}%`
- Footer link: `See all attention items →`
- **Empty (good) state:** title `You're all caught up`, body
  `No at-risk students, pending reviews, or flagged classes right now.`
  (success-toned check icon)

**Recent notifications (card title):** `Recent`

- Row: `{notification title}` · `{relative time}` · unread dot.
- Footer link: `View all →` → `/notifications`
- Empty: `No recent notifications.`

**AI usage — tenantAdmin only (card title):** `AI usage`

- `Spent today` · `${x.xx}`
- `This month` · `${x.xx} of ${budget}` with a `ProgressBar`.
- Banner copy when ≥80%: `AI usage is at {pct}% of this month's budget.`
  (`status.warning`); at ≥100%: `This month's AI budget has been reached.`
  (`status.error`). Tone: factual, no alarm language.

**My classes (section title):** `My classes` (teacher) / `Classes` (admin)

- Tile: `{Class name}` · `{n} students` · `Avg {pct}%` · at-risk chip
  `{n} at risk` (omit chip if 0).
- Empty (teacher): title `No classes assigned yet`, body
  `Your administrator hasn't assigned you to any classes. Reach out to them to get started.`
- Empty (admin): title `No classes yet`, body
  `Create your first class to start tracking student progress.`, CTA
  `Create a class`.

**Error copy (per card):** title `Couldn't load {region}`, body
`Something went wrong fetching this data.`, action `Retry`. Page-level:
`Couldn't load your dashboard` / `Retry`.

---

## 8. Domain rules surfaced

- **Tenant isolation.** Everything is scoped to the caller's active tenant;
  `tenantId` is derived from claims server-side, never a form field and never
  shown. Cross-tenant data can never appear; switching tenants (Topbar switcher)
  reloads the whole dashboard against the new active tenant.
- **Role-scoped class visibility.** A `teacher` sees only classes in their claim
  `classIds` / `managedClassIds`, honoring the 15-class JWT cap with the
  `classIdsOverflow` Firestore fallback (`status/auth-access.md` §1.3). A
  `tenantAdmin` sees all tenant classes. The KPI counts, attention feed, and
  class grid all reflect this scope — there is no client filter that could leak
  a class the caller can't access.
- **Server-authoritative stats.** Avg performance, completion, at-risk counts,
  and submission counts are read from precomputed `ClassProgressSummary`
  (`analytics.getSummary` scope `class`) and `exams.list` status counts. The
  client never recomputes scores or risk; `lastUpdatedAt` is surfaced so
  freshness is honest.
- **At-risk is rule-engine-derived.** `isAtRisk` + `atRiskReasons` come from the
  nightly at-risk rule engine (`status/be-analytics.md` schedulers); the
  dashboard renders `AtRiskBadge` from those fields read-only and never
  evaluates risk thresholds in the browser.
- **Results-release gating.** "Results ready to release" rows honor
  `releaseResultsAutomatically` / results-released status — the dashboard never
  exposes results that aren't released, and releasing happens in the EXAMS area,
  not here.
- **Answer keys never client-side.** This surface reads exam _status counts_
  only; it never requests or displays questions, rubrics, or answer keys (those
  are server-protected and merged only via `items.getForEdit` in authoring).
- **Reads via repositories, writes via callables.** All reads go through
  `@levelup/api-client` repos; the lone write (mark-notification-read) goes
  through the `identity.manageNotifications` callable — no direct client
  Firestore writes (`specs/webapps-design.md` §0).
- **AI cost is admin-only.** `analytics.dailyCost` and the quota banner are
  gated to `tenantAdmin`; a plain teacher's bundle never even requests cost
  data.
- **Operational, not authoring/grading.** Per the brief, this screen monitors
  and deep-links; it does not redesign or embed authoring or grading.

---

## 9. Accessibility

Conforms to FOUNDATION §2 (contrast) and §4 (reduced-motion), and
`specs/webapps-design.md` §2.4.

- **Landmarks & focus order:** `SkipToContent` link first; then `Topbar`,
  `Sidebar`, then `main`. Within `main`, DOM/focus order = header CTA → KPI
  cards → admin banner (if present) → attention feed (rows top-to-bottom) →
  recent notifications → AI usage → class grid. Tab order matches visual order
  at every breakpoint.
- **Keyboard:** every interactive element (KPI-with-link, attention rows,
  notification rows, "mark read", retry, class tiles, header/footer CTAs) is a
  real focusable control reachable by Tab/Shift-Tab and activated by
  Enter/Space, with a visible focus ring (`border.focus`, the FOUNDATION focus
  ring `0 0 0 3px`). ⌘K opens `CommandPalette`; Esc closes it. Whole-card links
  expose a single focusable anchor (not nested tab stops).
- **ARIA & semantics:** loading wrapper `role="status"`
  `aria-label="Loading dashboard"`; each KPI is a labeled group
  (`aria-label="Active classes: 12"`) so the mono numeral is announced with its
  label; the attention feed is a `<section aria-labelledby>` list (`<ul>/<li>`);
  `AtRiskBadge` and any status chip include text, not color alone (FOUNDATION §2
  — "never encode status by color alone"); the notification unread dot has an
  `aria-label="Unread"`. Trend captions are plain text, not icon-only.
- **Contrast:** all text/background pairs use semantic tokens meeting WCAG AA
  (4.5:1 body, 3:1 large/UI). Status colors (`status.error/warning/success`) are
  always paired with an icon + label. `text.muted` is reserved for non-essential
  captions (timestamps) that meet AA at their size.
- **Reduced motion:** `prefers-reduced-motion` disables the staggered `FadeIn`,
  hover elevation transition, and skeleton crossfade — content renders
  immediately, no parallax/transform.
- **Live regions:** the "mark read" optimistic update and any per-card error use
  polite live updates so screen-reader users hear the state change; the error
  `ErrorState` carries `role="alert"` only on hard failures, not on empty
  states.

---

## 10. Web↔mobile divergence (RN parity)

Component names/props match 1:1 between `shared-ui` (web) and `ui-native`
(mobile) per FOUNDATION §6; only the renderer differs. The same headless data
hooks (`analytics.getSummary`, `classes.list`, `exams.list`, notifications) over
`@levelup/api-client` power both.

- **Shell:** web uses `Sidebar` + `Topbar`; RN uses a header + `Tabbar` (bottom
  nav) with the Dashboard as the home tab. The tenant switcher is a
  sheet/`Drawer` on mobile rather than a Topbar dropdown.
- **No ⌘K on mobile:** `CommandPalette` is web-only (FOUNDATION §6). Mobile gets
  a search affordance in the header instead; the dashboard simply omits the ⌘K
  hint.
- **Layout:** the two-column (attention/recent) region collapses to a single
  stacked column on RN (same as web sm); the class grid becomes a single-column
  stacked list of class cards (FOUNDATION §6 "table on web → stacked cards on
  mobile" rule applied to tiles).
- **Hover → press:** web hover elevation (`e1→e2`) maps to a press/active state
  on RN; whole-card links become pressables.
- **Motion:** web `FadeIn`/`ease.entrance`; RN uses the spring/Reanimated
  equivalents for entrance only — still no celebratory burst on this staff
  surface.
- **AI usage / quota:** identical role-gating (tenantAdmin only) on both
  platforms; the `ProgressBar` and `QuotaWarningBanner` have native equivalents.
- **Notifications:** the same shared query feeds the RN notification badge and
  this card, exactly as web shares it with the bell.

---

## 11. A Claude-design prompt

```text
You are generating the **Teacher Dashboard** screen for the Auto-LevelUp teacher-web
portal. Conform EXACTLY to the "Lyceum / Modern Scholarly" design system defined in
docs/rebuild-spec/design/00-FOUNDATION.md and to this spec
(docs/rebuild-spec/design/teacher/teacher-dashboard.md). Do NOT invent colors, fonts,
spacing, radius, elevation, or component variants — compose only from FOUNDATION tokens
and the shared-ui component inventory, citing semantic token names (bg.canvas, bg.surface,
text.primary/secondary/muted, brand.primary, status.success/warning/error, border.subtle/
strong/focus, spark). Fonts: Fraunces (display/h1), Schibsted Grotesk (UI/body), Spline
Sans Mono (numerics). Radius lg on cards, md on buttons. Elevation e1 at rest, e2 on hover.

ROUTE: `/`  ROLES: teacher (own classes) | tenantAdmin (all classes).
TONE: precise, credible, calm — a staff operational monitoring console. NO XP/streak/
celebration chrome; the spark accent is not used as ambient decoration.

BUILD a responsive dashboard inside the AppShell/PlatformLayout main region (max-w 1200,
desktop gutter 32, section gap 32) with these regions, in order:
1. Page header: Fraunces h1 "Dashboard" + secondary subline "Good morning, {name}. ·
   {Weekday, Month D}" and a right-aligned ghost Button "View analytics →".
2. KPI strip — four Stat/KPI cards (mono values): "Active classes", "Students taught"
   (caption "{n} at risk"), "Avg class performance" ({pct}% + "last updated {relative}"),
   "Submissions awaiting review" ("across {m} exams"). Grid: 1→2→4 cols at sm/md/lg.
3. tenantAdmin ONLY: a QuotaWarningBanner shown only when month-to-date AI spend ≥ 80% of
   monthlyBudgetUsd ("AI usage is at {pct}% of this month's budget.").
4. Two-column region (lg:grid-cols-[3fr_2fr], stacks on sm/md):
   LEFT — "Attention needed" Card: a list of rows built from InsightCard rows for
     (a) at-risk students with AtRiskBadge + atRiskReasons (read-only, server-derived),
     (b) "Exams awaiting review" rows, (c) "Results ready to release" rows,
     (d) "Low-performing class" rows; footer link "See all attention items →".
     Empty (good) state: EmptyState "You're all caught up" with a success-toned check.
   RIGHT — stacked column: "Recent" notifications Card (rows: title · relative time ·
     unread dot; footer "View all →") and (tenantAdmin only) an "AI usage" Card with
     Stat "Spent today" / "This month {x} of {budget}" + ProgressBar.
5. "My classes" grid of class-tile Cards (composed from Card + Stat + AtRiskBadge):
   name · {n} students · Avg {pct}% · "{n} at risk" chip; each links to /classes/:id.
   Grid: 1→2→3→4 cols at sm/md/lg/xl.

DATA (read-only; never recompute on client): classes.list (server-scoped to the caller's
classIds with 15-class overflow fallback for teacher, all classes for tenantAdmin);
analytics.getSummary scope='class' per class (ClassProgressSummary: className, studentCount,
autograde.averageClassScore, autograde.examCompletionRate, atRiskStudentIds, atRiskCount,
lastUpdatedAt); exams.list for status counts; notifications repo; analytics.dailyCost
(tenantAdmin only). tenantId is derived server-side from claims — never a field. Stats and
at-risk are server-authoritative.

STATES: render a Skeleton silhouette of the full layout on first load; support PARTIAL
readiness (each card resolves from its own query independently); per-card EmptyState and a
distinct ErrorState with a "Retry" button; the good attention state is the affirming
"You're all caught up". For a plain teacher, OMIT the AI usage card and quota banner
entirely (do not render disabled).

MOTION: staggered FadeIn (ease.entrance, base 220ms) header→KPIs→columns→classes; card
hover e1→e2 over fast 160ms; honor prefers-reduced-motion (no stagger). No celebratory
motion.

A11y: SkipToContent, logical focus order matching visual order, real focusable controls
with the FOUNDATION focus ring, KPIs as labeled groups, status always icon+label (never
color alone), reduced-motion honored, WCAG AA contrast.

Deliver clean React + Tailwind composing @levelup/shared-ui components
(Stat/KPI, Card, InsightCard, AtRiskBadge, EmptyState, ErrorState, Skeleton, ProgressBar,
QuotaWarningBanner, Button, Badge, Toast). Every row/tile is a navigation (deep link),
not an inline mutation — this screen monitors and routes, it does not author or grade.
```
