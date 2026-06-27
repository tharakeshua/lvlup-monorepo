# Progress & Analytics (Cross-system) — Design Spec

> Conforms to **Lyceum** (Direction A — "Modern Scholarly"),
> `docs/rebuild-spec/design/00-FOUNDATION.md`. Cite tokens by semantic name; do
> not re-paste scales. Tone: **encouraging coach** — celebrate the trajectory,
> never shame a low number, and always offer the next step. Every metric is
> honest and server-aggregated; nothing here is fabricated or mislabeled "AI".

---

## 1. Purpose & primary user

**Primary user:** a B2B school learner (tenant-scoped, role `student`).
**Job-to-be-done:** _"Show me the honest, full picture of how I'm doing — across
my spaces AND my exams — make me feel my trajectory over time, tell me what I'm
strong at and what to revisit, and give me the next move."_

This is the learner's **one place for depth** — the dedicated counterpart to the
calm `student-home-dashboard` front door. Where the dashboard summarizes in ten
seconds and hands off, `/progress` is where the learner _sits with their
growth_: subject-by-subject mastery, accuracy & completion trends over time,
exam history, strengths/growth areas, and a supportively-framed at-risk signal
with concrete reasons-as-next-steps. It is the screen a learner opens before a
parent-teacher meeting, after a tough test, or when they want to decide what to
study next.

It is read-only and aggregative. It never asks the learner to do anything
stressful; it reflects, encourages, and points forward.

---

## 2. Entry points & route

