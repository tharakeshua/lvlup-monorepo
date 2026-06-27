# Screen Spec — B2C Store: Space Detail

> Conforms to **Lyceum / Direction A — "Modern Scholarly"**
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). All colors, type, spacing,
> radii, elevation, motion, and components are cited by their FOUNDATION
> semantic-token / component names — never re-pasted, never invented. Student
> tone: warm, confidence-building, transparent about what's inside.

---

## 1. Purpose & primary user

**Primary user:** a **B2C consumer learner** (no tenant membership; served from
the synthetic `platform_public` tenant via `user.consumerProfile`). On web this
is the consumer marketplace, not the B2B school surface.

**Job-to-be-done:** _"I'm considering buying this learning space. Show me
honestly what's inside, how others rated it, and the price — then let me buy it
(or save it for later) with confidence."_ The screen must build trust **before**
purchase: transparent syllabus preview, an honest rating distribution, and clear
pricing, while keeping the actual graded content gated until enrolment.

Secondary user: an **already-enrolled owner** returning to write/edit a review
of a space they've completed enough of to have an opinion. Reviews can only be
written by enrolled owners (`saveSpaceReview` authorizes server-side on
enrolment).

---

## 2. Entry points & route

**Route:** `/store/:spaceId` (B2C tree, `ConsumerLayout`). Reached from:

- `StoreList` (`/store`) → `SpaceCard` tap.
- A shared/deep link (RN nav + web share both resolve `:spaceId`).
- Post-checkout "view what you bought" link.

**Reads/writes — all through `@levelup/api-client` (UI never touches
`firebase/firestore`):**

- **Read space:** `api.levelup.getSpace({ spaceId })` → the `Space` doc from
  `platform_public` (replaces today's inline
  `getDoc(tenants/platform_public/spaces/:id)`). Carries
  `storeDescription`/`description`, `subject`, `labels`, `price`/`currency`,
  `storeThumbnailUrl`, `stats.totalStoryPoints`/`totalStudents`, and the
  denormalized `ratingAggregate: SpaceRatingAggregate` (`averageRating`,
  `totalReviews`, `distribution`).
- **Read syllabus preview:** `api.levelup.listStoryPoints({ spaceId })` →
  `StoryPoint[]` ordered by `orderIndex`, projected to preview fields only
  (`title`, `type`, `estimatedMinutes`) — **no items / no answer keys**. (The
  store-listing variant returns a preview projection; full item content requires
  enrolment.)
- **Read reviews:** `api.levelup.listStoreSpaces`-adjacent review read via the
  reviews repo → `SpaceReview[]`
  (`/tenants/platform_public/spaces/:id/reviews/{userId}`), paginated (§7
  PageRequest).
- **Write review:** `api.levelup.saveSpaceReview({ spaceId, rating, comment? })`
  — upsert keyed on `userId`; server enforces "enrolled owner only." Returns the
  saved review; aggregate recomputed server-side.
- **Buy:** `api.levelup.purchaseSpace({ spaceId, idempotencyKey })` for
  free/single-buy; for paid multi-item, **Add to Cart** mutates `consumer-store`
  (Zustand, localStorage-persisted) and routes to `/store/checkout`.
- Enrolment state derives from `user.consumerProfile.enrolledSpaceIds`.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** → `ConsumerLayout` (consumer nav: My Learning /
Store / Cart / Profile; cart badge from `consumer-store`). Page gutters and max
content width per FOUNDATION §4 (max 1200; reading column 720 for the
description block). Vertical rhythm uses the spacing scale (`gap` 6 between
major regions, `gap` 4 within).

