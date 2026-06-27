# Screen Spec — Consumer Dashboard / My Learning (B2C)

> Conforms to **Lyceum / Direction A — "Modern Scholarly"**
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). All tokens cited by semantic
> name; never re-pasted. Student tone: warm, encouraging, aspirational,
> self-serve.

---

## 1. Purpose & primary user

**Primary user:** a **B2C consumer learner** (self-serve, no tenant membership;
identity carries `user.consumerProfile`, served from the synthetic
`platform_public` tenant).

**Job-to-be-done:** _"When I sign in, I want to land on my learning home — see
the spaces I've enrolled in, pick up exactly where I left off, understand my
plan at a glance, and find more to learn — so I feel oriented, motivated, and
one tap from progress."_

This is the **consumer home** — the first screen after B2C login. It is not the
B2B student Dashboard (which is tenant-scoped, exam-aware, and analytics-heavy).
It is a calmer, store-adjacent, ownership-centric surface: _"here is what's
mine, here's where I left off, here's where to find more."_

---

## 2. Entry points & route

**Routes:** `/consumer` (canonical home) and `/my-spaces` (alias). Rendered
inside `ConsumerLayout` (the B2C shell variant of `AppShell`).

**Entry points:**

- Post-login redirect for any authenticated user with **no tenant membership**
  (`RequireAuth` `onMissingMembership: 'consumerRedirect'`).
- "My Learning" item in the `ConsumerLayout` sidebar / mobile `Tabbar`.
- Brand/logo click in the `Topbar`.
- Post-purchase return from `/store/checkout` (a newly enrolled space appears
  here).

**Reads (all through `@levelup/api-client`; UI never touches Firestore
directly):**

- `user.consumerProfile` — `enrolledSpaceIds`, `plan` (`free | pro | premium`),
  `totalSpend`, `purchaseHistory[]` — from the auth store's real-time
  `/users/{uid}` snapshot (no extra fetch).
- `v1.levelup.listSpaces` scoped to `platform_public` — resolves the enrolled
  space documents (title, thumbnail, `stats.totalStoryPoints`). Replaces today's
  inline batched Firestore `where(__name__, in, …)` query in
  `ConsumerDashboardPage.tsx`. The repo handles the >30-id chunking internally;
  the UI passes `{ spaceIds: enrolledSpaceIds }`.
- `v1.levelup.getSpaceProgress` (per enrolled space, batched) — drives each
  `SpaceCard`'s `ProgressRing` (% complete) and the single "Continue learning"
  pick (most-recently-active in-progress space).
- `consumer-store` (Zustand) — cart badge count for the `Topbar`/`Tabbar`
  (rendered by `ConsumerLayout`, not this page).

**Writes:** none from this screen. All CTAs are navigation only (to `/store`,
`/store/:spaceId`, `/consumer/spaces/:spaceId/...`).

---

## 3. Layout — wireframe-as-text

Hosted in `ConsumerLayout` → `AppShell` (sidebar collapses to a bottom `Tabbar`
on mobile). This spec describes the **content region** only. Max content width
per FOUNDATION §4 (1200); page gutters mobile 16 / tablet 24 / desktop 32.

