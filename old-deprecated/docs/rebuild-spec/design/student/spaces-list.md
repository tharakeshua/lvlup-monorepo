# Student — My Spaces (List)

> Conforms to **Lyceum** (Direction A — "Modern Scholarly"). See
> `../00-FOUNDATION.md`. Tokens cited by semantic name; never re-pasted. Student
> tone: warm, encouraging, human.

---

## 1. Purpose & primary user

**Primary user:** a **learner** — either a B2B school **student**
(tenant-scoped, role `student`) or a B2C **consumer** learner (no tenant
membership, served from the synthetic `platform_public` tenant).

**Job-to-be-done:** "Show me everything I'm learning right now, where I left
off, and let me jump back into the space I want to make progress in." This is
the learner's home base for their published spaces — a glanceable map of
progress that motivates the next session, not a punitive scorecard.

---

## 2. Entry points & route

**Route (B2B):** `/spaces` → `SpacesListPage`. Also reachable from the Sidebar
("My Spaces"), the Dashboard "Continue learning" rail, and the mobile Tabbar.
**Route (B2C analog):** `/my-spaces` (and the enrolled-spaces region of
`/consumer`) → the same page composed under `ConsumerLayout`. Routing is
resolved by **`LearnerContext`** (B2B tenant vs B2C `platform_public`), not by
path prefix — one page, one component, context-injected data source (per
`webapps-design.md` §5.2 key fixes).

**Reads (all via `@levelup/api-client`, Zod-validated, timestamps epoch-ms at
the repo edge — UI never touches Firestore):**

- `v1.levelup.listSpaces` — the learner's **published** spaces. B2B:
  tenant-scoped + filtered to the student's class assignments (`classIds` from
  membership). B2C: scoped to `platform_public`, filtered to
  `consumerProfile.enrolledSpaceIds`. (Replaces today's raw
  `tenants/{platform_public}/spaces` `where(__name__, in, …)` batched query in
  `ConsumerDashboardPage`.)
- `v1.levelup.getSpaceProgress` with `scope: allSpaces` — the per-space
  mastery/percentage map keyed by `spaceId`, powering each card's progress
  ring + last-activity. (Today: `useAllSpaceProgress`.)

**Writes:** none. This screen is read-only navigation. (Enrollment/purchase
happens in Store; assignment happens in teacher-web.)

**Query keys:** hierarchical factory — `spaceKeys.list(ctx)` and
`progressKeys.allSpaces(ctx, learnerId)`; `enabled` gated on a resolved
`LearnerContext`.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (B2B: Sidebar + Topbar; B2C: ConsumerLayout shell
with My Learning / Store / Cart / Profile nav). Page gutters per FOUNDATION §4
(mobile 16 / tablet 24 / desktop 32), max content width 1200.

