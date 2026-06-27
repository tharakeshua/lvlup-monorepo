# Achievements Gallery — Design Spec

> Conforms to **Lyceum** (Direction A — "Modern Scholarly"),
> `docs/rebuild-spec/design/00-FOUNDATION.md`. Cite tokens by semantic name; do
> not re-paste scales. Tone: warm, aspirational, motivating — every locked badge
> is an invitation, never a scolding ("3 more story points to unlock Scholar").

---

## 1. Purpose & primary user

**Primary user:** a B2B school learner (tenant-scoped, role `student`); a B2C
consumer learner reaches the same gallery from the consumer shell.
**Job-to-be-done:** _"Show me what I've earned, make the wins feel like wins,
and show me exactly how close I am to the next badge so I want to go earn it."_

This is the trophy room — the dedicated home for the gamification layer that the
Dashboard only teases. It must (a) celebrate earned badges with weight and
warmth, (b) make locked badges legible and _reachable_ (progress + the exact
remaining threshold), and (c) fire the one celebratory motion moment the first
time a learner lands here after newly unlocking a badge — then quietly mark it
seen. It is a read surface: the only write is the implicit "mark seen"
reconciliation.

It also closes a real gap: today `AchievementsPage.tsx` exists but is
**unrouted**, and the Dashboard links to `/achievements` which 404s (status
report §4, webapps-design inconsistency #14). This spec wires it up.

---

## 2. Entry points & route

**Route:** `/achievements` — B2B student tree behind
`RequireAuth allow=['student']`, `onMissingMembership: 'consumerRedirect'`; the
B2C consumer reaches the same page component through the consumer shell
(resolved by `LearnerContext`, not a duplicate route — webapps-design §5.2
"route on context, not path prefix"). Entry points: the Dashboard gamification
column "View all" link, the Sidebar/Profile gamification entry, and the
celebratory toast that fires elsewhere when a badge unlocks ("View achievement
→").

**Reads (all via `@levelup/api-client` → `shared-hooks/headless`; never
Firestore directly; `tenantId` derived from the active-tenant claim, never the
request body — B2C resolves to the `platform_public` tenant via
`LearnerContext`):**

- **Achievement catalog** — the `achievements` repo read
  (`achievements/{achievementId}` where `isActive == true`) → `Achievement[]`
  (title, description, `icon`, `category`, `rarity`, `tier`,
  `criteria{type,threshold,subject?,spaceId?}`, `pointsReward`). The badge
  templates.
- **Earned set** — the `studentAchievements` repo read (`studentAchievements`
  where `userId == ctx.uid`) → `StudentAchievement[]` (`achievementId`,
  denormalized `achievement`, `earnedAt` epoch-ms at the repo edge, `seen`). The
  join key for earned vs locked.
- **Progress toward locked** — `v1.analytics.getSummary` `{ scope: 'student' }`
  → `StudentProgressSummary` supplies the live counters the locked-badge
  `ProgressBar` reads against `criteria.threshold` (`levelup.completedSpaces`,
  story-points completed, `streakDays`, `autograde.completedExams`, perfect
  scores, `totalPointsEarned`, etc. — mapped per `AchievementCriteriaType`).
  Single server-aggregated read; no client heuristic recompute.
- **Level header** — `studentLevels/{userId}` (`StudentLevel`:
  level/currentXP/xpToNextLevel/tier/achievementCount) behind the api-client,
  for the XPMeter/LevelBadge header strip.

**Writes:**

- **Mark-seen reconciliation** — after the CelebrationBurst plays for
  newly-earned (`seen == false`) badges, the client calls a
  `markAchievementsSeen` mutation (behind `api.levelup.*` / gamification
  namespace; server flips `seen = true` on those `studentAchievements` docs).
  This is the _only_ write. Optimistic: badges drop their "new" highlight
  immediately; rolled back on failure (silent — never a punitive toast). There
  is no client-side achievement _granting_ here; unlocking happens server-side
  as a side effect of progress writes elsewhere.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (Sidebar + Topbar on `lg`; Topbar + bottom
**Tabbar** on mobile). Content column max-width 1200, page gutters 16/24/32
(mobile/tablet/desktop), vertical rhythm `gap` space-6 between regions.
`bg.canvas` page; badge cards on `bg.surface` with `border.subtle` + `e1`.
Numerics (counts, XP, points, thresholds) in Spline Sans Mono.

```
┌──────────────────────────────────────────────────────────────────────┐
│ HEADER ROW                                                            │
│  Fraunces h2 "Your Achievements"                                      │
│  text.secondary subline: "12 of 40 earned · 3 new this week"          │
│  ┌── LEVEL STRIP (right / under on mobile) ───────────────────────┐   │
│  │  LevelBadge (Lv 7) · XPMeter (1,240 / 1,800 XP) · StreakFlame  │   │
│  └────────────────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────────┤
│ CATEGORY FILTER — Chip row (scrollable on mobile)                     │
│  [All ·40] [Learning] [Consistency] [Excellence] [Exploration]       │
│  [Social] [Milestone]            (selected chip = brand.primary)      │
├──────────────────────────────────────────────────────────────────────┤
│ EARNED SECTION  — Section header "Earned (12)"                        │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                          │
│  │Achieve │ │Achieve │ │Achieve │ │Achieve │   ← Achievement (earned) │
│  │ ★ NEW  │ │ badge  │ │ badge  │ │ badge  │     "NEW" ring on seen=  │
│  │ icon   │ │ icon   │ │ icon   │ │ icon   │      false               │
│  │ title  │ │ title  │ │ title  │ │ title  │     rarity+tier Badge    │
│  │ rare✦  │ │ epic✦  │ │ common │ │ gold   │     earnedAt date        │
│  └────────┘ └────────┘ └────────┘ └────────┘                          │
├──────────────────────────────────────────────────────────────────────┤
│ IN PROGRESS / LOCKED — Section header "Keep going (28)"               │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                          │
│  │Achieve │ │Achieve │ │Achieve │ │Achieve │   ← Achievement (locked) │
│  │ icon°  │ │ icon°  │ │ icon°  │ │ icon°  │     desaturated icon     │
│  │ title  │ │ title  │ │ title  │ │ title  │     rarity+tier Badge    │
│  │▓▓▓░░ 7/10│ │▓░░░ 2/30│ │▓▓▓▓░ │ │░░░░░ │     ProgressBar +         │
│  │"3 to go"│ │       │ │       │ │       │       "N more to unlock"  │
│  └────────┘ └────────┘ └────────┘ └────────┘                          │
└──────────────────────────────────────────────────────────────────────┘
        ░ overlay layer: CelebrationBurst (spark) on first view of new badge
```

Within each section, sort: newly-earned (`seen=false`) first in **Earned**;
closest-to-unlock first (highest progress ratio) in **Keep going** — so the most
reachable goals lead. Tier is a secondary sort key (diamond→bronze) to keep the
prestige reading legible.

**Responsive (mobile-first):**

- **base → sm (640):** single-column page; badge grid **1-up** (full-width
  Achievement cards, count + threshold stacked). Level strip moves **below** the
  header (full-width). Category Chips become a horizontally **scrollable** row
  (snap, no wrap). Tabbar visible; Sidebar hidden.
- **md (768):** badge grid **2-up**; Level strip can sit inline to the right of
  the header. Chips wrap to a single line where they fit.
- **lg (1024)+:** badge grid **3-up** (4-up at `xl 1280` within the 1200 content
  column); Sidebar persistent; Level strip right-aligned in the header row.
  Chips on one row.

Touch targets ≥44px; each Achievement card is a single focusable/pressable unit
that opens a detail Popover/Sheet.

---

## 4. Components used (FOUNDATION §5 only)

- **Navigation:** AppShell, Sidebar, Topbar, Tabbar (mobile), CommandPalette
  (⌘K, web only).
- **Domain:** **Achievement** (the badge — both earned and locked variants;
  foundation §5 lists `Achievement`), **CelebrationBurst** (the one spring-pop +
  marigold spark for first view of a newly-earned badge), **XPMeter** +
  **LevelBadge** (header level/XP strip), **StreakFlame** (header streak,
  marigold→red gradient).
- **Data:** **Chip/Tag** (category filter row, selected = `brand.primary`),
  **Badge** (rarity label e.g. "Rare", tier label e.g. "Gold" — paired with
  icon + text, never tier-color alone), **ProgressBar** (locked-badge progress
  toward `criteria.threshold`; `mastery.inProgress` fill), **Stat/KPI** (header
  "earned of total" count), **EmptyState** (no badges in category / brand-new
  learner), **Skeleton** (loading grid), **Avatar** (topbar).
- **Containers:** **Card** (badge surface), **Section** (Earned / Keep going
  groupings), **Popover** (web) / **Drawer/Sheet** (mobile) for the badge
  **detail** (full description, criteria sentence, rarity/tier, points reward,
  earned date or remaining threshold). **Tooltip** for the locked-state
  explanation on hover.
- **Primitives:** Button (ghost "View all categories" / Sheet dismiss),
  IconButton.
- **Feedback:** Toast (sonner) only for the silent mark-seen failure path is
  suppressed; offline/PWA banners via the shell.

**Proposed FOUNDATION additions:**

- The brief names `AchievementBadge` / `AchievementCard` (and the current code
  uses `AchievementCard`). FOUNDATION §5 defines a single domain component named
  **`Achievement`**. **Recommendation:** treat `Achievement` as the canonical
  name with two documented variants — `Achievement variant="badge"` (compact
  grid tile, used here and on the Dashboard) and `Achievement variant="detail"`
  (the Popover/Sheet body). Do **not** introduce
  `AchievementBadge`/`AchievementCard` as new top-level component names — fold
  them into `Achievement`'s variant prop so the dashboard row and this gallery
  share one component. Flagged here so the variant set is promoted into §5
  rather than silently invented.
- No new tokens, fonts, radii, or motion are required — the "new/unseen"
  highlight uses `spark` for its ring/dot and the existing CelebrationBurst;
  locked progress uses `mastery.inProgress`. If a reusable
  **`RarityBadge`/`TierBadge`** pairing recurs across student + teacher
  gamification surfaces, promote it as a `Badge` preset (icon+label+tone map) in
  §5 Data then — noted, not invented here.

---

## 5. States

- **Loading (skeleton):** header → Skeleton for the count line + Level strip;
  grid → 6–9 Skeleton badge cards (`bg.surface-sunken` shimmer, no celebratory
  motion), Chip row → 3–4 pill Skeletons. `aria-busy`, `role="status"`, "Loading
  your achievements…".
- **Empty — brand-new learner (no earned, catalog exists):** never a sad blank.
  The **Keep going** section carries the whole page with every badge shown as a
  reachable goal; an encouraging EmptyState banner above it: title "Your first
  badge is closer than you think" / body "Finish a story point or keep your
  streak alive to start your collection." Earned section is simply omitted (no
  "0 earned" headline of shame).
- **Empty — category with no matches:** EmptyState (Trophy icon) — title
  "Nothing here yet — but it's coming", body "Keep learning and {category}
  badges will show up here." Chip stays selectable to switch back to All.
- **Empty — catalog itself empty (tenant has no active achievements):** quiet
  EmptyState — "Achievements are on their way to your school." No error styling;
  this is a content-config state, not a fault.
- **Partial:** sections render independently. If the catalog + earned load but
  `getSummary` fails, locked badges still render with their criteria sentence
  but the ProgressBar shows an indeterminate/"—" state with copy "We'll show
  your progress in a moment" rather than a wrong 0/N. If earned loads but the
  catalog fails, show earned badges and a quiet InlineAlert ("Couldn't load the
  full collection — your earned badges are all here. Retry").
- **Error (whole page):** ErrorState distinct from empty — "We're having trouble
  loading your trophy room. Let's try again." + Retry (refetch). Never blame the
  learner.
- **Success — earned badge:** full-color icon, rarity + tier Badge, `earnedAt`
  date ("Earned Mar 14"), points reward chip. **Success — locked badge:**
  desaturated icon, rarity/tier Badge still shown (aspirational — you can see
  what you're working toward), ProgressBar + remaining-threshold sentence.
- **New/unseen variation:** any earned badge with `seen == false` gets the
  `spark` "NEW" ring + dot and sorts first; on first paint it is the focus of
  the CelebrationBurst, then the mark-seen write strips the highlight.
- **Role/segment gating:** B2B student and B2C consumer both see the gallery;
  the only difference is the `LearnerContext` data source (tenant vs
  `platform_public`) and which catalog applies. No teacher/admin variant.

---

## 6. Interactions & motion

- **Filter by category:** tap a Chip → grid re-filters with a subtle cross-fade
  of items (`motion.base`, `ease.standard`); selected Chip animates to
  `brand.primary`. Counts on each Chip update. No layout jump (reserve grid
  height during the swap).
- **Open badge detail:** tap/click an Achievement card → Popover (web, anchored,
  `e2`) / bottom Sheet (mobile, `e3`) opens with `ease.entrance`, `motion.base`.
  Body shows the full description, the **criteria as a human sentence**
  ("Complete 10 story points — you're at 7"), rarity, tier, points reward, and
  either the earned date or the remaining-threshold line. Esc / scrim /
  swipe-down dismisses (`ease.exit`).
- **The one celebratory moment (gamification):** on first view of any
  newly-earned badge (`seen == false`), the **CelebrationBurst** fires once —
  spring pop + marigold `spark` particle burst over the new badge(s) — using the
  reserved gamification motion. It runs **once per session per new set** (guard
  so a re-render or a tab-back doesn't re-trigger; today the page already uses a
  `sessionStorage` flag — keep that intent behind the headless hook).
  Immediately after, the **mark-seen** write flips `seen = true` (optimistic:
  the "NEW" ring fades out with `motion.fast`). Locked badges **never** receive
  celebratory motion — their ProgressBar fill animates with a plain
  `motion.base` ease only.
- **Progress feedback on locked badges:** ProgressBar fills to
  `progress/threshold` on mount with a single `motion.base` grow (no bounce, no
  spark). The remaining-threshold sentence is the motivational payload, not
  motion.
- **Optimistic mark-seen rollback:** if the write fails, restore the "NEW"
  highlight silently (no error toast — losing a highlight is not worth alarming
  the learner); it'll retry on next visit.
- **Reduced motion:** `prefers-reduced-motion` → CelebrationBurst degrades to a
  static `spark` glow + a single non-animated "New!" label; all fades/grows
  collapse to instant; filter swap is an instant content change. The win is
  still _communicated_, just not _animated_.

---

## 7. Content & copy

- **Page title (Fraunces h2):** "Your Achievements".
- **Count subline (text.secondary):** "{earned} of {total} earned" + when new: "
  · {n} new this week". Brand-new: hide the "0 of N" framing — lead with the
  Keep-going invitation instead.
- **Section headers:** "Earned ({n})" · "Keep going ({n})" (not "Locked" —
  warmer, forward-looking).
- **Category Chips:** All · Learning · Consistency · Excellence · Exploration ·
  Social · Milestone (with per-category counts).
- **Earned badge:** title (e.g. "Scholar"), description, "Earned {Mon DD}",
  "+{points} XP" chip, rarity ("Rare") + tier ("Gold") labels.
- **Locked badge remaining-threshold sentence (the motivating line):** e.g. "3
  more story points to unlock **Scholar**" · "Keep your streak 2 more days" · "1
  more perfect exam to go" — always framed as _how close_, derived from
  `criteria.threshold − currentProgress`. When at 0 progress: "Start this one by
  {first concrete action}" rather than "0 / N".
- **Badge detail criteria sentence:** human-readable from
  `AchievementCriteriaType` + threshold (+ optional `subject`/`spaceId` scope),
  e.g. "Complete 10 story points in any space."
- **Empty (new learner):** title "Your first badge is closer than you think" /
  body "Finish a story point or keep your streak alive to start your
  collection."
- **Empty (category):** "Nothing here yet — but it's coming" / "Keep learning
  and {category} badges will show up here."
- **Empty (no catalog):** "Achievements are on their way to your school."
- **Error:** "We're having trouble loading your trophy room. Let's try again." +
  "Retry".
- **Celebration toast/inline (on first view):** "You unlocked {title}! 🎉" —
  celebratory, never "You finally got…".

Tone rule: every locked state is phrased as an invitation and a
distance-to-goal, never a deficiency. Mistakes/gaps are never surfaced here at
all — this is a pure encouragement surface.

---

## 8. Domain rules surfaced

- **Gamification = the one celebratory motion moment.** The CelebrationBurst
  (spring pop + marigold `spark` burst) is reserved for the first view of a
  newly-earned (`seen == false`) badge here, mirroring the global rule. It is
  **not** scattered onto locked badges, filter changes, or hover. After it
  plays, `seen` is flipped server-side so it never re-celebrates the same badge.
  Respect `prefers-reduced-motion` (§6).
- **Unlocking is a server side-effect, not a client action.** Badges are
  _granted_ server-side as a consequence of progress writes (story-point
  completion, streak ticks, exam passes) — this page never grants an
  achievement; it only _reflects_ earned state and _reconciles_ `seen`. The
  remaining-threshold math is read against the server-aggregated `getSummary`,
  not recomputed from raw client data (no honest-analytics violation;
  webapps-design fix #16).
- **No answer-key / no assessment internals.** This is a pure gamification
  surface — none of the answer-key-protection or server-authoritative-timer
  rules apply directly, but the same data-flow discipline does: all reads/writes
  go through `@levelup/api-client` (Zod-validated, timestamps normalized to
  epoch-ms at the repo edge); the UI never touches `firebase/firestore` directly
  (status report §4 — kills the current `as { seconds: number }` cast in
  `AchievementsPage.tsx`).
- **Tenant isolation.** B2B reads are tenant-scoped
  (`tenants/{tenantId}/achievements`, `…/studentAchievements`); B2C consumer
  reads resolve through the synthetic `platform_public` tenant +
  `user.consumerProfile` via `LearnerContext`. `tenantId` is derived from the
  active-tenant claim server-side, never sent in the request body.
- **Legibility over color (accessibility domain rule).** Rarity and tier are
  conveyed by **icon + text label**, never color/tier alone (FOUNDATION §2
  "never encode status by color alone") — see §9.

---

## 9. Accessibility

- **Focus order:** skip-link → header (title, then Level strip as a labelled
  group) → category Chip group (roving tabindex, arrow-key navigation,
  `role="radiogroup"` / Chips as `role="radio"` since it's single-select) →
  Earned grid (each Achievement card a single focusable element) → Keep-going
  grid. Opening a detail moves focus into the Popover/Sheet and traps it;
  dismiss returns focus to the originating card.
- **Keyboard:** Chips navigable with arrows + Enter/Space to select; each badge
  card is `button`-semantics (Enter/Space opens detail); Sheet/Popover
  Esc-dismissible; ⌘K CommandPalette can jump to "/achievements" (web only).
- **Aria / legibility:** each badge has an accessible name that bundles
  **state + identity + rarity** so it's complete without sight of color or icon
  — e.g. `aria-label="Scholar, earned, Rare, Gold tier"` for earned;
  `aria-label="Scholar, locked, Rare, Gold tier, 7 of 10 story points — 3 to go"`
  for locked. Rarity and tier are also rendered as visible **text** Badges, not
  color swatches alone. ProgressBar exposes `role="progressbar"` with
  `aria-valuenow`/`aria-valuemin`/`aria-valuemax` and an `aria-label` carrying
  the threshold sentence. The "NEW" highlight is announced as text ("New") in
  the accessible name, not conveyed by the `spark` ring alone. CelebrationBurst
  is `aria-hidden` decorative; the unlock is announced once via a polite live
  region ("You unlocked Scholar").
- **Contrast:** all text/background pairs meet WCAG AA; desaturated locked icons
  keep their text label and Badge at full-contrast
  `text.primary`/`text.secondary`. `spark` is used as accent, never as the sole
  carrier of meaning.
- **Reduced motion:** per §6 — CelebrationBurst → static glow + "New!" label;
  bar fills and fades become instant; filter swap is instant.

---

## 10. Web ↔ mobile divergence (FOUNDATION §6)

- **Badge detail:** anchored **Popover** on web (hover-affordance + click) →
  bottom **Sheet/Drawer** on mobile (tap, swipe-down dismiss). Same
  `Achievement variant="detail"` body.
- **Hover vs press:** the locked-state Tooltip and earned-date hover affordance
  on web become tap-to-reveal-in-Sheet on mobile (no hover layer).
- **Category Chips:** single wrapped/inline row on web → horizontally
  **scrollable, snap** row on mobile.
- **Grid density:** 3–4-up on `lg/xl` web → 2-up on `md`, **1-up stacked
  full-width** cards on phones (count + threshold stack vertically; matches
  FOUNDATION §6 table→stacked-cards spirit).
- **Navigation:** Sidebar entry + ⌘K jump on web → bottom **Tabbar** entry
  (under Profile/gamification) on mobile; **no CommandPalette** on mobile.
- **Component parity:** `Achievement`, `CelebrationBurst`, `XPMeter`,
  `LevelBadge`, `StreakFlame`, `Chip`, `Badge`, `ProgressBar` share names/props
  1:1 between `shared-ui` (web) and `ui-native` (mobile) — only the renderer
  differs (CelebrationBurst uses Reanimated `spring` on RN, framer-motion spring
  on web).

---

## 11. Claude-design prompt (ready to paste)

```
Design the "Achievements Gallery" screen for the Auto-LevelUp STUDENT (learner) web app,
strictly conforming to the Lyceum design system (Direction A — "Modern Scholarly") in
docs/rebuild-spec/design/00-FOUNDATION.md. Do NOT invent colors, fonts, spacing, radii,
shadows, motion, or component variants — compose ONLY from FOUNDATION §2–§5 and cite tokens
by semantic name (bg.canvas, bg.surface, text.primary/secondary, brand.primary, spark,
border.subtle, mastery.inProgress, status.*, radius.lg, e1/e2/e3, motion.base/fast,
ease.standard/entrance). Fraunces for display headings, Schibsted Grotesk for UI/body,
Spline Sans Mono for all numerics (counts, XP, points, thresholds).

ROUTE: /achievements (B2B student behind RequireAuth allow=['student']; B2C consumer reaches
the same component via LearnerContext). Read-only except one "mark-seen" reconciliation write.

LAYOUT (inside AppShell — Sidebar+Topbar on lg, Topbar+Tabbar on mobile; max content 1200,
gutters 16/24/32):
- Header: Fraunces h2 "Your Achievements" + text.secondary count subline ("12 of 40 earned ·
  3 new this week"); a Level strip on the right (LevelBadge + XPMeter + StreakFlame).
- Category filter: single-select Chip row (All/Learning/Consistency/Excellence/Exploration/
  Social/Milestone) with per-category counts; selected chip = brand.primary; horizontally
  scrollable on mobile.
- Section "Earned (n)": grid of Achievement badge cards — full-color icon, title, rarity +
  tier as TEXT Badges, earned date, "+XP" chip. Newly-earned (seen=false) badges get a spark
  "NEW" ring/dot and sort first.
- Section "Keep going (n)": grid of locked Achievement cards — desaturated icon, title, rarity/
  tier Badges (aspirational), a ProgressBar (mastery.inProgress fill) toward criteria.threshold,
  and a motivating remaining sentence ("3 more story points to unlock Scholar"). Sort closest-
  to-unlock first.
Grid: 1-up phones → 2-up md → 3–4-up lg/xl. Tapping a badge opens a Popover (web) / bottom
Sheet (mobile) with full description, the criteria as a human sentence, rarity/tier, points,
and earned date OR remaining threshold.

DOMAIN COMPONENTS (FOUNDATION §5): Achievement (badge + detail variants), CelebrationBurst,
LevelBadge, XPMeter, StreakFlame, plus Chip, Badge, ProgressBar, Section, Card, Popover/Sheet,
EmptyState, Skeleton.

THE ONE CELEBRATORY MOMENT: when the learner first views a newly-earned (seen=false) badge,
fire CelebrationBurst ONCE (spring pop + marigold spark) over it, then write mark-seen
(optimistic — the NEW ring fades with motion.fast). Locked badges NEVER get celebratory motion;
their ProgressBar fills with a plain motion.base grow. Respect prefers-reduced-motion
(degrade burst to a static spark glow + "New!" text).

STATES: skeleton grid (loading); warm new-learner empty ("Your first badge is closer than you
think" — lead with Keep going, omit the 0-of-N headline); per-category empty; no-catalog empty;
partial (locked progress shows "—" if getSummary fails); whole-page ErrorState with Retry.

TONE: warm, aspirational, motivating. Every locked badge is an invitation and a distance-to-
goal ("3 more to unlock"), never a deficiency. No gaps/mistakes surfaced here — pure encouragement.

ACCESSIBILITY: rarity + tier conveyed by ICON + TEXT, never color/tier alone; each badge's
aria-label bundles state+identity+rarity ("Scholar, locked, Rare, Gold tier, 7 of 10 — 3 to
go"); ProgressBar has role="progressbar" + value attrs; Chips are a roving-tabindex radiogroup;
CelebrationBurst is aria-hidden with a polite live-region announcement; WCAG AA contrast.

DATA: all reads/writes via @levelup/api-client (Zod-validated, timestamps epoch-ms; never
firebase/firestore directly): achievements repo (catalog), studentAchievements repo (earned +
seen), v1.analytics.getSummary {scope:'student'} (locked-progress counters), studentLevels (header).
tenantId from the active-tenant claim; B2C resolves to platform_public via LearnerContext.

OUTPUT: a responsive React + Tailwind implementation using the shared-ui components above, the
Lyceum tokens, and the stated states/motion/a11y. No new tokens or component names — use the
Achievement variant prop rather than inventing AchievementBadge/AchievementCard.
```
