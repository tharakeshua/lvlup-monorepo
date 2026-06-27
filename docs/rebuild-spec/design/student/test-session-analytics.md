# Screen Spec — Test Session Analytics (Deep Dive)

> Conforms to **Lyceum** (`docs/rebuild-spec/design/00-FOUNDATION.md`, Direction
> A — Modern Scholarly). Cite tokens by semantic name; do not re-paste values.
> Student tone: **coaching** — "here's where you're improving, here's your next
> focus." Mostly data-dense; subtle motion only (this is **not** a gamification
> celebration surface).

---

## 1. Purpose & primary user

**Primary user:** A learner (B2B `student` or B2C consumer) who has finished
**one or more attempts** of a timed test on a story point and wants to
understand _how they are progressing across attempts_ and _what to study next_.

**Job-to-be-done:** "I've taken this test a few times — show me honestly where
I'm getting better, where I'm still weak, how my pacing is changing, and tell me
concretely what to work on before my next attempt." This is the reflective
companion to the per-attempt `ResultSummary` shown immediately after submitting
a test — it spans **all** completed attempts, not a single result.

This screen is a coach, not a scoreboard. Every number is real (computed from
actual `testSessions` analytics), framed as growth, never punitive.

---

## 2. Entry points & route

**Route:** `/spaces/:spaceId/test/:storyPointId/analytics` (B2B). B2C consumer
reaches the same screen via the `LearnerContext`-resolved consumer route; the
component is identical, only the data source differs (tenant vs
`platform_public`).

**Entry points:**

- "View analytics / Track progress" link from the timed-test landing view
  (`TimedTestPage` landing state) once ≥1 attempt is completed.
- "See your progress over time" CTA on the post-submission `ResultSummary`.
- The story-point node in `StoryPointTrack` (a secondary "Analytics" affordance
  once the test has been attempted).
- Deep link / breadcrumb from the space viewer.

**Reads/writes (all via `@levelup/api-client`; never Firebase directly):**