```
┌─ AppShell / ConsumerLayout ───────────────────────────────────────────────┐
│ Topbar (consumer): logo · Store · Cart(badge) · profile                    │
│ ┌────────────────────────────────────────────────────────────────────────┐│
│ │ ‹ Back to Store              (ghost Button, text.secondary)             ││
│ │                                                                          ││
│ │ ╭─ HERO — SpaceCard (variant="hero") ───────────────────────────────╮  ││
│ │ │ [storeThumbnail / fallback BookOpen on bg.surface-sunken]          │  ││
│ │ │ h1 (Fraunces) Space title                                          │  ││
│ │ │ Chip(subject, brand) · Tag chips(labels)                          │  ││
│ │ │ ⟨rating summary⟩  ★4.6 (Spline Mono)  · 128 reviews · 540 learners │  ││
│ │ ╰────────────────────────────────────────────────────────────────────╯  ││
│ │                                                                          ││
│ │  lg ≥1024: 2-col grid [ main 1fr | sticky aside 320px ]                  ││
│ │  ┌── MAIN (reading 720) ───────────────┐ ┌── ASIDE (sticky) ─────────┐  ││
│ │  │ "About this space" (h2 Fraunces)    │ │  PRICE PANEL (Card, e1)   │  ││
│ │  │ ContentRenderer(storeDescription)   │ │  ₹999  (Spline Mono, lg)  │  ││
│ │  │                                      │ │  [Buy now] (spark Button) │  ││
│ │  │ "What's inside" (h2)                 │ │  [Add to cart] (secondary)│  ││
│ │  │ Syllabus list (RubricBreakdown-      │ │  ── what you get ──        │  ││
│ │  │  style): n nodes, each              │ │  • N lessons · ~Xh         │  ││
│ │  │   [#] title · type · ~min · 🔒lock  │ │  • Lifetime access         │  ││
│ │  │  AnswerKeyLock affordance on gated   │ │  • Reviews-backed          │  ││
│ │  │  bodies → "Unlocks when you enrol"  │ └───────────────────────────┘  ││
│ │  │                                      │                               ││
│ │  │ "Ratings & reviews" (h2)            │                               ││
│ │  │  ⟨distribution bars 5→1⟩ ProgressBar│                               ││
│ │  │  [Write a review] (enrolled owners) │                               ││
│ │  │  Review list (SubmissionCard-like)  │                               ││
│ │  └──────────────────────────────────────┘                               ││
│ └────────────────────────────────────────────────────────────────────────┘│
│ Tabbar (mobile only): My Learning · Store · Cart · Profile                 │
└────────────────────────────────────────────────────────────────────────────┘
```

**Responsive behavior:**

- **lg ≥1024:** two-column — reading-width main column + **sticky** price/CTA
  aside (320px). Aside sticks below Topbar so Buy/Cart is always reachable while
  scrolling syllabus and reviews.
- **md 768–1023:** single column; price + CTA collapse into the hero region
  directly under the rating summary; syllabus and reviews stack full-width.
- **sm <768:** single column; the CTA becomes a **sticky bottom action bar**
  (price + spark Buy + cart icon) pinned above the mobile Tabbar so the primary
  action is never scrolled off; touch targets ≥44px.

---

## 4. Components used (FOUNDATION §5 only)

- **AppShell** + `ConsumerLayout`, **Topbar**, **Tabbar** (mobile),
  **Breadcrumb**/back affordance.
- **SpaceCard** — `variant="hero"` for the header (thumbnail, title, subject
  chip, labels, aggregate rating summary). Compact `SpaceCard` is _not_ used
  here; this is the detail surface.
- **ContentRenderer** — renders `storeDescription` (canonical Markdown + KaTeX)
  in the "About this space" block.
- **RubricBreakdown** — composed as the **syllabus list** (ordered node rows:
  index, title, type, estimated minutes). Each row's deeper content is gated.
- **AnswerKeyLock** — the gated-content affordance on each syllabus node and on
  the locked syllabus body: a legible "locked until enrolment" lock state (the
  absence of full content is made _visible_, not silently missing).
- **Button** — `spark` (Buy now / Enrol — the hero CTA glow), `secondary` (Add
  to cart / Remove), `ghost` (Back, Cancel review), `primary` not needed on the
  CTA since spark owns the buy moment.
- **Chip/Tag** — subject (brand tint) + label tags.
- **Stat/KPI** — "N lessons", "~X hrs", "M learners" summary stats (mono
  numerics).
- **ProgressBar** — the **review distribution** bars (5★→1★ proportions).
- **Card / Panel / Section** — price/aside panel, review cards, the syllabus
  container.
- **Avatar** — reviewer initial in each review row.
- **Badge** — "You" marker on the owner's own review; "Enrolled" badge when
  owned.
