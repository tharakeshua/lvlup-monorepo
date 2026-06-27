# B2C Store — Space Detail — Design Spec

> Conforms to **Lyceum** (`docs/rebuild-spec/design/00-FOUNDATION.md`). All
> colors, type, spacing, radius, elevation, motion, and components are cited by
> token/name from the foundation — none are invented here. Emotional register:
> **warm + encouraging** (this is a consumer sales page, not staff tooling).

---

## 1. Purpose & primary user

**Primary user:** a **consumer / self-directed learner** browsing the public B2C
store (tenant `platform_public`) who has landed on a single space and is
deciding whether to **buy/enroll**.

**Job-to-be-done:** _"Show me exactly what this course gives me — the
curriculum, how much, what other learners thought — so I can confidently decide
to buy it (or, if I already own it, jump back in)."_

This is the **conversion surface** of the store. It must build trust (rating,
reviews, transparent syllabus, stats) and drive a single, obvious primary
action: **Enroll/Buy** rendered with the `spark` accent — the foundation's
reserved energy color (§2.2 `spark`).

---

## 2. Entry points & route

**Route:** `/store/:spaceId` → `StoreDetailPage`
(`apps/student-web/src/pages/StoreDetailPage.tsx`).

**Entry points:**

- `SpaceCard` click from the store grid (`/store`) — the primary path.
- Deep link / shared marketing URL.
- "View" affordance from the consumer cart (`useConsumerStore`).

**Common-API reads/writes** (per `docs/rebuild-spec/specs/common-api.md` — UI
goes through `api-client`, never `firebase/firestore` directly; the current page
reads Firestore directly and is migrated here):

| Action                                        | Callable (§3 levelup, §8 mapping)                                       | Notes                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Load hero + stats + price + `ratingAggregate` | `v1.levelup.getSpace`                                                   | **Store projection**: returns only store-safe fields of `Space` (`title`, `subject`, `labels`, `storeDescription`, `storeThumbnailUrl`, `price`, `currency`, `stats`, `ratingAggregate`, `type`). Rubric / class / answer-key fields stripped server-side. Resolves only when `publishedToStore === true`. |
| Syllabus preview                              | `v1.levelup.listStoryPoints`                                            | Returns ordered (`orderIndex`) `title`, `type`, `estimatedMinutes` **only** — no item bodies, no answers. `PageRequest`/`pageResponse` envelope (§7).                                                                                                                                                      |
| Reviews list                                  | reviews list endpoint (reads `spaces/{id}/reviews/{userId}` projection) | Paginated `SpaceReview[]` via `pageResponse(SpaceReview)`; aggregate breakdown comes denormalized on `getSpace.ratingAggregate`.                                                                                                                                                                           |
| Buy / enroll                                  | `v1.levelup.purchaseSpace`                                              | Accepts optional `idempotencyKey` (§ idempotency). On success → space mirrored into the consumer's `enrolledSpaceIds`.                                                                                                                                                                                     |
| Write a review (owned only)                   | `v1.levelup.saveSpaceReview`                                            | Gated to enrolled users; recomputes `ratingAggregate` server-side via trigger.                                                                                                                                                                                                                             |

Ownership is derived from
`user.consumerProfile.enrolledSpaceIds.includes(spaceId)` plus optimistic
`useConsumerStore.markPurchased`.

---

## 3. Layout — wireframe-as-text

Rendered inside the **consumer PlatformLayout** (a slimmed `AppShell`: store
Topbar with cart + profile, no role Sidebar — this is a public/consumer
surface). Page gutters per §4 (mobile 16 / tablet 24 / desktop 32); max content
width 1200, reading column 720 for `storeDescription`.

