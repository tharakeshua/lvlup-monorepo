# Leaderboard (B2B) — Design Spec

> Conforms to **Lyceum** (Direction A — "Modern Scholarly"),
> `docs/rebuild-spec/design/00-FOUNDATION.md`. Cite tokens by semantic name; do
> not re-paste scales. Tone: friendly competition — celebrate the learner's own
> standing positively, never shame lower ranks.

---

## 1. Purpose & primary user

**Primary user:** a B2B school learner (tenant-scoped, role `student`).
**Job-to-be-done:** _"Show me where I stand among my classmates, make me feel my
own progress positively, and give me a little friendly push to climb."_ The
leaderboard is the platform's lightest social-competitive surface: a live ranked
list of learners by points/XP, with the **current learner's own row pinned and
highlighted** so they always see their standing regardless of where they fall in
the list.

It is energizing, not punitive. Top performers get a _subtle_ marigold accent
(within the single-celebratory-moment discipline — no constant bursts), and
every learner sees their own position framed warmly ("You're #14 — up 2 since
yesterday"). The scope toggle lets a learner compare within one space, their
class, or the whole tenant.

---

## 2. Entry points & route

**Route:** `/leaderboard` (B2B student tree, behind
`RequireAuth allow=['student']`, `onMissingMembership: 'consumerRedirect'`).
Entered from the Sidebar "Leaderboard" item (web), the mobile Tabbar / nav, and
contextually from the dashboard gamification column ("See full leaderboard →").

**Reads (all via `@levelup/api-client` + the realtime
`subscribe(name, params, cb)` seam; never `firebase/database` or
`firebase/firestore` directly; `tenantId` derived from the active-tenant claim,
never a request field):**

- **Leaderboard realtime repo** — `leaderboard.subscribe` over the realtime
  contract (per common-api §10), backed by RTDB
  `leaderboards/{tenantId}/{scopeKey}/{userId}` where
  `scopeKey ∈ { 'overall', class_{classId}, space_{spaceId} }`. Payload per
  entry: `{ displayName, totalPoints, avatarUrl?, previousRank? }`. The repo
  normalizes the RTDB map into a sorted, ranked `LeaderboardEntry[]` (sort by
  `totalPoints` desc, assign `rank = idx + 1`) and pushes live diffs to a
  subscription callback. This is the **one live subscription** on the screen.
- **`studentLevels`** — `studentLevels/{userId}` read (behind the api-client,
  e.g. `v1.levelup.getStudentLevel` / a gamification read endpoint) for the
  current learner's `level`, `currentXP`, `tier` → renders the **LevelBadge** +
  tier label on the learner's pinned self-row and the "Your standing" hero.
  (Other rows show points only; level/tier is shown for the self-row to avoid
  implying competitive ranking on XP level.)
- **Scope options** — `v1.levelup.listSpaces`
  `{ status: 'published', classIds }` for the space-scope picker; the learner's
  `classIds` come from `membership.permissions.managedClassIds` (claim-derived)
  for the class-scope option. Class display names via the same
  membership/identity read already loaded by the shell.

**Writes:** **none.** The leaderboard is read-only here. Points/XP are written
by _other_ surfaces (test submit, story-point completion → server-side progress
writer). The CelebrationBurst that accompanies an XP/rank change fires on the
originating surface, not on leaderboard load (see §6/§8).

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (Sidebar + Topbar on `lg`; Topbar + bottom
**Tabbar** on mobile). Centered reading column, max-width ~720 (this is a single
focused list, not a wide table). `bg.canvas` page; the list sits on a Card
(`bg.surface`, `border.subtle`, `e1`), rows divided by `border.subtle`. Vertical
rhythm `gap` space-6 between regions; row padding space-3/space-4.

```
┌──────────────────────────────────────────────────────────────┐
│ HEADER ROW                                                    │
│  🏆 Fraunces h2 "Leaderboard"                                 │
│  text.secondary subline "See how you're tracking with your   │
│   class — friendly competition, no pressure."                 │
│                                          ┌──────────────────┐ │
│                                          │ YOUR STANDING    │ │
│                                          │  #14  (mono)      │ │
│                                          │ LevelBadge · "+2" │ │
│                                          └──────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│ SCOPE TABS  [ Overall ] [ My Class ] [ By Space ▾ ]          │
│  (Tabs; "By Space" reveals an inline Select of published      │
│   spaces. Active tab = brand.primary underline.)              │
├──────────────────────────────────────────────────────────────┤
│ LIST HEADER  small caps "{scope} rankings"  · live dot ●      │
├──────────────────────────────────────────────────────────────┤
│ TOP-3 (subtle marigold accent — restrained, not a burst)     │
│  ┌── LeaderboardRow #1 ──────────────────────────────────┐   │
│  │ 👑 1 · Avatar · Priya S. ······· 2,480 pts (mono)     │   │
│  ├── LeaderboardRow #2 ──────────────────────────────────┤   │
│  │ 🥈 2 · Avatar · Rahul K. ······· 2,310 pts            │   │
│  ├── LeaderboardRow #3 ──────────────────────────────────┤   │
│  │ 🥉 3 · Avatar · Aisha M. ······· 2,180 pts            │   │
│  └────────────────────────────────────────────────────────┘   │
│  … LeaderboardRow #4 … #5 … #6 …                              │
│  ┌── LeaderboardRow #14  (YOU — pinned/highlighted) ─────┐   │
│  │ 14 · Avatar · You ▲+2 ·········· 1,240 pts            │   │  ← bg.surface-sunken
│  └────────────────────────────────────────────────────────┘   │     + brand.primary ring
│  … #15 … #16 … (window around the learner) …                 │
├──────────────────────────────────────────────────────────────┤
│ STICKY SELF-ROW (when own row scrolled out of view)          │
│  └ pinned to bottom of the list viewport: "14 · You · 1,240" │
└──────────────────────────────────────────────────────────────┘
```

**Self-row pinning logic:** the learner's row always renders **inline at its
true rank** within the list. Additionally, when that inline row is scrolled out
of the viewport, a compact **sticky self-row** docks to the bottom edge of the
list (or screen on mobile) so the learner never loses sight of their standing.
Tapping the sticky row scrolls the inline row into view.

**Windowing (large tenants):** for big tenant-scope lists, render top-N
(e.g. 10) + a window of ±a few rows around the learner, with a "…" gap divider,
rather than the full roster. Space/class scopes are typically small enough to
render in full.

**Responsive (mobile-first):**

- **base → sm (640):** single column, list full-width. The "Your standing" hero
  stacks **above** the tabs (not beside the header). Scope tabs may scroll
  horizontally if cramped. Sticky self-row docks to the bottom of the screen
  above the Tabbar.
- **md (768):** "Your standing" hero sits beside the header (as wireframe); list
  centered at reading width.
- **lg (1024)+:** Sidebar persistent; reading column centered (~720). Hover
  affordances on rows.

---

## 4. Components used (FOUNDATION §5 only)

- **Navigation:** AppShell, Sidebar, Topbar, Tabbar (mobile), CommandPalette
  (⌘K, web only).
- **Domain:** **LeaderboardRow** (rank · Avatar · name · points; with optional
  rank-change indicator and self-row highlight variant), **LevelBadge** (on the
  "Your standing" hero + self-row, from `studentLevels`), **Avatar** /
  **AvatarGroup** (row avatars; AvatarGroup only if ever showing a clustered
  "others" overflow). XP/points use the **spark** accent sparingly.
- **Data:** **Badge** (rank tier badge — 👑/🥈/🥉 for top-3, and a neutral tier
  label), Stat/KPI-style "Your standing" number (Spline Sans Mono), Avatar,
  EmptyState, ErrorState, Skeleton, Pagination/"Show more" only if a roster is
  paged.
- **Containers / Primitives:** Card (the list container), **Tabs** (scope
  toggle: Overall / My Class / By Space), **Select** (the space picker revealed
  under "By Space"), Button (ghost "See more", spark not used for navigation
  here), Section.
- **Feedback:** InlineAlert/Banner (offline / stale-live notice via shell),
  Toast (sonner) for transient subscription errors. A **live-region**
  (`aria-live="polite"`) announces rank changes (see §9).

**Proposed FOUNDATION additions (flagged for promotion, not silently
invented):**

1. **`LeaderboardSelfBar`** — the _sticky/docked self-row_ that appears when the
   learner's inline row scrolls out of view. It is a thin wrapper around
   **LeaderboardRow** (self variant) with sticky positioning + a "scroll to my
   rank" tap target. It recurs anywhere a long ranked list must keep the user's
   own position visible (potential parent-web / class views). Recommend
   promoting a `LeaderboardRow` _`sticky`/`self-pinned` variant_ into §5 rather
   than a new component. **Until promoted, compose it from the existing
   LeaderboardRow self variant — do not invent a new visual.**
2. **`RankChangeIndicator`** — the ▲/▼ delta vs `previousRank` (already present
   in today's `LeaderboardTable`). It is small enough to live as a sub-element
   of **LeaderboardRow**; recommend folding it into the LeaderboardRow §5
   anatomy (color paired with arrow icon + text per the no-color-alone rule)
   rather than as a standalone component.

No new colors/fonts/radii/shadows/motion are introduced — top-3 accent uses
**spark** (marigold) at low emphasis; self-row uses `bg.surface-sunken` + a
`border.focus`/`brand.primary` ring; tiers use existing Badge.

---

## 5. States

- **Loading (skeleton):** "Your standing" hero → a small Skeleton block; list →
  6–8 Skeleton rows (avatar circle + name bar + points bar) on
  `bg.surface-sunken` shimmer, `aria-busy`, `role="status"`, "Loading the
  leaderboard…". Scope tabs render immediately (cheap). No celebratory motion.
- **Empty (no entries yet for this scope):** friendly EmptyState — Trophy glyph
  at low emphasis (`text.muted`), title "No rankings yet", body: _"As you and
  your classmates earn points, you'll show up here. Complete a story point to
  get on the board!"_ with a ghost CTA "Start learning →" → `/spaces`. Never a
  cold blank.
- **Empty — learner not yet ranked but others are:** show the list normally; the
  "Your standing" hero reads _"Not ranked yet — earn your first points to join
  the board 🎯"_ (no fake #0, no shaming). The sticky self-row is hidden until
  the learner has an entry.
- **Partial:** if `studentLevels` fails but the leaderboard subscription
  succeeds, render the list and self-row with points only; hide the
  LevelBadge/tier quietly (no error). If a scope's data is missing but others
  load, that scope's tab shows its own inline empty state.
- **Error (whole leaderboard):** distinct **ErrorState** (not the empty state) —
  _"We couldn't load the leaderboard just now. Let's try again."_ + Retry
  (re-subscribe). Transient live-update drops show a quiet InlineAlert
  "Reconnecting…" rather than wiping the last-known list; Toast for background
  failures. Never blame the learner.
- **Stale / disconnected live data:** if the realtime subscription drops, keep
  the **last-known** ranking rendered (dimmed live dot → "Paused"), show
  "Reconnecting…", and reconcile when it returns. Do not flash an error over
  good cached data.
- **Success:** full list per §3, current learner's row highlighted inline +
  sticky when off-screen, top-3 subtly accented, live dot active.
- **Role/segment gating:** **B2B student** only. B2C consumers never reach
  `/leaderboard` (guard redirects to `/consumer`); consumer leaderboards, if
  ever offered, are a separate spec scoped to `platform_public`. The "My Class"
  scope only appears when the learner has `classIds`; if none, that tab is
  hidden and Overall is default.

---

## 6. Interactions & motion (everyday-subtle register)

- **Entrance:** the list fades/slides in with a small per-row stagger using
  `motion.base` (220ms) + `ease.entrance`; respect `prefers-reduced-motion`
  (opacity only, no translate).
- **Scope toggle (Tabs):** switching Overall / My Class / By Space re-subscribes
  the realtime repo to the new `scopeKey` and cross-fades the list at
  `motion.fast` (160ms). "By Space" reveals the Select inline; choosing a space
  subscribes to `space_{spaceId}`. The active tab underline animates with
  `motion.base`. Scope choice persists in the URL query (`?scope=class` /
  `?scope=space&spaceId=…`) so it survives refresh and is shareable.
- **Live rank updates:** when the subscription pushes a diff, rows **reorder
  with a smooth FLIP/list-move transition** at `motion.base` + `ease.standard`
  (the row slides to its new position; points CountUp to the new value). This is
  the _only_ live motion and stays subtle — no bursts. Under reduced-motion,
  rows snap to the new order with an instant opacity tick and the live-region
  announces the change (see §9).
- **Your-standing number:** CountUp on the hero rank number on mount and on
  change (mono figures); disabled under reduced-motion.
- **Sticky self-row:** appears/dismisses with a quiet slide+fade at
  `motion.fast` as the inline self-row crosses the viewport edge. Tapping it
  smooth-scrolls the inline row into view and gives it a brief focus ring (no
  burst).
- **Hover (web) / press (mobile):** rows lift `e1`→`e2` on hover (web) at
  `motion.fast`; press scale on mobile. Rows are **not** links to
  other-learners' profiles by default (privacy + scope) — they are
  non-interactive presentational rows except the self-row's "scroll to me"
  affordance. (If a future "view classmate" exists, it's gated by tenant privacy
  settings — out of scope here.)
- **Gamification — celebratory motion is RESERVED and NOT fired here.** The
  leaderboard renders live values and subtle reorders; it does **NOT** play
  CelebrationBurst on load or on every rank tick. The spring-pop + marigold
  spark burst is the ONE celebratory moment, reserved for the _change event on
  its originating surface_ (XP gain / level-up / achievement / 100% completion
  at test or story-point submit). **One** exception, used at most once: if a
  learner is routed here _immediately after_ a points event and their rank
  visibly improves, a single restrained CelebrationBurst may play once over the
  self-row, then never repeat on subsequent loads. Top-3 marigold accent is a
  static, low-emphasis treatment — not an animation. Everywhere else: subtle
  only.
- **Confirmations:** none (read-only screen).

---

## 7. Content & copy (friendly competition, never shaming)

- **Header (Fraunces h2):** "Leaderboard". Subline (text.secondary): _"See how
  you're tracking with your class — friendly competition, no pressure."_
- **Your standing hero:** label "Your standing"; value "#{rank}" (mono). Delta:
  "▲ up {n} since yesterday" / "▼ down {n}" / "— holding steady". If unranked:
  _"Not ranked yet — earn your first points to join the board 🎯"_.
- **Scope tabs:** "Overall" · "My Class" · "By Space" (with a Select placeholder
  "Choose a space"). List header small-caps: "{Overall / My Class / {Space
  title}} rankings".