```
┌─ AppShell (ConsumerLayout) ─────────────────────────────────────────────┐
│ Topbar: brand · search · cart(badge) · notifications · avatar/profile    │
├──────────────────────────────────────────────────────────────────────────┤
│  CONTENT REGION (vertical stack, gap = space-8/32)                        │
│                                                                          │
│  ┌─ Greeting header ─────────────────────────────────────────────────┐  │
│  │ h1 "Welcome back, {firstName}"  (Fraunces display)                 │  │
│  │ subline "Pick up where you left off." (text.secondary)             │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─ Continue-learning banner (only if an in-progress space exists) ──┐  │
│  │  [thumb] {space.title}   ProgressRing 62%   [Continue →] (spark)   │  │
│  │  "Lesson 8 of 13 · keep the momentum going"                        │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─ Plan summary row: 3 StatCards (grid, lg: 3-up) ──────────────────┐  │
│  │ [Plan: Pro]     [Spaces: 4]     [Invested: ₹2,400]                 │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─ "My spaces" Section ─────────────────────────────────────────────┐  │
│  │  Section header:  h2 "My spaces"          [Browse the store →]     │  │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐                        │  │
│  │  │ SpaceCard │ │ SpaceCard │ │ SpaceCard │   (responsive grid)    │  │
│  │  │ thumb     │ │ thumb     │ │ thumb     │                        │  │
│  │  │ title     │ │ title     │ │ title     │                        │  │
│  │  │ ProgressR │ │ ProgressR │ │ ProgressR │                        │  │
│  │  └───────────┘ └───────────┘ └───────────┘                        │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

**Responsive grid for `SpaceCard`s (mobile-first):**

- **base (<640):** 1 column, full-width cards. Continue banner stacks (thumb on
  top, CTA full-width). StatCards stack 1-up. Greeting + subline left-aligned.
- **sm (640):** SpaceCards 2-up; StatCards 3-up (compact).
- **md (768):** SpaceCards 2-up (roomier); continue banner becomes horizontal
  (thumb left, ring center, CTA right).
- **lg (1024+):** SpaceCards 3-up; StatCards 3-up; content centered within
  max-width 1200.

Regions are flex/grid + `gap` (FOUNDATION §4) — no ad-hoc margins. Vertical
rhythm between regions = `space-8`; within a region = `space-4`/`space-6`.

---

## 4. Components used (FOUNDATION §5 only)

- **`AppShell`** (via `ConsumerLayout`) — sidebar + `Topbar`; `Tabbar` on
  mobile.
- **`SpaceCard`** (domain) — one per enrolled space; renders thumbnail, title,
  lesson count, and an embedded **`ProgressRing`** for % complete. Variant:
  "enrolled" (owned — no price, no buy CTA; whole card is a navigation target to
  `/consumer/spaces/:spaceId`).
- **`ProgressRing`** (data) — completion % inside each `SpaceCard` and in the
  continue-learning banner.
- **`Stat/KPI` (StatCard)** ×3 — Plan, Enrolled spaces, Total invested. Numerics
  in **Spline Sans Mono** (`text.primary`); labels in Schibsted Grotesk
  (`text.secondary`).
- **`Section`** — "My spaces" container with header + action slot.
- **`Card` / `Panel`** — the continue-learning banner.
- **`Button`** — `spark` variant for the primary "Continue" CTA (the one place
  spark glow is warranted here — momentum/forward motion); `secondary`/`ghost`
  "Browse the store" link-button.
- **`EmptyState`** — no enrolled spaces yet (title in Fraunces, illustration,
  spark CTA).
- **`Skeleton`** — loading placeholders for cards + stats.
- **`ErrorState`** (data, distinct from empty) — load failure with retry.
- **`Avatar`** — learner avatar in greeting (optional) / `Topbar`.
- **`Badge` / `Chip`** — plan tier chip (e.g. "Pro") on the Plan StatCard; "New"
  chip on a just-purchased space (24h).

**Proposed FOUNDATION additions:** none strictly required. One soft note: a
**"ContinueLearningBanner"** composite would be convenient, but it is fully
expressible as `Card` + thumbnail + `ProgressRing` + spark `Button`, so it is
**not** promoted — composed inline. (Flagging here per FOUNDATION §7.8 rather
than silently inventing.)

---

## 5. States

| State                                       | Treatment                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Loading**                                 | `Skeleton` for the 3 StatCards (3 short bars) and a 3-up grid of card skeletons (thumb block + 2 text lines + ring placeholder). Greeting renders immediately from the auth store (name is already known) — no skeleton on the header. Continue banner reserves height with a single skeleton row to avoid layout shift. |
| **Empty** (`enrolledSpaceIds.length === 0`) | `EmptyState` replaces the "My spaces" grid: Fraunces title, warm subline, spark CTA to `/store`. StatCards still render (Plan = current, Spaces = 0, Invested = ₹0.00). No continue banner.                                                                                                                              |
| **Partial**                                 | Profile loaded (stats render) but `listSpaces`/`getSpaceProgress` still resolving → stats + greeting visible, card grid shows skeletons. If _some_ progress reads fail, affected `SpaceCard`s render without a `ProgressRing` (show "Progress unavailable" microcopy) rather than blocking the whole grid.               |
| **Error**                                   | `ErrorState` (not EmptyState) in the "My spaces" region: "We couldn't load your spaces just now." + **Try again** button (re-runs the query). StatCards from `consumerProfile` still render (they don't depend on the failing call).                                                                                     |
| **Success**                                 | Greeting, continue banner (if applicable), 3 StatCards, populated `SpaceCard` grid with progress rings.                                                                                                                                                                                                                  |
| **100% on a space**                         | A space at full completion shows a "Completed" badge on its `SpaceCard` and its ring filled in `status.success` / `mastery.mastered`. This is **not** a celebratory-burst surface (see §8) — the burst fires on the learning surface at the moment of completion, not here.                                              |

**Permission / role-gated variation:** this screen is **B2C-only**. A B2B
student (with tenant membership) never reaches `/consumer` — `RequireAuth`
routes them to the tenant Dashboard. There is no role gate _within_ the screen;
all consumers see the same layout. Plan tier (`free`/`pro`/`premium`) changes
only copy/chip, never structure.

---

## 6. Interactions & motion

- **Card hover (web):** `SpaceCard` lifts from `e1` → `e2` (FOUNDATION
  elevation), `motion.fast` (160ms), `ease.standard`. Title shifts to
  `brand.primary`. Whole card is the click target → `/consumer/spaces/:spaceId`.
- **Continue CTA:** spark `Button` — on press, `motion.base` (220ms) navigate to
  the deep link of the most-recent in-progress story point
  (`/consumer/spaces/:spaceId/story-points/:storyPointId`). Spark glow shadow
  only on this CTA (FOUNDATION §4 "spark glow — hero CTA only"); no
  pulse/auto-animation.
- **Browse the store:** ghost/secondary button → `/store`; subtle underline on
  hover (`motion.instant`).
- **Stat reveal:** on first paint after data resolves, StatCards fade-in
  `motion.base` with `ease.entrance`, staggered ~40ms. Numerics (Spline Mono) do
  **not** count-up animate (avoid scattering celebratory motion onto a
  non-gamification surface).
- **Skeleton → content:** crossfade `motion.fast`; reserved heights prevent
  layout shift.
- **Just-purchased space:** when arriving from checkout, the new `SpaceCard`
  enters with a gentle `ease.entrance` slide+fade (`motion.base`) and a "New"
  chip — a welcome, _not_ a CelebrationBurst. (Burst is reserved per §8.)
- **Optimistic update:** because enrollment writes happen on the checkout screen
  and `consumerProfile` is a real-time snapshot, this screen needs no optimistic
  state — the new space simply streams in. No confirmations needed (read-only
  screen).
- **Retry (error):** **Try again** re-invokes the repo read; button shows an
  inline spinner (`motion.fast`) until resolved.

All motion honors `prefers-reduced-motion`: hover lift → instant color change
only; entrance fades → none; reduced-motion users get immediate, static
transitions.

---

## 7. Content & copy

Warm, second-person, aspirational. Avoid corporate/punitive framing.

- **Greeting h1:** `"Welcome back, {firstName}"` (fallback `"Welcome back"` if
  no name).
- **Greeting subline:** `"Pick up where you left off."` (if a continue space
  exists) / `"Ready to start something new?"` (if enrolled but none started) /
  `"Your learning, all in one place."` (empty).
- **Continue banner title:** the space title; **microcopy:**
  `"Lesson {n} of {total} · keep the momentum going"`. CTA label:
  **`Continue`**.
- **StatCard labels:** `Plan` · `My spaces` · `Invested`. Values: plan tier
  capitalized with a chip; space count; total spend formatted with the
  consumer's currency (`purchaseHistory[].currency`, default ₹/locale — do
  **not** hardcode `$`). Sub-label on Invested: `"across {count} purchases"`
  when `purchaseHistory.length > 0`.
- **Section header:** `"My spaces"`. Action: **`Browse the store →`**.
- **SpaceCard meta:** `"{n} lessons"`; progress chip: `"{pct}% complete"`; at
  100%: `"Completed 🎉"` → use the **`Completed`** badge label (no literal emoji
  if it conflicts with the no-emoji house rule for chrome; rely on the success
  badge + ring).
- **Empty state:**
  - Title (Fraunces): `"Your learning starts here"`
  - Body:
    `"You haven't enrolled in any spaces yet. Explore the store to find a topic you're excited about — your progress will live right here."`
  - CTA (spark): **`Explore the store`** → `/store`
- **Error state:**
  - `"We couldn't load your spaces just now. Let's try that again."`
  - Button: **`Try again`**
- **Partial / progress-unavailable microcopy on a card:**
  `"Progress will catch up shortly."` (warm, not alarming).

Never display answer keys, scores-as-judgment, or any "you're behind" framing.
Completion is celebrated, not-yet-started is invited.

---

## 8. Domain rules surfaced

- **B2C context / tenant isolation:** all space + progress reads are scoped to
  the synthetic **`platform_public`** tenant and the caller's
  **`user.consumerProfile`** — never a B2B tenant. The repo derives scope from
  the consumer identity; this screen passes no `tenantId`. Enrolled spaces are
  gated by `enrolledSpaceIds` (ownership), so a consumer only ever sees what
  they own here (the _store_ is where un-owned spaces live).
- **No answer-key exposure:** not directly applicable (no assessment rendered
  here), but the rule still governs downstream — the `SpaceCard` → space-viewer
  path leads only to learner-safe views; the **`AnswerKeyLock`** guard lives on
  the assessment surfaces, not here. This screen never surfaces correctness
  data.
- **Gamification = the one celebratory moment, NOT here:** completion of a space
  triggers **`CelebrationBurst`** (spring pop + marigold spark) on the _learning
  surface_ at the moment it happens — **not** on this dashboard. Here, a
  completed space is a calm `status.success` badge + filled ring. The single
  spark accent on this screen is the **Continue** CTA glow (forward momentum),
  used sparingly per FOUNDATION §4.
- **Read-only, real-time:** `consumerProfile` is a live snapshot; new
  enrollments and spend stream in without a manual refresh. No writes originate
  here.
- **Currency honesty:** `totalSpend` / per-purchase amounts render in their
  stored `currency` — the spec deliberately removes the hardcoded `$` in the
  current implementation.

---

## 9. Accessibility

- **Landmarks:** content region is `<main>`; greeting `<h1>`, "My spaces" `<h2>`
  — single, ordered heading hierarchy. `Section` exposes `aria-labelledby`
  pointing at its `<h2>`.
- **Focus order:** greeting → Continue CTA → StatCards (in DOM order) → "Browse
  the store" → each `SpaceCard` in grid order. `Topbar` and sidebar precede
  `<main>` and are reachable via `SkipToContent`.
- **Keyboard:** every `SpaceCard` is a single focusable link (`role="link"`,
  Enter activates) — not nested interactive elements. Continue and Browse are
  real `<button>`/`<a>`. Visible focus ring = `border.focus` (3px indigo @ 35%,
  FOUNDATION elevation `focus`).
- **Status never by color alone:** progress rings pair the color (`mastery.*` /
  `status.success`) with the `"{pct}% complete"` / `"Completed"` text label;
  plan tier pairs chip color with the tier word.
- **ProgressRing aria:** `role="img"` with
  `aria-label="{pct} percent complete"`; or `role="progressbar"` with
  `aria-valuenow/min/max`.
- **Contrast:** all text/background pairs meet WCAG AA
  (`text.primary`/`text.secondary` on `bg.surface`/`bg.canvas`); spark CTA text
  uses `text.on-accent`.
- **Images:** thumbnails have meaningful `alt` (`"{space.title} cover"`);
  decorative empty-state illustration is `aria-hidden`.
- **Reduced motion:** `prefers-reduced-motion` disables hover lift, stagger, and
  entrance fades; transitions become instant. Spark glow is a static shadow (not
  animated), so it remains.
- **Live region:** on error→retry success, announce `"Your spaces loaded"` via a
  polite `aria-live` region so non-visual users get confirmation.

---

## 10. Web ↔ mobile divergence (FOUNDATION §6)

| Aspect             | Web                                             | Mobile (Expo / `ui-native`)                                                       |
| ------------------ | ----------------------------------------------- | --------------------------------------------------------------------------------- |
| Shell nav          | `ConsumerLayout` sidebar + `Topbar`             | Bottom **`Tabbar`** (My Learning · Store · Cart · Profile); no persistent sidebar |
| Card affordance    | hover lift `e1→e2`, title color shift           | press state (scale/opacity), no hover                                             |
| SpaceCard grid     | 1 / 2 / 3-up at base/sm/lg                      | always 1-up (or 2-up on tablets), vertical scroll                                 |
| Continue banner    | horizontal at md+ (thumb · ring · CTA)          | always stacked vertical                                                           |
| Command palette    | `⌘K` available via `CommandPalette` in `Topbar` | **absent** (no ⌘K on mobile)                                                      |
| Stats row          | 3-up `StatCard` grid                            | horizontal scroll strip or stacked, full-width                                    |
| Cart/notifications | `Topbar` icons                                  | `Tabbar` tab + header icon                                                        |
| Pull-to-refresh    | n/a (real-time + retry button)                  | native pull-to-refresh re-invokes repo reads                                      |

Component **names and props match 1:1** across `shared-ui` (web) and `ui-native`
(mobile) — only the renderer differs (`SpaceCard`, `ProgressRing`, `StatCard`,
`EmptyState`, `Button` are shared by name).

---

## 11. Claude-design prompt (ready to paste)

```
You are designing the "Consumer Dashboard / My Learning" screen for the Auto-LevelUp
STUDENT web app (B2C consumer learner home, route /consumer & /my-spaces).

