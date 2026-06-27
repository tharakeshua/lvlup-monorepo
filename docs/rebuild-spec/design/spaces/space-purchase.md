# Space Purchase / Checkout — Design Spec

> Conforms to the **Lyceum** foundation
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). All colors, type, spacing,
> radius, elevation, motion, and components are cited by token/name from that
> file — none are invented here. This is the **B2C consumer checkout** for
> buying a single store space.

---

## 1. Purpose & primary user

**Primary user:** a **consumer / student** (B2C, no tenant membership — served
from `platform_public`) who has discovered a space in the store and wants to own
it.

**Job-to-be-done:** _"I found a course I want. Let me review what I'm paying,
pay once, and get straight into learning — without fear of being double-charged
or losing my money to an error."_

This is a single-line-item checkout, not a multi-item cart (each space is
purchased individually from its store detail page). The screen must (a) make
price/total unambiguous, (b) communicate that **payment gateway integration is a
rebuild requirement** (current backend is a stub), and (c) guarantee a single
charge even on retry via `idempotencyKey`.

---

## 2. Entry points & route

**Routes**

- `/store/:spaceId/purchase` — checkout for one space (primary entry, from the
  store detail page's "Buy" CTA).
- `/store/checkout` — alias resolving the in-progress purchase (the space being
  bought is held in route state / a `?spaceId=` param). If neither resolves to a
  space → **empty-cart** state (§5).

**Reads** (via `packages/api-client`, never direct Firestore — see common-api
§2):

- `api.levelup.getSpace({ spaceId })` (`v1.levelup.getSpace`, rateTier `read`) —
  order summary source: `title`, `price`, `currency`, store branding. Backing
  doc: `tenants/platform_public/spaces/{spaceId}`.
- The store-listing projection (`v1.levelup.listStoreSpaces`) already cached
  from the store grid is reused for instant render where possible; `getSpace`
  confirms live price before charging.

**Writes**

- `api.levelup.purchaseSpace({ spaceId, paymentToken?, idempotencyKey })`
  (`v1.levelup.purchaseSpace`, rateTier `write`). Server side effects (grounded
  in `functions/levelup/src/callable/purchase-space.ts`):
  - appends a `PurchaseRecord` to `user.consumerProfile.purchaseHistory`
    (`{ spaceId, spaceTitle, amount, currency, purchasedAt, transactionId }`),
  - `arrayUnion(spaceId)` into `consumerProfile.enrolledSpaceIds`,
  - `increment(price)` into `consumerProfile.totalSpend`,
  - `increment(1)` on the store space's `stats.totalStudents`,
  - returns `{ success, transactionId }`.
- `idempotencyKey` (common-api §9 — `purchaseSpace` is explicitly listed as an
  idempotent mutating callable) is generated **once** on screen mount and reused
  for every retry so a network retry or double-tap dedupes to one charge.

**On success:** invalidate `spaceKeys` (my-spaces list) + the consumer-profile
query, then redirect to the **Space Viewer** (`/my-spaces/:spaceId`) — see
common-api §5.3 query-key factories.

---

## 3. Layout — wireframe-as-text

Renders inside **PlatformLayout** (the consumer B2C shell), not the tenant
AppShell sidebar — a slim **Topbar** (logo, profile, no tenant switcher) over a
centered single-column reading surface (`bg.canvas`, max reading width 720 per
FOUNDATION §4). No left Sidebar in checkout (focus mode).

```
┌──────────────────────────────────────────────────────────────┐
│ Topbar: ◂ Back to store        [Auto-LevelUp]        [avatar]  │  ← Topbar
├──────────────────────────────────────────────────────────────┤
│  Breadcrumb: Store ▸ {space title} ▸ Checkout                 │
│                                                                │
│  h1 "Checkout"  (Fraunces, text-2xl)                          │
│                                                                │
│  ┌─────────────────────────┐  ┌──────────────────────────┐    │
│  │ ORDER SUMMARY  (Card)   │  │ PAYMENT  (Card, sticky)  │    │
│  │ ┌─────────────────────┐ │  │ InlineAlert (info):      │    │
│  │ │ SpaceCard (compact) │ │  │ "Demo checkout — no      │    │
│  │ │ cover · title · by  │ │  │  gateway yet" banner     │    │
│  │ └─────────────────────┘ │  │                          │    │
│  │ DefinitionList (mono):  │  │ PaymentMethod (radio):   │    │
│  │   Subtotal   $49.00     │  │   ◉ Demo checkout (stub) │    │
│  │   Tax (est.)  $0.00     │  │   ○ Card  ·· disabled    │    │
│  │   ───────────────────   │  │                          │    │
│  │   Total      $49.00     │  │ [ Pay $49.00 ]  (spark)  │    │
│  │   (text-xl mono)        │  │ Idempotency: txn-key chip│    │
│  └─────────────────────────┘  └──────────────────────────┘    │
│                                                                │
│  Footer: secured note · refund/terms link · support           │
└──────────────────────────────────────────────────────────────┘
```

**Responsive grid**

- **lg (≥1024):** two columns — Order Summary (left, ~58%) + Payment (right,
  ~42%, `position:sticky` top-24). Gap `gap-8`.
- **md (768–1023):** stacked single column, Order Summary first, Payment below;
  the Pay button stays in flow.
- **sm (<768):** single column, page gutter 16; the **Pay button docks** as a
  fixed bottom bar (`bg.surface`, `e2`, safe-area inset) showing the live
  **Total** + button — thumb-reachable (≥44px touch target, FOUNDATION §4).

---

## 4. Components used (from §5)

| Component                                             | Use                                                                                             |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **PlatformLayout / Topbar**                           | Consumer shell + back-to-store, profile (no tenant switcher, no Sidebar)                        |
| **Breadcrumb**                                        | Store ▸ {space} ▸ Checkout                                                                      |
| **Card**                                              | Order Summary + Payment panels (`radius lg`, `e1`)                                              |
| **SpaceCard** (domain, compact variant)               | The line item — cover, title, author, level chips                                               |
| **DefinitionList**                                    | Subtotal / Tax / Total rows, values in **Spline Sans Mono** (FOUNDATION §3 — numerics are mono) |
| **Stat/KPI**                                          | The **Total** emphasized as a mono `text-xl` figure                                             |
| **Radio**                                             | Payment-method selector (Demo checkout / Card-disabled)                                         |
| **Button — spark**                                    | "Pay {total}" primary CTA (the ONE spark CTA on the page, `spark glow`)                         |
| **Button — ghost**                                    | "Back to store" / "Cancel"                                                                      |
| **InlineAlert/Banner — info**                         | The honest **"payment gateway not yet integrated"** rebuild-gap notice                          |
| **Badge / Chip**                                      | `idempotencyKey` indicator chip; "Demo" tag on the stub method                                  |
| **Skeleton**                                          | Loading order summary                                                                           |
| **EmptyState**                                        | Empty-cart (no space resolved)                                                                  |
| **InlineAlert — error** + **ConfirmDialog**           | Decline / error states + leave-during-payment guard                                             |
| **Toast (sonner)**                                    | Success + transient errors                                                                      |
| **LoadingOverlay**                                    | Processing-charge blocking state                                                                |
| **ConfidenceBadge / RubricBreakdown / TimerBar etc.** | **Not used** (assessment domain, out of scope)                                                  |

**Proposed addition (justified):** none required. The "payment method" selector
is composed from **Radio + Card + InlineAlert** rather than a new
`PaymentMethodPicker` component, because the gateway is a stub today and a
dedicated component would over-fit a surface that will change when a real
gateway lands. Flag for promotion to `§5` once the gateway is chosen.

---

## 5. States

| State                       | Render                                                                                                                                                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Loading**                 | Order Summary as **Skeleton** (cover block + 3 mono shimmer rows + total). Payment card shows skeleton button. Triggered while `getSpace` resolves.                                                                              |
| **Empty cart**              | No `spaceId` resolves → **EmptyState** (Fraunces title "Nothing to check out yet", body "Browse the store to find a space.", primary Button → `/store`).                                                                         |
| **Error (load)**            | `getSpace` fails / `NOT_FOUND` → **InlineAlert error** "We couldn't load this space" + Retry (ghost) + Back-to-store. Uses `error.details.code` (common-api §6.3, `useApiError`).                                                |
| **Partial**                 | Space loads but **price unavailable / store-unpublished** (`publishedToStore=false`) → Pay button **disabled**, InlineAlert warning "This space isn't available for purchase right now." (mirrors server `failed-precondition`). |
| **Already enrolled**        | `getSpace`/profile shows `spaceId ∈ enrolledSpaceIds` (or server returns `already-exists`) → swap CTA to "Open in My Spaces" (brand.primary) linking to `/my-spaces/:spaceId`; suppress the charge.                              |
| **Processing**              | On Pay tap → **LoadingOverlay** over the Payment card, button → spinner + "Processing…", form locked. Idempotency chip stays visible.                                                                                            |
| **Decline / payment error** | `purchaseSpace` rejects (retryable) → **InlineAlert error** "Payment didn't go through" + recovery hint from `ERROR_RECOVERY_HINTS`; **same idempotencyKey** preserved so Retry cannot double-charge.                            |
| **Success**                 | Toast "You're enrolled in {title}", brief confirmation card with `transactionId` (mono), then auto-redirect to Space Viewer after motion settles (§6).                                                                           |

**Permission-gated variations by role**

- **Consumer (B2C):** full checkout as above. This is the only role that owns a
  `consumerProfile`.
- **Tenant student / teacher / admin (B2B):** checkout is **not applicable** —
  these users receive spaces via enrollment, not purchase. If routed here,
  render an **InlineAlert info** "Spaces are assigned by your school" + link to
  `/spaces`. (No `consumerProfile` exists on their `UnifiedUser`.)
- **Unauthenticated:** `purchaseSpace` is `authed` — gate behind sign-in; bounce
  to login with a return-to `/store/:spaceId/purchase`.

---

## 6. Interactions & motion

**Primary flow (happy path)**

1. Mount → generate `idempotencyKey` once (e.g. `crypto.randomUUID()`), store in
   component state; it does **not** change across retries.
2. `getSpace` resolves → Skeleton cross-fades to content (`fast 160ms`,
   `ease.standard`).
3. User confirms method (Demo checkout pre-selected) → taps **Pay** (spark
   Button, `spark glow`).
4. Optimistic-ish: button enters processing immediately (`instant 100ms`),
   **LoadingOverlay** fades in (`fast`). We do **not** optimistically add to
   `enrolledSpaceIds` in the UI — enrollment is a money event, so we wait for
   server confirmation before showing "enrolled" (no optimistic write here,
   unlike low-stakes progress writes).
5. On `{ success, transactionId }` → success Toast + a **single celebratory
   moment** (FOUNDATION §4: the one allowed spring pop + marigold burst) on a
   small "Enrolled!" confirmation, `spring`.
6. Redirect to `/my-spaces/:spaceId` after `page 420ms` (or immediately under
   reduced-motion).

**Confirmations & guards**

- **Leaving mid-processing:** if user hits Back while the charge is in flight →
  **ConfirmDialog** "Your payment is still processing — leave anyway?"
  (`base 220ms`, `ease.entrance`).
- **Cancel:** ghost "Cancel" → straight back to store, no dialog (nothing
  charged yet).
- **Retry after decline:** Retry reuses the same `idempotencyKey`; copy
  reassures "We won't charge you twice." Server dedupe (common-api §9) is the
  real guarantee; UI just communicates it.

**Feedback tokens:** hover/press use `fast`; overlay `base`; success pop
`spring`; everything else stays subtle per FOUNDATION §4 ("felt, not seen").
Marigold burst is reserved exclusively for the success moment.

---

## 7. Content & copy

Tone: **encouraging but trustworthy** (consumer money moment — warm, never
pushy, fully honest).

- **h1:** "Checkout"
- **Order summary heading:** "Order summary"
- **Line labels:** "Subtotal", "Tax (est.)", "Total" — values mono, currency
  from `space.currency` (default `USD`), formatted via the space's `currency`
  field (no hardcoded `$`).
- **Payment heading:** "Payment"
- **Rebuild-gap InlineAlert (info), verbatim and honest:**
  > **Demo checkout.** Real card payments aren't connected yet — this is a
  > placeholder that records your enrollment without charging a card. A payment
  > gateway is part of the rebuild.
- **Method options:** "Demo checkout (no charge)" [Demo chip] · "Credit / debit
  card — coming soon" (disabled).
- **CTA:** "Pay {total}" → e.g. "Pay $49.00". In demo mode reads "Enroll for
  free (demo)" when `price = 0` to avoid implying a charge.
- **Idempotency chip tooltip:** "Safe to retry — we use a one-time key so you're
  never charged twice."
- **Empty-cart:** title "Nothing to check out yet" / body "Browse the store to
  find a space."
- **Error (load):** "We couldn't load this space. Try again or head back to the
  store."
- **Decline:** "Payment didn't go through. No charge was made — you can safely
  try again."
- **Already enrolled:** "You already own this space." → "Open in My Spaces".
- **Success Toast:** "You're enrolled in {title} 🎉" (the one celebratory
  flourish).
- **Success confirmation:** "Enrolled! Transaction {transactionId}" (txn in
  mono).

---

## 8. Domain rules surfaced

Grounded in `purchase-space.ts` + `identity/user.ts` (`ConsumerProfile`,
`PurchaseRecord`):

1. **Store-published gate.** Server rejects purchase unless the space's
   `publishedToStore === true` (`failed-precondition`). UI mirrors via the
   Partial state — never offer Pay on an unavailable space.
2. **Tenant isolation of store inventory.** Purchasable spaces live under
   `tenants/platform_public/spaces/{spaceId}` — the public B2C catalog, not any
   private tenant.
3. **No double-enroll.** If `spaceId ∈ consumerProfile.enrolledSpaceIds` the
   server returns `already-exists`; UI pre-empts with the Already-enrolled
   state.
4. **Idempotency / no double-charge.** `purchaseSpace` is an idempotent mutating
   callable (common-api §9): the client sends a stable `idempotencyKey`; the
   server dedupes so retries and double-taps yield one `PurchaseRecord` + one
   `totalSpend` increment.
5. **Atomic profile write.** Enrollment, purchase history, and `totalSpend`
   update together on the user doc; `stats.totalStudents` on the store space
   increments. The UI treats success as all-or-nothing — no partial "paid but
   not enrolled" surface.
6. **Server-authoritative price.** The charged `amount`/`currency` come from the
   **server's** copy of the store space (`storeSpace.price ?? 0`,
   `storeSpace.currency ?? 'USD'`), not the client-rendered figure — the
   displayed total is confirmed against `getSpace` before Pay, and a server
   price change is the source of truth.
