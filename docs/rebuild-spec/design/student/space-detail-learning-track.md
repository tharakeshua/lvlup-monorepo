# Space Detail — Learning Track

> **Lyceum** design system spec (Direction A — "Modern Scholarly"). Conforms to
> `docs/rebuild-spec/design/00-FOUNDATION.md`. Cite tokens by semantic name; do
> not invent colors/fonts/spacing/radii/shadows/motion or component variants.
> Student tone: warm, encouraging, a _journey_, never punitive.

---

## 1. Purpose & primary user

**Primary user:** the **learner** — a B2B school **student** (role `student`,
tenant-scoped) _or_ a B2C **consumer** learner (no membership, served from the
synthetic `platform_public` tenant). One screen, two data sources, identical UX.

**Job-to-be-done:** _"Show me the path through this space, where I am on it, and
the single most helpful next step — and make my progress feel like momentum."_
The student lands here from their dashboard or spaces list to (a) see the
ordered learning track and each node's mastery state, (b) jump into the right
node (learn / practice / timed test) by its type, (c) understand their shape of
strengths and gaps via **Insights**, and (d) for store/consumer spaces, read and
leave a review.

This is the home of the **signature** `StoryPointTrack` component — the visual
spine of the entire learner product. Getting mastery state _legible_ (icon +
label + color, never color alone) and the journey _motivating_ is the whole
point of the screen.

---

## 2. Entry points & route

**Route (B2B):** `/spaces/:spaceId` **Route (B2C):** `/consumer/spaces/:spaceId`
— same page component, resolved through `LearnerContext` (data source = tenant
vs `platform_public`); route on context, not path prefix (see
`webapps-design.md` §5.2).

**Entry points:**

- Student Dashboard → space cards ("Continue") and recommendations.
- Spaces List (`/spaces`) → `SpaceCard` tap.
- Store Detail (`/store/:spaceId`) → after purchase/enroll, consumer lands here.
- Deep link / CommandPalette (⌘K) "Go to space…".

**Reads (via `@levelup/api-client` repos + callable registry — UI never touches
Firestore):**

- `v1.levelup.getSpace` → space title, description, ratingAggregate,
  store/listing flags.
- `v1.levelup.listStoryPoints` → ordered `StoryPoint[]` (by `orderIndex`) with
  `type`, `stats`, `difficulty`, `assessmentConfig`.
- `v1.levelup.getSpaceProgress` → `SpaceProgress` (overall `percentage`,
  `pointsEarned`/`totalPoints`, per-story-point summary map).
- `v1.levelup.getStoryPointProgress` → per-node `StoryPointProgress` (`status`
  notStarted/inProgress/completed, `percentage`, `completedItems`/`totalItems`,
  `pointsEarned`) — lazily fetched per node or batched with the space-progress
  read.
- **Insights** tab: `v1.analytics.getSummary` (`scope: 'student'`) for real
  signals (weakest/strongest area, completion). Where analytics is unavailable,
  fall back to **honestly-labeled client heuristics** (see §7/§8) — never
  labeled "AI".

**Writes:**

- `v1.levelup.saveSpaceReview` → student rating + review for store/consumer
  spaces (`SpaceReviewSection`).

> Per `common-api.md` §4.4 `tenantId` is derived from the caller's active-tenant
> claim server-side, not passed in the request body. Responses are Zod-validated
> and timestamps normalized to epoch-ms at the repo edge.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (Sidebar + Topbar on `lg`; **Tabbar** at the bottom
on mobile). Page gutters per FOUNDATION §4 (mobile 16 / tablet 24 / desktop 32);
content column capped at max content width with the track itself reading
comfortably (~720 reading measure for descriptions).

