# Space Reviews & Ratings — Design Spec

> Conforms to the **Lyceum** foundation
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). All tokens, type ramps,
> components, and motion are cited by name; none are invented.

## 1. Purpose & primary user

**Job-to-be-done.** Two registers, one surface:

- **Write (consumer / student, enrolled or purchased):** "I finished (or am
  working through) this space — let me tell future buyers whether it was worth
  it, with a star rating and a few honest words." One review per person,
  editable later.
- **Read (everyone — anonymous store browsers, prospective buyers, enrolled
  learners, staff):** "Before I spend money or time, show me what real learners
  thought — the average, the spread, and the words behind the number."

**Tone** is **encouraging** on the write side (low-friction, "you've earned a
voice") and **precise/neutral** on the read side (no inflated marketing — show
the real distribution including 1-stars).

## 2. Entry points & route

This is a **module**, not a standalone page. It renders in two host contexts and
shares one component tree:

| Host                      | Route                                                                     | Mode                                  |
| ------------------------- | ------------------------------------------------------------------------- | ------------------------------------- |
| B2C store detail (public) | `/store/spaces/:spaceId` → `#reviews` section + `?review=write` deep link | read-only by default; write CTA gated |
| Enrolled space (learner)  | `/spaces/:spaceId` → "Reviews" tab, and a post-completion prompt          | read + write                          |

**Common-API reads/writes** (cite `docs/rebuild-spec/specs/common-api.md`):

- **Display aggregate:** `v1.levelup.getSpace` returns the space doc including
  the denormalized **`SpaceRatingAggregate`** (`averageRating`, `totalReviews`,
  `distribution`). In the store list, `v1.levelup.listStoreSpaces` carries the
  same aggregate for card-level stars.