- **Live indicator:** a small dot + "Live" (text.muted); when reconnecting
  "Reconnecting…".
- **Rows:** rank number/medal · name (own row suffixed "(You)") · "{points} pts"
  (mono). Top-3 may carry a tiny tier word — "Gold / Silver / Bronze" — paired
  with the medal icon (never color-only).
- **Self emphasis copy:** the self-row reads warmly — e.g. a subtle "(You)" tag
  and, on improvement, a small "Nice climb! ▲" microcopy that fades after the
  reorder. Never any negative framing for low rank.
- **Empty (no data):** title "No rankings yet", body "As you and your classmates
  earn points, you'll show up here. Complete a story point to get on the board!"
  CTA "Start learning →".
- **Empty (you unranked, others ranked):** hero "Not ranked yet — earn your
  first points to join the board." No #0.
- **Error:** "We couldn't load the leaderboard just now. Let's try again."
  (Retry). Stale: "Showing your last view — reconnecting…".
- **Encouragement, not shame, for the bottom:** never render "last place",
  "bottom of the class", or red/error styling for low ranks. Low ranks are plain
  neutral rows. The framing is always _forward_ ("Keep going — every point
  counts").

---

## 8. Domain rules surfaced

- **Social/competitive but kept encouraging.** The learner's own standing is
  always surfaced positively (pinned, warm copy, improvement microcopy). No row
  is ever styled as "losing": lower ranks are neutral, never red/error, never
  labeled "last". This is the explicit student-tone rule for this screen.
- **Gamification celebratory-motion budget.** CelebrationBurst (spring pop +
  marigold spark) is the ONE celebratory moment and is **reserved for the change
  event on its originating surface** — it does NOT fire on leaderboard load or
  on routine live rank ticks. Top-3 get a _static, restrained_ marigold
  (`spark`) accent only — not a burst, not an animation loop. At most one burst,
  once, if arriving directly after a points event with a visible rank
  improvement. Respect `prefers-reduced-motion`.
- **Timer is server-authoritative (not on this screen).** No countdowns here;
  the points that feed the leaderboard come from server-side progress/grading
  writes (which themselves respect the server-authoritative timed-test flow).
  The client never computes or trusts a deadline on this surface.
- **Answer-key is NEVER shown.** No question content or answers appear anywhere
  on the leaderboard — it shows only display name, avatar, and aggregate
  points/level. No AnswerKeyLock is needed (no answer surfaces here); the rule
  simply gates that nothing assessment-content-related leaks onto this social
  surface.
- **Tenant isolation.** Every entry is read from the learner's own tenant
  (`leaderboards/{tenantId}/...`), with `tenantId` derived from the
  active-tenant claim server-side — never a request field. The class scope is
  further restricted to the learner's `classIds`. A learner only ever sees
  classmates within their tenant (and, for class scope, their class). No
  cross-tenant leakage.
- **Privacy of other learners.** Rows show only display name + avatar (data the
  tenant already exposes to peers) and aggregate points — never email, scores
  per assessment, at-risk status, or any private analytics of other students.
  Rows are non-interactive by default (no drilling into a classmate's profile)
  unless a tenant privacy setting explicitly enables it.
- **Honest data, read-only.** Points/levels reflect the server-written progress;
  the leaderboard never mutates them. Live values come from the realtime
  subscription, reconciled with last-known on reconnect.

---

## 9. Accessibility

- **Focus order:** Skip-to-content → header → "Your standing" hero → scope Tabs
  (Overall → My Class → By Space, with the Select reachable when active) → list
  (top to bottom) → sticky self-row "scroll to my rank" button (when present).
  Logical and matching visual order.
- **Rank announced as text.** Each row exposes rank as readable text, NOT
  color/medal alone: e.g. an `aria-label` "Rank 1, Priya S., 2,480 points"
  (medals/crown icons are `aria-hidden`, the rank integer is in the accessible
  name). The self-row announces "Rank 14, you, 1,240 points". Tier words
  ("Gold/Silver/Bronze") and ▲/▼ deltas are real text, not color-coded glyphs
  alone.
- **Live-region for rank changes.** A visually-relevant but unobtrusive
  `aria-live="polite"` region announces meaningful changes — primarily the
  **learner's own** rank ("You moved up to rank 12") and significant top changes
  — rather than spamming every minor reorder. Debounce announcements so live
  updates don't flood a screen reader. Reordering of the visual list uses
  `role="list"`/`listitem`; rows have stable keys so assistive tech tracks
  moves.
- **Keyboard:** scope Tabs are arrow-key navigable (Tabs pattern); the space
  Select is a real combobox (type-ahead, Esc to close); the "scroll to my rank"
  sticky control is a real button (Enter/Space). Visible focus ring
  (`border.focus`, 3px indigo) on every focusable.
- **Contrast & color-independence:** all text/bg pairs meet WCAG AA (4.5:1 body,
  3:1 UI/large). **Never status-by-color alone** — top-3 = medal icon + tier
  text + accent; rank deltas = arrow icon + "up/down n" text + color; the
  self-row is distinguished by the "(You)" label and ring, not color alone.
- **Reduced motion:** `prefers-reduced-motion` disables CountUp, the entrance
  stagger, the FLIP reorder animation (rows snap), the sticky slide, and any
  one-time CelebrationBurst — values and order update instantly; the live-region
  still announces changes.
- **Touch targets ≥44px** for tabs, the space Select, and the sticky self-row
  control on mobile.

---

## 10. Web↔mobile divergence (FOUNDATION §6)

- **Shell:** web = Sidebar + Topbar; mobile = Topbar + bottom **Tabbar**
  (Leaderboard active). CommandPalette (⌘K) web only; absent on mobile.
- **Table → stacked rows:** this is already a stacked **LeaderboardRow** list
  (not a DataTable) on both platforms — no horizontal table to collapse. On web
  the rows sit in a centered reading-width Card; on mobile they're full-bleed
  within the gutter.
- **"Your standing" hero:** beside the header on `md`+ (web) → stacked above the
  tabs on mobile.
- **Sticky self-row:** docks to the bottom of the list container on web; docks
  to the bottom of the screen **above the Tabbar** on mobile (respect safe-area
  inset).
- **Interaction:** hover lift (web) → press scale (mobile); "scroll to my rank"
  is a click (web) / tap (mobile).
- **Live transport:** web subscribes via `shared-firebase` RTDB listener behind
  the `subscribe(name, params, cb)` seam; RN subscribes via the same seam (RN
  Firebase / RTDB) — identical subscription contract, only the listener
  implementation differs.
- **Component parity:** LeaderboardRow / LevelBadge / Avatar / AvatarGroup /
  Badge / Tabs names + props match 1:1 between `shared-ui` (web) and `ui-native`
  (mobile); only the renderer differs. The FLIP reorder uses Framer Motion (web)
  / Reanimated layout animations (RN) with the same
  `motion.base`/`ease.standard` timings.

---

## 11. Claude-design prompt (ready to paste)

```
Design the Leaderboard screen for Auto-LevelUp (route "/leaderboard", B2B school learner,
role student). STRICTLY conform to the Lyceum design system in
docs/rebuild-spec/design/00-FOUNDATION.md (Direction A — "Modern Scholarly"). Use ONLY its
tokens — cite by semantic name (bg.canvas, bg.surface, bg.surface-sunken, text.primary/
secondary/muted, brand.primary, spark, border.subtle, border.focus, status.*, radius.lg/pill,
e1/e2, motion.base/fast, ease.entrance/standard) — never invent colors, fonts, radii, shadows,
or component variants. Fonts: Fraunces (h2 "Leaderboard" + the "Your standing" rank number),
Schibsted Grotesk (UI/labels/tabs/names), Spline Sans Mono (points and rank numerics).
Tone: friendly competition, warm and encouraging — celebrate the learner's OWN standing
positively, NEVER shame lower ranks (no "last place", no red for low ranks).

Render inside AppShell (Sidebar+Topbar on lg; Topbar + bottom Tabbar on mobile), centered
reading-width column (~720). Regions, top to bottom:
1. Header: 🏆 Fraunces h2 "Leaderboard" + a warm subline. Beside it (md+) a "Your standing"
   hero: "#{rank}" (mono, CountUp) + LevelBadge/tier + a "▲ up {n} since yesterday" delta.
   On mobile, stack the hero above the tabs.
2. Scope toggle as Tabs: Overall · My Class · By Space (By Space reveals an inline Select of
   published spaces). Active tab = brand.primary underline. Persist scope in the URL query.
3. The list as a Card of stacked LeaderboardRow items: rank/medal · Avatar · name · "{pts} pts".
   Top-3 get a SUBTLE static marigold (spark) accent + medal icon + tier word (Gold/Silver/
   Bronze) — restrained, NOT a burst, NOT an animation. The current learner's row is pinned
   inline at its true rank AND highlighted (bg.surface-sunken + brand.primary ring + "(You)").
4. A sticky self-row that docks to the bottom of the list (web) / above the Tabbar (mobile)
   when the inline self-row scrolls out of view; tapping it scrolls to the real rank.
5. A small "Live" dot indicating the realtime subscription; "Reconnecting…" when dropped.

Live behavior: rows reorder with a smooth FLIP/list-move at motion.base + ease.standard and
points CountUp to new values when the realtime data updates — this is the ONLY live motion and
stays subtle. States: skeleton loading, a warm empty state ("No rankings yet — complete a story
point to get on the board!"), an "unranked but others ranked" hero variant (no fake #0), partial
(points only if level fails), distinct ErrorState with Retry, and stale/reconnecting (keep
last-known list). Use domain components by their FOUNDATION §5 names: LeaderboardRow, LevelBadge,
Avatar/AvatarGroup, Badge, Tabs, Select, EmptyState.

DOMAIN RULES (hard):
- Social but encouraging: own standing always positive; lower ranks neutral, never shamed/red.
- CelebrationBurst (spring pop + marigold spark) is the ONE celebratory moment, RESERVED for the
  XP/level/achievement change event on its originating surface — do NOT fire it on leaderboard
  load or on routine rank ticks. At most one burst, once, if arriving directly after a points
  event with a visible rank improvement. Top-3 accent is static, not animated.
- Tenant isolation: entries are the learner's own tenant only (class scope = own classIds);
  read-only — the leaderboard never mutates points. No answer keys / scores / private analytics
  of other students; rows show only name + avatar + aggregate points (+ level on the self-row).
- Accessibility: rank announced as TEXT (medals aria-hidden, rank integer in the accessible
  name); an aria-live="polite" region announces the learner's own rank changes (debounced);
  status never by color alone (icon + label); WCAG AA contrast; reduced-motion snaps the reorder.

Deliver a single responsive, accessible screen that feels like warm, motivating, friendly
competition — the learner always sees, and feels good about, exactly where they stand.
```
