# B2C Store — Browse — Design Spec

> Conforms to the **Lyceum** foundation
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). All tokens, type, spacing,
> motion, and components are cited by name from that file — none are invented
> here. This is the **read side** of `space-store-listing`; the write/mirror
> side (`saveSpace` → store side effect) lives in the teacher publishing spec.

---

## 1. Purpose & primary user

**Primary user:** a **consumer (B2C, no tenant role) / self-directed learner**
who lands on the public marketplace without any organization affiliation.

**Job-to-be-done:** _"Help me discover a learning space worth buying — quickly
judge what it teaches, how others rate it, what it costs, and whether it's right
for me — then carry it toward checkout with confidence."_ This screen is
**discovery + evaluation**, not consumption. Success = the learner reaches a
`b2c-store-detail` page (or drops a space into cart) feeling oriented and
encouraged, not overwhelmed.

The tone here is the **warm/encouraging** register of Lyceum (FOUNDATION §1),
not the precise-staff register — this is a shopfront, so the **spark** accent
(marigold) earns more presence than on an admin screen.

---

## 2. Entry points & route

**Route:** `/store` (list root), with paging via opaque cursor (e.g.
`/store?after=<cursor>`). Component: `StoreListPage`
(`apps/student-web/src/pages/StoreListPage.tsx`). On RN this is the **Store**
tab in the consumer Tabbar.

**Entry points:**

- Direct/unauthenticated marketing link → store landing (the only public,
  tenant-less surface in LevelUp).
- Consumer dashboard "Browse the store" CTA.
- Topbar cart badge / "back to browse" from `b2c-store-detail` and
  `/store/checkout`.

**Common-API reads/writes** (cite `docs/rebuild-spec/specs/common-api.md`):

- **Read:** `v1.levelup.listStoreSpaces` (§8 mapping line 143; paginated).
  Backed by `functions/levelup/src/callable/list-store-spaces.ts`, which queries
  `tenants/platform_public/spaces where publishedToStore == true orderBy publishedAt desc`.
  Returns
  `StoreSpaceSummary { id, title, storeDescription, storeThumbnailUrl, subject, labels, price, currency, totalStudents, totalStoryPoints }`
  plus the paging shape. **Note:** the source today returns
  `{ spaces, hasMore, lastId }`; the rebuild MUST converge on the §7 canonical
  envelope `pageResponse(StoreSpaceSummary) = { items, nextCursor, total? }`
  with `PageRequest { cursor, limit≤100 }`.
- **Rating data:** each card's stars + count come from the denormalized
  `SpaceRatingAggregate` (`packages/shared-types/src/levelup/space-review.ts`:
  `{ averageRating, totalReviews, distribution }`), which the rebuild MUST add
  to `StoreSpaceSummary` (see §4 component-addition note) so browse can render
  rating without an N+1 per-card fetch.
- **Writes:** none server-side from this screen. **Cart is client-only**
  (`useConsumerStore.addToCart / removeFromCart / isInCart`); the purchase write
  (`v1.levelup.purchaseSpace`) happens later at checkout.
- **Enrollment check:** `useAuthStore().user.consumerProfile.enrolledSpaceIds`
  (already-owned spaces flip the CTA to "Continue Learning"); no extra call.

---

## 3. Layout — wireframe-as-text

Rendered inside the consumer **AppShell** (FOUNDATION §5 Navigation): Topbar
(logo, search affordance, **cart badge**, profile) + minimal Sidebar on `lg`
(Store / My Spaces / Account); no tenant switcher (consumer has no tenant). Page
max width 1200, gutters 16/24/32 (§4). Vertical rhythm `gap` 6 (24px).