7. **Rebuild gap, stated honestly.** Today `transactionId` is a fabricated
   `_transactions` doc id and `paymentToken` is accepted but unused — **no real
   gateway** (`purchase-space.ts` header: "MVP: no actual payment processing").
   The rebuild adds a payment gateway + server idempotency dedupe; this screen
   surfaces that gap rather than implying a real charge (brief: "surface the gap
   honestly").
8. **Auth required.** `purchaseSpace` calls `assertAuth`; only a user with a
   `consumerProfile` is a valid purchaser. Rate limited to `write` tier on
   `platform_public`.

---

## 9. Accessibility

- **Focus order:** Back ▸ Breadcrumb ▸ (skip cover image, `alt` on it) ▸ payment
  method radios ▸ Pay button ▸ footer links. The sticky/docked Pay button is
  reachable in DOM order, not trapped.
- **Keyboard:** radios are a single arrow-key group (`role="radiogroup"`,
  `aria-label="Payment method"`); Pay is a real `<button>` (Enter/Space).
  ConfirmDialog traps focus and restores it on close; Escape cancels the dialog
  (but not an in-flight charge).
- **ARIA / live regions:** processing state announced via `aria-busy` on the
  Payment card + `role="status"` "Processing payment…"; decline/error via
  `role="alert"`; success Toast announced. The mono **Total** has an accessible
  label ("Total: forty-nine US dollars") so screen readers don't read raw glyphs
  ambiguously.
- **Contrast:** all pairs meet WCAG AA (FOUNDATION §2) — mono prices use
  `text.primary` on `bg.surface`; the spark Pay button uses `text.on-accent` on
  `spark` (verified ≥4.5:1). The disabled "Card — coming soon" method pairs
  `text.muted` with an icon + label, **never color alone** (FOUNDATION §2.3
  rule).
- **Reduced motion:** `prefers-reduced-motion` removes the success
  spring/marigold burst and the page-transition delay — redirect is immediate,
  confirmation is a static Toast.

---

## 10. Web ↔ mobile divergence (React Native parity)

- **Layout:** web two-column (lg) → RN always single column, vertical scroll.
  Payment summary sits above a **fixed bottom Pay bar** (the same pattern as web
  sm, native safe-area inset).
- **Hover → press:** all hover affordances become press states (`fast`); no
  sticky-on-scroll, the bottom bar is natively pinned.
- **No ⌘K / CommandPalette** on mobile (FOUNDATION §6) — irrelevant here anyway.
- **Component parity:** `SpaceCard`, `Card`, `DefinitionList`, `Button(spark)`,
  `InlineAlert`, `Radio`, `Toast` map 1:1 between `shared-ui` (web) and
  `ui-native` (mobile) — same names/props, different renderer (FOUNDATION §6).
  Currency/number formatting comes from one shared util so mono figures match.
- **Transport:** identical `api.levelup.purchaseSpace` via the injected
  `Transport` seam — RN uses `invokeViaCallable` exactly like web (common-api
  §5.1); `idempotencyKey` generation is shared.
- **Native niceties (future):** when a real gateway lands, RN swaps the Demo
  radio for the native payment sheet (Apple Pay / Google Pay) behind the same
  Pay button — out of scope until the gateway rebuild item is done.

---

## 11. Claude-design prompt

```text
Design a B2C "Space Purchase / Checkout" screen for Auto-LevelUp, strictly following the Lyceum
design system in docs/rebuild-spec/design/00-FOUNDATION.md. Compose ONLY from Lyceum tokens and
components — do not invent colors, fonts, or components, and obey the AI-slop ban (no Inter/Roboto,
no SaaS blue #3B82F6, no glass morphism, no blob gradients).

CONTEXT
A signed-in consumer is buying ONE store space (single line item, not a multi-item cart). Payment
gateway integration is a REBUILD GAP — today it's a demo/stub that records enrollment without
charging. Surface this honestly.

LAYOUT
- Render inside PlatformLayout (consumer shell): slim Topbar with "Back to store" + profile, NO
  tenant sidebar. Centered surface on bg.canvas, max reading width 720.
- Breadcrumb: Store ▸ {space title} ▸ Checkout. h1 "Checkout" in Fraunces text-2xl.
- lg: two columns — left "Order summary" Card, right sticky "Payment" Card. md/sm: single column;
  on sm, dock the Pay button as a fixed bottom bar (bg.surface, e2, safe-area).

ORDER SUMMARY (Card, radius lg, e1)
- Compact SpaceCard line item: cover, title, author, level chips.
- DefinitionList with Spline Sans Mono values: Subtotal, Tax (est.), divider, Total. Emphasize Total
  as a mono text-xl Stat in text.primary. Currency from the space's currency field (default USD) —
  no hardcoded $.

PAYMENT (Card)
- InlineAlert (info): "Demo checkout. Real card payments aren't connected yet — this records your
  enrollment without charging. A payment gateway is part of the rebuild."
- Radio group "Payment method": ◉ "Demo checkout (no charge)" with a Demo chip; ○ "Credit / debit
  card — coming soon" DISABLED (text.muted + icon + label, never color alone).
- Primary CTA: a single spark Button "Pay {total}" with the spark glow shadow (the ONLY spark CTA on
  the page). A small Badge/Chip shows the idempotency key with tooltip "Safe to retry — you're never
  charged twice."

STATES (build all): Skeleton loading summary; EmptyState "Nothing to check out yet" → Browse store;
load-error InlineAlert + Retry; partial/unavailable (Pay disabled + warning); already-enrolled (CTA
becomes "Open in My Spaces"); processing (LoadingOverlay + spinner button, form locked); decline
(error InlineAlert "Payment didn't go through. No charge was made — try again", same idempotency key);
success (Toast "You're enrolled in {title}" + ONE celebratory spring + marigold burst, then redirect
to /my-spaces/:spaceId).

MOTION (FOUNDATION §4): hover/press fast 160ms ease.standard; overlay base 220ms; the single success
moment uses spring + marigold burst; redirect after page 420ms. Respect prefers-reduced-motion
(drop the burst + delay).

A11Y: WCAG AA contrast; radiogroup with arrow keys; real <button> for Pay; aria-busy + role=status
during processing, role=alert on decline; ConfirmDialog "Your payment is still processing — leave
anyway?" with focus trap if user navigates away mid-charge; accessible label on the mono Total.

Tone: warm, encouraging, and fully honest about the demo/stub state. Use real field names
(consumerProfile.enrolledSpaceIds, purchaseHistory, totalSpend, transactionId) and the real callable
api.levelup.purchaseSpace({ spaceId, idempotencyKey }).
```