```
┌─ Topbar (consumer): logo · Store · search · cart · profile ──────────────────┐
│                                                                              │
│  ‹ Back to Store                                            (Breadcrumb/link) │
│                                                                              │
│  ┌────────────────── HERO CARD (Card, radius lg, e1) ─────────────────────┐  │
│  │  [ storeThumbnailUrl  16:9 cover, h-56 ]                               │  │
│  │  ──────────────────────────────────────────────────────────────────   │  │
│  │  h1 (Fraunces, text-2xl)  Space title                                  │  │
│  │  [subject Chip] [label Chip] [label Chip]      ★ 4.7 (128) ← rating    │  │
│  │  storeDescription (ContentRenderer, md+KaTeX, 720ch measure)           │  │
│  │  ┌ Stat ┬ Stat ┬ Stat ┬ Stat ┐  (lessons · items · est. time · enrolled)│ │
│  │                                                                        │  │
│  │  [ USD 49 ]   ┌──────────── Enroll Now (spark) ───────────┐  [ Cart ] │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  lg: two-column below the hero ───────────────────────────────────────────  │
│  ┌─────────────── MAIN (8/12) ────────────────┐ ┌──── ASIDE (4/12) ──────┐ │
│  │ Section "What you'll get"  (DefinitionList) │ │ Sticky Buy panel (lg)  │ │
│  │ Section "Curriculum"                        │ │  price · CTA · lock     │ │
│  │   StoryPointTrack (preview, locked nodes)   │ │  AnswerKeyLock note      │ │
│  │   StoryPointNode ×N  [lock if !owned]       │ │  rating summary mini     │ │
│  │ Section "Reviews"                           │ └────────────────────────┘ │
│  │   RatingAggregate breakdown (5★ bars)       │                            │
│  │   SpaceReview list (Avatar · stars · body)  │                            │
│  │   Pagination / "Load more"                  │                            │
│  └─────────────────────────────────────────────┘                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Responsive grid:**

- **sm (<640):** single column; hero stacks; stats wrap to a 2-up grid; sticky
  buy panel collapses into a **fixed bottom action bar** (price + spark CTA) so
  the primary action is always reachable.
- **md (768):** single column, wider; stats in one row; buy panel still inline
  (below hero).
- **lg (≥1024):** 8/4 two-column; the **Buy panel** in the aside becomes
  `position: sticky` (top offset = Topbar height + space-6).

---

## 4. Components used (from §5)

- **AppShell / PlatformLayout** (consumer variant — Topbar only, no role
  Sidebar), **Breadcrumb** ("‹ Back to Store").
- **Card** (hero + each section, radius `lg`, elevation `e1`), **Section**,
  **Panel** (sticky buy aside).
- **Chip/Tag** — `subject` (brand-tinted) and each `label` (neutral, with tag
  glyph).
- **ContentRenderer** — renders `storeDescription` (Markdown + KaTeX), the
  single rich-content path.
- **Stat/KPI** — "lessons" (`stats.totalStoryPoints`), "items"
  (`stats.totalItems`), "est. time" (Σ `estimatedMinutes`), "enrolled"
  (`stats.totalStudents`). Numerics in **Spline Sans Mono**.
- **StoryPointTrack** + **StoryPointNode** — the curriculum preview as the
  foundation's learning-path component, with nodes in **`mastery.notStarted`**
  styling and a **lock** overlay until owned.
- **AnswerKeyLock** — the server-only-guard visual, repurposed as the "content
  unlocks on purchase" note (honest signal that bodies/answers are withheld
  pre-purchase; see §8).
- **Button** variants: **`spark`** (primary Enroll/Buy CTA — the one place
  spark-glow elevation applies, §4 "spark glow"), **secondary/outline** (Add to
  Cart / Remove from Cart), **`primary`** ("Continue Learning" / Open when owned
  — uses `brand.primary`, **not** a raw emerald green).
- **Avatar** + star row for each **SpaceReview**; **Pagination** for the reviews
  list.
- **Skeleton** (loading), **EmptyState** (no reviews), **InlineAlert/Banner**
  (error), **Toast (sonner)** (purchase success), **ConfirmDialog**
  (paid-purchase confirm), **Tooltip** (locked-node hint).

**Proposed addition (justify):** **`RatingSummary`** — a small composite (big
average number in `text-4xl`/Fraunces + 5★ glyph row + per-star **ProgressBar**
distribution from `ratingAggregate.distribution`). It is pure composition of
existing §5 primitives (Stat + ProgressBar + Badge); register it in §5 as a
domain component rather than re-deriving it per screen.

---

## 5. States

**Loading (skeleton):** hero `Skeleton` (h-56 cover block + title bar + 3 text
lines + a CTA-sized block); curriculum shows 5 `StoryPointNode` skeleton rows;
reviews show 3 review-card skeletons. Use foundation `Skeleton` tokens (paper
shimmer, never gray SaaS).

**Empty (per-region, not whole-page):**

- No `storeDescription` → fall back to `description`, else: _"The author hasn't
  added a full description yet."_
- No reviews → `EmptyState`: icon + _"No reviews yet"_ / _"Be the first to share
  what you thought."_ (CTA only if owned).
- No thumbnail → BookOpen glyph centered on `bg.surface-sunken`.

**Error:** `getSpace` 404 / not-`publishedToStore` → full-region `InlineAlert`
(danger, `status.error`): _"This space isn't available in the store."_ +
Back-to-Store link. Reviews/curriculum failures degrade gracefully (region-level
alert); the hero stays usable so the user can still buy.

**Partial:** hero loaded but curriculum/reviews still fetching → render hero +
per-region skeletons (the buy decision shouldn't wait on reviews).

**Success:** full page; CTA reflects ownership.

**Permission-gated variations:**

- **Anonymous visitor:** can view everything; Enroll CTA routes to
  sign-in/checkout first.
- **Signed-in, not owned:** Enroll/Buy (spark) + Add/Remove Cart; cannot post a
  review.
- **Owned (enrolled):** CTA becomes **"Continue Learning" / "Open"**
  (`brand.primary`) → navigates to `/spaces/:spaceId`; curriculum nodes
  **unlock** (lock overlay removed); review composer enabled.
- **Free space (`price === 0`):** CTA reads **"Enroll Free"**, no cart, no
  confirm dialog, no payment step.

---

## 6. Interactions & motion (cite §4 tokens)

- **Page entry:** hero card fades+rises (`page` 420ms, `ease.entrance`);
  curriculum and review rows stagger in at `fast` 160ms each. Respect
  `prefers-reduced-motion` → opacity-only, no translate.
- **Enroll/Buy (paid):** click → **ConfirmDialog** ("Enroll in {title} for
  {currency} {price}?"). Confirm → `purchaseSpace.mutate` with `idempotencyKey`.
  Button enters `loading` ("Enrolling…", spinner). On success: **the single
  celebratory moment** allowed by §4 — a **spring pop + marigold burst** on the
  CTA, a success **Toast**, and the curriculum's lock overlays animate off
  (`base` 220ms, `ease.standard`). CTA morphs to "Continue Learning".
- **Enroll Free:** same flow without the ConfirmDialog (no payment).
- **Optimistic update:** on mutate success,
  `useConsumerStore.markPurchased([spaceId])` flips ownership immediately and
  `queryClient.invalidateQueries(["store-spaces"])` refreshes the grid; rollback
  on error.
- **Add to Cart / Remove from Cart:** instant toggle (`instant` 100ms), Toast
  confirm, no server round-trip (consumer store is local until checkout).
- **Curriculum node:** locked nodes are non-interactive (cursor not-allowed,
  lock glyph + Tooltip "Unlocks after purchase"). Owned → node press navigates
  into the story point.
- **Error:** `purchase.isError` → InlineAlert under the CTA with
  `purchase.error.message`; CTA returns to rest. Reduced-motion users get all of
  the above with transitions disabled (no burst).

---

## 7. Content & copy

**Tone:** warm, encouraging, second-person — this is consumer marketing, not
staff precision.

- **H1:** the space `title` (Fraunces, `text-2xl`).
- **Subject/labels:** as-is from data (Chips).
- **Rating line:** `★ {averageRating} ({totalReviews})` — mono numerals.
- **Stats labels:** "Lessons" · "Items" · "Est. time" · "Learners enrolled".
- **Price:** `Free` when `price === 0`, else `{currency} {price}` (`text-2xl`,
  mono).
- **Primary CTA:** owned → **"Continue Learning"**; free → **"Enroll Free"**;
  paid → **"Enroll Now"**; pending → **"Enrolling…"**.
- **Section headings:** "What you'll get" · "Curriculum" · "Reviews".
- **Unlock note (AnswerKeyLock):** _"Full lessons and practice unlock the moment
  you enroll."_
- **Empty reviews:** _"No reviews yet — be the first to share what you
  thought."_
- **Error (not in store):** _"This space isn't available in the store."_
- **Purchase error:** _"We couldn't complete your enrollment. Please try
  again."_
- **Purchase success Toast:** _"You're in! Jump into {title} whenever you're
  ready."_

---

## 8. Domain rules surfaced

- **Store visibility gate:** only spaces with `publishedToStore === true` are
  resolvable via the store projection of `getSpace`; the page lives under the
  `platform_public` tenant (`PLATFORM_PUBLIC_TENANT_ID`). `saveSpace` enforces
  `ALLOWED_TRANSITIONS` + `validatePublish` + the store-listing side effect
  (common-api §3) — a draft/archived or non-published space 404s here.
- **Content locked until purchased:** the syllabus preview exposes **only**
  `title`/`type`/ `estimatedMinutes` per story point. Item bodies, materials,
  questions, and **answer keys are never sent** to a non-owner — enforced
  server-side by the projection, surfaced visually by **AnswerKeyLock** + locked
  `StoryPointNode`s (the foundation's "answer-key never shown to students"
  invariant generalized to "content withheld pre-purchase").
- **Tenant isolation:** all reads are path-scoped to
  `tenants/platform_public/spaces/{spaceId}/…`; the API seam keeps the browser
  off direct Firestore (common-api §"Direct Firestore reads" migration).
- **Ratings are denormalized + server-computed:** `ratingAggregate`
  (`averageRating`, `totalReviews`, `distribution: Record<1..5, count>`) is
  recomputed by trigger on `saveSpaceReview`; the client never sums reviews
  itself.
- **Review eligibility:** `saveSpaceReview` is allowed only for enrolled users
  (`enrolledSpaceIds`), rating 1–5; one review per `userId` (doc id = `userId`).
- **Idempotent purchase:** `purchaseSpace` accepts `idempotencyKey` so a
  double-tap can't double-charge / double-enroll (common-api §idempotency).

---

## 9. Accessibility (WCAG AA)

- **Focus order:** Back link → hero CTA(s) → curriculum nodes → review composer
  (if owned) → review pagination. The sticky buy panel (lg) and the fixed mobile
  action bar reference the **same** CTA via `aria-controls`, never duplicating
  tab stops.
- **Keyboard:** all CTAs and cart toggles are real `<button>`s; ConfirmDialog
  traps focus and restores it to the CTA on close; locked story-point nodes are
  `aria-disabled` and skipped by tab.
- **ARIA:** rating renders an accessible label
  (`aria-label="Rated 4.7 out of 5, 128 reviews"`) — stars are decorative.
  Distribution bars use `role="img"` + label. Lock state announced via Tooltip
  text, not color alone (§2 "never encode status by color alone").
- **Contrast:** spark CTA uses `text.on-accent` on `spark` (≥4.5:1); price/stat
  mono text on `bg.surface` meets AA; chips meet 3:1 UI contrast.
- **Reduced motion:** the celebratory purchase burst, stagger, and rise are
  disabled under `prefers-reduced-motion` — replaced by an instant state swap +
  Toast.

---

## 10. Web ↔ mobile divergence

- **Sticky buy panel → fixed bottom action bar.** On web `lg`, the buy panel is
  a sticky aside; on RN (and web `sm`) it collapses to a pinned bottom bar
  (price + spark CTA), always visible.
- **Reviews list:** web may show a `Pagination` control; RN uses an
  infinite-scroll `FlatList` over the same `pageResponse` cursor (shared paging
  logic, common-api §7).
- **Hover → press:** curriculum-node Tooltips and chip hovers become long-press
  / inline helper text on RN.
- **No ⌘K:** the CommandPalette doesn't exist on the consumer mobile surface.
- **Confirm/Toast:** ConfirmDialog → RN bottom-sheet confirm; sonner Toast →
  `ui-native` toast; component **names/props match 1:1** between `shared-ui` and
  `ui-native` (§6) — only the renderer differs.
- **Image:** `storeThumbnailUrl` uses `loading="eager"` on web; RN uses a cached
  `Image` with a paper placeholder.

---

## 11. Claude-design prompt

```text
Design the "B2C Store — Space Detail" screen for the Auto-LevelUp consumer store, strictly conforming to
the Lyceum design system (docs/rebuild-spec/design/00-FOUNDATION.md). Do NOT invent colors, fonts, or
components — compose only from Lyceum tokens and the §5 inventory.

