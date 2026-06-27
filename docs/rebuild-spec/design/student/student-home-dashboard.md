# Student Home Dashboard (B2B) — Design Spec

> Conforms to **Lyceum** (Direction A — "Modern Scholarly"),
> `docs/rebuild-spec/design/00-FOUNDATION.md`. Cite tokens by semantic name; do
> not re-paste scales. Tone: warm, encouraging, motivating — celebrate progress,
> frame gaps as growth.

---

## 1. Purpose & primary user

**Primary user:** a B2B school learner (tenant-scoped, role `student`) who has
just opened the app. **Job-to-be-done:** _"In ten seconds, show me where I stand
across my learning and my exams, make me feel my progress, and point me at the
single next thing worth doing."_ This is the warm front door — the one screen
that must greet the learner by name, surface live momentum (XP, streak, recent
wins), gently flag where support is needed, and route to the next action (resume
a space, prep for an upcoming exam, review a recent result).

It is a _cross-system overview_, not a deep dashboard: it summarizes LevelUp
(spaces/story-points) **and** AutoGrade (exams) **and** gamification in one calm
editorial layout, then hands off to the dedicated pages (`/spaces`, `/progress`,
`/achievements`, exam results) for depth.

---

## 2. Entry points & route

**Route:** `/` (B2B student tree, behind `RequireAuth allow=['student']`,
`onMissingMembership: 'consumerRedirect'`). It is the default landing after
login, the sidebar "Dashboard" item, and the home icon in the mobile Tabbar.
Entered from any logged-in nav.

**Reads (all via `@levelup/api-client` → `shared-hooks/headless`; never
Firestore directly; tenant derived from the active-tenant claim, never the
request body):**

- `v1.analytics.getSummary` `{ scope: 'student' }` → `StudentProgressSummary`
  (`studentProgressSummaries/{studentId}`): `overallScore`,
  `autograde.{averagePercentage, completedExams, totalExams, recentExams[]}`,
  `levelup.{averageCompletion, completedSpaces, totalSpaces, streakDays, totalPointsEarned, totalPointsAvailable}`,
  `strengthAreas[]`, `weaknessAreas[]`, `isAtRisk`, `atRiskReasons[]`.
- `progress.allSpaces` repo read (`v1.levelup.getSpaceProgress` per space,
  batched) → per-space `percentage` for the SpaceCard grid; pairs with
  `v1.levelup.listSpaces` `{ status: 'published', classIds }`.
- `v1.autograde.listExams` `{ status: 'published' }` → upcoming exams (client
  filters `examDate > now`, sorts ascending, top 5). Recent **results** come
  from `summary.autograde.recentExams` (no extra fetch).
- Gamification: `studentLevels/{userId}` (`StudentLevel`:
  level/currentXP/xpToNextLevel/tier) and `studentAchievements` (recent earned
  `StudentAchievement[]`) — surfaced through the analytics summary or dedicated
  read endpoints behind the api-client.
- `RecommendationsSection` / `InsightCard`: server insights (analytics module).
  No client-side heuristic "AI" — honest Insights only (per webapps-design §5.2
  fix).

**Writes:** none. The dashboard is read-only; all actions are navigations.
(Gamification values may change live, but the celebratory burst fires on the
_write event elsewhere_, not on dashboard load — see §8.)

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (Sidebar + Topbar on `lg`; Topbar + bottom
**Tabbar** on mobile). Content column max-width 1200, page gutters 16/24/32
(mobile/tablet/desktop), vertical rhythm `gap` space-6 between regions.
`bg.canvas` page, cards on `bg.surface` with `border.subtle` + `e1`.