**Route:** `/progress` — **WIRE UP** (currently an unrouted dead page,
`apps/student-web/src/pages/ProgressPage.tsx`; status-report finding #14). Lives
in the B2B student tree behind `RequireAuth allow=['student']`,
`onMissingMembership: 'consumerRedirect'`.

**Entry points:**

- Sidebar (web) / Tabbar or "More" sheet (mobile) "Progress" nav item.
- "View full progress" affordance on `student-home-dashboard` (§8 of that spec
  wires this destination).
- Deep link from an **AtRiskBadge** anywhere (dashboard) → lands here with the
  at-risk region in view.
- CommandPalette (⌘K, web) "Progress".

**Reads (all via `@levelup/api-client` → `shared-hooks/headless`; never
Firestore directly; `tenantId` derived from the active-tenant claim server-side,
never the request body):**

- `v1.analytics.getSummary` `{ scope: 'student' }` → `StudentProgressSummary`
  (`studentProgressSummaries/{studentId}`). This is the spine of the page:
  - `overallScore` (0–1 weighted), `strengthAreas[]`, `weaknessAreas[]`,
    `isAtRisk`, `atRiskReasons[]`, `lastUpdatedAt`.
  - `autograde.{ totalExams, completedExams, averageScore, averagePercentage, totalMarksObtained, totalMarksAvailable, subjectBreakdown{ [subject]: { avgScore, examCount } }, recentExams[]{ examId, examTitle, score, percentage, date } }`.
  - `levelup.{ totalSpaces, completedSpaces, averageCompletion, totalPointsEarned, totalPointsAvailable, averageAccuracy, streakDays, subjectBreakdown{ [subject]: { avgCompletion, spaceCount } }, recentActivity[]{ spaceId, spaceTitle, action, date } }`.
- `v1.levelup.getSpaceProgress` `{ scope: 'all' }` (the `progress.allSpaces`
  repo read) → per-space `SpaceProgress` (`percentage`,
  `pointsEarned`/`totalPoints`, `status`, `storyPoints{}` for sections done) for
  the per-space breakdown grid; paired with `v1.levelup.listSpaces`
  `{ status: 'published', classIds }` for titles/ordering.
- **Trends over time:** `v1.analytics.getPerformanceTrends`
  `{ scope: 'student' }` (the same server-aggregated trend series parent-web
  consumes per `common-api §3.3`) → time-bucketed `accuracy` and `completion`
  series for the line/area charts. If a learner-scoped trend endpoint is not yet
  provisioned, the Timeline falls back to the timestamped `recentExams[]` +
  `recentActivity[]` points already on the summary (honest, sparser) — see §5
  Partial.

**Writes:** none. `/progress` is strictly read-only — every interaction is a
navigation, a tab switch, or a local range/sort toggle. No progress is ever
mutated here.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (Sidebar + Topbar on `lg`; Topbar + bottom
**Tabbar** on mobile). Content column max-width 1200 (charts breathe to full
width), page gutters 16/24/32 (mobile/tablet/desktop), vertical rhythm `gap`
space-6 between regions. `bg.canvas` page; cards on `bg.surface` with
`border.subtle` + `e1`. Charts sit on `bg.surface` with `bg.surface-sunken` plot
backgrounds.

A **Tabs** rail (Overall · Exams · Spaces) organizes depth without overwhelming
— Overall is the coach's summary; Exams and Spaces are the receipts.

```
┌──────────────────────────────────────────────────────────────────────┐
│ HEADER                                                                │
│  Fraunces h1 "Your progress"  ·  text.secondary "Last updated {ago}"  │
│  encouraging subline: "You've grown a lot this month — here's the     │
│  full picture." 🎯                                                    │
├──────────────────────────────────────────────────────────────────────┤
│ TABS:  [ Overall ]   [ Exams ]   [ Spaces ]                           │
├──────────────────────────────────────────────────────────────────────┤
│ ░░ TAB: OVERALL ░░                                                    │
│                                                                       │
│ HERO ROW                                                              │
│  ┌───────────────┐  ┌──────────────────────────────────────────────┐ │
│  │ ProgressRing   │  │ 3 × StatCard/ScoreCard                       │ │
│  │ Overall Score  │  │ [Avg Exam %] [Space Completion] [Accuracy]   │ │
│  │ big mono %     │  │ + [Streak 🔥] [Points earned/avail]          │ │
│  └───────────────┘  └──────────────────────────────────────────────┘ │
│                                                                       │
│ TRENDS                                                                │
│  ┌─────────────────────────┐ ┌─────────────────────────┐             │
│  │ Accuracy over time       │ │ Completion over time     │            │
│  │  SimpleBarChart / line   │ │  SimpleBarChart / area   │            │
│  │  [range: 4w · 12w · all] │ │  [range toggle]          │            │
│  └─────────────────────────┘ └─────────────────────────┘             │
│                                                                       │
│ MASTERY BY SUBJECT  (ClassHeatmap-style subject grid)                 │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ subject   exam avg   space completion   mastery cell          │    │
│  │ Algebra   ▓▓▓▓ 82%    ▓▓▓ 64%            ● mastered            │    │
│  │ Calculus  ▓▓ 48%      ▓▓▓▓ 71%           ◐ in progress         │    │
│  │ ...                                                            │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                       │
│ STRENGTHS / GROWTH            │  YOUR NEXT STEP                       │
│  "You're strong in" (Chips)   │   AtRiskBadge (supportive) + reasons  │
│  "Let's revisit" (Chips)      │   as next-step InsightCards w/ CTAs   │
│                                                                       │
│ INSIGHTS — InsightCard list (server-derived, honest)                  │
├──────────────────────────────────────────────────────────────────────┤
│ ░░ TAB: EXAMS ░░                                                      │
│  KPI strip: [Exams done] [Avg %] [Marks obtained/available]           │
│  Exam-performance-by-subject grid (ProgressRing per subject)          │
│  Recent exams — DataTable (web) / SubmissionCard stack (mobile):      │
│   Exam · Date · Score · GradePill ▸ (→ /exams/:examId/results)        │
├──────────────────────────────────────────────────────────────────────┤
│ ░░ TAB: SPACES ░░                                                     │
│  KPI strip: [Spaces done/total] [Avg completion] [Points]             │
│  Space-completion-by-subject grid                                     │
│  Per-space cards: title · status pill · ProgressBar · pts · sections ▸│
│   (→ /spaces/:spaceId)                                                 │
└──────────────────────────────────────────────────────────────────────┘
```

**Responsive (mobile-first):**

- **base → sm (640):** single column. Hero: ProgressRing on top, StatCards in a
  2-up grid below. Trend charts stack 1-up (full width, reduced height). Mastery
  subject grid → **stacked cards** (one card per subject, each row a labeled
  mini-bar + mastery dot — never a horizontal scrolling table). Exams/Spaces
  tables → stacked **SubmissionCard**/space cards. Tabs become a scrollable
  segmented control. Tabbar visible; Sidebar hidden.
- **md (768):** Hero ring + StatCards side-by-side (ring left, 2×2 stat grid
  right). Trend charts 2-col. Mastery grid renders as a real compact grid
  (subject rows, columns: exam avg · completion · mastery). Tables show core
  columns.
- **lg (1024)+:** Sidebar persistent. Full layout as drawn; charts and the
  mastery grid get their full width inside the 1200 column; paired regions
  (strengths/next-step) 2-col; full DataTable columns on the Exams tab.

---

## 4. Components used (FOUNDATION §5 only)

- **Navigation:** AppShell, Sidebar, Topbar, Tabbar (mobile), CommandPalette
  (⌘K, web only).
- **Containers:** Card, Panel, Section, **Tabs** (Overall/Exams/Spaces).
- **Data:** **Stat/KPI** (the StatCard/ScoreCard KPIs), **ProgressRing**
  (overall score + per-subject exam avg), **ProgressBar** (per-space
  completion), **Timeline** (the trend region's chronological points / activity
  log fallback), **DataTable** (recent exams on web; sort by date/score),
  **Chip/Tag** (strengths / growth subjects), **Badge**, **EmptyState**,
  **Skeleton**.
- **Domain:** **AtRiskBadge** (supportive framing + reasons), **InsightCard**
  (server recommendations + next-step CTAs), **GradePill** (per-exam score
  band), **SubmissionCard** (mobile recent-exam rows, and the deep-link from a
  row), **StreakFlame** (streak-days stat). **SpaceCard** is _not_ re-used
  wholesale here — the Spaces tab uses a lighter progress row variant to avoid
  duplicating the `/spaces` grid; it composes ProgressBar + status Badge +
  points/sections text.
- **Charts:** **SimpleBarChart** (accuracy-over-time, completion-over-time, and
  the per-subject bars in the mastery grid). The trend charts may render as bar
  or simple line/area per the `shared-ui/charts` `SimpleBarChart` capability.
- **Primitives:** Button (ghost "View all" / "Open"; secondary range toggles),
  IconButton, Select/SegmentedControl (trend range: 4w · 12w · all).
- **Feedback:** InlineAlert/Banner (partial-load notice), Toast (sonner) for
  transient refetch errors, LoadingOverlay only if a tab re-fetch blocks.

**Proposed FOUNDATION additions:**

- **`ClassHeatmap` is a teacher/class-grid component; this screen needs a
  single-student, subject-by-subject mastery grid.** I am composing it from
  existing primitives (Card + SimpleBarChart cells + a mastery dot using
  `mastery.notStarted/inProgress/mastered` + text label) and calling it a
  **"subject mastery grid"** pattern — _not_ inventing a new token or color. If
  this single-learner subject grid recurs across student + parent specs,
  **promote a `MasteryGrid` (single-subject-row variant of ClassHeatmap) into
  FOUNDATION §5 Data/Charts** rather than letting each spec re-compose it.
  Flagged here, not silently invented.
- **Trend range toggle (4w/12w/all):** composed from the existing Select /
  segmented Button group — no new component. If a reusable
  **`ChartRangeToggle`** recurs (it likely will on parent-web
  `getPerformanceTrends`), promote it then.

---

## 5. States

- **Loading (skeleton):** Header text renders immediately (static). Below it:
  ProgressRing → a circular Skeleton; StatCards → 3–5 Skeleton blocks; each
  trend chart → a Skeleton plot rectangle; mastery grid → 4–6 Skeleton rows;
  tables → 5 Skeleton rows. `role="status" aria-busy`, "Loading your progress…".
  Shimmer on `bg.surface-sunken`; **no celebratory motion**.
- **Empty (new learner, no summary yet):** the encouraging-coach moment, not a
  void. Warm EmptyState (Fraunces title): **"Your progress story starts here."**
  Body: "As you complete spaces and take exams, this page fills with your
  trends, strengths, and milestones. Let's get the first one on the board."
  Primary ghost CTA → `/spaces` ("Explore your spaces"). Never show "Level 0 /
  0% / no data" as bare zeros — suppress empty charts and grids entirely and
  show the single warm card.
- **Partial:** regions render independently and degrade honestly.
  - `getSummary` succeeds but `getPerformanceTrends` is unavailable → trend
    charts fall back to the timestamped `recentExams[]` + `recentActivity[]`
    points on the summary, rendered via **Timeline**, with a quiet caption
    "Showing recent activity — full trends arrive as you complete more." (No
    fabricated interpolation between points — honest sparseness.)
  - `getSpaceProgress` fails but `getSummary` succeeds → Overall + Exams tabs
    fully render; Spaces tab shows an InlineAlert + Retry, not a blank.
  - Any subject with `examCount: 0` / `spaceCount: 0` simply doesn't appear in
    its grid (no "—%" noise).
- **Error (whole summary):** ErrorState distinct from empty — Fraunces "We
  couldn't load your progress just now." + "Let's try again." + Retry (refetch).
  Toast for transient background refetch failures. **Never blame the learner**;
  never imply their data is gone.
- **Success:** full layout (§3) with subtle entrance + chart draw-in.
- **Role/segment gating:** **B2B student only.** B2C consumers don't reach
  `/progress` (guard redirects to `/consumer`; their cross-system view, if any,
  is a separate consumer spec). `classIds` from
  `membership.permissions.managedClassIds` scope which published spaces appear
  in the Spaces tab and the LevelUp subject breakdown. A learner only ever sees
  **their own** aggregated numbers — never a peer's (this is not the
  leaderboard).