```
┌─ AppShell (Sidebar | Topbar: search ⌘K · notifications · profile) ──────────┐
│                                                                              │
│  ┌─ Page header ─────────────────────────────────────────────────────────┐  │
│  │  H1 "My Spaces"                          [ subtle count: "6 spaces" ]   │  │
│  │  one-line warm subhead (context-aware, B2B vs B2C)                      │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─ Filter / sort bar (sticky-ish, gap-2) ───────────────────────────────┐  │
│  │  Chip: All · Chip: <Subject…>   |   Sort ▾ (Recently active ·          │  │
│  │  Progress · A–Z)                                  [B2C only: Browse →]  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─ SpaceCard grid ──────────────────────────────────────────────────────┐  │
│  │  [SpaceCard] [SpaceCard] [SpaceCard]                                    │  │
│  │  [SpaceCard] [SpaceCard] [SpaceCard]                                    │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Responsive grid (CSS grid, `gap-6` desktop / `gap-4` mobile):**

- **< sm (640):** single column, full-width SpaceCards. Filter chips
  horizontally scroll; sort collapses to an IconButton that opens a Sheet.
- **sm–md (640–1023):** 2 columns.
- **≥ lg (1024):** 3 columns. **≥ xl (1280):** still 3 (cards widen, never 4 —
  preserves the 60–72ch readable title/description).

**SpaceCard anatomy** (FOUNDATION §5 domain component): optional thumbnail
header → **type tag** (learning / practice / assessment / hybrid) + **difficulty
chip** → title (Fraunces, lg) → 1–2 line description (Schibsted, secondary) →
meta row (subject · story-point count · rating) → footer: **ProgressRing**
(mastery) + last-activity timestamp ("2 days ago", `text.muted`, mono for the
relative numeral where applicable). Whole card is one link/press target.

---

## 4. Components used (FOUNDATION §5 only)

- **AppShell**, **Sidebar**, **Topbar**, **Tabbar** (mobile), **CommandPalette**
  (⌘K, web only) — navigation.
- **SpaceCard** (domain) — the grid unit.
- **ProgressRing** (data) — mastery percentage on each card; ring color from the
  **mastery** scale (`mastery.notStarted` / `mastery.inProgress` /
  `mastery.mastered`). At 100% the ring reads `mastery.mastered`.
- **Chip/Tag** (data) — subject filters (multi/single-select) **and** per-card
  type tag + difficulty chip. Type tag color: neutral `border.subtle` chrome
  with an icon per type (learning/practice/assessment/hybrid) — never
  status-by-color-alone.
- **Select** (primitive) — the Sort control (Recently active · Progress · A–Z).
- **Badge** (data) — small space count next to the H1.
- **EmptyState** (data) — the no-spaces variants (B2B vs B2C).
- **ErrorState** (data, distinct from empty) — load failure with Retry.
- **Skeleton** (data) — loading grid.
- **Button** (primitive) — `spark` CTA "Explore the Store" (B2C empty), `ghost`
  Retry.

**Proposed FOUNDATION additions:** none. (The Topbar/Sidebar search already
covers find-by-name; no new component is required. Card hover-prefetch is
behavior, not a component.)

---

## 5. States

- **Loading (skeleton):** H1 renders immediately; below it a grid of 3–6
  **Skeleton** cards matching SpaceCard footprint (thumbnail block + two text
  lines + a ring placeholder). No layout shift when data arrives. Spaces and
  progress load independently — render cards as soon as `listSpaces` resolves;
  show a small spinner inside each **ProgressRing** until
  `getSpaceProgress(allSpaces)` lands (see Partial).
- **Empty — B2B student:** **EmptyState** with the BookOpen-family illustration.
  Heading "No spaces yet" + warm body: _"Your teacher hasn't assigned any
  learning spaces to your class yet. Check back soon — they'll show up here the
  moment they do."_ No CTA (the student can't self-enroll).
- **Empty — B2C consumer:** **EmptyState** with heading "Start your first
  space" + body: _"You haven't added any learning spaces yet. Browse the store
  to find something that excites you."_ + `spark` **Button** "Explore the Store"
  → `/store`. (Context-gated by `LearnerContext`.)
- **Empty after filtering:** if spaces exist but the active subject/sort filter
  yields none: lighter inline **EmptyState** — _"No spaces match this filter.
  Try 'All' to see everything."_ + a "Clear filter" ghost action. (Never the
  cold no-spaces copy.)
- **Error:** **ErrorState** (not EmptyState) — heading "We couldn't load your
  spaces" + body "Check your connection and try again." + ghost **Button**
  "Retry" → `refetch`. If `listSpaces` succeeds but `getSpaceProgress` fails, do
  **not** error the whole page — show cards with neutral `mastery.notStarted`
  rings and a quiet inline note (see Partial).
- **Partial:** spaces present, progress still loading or failed → cards show a
  muted ring + "Progress syncing…" microcopy; never block the grid on progress.
- **Success:** populated, filterable, sortable grid.

**Permission/role-gated variations:** the only branch is **B2B vs B2C** via
`LearnerContext` (data source, empty copy, optional Browse-Store CTA). There is
no in-grid role gating beyond published+assigned scoping done server-side in
`listSpaces`.

---

## 6. Interactions & motion

- **Card hover/press:** elevation rises `e1 → e2` over `motion.fast` with
  `ease.standard`; on web, hover also **prefetches** the SpaceViewer chunk +
  that space's items/progress (per the prefetch map). On mobile, press uses a
  subtle scale/opacity press state (no hover). Tapping anywhere on the card
  navigates to `/spaces/:spaceId`.
- **Filter (Chip):** selecting a subject chip filters the grid client-side;
  cards re-flow with a subtle `motion.base` layout transition (`ease.standard`).
  Active chip uses `brand.primary` fill + `text.on-accent`.
- **Sort (Select):** changing sort re-orders cards with the same subtle layout
  transition. "Recently active" is the default — most-recent last-activity
  first, so the next session is one tap away.
- **Progress arriving:** when `getSpaceProgress` resolves, each **ProgressRing**
  animates from 0 (or its skeleton) to its value over `motion.base`. This is a
  **calm** progress reveal — **NOT** a celebratory burst.
- **100% completion:** a space at full mastery shows the `mastery.mastered`
  ring + a small "Completed" tag. The celebratory **CelebrationBurst** (spring
  pop + marigold `spark` burst) is the _gamification one-moment_ and fires when
  a space is _first_ completed — that happens on the SpaceViewer/result surface,
  **not** here on revisit. This list never re-fires bursts. Respect
  `prefers-reduced-motion` (rings cross-fade instead of sweep; no spring).
- **No optimistic writes** (read-only screen). Retry is the only
  mutcall-adjacent action and simply re-runs the query.

---

## 7. Content & copy

- **H1:** "My Spaces" (B2B) / "My Learning" (B2C).
- **Subhead (B2B):** "Pick up where you left off." (Or, if a streak is active,
  the Dashboard owns streak copy — keep this header calm.)
- **Subhead (B2C):** "Everything you're learning, in one place."
- **Count badge:** "6 spaces" (singular "1 space").
- **Filter labels:** "All", then subject names; Sort options: "Recently active",
  "Progress", "A–Z".
- **Card meta:** "{n} story points" · subject · "★ {rating}" (only if reviews
  exist) · "Last opened {relative}".
- **Card type tags:** "Learning", "Practice", "Assessment", "Hybrid".
  Difficulty: "Beginner / Intermediate / Advanced" (match space difficulty
  field).
- **Progress phrasing on card (aria + tooltip):** "{percentage}% mastered" —
  framed as growth, never "{x}% incomplete".
- **Empty (B2B):** "No spaces yet" / "Your teacher hasn't assigned any learning
  spaces to your class yet. Check back soon — they'll show up here the moment
  they do."
- **Empty (B2C):** "Start your first space" / "You haven't added any learning
  spaces yet. Browse the store to find something that excites you." — CTA
  "Explore the Store".
- **Empty (filtered):** "No spaces match this filter." — action "Clear filter".
- **Error:** "We couldn't load your spaces" / "Check your connection and try
  again." — action "Retry".
- **Tone:** mistakes/zero-progress are never scolded; an unstarted space reads
  "Ready when you are" in its ring tooltip, not "Not started / 0%".

---

## 8. Domain rules surfaced

- **Answer-key never shown:** N/A to surface directly here (no questions
  rendered), but this list links **into** assessment-type spaces. The list shows
  only completion/mastery, never correctness of any item. (The **AnswerKeyLock**
  visual lives downstream in the test runner, not here.)
- **Timer is server-authoritative:** not exercised on this screen, but
  assessment-type cards must not imply any client-trusted countdown — they
  simply route to the TimedTest landing, where the server-derived **TimerBar**
  lives.
- **Gamification one-moment:** **CelebrationBurst** is reserved for first-time
  completion / XP / streak / level-up / achievement and is NOT placed on this
  list (revisiting completed spaces shows a static `mastery.mastered` ring +
  "Completed" tag only). All motion here stays subtle per FOUNDATION §4.
- **Tenant isolation:** `listSpaces` is tenant-scoped server-side from the
  caller's active-tenant claim (B2B) or the `platform_public` tenant +
  `consumerProfile.enrolledSpaceIds` (B2C). The client passes no `tenantId` in
  the body; it's derived from claims. The UI cannot read another tenant's
  spaces.
- **Published-only + class-assigned (B2B):** the list shows only
  `status: published` spaces assigned to the student's class — enforced
  server-side, not client-filtered.
- **Mastery framing:** progress is "mastered", not "score" — a learning-progress
  signal, kept warm and non-punitive.

---

## 9. Accessibility

- **Landmarks/order:** `main` region; focus order = H1 → filter chips → sort
  Select → first SpaceCard → … → (B2C) Explore-Store CTA. **SkipToContent**
  lands on the H1. **RouteAnnouncer** announces "My Spaces, {n} spaces" on
  navigation.
- **Cards:** each SpaceCard is a single semantic link (`<a>` / pressable) with
  an accessible name combining title + "{percentage}% mastered" + type — so a
  screen reader hears "Calculus Foundations, 60% mastered, learning space".
  `Tab` moves card-to-card; `Enter`/`Space` activates.
- **ProgressRing:** `role="img"` with `aria-label="{percentage}% mastered"`;
  never conveys state by color alone — pairs with the visible percentage label +
  a small mastery icon (notStarted/inProgress/mastered).
- **Type/difficulty tags:** carry an icon + text label, not color-only.
- **Chips/Select:** standard Radix keyboard semantics; active chip exposes
  `aria-pressed`; Select is fully keyboard-operable; mobile sort Sheet traps
  focus and restores on close.
- **Contrast:** all text/bg pairs meet WCAG AA (body 4.5:1, large/UI 3:1) per
  FOUNDATION §2; `border.focus` ring (indigo @35%) on every focusable.
- **Reduced motion:** `prefers-reduced-motion` disables the ring sweep,
  layout-reflow animation, and hover elevation transition (instant instead); no
  spring anywhere on this screen.
- **Touch targets:** ≥44px for chips, sort control, and card hit area.

---

## 10. Web ↔ mobile divergence (FOUNDATION §6)

- **Shell:** web = Sidebar + Topbar; mobile = bottom **Tabbar** + compact
  header.
- **Grid:** web 2–3 columns; mobile single-column stacked SpaceCards (same
  component, reflowed).
- **Find/search:** web has **CommandPalette (⌘K)** and Topbar search to jump to
  a space by name; **mobile has no ⌘K** — find-by-name is the in-page filter
  chips + (if needed) a search field in the header.
- **Hover → press:** web hover elevation + chunk **prefetch**; mobile press
  state (scale/opacity), no hover prefetch (prefetch on viewport-enter instead).
- **Sort control:** web inline **Select**; mobile collapses to an IconButton →
  bottom **Sheet** with the same options.
- **Filter chips:** web wrap; mobile horizontal scroll row.
- Component **names/props are 1:1** between `shared-ui` (web) and `ui-native`
  (mobile); only the renderer differs.

---

## 11. Claude-design prompt (ready to paste)

```
Design the "My Spaces (List)" screen for the Auto-LevelUp STUDENT web app, conforming
STRICTLY to the Lyceum design system in docs/rebuild-spec/design/00-FOUNDATION.md
(Direction A — "Modern Scholarly"). Do not invent tokens, fonts, colors, radii, shadows,
motion, or component variants — compose only from FOUNDATION §2/§3/§4/§5 and cite tokens
by semantic name.

