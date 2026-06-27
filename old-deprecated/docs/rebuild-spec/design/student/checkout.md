# Student-Web — B2C Checkout (Cart & Purchase)

> Conforms to **Lyceum** design system (Direction A — "Modern Scholarly"). See
> `docs/rebuild-spec/design/00-FOUNDATION.md`. All tokens cited by semantic
> name; do not re-paste scales. Tone: warm, trustworthy, low-anxiety — clear
> pricing, no dark patterns, no pressure.

---

## 1. Purpose & primary user

**Primary user:** B2C **consumer learner** (self-serve, no tenant membership,
served from the synthetic `platform_public` tenant via `user.consumerProfile`).
Not a B2B school student — school students never see the store or checkout
(their spaces are assigned, tenant-scoped).

**Job-to-be-done:** _"I picked one or more spaces I want to learn from. Let me
confirm what I'm getting, see exactly what it costs, pay (or enroll free)
without anxiety, and land in my learning right away."_

The screen's whole job is **confidence + clarity + a clean handoff into
learning**. It is a transactional surface, so it deliberately stays quiet — the
celebratory energy is reserved for the learning itself (see §8).

---

## 2. Entry points & route

**Route:** `/store/checkout` (B2C route tree, rendered inside `ConsumerLayout`;
`LearnerContext = consumer`).

**Entry points:**

- Cart badge / "Cart" item in the consumer nav (count from `consumer-store`).
- "Proceed to checkout" CTA on the cart drawer/store.
- Direct deep link (cart is restored from `localStorage`).

**Reads / writes (all via `@levelup/api-client`; UI never touches Firebase
directly):**

| Concern                                                         | Source                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cart line items (spaceId, title, price, currency, thumbnailUrl) | `consumer-store` Zustand slice — persisted to `localStorage` key `levelup-consumer` (`partialize` → `cart` only). Selectors: `useCart()`, `useCartCount()`, `cartTotal()`. Cart is **client-only state**, not a server read.                                                                                                        |
| Live price/availability re-validation (recommended addition)    | `v1.levelup.listStoreSpaces` / a `v1.levelup.getSpace` (store projection) — used to re-confirm price & `publishedToStore` at checkout time so the displayed total can't go stale (see §5 partial state).                                                                                                                            |
| Purchase (per space)                                            | **`v1.levelup.purchaseSpace`** `{ spaceId, paymentToken?, idempotencyKey }` → `{ success, transactionId }`. Server: verifies `publishedToStore`, blocks already-enrolled, appends a `PurchaseRecord` to `consumerProfile.purchaseHistory`, `arrayUnion`s `enrolledSpaceIds`, increments `totalSpend` + store `stats.totalStudents`. |
| Post-success enrolled spaces                                    | `consumer-enrolled-spaces` query invalidated → My Learning re-reads `user.consumerProfile.enrolledSpaceIds`.                                                                                                                                                                                                                        |

**Idempotency (contract-level, per common-api §"Idempotency"):** `purchaseSpace`
accepts an optional `idempotencyKey`; the server dedupes. The client generates
**one stable key per (spaceId, checkout-session)** so a retry, double-click, or
network re-send **never double-charges or double-enrolls**. Today the gateway is
a stub (`transactionId` from an auto-id, `paymentToken` reserved); the design
leaves a **real-gateway slot** (§6) so swapping in Stripe/Razorpay/etc. touches
only the payment step, not the layout.

**Note on current implementation drift:** the present `CheckoutPage.tsx` loops
`callPurchaseSpace({ spaceId })` sequentially with no `idempotencyKey`, surfaces
partial failures as a flat error list, and shows a full-page success takeover.
The rebuild replaces this with the spec below (per-line idempotent purchase,
explicit partial-success reconciliation, tasteful inline success).

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** via `ConsumerLayout` (consumer Sidebar: My Learning
/ Store / Cart / Profile; mobile Tabbar). Page content max-width follows
FOUNDATION §4 (max 1200; this page sits comfortably ≤ 1000 centered). Page
gutters per breakpoint.