STRICTLY conform to the Lyceum design system — Direction A "Modern Scholarly"
(docs/rebuild-spec/design/00-FOUNDATION.md). Compose ONLY from its tokens and
components; do NOT invent colors, fonts, spacing, radii, shadows, motion, or
component variants. Cite tokens by semantic name.

CONTEXT:
- User: a self-serve B2C learner with user.consumerProfile (plan, enrolledSpaceIds,
  totalSpend, purchaseHistory). No tenant role. Data is scoped to the synthetic
  platform_public tenant. Warm, encouraging, aspirational tone — celebrate progress,
  invite (never pressure) new learning.
- Rendered inside ConsumerLayout (AppShell: Topbar + sidebar on web, bottom Tabbar
  on mobile). Design the CONTENT REGION.

LAYOUT (top to bottom, vertical stack, gap = space-8):
1. Greeting: h1 "Welcome back, {firstName}" in Fraunces (display), subline in
   text.secondary.
2. Continue-learning banner (Card): thumbnail + ProgressRing (e.g. 62%) + spark
   Button "Continue". Microcopy "Lesson 8 of 13 · keep the momentum going". Shown
   only when an in-progress space exists. Horizontal at md+, stacked on mobile.
3. Plan summary: three StatCards — Plan (with tier chip), My spaces (count),
   Invested (currency-formatted total). Numerics in Spline Sans Mono.
