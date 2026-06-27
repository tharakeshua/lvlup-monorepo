# Screen Spec — Consumer Profile / Account (B2C)

> Conforms to **Lyceum / Direction A — "Modern Scholarly"**
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). All tokens cited by semantic
> name; never re-pasted. Tone: warm but **clear, trustworthy,
> account-management** register — this is the money/receipts surface, so
> precision and legibility win over playfulness. No celebratory motion here.

---

## 1. Purpose & primary user

**Primary user:** a **B2C consumer learner** (self-serve, no tenant membership;
identity carries `user.consumerProfile`, served from the synthetic
`platform_public` tenant).

**Job-to-be-done:** _"When I open my account, I want to see who I am on the
platform, what plan I'm on, how much I've spent, the full record of what I
bought and when, and how to manage or leave my account — so I trust this place
with my money and feel in control."_

This is the **consumer account / receipts surface**. Unlike the B2B student
`ProfilePage` (tenant role, learning identity, gamification), this screen has no
role, no tenant, no XP — it is an **ownership + billing ledger**:
avatar/identity, plan, spend, the `purchaseHistory` receipt table, and account
actions (sign out, settings, join a school). It is deliberately calm and
factual.

---

## 2. Entry points & route

**Route:** `/profile`, rendered inside `ConsumerLayout` (the B2C variant of
`AppShell`). For a no-membership user, `RequireAuth`
(`onMissingMembership: 'consumerRedirect'`) keeps them in the consumer tree; the
same `/profile` path under a B2B membership renders the tenant `ProfilePage`
instead — the `LearnerContext` (B2C vs B2B) decides which page mounts, not the
path.

**Entry points:**

- "Profile" item in the `ConsumerLayout` sidebar / mobile `Tabbar`.
- Avatar menu in the `Topbar` (→ Profile / Settings / Sign out).
- Post-purchase confirmation deep-link ("View receipt") from `/store/checkout` —
  lands here scrolled to Purchase history.

**Reads (all through `@levelup/api-client`; UI never touches Firestore
directly):**

- `user.consumerProfile` — `plan` (`free | pro | premium`), `totalSpend`,
  `enrolledSpaceIds`, `purchaseHistory[]` (`PurchaseRecord`: `spaceId`,
  `spaceTitle`, `amount`, `currency`, `purchasedAt`, `transactionId`) — read
  from the **auth store's real-time `/users/{uid}` snapshot** (no extra fetch;
  `useCurrentUser()`). `purchasedAt` is normalized to epoch-ms at the repo edge
  (kills the in-page `"toDate" in p.purchasedAt` cast in today's
  `ConsumerProfilePage.tsx`).
- `UnifiedUser` identity fields — `displayName`, `email`, `photoURL` — same
  snapshot, drive `Avatar` + identity block.
- `v1.levelup.getSpace` (per `spaceId` in a receipt, lazily / batched) —
  resolves a receipt row's space title link target and "Open" affordance. The
  stored `spaceTitle` is the display label (receipts are immutable, so we show
  the title as purchased, not the live one).

**Writes:**

- **None to data** from this screen directly. `LogoutButton` →
  `useAuthStore().logout()` (auth side-effect, not a callable). "Enter school
  code" navigates to `/login` (B2B join flow, `v1.identity.lookupTenantByCode`
  lives there). A future "receipt PDF" action would call
  `v1.analytics.generateReport` — see Proposed additions.

---

## 3. Layout — wireframe-as-text

Hosted in `ConsumerLayout` → `AppShell` (sidebar collapses to a bottom `Tabbar`
on mobile). This spec describes the **content region** only. Reading-width
container per FOUNDATION §4 (account content reads better narrow — cap at the
720 reading measure for the identity/plan blocks; the receipts table may use the
full 1200 on `lg`). Page gutters: mobile 16 / tablet 24 / desktop 32; vertical
stack `gap = space-8/32`.