CONTEXT
- Learner's home base: a grid of their PUBLISHED learning spaces at route /spaces (B2B
  student) — the same component also serves B2C consumers at /my-spaces, switched by
  LearnerContext (tenant vs platform_public), NOT by path.
- Read-only. Data via @levelup/api-client: v1.levelup.listSpaces (published, class- or
  enrollment-scoped) + v1.levelup.getSpaceProgress(scope: allSpaces). UI never touches
  Firestore. Timestamps are epoch-ms.

LAYOUT
- Inside AppShell (Sidebar + Topbar on web; bottom Tabbar on mobile).
- Page header: H1 "My Spaces" (Fraunces) + a calm one-line subhead + a small count Badge.
- Filter/sort bar: subject Chip filters ("All" + subjects) and a Sort Select
  ("Recently active" default · "Progress" · "A–Z").
- SpaceCard grid: 1 col < sm, 2 cols sm–md, 3 cols ≥ lg (never 4). gap-6 desktop / gap-4
  mobile. Each SpaceCard: optional thumbnail, a type tag (learning/practice/assessment/
  hybrid, icon+label) + difficulty chip, title (Fraunces lg), 1–2 line secondary
  description, meta row (subject · "{n} story points" · ★rating if present), footer with a
  ProgressRing (mastery scale: mastery.notStarted / inProgress / mastered) + "Last opened
  {relative}" in text.muted. Whole card is one link to /spaces/:spaceId.

