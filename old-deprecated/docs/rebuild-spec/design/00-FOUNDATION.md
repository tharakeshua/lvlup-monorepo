# Auto-LevelUp Design System — Foundation ("Lyceum")

> **Single source of truth for every screen spec.** Every per-screen /
> per-feature design spec in `docs/rebuild-spec/design/**` MUST conform to this
> foundation. Do not invent new colors, fonts, spacing, or component variants —
> compose from the tokens and components defined here. If a screen genuinely
> needs something new, add it here first and note it.

---

## 1. Design Direction — "Modern Scholarly"

**One-line:** an editorial, precision-instrument aesthetic — warm tactile
academia meets calm, confident tooling, with a controlled spark of play for
gamification.

**Why:** the platform is both _serious_ (exams, AI grading, confidence-routed
review, multi-tenant admin) and _motivating_ (learning, streaks, XP,
leaderboards). The language must read as **credible and focused** for
teachers/admins, and **warm and encouraging** for students — one system, two
emotional registers, achieved by restraint in chrome and energy in accents.

**Committed extremes (no half-measures):**

- Warm **paper** neutrals (never cool corporate slate, never pure #FFF
  backgrounds).
- A deep **ink** primary (scholarly, not generic SaaS blue #3B82F6).
- A single vivid **marigold "spark"** accent reserved for
  energy/gamification/primary CTAs.
- Characterful **serif display** + clean **grotesque UI** + **mono** for
  numerics.

**Banned (AI-slop filter):** Inter / Roboto / Arial / Space Grotesk as primary;
SaaS blue #3B82F6; purple-on-white gradients; glass morphism; Apple mimicry;
blob backgrounds; evenly-distributed timid palettes.

**Alternative directions (if the team wants to pivot before sessions run):**

- _B — "Quiet Luxe":_ near-monochrome ink + bone, one cold accent,
  ultra-restrained (more premium, less playful — weaker for student
  gamification).
- _C — "Bright Academy":_ lighter, higher-chroma, rounded, toy-like (great for
  K-12 students, too casual for admin/exam gravity). We proceed with **A (Modern
  Scholarly)** unless redirected.

---

## 2. Color Tokens

Two-tier: **primitives** (raw scales) → **semantic** (role-based, themable).
Components reference **semantic only**.

### 2.1 Primitives (hex)

```
/* Paper (warm neutral) */
paper-50:  #FBF8F3   paper-100: #F4EEE4   paper-200: #E8DFD0
paper-300: #D6C9B4   paper-400: #B3A487   paper-500: #8A7B5E
/* Ink (warm charcoal text/structure) */
ink-900:   #1C1A16   ink-800:   #2A2620   ink-700:   #3D382F
ink-600:   #565046   ink-500:   #756E61   ink-400:   #9A9486
/* Indigo (primary brand — deep scholarly blue-violet, NOT SaaS blue) */
indigo-700: #322C63  indigo-600: #423A82  indigo-500: #564BA6  indigo-400: #7A6FC9  indigo-200: #CFC9EC  indigo-50: #EEEBF8
/* Marigold (spark — energy / gamification / CTA glow) */
marigold-600: #C97A14  marigold-500: #E8972B  marigold-400: #F4B45A  marigold-200: #FBE0B0  marigold-50: #FDF4E3
/* Semantic source hues */
green-600: #2F7D5B  green-500: #3EA876  green-200: #BFE6D2   (success / mastered)
amber-600: #B7791F  amber-500: #E0A12E                       (warning / needs-review)
red-600:   #B23A36  red-500:   #D85650  red-200: #F3CFCD    (error / failing / overdue)
sky-600:   #2D6E8E  sky-500:   #3F92B8                       (info / neutral status)
```

### 2.2 Semantic (light theme → dark theme)

```
bg.canvas        paper-50    → ink-900     /* app background */
bg.surface       #FFFFFF*    → ink-800     /* cards, panels  (*warm white #FFFDFA) */
bg.surface-sunken paper-100  → ink-900
bg.inset         paper-100   → #232019
text.primary     ink-900     → paper-100
text.secondary   ink-600     → ink-400
text.muted       ink-500     → ink-500
text.on-accent   #FFFDFA     → #FFFDFA
border.subtle    paper-200   → ink-700
border.strong    paper-300   → ink-600
border.focus     indigo-500  → indigo-400
brand.primary    indigo-600  → indigo-400   /* primary actions, active nav */
brand.primary-hover indigo-700 → indigo-500
spark            marigold-500 → marigold-400 /* XP, streaks, hero CTA accents */
status.success   green-600   → green-500
status.warning   amber-600   → amber-500
status.error     red-600     → red-500
status.info      sky-600     → sky-500
```

### 2.3 Domain color scales (assessment-specific — used platform-wide)

```
confidence.low    red-500     (<0.7  → human review required)
confidence.med    amber-500   (0.7–0.9 → spot-check)
confidence.high   green-500   (>0.9  → auto-accept)
grade.A green-600 · grade.B green-500 · grade.C amber-500 · grade.D marigold-600 · grade.F red-600
mastery.notStarted border.strong · mastery.inProgress indigo-500 · mastery.mastered green-500
xp / streak       spark (marigold) — flame icon uses marigold-500→red-500 gradient
```

**Contrast:** all text/background pairs meet WCAG AA (4.5:1 body, 3:1 large/UI).
Never encode status by color alone — always pair with icon + label.

---

## 3. Typography

**Families** (all Google Fonts, variable):

- **Display / headings:** `Fraunces` (serif, optical-size + soft axis;
  characterful, scholarly). Use for h1–h3, hero numbers, empty-state titles.
- **UI / body:** `Schibsted Grotesk` (humanist grotesque; clean, a little
  warmth). Use for h4–h6, body, labels, buttons, tables.
- **Mono / numeric:** `Spline Sans Mono` (timers, scores, IDs, code, tabular
  data, the scanner pipeline).

**Weights:** Fraunces 400/500/600 (lean on optical size for drama). Schibsted
400/500/600/700. Spline Mono 400/500.

**Scale (1.25 major-third, base 16px):**

```
2xs 11px/16  xs 12px/18  sm 13px/20  base 16px/24  lg 20px/28
xl 25px/32   2xl 31px/38  3xl 39px/46  4xl 49px/54  5xl 61px/64
```

**Tracking:** display ≥31px → -0.02em; body → 0; caption ≤13px → +0.01em. **Body
measure:** 60–72ch. **Math/rich content:** rendered via the single
`ContentRenderer` (Markdown + KaTeX), serif-adjacent for readability.

---

## 4. Spacing · Radius · Elevation · Motion

**Spacing** (4px base):
`0,1=4,2=8,3=12,4=16,5=20,6=24,8=32,10=40,12=48,16=64,20=80,24=96`. Layout uses
flex/grid + `gap`; avoid ad-hoc margins. Page gutters: mobile 16, tablet 24,
desktop 32; max content width 1200 (reading 720).

**Radius:** `sm 6 · md 10 · lg 14 · xl 20 · pill 999`. Cards lg, inputs/buttons
md, chips/badges pill. (Soft but not bubbly.)

**Elevation** (warm-tinted shadows, never pure black):

```
e0 none (use border.subtle)
e1 0 1 2 rgba(28,26,22,.06)                      cards at rest
e2 0 4 12 rgba(28,26,22,.08)                      hover, popovers
e3 0 12 28 rgba(28,26,22,.12)                     modals, command palette
focus ring: 0 0 0 3px indigo @ 35% (border.focus)
spark glow (hero CTA only): 0 6 20 rgba(232,151,43,.30)
```

**Motion** (felt, not seen):

```
instant 100ms  fast 160ms  base 220ms  slow 320ms  page 420ms
ease.standard cubic-bezier(.2,0,0,1)   ease.entrance cubic-bezier(.05,.7,.1,1)
ease.exit cubic-bezier(.3,0,.8,.15)    spring (RN/Reanimated) for gamification pops
```

Respect `prefers-reduced-motion`. Gamification (XP gain, streak, level-up) gets
the ONE celebratory moment — a spring pop + marigold burst — everything else
stays subtle.

**Breakpoints:** `sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536`. Mobile-first.
Touch targets ≥44px.

---

## 5. Core Component Inventory (compose screens from these)

Each component spec must define: anatomy, variants, states
(default/hover/active/focus/disabled/loading), sizes, tokens used, a11y, and
web↔mobile parity note.

**Primitives:** Button (primary/secondary/ghost/danger/spark), IconButton,
Input, Textarea, Select, Combobox, Checkbox, Radio, Switch, Slider, DatePicker,
FileDrop. **Containers:** Card, Panel, Section, Accordion, Tabs, Drawer/Sheet,
Modal/Dialog, Popover, Tooltip. **Data:** DataTable
(sort/filter/paginate/select), DefinitionList, Stat/KPI, Timeline, EmptyState,
Skeleton, Pagination, Avatar/AvatarGroup, Badge, Chip/Tag, ProgressBar,
ProgressRing. **Feedback:** Toast (sonner), InlineAlert/Banner, ConfirmDialog,
FormFieldError, LoadingOverlay. **Navigation:** AppShell (sidebar + topbar),
Sidebar (role-driven nav from route manifest), Topbar (tenant switcher, search,
notifications, profile), Tabbar (mobile), Breadcrumb, CommandPalette (⌘K),
RoleSwitcher (merged mobile apps).

**Domain components (cross-app):** `SpaceCard` · `StoryPointTrack` (the learning
path) · `StoryPointNode` (mastery states) · `ContentRenderer` (md+KaTeX) ·
`QuestionCard` (dispatch over 15 types) · `AnswerInput` (per type) · `TimerBar`
(server-authoritative countdown) · `TestRunnerShell` · `ResultSummary` ·
`RubricBreakdown` · `ConfidenceBadge` · `GradePill` · `ManualOverrideControl` ·
`SubmissionCard` · `ScanFrame` (camera guide) · `UploadQueueItem` (offline
status) · `XPMeter` · `StreakFlame` · `LevelBadge` · `LeaderboardRow` ·
`Achievement` · `AtRiskBadge` · `InsightCard` · `TutorChatBubble` ·
`AnswerKeyLock` (server-only guard visual).

---

## 6. Cross-platform (Web + Mobile) Rule

Tokens are framework-neutral (this file). Web = Tailwind `@theme` reading CSS
custom properties; Mobile (Expo) = NativeWind reading the same token JSON.
Component **names and props match 1:1** between `shared-ui` (web) and
`ui-native` (mobile); only the renderer differs. Every screen spec must state
any web↔mobile divergence (e.g. table on web → stacked cards on mobile; hover →
press; ⌘K → no command palette on mobile).

---

## 7. What each per-screen spec MUST contain

1. **Purpose & primary user** (role + job-to-be-done).
2. **Entry points & route** (and which common-API reads/writes power it —
   reference `specs/common-api.md`).
3. **Layout** — wireframe-as-text (regions, grid, responsive behavior at
   sm/md/lg), referencing AppShell.
4. **Components used** — from §5 only (or propose additions here).
5. **States** — loading (skeleton), empty, error, partial, success;
   permission-gated variations by role.
6. **Interactions & motion** — key flows, feedback, optimistic updates,
   confirmations.
7. **Content & copy** — headings, labels, empty-state and error copy, tone
   (encouraging for students, precise for staff).
8. **Domain rules surfaced** — e.g. answer-key never shown to students;
   confidence routing; timer is server-authoritative; tenant isolation.
9. **Accessibility** — focus order, keyboard, aria, contrast, reduced-motion.
10. **Web↔mobile divergence**.
11. **A Claude-design prompt** — a ready-to-paste prompt block (referencing this
    foundation) the team can drop into Claude on web to generate the screen.

Output path: `docs/rebuild-spec/design/<area>/<screen-slug>.md`. Keep specs
concrete and self-contained but anchored to this foundation by reference (don't
re-paste tokens — cite them).