4. "My spaces" Section: h2 "My spaces" + ghost button "Browse the store →", then a
   responsive grid of SpaceCard (enrolled variant: thumbnail, title, "{n} lessons",
   embedded ProgressRing, "{pct}% complete"; "Completed" success badge at 100%).
   Grid: 1-up base, 2-up sm, 3-up lg. Whole card links to /consumer/spaces/:id.

TOKENS / SYSTEM:
- Surfaces bg.surface on bg.canvas; text.primary / text.secondary; border.subtle;
  cards radius.lg, e1 at rest → e2 on hover; spark glow ONLY on the Continue CTA.
- Brand.primary for active/link accents; mastery.* / status.success for progress
  & completion. Never encode status by color alone — always pair with a text label.
- Motion: hover lift motion.fast/ease.standard; entrance fades motion.base/
  ease.entrance, staggered; NO count-up on numerics, NO CelebrationBurst here
  (the celebratory marigold burst is reserved for the learning surface at the
  moment of completion). Honor prefers-reduced-motion.

STATES to render: loading (Skeleton stats + card grid), empty (EmptyState — Fraunces
title "Your learning starts here", warm body, spark CTA "Explore the store"), error
(ErrorState distinct from empty, "Try again"), success.

ACCESSIBILITY: single h1/h2 hierarchy, <main> landmark, SpaceCards are single
focusable links, focus ring = border.focus, ProgressRing has aria-label, WCAG AA
contrast, reduced-motion respected.

Output: a clean, editorial, warm-but-precise dashboard. Deliver as React + Tailwind
using the shared-ui component names (AppShell, SpaceCard, ProgressRing, StatCard,
Section, Card, Button[spark], EmptyState, Skeleton, Badge). No new components.
```