```
┌─ AppShell (ConsumerLayout: Sidebar + Topbar; mobile = Tabbar) ──────────────┐
│                                                                              │
│  ← Back to Store            (ghost Button, text.secondary, ArrowLeft)        │
│                                                                              │
│  Checkout                                       (Fraunces 2xl, text.primary) │
│  Review your spaces before you start learning.  (text.secondary, sm)         │
│                                                                              │
│  ┌──────────────────────────────┐   ┌──────────────────────────────────┐    │
│  │ CART LIST (lg: col-span-2)   │   │ ORDER SUMMARY (StatCard, sticky)  │    │
│  │                              │   │  Panel, e1, radius.lg             │    │
│  │  ┌── line item (Card) ────┐  │   │  ┌────────────────────────────┐   │    │
│  │  │ [thumb] Title          │  │   │  │ Order summary              │   │    │
│  │  │         subject · pill │  │   │  │ 2 spaces        US$ 38.00  │   │    │
│  │  │         US$ 19.00      │  │   │  │ ─────────────────────────  │   │    │
│  │  │              [remove🗑]│  │   │  │ Total (Spline Mono, lg)    │   │    │
│  │  └────────────────────────┘  │   │  │            US$ 38.00       │   │    │
│  │  ┌── line item ───────────┐  │   │  │                            │   │    │
│  │  │ ...                     │  │   │  │ [ Payment method slot ]    │   │    │
│  │  └────────────────────────┘  │   │  │  (gateway element / beta   │   │    │
│  │                              │   │  │   "free during beta" note) │   │    │
│  │  Clear cart (ghost, danger   │   │  │                            │   │    │
│  │  on hover)                   │   │  │ [ ★ Complete purchase ]    │   │    │
│  └──────────────────────────────┘   │  │   (spark Button, full-w)   │   │    │
│                                      │  │ 🔒 Secure · cancel anytime │   │    │
│                                      │  └────────────────────────────┘   │    │
│                                      └──────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Grid & responsive behavior:**

- **lg ≥ 1024:** two-column grid — cart list `col-span-2`, **Order Summary** as
  a sticky right rail (`h-fit`, top-aligned). `gap` token 6.
- **md 768–1023:** same two columns but narrower; summary may drop sticky and
  use `gap` 5.
- **sm < 768 (mobile):** **single column, stacked.** Cart list first; Order
  Summary collapses to a **bottom sticky bar** pinned above the Tabbar showing
  **Total + spark "Complete purchase"** (thumb-reachable). Tapping the bar's
  caret expands the full summary sheet. Line-item thumbnails shrink; remove
  becomes a full-width swipe/press target ≥44px.

---

## 4. Components used (FOUNDATION §5 only)

- **AppShell** + **ConsumerLayout** + **Sidebar/Topbar** (web) / **Tabbar**
  (mobile) — navigation chrome.
- **Button** — `ghost` ("Back to Store", "Clear cart"), **`spark`** for the
  primary "Complete purchase / Enroll now" CTA (this is the page's single hero
  action → spark glow elevation per §4 elevation, hero-CTA only).
- **IconButton** — remove-line (Trash2), labeled.
- **Card** — each cart **line item** (radius.lg, e1, border.subtle).
- **Panel** — the **Order Summary** container.
- **Stat/KPI (StatCard)** — the **Total** figure (Spline Sans Mono numerics,
  `lg`/`xl` size, tabular).
- **DefinitionList** — summary breakdown rows (`N spaces` → subtotal; `Total` →
  amount).
- **Badge / Chip** — subject/label chip on a line item; a small **"Free"** badge
  (status.success-tinted) when `price === 0`.
- **DataTable (list mode)** — cart is a simple vertical list of Cards on web;
  the brief's "DataTable/list" maps to a non-paginated stacked list (no
  sort/filter needed here). On wide viewports it may render as a 3-column
  DefinitionList table (thumb+title / price / remove); collapses to stacked
  Cards on mobile (§10).
- **EmptyState** — empty cart.
- **ErrorState** — purchase/network failure (distinct from empty).
- **ConfirmDialog** — "Confirm enrollment" (purchase) and "Clear cart?".
- **Toast (sonner)** — success confirmation, per-line failure, "removed from
  cart" with **Undo**.
- **InlineAlert/Banner** — partial-success reconciliation banner (some
  succeeded, some failed).
- **Skeleton** — price/availability re-validation loading.
- **LoadingOverlay** — non-blocking spinner state on the CTA during purchase.

**Proposed FOUNDATION additions (flagged for promotion before use):**

1. **`PaymentMethodSlot`** — a labelled container/region that hosts the real
   payment-gateway element (card field / wallet button / hosted iframe) **or**,
   in the current stub, the "Free during beta — no payment required" note. It is
   not a generic Input (gateway elements are vendor-rendered iframes with their
   own a11y), so it needs a defined anatomy (label, helper, error row,
   `aria-describedby`, focus management for the iframe) to stay
   Lyceum-consistent. **Add to FOUNDATION §5 (Primitives or a small "Commerce"
   group) before building.** Until promoted, compose visually from Panel +
   FormFieldError tokens and mark it clearly.
2. **`OrderSummaryCard`** (optional convenience) — a thin composition of Panel +
   DefinitionList + StatCard + the primary CTA. Could be left as an in-screen
   composition; flag only if reused by a future B2C subscription/upgrade screen.

---

## 5. States

**Loading (skeleton):** When re-validating live prices/availability against
`listStoreSpaces`/`getSpace`, show **Skeleton** rows for each line item's
price + a skeleton Total. Cart titles/thumbnails (already in `localStorage`)
render immediately; only the _money_ shimmers until confirmed — reinforces "we
double-checked the price for you."

**Empty (empty cart):** `cart.length === 0`. Render **EmptyState** (no line
list, no summary). Centered Fraunces title, friendly line, single primary
"Browse the store" Button → `/store`. (Copy in §7.)

**Error:**

- **Purchase failure (all failed):** **ErrorState** in place of the summary
  action area + a **Toast**. Keep cart intact so the user can retry; the
  idempotency key persists so retry is safe.
- **Network/offline:** InlineAlert "You're offline — we'll keep your cart safe."
  CTA disabled; cart persisted in `localStorage` regardless.
- **Already enrolled** (server `already-exists`): treat as _success for that
  line_ (idempotent outcome), silently remove it from cart, and note it in the
  success summary ("You already had X — it's in your library").

**Partial (the important one):** Multi-space cart where **some purchases succeed
and some fail** (e.g. one space got unpublished, one payment declined). Do
**not** show a blunt error list. Render an **InlineAlert (warning)** that
reconciles state:

- Succeeded lines → removed from cart, added to a "✓ Enrolled" mini-list.
- Failed lines → **stay in the cart**, each tagged with its reason
  (FormFieldError style on the line). CTA relabels to "Retry remaining (N)".
- Total recomputes to only the still-pending lines.

**Stale price (partial):** If re-validation finds a line's price changed or it's
no longer `publishedToStore`, show a per-line InlineAlert ("Price updated to US$
X" / "No longer available") and require the user to acknowledge before the CTA
re-enables — never silently charge a different amount than displayed.

**Success:** Tasteful, **not** a full celebratory burst (§8). Inline success
confirmation in the summary region (✓ status.success, "You're enrolled"), a
brief **Toast**, the cart clears for purchased lines, and the page transitions
to a compact "You're all set" panel with two actions: **primary spark "Start
learning" → `/consumer` (My Learning)** and ghost "Keep browsing → `/store`".

**Permission / role-gated:** This screen is **B2C-only**. A B2B school student
(has `currentMembership.role === 'student'`) routed here is redirected out by
the guard (B2B has no store). No staff/admin variation.

---

## 6. Interactions & motion

All motion subtle per FOUNDATION §4 — **no celebratory burst here** (reserved
for gamification, §8).

**Remove a line:** press Trash IconButton → line collapses (`motion.fast`,
`ease.exit`) → **Toast "Removed — Undo"** (Undo restores via `addToCart`). Total
animates to its new value with a quiet count tween (`motion.base`, mono
numerals). Optimistic: store mutates immediately (it's local state).

**Clear cart:** opens **ConfirmDialog** ("Clear cart?") — modal scrim `e3`,
enters `motion.base`/`ease.entrance`. Destructive action uses `danger` Button
styling (status.error). Confirm clears local cart; Toast "Cart cleared — Undo".

**Complete purchase flow:**

1. Press spark **"Complete purchase"** → **ConfirmDialog "Confirm enrollment"**
   summarizing N spaces + total. (For `total === 0`, label is "Enroll now" and
   the dialog says "no payment required".)
2. On confirm: CTA enters loading (label "Processing…", inline spinner,
   **LoadingOverlay** on the summary only — page stays interactive enough to
   read). CTA disabled to prevent double-submit; the **idempotencyKey guarantees
   the server dedupes even if a click slips through.**
3. **Real-gateway slot:** if a non-stub gateway is configured, the
   **PaymentMethodSlot** collects/confirms payment first (vendor element returns
   a `paymentToken`), then `purchaseSpace` is called with
   `{ spaceId, paymentToken, idempotencyKey }`. With the current stub, the token
   is omitted.
4. Purchases run **per line, each with its own stable idempotencyKey**; results
   reconcile into success / partial / error states (§5).
5. **Success transition:** summary cross-fades (`motion.base`) to the "You're
   all set" panel. A single ✓ checkmark may do a small scale-in (`spring`,
   restrained) — this is the _one_ allowed micro-delight on this surface and
   stays well short of a CelebrationBurst. Then primary CTA routes to **My
   Learning** (`/consumer`); the actual XP/level/streak celebration fires later,
   in the learning experience.

**Optimistic updates:** cart edits are optimistic (local store). Purchase is
**not** optimistic — money/enrollment is confirmed by the server before the
success state shows.

**Confirmations:** both destructive (clear) and consequential (purchase) actions
are gated by ConfirmDialog. Free enrollments still confirm (so the user always
knows what's being added to their library) but with lighter copy.

---

## 7. Content & copy (warm, trustworthy, low-anxiety)

**Header:** `Checkout` (Fraunces) · subhead
`Review your spaces before you start learning.` **Back link:** `← Back to store`

**Line item:** title (link to `/store/:spaceId`), subject chip, price
`US$ 19.00` or **`Free`** badge. Remove `aria-label`:
`Remove "<title>" from cart`.

**Order Summary:** heading `Order summary`. Row: `{N} space` / `{N} spaces` →
subtotal. `Total` row in mono. Reassurance line under CTA:
`🔒 Secure checkout · You can cancel anytime before you start.`

- Free state helper: `No payment needed — these spaces are free.`
- Beta/stub state helper: `Free during beta — no card required yet.`

**Primary CTA:** paid → `Complete purchase` · free → `Enroll now` · processing →
`Processing…` · partial retry → `Retry remaining ({N})`.

**Confirm enrollment dialog:** title `Ready to start?` · body
`You're enrolling in {N} space{s}.{ Total: US$ {x}.}` · confirm
`Complete purchase` / `Enroll now` · cancel `Not yet`.