```
┌── Topbar ───────────────────────────────────[ search ⌘K · 🛒 Cart(2) · avatar ]┐
│                                                                                  │
│  HERO / TITLE BAND                                                               │
│   h1 "Learn something that sticks"  (Fraunces text-2xl, tracking -0.02em)        │
│   sub "Browse spaces built by educators…"  (Schibsted, text.secondary)           │
│                                                                                  │
│  CONTROLS BAR  (sticky under topbar on scroll)                                   │
│   [🔎 Search spaces…              ] [Subject ▾] [Price ▾] [Sort: Popular ▾] [▦▤]│
│                                                                                  │
│  ── FEATURED ─────────────────────────────────────────────  (only page 1)      │
│   Section title "Featured" (Fraunces text-xl)                                    │
│   ┌ SpaceCard(featured) ┐ ┌ SpaceCard(featured) ┐ ┌ SpaceCard(featured) ┐       │
│   └─────────────────────┘ └─────────────────────┘ └─────────────────────┘       │
│                                                                                  │
│  ── BROWSE / RESULTS ─────────────────────────────────────────────────────────  │
│   "All spaces" · result count chip · active-filter chips (× to clear)            │
│   ┌ SpaceCard ┐ ┌ SpaceCard ┐ ┌ SpaceCard ┐    (grid)                            │
│   ┌ SpaceCard ┐ ┌ SpaceCard ┐ ┌ SpaceCard ┐                                      │
│                  … Pagination / [Load more spaces] …                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

**SpaceCard (store variant) anatomy** — top-to-bottom: `storeThumbnail` (16:9,
radius lg top, `BookOpen` placeholder on null) → **title** (Fraunces text-lg) →
`subject` Chip (pill) + up to 3 `labels` as Tag chips (+N overflow) →
`storeDescription` (2-line clamp, text.secondary) → **rating** (★ row +
`(totalReviews)` in Spline Mono) · `totalStudents` · `totalStoryPoints` lessons
→ footer row: **price/currency** (Spline Mono, `spark`-tinted; "Free" when 0) +
primary CTA.

**Responsive grid:**

- **sm (<640):** 1 col; controls stack vertically; sticky search; CTA
  full-width; featured collapses into the main feed with a "Featured" Chip on
  the card.
- **md (640–1024):** 2 cols; controls in one row with overflow into a "Filters"
  Sheet trigger if cramped.
- **lg (≥1024):** 3 cols; full inline controls bar; featured row of 3.

A **grid ⟷ list** view toggle (`▦`/`▤`) persists in local state; list view is a
horizontal SpaceCard (thumb left, meta center, price+CTA right) — useful for
dense price comparison.

---

## 4. Components used (from §5)

**Primitives:** `Button` (primary CTA "Add to Cart"; **spark** variant reserved
for a single hero CTA only, e.g. featured "Start free"; `secondary` "Continue
Learning"; `ghost`/`outline` "Remove from Cart"), `IconButton` (view toggle),
`Input` (search, leading `Search` icon), `Select`/`Combobox` (Subject, Price,
Sort), `Chip/Tag` (subject pill, `labels`, active-filter chips), `Badge` (cart
count, "Featured", "Owned").

**Containers:** `Section` (Featured / Browse bands), `Sheet` (mobile filters
drawer), `Popover` (price-range control), `Tooltip` (rating breakdown on hover).

**Data:** `EmptyState` (no-results), `Skeleton` (card grid loading),
`Pagination` **or** "Load more" (infinite cursor), rating stars row, `Stat`
micro (students / lessons), `Avatar` (author, if surfaced).

**Feedback:** `Toast` (sonner) for "Added to cart" / "Removed",
`InlineAlert/Banner` for load error, `LoadingOverlay` only on filter-induced
refetch of the results region (not the whole page).

**Navigation:** `AppShell`, `Topbar` (cart badge), `Tabbar` (mobile),
`CommandPalette` (⌘K → quick space search on web only).

**Domain components (§5):** **`SpaceCard`** — used in a **new `store` variant**.
The §5 `SpaceCard` exists for the learner library; the store variant adds
`storeThumbnail`, `price/currency`, `ratingAggregate`, and a store-mode CTA.
**Proposed addition (justified):** extend `SpaceCard` with a
`variant: 'library' | 'store'` prop and a `featured?: boolean` flag rather than
forking a new component — keeps one source of truth, satisfies "compose, don't
invent." Correspondingly, `StoreSpaceSummary` MUST gain a
`ratingAggregate: SpaceRatingAggregate` field (FOUNDATION §7.8 — denormalized
aggregate already exists on the Space doc) so the card renders stars without
per-card fetches.

No new colors/fonts/tokens are introduced.

---

## 5. States

- **Loading (skeleton):** 6 `Skeleton` cards matching the active grid/list
  layout — thumb block + 3 text bars
  - a CTA bar (mirrors the real card so layout doesn't jump). Controls bar stays
    interactive (disabled Selects show a quiet spinner). Featured band shows 3
    skeletons on page 1.
- **Empty (zero published spaces):** `EmptyState` with `Sparkles` icon, Fraunces
  title "The store is just getting started", body "New spaces are added
  regularly — check back soon." No clear-filters button (nothing to clear).
- **No-results (filters/search active but empty):** `EmptyState` "No spaces
  match that yet", body "Try a different subject or a broader search." +
  **"Clear filters"** `Button` (outline) that resets search + subject + price.
  Active-filter chips remain visible so the user sees _why_ it's empty.
- **Error:** `InlineAlert` (status.error) "We couldn't load the store right
  now." + **Retry** button (re-invokes `listStoreSpaces`). Featured/results
  regions show the alert in place; controls remain usable.
- **Partial:** first page rendered, more available → `nextCursor` non-null →
  "Load more spaces" button (or auto-load on scroll with a trailing skeleton
  row). A failed _subsequent_ page shows an inline retry under the grid, never
  wiping loaded cards.
- **Success:** grid/list of store SpaceCards; featured band on page 1 only.

**Per-card sub-states (permission/ownership-gated):**

- **Not owned, not in cart →** primary `Button` "Add to Cart" (or **spark**
  "Enroll Free" when `price === 0`).
- **In cart →** `outline` "Remove from Cart" + the card carries an "In cart"
  `Badge`.
- **Already owned** (`enrolledSpaceIds.includes(id)`) → `secondary` "Continue
  Learning" → routes to `/consumer/spaces/{id}`; an "Owned" `Badge` replaces the
  price CTA emphasis.

**Role variations:** consumers see the full shopfront. A **tenant student** who
reaches `/store` (school-affiliated) sees the same browse but cart/purchase CTAs
are replaced by a quiet "Available through your school" hint where tenant policy
disallows B2C purchase — gating decided server-side; browse stays read-only
either way.

---

## 6. Interactions & motion (cite §4 motion)

- **Search:** debounced ~250ms; the search term is applied server-side
  (`listStoreSpaces.search` title + `storeDescription` match) AND mirrored as
  client filter for instant feel. Results region cross-fades (`fast 160ms`,
  `ease.standard`); the rest of the page does not move.
- **Filter / sort change:** invalidates the query (new `cursor`-less page).
  Results region shows `LoadingOverlay` at 40% over the _previous_ cards (no
  full skeleton flash) for `base 220ms`; an active-filter **Chip** springs in
  (`ease.entrance`).
- **Add to cart (optimistic):** card CTA flips to "Remove from Cart" instantly,
  Topbar cart `Badge` increments with a subtle count tick, and a `Toast` "Added
  — <title>" fires. Since cart is client-state (`useConsumerStore`), there's no
  server round-trip to reconcile; nothing to roll back.
- **Card hover (web):** elevation `e1 → e2` (§4) + thumbnail subtle scale
  (1.0→1.02, `fast`); title shifts to `brand.primary`. **No** confirmation on
  cart add/remove (low-stakes, reversible). Removal from cart is a direct
  toggle, also Toast-confirmed.
- **Gamification restraint:** the ONE celebratory motion (FOUNDATION §4 — spring
  pop + marigold burst) is **not** spent here; it belongs to actual
  purchase/enrollment, not browsing. Store interactions stay subtle/`fast`.
- **Pagination:** "Load more" appends with a trailing skeleton row, then a
  `slow 320ms` fade-in of new cards; scroll position is preserved.
- All transitions honor `prefers-reduced-motion` (cross-fades become instant
  opacity; no scale).

---

## 7. Content & copy

Tone: **warm, encouraging, plain** (consumer register). Avoid hype; let ratings
and counts do the persuading.

- **Hero h1:** "Learn something that sticks" · **sub:** "Browse spaces built by
  educators and creators — buy once, keep forever."
- **Controls:** Search placeholder "Search spaces…"; filter labels "Subject",
  "Price", "Sort"; sort options "Most popular", "Newest", "Top rated", "Price:
  low to high", "Price: high to low".
- **Section titles:** "Featured", "All spaces".
- **Card labels:** price "Free" when 0 else `{currency} {price}` in Spline Mono;
  stats "{n} learners", "{n} lessons"; rating reads as "4.7 ★ (128)".
- **CTAs:** "Add to Cart" / "Enroll Free" / "Remove from Cart" / "Continue
  Learning".
- **Empty (store cold):** title "The store is just getting started" · body "New
  spaces are added regularly — check back soon."
- **No-results:** title "No spaces match that yet" · body "Try a different
  subject or a broader search." · button "Clear filters".
- **Error:** "We couldn't load the store right now." · button "Retry".
- **Cart toast:** "Added — {title}" / "Removed from cart".

---

## 8. Domain rules surfaced

- **Public-only catalog:** browse reads from `tenants/platform_public/spaces`
  and shows **only** `publishedToStore == true` docs, ordered
  `publishedAt desc`. Unpublished / draft / archived spaces and tenant-private
  spaces are **never** queryable here — store visibility is a server-enforced
  field, not a client filter (`list-store-spaces.ts`).
- **No tenant isolation leak:** `platform_public` is the single shared tenant
  for the marketplace; a consumer has no tenant role and the callable requires
  only minimal auth (`assertAuth`) — so the store works for any signed-in user
  but exposes nothing tenant-scoped.
- **Store fields are a curated projection:** cards render
  `storeDescription`/`storeThumbnailUrl` (falling back to
  `description`/`thumbnailUrl` server-side), `price`/`currency` (default `USD`,
  `0` ⇒ Free), and denormalized `stats.totalStudents` /
  `stats.totalStoryPoints`. The browse layer never reads story points, items, or
  answer keys — **answer-key / item content is never exposed pre-purchase**
  (FOUNDATION §7.8).
- **Ratings are denormalized & read-only here:** stars come from
  `SpaceRatingAggregate` on the Space doc; writing a review (`saveSpaceReview`)
  requires ownership and happens elsewhere — browse cannot rate.
- **Rate limiting:** `listStoreSpaces` enforces a `read` limit (60/window) per
  uid on `platform_public`; aggressive search/scroll must reuse cached pages
  (React Query `staleTime` ~5min) rather than re-hammer.
- **Pagination is cursor-based & opaque:** `limit ≤ 50` server cap (rebuild
  canonical `≤100`), cursor is a Firestore doc-id today; the client treats
  `nextCursor` as opaque (§7).
- **Cart ≠ ownership:** adding to cart mutates only client state;
  ownership/`enrolledSpaceIds` only changes after a successful `purchaseSpace`
  at checkout. The "Continue Learning" affordance is the sole signal of true
  ownership on this screen.

---

## 9. Accessibility (WCAG AA)

- **Focus order:** skip-link → search → filters (Subject, Price, Sort) → view
  toggle → featured cards → result cards (each card = one tab stop wrapping
  thumb+title link; CTA is a second stop) → "Load more". Logical source order
  matches visual.
- **Keyboard:** all Selects are `Combobox`/`Select` (arrow + type-ahead, Esc
  closes); view toggle is a radiogroup (←/→); cards reachable and
  Enter-activatable; "Load more" is a real `Button`. ⌘K command palette (web
  only) for quick search.
- **ARIA:** results region `role="region" aria-label="Store spaces"` with
  `aria-live="polite"` announcing "{n} spaces" after filter/search; rating
  exposes `aria-label="Rated 4.7 out of 5, 128 reviews"` (never stars alone);
  cart `Badge` `aria-label="Cart, 2 items"`. Each card's CTA names the space
  ("Add Algebra Foundations to cart").
- **Contrast & non-color encoding:** price uses `spark` text on `bg.surface`
  meeting ≥4.5:1; "Free" and "Owned" carry **icon + label**, never color alone
  (FOUNDATION §2 contrast rule). Active-filter chips state their value as text.
- **Reduced motion:** `prefers-reduced-motion` disables card scale/hover lift
  and cross-fades (instant); no parallax or auto-advancing featured carousel.
- **Images:** thumbnails carry `alt={title}`, `loading="lazy"`,
  `decoding="async"`; null thumb renders a decorative `BookOpen`
  (`aria-hidden`).

---

## 10. Web ⟷ mobile divergence (RN parity)

Component **names/props match 1:1** between `shared-ui` and `ui-native`; only
renderers differ (FOUNDATION §6).

- **Grid → cards/scroll:** web 1/2/3-col CSS grid; RN single-column `FlatList`
  of store SpaceCards with `onEndReached` cursor paging (replaces "Load more").
  The **list view toggle is web-only**.
- **Filters:** web = inline Selects in the controls bar; RN = a **"Filters"
  Sheet/Drawer** opened from a single button, with the same Subject/Price/Sort
  controls.
- **Hover → press:** web hover lift/title-color → RN `pressed` opacity/scale via
  `spring`; no hover-only rating tooltip (RN long-press or inline secondary line
  shows the review count).
- **No ⌘K on mobile:** CommandPalette is web-only; RN search is the persistent
  `Input` at the top.
- **Cart entry:** web Topbar cart `Badge`; RN cart in the Tabbar with a count
  badge. Touch targets ≥44px (§4).
- **Sticky controls:** both keep search/filters pinned on scroll; RN uses a
  sticky `FlatList` header.

---

## 11. Claude-design prompt

```text
Design the "B2C Store — Browse" screen for Auto-LevelUp, conforming EXACTLY to the Lyceum design system
in docs/rebuild-spec/design/00-FOUNDATION.md. Use ONLY its tokens and components — do not invent colors,
fonts, or variants, and respect the AI-slop ban (no Inter/Roboto, no #3B82F6 SaaS blue, no glass morphism).

CONTEXT: A public B2C marketplace for purchasable learning "spaces". The user is a consumer/self-directed
learner with no organization role. Tone = warm and encouraging (consumer register), with the marigold
"spark" accent earning more presence than on admin screens (use it on price emphasis and ONE hero CTA only —
never on every card). Background bg.canvas (paper-50), cards bg.surface with e1 at rest / e2 on hover.

TYPE: Fraunces for h1/section titles and card titles (display, -0.02em on large); Schibsted Grotesk for
body, labels, buttons; Spline Sans Mono for price and numeric stats (students, lessons, rating count).

LAYOUT (inside consumer AppShell — Topbar with cart Badge + ⌘K search, minimal Sidebar, no tenant switcher):
- Hero band: h1 "Learn something that sticks" + warm subhead.
- Sticky controls bar: search Input (leading Search icon), Subject Select, Price Select, Sort Select
  (Most popular / Newest / Top rated / Price asc / Price desc), and a grid/list IconButton toggle.
- "Featured" Section (page 1 only): 3 featured SpaceCards.
- "All spaces" Section: responsive grid of SpaceCards — 1 col (sm) / 2 (md) / 3 (lg) — with active-filter
  Chips and a result count, ending in a "Load more spaces" Button.

SpaceCard (store variant): 16:9 storeThumbnail (radius lg top; BookOpen placeholder when null) → title
(Fraunces) → subject Chip + up to 3 label Tags (+N overflow) → 2-line storeDescription clamp (text.secondary)
→ rating row (★ + "(128)" in mono, ARIA "Rated 4.7 out of 5, 128 reviews") · learners · lessons → footer:
price in Spline Mono spark-tinted ("Free" when 0) + CTA. CTA states: "Add to Cart"/"Enroll Free" (primary;
spark only for a featured hero), "Remove from Cart" (outline + In-cart Badge), "Continue Learning"
(secondary, when already owned — show an "Owned" Badge). Never encode state by color alone — pair icon+label.

STATES: skeleton grid (6 cards mirroring layout); empty store ("The store is just getting started");
no-results with active filters ("No spaces match that yet" + Clear filters); error InlineAlert + Retry;
partial with Load more. Optimistic add-to-cart: CTA flips instantly, Topbar cart badge ticks up, sonner Toast
"Added — {title}"; no confirmation dialog (low-stakes, reversible).

MOTION (§4): hover e1→e2 + thumb scale 1.02 (fast 160ms, ease.standard); filter change cross-fades the
results region only under a 40% LoadingOverlay (base 220ms) — page does not jump; honor prefers-reduced-motion.
Do NOT spend the celebratory spring/marigold-burst here — that belongs to purchase, not browse.

A11Y: aria-live polite result count; rating exposed as text; price ≥4.5:1 contrast; full keyboard path
search→filters→toggle→cards→Load more; ≥44px targets.

DATA (real fields from listStoreSpaces / StoreSpaceSummary): id, title, storeDescription, storeThumbnailUrl,
subject, labels[], price, currency, totalStudents, totalStoryPoints, ratingAggregate{averageRating,
totalReviews}. Cards link to /store/{id} (b2c-store-detail). Cart is client-only state.

Deliver a desktop (lg) and mobile (sm) frame. On mobile: single-column FlatList, filters in a Sheet, no
list-view toggle, no ⌘K, cart in the Tabbar.
```
