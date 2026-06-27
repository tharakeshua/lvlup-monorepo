# Student — B2C Store (Browse)

> Conforms to **Lyceum** (Direction A — "Modern Scholarly"). See
> `../00-FOUNDATION.md`. Tokens cited by semantic name; never re-pasted. Student
> tone: warm, inviting, value-forward — never pushy.

---

## 1. Purpose & primary user

**Primary user:** a **B2C consumer learner** — a self-serve learner with no
tenant membership, served from the synthetic `platform_public` tenant via
`user.consumerProfile`. (B2B school students do not see Store; their spaces are
class-assigned by teachers.)

**Job-to-be-done:** "Show me what I can learn here, help me judge whether a
space is worth my time and money, and let me line up the ones I want without
pressure." The Store is a calm catalog — a place to **browse and evaluate**, not
a checkout funnel that nags. It surfaces price, what's inside, and what other
learners thought, then gets out of the way. Already-enrolled spaces are
recognized and quietly invite the learner back in rather than re-selling.

---

## 2. Entry points & route

**Route:** `/store` → `StoreListPage`, composed under **`ConsumerLayout`** (B2C
shell: My Learning / Store / Cart / Profile). Reached from the ConsumerLayout
Sidebar ("Store"), the Consumer Dashboard "Discover more" rail, the mobile
Tabbar, and a "Browse →" affordance on the My Learning (enrolled) screen. A
`/store?after=<cursor>` deep link resumes a paged position.

**Reads (all via `@levelup/api-client`, Zod-validated, timestamps normalized to
epoch-ms at the repo edge — UI never touches Firestore):**

- `v1.levelup.listStoreSpaces` — the paginated public catalog mirror. Request
  carries `{ subject?, search?, cursor?, limit }` (unified `PageRequest`
  fragment, §7 common-api); response is `pageResponse(StoreSpace)` →
  `{ items, nextCursor, total? }`. Each `StoreSpace` projects the store-listing
  fields off the published `Space` doc: `id`, `title`, `storeDescription`,
  `storeThumbnailUrl`, `subject`, `labels[]`, `difficulty`, `price`, `currency`,
  `totalStudents`, `totalStoryPoints`, and the denormalized
  **`ratingAggregate { averageRating, totalReviews, distribution }`**
  (`SpaceRatingAggregate`). Server returns only spaces where
  `publishedToStore === true` and `accessType === 'public_store'`, scoped to
  `platform_public`.
- **Enrolled set** — `user.consumerProfile.enrolledSpaceIds` from `auth-store`
  (already in memory) drives the per-card **"owned"** state; no extra read.

**Cart (no read/write to the API):** the cart lives in **`consumer-store`**
(Zustand, persisted to `localStorage`) — `addToCart` / `removeFromCart` /
`isInCart` / `cart.length`. Purchase itself (`v1.levelup.purchaseSpace`) happens
later on the Checkout screen, not here.

**Writes:** none server-side. Add-to-cart is a local store mutation only. The
Store browse screen is read-only against the API.

**Query keys:** hierarchical factory — `storeKeys.list({ subject, search })`
with `useInfiniteQuery` paging on `nextCursor`; `staleTime` ~5 min (catalog is
slow-moving). `ratingAggregate` is **read-only** here (writing reviews happens
post-enrollment via `saveSpaceReview`, not in Store).

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** via **ConsumerLayout**. Page gutters per FOUNDATION
§4 (mobile 16 / tablet 24 / desktop 32), max content width 1200. The cart count
badge lives in the ConsumerLayout Topbar/Tabbar (shell-owned), not
re-implemented here.