```
┌─ AppShell (ConsumerLayout) ─────────────────────────────────────────────┐
│ Topbar: brand · search · cart(badge) · notifications · avatar/profile    │
├──────────────────────────────────────────────────────────────────────────┤
│  CONTENT REGION (vertical stack, gap = space-8/32)                        │
│                                                                          │
│  ┌─ Page header (flex, space-between) ───────────────────────────────┐  │
│  │ h1 "My account"  (Fraunces display)            [ Sign out ] (ghost)│  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─ Identity card (Card, e1) ────────────────────────────────────────┐  │
│  │ [Avatar lg]   {displayName}                                        │  │
│  │               {email}              ·   [Settings →] (ghost link)    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─ Plan summary: StatCard row (grid, lg:3-up / sm:1-up) ─────────────┐  │
│  │ [Plan: Pro]          [Spaces: 4]          [Invested: ₹2,400]        │  │
│  │  (badge accent)       (count)              (mono numeric)           │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─ Account details (DefinitionList in a Panel) ─────────────────────┐  │
│  │  Plan ............... Pro                                           │  │
│  │  Member since ....... Mar 2026                                      │  │
│  │  Email .............. lena@…  (verified ✓ status.success)           │  │
│  │  Enrolled spaces .... 4                                             │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─ Purchase history (Section → DataTable) ──────────────────────────┐  │
│  │  h2 "Purchase history"  [💳]            [Browse the store →]        │  │
│  │  ┌──────────────────────────────────────────────────────────────┐ │  │
│  │  │ DATE        SPACE              AMOUNT     RECEIPT              │ │  │
│  │  │ 20 Jun 26   DSA Masterclass    ₹1,200     #txn_a93… [Open ↗]   │ │  │
│  │  │ 02 Jun 26   System Design      ₹1,200     #txn_7f1… [Open ↗]   │ │  │
│  │  │ 18 May 26   Behavioral Prep    Free       #txn_001… [Open ↗]   │ │  │
│  │  └──────────────────────────────────────────────────────────────┘ │  │
│  │                                       Total invested: ₹2,400 (mono)│  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─ "Join a school" (Panel, dashed border.strong) ──────────────────┐  │
│  │ [🏫] Have a school code? Link your account…   [Enter school code]  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─ Danger / account zone (Panel) ───────────────────────────────────┐  │
│  │  Sign out   ·   Delete account (danger, → ConfirmDialog)           │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

**Responsive behavior:**

- **`lg ≥ 1024`:** StatCard row 3-up; receipts render as full `DataTable` with
  all columns; identity + DefinitionList capped at reading measure
  (left-aligned, not full bleed).
- **`md 768–1023`:** StatCard row 3-up (tighter); table keeps all columns;
  gutters 24.
- **`sm < 768` / mobile:** StatCards stack 1-up (or 2-up if they fit);
  **DataTable degrades to stacked `SubmissionCard`-style receipt cards** (one
  card per purchase: title as heading, date + amount as a key/value pair,
  "Open" + receipt id as footer) per FOUNDATION §6 table→cards rule; bottom
  `Tabbar` replaces sidebar; "Sign out" moves into a header
  overflow/`IconButton` if space is tight.

---

## 4. Components used (FOUNDATION §5 only)

- **Layout / shell:** `AppShell` (via `ConsumerLayout`), `Topbar`, `Sidebar` →
  mobile `Tabbar`.
- **Containers:** `Card` (identity card, radius.lg, e1), `Panel`/`Section`
  (account details, join-school, danger zone), `Section` header pattern.
- **Data:** `Avatar` (identity, lg size; initials fallback when `photoURL`
  absent), `DefinitionList` (account details — the canonical term/definition
  pairs), `Stat`/`StatCard` (Plan / Spaces / Invested), `DataTable` (purchase
  history — sortable by date, no pagination until >10 rows then `Pagination`),
  `Badge`/`Chip` (plan tier, "verified" email state), `EmptyState` (no
  purchases), `Skeleton` (loading).
- **Primitives:** `Button` (primary "Enter school code", ghost "Settings", ghost
  "Sign out", danger "Delete account"), `IconButton` (mobile overflow),
  `Tooltip` (truncated transactionId / "Open space").
- **Feedback:** `ConfirmDialog` (sign-out confirm on mobile + delete-account),
  `Toast` (sonner — "Signed out", future "Receipt emailed"),
  `InlineAlert/Banner` (error state).
- **Domain components:** none of the assessment/gamification domain set apply
  here — this is intentionally a **non-gamified, non-assessment** surface.
  (`SpaceCard` is _not_ used; enrolled spaces are summarized as a StatCard count
  and linked from receipts, not re-listed as cards — that's the Consumer
  Dashboard's job.)

No new components required beyond the **Proposed additions** flagged in §8/§11.

---

## 5. States

- **Loading (skeleton):** auth store is hydrating `/users/{uid}`. Render
  `Skeleton` for the Avatar (circle), two text lines (name/email), three
  StatCard rectangles, four DefinitionList rows, and 3 shimmer table rows. No
  layout shift — skeleton matches final geometry. Motion: subtle shimmer only,
  never a spinner overlay for this calm surface.
- **Empty (no purchases):** identity + plan render normally; the
  Purchase-history `Section` shows an `EmptyState` — illustration-light, title +
  body + a primary "Browse the store" `Button` → `/store`. (A `free`-plan user
  with `purchaseHistory: []` is the common empty case.)
- **Empty (free plan, no spend):** StatCards still render — Plan = "Free"
  (neutral `Badge`), Spaces = 0 or count, Invested = "₹0" (mono). DefinitionList
  "Member since" still shows. Tone stays welcoming, never "you haven't spent
  anything."
- **Error:** if `getSpace` resolution for a receipt row fails, the row still
  renders from the **stored `spaceTitle`** (receipts are self-describing) — only
  the "Open" link is disabled with a `Tooltip` "This space is no longer
  available." If the whole `/users/{uid}` snapshot errors, show a full-region
  `ErrorState`/`InlineAlert` (`status.error`, icon + label, never color alone)
  with a "Try again" `Button` that retries the store subscription.
- **Partial:** identity + plan loaded but `getSpace` batch still resolving →
  receipt rows show title + amount + date immediately (from `PurchaseRecord`),
  with the "Open" affordance in a per-row `Skeleton`/disabled state until
  resolved. Never block the receipts on space resolution.
- **Success:** all blocks populated; "Total invested" footer equals `totalSpend`
  (sanity-cross-checked against the sum of `purchaseHistory.amount`; if they
  disagree, trust the server `totalSpend` and silently use it — do not surface a
  discrepancy to the user).
- **Permission / role-gated:** this page is **B2C-only**. A B2B student hitting
  `/profile` renders the tenant `ProfilePage` instead (different spec). There is
  no "consumer + membership" hybrid on this screen — if a user later joins a
  school, they keep `consumerProfile` but their `/profile` resolves to the B2B
  page; the consumer account view remains reachable only while in consumer
  context. (No tenant-role variations exist within this screen.)

---

## 6. Interactions & motion

- **Sign out:** `LogoutButton` → on desktop, immediate `useAuthStore().logout()`
  then redirect to `/login`; on mobile, a `ConfirmDialog` ("Sign out of your
  account?") first to prevent fat-finger logout. `Toast` "Signed out" on
  success. Transition uses `motion.base` / `ease.standard` for the dialog; page
  redirect uses `motion.page`.
- **Open a receipt's space:** row "Open ↗" navigates to
  `/consumer/spaces/:spaceId` (or `/store/:spaceId` if no longer enrolled).
  Hover (web) lifts the row to `e1`→`e2` at `motion.fast`; mobile press uses an
  active/pressed token instead of hover.
- **Sort receipts:** clicking the DATE column header toggles asc/desc (default
  newest-first) — `DataTable` built-in; `motion.fast` chevron rotate. No
  optimistic writes (read-only table).
- **Copy transaction id:** `transactionId` is truncated with a `Tooltip` showing
  the full id and a click-to-copy affordance → `Toast` "Receipt ID copied."
  Useful for support requests.
- **Enter school code:** navigates to `/login`; no in-place mutation here.
- **Delete account (Proposed):** danger `Button` → `ConfirmDialog` with typed
  confirmation, then a callable (see §8/§11). Destructive, requires explicit
  confirm; `motion.base`.
- **Motion discipline:** this screen gets **no `CelebrationBurst`**. Per
  FOUNDATION §4, the one celebratory spring/spark moment is reserved for
  gamification (XP/streak/level-up/achievement/100%). An account/receipts page
  must read as sober and trustworthy — all motion stays subtle (`fast`/`base`,
  `ease.standard`), and `prefers-reduced-motion` removes row-lift and chevron
  animation entirely.

---

## 7. Content & copy

Tone: clear, trustworthy, lightly warm — never salesy, never punitive.

- **Page title (h1):** "My account"
- **Identity card:** name (display), email below in `text.secondary`; inline
  ghost link "Settings →".
- **StatCards:**
  - "Plan" → value is the tier name (`Free` / `Pro` / `Premium`), rendered as a
    `Badge` (Pro/Premium use `spark`/`brand.primary` accent; Free uses neutral
    `border.strong`).
  - "Spaces" → `enrolledSpaceIds.length`, label "Enrolled spaces".
  - "Invested" → `totalSpend` formatted with `currency`, Spline Sans Mono
    numeric. Label "Invested" (warmer than "Total spent").
- **DefinitionList (account details):** "Plan", "Member since" (from
  `createdAt`), "Email" (+ verified `Badge` when applicable), "Enrolled spaces".
- **Purchase history header (h2):** "Purchase history" with a credit-card icon;
  right-side ghost link "Browse the store →".
- **Table columns:** "Date" · "Space" · "Amount" · "Receipt".
  - Amount = `Free` when `amount === 0`, else `{currency} {amount}` (mono).
  - "Total invested: {totalSpend}" footer (mono), `text.secondary`.
- **Empty-state (no purchases):** title "No purchases yet" · body "When you buy
  a space, your receipts will live here — every one, always available." ·
  primary `Button` "Browse the store".
- **Error copy:** "We couldn't load your account just now. Your data is safe —
  let's try again." + "Try again" button. (Reassuring about data safety on a
  money surface.)
- **Receipt-space-gone tooltip:** "This space is no longer available, but your
  receipt is kept."
- **Join-a-school panel:** h3 "Join a school" · body "Have a school code? Link
  your account to access school content while keeping your personal learning
  progress." · `Button` "Enter school code".
- **Sign-out confirm (mobile):** title "Sign out?" · body "You can sign back in
  anytime." · confirm "Sign out" / cancel "Stay".
- **Delete-account (Proposed) confirm:** title "Delete your account?" · body
  "This permanently removes your account and learning progress. Your purchase
  records are retained for legal/billing requirements. This can't be undone." ·
  destructive confirm.

---

## 8. Domain rules surfaced

- **B2C tenant isolation:** this user has **no tenant membership and no role**;
  all enrolled-space resolution is scoped to the synthetic `platform_public`
  tenant + `user.consumerProfile`. The page must never attempt a tenant-scoped
  read. (FOUNDATION cross-app rule: B2C reads come from `platform_public` +
  `consumerProfile`.)
- **Receipts are the financial source of truth, server-owned:**
  `purchaseHistory` / `totalSpend` are written only by
  `v1.levelup.purchaseSpace` server-side (idempotent, accepts `idempotencyKey`).
  The client **never writes** purchase records and never recomputes `totalSpend`
  for display authority — it renders the server value. Receipts are
  **immutable**: show `spaceTitle` as-purchased, not the live space title.
- **Answer-key / assessment / timer rules:** **not applicable** — no
  `AnswerKeyLock`, no `TimerBar`, no answer surfaces exist here. (Called out
  explicitly so no one bolts assessment chrome onto an account page.)
- **Gamification rule:** **no celebratory motion** on this surface (see §6).
  XP/streak/level live only in learning/gamification screens.
- **All data via `@levelup/api-client`:** identity + consumerProfile come from
  the Zod-validated `/users/{uid}` snapshot in the auth store; `getSpace`
  resolution goes through the repo. UI imports no `firebase/firestore`.
  Timestamps are epoch-ms at the boundary (removes the in-page `"toDate" in …`
  cast that exists today).
- **Privacy:** show only this user's own data; `transactionId` is shown for
  support reference but treated as low-sensitivity (no card numbers, no PAN ever
  reach the client — payment is handled by the provider; we store only the
  record).

---

## 9. Accessibility

- **Landmarks & headings:** content region is a `<main>`; h1 "My account" → h2
  "Purchase history". DefinitionList uses real `<dl>/<dt>/<dd>` semantics (the
  `DefinitionList` component guarantees this).
- **Table semantics:** the purchase-history `DataTable` is a real `<table>` with
  `<thead>/<th scope="col">`, a `<caption>` (visually-hidden) "Your purchase
  history, newest first," sortable headers expose `aria-sort`, and the "Total
  invested" footer is a `<tfoot>`. On mobile the stacked-card variant uses a
  `<ul>`/`role="list"` with each receipt as a `<li>` and an accessible name
  combining space + date + amount.
- **Focus order:** Page header (h1, then Sign-out) → Settings link → StatCards
  (non-interactive, skipped) → DefinitionList → table headers → table rows (each
  row's "Open"/copy actions tabbable in reading order) → Join-school button →
  danger actions. Logical top-to-bottom.
- **Keyboard:** all actions reachable via Tab/Shift-Tab; sortable headers
  operable with Enter/Space; "Open" and "copy receipt id" are real
  buttons/links; `ConfirmDialog` traps focus and restores it on close; Esc
  cancels.
- **ARIA / labels:** icon-only buttons (mobile overflow, copy) have
  `aria-label`; status (verified email, plan tier) pairs **icon + text label**,
  never color alone (FOUNDATION §2 rule); copy-to-clipboard announces success
  via the `Toast` (polite live region).
- **Contrast:** all text/bg pairs meet WCAG AA; mono numerics for amounts are
  large/`text.primary`; the dashed join-school panel border uses `border.strong`
  for ≥3:1 UI contrast.
- **Reduced motion:** `prefers-reduced-motion` disables row hover-lift, chevron
  rotation, and any dialog scale — dialogs cross-fade instead; no parallax/spark
  anywhere on this page regardless.

---

## 10. Web ↔ mobile divergence (FOUNDATION §6)

- **Purchase history:** web = `DataTable` (sortable columns, full width on
  `lg`); mobile = **stacked receipt cards** (one per purchase) — same data, no
  horizontal scroll, ≥44px touch targets.
- **Navigation:** web `Sidebar` + `Topbar` avatar menu; mobile bottom `Tabbar`
  (Profile tab active) — there is **no `CommandPalette`/⌘K on mobile**.
- **Sign out:** web = immediate from the menu; mobile = `ConfirmDialog` guard
  (fat-finger protection) + the action may live behind a header `IconButton`
  overflow when width is tight.
- **Hover → press:** web row hover lift (`e1→e2`); mobile uses pressed/active
  state token, no hover.
- **Copy transaction id:** web = `Tooltip` + click-to-copy; mobile = long-press
  / explicit copy `IconButton` (no hover tooltip).
- **Component parity:** `Avatar`, `StatCard`, `DefinitionList`, `Badge`,
  `Button`, `ConfirmDialog`, `EmptyState` names/props match 1:1 between
  `shared-ui` (web) and `ui-native` (mobile); only `DataTable`'s renderer
  differs (table vs card list), driven by the shared headless `useDataTable`.

---

## 11. Claude-design prompt (ready to paste)

```
You are designing the "Consumer Profile / Account" screen for the Auto-LevelUp STUDENT
web app (B2C consumer learner — no tenant, no role; identity carries user.consumerProfile,
served from the synthetic platform_public tenant). Conform EXACTLY to the Lyceum design
system (Direction A — "Modern Scholarly") in docs/rebuild-spec/design/00-FOUNDATION.md.
Compose ONLY from FOUNDATION tokens (cite by semantic name: bg.canvas, bg.surface,
text.primary/secondary/muted, brand.primary, spark, border.subtle/strong, status.success/
error, radius.lg/md/pill, e1/e2, motion.fast/base, ease.standard) and §5 components.
Fonts: Fraunces (display h1/h2), Schibsted Grotesk (UI/body/labels), Spline Sans Mono
(amounts, totals, transaction ids).