**Clear cart dialog:** title `Clear your cart?` · body
`This removes all {N} space{s}. You can always add them back.` · confirm
`Clear cart` · cancel `Keep them`.

**Empty cart (EmptyState):** title (Fraunces) `Your cart is empty` · body
`Browse the store and add a space whenever something sparks your interest.` ·
CTA `Browse the store`.

**Success panel:** title `You're all set!` · body
`{N} space{s} added to your library. Time to dive in.` · primary
`Start learning` · ghost `Keep browsing`. (Already-enrolled note:
`You already had "{title}" — it's waiting in your library.`)

**Error (ErrorState):** title `That didn't go through` · body
`Something interrupted your checkout — your cart is safe. Let's try that again.`
· CTA `Try again`. (Never blame the user; never expose raw server errors — map
via `getApiErrorMessage`.)

**Partial (InlineAlert warning):**
`{X} enrolled, {Y} still pending. We kept the ones that didn't go through in your cart so you can retry.`

**Stale price (per-line):**
`Price updated to US$ {x} since you added this. Tap to accept the new price.` /
`This space isn't available right now.`

---

## 8. Domain rules surfaced

- **B2C-only surface.** Consumer learner, no tenant membership; data flows
  through the synthetic `platform_public` tenant and `user.consumerProfile`. B2B
  school students are routed away (no store/checkout for them). Tenant isolation
  upheld: purchase mutates only the caller's `users/{uid}.consumerProfile` and
  the `platform_public` store doc.