- **Star rating input** — keyboard-accessible radio-group star selector for the
  write-review form (see §9). **Proposed FOUNDATION addition** (below) — it is
  not yet a named §5 primitive.
- **Textarea**, **FormFieldError**, **Skeleton**, **EmptyState**,
  **InlineAlert/Banner**, **Toast (sonner)**, **ConfirmDialog**, **Pagination**
  (reviews), **CelebrationBurst** (purchase-complete moment only).

**Proposed FOUNDATION additions (flagged for promotion before build):**

1. **`StarRating`** — a keyboard-accessible 1–5 star input/display primitive
   (radiogroup semantics, read-only display variant, half-star aggregate
   display). It recurs across store detail, store list cards, and the in-app
   `SpaceReviewSection`, so it should be a named §5 primitive composed from
   `spark`/`status.warning`-family fill rather than re-invented per screen.
   Until promoted, treat stars as `spark`-filled icons with the a11y pattern in
   §9.
2. **`RatingDistribution`** — the 5→1 star histogram (rows of label +
   `ProgressBar` + count). Could be composed from `ProgressBar` + `Stat` ad hoc,
   but it recurs; flag for promotion as a small composite. No new tokens
   required either way.

---

## 5. States

- **Loading (skeleton):** hero `Skeleton` (thumbnail block + title bar + 2
  description lines + CTA block), aside price `Skeleton`, 4 syllabus-row
  skeletons, 2 review-card skeletons. Use `bg.surface-sunken` shimmer,
  `radius.lg` for cards. No layout shift between skeleton and loaded.
- **Empty — no reviews yet:** **EmptyState** under "Ratings & reviews": warm
  copy (§7). Distribution bars hidden; if enrolled owner, show the **Write a
  review** CTA prominently as the encouraged first action.
- **Empty — no syllabus preview:** if `listStoryPoints` returns none, show a
  small InlineAlert "Curriculum details coming soon" rather than an empty
  container; never imply the space is empty.
- **Error — space not found / failed load:** full-region **ErrorState** with
  Back-to-Store ghost Button and a Retry. Copy in §7. Distinct from empty (never
  render an error as an empty state).
- **Partial:** space loads but `ratingAggregate`/reviews fail → render hero +
  syllabus + price normally; reviews region shows its own inline ErrorState with
  Retry (a sub-region failure never blocks the buy path).
- **Success — not enrolled:** full detail; price panel shows Buy now (spark) +
  Add to cart (secondary); syllabus nodes show **AnswerKeyLock** affordance.
- **Success — in cart:** Add-to-cart becomes **Remove from cart** (secondary) +
  a "In your cart" Chip; Buy now still available.
- **Success — enrolled owner:** price panel replaced by an **"Enrolled"**
  Badge + **Continue learning** (primary) Button routing to
  `/consumer/spaces/:spaceId`; syllabus locks are removed (owner can see
  structure); **Write a review** CTA enabled.
- **Permission/role-gated:**
  - **B2C consumer** is the only intended audience here. A signed-out visitor
    sees the full marketing detail (public projection) but Buy/Add-to-cart
    prompt sign-in (route to consumer auth, preserving `returnTo`).
  - **Write-review** control renders **only** for enrolled owners; for
    non-owners it's absent (not disabled-with-tooltip) to avoid implying they
    could review without buying.
  - A **B2B school student** who lands here (edge case) sees the public detail
    read-only; purchase routes them to consumer sign-up — B2B and B2C are
    separate accounts.

---

## 6. Interactions & motion

All motion subtle per FOUNDATION §4 except the single gamification/celebration
moment. Respect `prefers-reduced-motion` everywhere.

- **Hero/card entrance:** fade+rise on mount, `motion.base` / `ease.entrance`.
  Sticky aside settles without bounce.
- **Buy now (spark):** press → optimistic disabled "Enrolling…" label,
  `motion.fast`. On `purchaseSpace` success: route to
  `/consumer/spaces/:spaceId` (free) or `/store/checkout` (paid cart). For a
  **completed free enrol**, fire the **CelebrationBurst** (spring pop + marigold
  `spark` burst) once — this is the reserved celebratory moment (purchase =
  gamified unlock). Reduced-motion → swap burst for a static success
  InlineAlert. On error → InlineAlert with `status.error` + retryable copy;
  button re-enables.