ROUTE: /profile inside ConsumerLayout (AppShell → Topbar + Sidebar; mobile bottom Tabbar).

TONE: clear, trustworthy, account-management — NOT playful. This is the receipts/billing
surface. NO celebratory motion, NO gamification, NO XP/streak. All motion subtle
(fast/base, ease.standard); honor prefers-reduced-motion.

CONTENT REGION (vertical stack, gap space-8), identity/details capped at the 720 reading
measure, receipts table may use full 1200 on lg:
1. Page header: h1 "My account" (Fraunces) + ghost "Sign out" right.
2. Identity Card (radius.lg, e1): Avatar (lg, initials fallback) + displayName + email
   (text.secondary) + ghost "Settings →".
3. StatCard row (grid lg:3-up, sm:1-up): "Plan" (tier as Badge — Pro/Premium spark accent,
   Free neutral), "Enrolled spaces" (count), "Invested" (totalSpend, mono numeric).
4. DefinitionList in a Panel (<dl>): Plan · Member since · Email (+ verified Badge) ·
   Enrolled spaces.
5. Purchase history Section: h2 "Purchase history" + credit-card icon + ghost "Browse the
   store →". DataTable columns Date · Space · Amount (Free when 0, else "{currency} {amount}"
   mono) · Receipt (truncated transactionId w/ tooltip + copy, "Open ↗" link). tfoot
   "Total invested: {totalSpend}" mono.