```
┌─ AppShell ───────────────────────────────────────────────────────────────┐
│ Topbar: tenant switcher · ⌘K search · notifications · profile            │
│ Sidebar (lg): Dashboard / My Spaces* / Tests / Leaderboard / Profile      │
├───────────────────────────────────────────────────────────────────────────┤
│  Breadcrumb:  Spaces  ›  {Space title}                                    │
│                                                                           │
│  ┌─ HERO HEADER ───────────────────────────────────────────────────────┐ │
│  │ H1 (Fraunces) {Space title}                                         │ │
│  │ {Space description}  (text.secondary, ≤72ch)                        │ │
│  │ ┌─ Journey summary row (flex, wraps at sm) ───────────────────────┐ │ │
│  │ │ [ProgressBar "Your journey" 0–100%]   [XPMeter pts ⟡]  [▶ Resume]│ │ │
│  │ └─────────────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ┌─ Tabs ──────────────────────────────────────────────────────────────┐ │
│  │ [ Contents ]  [ Overview ]  [ Insights ]                            │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ── Tab: CONTENTS ──────────────────────────────────────────────────────  │
│   StoryPointTrack  (vertical spine, the signature component)             │
│    ● ─ StoryPointNode  [✓ Mastered]   {title} · {type chip} · {pts}      │
│    │                                                                      │
│    ◐ ─ StoryPointNode  [◐ In progress 60%]  {title} · {chip} · {min}     │
│    │      ↳ ProgressBar (sm) for standard/quiz nodes                     │
│    ○ ─ StoryPointNode  [○ Not started]  {title} · {chip}  [Start →]      │
│    │      ↳ timed_test node shows AnswerKeyLock + TimerBar preview hint  │
│    ○ ─ StoryPointNode  …                                                  │
│                                                                           │
│  ── Tab: OVERVIEW ──────────────────────────────────────────────────────  │
│   [Stat: Modules] [Stat: Items] [Stat: Points]  (grid, 3-up ≥sm)         │
│   Panel "Module types" — type → completed/total ProgressBar rows         │
│   Panel "Difficulty mix" — SimpleBarChart easy/medium/hard/expert        │
│                                                                           │
│  ── Tab: INSIGHTS ──────────────────────────────────────────────────────  │
│   [InsightCard Completion] [InsightCard Strongest] [InsightCard Focus]   │
│   Panel "How you're doing" — per-node score rows (ProgressBar)           │
│   Honesty caption: "Real analytics" | "Estimated from your progress"     │
│                                                                           │
│  ┌─ SpaceReviewSection (store/consumer spaces only) ──────────────────┐  │
│  │ ★ aggregate · "Rate this journey" · your review · others' reviews  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
* "My Spaces" / "My Learning" label depends on B2B vs B2C nav.
```

**Responsive behavior:**

- **`< sm` (640):** single column. Hero summary row stacks (ProgressBar
  full-width, then XPMeter, then a full-width **Resume** button). Tabs become a
  horizontally scrollable / segmented control. `StoryPointTrack` renders as a
  single vertical spine of full-width `StoryPointNode` cards (press, not hover).
  Overview stats stack 1-up; Insight cards stack 1-up.
- **`sm–md` (640–1024):** hero summary row goes horizontal (progress left,
  points + Resume right, `sm:items-end`). Overview stats 3-up; Insight cards
  2-up. Track stays single-column spine (it is intentionally a path, not a
  grid).
- **`≥ lg` (1024):** Sidebar visible; content column constrained to max content
  width and left-aligned within the reading column; the track spine sits at the
  left with node detail to its right. Hover affordances active on nodes.

---

## 4. Components used (FOUNDATION §5 only)

**Domain components:**

- `StoryPointTrack` — the ordered learning path on the **Contents** tab (the
  signature component).
- `StoryPointNode` — one node per story point; renders mastery state + type
  chip + routes on tap.
- `XPMeter` — points earned / total in the hero (`spark`-accented).
- `InsightCard` — the three Insights summary cards (completion / strongest /
  focus).
- `AnswerKeyLock` — on `timed_test`/`test` nodes, makes the absence of answers
  legible before a test is taken.
- `TimerBar` — _preview-only_ affordance on timed nodes (duration hint, not a
  live countdown here).
- `GradePill` — optional score badge on completed assessment nodes
  (post-submission %).
- `CelebrationBurst` — the ONE celebratory moment, fired only at 100% space
  completion.

**Containers / data / navigation:**

- `AppShell`, `Sidebar`, `Topbar`, `Tabbar`, `Breadcrumb`, `CommandPalette`
  (shell).
- `Tabs` (Contents / Overview / Insights), `Panel`, `Card`, `Section`.
- `ProgressBar` (journey + per-node), `Stat/KPI` (Overview),
  `SimpleBarChart`/`ProgressRing` (difficulty mix), `Chip/Tag` (node type +
  difficulty), `Badge`.
- `Button` (primary `Resume` / `Start`, secondary `Retry`), `Skeleton`,
  `EmptyState`, `ErrorState`, `Avatar` (reviews), `Toast` (review saved).