- **Add to cart:** optimistic — button flips to "Remove from cart" immediately,
  cart Topbar badge increments (`consumer-store`), `motion.fast`; a sonner
  **Toast** "Added to your cart" with an Undo. Failure rolls back the optimistic
  flip and toasts the error.
- **Syllabus lock:** hovering (web) / pressing (mobile) a locked node shows a
  Tooltip/Popover "Unlocks when you enrol" with the **AnswerKeyLock** icon; no
  content is fetched or revealed — the gate is purely presentational, content is
  server-withheld.
- **Write a review:** CTA expands the inline review **Card** (`motion.base`,
  `ease.standard`). Star selection gives instant fill feedback (no network).
  Submit → optimistic insert of the owner's review at top with a pending
  shimmer; `saveSpaceReview` resolves → aggregate + distribution bars animate to
  new values (`motion.slow`, width tween only). On failure → keep the form open,
  show FormFieldError, toast.
- **Edit own review:** pre-fills stars + comment; same submit flow;
  ConfirmDialog only on **Delete** (if offered) — not on edit.
- **Distribution bars:** animate width on first reveal with `motion.slow`; never
  re-animate on minor re-render.

---

## 7. Content & copy (warm, confidence-building, transparent)

- **Back:** `‹ Back to Store`
- **Hero rating summary:**
  `★ {averageRating} · {totalReviews} reviews · {totalStudents} learners` (mono
  numerals; if 0 reviews: hide stars, show `Be the first to rate this`).
- **About heading:** `About this space`
- **Syllabus heading:** `What's inside` — sub-line:
  `{N} lessons · about {hrs} of learning`
- **Locked node affordance (AnswerKeyLock):** `Unlocks when you enrol` (never
  "Locked" alone; frame as a forward invitation).
- **Price panel — what you get:** `Lifetime access` · `{N} guided lessons` ·
  `Practice + feedback as you go` · `Backed by {totalReviews} learner reviews`.
- **CTA labels:** `Buy now` (spark) · `Add to cart` · `Remove from cart` · free:
  `Enrol — it's free` · enrolled: `Continue learning`.
- **Ratings heading:** `Ratings & reviews`
- **Reviews empty state:** title `No reviews yet` · body
  `Once you've spent time here, your honest take helps the next learner decide. You could be the first.`
- **Write-review CTA:** `Share your experience` (new) / `Edit your review`
  (existing).
- **Review form:** label `How would you rate this space?` · comment placeholder
  `What worked for you? What could be better? (optional)` · submit `Post review`
  / `Update review` · cancel `Cancel`.
- **Purchase success toast/burst:** `You're in! Let's start learning.`
- **Add-to-cart toast:** `Added to your cart` · Undo `Undo`.
- **Error — load:** title `We couldn't load this space` · body
  `This might be a hiccup on our end. Let's try again.` · actions `Retry` ·
  `Back to Store`.
- **Error — purchase:**
  `That didn't go through. Your card wasn't charged — give it another try.`
- **Error — review save:** `Your review didn't post. Mind trying once more?`
- **Sign-in prompt (signed-out buy):**
  `Sign in to enrol — it only takes a moment.`

Tone rule: never punitive, never "Wrong/Failed" framing for the learner; errors
reassure (no charge, try again) and CTAs invite.

---

## 8. Domain rules surfaced

- **Content gated until purchase (preview only).** The syllabus shows structure
  (titles, types, estimated minutes) but **never item bodies, questions, or any
  answer content**. The preview projection is server-enforced (`listStoryPoints`
  store variant returns preview fields only). The **AnswerKeyLock** visual makes
  the gate legible — the absence of full content is shown as an intentional
  "unlocks on enrol" state, not a broken/empty list.
- **Answer-key is never shown to students.** Even though this is pre-purchase
  marketing, the same global rule holds: correct answers live in a server-only
  `answerKeys` subcollection denied to all clients. Nothing on this screen —
  preview, syllabus, or reviews — can surface stored answers. The client
  physically cannot read them.