STATES
- Skeleton grid (3–6 cards) while loading; render cards as soon as listSpaces resolves and
  spin only the rings until progress lands (partial state — never block the grid on
  progress; if progress fails, show neutral rings + "Progress syncing…").
- Empty B2B: "No spaces yet" / "Your teacher hasn't assigned any learning spaces to your
  class yet. Check back soon." (no CTA).
- Empty B2C: "Start your first space" + spark Button "Explore the Store" → /store.
- Empty after filter: "No spaces match this filter." + "Clear filter".
- ErrorState (distinct from empty): "We couldn't load your spaces" + ghost "Retry".

MOTION & TONE
- Subtle only: card elevation e1→e2 on hover (motion.fast), grid reflow on filter/sort
  (motion.base, ease.standard), ProgressRing sweep from 0 on progress arrival (motion.base).
- NO CelebrationBurst here — that gamification one-moment fires on first completion
  elsewhere. Respect prefers-reduced-motion (cross-fade rings, no spring).
- Warm, encouraging copy: "{percentage}% mastered" never "% incomplete"; unstarted spaces
  read "Ready when you are", not "0% / Not started".

DOMAIN RULES
- Tenant-isolated, published-only, class/enrollment-scoped server-side. No answer keys, no
  client-trusted timers. Pair every status with an icon + label (never color alone).

A11Y
- main landmark; focus order H1 → chips → sort → cards → (B2C) CTA. Each card is one link
  named "Title, {percentage}% mastered, {type}". ProgressRing role=img with aria-label.
  AA contrast, border.focus rings, ≥44px targets, reduced-motion honored.

Deliver: a responsive React + Tailwind implementation using shared-ui components
(SpaceCard, ProgressRing, Chip/Tag, Select, Badge, EmptyState, ErrorState, Skeleton,
Button) reading the Lyceum tokens. Show the lg (3-col) and mobile (1-col) layouts plus the
B2B empty, B2C empty, and error states.
```