- `v1.levelup.testSessions.list` (repo:
  `TestSessionRepo.list({ spaceId, storyPointId })`) — all sessions for this
  learner+story point; the screen filters to `status === 'completed'` and sorts
  by `attemptNumber`. Each session carries `analytics` (topicBreakdown,
  difficultyBreakdown, averageTimePerQuestion, Bloom's breakdown), `percentage`,
  `answeredQuestions`, timestamps.
- `v1.levelup.testSessions.get` (`TestSessionRepo.get(sessionId)`) — lazy detail
  fetch when a specific attempt is selected in the comparison control (if the
  list projection is trimmed).
- `v1.levelup.getStoryPointProgress`
  (`ProgressRepo.getStoryPoint({ spaceId, storyPointId })`) — mastery state +
  `assessmentConfig.passingPercentage` for the pass line and the mastery delta
  framing.
- `v1.levelup.getSpace` / `v1.levelup.listStoryPoints` (`SpacesRepo.get`,
  `StoryPointsRepo.list`) — titles for breadcrumb + header.
- `v1.analytics.getSummary` (`scope: 'student'`) (`AnalyticsRepo.getSummary`) —
  **server-authoritative** cross-attempt insight payload that powers the
  `InsightCard` recommendations and the "next focus" study plan. This replaces
  the legacy client-side `useMemo` heuristic strings (status report pain point:
  "AI Analytics is not AI"). The client may still derive simple per-attempt
  deltas locally, but recommendations come from the server.

No writes — this screen is read-only.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (Sidebar + Topbar on web; bottom **Tabbar** on
mobile). Content column is data-dense: max content width per FOUNDATION §4
(reading-ish, ~960 for charts; not the 720 prose measure). Page gutters per
breakpoint (mobile 16 / tablet 24 / desktop 32).

```
┌─ AppShell ───────────────────────────────────────────────────────────────┐
│ Topbar: tenant · search(⌘K) · notifications · profile                     │
│ Breadcrumb: Spaces › {Space title} › {Story point} › Progress             │
│                                                                            │
│ ┌─ Header band ────────────────────────────────────────────────────────┐ │
│ │ [trend icon] {Story point} — Your Progress                            │ │
│ │ "{N} attempts · last attempt {relative date}"                         │ │
│ │ MasteryDelta chip: mastery.inProgress → mastery.mastered (if crossed) │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ┌─ KPI strip (StatCard ×4) ────────────────────────────────────────────┐ │
│ │ [ScoreCard Best]  [StatCard Latest]  [StatCard Attempts]  [StatCard   │ │
│ │  %]              %  + trend arrow    count + trend         Avg time/Q] │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ┌─ Score progression (SimpleBarChart / Timeline-x-axis) ───────────────┐ │
│ │ bars per attempt #1..#N, marigold pass-line marker, best bar in       │ │
│ │ mastery.mastered green; "Passing: {x}%" caption                       │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ┌─ Pace trend (SimpleBarChart) ───────┐ ┌─ Difficulty mastery deltas ──┐ │
│ │ avg time/Q per attempt; "faster is  │ │ DifficultyProgressionChart:  │ │
│ │ not always better" coaching caption │ │ easy/med/hard accuracy first │ │
│ │                                     │ │ → latest attempt, with delta │ │
│ └─────────────────────────────────────┘ └──────────────────────────────┘ │
│                                                                            │
│ ┌─ Topic mastery (per-topic accuracy bars, aggregated across attempts) ─┐ │
│ │ topic row: label · ProgressBar(accuracy) · delta vs first attempt     │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ┌─ AttemptComparison ──────────────────────────────────────────────────┐ │
│ │ [Select attempt A] → [Select attempt B]                               │ │
│ │ score Δ · answered Δ · avg-time Δ (each with up/down/flat delta icon) │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ┌─ Your next focus (StudyRecommendations → InsightCard list) ──────────┐ │
│ │ InsightCard × up-to-5, priority-ordered from v1.analytics.getSummary  │ │
│ │ [Practice this] / [Review story point] CTAs                           │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ Footer CTA: [Take this test again]  (secondary)                            │
└────────────────────────────────────────────────────────────────────────────┘
```

**Responsive behavior:**

- **lg ≥ 1024:** KPI strip is a 4-up grid; "Pace trend" and "Difficulty mastery
  deltas" sit side-by-side (2-col); charts at full chart width.
- **md 768–1023:** KPI strip 4-up (tighter); the two mid charts stack into
  1-col; topic mastery full-width.
- **sm < 640:** Everything single-column. KPI strip becomes 2×2. Charts keep min
  bar widths and gain horizontal scroll if attempt count is high.
  AttemptComparison selects stack vertically with the "→" rotating to a downward
  affordance. Sidebar collapses; bottom Tabbar shown.

---

## 4. Components used (FOUNDATION §5 only)

- **Navigation:** `AppShell`, `Sidebar`, `Topbar`, `Tabbar` (mobile),
  `Breadcrumb`, `CommandPalette` (⌘K, web only).
- **Data:** `Stat`/`KPI` (the four KPI cards — Best, Latest, Attempts, Avg
  time/Q), `Timeline` (x-axis attempt sequencing for the progression chart),
  `ProgressBar` (per-topic accuracy), `EmptyState`, `Skeleton`, `Badge`,
  `Chip/Tag` (mastery-delta chip), `Card`/`Panel`/`Section` (region containers).
- **Charts (domain, §5):** `ScoreCard`/`StatCard` (KPI strip), `SimpleBarChart`
  (score progression + pace trend), `DifficultyProgressionChart` (easy/med/hard
  accuracy first→latest).
- **Domain components:** `InsightCard` (the "next focus" recommendation cards,
  fed by `v1.analytics.getSummary`), `StoryPointNode` (small mastery-state
  indicator in the header band), `AnswerKeyLock` (subtle inline marker on any
  "see the explanation" affordance for the _latest unreleased_ attempt, making
  the absence of correct answers legible — see §8).
- **Feedback:** `InlineAlert/Banner` (error state), `Toast` (refetch failures).

**Screen-specific composites (compositions of the above, not new primitives):**

- **AttemptComparison** — two `Select` (Combobox) inputs + a delta row built
  from `Stat` deltas with up/down/flat indicators. Already exists as a
  composite; rebuilt on shared primitives.
- **StudyRecommendations** — a priority-ordered list that **renders
  `InsightCard`s**. In the rebuild its recommendation _content_ comes from
  `v1.analytics.getSummary` (honest analytics), not local heuristic strings.
- **MasteryDelta chip** — a `Chip/Tag` styled with `mastery.*` tokens showing
  first→latest mastery transition.

**Proposed FOUNDATION additions:** none required. (`AttemptComparison`,
`StudyRecommendations`, `MasteryDelta` are compositions of existing §5
components, not new variants. If the team wants `AttemptComparison` promoted to
a named domain component, flag it then — for now it is a local composite.)

---

## 5. States

- **Loading (skeleton):** Header band skeleton (title bar + subtitle), then 4
  KPI `Skeleton` cards in the strip, then 3 chart-block `Skeleton`s (h-32
  rounded). No layout shift on resolve. Use `bg.surface-sunken` shimmer per
  Skeleton spec.
- **Empty (zero completed attempts):** Centered `EmptyState` with a muted chart
  glyph (`text.muted`), Fraunces title, and a primary CTA to take the test. Copy
  in §7. This is the most common first-visit state.
- **Partial / single attempt (N=1):** Show KPI strip and topic/difficulty
  mastery for the one attempt, but **hide** Score Progression, Pace Trend, and
  AttemptComparison (they need ≥2 attempts). Replace them with an encouraging
  "one attempt so far" note that frames the next attempt as where trends begin.
  Difficulty/topic still render (single-attempt accuracy is honest data).
- **Error:** If `testSessions.list` fails → full-region `InlineAlert/Banner`
  (status.error, paired with icon + label, never color-alone) with a Retry
  button; do not render as an empty state (status-report fix #14 / parent-web
  "errors render as empty states" lesson). If only `v1.analytics.getSummary`
  fails (recommendations) → render everything else and show a small inline
  "Recommendations are taking a moment — your data is still here" partial note
  in the "Your next focus" region, with a quiet retry. Charts must never
  silently show fake/zero data on error.
- **Success:** Full layout as wireframed.
- **Permission / role-gated:** B2B `student` and B2C consumer render
  identically; `LearnerContext` resolves the data source. No staff variant (this
  is a learner-only surface). Tenant isolation enforced at the repo (reads
  scoped to active tenant claim, or `platform_public` for consumers).

---

## 6. Interactions & motion

**This is a data-dense reflective surface — motion stays subtle (FOUNDATION §4).
NO `CelebrationBurst`/spark pop here**, even when the latest attempt crosses the
pass line — that celebratory moment belongs to the post-submission
`ResultSummary`/gamification surfaces, not the analytics deep-dive (FOUNDATION
§7 rule 8). Reusing it here would dilute the one celebratory moment.

- **Initial render:** regions fade/translate in with `motion.base` +
  `ease.entrance`, lightly staggered top→down. Bars in `SimpleBarChart` grow
  from baseline with `motion.base` + `ease.standard` on first paint only.
- **AttemptComparison select change:** the delta row recomputes; delta values
  transition with `motion.fast`; delta arrows (up = status.success, down =
  status.error, flat = text.muted) swap with a quiet crossfade. Framing is
  non-judgmental — a downward score delta still reads "Let's look at what
  changed here," never "Worse."
- **Hover (web):** chart bars show a `Tooltip` (e2 popover elevation) with exact
  attempt #, %, date, and time/Q. KPI cards lift to `e2` on hover. On mobile
  these become tap-to-reveal.
- **InsightCard CTA:** "Practice this" navigates to
  `/spaces/:spaceId/practice/:storyPointId`; "Review story point" → the
  story-point viewer. Navigation uses the standard page transition
  (`motion.page`).
- **Refetch:** background refetch (React Query) is silent; a transient `Toast`
  only on hard refetch failure. No optimistic updates (read-only screen).
- **Reduced motion:** all entrance/bar-grow/delta transitions collapse to
  instant; respect `prefers-reduced-motion`.

---

## 7. Content & copy (warm, coaching tone)

**Header:**

- Title: `{Story point title} — Your Progress` (Fraunces display).
- Subtitle: `"{N} attempts · last attempt {relative date}"`.
- Mastery-delta chip (when crossed): `"In progress → Mastered"` with a quiet
  "Nice climb."

**KPI labels:** "Best Score" · "Latest Score" · "Attempts" · "Avg Time / Q".
Numbers in Spline Sans Mono (tabular).

**Score Progression caption:** `"Your scores across attempts. Passing: {x}%."`
Best bar gets a small "Best" tag. If latest ≥ best: small line
`"You're at your best right now — keep it up."`

**Pace Trend caption:**
`"Time per question, attempt by attempt. Faster isn't always better — accuracy first."`
(Prevents the harmful "rush to be fast" read.)

**Difficulty mastery:**
`"How you're doing by difficulty — and how much you've grown since your first attempt."`
Per-bar delta: `"+12% since attempt 1"` (status.success) / `"steady"`
(text.muted). Never "-X% worse"; use `"down 8% — worth another look"`.

**Topic mastery section title:** `"Topic mastery"`. Empty within section:
`"We'll show topic-by-topic progress once your attempts include tagged topics."`

**AttemptComparison title:** `"Compare two attempts"`. Delta row labels:
"Score", "Questions answered", "Avg time / question". A flat delta reads
`"about the same"`.

**Your next focus (StudyRecommendations / InsightCard):**

- Section title (Fraunces): `"Your next focus"`.
- Each `InsightCard` headline is action-framed, e.g.
  `"Spend time on Dynamic Programming"`, body:
  `"You're at 40% here across your attempts. A few targeted practice problems will move this fast."`
  (Strengths get a card too:
  `"Arrays are a strength — you're at 92%. Lean on this confidence."`)
- All-strong state: a single positive `InsightCard`:
  `"You're solid across the board. Try the test again to push for a higher best score."`

**Empty state (zero attempts):**

- Title (Fraunces): `"No attempts yet — your progress starts here"`.
- Body:
  `"Take this test once and we'll show you exactly where you're improving and what to focus on next."`
- Primary button: `"Take the test"`.

**Single-attempt note:**
`"One attempt down. Take it again and we'll start charting your trend."`

**Error banner:**
`"We couldn't load your progress just now. Your attempts are safe — let's try again."` +
`"Retry"`. (Never blame the learner; reassure data isn't lost.)

**Recommendations-only partial:**
`"Your insights are taking a moment to catch up — everything else above is up to date."`

---

## 8. Domain rules surfaced

- **Answer key is NEVER shown.** This screen aggregates _scores, accuracy,
  pacing, topic/difficulty breakdowns, and explanations the server chose to
  return_ — it must never surface the raw stored correct answers. Per-attempt
  feedback/explanations are only ever shown for **completed, released** attempts
  via server-returned payloads; for any latest attempt that is still
  locked/unreleased, any "see explanation" affordance shows the `AnswerKeyLock`
  visual making the absence legible. The `answerKeys` subcollection is
  server-only and `firestore.rules`-denied to all clients — the client
  physically cannot read it. Topic/difficulty accuracy is derived from the
  server-computed `analytics` breakdown, not from comparing answers to a key
  client-side.
- **Honest analytics (screen-specific, primary rule).** Every metric is real
  data from `testSessions.analytics` and `v1.analytics.getSummary`. No
  fabricated numbers, no placeholder/zero-filled charts, no client-side
  heuristic "AI" strings masquerading as insight (this replaces the
  status-report "AI Analytics is not AI" anti-pattern). If a breakdown is absent
  for an attempt, omit it — never synthesize. Recommendations come from the
  analytics service, not invented locally.
- **Timer is server-authoritative (inherited context).** The per-attempt
  durations shown here originate from server-authoritative
  `serverDeadline`/session timing — the client never recomputed expiry. No
  `TimerBar` on this screen (no live countdown), but pacing data is trustworthy
  because it came from the reconciled session, not client clock.
- **Tenant isolation.** Reads are scoped to the caller's active-tenant claim
  (B2B) or `platform_public` + `consumerProfile` (B2C); a learner only sees
  their own sessions (`userId` ownership enforced at repo + rules).
- **No gamification celebration here** (FOUNDATION §7 rule 8) — see §6.

---

## 9. Accessibility

- **Focus order:** Breadcrumb → header → KPI cards (left→right) → each chart
  region (chart is an `img`/`figure` with an aria-label summary) →
  AttemptComparison selects (A then B) → each InsightCard and its CTA → footer
  "Take again" CTA.
- **Keyboard:** All `Select`/Combobox controls fully operable (open with
  Enter/Space, arrow to navigate, Esc to close). InsightCard CTAs are real
  links/buttons in tab order. ⌘K command palette available on web.
- **ARIA:** Charts expose a text alternative (`aria-label` / visually-hidden
  table) — e.g. "Score progression: attempt 1 62%, attempt 2 71%, attempt 3 80%,
  passing 70%." Delta indicators pair an icon + a text label + an aria-label
  ("up 9 percentage points") — never status-by-color-alone (FOUNDATION §2 rule).
  KPI numbers have units in their accessible name ("Average time per question,
  45 seconds").
- **Contrast:** All chart fills, bar labels, and status deltas meet WCAG AA
  against `bg.surface` (use semantic `status.*` / `mastery.*` tokens which are
  AA-checked). Marigold pass-line marker pairs with a label, not color alone.
- **Reduced motion:** entrance, bar-grow, and delta transitions disabled under
  `prefers-reduced-motion`; content appears immediately.
- **Live region:** AttemptComparison delta recompute announces via a polite
  `aria-live` region so screen-reader users hear the new deltas after changing a
  select.

---

## 10. Web ↔ mobile divergence (FOUNDATION §6)

- **Shell:** web = Sidebar + Topbar; mobile = bottom **Tabbar**, no persistent
  sidebar. ⌘K **CommandPalette is web-only** (absent on mobile).
- **KPI strip:** 4-up row (web) → 2×2 grid (mobile).
- **Charts:** hover-tooltips (web) → **tap-to-reveal** value popovers (mobile).
  With many attempts, mobile charts gain horizontal scroll with a scroll-hint
  affordance; web fits-to-width.
- **AttemptComparison:** horizontal `A → B` layout (web) → vertical stack with
  downward connector (mobile); the two `Select`s become full-width sheet-style
  pickers (`Drawer/Sheet`) on mobile.
- **Side-by-side charts** (Pace Trend + Difficulty deltas) collapse to
  single-column stack below md.
- **Targets:** all interactive controls ≥44px touch targets on mobile.
- Component **names/props match 1:1** between `shared-ui` (web) and `ui-native`
  (mobile); only renderers differ. `SimpleBarChart`,
  `DifficultyProgressionChart`, `InsightCard`, `StatCard` have parallel RN
  implementations consuming the same data hooks (`shared-hooks/headless` over
  `api-client`).

---

## 11. Claude-design prompt (ready to paste)

```
Design the "Test Session Analytics (Deep Dive)" screen for the Auto-LevelUp STUDENT web app,
strictly conforming to the Lyceum design system (docs/rebuild-spec/design/00-FOUNDATION.md,
Direction A — Modern Scholarly). Compose ONLY from FOUNDATION §5 components and cite §2/§3/§4
tokens by semantic name (bg.canvas, bg.surface, text.primary/secondary/muted, brand.primary,
spark, border.subtle, status.success/error, mastery.notStarted/inProgress/mastered, radius.lg,
e1/e2, motion.base/fast, ease.entrance/standard). Do NOT invent colors, fonts, spacing, radii,
shadows, or component variants.

ROLE & TONE: a learner reviewing their progress across multiple completed timed-test attempts on
one story point. Tone is COACHING and warm — "here's where you're improving, here's your next
focus." Never punitive: a score drop reads "worth another look," not "worse."

ROUTE: /spaces/:spaceId/test/:storyPointId/analytics, inside AppShell (Sidebar+Topbar on web,
bottom Tabbar on mobile), with a Breadcrumb: Spaces › {Space} › {Story point} › Progress.

DATA (read-only, all via @levelup/api-client; never Firebase directly): testSessions.list/get
(completed sessions sorted by attemptNumber, each with analytics: topicBreakdown,
difficultyBreakdown, averageTimePerQuestion, percentage, answeredQuestions),
getStoryPointProgress (mastery + assessmentConfig.passingPercentage), getSpace/listStoryPoints
(titles), and v1.analytics.getSummary(scope:'student') for the recommendation cards.

TYPOGRAPHY: Fraunces for h1/section titles + the empty-state title; Schibsted Grotesk for
labels/body/buttons; Spline Sans Mono for ALL numerics (scores, %, seconds, attempt counts).

LAYOUT (data-dense, ~960 chart width):
1. Header band: trend icon + "{Story point} — Your Progress", subtitle "{N} attempts · last
   attempt {relative date}", and a MasteryDelta chip (mastery.* tokens) when mastery crossed.
2. KPI strip: ScoreCard "Best" + StatCard "Latest" (with trend arrow) + StatCard "Attempts" +
   StatCard "Avg Time / Q". 4-up on lg, 2×2 on mobile.
3. Score Progression: SimpleBarChart, one bar per attempt #, marigold (spark) pass-line marker,
   best bar in mastery.mastered green, caption "Passing: {x}%". (Only when ≥2 attempts.)
4. Two-up below lg, stacked on mobile: Pace Trend (SimpleBarChart of avg time/Q, caption
   "Faster isn't always better — accuracy first.") and Difficulty mastery deltas
   (DifficultyProgressionChart: easy/med/hard accuracy first→latest with +/- deltas).
5. Topic mastery: per-topic ProgressBar of accuracy + "+12% since attempt 1" deltas.
6. AttemptComparison: two Selects (A → B) and a delta row (Score, Questions answered,
   Avg time/Q) each with up=status.success / down=status.error / flat=text.muted icon+label.
7. "Your next focus": priority-ordered InsightCard list (≤5) from getSummary — action-framed
   headlines, with "Practice this" / "Review story point" CTAs. Include a positive card for
   strengths.
8. Footer: secondary "Take the test again".

STATES: skeleton (header + 4 KPI + 3 chart blocks); empty (zero attempts) = centered EmptyState
"No attempts yet — your progress starts here" + primary "Take the test"; single-attempt = show
KPIs + difficulty/topic, hide progression/pace/comparison, show "One attempt down…" note; error
= InlineAlert (status.error, icon+label) with Retry, NOT an empty state, reassuring data is safe;
recommendations-only failure = inline partial note while charts still render.

DOMAIN RULES (must honor):
- HONEST ANALYTICS: every number is real server data; never fabricate, zero-fill, or synthesize
  missing breakdowns; recommendations come from v1.analytics.getSummary, not local heuristics.
- ANSWER KEY NEVER SHOWN: no raw correct answers anywhere; show the AnswerKeyLock visual on any
  "see explanation" affordance for a latest unreleased attempt.
- NO CelebrationBurst / spark pop here — this is the reflective surface, not the gamification
  celebration moment. Keep motion subtle (motion.base entrance, motion.fast deltas).

MOTION: subtle staggered region entrance (motion.base + ease.entrance); bars grow from baseline
on first paint only; delta values crossfade on comparison change (motion.fast); KPI cards lift to
e2 on hover (tap-to-reveal on mobile). Respect prefers-reduced-motion (collapse to instant).

A11Y: charts carry aria-label text summaries (+ visually-hidden data table); deltas use
icon+label+aria, never color alone; AttemptComparison change announces via polite aria-live; full
keyboard operation; WCAG AA contrast on all chart fills/labels.

WEB↔MOBILE: ⌘K palette web-only; KPI 4-up→2×2; chart hover→tap; side-by-side charts→stacked;
AttemptComparison Selects→full-width sheet pickers with vertical A↓B layout; ≥44px touch targets.

Output a polished, production-grade React + Tailwind implementation using shared-ui components and
the cited Lyceum tokens. Render numbers in Spline Sans Mono. Keep it editorial, calm, and
encouraging — a precision instrument that coaches, not a scoreboard that judges.
```