- `ContentRenderer` — for any markdown/math in the space or node description.
- `SpaceReviewSection` (composes Avatar + rating Stars + Textarea + Button) for
  store/consumer spaces.

**Proposed FOUNDATION additions:** _None required._ Two notes for the foundation
maintainers:

1. **`StoryPointNode` mastery-state vocabulary alignment.** FOUNDATION §2.3
   names mastery states `notStarted / inProgress / mastered`. The progress
   domain model (`progress.ts`) persists
   `ProgressStatus = not_started | in_progress | completed`. These must map 1:1
   at the repo/presentation edge: `not_started→notStarted`
   (`mastery.notStarted`, `border.strong`, hollow-circle icon, label "Not
   started"), `in_progress→inProgress` (`mastery.inProgress`, `indigo-500`,
   half-filled icon, label "In progress"), `completed→mastered`
   (`mastery.mastered`, `green-500`, check icon, label "Mastered"). No new token
   — just a documented mapping so the node never invents a fourth state.
2. **`TimerBar` "preview" presentation mode.** This screen needs a _static_
   duration hint on timed nodes (e.g. "30 min · timed"), not the live
   server-authoritative countdown. If `TimerBar` does not already expose a
   non-running/preview variant, add one to its variant list in §5 rather than
   fabricating a bespoke chip here.

---

## 5. States

**Loading (skeleton):** breadcrumb + an `h1`-height `Skeleton`, a
description-line `Skeleton`, a journey-bar `Skeleton`, then 3–5 node-height
`Skeleton` rows in the `StoryPointTrack` shape (rounded `radius.lg`,
`bg.surface-sunken`). Tabs render immediately with skeleton content beneath so
the chrome doesn't jump.

**Empty (no story points yet):** `EmptyState` inside the Contents tab —
`BookOpen`-style glyph, Fraunces title, warm copy (§7), and a secondary `Button`
"Back to spaces". Insights/Overview tabs show their own gentle empty copy rather
than zeroed charts.

**Error (space load failed):** `ErrorState` (distinct from empty) —
`status.error` accent border/icon, message + a secondary **Try again** `Button`
that re-runs `getSpace`/`listStoryPoints`. Per-tab data errors (e.g. progress or
analytics fetch fails) degrade gracefully: the track still renders from
`listStoryPoints`, nodes show "Not started" rather than a hard error, and
Insights shows an inline `InlineAlert` "We couldn't load your insights right
now."

**Partial:** track renders from `listStoryPoints` even before `getSpaceProgress`
resolves (nodes optimistic-default to `notStarted`); the journey `ProgressBar`
shows a subtle indeterminate shimmer until progress arrives, then animates to
the real value. Per-node progress hydrates as `getStoryPointProgress` resolves
(skeleton → real state).

**Success:** full track with correct mastery states, hero progress + `XPMeter`,
**Resume**/Start targeting the first non-`mastered` node, Insights populated. At
exactly `overallPercentage === 100`, fire `CelebrationBurst` once (guarded so it
never re-fires on tab switch / refetch).

**Permission / role-gated variations:**

- **B2B student:** tenant-scoped reads; `SpaceReviewSection` hidden unless the
  space is a store/listed space.
- **B2C consumer:** `platform_public` reads via `LearnerContext`;
  `SpaceReviewSection` always shown for store spaces; review write enabled only
  if the learner is enrolled/purchased.
- **Space not found / not published / unenrolled consumer:** `EmptyState` "This
  space isn't available" with a route back to Spaces/Store. Never expose
  draft/unpublished content.

---

## 6. Interactions & motion

**Open a node:** tap/click a `StoryPointNode` → route by `type`:
`timed_test`/`test` → `/spaces/:spaceId/test/:storyPointId`; `practice` →
`/spaces/:spaceId/practice/:storyPointId`; everything else (`standard`/`quiz`) →
`/spaces/:spaceId/story-points/:storyPointId`. Hover (web) lifts the node
`e1 → e2` over `motion.fast`; press (mobile) uses a subtle scale on
`motion.instant`. Focus ring = `border.focus`.

**Resume / Start:** the hero `Button` deep-links to the first non-`mastered`
node (computed from progress). On `lg` it sits inline; on mobile it's full-width
below the journey bar. Active node on the track gets a soft `indigo-500`
highlight to connect "Resume" to its target.

**Tab switch:** Contents / Overview / Insights crossfade content over
`motion.base` with `ease.standard`; tab indicator slides over `motion.fast`. No
layout shift in the chrome.