---

## 6. Interactions & motion

- **Entrance:** regions fade/slide in with a small stagger using `motion.base`
  (220ms) + `ease.entrance`; charts draw their bars/line in left-to-right over
  `motion.slow` (320ms). This is the everyday-subtle register, not celebratory.
  Respect `prefers-reduced-motion` (no translate/draw — render final state
  instantly).
- **Overall-score ring & numerics:** the ProgressRing sweeps to its value on
  first mount; KPI mono numerics CountUp on mount only. Felt, not flashy;
  disabled under reduced-motion.
- **Tabs (Overall/Exams/Spaces):** instant client switch; underline/active
  indicator slides at `motion.fast` (160ms); each tab's content is its own React
  Query slice so switching never refetches the spine. Active tab persisted in
  the URL (`?tab=exams`) for shareable deep links.
- **Trend range toggle (4w/12w/all):** local state; chart re-animates the new
  series over `motion.fast`. If the range requires a fresh server window, show
  an inline chart Skeleton (not a full-page block).
- **Mastery grid / table sort:** hover (web) lifts a subject row `e1→e2` at
  `motion.fast`; clicking a subject row scrolls/links to that subject's
  contributing spaces (Spaces tab filtered). DataTable sort by date/score is
  local, instant.
- **Row navigation:** each recent-exam row → `/exams/:examId/results`; each
  space row → `/spaces/:spaceId`. Real links, hover-prefetch the lazy chunk
  (web). Trailing chevron nudges right on hover.