- **Idempotent purchase — no double-charge / no double-enroll.** Each line
  carries a **stable `idempotencyKey`** (per spaceId per checkout session); the
  server (`v1.levelup.purchaseSpace`) dedupes. Double-clicks, retries, and
  network re-sends are safe. `already-exists` from the server is treated as a
  _successful idempotent outcome_, not an error.
- **Server-authoritative money & enrollment.** Price shown is re-validated
  against the server before charging; the displayed total can never diverge from
  the charged amount without explicit user acknowledgement. Enrollment,
  `PurchaseRecord`, `totalSpend`, and store student-count are all written
  **server-side** in `purchaseSpace` — the client never writes `consumerProfile`
  directly.
- **Real-gateway slot, today a stub.** `paymentToken` is reserved; the
  **PaymentMethodSlot** is the single seam where a real PCI-compliant gateway
  element drops in. The client never handles raw card data — the gateway returns
  a token; design must keep the card/payment surface isolated to that slot.
- **Success → enrolled, then hand off to learning.** On success, invalidate
  `store-spaces` + `consumer-enrolled-spaces`, mark the cart purchased, and
  route to **My Learning (`/consumer`)**.
- **Celebration discipline (the global gamification rule):** checkout success
  stays **tasteful and subtle** — an inline ✓ and a small restrained scale-in at
  most. The **CelebrationBurst (spring pop + marigold spark)** is _reserved for
  learning gamification_ (XP gain, streaks, level-up, achievement unlock, 100%
  completion) and **must not** fire on this transactional screen. Spark is used
  here only as the primary-CTA accent, not as a burst.