DIRECTION: "Modern Scholarly" — warm paper neutrals (bg.canvas / bg.surface), deep indigo brand.primary,
a single marigold `spark` accent reserved for the primary Buy CTA. Banned: Inter/Roboto, SaaS blue
#3B82F6, glass morphism, blob backgrounds, raw emerald greens. Use Fraunces for the H1/empty-state titles,
Schibsted Grotesk for body/labels/buttons, Spline Sans Mono for price + stats numerals.

LAYOUT: Consumer PlatformLayout (Topbar with cart + profile, no role Sidebar). "‹ Back to Store"
breadcrumb. A hero Card (radius lg, elevation e1): 16:9 storeThumbnailUrl, H1 title, subject + label Chips,
a RatingSummary (avg number + 5★ + distribution bars), storeDescription via ContentRenderer (md+KaTeX,
720ch measure), a Stat/KPI row (lessons / items / est. time / learners), then price + a `spark` "Enroll
Now" Button (use the spark glow elevation) with a secondary Add-to-Cart. Below the hero on lg: 8/4 grid —
MAIN = "What you'll get" DefinitionList, "Curriculum" StoryPointTrack with locked StoryPointNodes
(mastery.notStarted + lock overlay + AnswerKeyLock note "Full lessons unlock when you enroll"), and a
"Reviews" section (RatingAggregate breakdown bars + SpaceReview list with Avatar/stars + Pagination);
ASIDE = a sticky Buy Panel.

STATES: skeleton loading (paper shimmer), per-region empty (no reviews EmptyState), error (InlineAlert
"This space isn't available in the store"), owned state (CTA → brand.primary "Continue Learning", nodes
unlocked, review composer enabled), and free state (CTA "Enroll Free", no cart).

MOTION (§4): hero rises on entry (page 420ms, ease.entrance); on successful purchase fire the ONE allowed
celebratory moment — spring pop + marigold burst on the CTA + success Toast + locks animate off. Honor
prefers-reduced-motion.

DATA: bind to Space (title, subject, labels, storeDescription, storeThumbnailUrl, price, currency, stats,
ratingAggregate, type), story-point preview (title/type/estimatedMinutes only), and SpaceReview[]. Surface
the domain truth: content is locked until purchase; ratingAggregate is server-computed.

ACCESSIBILITY: WCAG AA contrast, real buttons, focus-trapped confirm dialog, accessible rating label,
status never by color alone. Provide responsive sm/md/lg behavior incl. a fixed bottom action bar on
mobile. Output clean React + Tailwind reading Lyceum CSS custom properties.
```