- **No optimistic updates / confirmations:** read-only screen; nothing to
  confirm.
- **Celebratory motion is RESERVED and essentially absent here.** `/progress` is
  a _reflective_ surface — the spring-pop + marigold **CelebrationBurst** is the
  ONE celebratory moment and belongs to the _change event_ (XP gain, streak
  increment, level-up, achievement unlock, 100% completion) on its originating
  surface (test submit, story-point complete). It does **not** fire on
  `/progress` load. The single allowed exception, matching the dashboard rule:
  if the learner is routed here _immediately_ after crossing a milestone (e.g.
  hitting 100% space completion that just updated the summary), a single
  CelebrationBurst may play once over the relevant stat, then never repeat.
  Everywhere else on this page: subtle only.

---

## 7. Content & copy (encouraging coach)

- **Header (Fraunces h1):** "Your progress". Sub: "Last updated {relativeTime}"
  (text.muted). Encouraging subline (text.secondary), trajectory-first: "You've
  grown a lot this month — here's the full picture. 🎯" / if flat-but-active:
  "Steady work this month. Here's where you stand." / if just starting: "Early
  days — every step counts."
- **Overall score:** label "Overall score", value big mono "{n}%". Caption
  frames it kindly: "across your spaces and exams". **Never** "only 48%" — just
  the number, neutrally, with the trend doing the encouraging.