- **No answer-key / timer rules apply** (no assessment content on this screen) —
  noting explicitly for completeness.

---

## 9. Accessibility

- **Focus order:** Back link → each line item (link → remove button) → Clear
  cart → Order Summary heading → PaymentMethodSlot fields → primary CTA →
  reassurance text. Logical top-to-bottom, left rail before right rail on web.
- **Keyboard:** all actions reachable/operable by keyboard; remove buttons are
  real `<button>`s with `aria-label="Remove \"{title}\" from cart"`.
  ConfirmDialogs trap focus, restore focus to the trigger on close, close on
  `Esc`, and `Enter` triggers the default (Cancel as the safe default for the
  destructive Clear dialog).
- **Forms/payment labeled:** every payment field has a visible `<label>` (or
  accessible name for vendor iframes), helper text via `aria-describedby`, and
  explicit **error states** wired with `aria-invalid` + `role="alert"`
  FormFieldError. The PaymentMethodSlot manages focus into the gateway iframe
  and announces validation failures.
- **Status never by color alone:** "Free" badge pairs color + text;
  status.success/error/warning states always carry an icon + label (FOUNDATION
  §2 rule). Partial-success uses an InlineAlert with role + text, not just tint.
- **Live regions:** Total updates and purchase progress announced via
  `aria-live="polite"`; the success transition announces "You're enrolled in {N}
  spaces" so screen-reader users get the same confirmation as the visual ✓.
- **Contrast:** all text/bg pairs meet WCAG AA (4.5:1 body, 3:1 large/UI) per
  FOUNDATION §2; spark CTA text uses `text.on-accent`.
- **Touch targets ≥44px** (FOUNDATION §4) — especially remove buttons and the
  mobile sticky CTA bar.
- **Reduced motion:** honor `prefers-reduced-motion` — the success ✓ scale-in,
  total count tween, and line-collapse all degrade to instant opacity changes.

---

## 10. Web ↔ mobile divergence (FOUNDATION §6)

| Aspect           | Web                                                                                       | Mobile (Expo / ui-native)                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout           | Two-column grid; sticky right Order Summary rail                                          | Single stacked column; Order Summary collapses to a **bottom sticky bar** above the Tabbar (Total + spark CTA), expandable to a sheet          |
| Cart             | Stacked Cards (or 3-col DefinitionList on wide)                                           | Always stacked Cards                                                                                                                           |
| Nav chrome       | Sidebar + Topbar                                                                          | **Tabbar** (My Learning / Store / Cart / Profile)                                                                                              |
| Remove line      | Trash IconButton (hover reveal)                                                           | Visible Trash target ≥44px + optional swipe-to-remove; **press** not hover                                                                     |
| Interaction      | hover affordances; ⌘K CommandPalette available app-wide (not on this screen specifically) | no hover, no ⌘K; press states                                                                                                                  |
| ConfirmDialog    | centered Modal                                                                            | bottom Sheet                                                                                                                                   |
| Component parity | `shared-ui`                                                                               | `ui-native` — **same names/props** (Button, Card, Panel, StatCard, ConfirmDialog, EmptyState, Toast, PaymentMethodSlot); only renderer differs |
| Payment slot     | gateway web element/iframe                                                                | gateway native SDK component (e.g. PaymentSheet) behind the same `PaymentMethodSlot` contract                                                  |

