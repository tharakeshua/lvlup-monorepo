# Gamification — XP, Levels & Streaks — Design Spec

> Conforms to **Lyceum** (Direction A — "Modern Scholarly"),
> `docs/rebuild-spec/design/00-FOUNDATION.md`. Cite tokens by semantic name; do
> not re-paste scales. Tone: playful but not childish — a _controlled spark of
> play_. Celebrate effort; never punish.

> **This screen OWNS the platform's single celebratory motion moment.** The
> spring-pop + marigold `spark` burst (`CelebrationBurst`) is defined and
> governed here (§6, §8). Everywhere else in the learner app, motion stays
> subtle (FOUNDATION §4). Do not scatter bursts onto other surfaces.

---

## 1. Purpose & primary user

**Primary user:** a learner (B2B school student, role `student`; also the B2C
consumer learner) who wants to _feel and track their momentum_ — how far into
the current level they are, what tier they've reached, how long their daily
streak is, and the recent points they've banked. **Job-to-be-done:** _"Show me
I'm making progress and make it feel good — without lying to me about the
numbers."_

This is **two surfaces, one source of truth**:

1. **Dashboard widgets** — compact `XPMeter` + `LevelBadge` + `StreakFlame` that
   live inside the Student Home Dashboard gamification column (see
   `student-home-dashboard.md` §3) and on the Profile header.
2. **A focused "Progress & Rewards" view** — the dedicated `/progress` route
   that expands the widgets into a full XP/level/streak panel plus a
   recent-points history feed.

It is _motivating chrome over honest data_: the precision (XP counts, streak
days, tier) must be exact, but the framing is warm and energizing.

---

## 2. Entry points & route

**Routes:**