- **KPI labels:** "Avg exam score" (suffix "{completedExams}/{totalExams}
  exams"), "Space completion" ("{completedSpaces}/{totalSpaces} spaces"),
  "Accuracy" ("{n}%"), "Current streak" ("{n}d 🔥"), "Points earned" ("{earned}
  / {available}"). Numbers precise; framing warm.
- **Trends:** "Accuracy over time" and "Completion over time". When trending up:
  small caption "Up {n} pts vs last month — nice. ↗". When down: never red-alarm
  — "A dip here, totally normal — let's bring it back up." When flat: "Holding
  steady."
- **Mastery by subject (header):** "Where you stand by subject". Mastery dots
  labeled with text + icon: **● Mastered** (`mastery.mastered`), **◐ Getting
  there** (`mastery.inProgress`), **○ Not started yet** (`mastery.notStarted`) —
  note "Getting there" not "incomplete", "Not started yet" not "behind".
- **Strengths / Growth:** headers "You're strong in" and "Let's revisit" —
  **never** "Weaknesses". Growth chips use the `status.warning`/needs-review
  tone (amber), **never** `status.error` red. Each "Let's revisit" chip is
  tappable → relevant space/practice.
- **Your next step (at-risk region):** AtRiskBadge headed "Let's get you some
  support 🌱" (supportive, never "AT RISK / FAILING"). Reasons rendered as
  **next-step InsightCards**, each phrased as an action with a CTA: e.g. reason
  "low recent exam accuracy" → card "Calculus has been tricky lately — a 15-min
  practice set could help. [Practice now →]"; reason "inactive 7 days" → "It's
  been a week — a quick win is the best way back. [Pick up a space →]". When
  **not** at risk: a calm green-tone card "You're on track 🎯 — keep doing what
  you're doing."
- **Insights header:** "Suggested for you" — honest server recommendations; only
  labeled "AI" if genuinely AI-derived (resolves the "AI Analytics is not AI"
  status finding).
- **Exams tab:** "Your exams", table headers "Exam · Date · Score". GradePill
  bands the score; row CTA "Review →". Empty: "No exam results yet — they'll
  show here once your teacher releases them."
- **Spaces tab:** "Your spaces", per-space "{pointsEarned}/{totalPoints} pts ·
  {completed}/{total} sections", status pill ("Not started" / "In progress" /
  "Completed"). Empty: "Your learning spaces will appear here once they're
  assigned."
- **Empty (whole page):** title "Your progress story starts here.", body as §5.
  **Error:** "We couldn't load your progress just now. Let's try again."
  (Retry). **Partial trend:** "Showing recent activity — full trends arrive as
  you complete more."

---

## 8. Domain rules surfaced

- **Honest, server-aggregated metrics — no fabricated numbers.** Every figure
  comes from `v1.analytics.getSummary` / `getPerformanceTrends` /
  `getSpaceProgress` (server-computed `StudentProgressSummary` + trend series).
  **No client-side `useMemo` "AI" heuristics** and no interpolation to make
  sparse data look fuller — this directly resolves the status-report "AI
  Analytics is not AI" finding (#16). Where data is thin, the page shows it
  honestly (Timeline of real points) rather than inventing a curve. "Suggested
  for you" insights are server-derived; only called "AI" when truly AI.
- **At-risk = supportive, never punitive.** `isAtRisk` + `atRiskReasons[]`
  surface through **AtRiskBadge** framed as an _offer of support_ with reasons
  turned into next-step CTAs (§7). Coach tone is mandatory: celebrate the
  trajectory, never shame a low number, always give the next move.
- **Answer-key is NEVER shown.** The Exams tab and recent-exam rows show only
  the score/percentage via **GradePill** — never correct answers. Deep review
  links to `/exams/:examId/results`, which renders only server-returned
  feedback/explanations **post-release**; the server-only `answerKeys`
  subcollection is denied to all clients by `firestore.rules` and never reaches
  this page. No raw key surfaces here, so no **AnswerKeyLock** visual is
  required on `/progress` — but the principle gates what any drill-down row may
  render.
- **Tenant isolation.** All reads are tenant-scoped (`tenants/{tenantId}/...`)
  with `tenantId` derived from the active-tenant claim server-side, never the
  request body. Spaces are further filtered by the learner's `classIds`. A
  learner sees **only their own** aggregated data — this is explicitly _not_ a
  comparison/leaderboard surface (peer comparison lives on `/leaderboard`).
- **Gamification celebratory-motion budget.** `/progress` is reflective: it
  renders live streak/points/level values but does **not** scatter
  CelebrationBurst on load. The one celebratory spring-pop + marigold burst is
  reserved for the change event on its originating surface; at most one burst
  when arriving directly post-milestone, then never again. Subtle motion
  otherwise. Respect `prefers-reduced-motion`.
- **Read-only, live data.** No writes; values reflect the latest server summary
  (`lastUpdatedAt` shown). The page never mutates progress.
- **No client-trusted timers.** No countdowns here; the server-authoritative
  TimerBar belongs to the timed-test flow, not analytics.

**Fix the dead route (status report #14):** `/progress` is now a **real, wired
route** (was unrouted). The dashboard's "View full progress" affordance resolves
here; the AtRiskBadge deep-link resolves here. No `/results` or `/achievements`
404s originate from this page — its row links target the real
`/exams/:examId/results` and `/spaces/:spaceId` routes.

---

## 9. Accessibility

- **Focus order:** Skip-to-content → header → Tabs (roving tabindex across
  Overall/Exams/Spaces) → active tab panel top-to-bottom: overall ring → KPI
  cards → trend charts (each with its range toggle) → mastery grid rows →
  strengths/growth chips → next-step/at-risk cards → insights → (Exams/Spaces
  tabs: KPI → subject grid → table/cards). Logical, matches visual order.
- **Keyboard:** Tabs follow the WAI-ARIA tabs pattern (Arrow keys move tabs,
  Enter/Space select, `Home`/`End` to ends). Range toggle is a real segmented
  control / select. Every table row and space/exam row is a real link/button —
  Tab-reachable, Enter/Space activates; visible 3px indigo focus ring
  (`border.focus`). DataTable sort headers keyboard-operable. ⌘K opens
  CommandPalette (web).
- **ARIA:** header `<h1>`; each region a `<section>` with `aria-labelledby`.
  Tabs use `role="tablist"/"tab"/"tabpanel"` with
  `aria-selected`/`aria-controls`. **Charts have a text alternative:** each
  SimpleBarChart carries an `aria-label` summary ("Accuracy over the last 12
  weeks, trending up from 61 to 74 percent") and an off-screen data table for
  screen readers (the underlying series). ProgressRing exposes `role="img"` +
  `aria-label` ("Overall score: 74 percent"). Mastery dots are read as text+icon
  ("Algebra: mastered"), never color-only. Loading regions
  `role="status" aria-busy`.
- **Contrast:** all text/bg pairs meet WCAG AA (4.5:1 body, 3:1 large/UI).
  **Never status-by-color alone** — GradePill, mastery dots, strength/growth
  chips, trend up/down captions, and AtRiskBadge each pair color with an icon
  **and** a text label. Chart series are distinguishable by label/value, not hue
  alone.
- **Reduced motion:** `prefers-reduced-motion` disables CountUp, ring sweep,
  chart draw-in, entrance stagger, hover lifts, and the (already-rare)
  CelebrationBurst — everything renders at its final state instantly.
- **Touch targets ≥44px** on mobile (tabs, range toggle, chips, rows).

---

## 10. Web↔mobile divergence (FOUNDATION §6)

- **Shell:** web = Sidebar + Topbar; mobile = Topbar + bottom **Tabbar**
  ("Progress" active) + a "More" sheet if Progress lives there. RoleSwitcher in
  Topbar (web) / sheet (mobile) for multi-membership learners.
- **CommandPalette (⌘K):** web only; absent on mobile.
- **Page tabs (Overall/Exams/Spaces):** standard Tabs on web → a scrollable
  **segmented control** on mobile (thumb-reachable).
- **Mastery subject grid:** a true grid/table on `md+` → **stacked per-subject
  cards** on mobile (each subject one card: labeled mini-bars + mastery dot). No
  horizontal scrolling tables on mobile.
- **Recent exams:** **DataTable** (sortable columns) on web → stacked
  **SubmissionCard**s on mobile (title, date, GradePill, "Review →").
- **Trend charts:** 2-col side-by-side on `md+` → stacked full-width,
  shorter-height charts on mobile; range toggle becomes a compact segmented
  control.
- **Interaction:** hover lifts + hover-prefetch (web) → press states, no
  prefetch (mobile).
- **Component parity:** AtRiskBadge / InsightCard / GradePill / SubmissionCard /
  StreakFlame / ProgressRing / SimpleBarChart / Stat names + props match 1:1
  between `shared-ui` (web) and `ui-native` (mobile); only the renderer differs
  (recharts/Framer on web; RN chart lib + Reanimated on RN — same token
  timings/eases). CelebrationBurst (if it fires once post-milestone) uses
  CSS/Framer on web, Reanimated spring on RN.

---

## 11. Claude-design prompt (ready to paste)

```
Design the cross-system "Progress & Analytics" screen for Auto-LevelUp
(route "/progress", B2B school learner, role student). STRICTLY conform to the Lyceum
design system in docs/rebuild-spec/design/00-FOUNDATION.md (Direction A — "Modern
Scholarly"). Use ONLY its tokens — cite by semantic name (bg.canvas, bg.surface,
bg.surface-sunken, text.primary/secondary/muted, brand.primary, spark, border.subtle,
status.success/warning, mastery.notStarted/inProgress/mastered, grade.*, confidence.*,
radius.lg, e1/e2, motion.base/fast/slow, ease.entrance) — never invent colors, fonts,
radii, shadows, or component variants. Fonts: Fraunces (h1/hero numbers/empty-state titles),
Schibsted Grotesk (UI/body/labels), Spline Sans Mono (all numerics — scores, %, points,
streak). Tone: ENCOURAGING COACH — celebrate the trajectory, never shame a low number,
always offer the next step. Every number is honest and server-aggregated; never fabricate
or interpolate data, never mislabel client heuristics as "AI".

Render inside AppShell (Sidebar+Topbar on lg; Topbar + bottom Tabbar on mobile).
Header: Fraunces h1 "Your progress" + "Last updated {ago}" + an encouraging,
trajectory-first subline. Below it a Tabs rail: Overall · Exams · Spaces (active tab in URL).

OVERALL tab:
1. Hero: a large ProgressRing "Overall score {n}%" beside a 2x2/3-up of StatCards
   (Avg exam %, Space completion done/total, Accuracy, Streak 🔥, Points earned/available).
   Ring sweeps + numerics CountUp on mount.
2. Trends: two charts (SimpleBarChart, bar or line/area) — "Accuracy over time" and
   "Completion over time" — each with a 4w/12w/all range toggle. Draw in left-to-right
   (motion.slow). Up-trend caption warm ("Up 9 pts — nice ↗"); down-trend kind, never red-alarm.
3. "Where you stand by subject": a single-student subject mastery grid (compose from Card +
   SimpleBarChart cells + a mastery dot using mastery.notStarted/inProgress/mastered with a
   TEXT+ICON label — "Mastered / Getting there / Not started yet"). On mobile this becomes
   stacked per-subject cards, never a horizontal table.
4. "You're strong in" / "Let's revisit" chips (growth chips use status.warning amber, NEVER
   error red), beside a "Your next step" region: an AtRiskBadge framed SUPPORTIVELY
   ("Let's get you some support 🌱") with each reason rendered as a next-step InsightCard
   with a CTA. When not at risk: a calm "You're on track 🎯" card.
5. "Suggested for you": InsightCard list (server-derived, honest — not client heuristics).

EXAMS tab: KPI strip (exams done, avg %, marks obtained/available), exam-by-subject
ProgressRing grid, and recent exams as a sortable DataTable on web / stacked SubmissionCards
on mobile (Exam · Date · Score with GradePill, "Review →" → /exams/:examId/results).

SPACES tab: KPI strip (spaces done/total, avg completion, points), space-by-subject grid,
and per-space progress rows (title · status pill · ProgressBar · pts · sections → /spaces/:spaceId).

Responsive: charts 2-col (lg) → stacked (mobile); mastery grid → stacked cards (mobile);
tables → cards (mobile); Tabs → segmented control (mobile). States: skeleton loading, a WARM
empty state for new learners ("Your progress story starts here."), partial (trends fall back to
a real Timeline of recent points with an honest caption), distinct error with Retry. Use domain
components by their FOUNDATION §5 names: AtRiskBadge, InsightCard, GradePill, SubmissionCard,
StreakFlame, ProgressRing, SimpleBarChart, Timeline.

DOMAIN RULES (hard):
- Honest, server-aggregated metrics ONLY — no fabricated numbers, no interpolation, no fake "AI".
- At-risk is SUPPORTIVE, never punitive — offer support, frame reasons as next steps.
- Never show answer keys; exam rows show score/GradePill only and link to post-release
  feedback at /exams/:examId/results.
- All data is tenant-scoped (claim-derived) and the learner's own — this is NOT a leaderboard.
- This reflective page does NOT fire the celebratory CelebrationBurst on load (it's reserved
  for the moment of change elsewhere); motion stays subtle (motion.base/fast/slow).
- Status NEVER encoded by color alone (icon + label always). Charts carry aria text alternatives.
  WCAG AA contrast. Respect prefers-reduced-motion.

Deliver a single responsive, accessible screen that feels like a calm, editorial, encouraging
coach showing the learner their full, honest growth — and the next step.
```