6. "Join a school" Panel (dashed border.strong): copy + "Enter school code" button → /login.
7. Account/danger zone: Sign out + Delete account (danger → ConfirmDialog).

STATES: skeleton (avatar circle + 3 statcards + 4 dl rows + 3 table rows, no spinner);
empty purchases → EmptyState "No purchases yet" + "Browse the store"; error → InlineAlert
"We couldn't load your account just now. Your data is safe — let's try again." + Try again;
partial → receipt rows render from stored data while "Open" resolves.

RESPONSIVE: lg table full-width; mobile DataTable degrades to stacked receipt cards (one per
purchase), 44px touch targets, no horizontal scroll; sign-out behind ConfirmDialog on mobile.

A11Y: real <dl> + real <table> with <caption>, <th scope=col>, aria-sort, <tfoot>; mobile
cards as role=list; status pairs icon+label (never color alone); icon buttons aria-labeled;
ConfirmDialog focus-trap; AA contrast; reduced-motion disables row-lift/chevron.

DOMAIN RULES: receipts are server-owned & immutable (show spaceTitle as purchased, never
recompute totalSpend); B2C scoped to platform_public + consumerProfile (no tenant read);
no AnswerKeyLock/TimerBar/gamification on this surface; all data via @levelup/api-client
(no firebase imports; timestamps already epoch-ms).