- `/progress` — the focused view (B2B student tree, behind
  `RequireAuth allow=['student']`, `onMissingMembership: 'consumerRedirect'`).
  Reached from the dashboard gamification column's "View progress ▸" link, the
  `XPMeter`'s tap target, the Profile header, and (mobile) the Tabbar/overflow.
  **This route must be wired** — today `/progress` and `/achievements` are dead
  links (webapps-design §5.2 fix #14).
- Widgets also render embedded on `/` (dashboard) and `/profile`.

**Reads** (all via `@levelup/api-client` → `shared-hooks/headless`; **never
Firestore directly**; tenant derived from the active-tenant claim, never the
request body):

- `studentLevels/{userId}` → **`StudentLevel`** (`gamification/achievement.ts`):
  `level`, `currentXP`, `xpToNextLevel`, `totalXP`, `tier`
  (`bronze→silver→gold→platinum→diamond`), `achievementCount`, `updatedAt`.
  Surfaced via a gamification repo read behind the api-client (e.g.
  `v1.levelup.getStudentLevel`, or folded into
  `v1.analytics.getSummary { scope: 'student' }`).
- `studentProgressSummary.levelup.streakDays` (`StudentLevelupMetrics` on
  `StudentProgressSummary`) → current streak length, via
  `v1.analytics.getSummary { scope: 'student' }`. Also
  `levelup.totalPointsEarned` for the XP/points framing.
- **Recent points history** — a points-ledger read behind the api-client
  (gamification repo; e.g. derived from `StudySession.pointsEarned` entries and
  item/exam award events). Each entry: source label (e.g. "Completed Recursion",
  "5-day streak bonus", "Exam: Arrays passed"), points delta, timestamp
  (epoch-ms, normalized at repo edge), and category (`learning` / `consistency`
  / `excellence`).
- `studentAchievements` count / recent unlocks for the "X badges earned" link
  out to `/achievements` (the achievement screen owns its own spec).

**Writes:** none from this screen. XP/level/streak values are computed and
written **server-side** (triggers/services on item completion, test submission,
exam pass, daily login). This screen is read-only and _reactive_: it renders the
new values and fires the celebratory burst when an incoming value crosses a
threshold (§6/§8). The celebratory moment is owned here but **triggered by write
events elsewhere** (a story-point completed, a test submitted, a streak extended
at day rollover).

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (Sidebar + Topbar on `lg`; Topbar + bottom
**Tabbar** on mobile). `/progress` content column max-width 1200 (reading
regions narrower), page gutters 16/24/32 (mobile/tablet/desktop), vertical
rhythm `gap` space-6 between regions. Page on `bg.canvas`; cards on `bg.surface`
with `border.subtle` + `e1`.

### 3.1 Focused view `/progress`

```
┌──────────────────────────────────────────────────────────────────────┐
│ HEADER                                                                │
│  Fraunces h2 "Your progress"  ·  text.secondary "Keep the spark going"│
├───────────────────────────────────────────────┬──────────────────────┤
│ HERO XP CARD (spans 2 cols on lg)              │  STREAK CARD         │
│  ┌──────────────────────────────────────────┐  │  ┌────────────────┐  │
│  │ LevelBadge  "Lv. 7"  · ConfBadge tier=Gold│  │  │ StreakFlame    │  │
│  │ XPMeter  ▰▰▰▰▰▰▱▱▱  640 / 900 XP to Lv.8  │  │  │   🔥 12        │  │
│  │ Fraunces hero number · Spline Mono XP nums │  │  │  "day streak"  │  │
│  │ totalXP 4,210 lifetime (text.secondary)    │  │  │ "Best: 18"     │  │
│  └──────────────────────────────────────────┘  │  └────────────────┘  │
├───────────────────────────────────────────────┴──────────────────────┤
│ TIER TRACK (horizontal)                                               │
│  bronze ● silver ● [GOLD ◉ you] platinum ○ diamond ○                  │
│  "260 XP to Platinum" · text.secondary                                │
├──────────────────────────────────────────────────────────────────────┤
│ RECENT POINTS  (Timeline / list)                                      │
│   +40  Completed "Recursion"        · 2h ago     [learning]           │
│   +25  5-day streak bonus           · today      [consistency]        │
│   +60  Exam "Arrays" passed         · yesterday  [excellence]         │
│   … "View all activity" ▸                                             │
└──────────────────────────────────────────────────────────────────────┘
   (CelebrationBurst overlay — fixed, pointer-events:none, z above all)
```

### 3.2 Dashboard / Profile widget cluster

A vertical stack in the dashboard gamification column (and Profile header):
`LevelBadge` + inline `XPMeter` on top, `StreakFlame` (`StreakWidget`) below,
then a "X badges · View progress ▸" link. The same components, compact size.

### 3.3 Responsive

- **lg ≥1024:** Hero XP card 2/3 + Streak card 1/3 side-by-side; Tier track
  full-width; Recent Points full-width list. Sidebar visible.
- **md 768:** Hero and Streak stack (Hero full-width, Streak full-width
  beneath). Tier track scrolls horizontally if cramped.
- **sm <640:** Single column, all cards full-width and stacked; Tier track
  becomes a horizontally scrollable strip with the current tier centered; Recent
  Points list rows wrap source + points. Bottom **Tabbar**; no Sidebar.

---

## 4. Components used (FOUNDATION §5)

**Domain:** `XPMeter` (currentXP / xpToNextLevel progress + totalXP),
`LevelBadge` (level + tier `bronze→diamond`), `StreakFlame` (the flame uses the
`spark` marigold-500→red-500 gradient per FOUNDATION §2.3; rendered via
`StreakWidget`), `CelebrationBurst` (the one celebratory moment), `Achievement`
(compact, for the "recent badges" link-out — count only here; full grid lives on
`/achievements`), `ConfidenceBadge`-style pill is **not** used (tier pill is
part of `LevelBadge`).

**Primitives / containers / data:** `Card` (radius.lg, `e1`), `Section`,
`Stat/KPI` (for the hero XP / lifetime figures), `ProgressBar`/`ProgressRing`
(under `XPMeter`), `Timeline` (Recent Points history), `Chip/Tag` (category
labels on points rows: learning/consistency/excellence), `Badge`, `EmptyState`,
`Skeleton`, `Button` (ghost "View all activity"), `Tooltip` (tier explanation),
`InlineAlert`/`Banner` (load error).

**Navigation:** `AppShell`, `Sidebar`, `Topbar`, `Tabbar` (mobile).

**Proposed FOUNDATION additions:**

- **`TierTrack`** — the horizontal `bronze ● silver ● gold ● platinum ● diamond`
  progression rail with the current tier highlighted and "N XP to next tier"
  caption. It is the tier analogue of `StoryPointTrack` and is reused on Profile
  and (potentially) the leaderboard. It is _not_ expressible by composing
  existing primitives cleanly (it needs the 5-tier semantic states + connector).
  Flagging it for promotion into FOUNDATION §5 before build. Until promoted, it
  may be composed from `StoryPointNode`-style nodes + a connector, but should be
  named `TierTrack` so it can be lifted.
- **`PointsHistoryRow`** (optional) — a thin specialization of `Timeline` row
  carrying `{ delta, sourceLabel, category chip, timestamp }`. If the team
  prefers not to promote it, compose from `Timeline` + `Chip` + Spline-Mono
  delta; calling it out so it is not silently invented.

---

## 5. States

- **Loading:** `Skeleton` placeholders matching the layout — a skeleton hero
  card (rounded bar where the XPMeter goes, shimmer tier pill), a skeleton
  streak card, 3–4 skeleton Timeline rows. No numbers until real data lands
  (never animate a CountUp from a fake zero — see §6). Subtle shimmer only.
- **Empty / brand-new learner:** `StudentLevel` exists at Lv. 1 with
  `currentXP: 0` for everyone (server seeds it), so the _hero is never truly
  empty_. The **Recent Points** list is the empty surface → `EmptyState`: warm
  illustration + "Your wins will show up here. Complete a story point or pass a
  test to earn your first points." with a primary `Button` "Start learning ▸" →
  `/spaces`. Streak at 0 → `StreakFlame` renders an un-lit (muted) flame with
  "Start a streak today" copy, not a punitive "0".
- **Partial:** `StudentLevel` loaded but points-history read still pending or
  failed → show level/XP/streak fully, render history region's own
  `Skeleton`/`ErrorState` independently (per-region degradation; one failing
  read never blanks the hero).
- **Error:** `InlineAlert` (status.warning, not error-red — this is non-critical
  chrome) at the top of the failing region: "We couldn't load your progress just
  now — your points are safe. Try again." with a retry `Button`. Never block the
  rest of the dashboard.
- **Permission / role-gated:**
  - **B2B student:** full view, tenant-scoped (`studentLevels` under the active
    tenant).
  - **B2C consumer:** identical components; data sourced from the
    `platform_public` tenant + `user.consumerProfile`. Same XP/level/streak
    model. Tier names unchanged.
  - No teacher/admin variant — gamification is learner-only.
- **prefers-reduced-motion:** no burst, no CountUp, no flame flicker — values
  appear statically; the level-up/streak event still announces via a live-region
  text + a static `spark`-tinted highlight ring on the changed card (§9).

---

## 6. Interactions & motion (cite motion tokens)

**Everyday (subtle) motion:**

- On `/progress` mount or widget mount, XP and totals **CountUp** from a
  sensible baseline (last-seen value cached in `ui-store`, not from 0) over
  `motion.base` (220ms) with `ease.standard`. XPMeter bar fills with
  `motion.slow` (320ms) `ease.entrance`. Skipped under reduced-motion.
- Hover/press on a points row or a "View all" link: `motion.fast` (160ms)
  `ease.standard` background tint. Hover (web) → press feedback (mobile).
- Tier track current-node has a steady (non-looping) `spark`-tinted ring;
  tooltip on hover/focus explains the tier and XP-to-next.

**THE ONE CELEBRATORY MOMENT — `CelebrationBurst` (spring pop + marigold `spark`
burst):**

Fires **only** for these gamification events (this screen is the canonical
owner; the only other sanctioned places anywhere in the app are
achievement-unlock and 100% completion):

1. **XP gain** that the learner is present to see (e.g. returning to the
   dashboard after a session with a positive delta, or a live award while on
   `/progress`).
2. **Level-up** — `level` increases. The strongest variant: the `LevelBadge`
   springs (scale pop), the new level number swaps in, and the burst emits from
   the badge centre.
3. **Streak extension** — `streakDays` increments at day rollover or first
   qualifying activity of the day. The `StreakFlame` springs and brightens up
   its marigold→red gradient; a short burst.

Mechanics:

- Pop uses the **spring** ease reserved for gamification (FOUNDATION §4: spring
  / Reanimated on RN; framer-motion spring on web). The burst particles use the
  **`spark`** token energy (marigold), per the FOUNDATION rule that `spark` is
  reserved for XP/streak/gamification.
- Debounce / coalesce: if multiple awards land at once (e.g. finishing a story
  point grants XP _and_ extends a streak _and_ triggers a level-up), fire
  **one** coalesced burst (level-up takes visual priority), not three stacked
  bursts.
- The burst is fixed-overlay, `pointer-events:none`, `aria-hidden`,
  auto-dismisses (~2000ms, `onComplete` clears it).
- **Trigger source of truth:** the burst is driven by the _delta between the
  previously rendered value and the freshly read server value_, computed in a
  headless `useGamificationCelebration` hook — never by a client guess about
  whether the learner "earned" something. The server already wrote the value;
  the client only celebrates the observed change once (idempotent per change,
  keyed on `updatedAt`).

**Confirmations:** none needed — read-only screen, no destructive actions.

---

## 7. Content & copy (warm, encouraging — "controlled spark of play")

- **Header (h2, Fraunces):** "Your progress" · subline (text.secondary): "Keep
  the spark going."
- **Level / XP:** "Level 7 · Gold" · meter caption "640 / 900 XP to Level 8" ·
  lifetime "4,210 XP earned all-time".
- **Level-up moment (live-region + transient banner):** "Level up! You're Level
  8 now 🎉" — celebratory but brief.
- **Tier track caption:** "260 XP to Platinum — you're close."
- **Streak:** "12-day streak" · "Best: 18 days". Streak-extended: "12 days and
  counting — nice work." Streak at 0: "Start a streak today — every day counts."
  (Never "You lost your streak" as a headline; if a streak just reset, frame
  gently: "Fresh start — let's build it back up.")
- **Recent points rows:** "+40 · Completed Recursion · 2h ago" / "+25 · 5-day
  streak bonus · today" / "+60 · Exam Arrays passed · yesterday".
- **Empty points history:** title "Your wins will show up here." · body
  "Complete a story point or pass a test to earn your first points." · CTA
  "Start learning ▸".
- **Error (warning tone):** "We couldn't load your progress just now — your
  points are safe. Try again."
- **Tone guardrails:** numbers are exact and never inflated; framing is
  energizing, never childish or condescending; no exclamation-mark spam (reserve
  the one "🎉" for the level-up moment). Mistakes/resets are growth, not
  failure.

---

## 8. Domain rules surfaced

- **The single celebratory moment lives here.** `CelebrationBurst` (spring pop +
  marigold `spark` burst) fires **only** on XP gain / level-up /
  streak-extension (this screen) plus achievement-unlock and 100%-completion
  (their own screens). It must **not** appear on neutral surfaces (test results,
  grading, content view, navigation). The `spark` token is reserved for
  XP/streak/gamification energy — do not use it for generic CTAs on this screen
  beyond the gamification accent. (FOUNDATION §4, §2.3.)
- **Announce, don't rely on motion.** Level-up and streak-extension are
  announced via a polite `aria-live` region as _text_ ("Level up! You're Level 8
  now"), so the achievement is conveyed without the burst. Under
  `prefers-reduced-motion` the burst is suppressed and replaced by a static
  `spark`-tinted highlight + the same live-region text (§9).
- **Server is the source of truth for all gamification values.** XP, level,
  tier, and streak are computed and written by server triggers/services on
  completion/submission/login events. The client never increments XP locally or
  decides a level-up — it renders the read value and celebrates the _observed_
  delta once. (No client-trusted scoring, mirroring the timer/answer-key trust
  model.)
- **No answer-key / no scoring exposure.** This screen shows only aggregate
  reward values; it never surfaces correct answers or per-question correctness.
  (The answer-key isolation rule applies app-wide; nothing here reads it.)
- **Tenant isolation:** B2B reads `studentLevels` / summary under
  `tenants/{tenantId}/...`; B2C reads from `platform_public` +
  `user.consumerProfile`. The api-client derives tenant from the claim.
- **Honest data:** no fabricated streaks or "almost leveled up!" nudges that
  aren't backed by the real delta. Encouragement frames real numbers; it does
  not invent them.

---

## 9. Accessibility

- **Focus order:** Header → Hero XP card (LevelBadge, then XPMeter as a labelled
  `progressbar`) → Streak card → Tier track (each tier node focusable, current
  node announces "Gold, current tier, 260 XP to Platinum") → Recent Points rows
  (each a list item; "View all activity" is a real `Button`/link).
- **Keyboard:** all interactive elements (tier nodes' tooltips, View-all,
  Start-learning CTA) reachable and operable via Tab/Enter/Space. Tooltips open
  on focus, not hover-only.
- **ARIA:** `XPMeter` exposes `role="progressbar"` with `aria-valuenow/min/max`
  and an `aria-label` ("Level 7 progress: 640 of 900 XP"). `StreakFlame` carries
  `role="status"` `aria-label` ("12 day streak"). The burst is `aria-hidden`. A
  single polite **`aria-live="polite"`** region (e.g. on the page shell)
  announces level-up and streak-extension text exactly once per change.
- **Contrast:** all numerics/labels meet WCAG AA (body 4.5:1, large/UI 3:1). The
  marigold `spark` flame gradient never encodes meaning by color alone — it
  always pairs with the flame icon + the day count label (FOUNDATION §2.3 "never
  status by color alone"). Tier is conveyed by name text, not color swatch
  alone.
- **Reduced motion:** `prefers-reduced-motion` ⇒ no `CelebrationBurst`, no
  CountUp, no flame flicker/loop, no spring pop. Values render statically; the
  changed card gets a static `spark`-tinted highlight ring; the live-region text
  still fires. (`CelebrationBurst` already early-returns under reduced motion
  and still calls `onComplete`.)

---

## 10. Web ↔ mobile divergence (FOUNDATION §6)

- **Shell:** web Sidebar + Topbar with `/progress` in nav; mobile bottom
  **Tabbar** (gamification reached via Profile or a Tabbar item) — no Sidebar.
  No ⌘K CommandPalette on mobile.
- **Burst engine:** web uses framer-motion spring; RN uses **Reanimated spring**
  (`spring` ease per FOUNDATION §4). Same `CelebrationBurst` _name and props_
  across `shared-ui` (web) and `ui-native` (mobile); only the renderer differs.
- **Interaction:** hover (tier tooltip, row tint) on web → **press**/long-press
  on mobile; tooltips become tap-to-reveal popovers.
- **Tier track:** horizontal rail on web; on mobile a horizontally-scrollable
  strip with the current tier auto-centered.
- **Recent points:** web `Timeline` list; mobile stacks the row into source +
  delta + relative-time, full-width tap targets ≥44px.
- **Live-region announcements** behave identically (screen readers on both
  platforms) — the accessibility contract does not diverge.

---

## 11. Claude-design prompt (ready to paste)

```
Design the "Your progress" gamification screen for the Auto-LevelUp STUDENT web app,
conforming to the Lyceum design system (docs/rebuild-spec/design/00-FOUNDATION.md,
Direction A "Modern Scholarly"). Read FOUNDATION first; cite tokens by semantic name
(bg.canvas, bg.surface, text.primary/secondary, border.subtle, brand.primary, spark,
status.warning, mastery.*, radius.lg, e1, motion.base/slow, ease.standard/entrance,
the gamification spring). Do NOT invent colors, fonts, spacing, radii, shadows, or
component variants. Fraunces for the hero level number and headings, Schibsted Grotesk
for UI/labels, Spline Sans Mono for all numerics (XP, day counts, point deltas).

Build the /progress focused view and a compact dashboard widget cluster from these
FOUNDATION §5 domain components ONLY: XPMeter (currentXP / xpToNextLevel + totalXP),
LevelBadge (level + tier bronze→silver→gold→platinum→diamond), StreakFlame/StreakWidget
(flame uses the spark marigold-500→red-500 gradient), CelebrationBurst, plus a TierTrack
(PROPOSED addition — horizontal 5-tier rail with current tier highlighted + "N XP to
next tier"), a Timeline of recent points (+delta · source label · category Chip · relative
time), Card/Section/Stat/EmptyState/Skeleton/Button/Tooltip, inside AppShell.

Data is READ-ONLY and server-authoritative: StudentLevel {level, currentXP, xpToNextLevel,
totalXP, tier} from studentLevels/{userId}, streakDays from studentProgressSummary.levelup,
and a recent-points history feed — all via @levelup/api-client (tenant from claim; B2C from
platform_public). The client NEVER increments XP or decides a level-up.

CRITICAL — this screen OWNS the platform's ONE celebratory motion moment: a spring pop +
marigold spark burst (CelebrationBurst) fires ONLY on XP gain, level-up, or streak-extension
(here) plus achievement-unlock and 100% completion (elsewhere). Fire it from the observed
delta between the previously rendered value and the fresh server value (idempotent per change,
keyed on updatedAt); coalesce simultaneous awards into ONE burst (level-up wins priority).
Everywhere else motion stays subtle (CountUp on mount over motion.base; bar fill over
motion.slow). Respect prefers-reduced-motion: NO burst/CountUp/flicker — render values
statically with a spark-tinted highlight ring and announce level-up/streak via an
aria-live="polite" text region (motion is never the only signal).

Tone: playful but not childish — a controlled spark of play. Exact numbers, warm framing.
Streak-at-0 and streak-reset are gentle fresh-starts, never "you lost it." Empty points
history = "Your wins will show up here… Start learning ▸". Errors are warm and reassuring
("your points are safe"), status.warning not error-red, never blocking the rest of the page.

Deliver: the /progress layout (header → hero XP card + streak card → TierTrack → recent
points Timeline, with the CelebrationBurst overlay) and the compact dashboard widget cluster,
responsive at sm 640 / md 768 / lg 1024 (stack on mobile, bottom Tabbar, press not hover),
all five states (loading skeleton, brand-new-learner empty, partial, warning error, success),
and full a11y (progressbar/status roles, focus order, aria-live announcements, AA contrast,
reduced-motion).
```