---

## 11. Claude-design prompt (ready to paste)

```
You are designing the **B2C Checkout** screen for the Auto-LevelUp STUDENT (learner) web app,
in the "Lyceum" design system, Direction A "Modern Scholarly". STRICTLY conform to
docs/rebuild-spec/design/00-FOUNDATION.md — do NOT invent colors, fonts, spacing, radii,
shadows, motion, or component variants. Cite tokens by semantic name only
(bg.canvas, bg.surface, text.primary/secondary/muted, brand.primary, spark, border.subtle,
status.success/warning/error, radius.lg/md/pill, e1/e3, motion.fast/base, ease.entrance/exit).
Fonts: Fraunces (display/headings), Schibsted Grotesk (UI/body/buttons), Spline Sans Mono (the
Total and all money numerals — tabular).

CONTEXT: This is the cart + purchase flow at route /store/checkout, inside ConsumerLayout
(B2C consumer learner, no tenant — platform_public). Cart line items come from a local
Zustand consumer-store persisted to localStorage (spaceId, title, price, currency, thumbnailUrl).
Purchase calls v1.levelup.purchaseSpace per line with a STABLE idempotencyKey (no double-charge,
no double-enroll); payment gateway is currently a stub (transactionId returned, paymentToken
reserved) — leave a clearly isolated "PaymentMethodSlot" region for a real gateway element.

BUILD these regions:
1. A "Back to store" ghost link + Fraunces "Checkout" header with an encouraging subhead.
2. A two-column layout (lg): left = stacked cart line-item Cards (thumb, title link, subject
   chip, price or "Free" badge, labeled Trash remove IconButton) + a "Clear cart" ghost action;
   right = a sticky Order Summary Panel with a DefinitionList breakdown, a mono Total (StatCard),
   a PaymentMethodSlot, and a full-width SPARK primary Button "Complete purchase" (free →
   "Enroll now") with a "Secure · cancel anytime" reassurance line.
3. Mobile (sm): single column; Order Summary collapses to a bottom sticky bar (Total + spark CTA)
   above the Tabbar, expandable to a sheet.

STATES to render: loading (price-revalidation skeletons on the money only), empty cart
(EmptyState: "Your cart is empty"), error (ErrorState: "That didn't go through — your cart is
safe"), PARTIAL success (InlineAlert warning: some enrolled, failed lines stay in cart with
per-line reasons + "Retry remaining (N)"), and tasteful success ("You're all set!" panel with a
SPARK "Start learning" → My Learning and a ghost "Keep browsing").

DOMAIN RULES (must hold):
- B2C-only; tenant isolation respected (platform_public + user.consumerProfile).
- Idempotent purchase — gate the CTA with a "Ready to start?" ConfirmDialog; disable while
  processing; never double-charge; treat "already enrolled" as a successful idempotent outcome.
- Server-authoritative money — re-validate price before charging; require acknowledgement if a
  price changed; never charge a different amount than displayed.
- CELEBRATION DISCIPLINE: keep success subtle (inline ✓, at most a small restrained scale-in).
  Do NOT use the CelebrationBurst / marigold spark burst here — that is reserved for learning
  gamification (XP/streak/level-up/achievement/100%). Spark is only the primary-CTA accent.

TONE: warm, trustworthy, low-anxiety, clear pricing, no dark patterns. Frame everything kindly
("You can always add them back", "your cart is safe").

A11Y: label all payment fields (visible labels / accessible names for vendor iframes), explicit
error states (aria-invalid + role="alert"), focus-visible rings (border.focus), logical focus
order, ConfirmDialog focus trap + Esc, status never by color alone (icon+label), aria-live on
Total + purchase progress, touch targets ≥44px, honor prefers-reduced-motion.

Compose ONLY from FOUNDATION §5 components: AppShell/ConsumerLayout/Sidebar/Tabbar, Button
(ghost + spark), IconButton, Card, Panel, Stat/StatCard, DefinitionList, Badge/Chip, EmptyState,
ErrorState, ConfirmDialog, Toast, InlineAlert, Skeleton, LoadingOverlay. Note that
"PaymentMethodSlot" is a PROPOSED FOUNDATION addition — render it as a Panel-composed labelled
region and flag it as not-yet-promoted.
```