```
┌─ AppShell (ConsumerLayout: Sidebar | Topbar: search · cart badge · profile) ─┐
│                                                                              │
│  ┌─ Page header ─────────────────────────────────────────────────────────┐  │
│  │  H1 "Explore the library"            [ subtle count: "48 spaces" ]      │  │
│  │  warm subhead: "Pick up something new — learn at your own pace."        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─ Filter / search / sort bar (gap-3, wraps) ───────────────────────────┐  │
│  │  [ 🔍 Search spaces…            ]   Subject ▾   Sort ▾                  │  │
│  │  Chip: All · Chip: <Subject…> · Chip: Free · Chip: <Difficulty…>       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─ SpaceCard (store variant) grid ──────────────────────────────────────┐  │
│  │  [SpaceCard$] [SpaceCard$] [SpaceCard$]                                 │  │
│  │  [SpaceCard$] [SpaceCard$] [SpaceCard$]                                 │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│             [ Load more spaces ]   ← cursor-paged, only if nextCursor       │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Responsive grid (CSS grid, `gap-6` desktop / `gap-4` mobile):**

- **< sm (640):** single column, full-width store SpaceCards. Search is
  full-width; Subject/Sort collapse into a single "Filter" IconButton that opens
  a **Sheet** (Drawer) with the chip filters + sort radio. Filter chips
  horizontally scroll. The grid/list view toggle is dropped on mobile (cards
  only).
- **sm–md (640–1023):** 2 columns. Search inline; Subject + Sort selects sit
  beside it.
- **≥ lg (1024):** 3 columns; full filter/sort bar visible. **≥ xl (1280):**
  still 3 (cards widen, never 4 — preserves the 60–72ch readable
  title/description and keeps price/rating legible).

**Store SpaceCard anatomy** (FOUNDATION §5 `SpaceCard`, **store variant**):
thumbnail header (or `BookOpen` placeholder on `bg.surface-sunken`) → **subject
tag** + **difficulty chip** (Chip/Tag, pill radius) → title (Fraunces, lg,
`text.primary`) → 1–2 line `storeDescription` (Schibsted, `text.secondary`,
line-clamp-2) → **labels** (up to 3 Chips, "+N" overflow) → **meta row**:
`totalStudents` learners · `totalStoryPoints` lessons (Schibsted, `text.muted`,
the counts in Spline Mono) → **rating row**: 5 stars (filled to `averageRating`)
**+ the numeral as text** "4.6 (213)" in Spline Mono → **footer**: **price**
(Fraunces or mono, prominent — `spark`-adjacent emphasis only via weight, not
color) on the left; **action Button** on the right (see States). Whole card is a
link to `/store/:spaceId` **except** the action Button (stops propagation).

---

## 4. Components used (FOUNDATION §5 only)

- **`SpaceCard` (store variant)** — the catalog tile: price, rating stars +
  numeral, subject/difficulty, learner/lesson counts, labels, owned/cart/buy
  action. The cross-app domain component, store-configured.
- **`Button`** — `spark` variant for **"Add to cart"** / **"Enroll free"** (the
  buy CTA gets the marigold energy accent, the one place energy is warranted in
  commerce); `secondary` for **"Continue learning"** (owned); `ghost`/`outline`
  for **"Remove from cart"**; `outline` for "Load more spaces" and "Clear
  filters".
- **`Input`** (search, with leading search icon), **`Select`** (Subject filter,
  Sort) — or, on mobile, a **Drawer/Sheet** wrapping these.
- **`Chip/Tag`** — quick filters (All · Free · Subject · Difficulty) and the
  per-card subject/difficulty/label pills.
- **`Badge`** — small "Free" / "Owned" markers where a chip is too heavy.
- **`Skeleton`** — card placeholders during load.
- **`EmptyState`** — no results / cleared-catalog state (warm copy + optional
  "Clear filters").
- **`ErrorState`** (distinct from empty) — load failure with retry.
- **`Pagination`** _or_ a "Load more" **Button** driving `useInfiniteQuery` over
  `nextCursor` (cursor-based; see Domain rules — no offset paging).
- **`Tooltip`** — on the rating row, explaining the aggregate ("Average of 213
  learner ratings").
- Shell-provided: **AppShell / ConsumerLayout / Sidebar / Topbar / Tabbar**
  (cart badge owned by the shell), **CommandPalette** (⌘K, web only).

**Proposed FOUNDATION additions:** none required. Two clarifications worth
promoting into the `SpaceCard` spec (anatomy detail, not new tokens/components):

1. **`SpaceCard` store variant** — formalize a `variant="store"` that adds the
   **price**, **rating (stars + numeral)**, and **owned/cart/buy action
   footer**. Today FOUNDATION lists `SpaceCard` generically; the store-specific
   slots should be named in its component spec so web + RN render identical
   anatomy.
2. **A reusable rating display** (stars + accessible numeral "4.6 (213)") used
   both here and on the Store Detail screen. If it would otherwise be
   duplicated, lift it into FOUNDATION §5 data components as `RatingStars` —
   flagged here so it is promoted into the foundation before invention. (No new
   color: stars use `spark` fill on `border.subtle` empties.)

---

## 5. States

- **Loading (skeleton):** the grid renders 6 `Skeleton` store-cards — thumbnail
  block + title bar + 2 description lines + meta row + a footer row (price
  block + action button placeholder). No spinner; layout never shifts.
  Filter/search bar stays interactive (filtering refetches into a fresh
  skeleton).
- **Empty — fresh catalog:** `EmptyState` (Fraunces title) — "Nothing here just
  yet" / "New spaces land regularly — check back soon." Warm `Sparkles` icon,
  `text.secondary` body.
- **Empty — filtered to nothing:** `EmptyState` — "No spaces match that" / "Try
  a different subject, or clear your filters." with a **"Clear filters"**
  `outline` Button (resets search + subject + difficulty + free chips).
- **Error:** `ErrorState` (distinct from empty) — "We couldn't load the library"
  / "That's on us — give it another go." with a **"Try again"** Button that
  retries the query. Uses `status.error` accent on the icon only; copy stays
  kind, never blames the learner.
- **Partial:** first page loaded, more available → "Load more spaces" Button (or
  paginated next). While fetching the next page, the button shows an in-button
  spinner; existing cards stay put (no reflow). If a page beyond the first
  fails, the loaded cards remain and an inline `InlineAlert` offers retry —
  never blow away what loaded.
- **Per-card success states (the three-way action):**
  - **Owned (already enrolled)** — card shows an **"Owned"** `Badge` near the
    price and a **`secondary`** Button **"Continue learning"** →
    `/consumer/spaces/:spaceId`. Price is de-emphasized (`text.muted`, struck or
    simply "Owned"). Never re-sell.
  - **In cart** — `outline`/`ghost` Button **"In cart — remove"** (toggles
    `removeFromCart`); a subtle "In cart" `Badge`.
  - **Available** — **`spark`** Button: **"Add to cart"** (paid) or **"Enroll
    free"** (when `price === 0`).
- **Free spaces:** `price === 0` renders the literal word **"Free"** (text, not
  just absence) and the CTA becomes **"Enroll free"**.
- **Permission/role variation:** Store is **B2C only**. A B2B `student` who
  somehow reaches `/store` (deep link) is redirected by the guard to their B2B
  home (`onMissingMembership` is irrelevant; this is the inverse — a tenant
  member has no `platform_public` shopping context). No B2B variant of this
  screen exists.

---

## 6. Interactions & motion

- **Search:** debounced (~250ms) `Input`; updates `storeKeys.list` query →
  server-side `search` param (server filters the `platform_public` mirror).
  Result swap cross-fades subtly (`motion.fast`, `ease.standard`). The
  empty-after-search state appears with `motion.base`.
- **Subject / Difficulty / Free chips & Sort:** toggling a chip or changing Sort
  refetches (subject/sort are server params where supported; pure client sort
  like price-low/high reorders in place with a `motion.fast` reorder). Active
  chip uses `brand.primary` fill + `text.on-accent`; inactive `border.subtle`.
  Selection never relies on color alone — active chips carry a check glyph /
  aria-pressed.
- **Add to cart (optimistic):** click → `consumer-store.addToCart` mutates local
  state instantly; the card's Button flips to **"In cart — remove"** with a
  quick `motion.fast` label cross-fade, and the **shell cart badge increments**
  (shell subscribes to `consumer-store.cart.length`). No server round-trip, so
  no rollback needed; a Toast (`sonner`) confirms "Added to cart" with an
  **Undo** action that calls `removeFromCart`. Tone is light, not celebratory.
- **No CelebrationBurst here.** Browsing/adding-to-cart is **commerce, not
  gamification** — per the global rule, the spring-pop + marigold burst is
  reserved for XP / streak / level-up / achievement / 100% completion. The Store
  stays in subtle motion only (`fast`/`base` durations, `ease.standard`). The
  marigold `spark` appears solely as the **buy Button accent**, not as a burst.
  (Any celebratory moment belongs _after_ purchase / first-lesson, on the
  learning surfaces — not in the catalog.)
- **Card hover (web):** `e1 → e2` elevation lift on `motion.fast`; title shifts
  to `brand.primary`. **Press (mobile):** brief scale/opacity press feedback, no
  hover.
- **Open detail:** clicking the card body (not the action Button) navigates to
  `/store/:spaceId` (`page` transition). The action Button `stopPropagation`s so
  "Add to cart" never accidentally navigates.
- **Load more:** appends the next cursor page; focus is preserved (does not jump
  to top); the newly appended row gets a single `motion.base` fade-in.
- **Confirmation:** none needed for add/remove (cheap, reversible, Undo-backed).
  Purchase confirmation lives on Checkout, not here.

---

## 7. Content & copy

- **H1:** "Explore the library" (or "Browse spaces"). Subhead: "Pick up
  something new — learn at your own pace." Count chip: "48 spaces".
- **Search placeholder:** "Search spaces…"
- **Filter labels:** "All", "Free", subject names, difficulty names ("Beginner /
  Intermediate / Advanced"). Sort options: "Newest", "Most popular", "Price: low
  to high", "Price: high to low".
- **Card CTA copy:** "Add to cart" · "Enroll free" · "In cart — remove" ·
  "Owned" + "Continue learning".
- **Price copy:** "Free" for zero; otherwise `{currency} {price}` with the
  currency shown explicitly (e.g. "₹499", "$12") — currency is **always rendered
  as text**, never implied by symbol-less number.
- **Rating copy:** stars **plus** the readable numeral: "4.6 (213)" — and an
  aria-label "Rated 4.6 out of 5 from 213 learners". When `totalReviews === 0`:
  "New — no ratings yet" (not "0 stars"; framed as fresh, not failed).
- **Meta copy:** "1,204 learners", "12 lessons" (use `totalStoryPoints` →
  "lessons", `totalStudents` → "learners").
- **Empty (fresh):** "Nothing here just yet" / "New spaces land regularly —
  check back soon."
- **Empty (filtered):** "No spaces match that" / "Try a different subject, or
  clear your filters." + "Clear filters".
- **Error:** "We couldn't load the library" / "That's on us — give it another
  go." + "Try again".
- **Toast:** "Added to cart" (with "Undo"); "Removed from cart".
- **Tone guardrails:** value-forward, not pushy — never "Buy now!", "Last
  chance", scarcity/urgency, or fake discounts. Describe value, show real social
  proof (ratings), let the learner decide.

---

## 8. Domain rules surfaced

- **B2C tenant isolation:** the catalog is read **only** from the synthetic
  **`platform_public`** tenant; owned-state is keyed off
  `user.consumerProfile.enrolledSpaceIds`. No B2B tenant data is ever reachable
  here. The server returns only `publishedToStore === true`,
  `accessType === 'public_store'` spaces.
- **Price & currency are explicit and trustworthy:** every paid card shows
  `{currency} {price}` as **text**; free shows the word "Free". No symbol-only
  numbers, no hidden currency. The browse screen never charges — purchase is a
  deliberate, separate Checkout step (`v1.levelup.purchaseSpace`); add-to-cart
  is purely local (`consumer-store` / `localStorage`).
- **Ratings are read-only aggregates here:** `ratingAggregate` (`averageRating`,
  `totalReviews`, `distribution`) is **denormalized** and display-only. A
  learner can only _write_ a review after enrolling, on the learning surface
  (`v1.levelup.saveSpaceReview`) — never from the Store catalog. Never present
  an unrated space as "0 stars / bad"; show "New — no ratings yet".
- **No celebratory motion in commerce:** the one CelebrationBurst moment is
  reserved for gamification (XP/streak/level/achievement/100%). The Store's only
  spark accent is the buy Button; adding to cart is subtle, Toast-confirmed, not
  burst-celebrated.
- **No answer-key / assessment leakage:** the Store shows _marketing_
  projections of a space (description, lesson count, rating) — never its items,
  questions, or any answer-key material. (The server-only `answerKeys`
  subcollection is denied to all clients regardless; nothing in `StoreSpace`
  exposes content internals.)
- **Cursor pagination (server-encoded, opaque):** paging uses the unified
  `PageRequest`/`pageResponse` cursor fragment; the client treats `nextCursor`
  as opaque and never computes offsets. `/store?after=<cursor>` resumes
  position.

---

## 9. Accessibility

- **Focus order:** Search → Subject Select → Sort Select → filter Chips (in DOM
  order) → each card (card link, then its action Button as the next stop) →
  "Load more". A `SkipToContent` jump lands focus on the grid heading.
- **Keyboard:** Selects and Chips are fully keyboard-operable (arrow/enter,
  space to toggle chips with `aria-pressed`). Each card is a link (`Enter`
  activates); the action Button is a separate, reachable focus target inside the
  card (Tab order: card → button). ⌘K CommandPalette available on web. "Load
  more" is a standard button.
- **ARIA:** card has `aria-label` summarizing title + price + rating ("Calculus
  Foundations, ₹499, rated 4.6 from 213 learners"); rating row exposes the
  **text numeral** for SRs, not just star glyphs (stars are `aria-hidden`, the
  "4.6 (213)" text is the accessible value). Owned/in-cart/free states are
  conveyed by **text + Badge**, not color alone. Toasts are announced via the
  `sonner` live region; "Added to cart" + Undo reachable.
- **Contrast:** price, rating numeral, and meta text meet WCAG AA (4.5:1 body)
  on `bg.surface`; star fill (`spark`) paired with the text numeral so the
  rating is never color-only. Active filter chips carry a check glyph in
  addition to `brand.primary` fill.
- **Reduced-motion:** `prefers-reduced-motion` removes hover lifts, card press
  scales, result cross-fades, and the load-more fade-in — content swaps
  instantly. (No celebratory motion exists here to suppress.)
- **Touch targets:** action Buttons and chips ≥44px on mobile.

---

## 10. Web↔mobile divergence (FOUNDATION §6)

- **Filters:** web shows the inline search + Subject/Sort Selects + chip row;
  **mobile** collapses Subject/Sort (and difficulty/free chips) into a single
  **Filter** IconButton → **Drawer/Sheet** with the same controls; search stays
  inline full-width.
- **View toggle:** web may offer grid/list; **mobile is cards-only** (drop the
  list toggle).
- **Grid:** 3-col (lg+) → 2-col (sm–md) → 1-col stacked cards (mobile), matching
  the table→stacked-cards rule.
- **Hover → press:** web hover elevation/title-color cues become press feedback
  on mobile; no hover states.
- **⌘K:** CommandPalette is **web only**; absent on mobile (bottom Tabbar
  handles nav). Cart badge is in the Topbar on web, in the bottom **Tabbar** on
  mobile.
- **Paging:** web "Load more" button or `Pagination`; mobile prefers **infinite
  scroll** appending the next cursor page on scroll-end.
- Component **names and props are identical** between `shared-ui` (web) and
  `ui-native` (mobile) — `SpaceCard` store variant renders the same anatomy;
  only the renderer differs.

---

## 11. Claude-design prompt (ready to paste)

```
Design the **B2C Store — Browse** screen for the Auto-LevelUp STUDENT (learner) web app,
conforming to the "Lyceum" design system (Direction A — "Modern Scholarly"). Read and obey
docs/rebuild-spec/design/00-FOUNDATION.md: use ONLY its semantic color tokens (bg.canvas,
bg.surface, bg.surface-sunken, text.primary/secondary/muted, brand.primary, spark, border.subtle,
status.error, radius.lg/md/pill, e1/e2, motion.fast/base, ease.standard), its type families
(Fraunces display, Schibsted Grotesk UI, Spline Sans Mono for price/rating/counts), and its
spacing/elevation/motion scales. Do NOT invent colors, fonts, radii, shadows, or component variants.