- **Review list:** read of `tenants/{tenantId}/spaces/{spaceId}/reviews`
  (paginated; ordered, see §8). Exposed through the levelup read seam alongside
  `getSpace`/`listSpaces` (§3.144 of common-api: "New read endpoints replacing
  direct Firestore reads"). Each doc is a **`SpaceReview`** at
  `reviews/{userId}`.
- **Write / edit:** `v1.levelup.saveSpaceReview` — upserts `reviews/{userId}`
  (doc id **is** the caller's `userId`, enforcing one-per-user) and is the
  side-effect that the aggregate trigger recomputes from (§8).
- **Eligibility:** purchase/enrollment is established elsewhere
  (`v1.levelup.purchaseSpace`, enrollment); the write CTA reads that membership
  state to gate (§5, §8).

## 3. Layout — wireframe-as-text

Hosted inside **AppShell** (sidebar + topbar) in the enrolled context, and
inside the public **PlatformLayout** store chrome in the B2C context. The module
itself is layout-agnostic and fills its column (reading max-width 720 per §4 for
the list; the aggregate panel may go full-width up to 1200).

```
┌─ Reviews section ────────────────────────────────────────────────┐
│  H2 "Reviews"  ·············································· [Write a review ▸] │   ← Button/spark (gated)
│                                                                  │
│  ┌─ AGGREGATE (Panel) ──────────────────────────┐               │
│  │  4.6      ★★★★★ (Spline Mono hero number)     │  Distribution │
│  │  /5       312 reviews                         │  5 ▓▓▓▓▓▓ 71% │  ← histogram rows
│  │  Fraunces 4xl                                 │  4 ▓▓▓   18%  │     ProgressBar
│  │                                               │  3 ▓     6%   │
│  │                                               │  2 ▏     3%   │
│  │                                               │  1 ▏     2%   │
│  └───────────────────────────────────────────────┘               │
│                                                                  │
│  [ Sort: Most helpful ▾ ]   [ Filter: All stars ▾ ]              │   ← Select controls
│                                                                  │
│  ┌─ ReviewCard ─────────────────────────────────┐               │
│  │ ◯ Avatar  Priya M.        ★★★★☆   · 3 days ago│               │
│  │ "The graph-theory track finally made BFS …"   │  ← comment    │
│  │ 👍 Helpful (24)                    [ Edit ]*   │  *own review  │
│  └───────────────────────────────────────────────┘               │
│  … (repeat)                                                       │
│  [ Load more reviews ]                       ← Pagination/cursor  │
└──────────────────────────────────────────────────────────────────┘
```

**Responsive grid:**

- **lg (≥1024):** Aggregate panel is a 2-column split — hero average (left
  ~360px) + distribution histogram (right, flexible). Review list is a single
  column at reading measure.
- **md (768–1023):** Aggregate stacks hero-over-histogram inside the Panel;
  controls row remains horizontal.
- **sm (<768):** Single column throughout. Sort/Filter collapse into a single
  `[ ☰ Sort & filter ]` button opening a **Drawer/Sheet**. "Write a review"
  becomes a full-width sticky-bottom Button.

The **write flow** renders as a **Modal/Dialog** on web (and Drawer/Sheet on
mobile, §10), not an inline expand, to keep the section scan-clean.

## 4. Components used (from §5 only)

- **Containers:** `Panel` (aggregate block), `Section` (the whole module),
  `Modal/Dialog` (write/edit form), `Drawer/Sheet` (mobile sort-filter + mobile
  write).
- **Data:** `Stat/KPI` (hero average + count), `ProgressBar` (each distribution
  row), `Avatar` (review author), `Badge` (e.g. "Your review", "Verified
  learner"), `EmptyState`, `Skeleton`, `Pagination` (cursor "Load more"),
  `DefinitionList` (n/a fallback).
- **Primitives:** `Button` (`spark` variant for the gated "Write a review" CTA;
  `secondary` for Edit; `ghost` for Helpful), `IconButton` (helpful thumb),
  `Select` (Sort, Filter), `Textarea` (comment), and a **star rating input**.
- **Feedback:** `Toast` (sonner) on save, `InlineAlert/Banner` (gating + error),
  `ConfirmDialog` (n/a — edits are non-destructive), `FormFieldError`.

**Proposed additions (justified — these are reusable rating primitives, added to
§5 Data on first use):**

- **`StarRating`** — anatomy: 5 glyphs; two modes: **display** (read-only,
  fractional fill for `averageRating`, `aria-label="4.6 out of 5"`) and
  **input** (interactive 1–5, keyboard-arrow adjustable, hover/press preview).
  Star fill uses **`spark`** (marigold-500) on filled, **`border.strong`** on
  empty. This is foundational to ratings everywhere (store cards, this screen)
  and is not expressible by an existing primitive.
- **`RatingDistribution`** — anatomy: 5 stacked rows, each
  `[star count] [ProgressBar] [percent]`, computed from
  `SpaceRatingAggregate.distribution` normalized by `totalReviews`. Pure
  composition over `ProgressBar` + `Stat`, registered as a domain component for
  reuse on store-detail.
- **`ReviewCard`** — anatomy: Avatar + author name + `StarRating(display)` +
  relative date header; comment body via plain text (no `ContentRenderer` —
  reviews are plaintext, not Markdown, to prevent injection); footer Helpful
  affordance + own-review Edit. Variant: `own` (subtle `spark`-tinted left
  border + "Your review" Badge).

## 5. States

- **Loading:** `Skeleton` for the aggregate hero (one large block + 5 short
  bars) and 3 `ReviewCard` skeleton rows. No layout shift — reserve the Panel
  height.
- **Empty (no reviews yet):** `EmptyState` with Fraunces title "No reviews yet".
  Body adapts by eligibility:
  - _Eligible writer:_ "Be the first to review this space." + `spark` Button
    "Write the first review".
  - _Not eligible / anonymous:_ "No reviews yet — enroll to be the first to
    share your experience."
  - Aggregate hero shows "—/5" and "0 reviews" (never a fake 0.0 or 5.0).
- **Partial:** aggregate loaded but list still paginating → show aggregate +
  first page, "Load more" with inline spinner. If `distribution` sums <
  `totalReviews` (eventual-consistency lag), render what exists and label hero
  from `averageRating` (the authoritative scalar), not from the histogram.
- **Error:** `InlineAlert` (status.error) "Couldn't load reviews. Retry." with a
  `ghost` Retry; the rest of the host page stays usable. Save error → `Toast`
  (error) "Couldn't save your review — try again." and the Modal stays open with
  the user's text intact.
- **Permission-gated variations:**
  - **Anonymous store browser:** read-only; "Write a review" is **hidden** (not
    disabled). Helpful actions disabled with tooltip "Sign in to vote".
  - **Authenticated, not enrolled/purchased:** "Write a review" replaced by
    `InlineAlert` (status.info) "Enroll to leave a review" linking to purchase.
  - **Enrolled, no review yet:** `spark` "Write a review" enabled.
  - **Enrolled, already reviewed:** their `ReviewCard` is pinned at top with
    "Your review" Badge + `secondary` "Edit"; the top-level CTA reads "Edit your
    review".
  - **Staff (teacher/admin):** read-only here; review **moderation** lives in a
    separate admin surface, not this consumer module.

## 6. Interactions & motion

- **Open write Modal:** `base 220ms` `ease.entrance`; backdrop fade
  `fast 160ms`. Star input focuses first.
- **Star input:** hover/press fills 1→N with `instant 100ms` per glyph;
  selecting commits. Required before submit.
- **Submit (`saveSpaceReview`):** **optimistic** — the user's `ReviewCard`
  appears/updates at top immediately and the aggregate hero nudges toward the
  new value with a `base` count-up on the Spline Mono number. On server ack,
  reconcile to the trigger-recomputed aggregate (the true `averageRating` may
  differ slightly from the optimistic guess — animate the correction over
  `slow 320ms`, no jump). On failure, roll back and surface the error Toast.
- **Helpful toggle:** optimistic increment, `fast` color shift of the thumb to
  `spark`; debounced write.
- **Sort/Filter change:** list cross-fades `fast 160ms` `ease.standard`;
  aggregate is unaffected (it summarizes all reviews regardless of filter).
- **First-review celebration:** writing your _first_ review for a space is a
  gamification moment — fire the ONE celebratory spring pop + marigold burst
  (§4) on the "Your review" Badge. Subsequent edits are silent.
- **Reduced motion:** count-ups become instant snaps; the burst becomes a static
  Badge; cross-fades become instant swaps.

## 7. Content & copy

- **Section heading (H2, Fraunces):** "Reviews"
- **Aggregate:** hero number Spline Mono; "{averageRating} /5", "{totalReviews}
  reviews" (text.secondary).
- **Controls:** "Sort" options — _Most helpful_ (default), _Most recent_,
  _Highest rated_, _Lowest rated_. "Filter" — _All stars_, _5_, _4_, _3_, _2_,
  _1_.
- **Write CTA:** "Write a review" / "Edit your review".
- **Write Modal:**
  - Title (Fraunces): "Review this space"
  - Star field label: "Your rating" (required) — error "Pick a star rating to
    continue."
  - Comment label: "Your review (optional)" placeholder "What worked, what
    didn't, who is this for?" — char counter, soft cap ~1500.
  - Submit: "Post review" / "Save changes"; secondary "Cancel".
- **Empty states:** see §5. Title "No reviews yet" (Fraunces), encouraging body.
- **Errors:** load — "Couldn't load reviews. Retry."; save — "Couldn't save your
  review — try again."; gating — "Enroll to leave a review."
- **Date:** relative ("3 days ago"), absolute on hover/long-press via Tooltip.
- **Tone:** writer-facing copy warm and low-stakes; reader-facing copy neutral
  and honest (never hide low ratings).

## 8. Domain rules surfaced

- **One review per user per space.** The doc lives at `reviews/{userId}` — the
  doc id is the caller's `userId`. `saveSpaceReview` is therefore an **upsert**,
  never a create-duplicate. The UI must treat "write" and "edit" as the same
  write path and reflect "already reviewed" state.
- **Aggregate is denormalized & trigger-maintained.** `SpaceRatingAggregate`
  (`averageRating`, `totalReviews`, `distribution`) lives on the **Space doc**,
  recomputed by a Firestore trigger on review write/delete — clients **never**
  compute or write it directly. The optimistic UI is a guess; the server value
  is authoritative (§6 reconcile).
- **`rating` is an integer 1–5** (`SpaceReview.rating`); `comment` is optional
  plaintext. No half-stars on input; fractional fill is **display-only** for the
  average.
- **Write is gated to enrolled/purchased users.** Eligibility derives from
  membership/`purchaseSpace`; the client gates the CTA but the **server
  re-validates** in `saveSpaceReview` (client gating is UX, not security).
- **Tenant isolation.** Reviews are namespaced under
  `tenants/{tenantId}/spaces/{spaceId}/...`; all reads/writes carry tenant
  context — no cross-tenant review bleed.
- **`userName` is denormalized** onto the review for display; treat as a
  snapshot (don't expect live profile updates).
- **Distribution may briefly disagree with count** during trigger lag — trust
  `averageRating`/`totalReviews` scalars for the hero, treat histogram as
  best-effort.

## 9. Accessibility

- **Focus order:** Write CTA → Sort → Filter → each ReviewCard (author → Helpful
  → Edit) → Load more. Modal traps focus, restores to the CTA on close.
- **StarRating (input):** exposed as a `radiogroup` (`role="radiogroup"` / 5
  `radio`), arrow keys move 1↔5, Home/End jump,
  `aria-label="Rating, 1 to 5 stars"`. **Never color-alone** —
  `aria-valuetext`/labels say "4 of 5 stars" (satisfies §2 "never encode by
  color alone").
- **StarRating (display):** single element,
  `aria-label="{averageRating} out of 5"`; not a focus stop.
- **Distribution rows:** each `ProgressBar` has
  `aria-label="{n} stars, {percent} of reviews"`.
- **Contrast:** marigold `spark` stars on `bg.surface` and all text pairs meet
  **WCAG AA** (4.5:1 body, 3:1 UI). Helpful "active" state pairs the spark color
  with a filled-thumb icon, not color alone.
- **Reduced motion:** honor `prefers-reduced-motion` per §4 — no count-ups, no
  burst.
- **Touch targets ≥44px** for stars, Helpful, and Edit (§4).

## 10. Web ↔ mobile divergence

- **Write surface:** web = `Modal/Dialog`; mobile (RN) = `Drawer/Sheet` bottom
  sheet. Same `StarRating`/`Textarea` props (1:1 per §6 cross-platform rule).
- **Sort/Filter:** web = inline `Select` row; mobile = single "Sort & filter"
  button → Sheet with native pickers.
- **Star input:** hover-preview (web) → press-and-drag preview (mobile); the
  gamification first-review pop uses Reanimated **spring** on mobile, CSS spring
  on web.
- **CTA placement:** mobile pins "Write a review" as a full-width sticky-bottom
  Button; web keeps it in the section header.
- **No ⌘K / CommandPalette** on mobile (§5 nav rule) — irrelevant here but no
  keyboard-only affordances are required.
- **Relative-date Tooltip** (hover) → long-press on mobile.
- **Component names/props identical** between `shared-ui` and `ui-native`; only
  the renderer differs (§6).

## 11. Claude-design prompt

```
You are designing the "Space Reviews & Ratings" module for Auto-LevelUp, STRICTLY conforming to the
Lyceum design system in docs/rebuild-spec/design/00-FOUNDATION.md. Do NOT invent colors, fonts, or
components — compose only from its tokens and §5 inventory.

CONTEXT
- A reviews module embedded in (a) the public B2C store-detail page and (b) the enrolled space "Reviews"
  tab. Read for everyone; write gated to enrolled/purchased users. One review per user (upsert at
  reviews/{userId}). Aggregate (averageRating, totalReviews, distribution{1..5}) is denormalized on the
  Space doc and trigger-maintained — clients never write it.

BUILD
1. An aggregate Panel: hero average (Spline Sans Mono, Fraunces label, "x.x /5" + "{n} reviews") beside a
   RatingDistribution (5 ProgressBar rows by star, percent of total).
2. A Sort (Most helpful default / Most recent / Highest / Lowest) + Filter (All / 5..1) control row.
3. A list of ReviewCards: Avatar, author name, display StarRating (fractional fill, spark/marigold-500
   filled, border.strong empty), relative date, plaintext comment, a ghost "Helpful" toggle, and an "Edit"
   action on the viewer's own review (pinned top, "Your review" Badge, spark-tinted left border).
4. A gated "Write a review" Button using the spark variant; opens a Modal (Dialog) with an interactive
   StarRating radiogroup (required) + optional Textarea (char counter). Submit = "Post review".
5. States: Skeleton loading; EmptyState "No reviews yet / Be the first to review this space"; InlineAlert
   error with Retry; gating InlineAlert "Enroll to leave a review" for non-enrolled.

RULES
- Tokens by name only: bg.canvas, bg.surface, text.primary/secondary, border.subtle/strong, brand.primary,
  spark, status.error/info. Type: Fraunces (h2 / hero number label), Schibsted Grotesk (body/labels/buttons),
  Spline Sans Mono (the average number, counts, percents). Radius lg cards / md inputs / pill badges.
  Elevation e1 cards, e3 modal. Motion: base 220ms ease.entrance modal; the user's FIRST review fires the
  one celebratory spring-pop + marigold burst; everything else subtle. Respect prefers-reduced-motion.
- Banned: Inter/Roboto, SaaS blue #3B82F6, glass morphism, blob backgrounds.
- A11y: StarRating input = radiogroup, arrow-key adjustable, aria-valuetext; never color-alone; WCAG AA;
  touch targets ≥44px.
- Responsive: lg = 2-col aggregate + single-column list; sm = stacked, sticky-bottom CTA, sort/filter in a Sheet.

Output React + Tailwind (@theme tokens) using shared-ui primitives (Button, Panel, ProgressBar, Avatar,
Badge, Select, Textarea, Modal, EmptyState, Skeleton, Pagination) plus the proposed StarRating,
RatingDistribution, and ReviewCard. Encouraging tone for the writer, neutral/honest for the reader.
```