**Journey progress fill:** the hero `ProgressBar` animates from 0 to the real
`percentage` over `motion.slow` `ease.entrance` on first load (felt, not
flashy). Per-node `ProgressBar`s animate on hydrate.

**The one celebratory moment (gamification):** when `overallPercentage` reaches
**100%**, fire `CelebrationBurst` exactly once — spring pop + marigold `spark`
burst (FOUNDATION §4 + §7 rule). The final node visibly flips to **Mastered**;
the `XPMeter` ticks to full. This is the _only_ celebratory burst on this screen
— never scatter it onto tab switches, node opens, or review submits.

**Review submit (`SpaceReviewSection`):** optimistic — the learner's stars/text
appear immediately; on `saveSpaceReview` success a `Toast` ("Thanks for sharing
— this helps other learners"); on failure, revert + `Toast` error with retry.
Star selection animates on `motion.fast`.

**Confirmations:** none destructive here. Leaving mid-action needs no confirm
(this is a read/navigation surface).

**Reduced motion:** all of the above respect `prefers-reduced-motion` — progress
bars snap to value, crossfades become instant, and `CelebrationBurst` degrades
to a single static "Space complete!" badge with no particle motion.

---

## 7. Content & copy (warm / encouraging student tone)

**Hero:**

- H1: `{Space title}` (Fraunces).
- Journey bar label: **"Your journey"** (not "Overall progress").
- Points: `XPMeter` reads `{pointsEarned} / {totalPoints} pts`.
- Resume button: **"Resume"** mid-journey; **"Start learning"** at 0%; hidden at
  100% (replaced by a calm **"You've completed this space 🎉"** line —
  celebratory but not loud).

**Tabs:** `Contents` · `Overview` · `Insights` (Insights is the **renamed**
former "AI Analytics" — never label client heuristics as AI).

**StoryPointNode mastery labels (icon + label + color, never color alone):**

- Not started → **"Not started"** (hollow circle, `mastery.notStarted`).
- In progress → **"In progress · {pct}%"** (half-filled, `mastery.inProgress`).
- Mastered → **"Mastered"** (check, `mastery.mastered`).
- Type chips: **Learning** / **Timed test** / **Test** / **Quiz** /
  **Practice**.
- Timed node hint: **"{n} min · timed"** + `AnswerKeyLock` microcopy on
  hover/focus: **"Answers stay sealed until you finish."**

**Contents empty state:** title **"This journey is still being built"**; body
**"Your teacher is adding content here. Check back soon — it'll be worth the
wait."** (B2C variant: "New content is on the way.").

**Overview headings:** **"Modules"**, **"Total items"**, **"Total points"**;
panels **"What's in this space"** and **"Difficulty mix"**.

**Insights headings:**

- Completion card: **"You've completed {x}%"**.
- Strongest card: **"Your strong suit: {module}"**.
- Focus card: **"Let's look at this one again: {module}"** (growth framing —
  never "Weakest" / "Wrong").
- Recommendation lines (warm, specific): at 100% → **"Beautiful work — you've
  finished every module here."**; ≥75% → **"So close — just {n} module{s} to
  go."**; ≥25% → **"Nice momentum. Next up: {next module}."**; <25% → **"Let's
  begin with the first module and build from there."**
- **Honesty caption (required):** when signals come from
  `v1.analytics.getSummary` → **"Based on your real activity."**; when from
  client heuristics → **"Estimated from your progress so far."** Never imply AI
  when it's a heuristic.

**Error copy:** **"We couldn't load this space."** + body **"It's not you —
let's try that again."** + **"Try again"**. Insights inline error: **"Insights
are taking a break — your track is still here whenever you're ready."**

**Reviews:** prompt **"How was this journey?"**; submit **"Share review"**;
thanks toast **"Thanks for sharing — this helps other learners."**

---

## 8. Domain rules surfaced

- **Answer-key is never shown.** Timed/test nodes (`timed_test`/`test`) surface
  `AnswerKeyLock` with "Answers stay sealed until you finish." Correct answers
  live in the server-only `answerKeys` subcollection that `firestore.rules`
  denies to all clients — the client _cannot_ read them. This screen never
  reveals correctness or stored answers for an unstarted/locked node;
  post-submission scores shown here come only from server-returned progress
  (`GradePill` %), never raw keys.
- **Timer is server-authoritative.** Any timer affordance on this screen is a
  _static preview_ ("30 min · timed"); the live countdown is server-derived
  (`serverDeadline` + RTDB `.info/serverTimeOffset`) and lives on the Timed Test
  screen. The client clock never decides expiry — make clear the countdown
  begins (and is trusted) only inside the test.
- **Gamification = the one celebratory moment.** `CelebrationBurst` fires _only_
  at 100% space completion. No bursts on node opens, tab switches, or reviews.
- **Insights honesty.** The renamed tab must label its source: real
  `v1.analytics` signals vs client heuristics. Resolves status-report finding
  #16 ("AI Analytics is not AI").
- **Tenant isolation / B2B vs B2C.** Reads are tenant-scoped
  (`tenants/{tenantId}/...`) for students; consumer reads come from
  `platform_public` + `user.consumerProfile`, resolved by `LearnerContext`. The
  page never reads another tenant's space.
- **API seam.** All reads/writes go through `@levelup/api-client`
  (`v1.levelup.getSpace`/`listStoryPoints`/`getSpaceProgress`/`getStoryPointProgress`/`saveSpaceReview`,
  `v1.analytics.getSummary`); UI never imports `firebase/firestore` or builds
  collection paths. Responses Zod-validated; timestamps epoch-ms.
- **Mastery legibility.** Every node state is conveyed by **icon + label +
  color** together (FOUNDATION §2 "never encode status by color alone").

---

## 9. Accessibility

- **Focus order:** Breadcrumb → H1 region → Resume/Start button → Tabs
  (arrow-key roving tablist) → within active tab, the `StoryPointTrack` nodes
  top-to-bottom (each node is a single focusable link) → review section
  controls.
- **Tablist:** `role="tablist"` with `aria-selected`, `Tab`/`Shift+Tab` to
  enter/leave, `←/→` to move between tabs (Radix Tabs semantics).
- **StoryPointTrack:** rendered as an ordered list (`<ol>`/`role="list"`) so the
  path order is announced; each `StoryPointNode` is a link with an `aria-label`
  combining title + type + mastery state + percent, e.g. _"Arrays and Hashing,
  timed test, in progress, 60 percent. Activate to open."_ Mastery is conveyed
  in text and icon, not color alone (WCAG AA, and color-blind safe).
- **Contrast:** all text/background pairs meet WCAG AA (4.5:1 body, 3:1
  large/UI) per FOUNDATION §2; `spark`/`mastery` colors are paired with labels
  for the 3:1 UI rule.
- **Icon buttons** (Resume, Retry) carry `aria-label`s; the `XPMeter` exposes an
  accessible text value.
- **AnswerKeyLock** has accessible text ("Answers sealed until you finish") so
  screen-reader users understand why no answer is shown.
- **Reduced motion:** honor `prefers-reduced-motion` — snap progress bars,
  instant tab transitions, and a static "Space complete!" badge instead of
  `CelebrationBurst` particles.
- **RouteAnnouncer** announces the space title on navigation; **SkipToContent**
  present from `AppShell`.

---

## 10. Web ↔ mobile divergence (FOUNDATION §6)

- **Shell:** web shows Sidebar + Topbar; mobile uses the bottom **Tabbar** (My
  Spaces / Tests / Leaderboard / Profile) and a compact top bar.
- **Hover → press:** node `e1→e2` hover lift on web becomes a press-scale on
  `motion.instant` for mobile touch; touch targets ≥44px.
- **⌘K absent on mobile:** CommandPalette is web-only; mobile reaches spaces via
  Tabbar + search field.
- **Tabs:** the Contents/Overview/Insights `Tabs` become a horizontally
  scrollable segmented control on small screens.
- **Track layout:** identical single-column vertical spine on both (it's
  deliberately a path, not a responsive grid) — only node chrome (hover vs
  press) and gutter sizes differ. Component **names and props match 1:1**
  between `shared-ui` (web) and `ui-native` (mobile); only the renderer differs.
- **CelebrationBurst:** web uses confetti/particle variant; RN uses the
  Reanimated spring variant — same trigger contract (100% completion), same
  reduced-motion fallback.
- **Reviews:** identical `SpaceReviewSection` contract; the text input uses the
  platform-native keyboard on mobile.

---

## 11. Claude-design prompt (ready to paste)

```
You are designing the **Space Detail — Learning Track** screen for the Auto-LevelUp
STUDENT (learner) web app, conforming to the "Lyceum" design system (Direction A —
"Modern Scholarly"). Read and obey docs/rebuild-spec/design/00-FOUNDATION.md. Do NOT
invent colors, fonts, spacing, radii, shadows, motion, or component variants — compose
only from FOUNDATION §2/§3/§4/§5 and reference tokens by their semantic names
(bg.canvas, bg.surface, text.primary/secondary, brand.primary, spark, border.subtle/focus,
mastery.notStarted/inProgress/mastered, status.error, radius.lg, e1/e2, motion.base/fast/slow).
Fonts: Fraunces (display/h1, "journey"/empty titles), Schibsted Grotesk (UI/body/labels),
Spline Sans Mono (points, percentages, minutes).

ROLE & TONE: a learner (B2B student OR B2C consumer). Warm, encouraging, journey-framed.
Never punitive — "Let's look at this one again", not "Wrong". Celebrate progress.

BUILD this screen inside AppShell (Sidebar + Topbar on lg; bottom Tabbar on mobile):
- Breadcrumb: Spaces › {Space title}.
- HERO: Fraunces H1 {title}; secondary description (≤72ch via ContentRenderer); a summary row
  with a "Your journey" ProgressBar (0–100%, animates over motion.slow on load), an XPMeter
  ({pointsEarned}/{totalPoints} pts, spark-accented), and a primary Resume button (→ first
  non-mastered node; "Start learning" at 0%; hidden at 100%, replaced by a calm completion line).
- Tabs: Contents | Overview | Insights (crossfade over motion.base).
  • CONTENTS = the signature StoryPointTrack: an ordered vertical spine of StoryPointNode cards.
    Each node shows mastery state by ICON + LABEL + COLOR together (never color alone):
    Not started (hollow circle, mastery.notStarted), In progress · {pct}% (half-filled,
    mastery.inProgress), Mastered (check, mastery.mastered). Each node has a type Chip
    (Learning / Timed test / Test / Quiz / Practice), stats (items · pts · {min}), and routes
    on tap by type: timed_test/test → /test, practice → /practice, else → /story-points.
    Timed/test nodes show an AnswerKeyLock ("Answers stay sealed until you finish") and a static
    TimerBar preview ("{n} min · timed") — NOT a live countdown.
  • OVERVIEW = three Stat cards (Modules / Total items / Total points) + a "What's in this space"
    panel (type → completed/total ProgressBar rows) + a "Difficulty mix" SimpleBarChart.
  • INSIGHTS (renamed from "AI Analytics" — never call heuristics AI): three InsightCards
    (Completion, "Your strong suit", "Let's look at this one again"), a per-node score panel,
    and a REQUIRED honesty caption: "Based on your real activity." (analytics) or
    "Estimated from your progress so far." (heuristic).
- SpaceReviewSection for store/consumer spaces only (stars + review; optimistic submit + Toast).

DATA (via @levelup/api-client — never Firebase directly): v1.levelup.getSpace, listStoryPoints,
getSpaceProgress, getStoryPointProgress; v1.analytics.getSummary(scope:'student') for Insights;
v1.levelup.saveSpaceReview for ratings. Map ProgressStatus not_started/in_progress/completed →
mastery notStarted/inProgress/mastered.

STATES: skeleton (track-shaped rows), empty ("This journey is still being built"), error
("We couldn't load this space — it's not you — let's try that again" + Try again), partial
(track renders before progress; bars hydrate), success. CelebrationBurst fires ONCE at 100%
space completion only (spring pop + marigold spark) — the single gamification moment; reduced-
motion → static "Space complete!" badge. No bursts anywhere else.

A11Y: StoryPointTrack as an ordered list; each node a link with aria-label combining title +
type + mastery state + percent; roving-tabindex tablist; WCAG AA contrast; honor
prefers-reduced-motion. RESPONSIVE: single column < sm (stacked summary, full-width Resume,
scrollable tabs); 3-up stats / 2-up insights ≥ sm; Sidebar at lg. Hover-lift (e1→e2) on web,
press-scale on mobile; ⌘K web-only.

Deliver clean, accessible React + Tailwind composing the FOUNDATION §5 components
(StoryPointTrack, StoryPointNode, XPMeter, InsightCard, AnswerKeyLock, TimerBar, GradePill,
CelebrationBurst, Tabs, ProgressBar, Stat, SimpleBarChart, EmptyState, ErrorState, Skeleton,
SpaceReviewSection) — tokens by semantic name only.
```