- **Reviews only by enrolled owners.** `saveSpaceReview` authorizes server-side
  against `consumerProfile.enrolledSpaceIds`. The **Write a review** control is
  rendered only for owners; a non-owner cannot post (server rejects, UI doesn't
  offer it). One review per user (upsert keyed on `userId`); editing replaces,
  not appends. Aggregate (`averageRating`, `totalReviews`, `distribution`) is
  **server-recomputed**, never trusted from the client.
- **Tenant isolation (B2C).** All reads are scoped to the synthetic
  `platform_public` tenant; enrolment lives on `user.consumerProfile`. No B2B
  tenant data is reachable from this surface.
- **Purchase is server-authoritative & idempotent.** `purchaseSpace` accepts an
  `idempotencyKey`; the server dedupes (a double-tap or retry never
  double-charges or double-enrols). Enrolment state is derived from the server
  response / `consumerProfile`, never optimistically persisted as truth.
- **Gamification's one celebratory moment** is spent on **purchase/enrol
  complete** (CelebrationBurst). No celebratory bursts on add-to-cart, review
  submit, or page load — those stay subtle.

---

## 9. Accessibility

- **Focus order:** Back → hero (title is `h1`) → price CTA (Buy now first, then
  Add to cart) → About → syllabus nodes → Write-review CTA → review form (stars
  → comment → Post) → review list → Pagination. On `sm`, the sticky bottom CTA
  bar is reachable in tab order and not a focus trap.
- **Star rating input (keyboard-accessible — explicit requirement):**
  implemented as a **`radiogroup`** with five `radio` options.
  `aria-label="Rate this space, 1 to 5 stars"`; each star
  `aria-label="{n} star{s}"`, `aria-checked` on the selected value. **Arrow
  Left/Right** move and select the rating (Up/Down too), **Home/End** jump to
  1/5, **Space/Enter** confirm. Roving `tabindex` so the group is a single tab
  stop. Hover preview (mouse) must not change the committed value until click;
  keyboard selection commits on arrow. Read-only display stars use `role="img"`
  with `aria-label="Rated {avg} out of 5"` and are **not** focusable.
- **Distribution bars:** each row is a labeled `ProgressBar` with
  `aria-label="5 stars, {pct}% of reviews ({count})"`; never color-only — show
  the count and star label.
- **Locked syllabus nodes:** the **AnswerKeyLock** affordance carries
  `aria-label="Unlocks when you enrol"` (icon + text, never icon-only).
- **CTA legibility:** Buy/Enrol state changes are announced via an
  `aria-live="polite"` region ("Enrolling…", "You're enrolled"). Price is real
  text (mono), not an image.
- **Contrast:** all text/bg pairs meet WCAG AA per FOUNDATION §2; spark CTA text
  uses `text.on-accent`. Status never encoded by color alone (lock = icon+label;
  enrolled = badge text+icon).
- **Reduced motion:** CelebrationBurst, bar tweens, and entrance fades collapse
  to instant/static under `prefers-reduced-motion`.
- **Images:** thumbnail has descriptive `alt` (the space title); decorative
  fallback icon is `aria-hidden`.

---

## 10. Web↔mobile divergence (FOUNDATION §6)