Deliver a single responsive React + Tailwind screen using shared-ui components, with the
skeleton, empty, error, and mobile-stacked-card variants.
```

---

## Proposed FOUNDATION additions

These are **not** silently invented into the screen above — flagging for
promotion into FOUNDATION §5 before use:

1. **`ReceiptRow` / receipt-card pattern (data).** The account surface needs a
   canonical immutable-financial-record row (date · item · amount · transaction
   id · open) that degrades table→card on mobile. Today it's composed from
   `DataTable` + ad-hoc cells; if multiple billing surfaces (consumer profile,
   admin billing, future invoices) need it, promote a `ReceiptRow`/`ReceiptList`
   to §5 rather than re-composing per screen.
2. **`DangerZone` panel pattern (containers/feedback).** A reusable
   destructive-action container (delete account, etc.) pairing a `Panel` with a
   danger `Button` + mandatory `ConfirmDialog`. Used here for "Delete account";
   admin/teacher settings will want the same. Worth a §5 entry for consistent
   destructive UX.
3. **Receipt PDF / email action → `v1.analytics.generateReport` extension.** A
   "download/email receipt" affordance has no current callable scoped to a
   single `PurchaseRecord`. If this becomes a requirement, extend
   `generateReport` (or add `v1.levelup.getReceipt`) and add the action to the
   receipt row — do not invent a client-side PDF path.
4. **Delete-account callable.** The danger-zone "Delete account" implies a
   `v1.identity.deleteConsumerAccount` (with billing-record retention) callable
   that does not exist in the §3.3 inventory; flagging so it's added server-side
   before the UI ships it.