```
┌──────────────────────────────────────────────────────────────────────┐
│ GREETING ROW                                                          │
│  Fraunces h2 "Good morning, Aisha 👋"   ·  text.secondary subline     │
│  "You're on a 6-day streak — let's keep it going."                    │
├──────────────────────────────────────────────────────────────────────┤
│ KPI STRIP — 4 × Stat/KPI (ScoreCard)                                  │
│  [Overall] [Avg Exam] [Space Completion] [Streak 🔥]                  │
│  numerics in Spline Sans Mono · CountUp on mount                      │
├───────────────────────────────┬──────────────────────────────────────┤
│ NEXT ACTION (Resume Learning)  │  GAMIFICATION COLUMN                 │
│  full-width card · primary CTA │   LevelBadge + XPMeter               │
│  "Continue: Recursion ▸"       │   StreakFlame (StreakWidget)         │
│                                │   Achievement row (recent, View all) │
├───────────────────────────────┴──────────────────────────────────────┤
│ STRENGTHS / GROWTH  (Chips)    │  AT-RISK / QUICK STATS               │
│  "Strong: Arrays, DP"          │   AtRiskBadge (supportive) +         │
│  "Let's revisit: Graphs"       │   Total Points · Exams done         │
├──────────────────────────────────────────────────────────────────────┤
│ INSIGHTS / RECOMMENDATIONS — InsightCard list (server-derived)        │
├───────────────────────────────┬──────────────────────────────────────┤
│ RECENT EXAM RESULTS (≤3)       │  UPCOMING (≤5 exams, by date)        │
│   row: title · GradePill ▸     │   row: title · date/time ▸          │
│   "View all" → exam results    │                                      │
├──────────────────────────────────────────────────────────────────────┤
│ MY SPACES — SpaceCard grid (≤4) with per-space ProgressRing/Bar       │
│   "View all" → /spaces                                                │
└──────────────────────────────────────────────────────────────────────┘
```

**Responsive (mobile-first):**

- **base → sm (640):** single column. KPI strip becomes a 2-up grid
  (`grid-cols-2`); all paired regions stack; SpaceCards stack 1-up. Tabbar
  visible; Sidebar hidden.
- **md (768):** KPI strip stays 2-up or goes 4-up at the top of this range;
  paired regions (resume/gamification, strengths/at-risk, results/upcoming)
  become 2-col; SpaceCards 2-up.
- **lg (1024)+:** KPI strip 4-up; Sidebar persistent; SpaceCards 2-up within the
  content column. Max content width 1200; comfortable space-6 gutters.

---

## 4. Components used (FOUNDATION §5 only)

- **Navigation:** AppShell, Sidebar, Topbar, Tabbar (mobile), CommandPalette
  (⌘K, web only).
- **Domain:** **SpaceCard** (My Spaces grid, with progress), **XPMeter** +
  **LevelBadge** (level/XP toward next), **StreakFlame** (streak; marigold→red
  gradient flame), **Achievement** (recent earned badges row), **AtRiskBadge**
  (supportive framing), **InsightCard** (server recommendations), **GradePill**
  (recent exam result score band).
- **Data:** Stat/KPI (the four KPI cards), ProgressRing / ProgressBar
  (per-space + level XP), Chip/Tag (strengths / growth areas), Badge, Avatar
  (greeting/topbar), EmptyState, Skeleton, Timeline-free simple rows for
  results/upcoming.
- **Primitives / Containers:** Card, Section, Button (spark variant for the
  primary "Resume" CTA; ghost for "View all" links), IconButton.
- **Feedback:** InlineAlert/Banner (offline/PWA via shell), Toast (sonner) for
  any background errors.

**Proposed FOUNDATION additions:** none strictly required. _Note for promotion:_
the recent-exam-results and upcoming-exam rows are simple
title-plus-trailing-element list rows; they compose from Card + GradePill +
text + IconButton and do not need a new primitive. If a reusable
**`ExamResultRow` / `UpcomingExamRow`** pattern recurs across student + parent
specs, promote it to §5 Data then — flagged, not silently invented here.

---

## 5. States

- **Loading (skeleton):** KPI strip → 4 Skeleton blocks (h ~ stat card);
  gamification column → Skeleton for LevelBadge + StreakFlame; SpaceCard grid →
  2–4 Skeleton cards; results/upcoming → 3 Skeleton rows. `aria-busy`,
  role="status", "Loading your dashboard…". Skeletons use `bg.surface-sunken`
  shimmer, no celebratory motion.