- **CTA placement:** web `lg` uses a **sticky right-rail price panel**; mobile
  uses a **sticky bottom action bar** above the **Tabbar** (the right rail
  doesn't exist on mobile).
- **Hover→press:** locked-node Tooltip and review hover-fill become
  **press**/long-press affordances on mobile (Popover on tap); no hover state.
- **Navigation chrome:** web has the consumer **Topbar** (logo, cart, profile) +
  no command palette on this consumer surface; mobile uses the bottom **Tabbar**
  (⌘K / CommandPalette is web-only and not part of the consumer store flow).
- **Reviews:** web renders reviews as full-width cards with Pagination; mobile
  keeps the same `SubmissionCard`-style stacked cards (already card-shaped — no
  table→card transform needed here) with infinite-scroll "Load more" instead of
  numbered Pagination.
- **Star input:** identical `radiogroup` semantics; web supports hover-preview,
  mobile supports tap + drag-across-stars; both support the keyboard pattern
  where an external keyboard is attached.
- Component **names/props are 1:1** between `shared-ui` (web) and `ui-native`
  (mobile) per FOUNDATION §6; only the renderer differs (the same `SpaceCard`,
  `RubricBreakdown`, `AnswerKeyLock`, `StarRating`, `ContentRenderer`).

---

## 11. Claude-design prompt (ready to paste)

```
You are designing ONE screen for the Auto-LevelUp STUDENT (consumer/B2C) web app,
strictly conforming to the "Lyceum" design system (Direction A — Modern Scholarly)
defined in docs/rebuild-spec/design/00-FOUNDATION.md. Do NOT invent colors, fonts,
spacing, radii, shadows, motion, or component variants — compose only from FOUNDATION
§2 (semantic tokens: bg.canvas, bg.surface, bg.surface-sunken, text.primary/secondary/
muted, brand.primary, spark, border.subtle, status.success/error, radius.lg/md/pill,
e1/e2, motion.fast/base/slow + ease.standard/entrance) and §3 type (Fraunces display,
Schibsted Grotesk UI, Spline Sans Mono numerics).

SCREEN: B2C Store — Space Detail, route /store/:spaceId, inside AppShell → ConsumerLayout.
A consumer learner is deciding whether to buy a single learning space. Build trust BEFORE
purchase: transparent syllabus preview, honest rating distribution, clear price.

Compose from these FOUNDATION §5 components ONLY:
- SpaceCard (variant=hero): thumbnail/fallback, h1 title (Fraunces), subject Chip + label
  Tags, and a rating summary (★ avg in Spline Mono · N reviews · M learners).
- ContentRenderer for the "About this space" Markdown description (reading width ~720).
- A "What's inside" syllabus list composed as RubricBreakdown-style ordered rows
  (index · title · type · ~minutes). Each row's deeper content is GATED — show an
  AnswerKeyLock affordance labelled "Unlocks when you enrol". NEVER show item content
  or answers (server-withheld; the lock makes the gate legible).
- A sticky price/CTA panel (Card, e1) on lg: price (Spline Mono), a SPARK Button "Buy now"
  (this is the reserved hero CTA glow), a secondary "Add to cart", and a "what you get" list.
- "Ratings & reviews": a RatingDistribution histogram (5→1 rows of label + ProgressBar +
  count), a "Share your experience" CTA shown ONLY to enrolled owners, and a review list of
  SubmissionCard-style cards (Avatar initial, name, read-only stars, comment, "You" Badge).
- A keyboard-accessible StarRating input for the review form (radiogroup; Arrow keys select;
  Home/End jump 1/5; roving tabindex; read-only display variant uses role=img).

STATES: skeleton load; reviews-empty EmptyState ("No reviews yet…"); load ErrorState
distinct from empty (Retry + Back to Store); not-enrolled (Buy/Add-to-cart); in-cart
(Remove from cart + "In your cart" Chip); enrolled owner (Enrolled Badge + "Continue
learning" + Write-review enabled, locks removed); signed-out (Buy prompts sign-in).

MOTION: everything subtle (motion.base/ease.entrance) EXCEPT the ONE celebratory moment —
on a completed enrol fire a CelebrationBurst (spring pop + marigold spark). Add-to-cart and
review-submit stay subtle (optimistic + sonner Toast). Respect prefers-reduced-motion.

RESPONSIVE: lg ≥1024 two-col (reading main + sticky 320px price aside); md single column
with price under the hero; sm single column with a sticky bottom action bar above the
mobile Tabbar (touch targets ≥44px). Hover→press on mobile; no ⌘K on this consumer surface.

TONE: warm, confidence-building, transparent — invite, never pressure. Errors reassure
("Your card wasn't charged — give it another try"). Frame the gate as a forward invitation
("Unlocks when you enrol"), never a punitive lock.

DOMAIN RULES (must hold): syllabus is preview-only, content gated until purchase; answer
keys are never shown (server-only); reviews only by enrolled owners (one per user, upsert);
rating aggregate is server-recomputed; reads scoped to platform_public; purchase is
server-authoritative + idempotent.

Output: a single responsive React + Tailwind screen using shared-ui component names
(SpaceCard, ContentRenderer, RubricBreakdown, AnswerKeyLock, StarRating, ProgressBar,
Button[spark/secondary/ghost], Card, Chip, Tag, Avatar, Badge, Skeleton, EmptyState,
InlineAlert, Toast, CelebrationBurst). Tokens by semantic name only.
```