Context: this is the B2C consumer catalog at route /store, inside ConsumerLayout (Sidebar:
My Learning / Store / Cart / Profile; cart badge in the shell Topbar). It reads
v1.levelup.listStoreSpaces (paginated platform_public mirror) returning StoreSpace items with
title, storeDescription, storeThumbnailUrl, subject, labels[], difficulty, price, currency,
totalStudents, totalStoryPoints, and ratingAggregate { averageRating, totalReviews }. The cart is
local (consumer-store / localStorage); no purchase happens on this screen.

Build:
- A page header: H1 "Explore the library" (Fraunces) + warm subhead + a subtle space count.
- A filter bar: search Input (leading icon), Subject Select, Sort Select (Newest / Most popular /
  Price low→high / Price high→low), and quick Chips (All · Free · subjects · difficulties).
  On mobile, collapse Subject/Sort/chips into a Filter button → Sheet; search stays inline.
- A responsive SpaceCard (STORE variant) grid: 3 cols ≥1024, 2 cols 640–1023, 1 col stacked <640.
  Each card: thumbnail (or BookOpen placeholder), subject + difficulty chips, title (Fraunces lg),
  2-line description, up to 3 label chips (+N overflow), meta row (learners · lessons, counts in
  Spline Mono), a rating row showing 5 stars filled to averageRating PLUS the readable numeral
  "4.6 (213)" in mono, and a footer with PRICE on the left (text: "Free" or "{currency} {price}",
  e.g. "₹499") and a three-way action Button on the right:
    • owned (enrolled) → "Owned" badge + secondary "Continue learning"
    • in cart → outline "In cart — remove"
    • available → SPARK (marigold) button "Add to cart" (or "Enroll free" when price is 0).
  The card body links to /store/:spaceId; the action button stopPropagation.
- States: 6-card skeleton loading; warm EmptyState (fresh and filtered-to-nothing + "Clear filters");
  distinct ErrorState with "Try again"; a "Load more spaces" button for cursor paging.

Motion: subtle only (motion.fast/base, ease.standard) — hover elevation e1→e2 and title→brand.primary
on web, press feedback on mobile. Add-to-cart is optimistic with a Toast ("Added to cart" + Undo).
NO CelebrationBurst — commerce is not gamification; the only marigold is the buy button accent.

Tone: warm, inviting, value-forward, NEVER pushy — no urgency/scarcity/"Buy now". Price and currency
ALWAYS rendered as text; rating always shows a text numeral (not stars/color alone); unrated spaces
read "New — no ratings yet", never "0 stars". Owned/in-cart/free conveyed by text + Badge, not color.

Accessibility: each card has an aria-label summarizing title/price/rating; stars are aria-hidden with
the numeral as the accessible value; active chips use aria-pressed + a check glyph (not color alone);
WCAG AA contrast; honor prefers-reduced-motion (no hover lifts / cross-fades). Touch targets ≥44px.
```