- **Empty (new learner, no summary yet):** graceful fallback. Greeting still
  warm by name. Show a friendly EmptyState in My Spaces ("Your learning spaces
  will appear here once your teacher assigns them") plus a minimal two-stat
  fallback (Active Spaces count, School code) — never a blank screen.
  Gamification widgets hidden until there's data (no "Level 0" sadness).
- **Partial:** sections render independently. If `getSummary` fails but
  `listSpaces` succeeds, show the SpaceCard grid + a quiet InlineAlert at the
  top of the summary region ("We couldn't load your stats just now — your spaces
  are still here. Retry"). Upcoming/Insights absent → their regions simply don't
  render (no empty boxes).
- **Error (whole summary):** ErrorState distinct from empty — "We're having
  trouble loading your dashboard. Let's try again." + Retry button (refetch).
  Toast for transient background refetch failures. Never blame the learner.
- **Success:** full layout as §3, with CountUp on KPIs and subtle entrance.
- **Role/segment gating:** this spec is **B2B student** only. B2C consumers
  never reach `/` (redirected to `/consumer` by the guard) — their dashboard is
  a separate spec. `classIds` from `membership.permissions.managedClassIds`
  scope which published spaces appear.

---

## 6. Interactions & motion

- **Entrance:** regions fade/slide in with a small stagger using `motion.base`
  (220ms) + `ease.entrance`; respect `prefers-reduced-motion` (no translate,
  instant opacity). This is the everyday-subtle register.
- **KPI numerics:** CountUp animation on first mount only (mono figures tick up)
  — felt, not flashy; disabled under reduced-motion (render final value).
- **Cards hover (web):** SpaceCard / result rows lift from `e1` → `e2` on hover
  at `motion.fast` (160ms); press state on mobile (no hover). Trailing chevron
  nudges right on hover.
- **Primary CTA ("Resume Learning"):** Button **spark** variant with the spark
  glow shadow; the single most prominent action. Navigates to `/spaces/:spaceId`
  (the most recent in-progress space).
- **Navigations (no optimistic writes here):** all links are instant client
  routes; hover-prefetch the lazy chunk (web) so the next page is warm.
- **Gamification — celebratory motion is RESERVED:** the
  XPMeter/StreakFlame/Achievement widgets show **subtle live values** on the
  dashboard but **do NOT** fire the CelebrationBurst on load. The spring-pop +
  marigold spark burst is reserved for the _moment of change_ (XP gain, streak
  increment, level-up, achievement unlock, 100% completion) which happens on the
  originating surface (test submit, story-point complete). If the learner
  arrives here immediately after such an event (e.g. routed back
  post-completion), a single CelebrationBurst may play once over the relevant
  widget, then never repeat on subsequent loads. Everywhere else: subtle only.
- **Confirmations:** none needed (read-only screen).

---

## 7. Content & copy (warm, encouraging)

- **Greeting (Fraunces h2):** time-aware + name — "Good morning, {firstName}" /
  "Welcome back, {firstName}". Subline (text.secondary): momentum-first —
  "You're on a {n}-day streak — let's keep it going 🔥" or, if no streak, "Ready
  to pick up where you left off?"
- **KPI labels:** "Overall Score", "Avg Exam Score" (suffix "{n} exams"), "Space
  Completion" (suffix "{done}/{total}"), "Current Streak" (value "{n}d"). Keep
  numbers precise; keep framing kind.
- **Resume CTA:** heading "Pick up where you left off", button "Continue:
  {spaceTitle} →".
- **Strengths / Growth:** headers "You're strong in" and "Let's revisit" (never
  "Weaknesses"). Growth chips use status.warning/needs-review tone, not
  status.error red — encouraging, not punitive.
- **At-risk:** AtRiskBadge framed supportively — "Let's get you some support"
  with reasons phrased as next steps ("A couple of exams are coming up — want to
  review?"), never "You are failing / at risk" in alarming language. When _not_
  at risk: "You're on track 🎯".
- **Recent results header:** "Recent results" + "View all". Result rows: title +
  GradePill (band by score). No raw answer keys (see §8).
- **Upcoming header:** "Coming up" — friendly, e.g. "Algebra Test · Mon, Jun 23
  at 10:00".
- **Insights:** "Suggested for you" (honest server recommendations — not labeled
  "AI" unless genuinely AI-derived).
- **Empty My Spaces:** title "No spaces yet", body "Your learning spaces will
  appear here once your teacher assigns them. In the meantime, explore your
  profile."
- **Error:** "We're having trouble loading your dashboard. Let's try again."
  (Retry). Partial: "We couldn't load your stats just now — your spaces are
  still here."

---

## 8. Domain rules surfaced

- **Answer-key is NEVER shown.** Recent exam results show only the
  score/percentage via GradePill — never the correct answers. Deep review lives
  behind exam-result routes that show server-returned feedback/explanations
  only, post-release. No `answerKeys` data reaches the client (firestore.rules
  denies it). No AnswerKeyLock visual is needed on this overview (no answer
  surfaces here), but the principle gates what the results rows may render.
- **Gamification celebratory-motion budget.** The dashboard may render _live_
  XP/streak/level/achievement values but must NOT scatter CelebrationBurst on
  every load. The spring-pop + marigold burst is the ONE celebratory moment,
  reserved for the _change event_ (XP gain, streak, level-up, achievement
  unlock, 100% completion). At most one burst when arriving directly post-event;
  subtle motion otherwise. Respect `prefers-reduced-motion`.
- **Tenant isolation.** All reads are tenant-scoped (`tenants/{tenantId}/...`)
  with `tenantId` derived from the active-tenant claim server-side. Spaces are
  further filtered by the learner's `classIds`. A learner only ever sees their
  own tenant's data.
- **Honest analytics.** Insights/Recommendations are server-derived
  (`v1.analytics.*`), not client-side `useMemo` heuristics mislabeled "AI"
  (resolves the status-report "AI Analytics is not AI" finding).
- **At-risk = supportive, not punitive.** `isAtRisk` is surfaced as an offer of
  support, framed kindly per Lyceum student tone.
- **Live data, read-only.** No writes; gamification values reflect the latest
  summary but the dashboard never mutates progress.
- **No client-trusted timers here.** No countdowns on this screen; the
  server-authoritative TimerBar lives in the timed-test flow, not the dashboard.

**Fix the dead links (from status report):** "View all" on Achievements → real
**`/achievements`** route (wired). "View all" on Recent Results → real
exam-results destination (`/exams/:examId/results`, or a results index). "Resume
/ View all" on spaces → `/spaces` and `/spaces/:spaceId`. A "View full progress"
affordance → **`/progress`** (now wired). No `/results` 404s.

---

## 9. Accessibility

- **Focus order:** Skip-to-content → greeting → KPI strip (left→right) → Resume
  CTA → gamification → strengths/growth → at-risk/quick-stats → Insights →
  results → upcoming → My Spaces. Logical, top-to-bottom, matching visual order.
- **Keyboard:** every card/row is a real link/button, tab-reachable, Enter/Space
  activates; visible focus ring (`border.focus`, the 3px indigo focus ring). ⌘K
  opens CommandPalette (web).
- **ARIA:** greeting in an `<h1>`/`<h2>` landmark; sections use headings +
  `aria-labelledby`; KPI values have accessible labels ("Overall score: 82
  percent"); achievement row `role="list"`/`listitem`; AtRiskBadge text is read,
  not color-only; loading regions `role="status" aria-busy`.
- **Contrast:** all text/bg pairs meet WCAG AA (4.5:1 body, 3:1 large/UI).
  **Never status-by-color alone** — GradePill, strength/growth chips, and
  AtRiskBadge each pair color with an icon + text label.
- **Reduced motion:** `prefers-reduced-motion` disables CountUp, entrance
  stagger, hover lifts, and any CelebrationBurst — values render instantly.
- **Touch targets ≥44px** on mobile (rows, chips, CTA).

---

## 10. Web↔mobile divergence (FOUNDATION §6)

- **Shell:** web = Sidebar + Topbar; mobile = Topbar + bottom **Tabbar** (Home
  active). RoleSwitcher in Topbar (web) / sheet (mobile) for multi-membership
  learners.
- **CommandPalette (⌘K):** web only; absent on mobile.
- **KPI strip:** 4-up on `lg` → 2-up grid on mobile (never a horizontal table;
  stacked cards).
- **Paired regions:** 2-col on web → stacked single-column on mobile.
- **Interaction:** hover lifts (web) → press states (mobile); hover-prefetch
  (web) → no prefetch on press (mobile).
- **SpaceCard grid:** 2-up (web content column) → 1-up stacked (mobile).
- **Component parity:**
  SpaceCard/XPMeter/StreakFlame/LevelBadge/Achievement/AtRiskBadge/InsightCard/GradePill
  names + props match 1:1 between `shared-ui` (web) and `ui-native` (mobile);
  only the renderer differs. CelebrationBurst uses CSS/Framer on web, Reanimated
  spring on RN — same token timings/eases.

---

## 11. Claude-design prompt (ready to paste)

```
Design the Student Home Dashboard for Auto-LevelUp (route "/", B2B school learner, role student).
STRICTLY conform to the Lyceum design system in docs/rebuild-spec/design/00-FOUNDATION.md
(Direction A — "Modern Scholarly"). Use ONLY its tokens — cite by semantic name
(bg.canvas, bg.surface, text.primary/secondary, brand.primary, spark, border.subtle,
status.success/warning, mastery.*, grade.*, radius.lg, e1/e2, motion.base/fast,
ease.entrance) — never invent colors, fonts, radii, shadows, or component variants.
Fonts: Fraunces (display/greeting/hero numbers), Schibsted Grotesk (UI/body/labels),
Spline Sans Mono (KPI numerics, scores). Tone: warm, encouraging, motivating — greet by
first name, lead with momentum, frame gaps as growth ("Let's revisit", not "Weaknesses").

Render inside AppShell (Sidebar+Topbar on lg; Topbar + bottom Tabbar on mobile). Regions,
top to bottom:
1. Warm greeting (Fraunces h2, time-aware + name) with a momentum subline.
2. KPI strip — 4 Stat/KPI (ScoreCard): Overall Score, Avg Exam Score (+n exams),
   Space Completion (done/total), Current Streak (n d). Mono numerics, CountUp on mount.
3. Resume Learning card with a spark-variant primary CTA "Continue: {space} →" + a
   gamification column: LevelBadge + XPMeter, StreakFlame, a recent-Achievement row ("View all").
4. "You're strong in" / "Let's revisit" chips, beside an AtRiskBadge (SUPPORTIVE framing,
   not alarming) + quick stats (total points, exams done).
5. Insights/Recommendations as InsightCard list (server-derived, not client heuristics).
6. "Recent results" (≤3 rows, GradePill, View all) beside "Coming up" (≤5 upcoming exams).
7. "My Spaces": SpaceCard grid (≤4) each with per-space progress (ProgressRing/Bar). View all.

Responsive: KPI 4-up (lg) → 2-up (mobile); paired regions 2-col → stacked; SpaceCards
2-up → 1-up. States: skeleton loading, warm empty state for new learners, partial
(per-section), distinct error with Retry. Use domain components by their FOUNDATION §5
names: SpaceCard, XPMeter, LevelBadge, StreakFlame, Achievement, AtRiskBadge, InsightCard,
GradePill.

DOMAIN RULES (hard):
- Never show answer keys; recent results show score/GradePill only.
- Gamification shows live values but the CelebrationBurst (spring pop + marigold spark) is
  RESERVED for the moment of XP/streak/level/achievement change — do NOT fire it on dashboard
  load. Everywhere else motion stays subtle (motion.base/fast). Respect prefers-reduced-motion.
- All data is tenant-scoped and read-only here.
- Status never encoded by color alone (icon + label always). WCAG AA contrast.

Deliver a single responsive screen, accessible (focus order, keyboard, aria, reduced-motion),
that feels like a calm, editorial, encouraging front door.
```
