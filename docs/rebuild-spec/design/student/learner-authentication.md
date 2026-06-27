# Learner Authentication — Login / Signup (B2B school-code + B2C consumer)

> Conforms to **Lyceum / Direction A — "Modern Scholarly"**
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). Cite tokens by semantic name;
> do not re-paste scales. Student tone: warm, low-friction, welcoming.

---

## 1. Purpose & primary user

**Primary user:** a _learner_ arriving unauthenticated — either a **B2B school
student** (tenant member, role `student`) or a **B2C consumer learner**
(self-serve, no membership, served from the synthetic `platform_public` tenant).

**Job-to-be-done:** "Let me into my learning quickly and without confusion —
with my school's identity if I'm a school student, or straight into my own
account if I'm here on my own." The surface must serve two flows from one
welcoming entry without forcing the user to understand the B2B/B2C distinction
up front, and without leaking which schools exist.

This is the single front door rendered inside the shared `AuthLayout`. It
precedes everything: dashboard, spaces, tests, store.

---

## 2. Entry points & route

**Routes (from `shared-routing` manifest; unauthenticated, no role gate):**

- `/login` — the combined login surface (default landing for any signed-out
  visitor; `RequireAuth` redirects here on missing/expired session).
- `/signup` — B2C consumer account creation (school students are provisioned by
  their admin and never self-sign-up).
- `/forgot-password` — password reset request.

**Entry points:** deep-link bounce from any guarded route (`RequireAuth` →
`/login` preserving `returnTo`); marketing/store CTA → `/signup`; "Forgot
password?" link; Google sign-in (B2C only).

**Reads / writes that power it** (all via `@levelup/api-client`; UI never
touches `firebase/firestore` directly):

- **Step 1, B2B school-code resolve:** `v1.identity.lookupTenantByCode`
  (**public**, pre-auth) → minimal projection `{ tenantId, name, branding }`
  only. This is the ONLY datum that drives tenant branding on this screen. Never
  request or render anything beyond this projection.
- **Step 2, B2B + B2C credential sign-in:** Firebase Authentication
  email/password (`signInWithEmailAndPassword`) and Google
  (`signInWithPopup`/redirect, B2C only), driven through
  `shared-stores/auth-store` (the single auth source of truth — school-code
  login + friendly error mapping already live here per webapps-design §4.3).
- **B2C signup:** Firebase `createUserWithEmailAndPassword`; the lazily-backed
  `consumerProfile` on `/users/{uid}` is established server-side on first
  authenticated load (no membership write from this screen).
- **Post-auth identity:** `auth-store` subscribes to `/users/{uid}`
  (`UnifiedUser`) and memberships; the post-login redirect decision (B2B
  dashboard vs `/consumer`) is made by `RequireAuth` / `LearnerContext`, not by
  this screen.
- **Forgot password:** Firebase `sendPasswordResetEmail`.

This screen issues **no tenant-scoped reads** — it runs entirely pre-membership.

---

## 3. Layout — wireframe-as-text

Renders inside `AuthLayout` (shared `@levelup/shared-ui/layout`): a centered
single-column card on `bg.canvas`, brand mark top, optional editorial side-panel
on `lg`. Max card width ~`420px` (well under the 720 reading measure); page
gutters per FOUNDATION §4 (16 mobile / 24 tablet / 32 desktop).

```
┌───────────────────────────── bg.canvas ─────────────────────────────┐
│                                                                      │
│   lg+ : two-column split          │    sm/md : single column         │
│ ┌───────────────────┬───────────┐ │  ┌───────────────────────────┐   │
│ │  EDITORIAL PANEL  │  AUTH CARD │ │  │        AUTH CARD          │   │
│ │  (lg only)        │ (e1, lg    │ │  │  (full-width, gutters)    │   │
│ │  Fraunces hero    │  radius)   │ │  │                           │   │
│ │  "Welcome back to │           │ │  │  [brand mark]             │   │
│ │   your learning." │  ┌──────┐ │ │  │  ── tenant chip (B2B,     │   │
│ │  paper texture,   │  │ FORM │ │ │  │     after code resolves)  │   │
│ │  bg.surface-sunken│  └──────┘ │ │  │  ── form region           │   │
│ └───────────────────┴───────────┘ │  └───────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Auth card regions (top → bottom):**

1. **Brand zone** — Lyceum mark (default). After a B2B school code resolves,
   this swaps to a **tenant brand chip**: tenant `name` + (if present)
   `branding.logoUrl`, on `bg.surface`. Until then, NO tenant identity is shown.
2. **Mode affordance** — a quiet segmented control / link: "I have a school
   code" ↔ "Personal account". Default = personal (B2C) for an organic visitor;
   sticky last-used via local pref.
3. **Form region** — one of: `SchoolCodeLoginForm` (B2B step 1→2),
   `DirectLoginForm` (B2C login), `SignupForm` (B2C), `ForgotPasswordForm`.
4. **Footer links** — context-appropriate: "Forgot password?", "New here? Create
   an account", "Use a school code instead".

**Responsive behavior:**

- **sm (≤640):** single column, card is full-width minus 16 gutters, editorial
  panel hidden. Inputs full-width, ≥44px touch targets. Footer links stack.
- **md (768):** centered card max ~420px on `bg.canvas`, editorial panel still
  hidden.
- **lg (1024+):** two-column split — left editorial panel (`bg.surface-sunken`,
  Fraunces hero, scholarly imagery) ~`45%`, right auth card ~`55%`, vertically
  centered. The split is decorative only; on B2B brand resolve the editorial
  panel may tint to the tenant's brand color at low chroma (subtle), but copy
  stays generic.

`AppShell`/`Sidebar`/`Tabbar` are **absent** here — `AuthLayout` is the chrome.

---

## 4. Components used (FOUNDATION §5 only)

- **Layout:** `AuthLayout` (shared) — the entire frame.
- **Containers:** `Card` (the auth card, `e1`, lg radius), `Section` (form
  grouping), `Tabs` _or_ a `Switch`-style segmented control for B2B/B2C mode
  (compose from primitives — see Proposed additions).
- **Primitives:** `Input` (email, password, school-code, name), `Button` —
  **`spark` variant** for the single hero CTA per form (Sign in / Continue /
  Create account; spark glow reserved per FOUNDATION §4),
  **`secondary`/`ghost`** for Google sign-in and mode toggles, `Checkbox`
  ("Remember me" / "I agree"), `IconButton` (password show/hide toggle).
- **Feedback:** `InlineAlert`/`Banner` for friendly auth errors and the "no
  school account → use personal" hint; `FormFieldError` for per-field
  validation; `LoadingOverlay`/button-spinner for in-flight auth; `Toast`
  (sonner) for "Reset link sent".
- **Data:** `Chip`/`Badge` for the resolved **tenant brand chip**; `Avatar` for
  tenant `branding.logoUrl`; `Skeleton` for the brand-chip resolve shimmer.
- **Pattern modules (composed, not new primitives):** `SchoolCodeLoginForm`,
  `DirectLoginForm`, `SignupForm`, `ForgotPasswordForm` — feature-level
  compositions of the above.

**Domain components:** none of the gamification/assessment domain components
apply pre-auth. `AnswerKeyLock`, `TimerBar`, `XPMeter`, etc. are intentionally
absent — there is no learner content here yet.

**Proposed FOUNDATION additions** (flagged, not silently invented):

- **`SegmentedControl`** — a two/three-option pill toggle (B2B "School code" ↔
  B2C "Personal account"). Today `Tabs` or a `Switch` can stand in, but a
  dedicated low-prominence segmented control is a recurring need (also login on
  admin/teacher). Propose promoting it into §5 Primitives before sessions run.
  Until then, implement as `Tabs` (pill, `bg.inset` track, `brand.primary`
  active).
- **`SocialAuthButton`** — Google sign-in button with provider glyph. Today it's
  a `Button secondary` + icon; if multiple providers are added, promote a
  dedicated variant. Flagged so the Google "G" lockup/brand-compliance is owned
  in one place.

---

## 5. States

- **Loading (initial):** `AuthLayout` renders instantly (no data dependency).
  The form is interactive immediately; only the brand chip has an async
  dependency.
- **B2B code-resolving (partial):** after submitting a school code, the brand
  zone shows a `Skeleton` shimmer + button spinner while
  `v1.identity.lookupTenantByCode` is in flight; the email/password fields are
  revealed only on success.
- **B2B code resolved (success, step 2):** tenant brand chip renders (`name` +
  logo); form transitions to email/password; a quiet "Not your school? Change
  code" `ghost` link appears.
- **B2B code not found:** `InlineAlert` (status.warning, NOT error-red — this is
  recoverable): "We couldn't find a school with that code. Double-check it with
  your teacher, or sign in with a personal account." NEVER confirm/deny which
  codes exist beyond this single generic message — the projection itself is the
  only signal, and a not-found returns the same shape (no enumeration).
- **Credential error (in-flight → fail):** `InlineAlert` (status.error) with
  **friendly-mapped** copy (see §7) — never raw Firebase error codes. Fields
  retain input; password is NOT cleared (reduce friction); focus returns to the
  alert then the first errored field.
- **Empty (forms):** fields show placeholders + labels; the hero CTA is enabled
  but client-validates on submit (don't disable — let the user try).
- **Submitting (success path):** hero `spark` Button shows inline spinner +
  label swap ("Signing you in…"); inputs disabled; on success the screen
  unmounts as `RequireAuth` redirects (B2B → `returnTo`/dashboard; B2C →
  `/consumer` or `returnTo`).
- **Forgot-password success:** form collapses to a confirmation panel + `Toast`:
  "Check your inbox — we sent a reset link to {email}." with a "Back to sign in"
  `ghost` button. (Send the same confirmation whether or not the email exists —
  no account-existence leak.)
- **Network/offline error:** `InlineAlert` (status.info/warning): "We can't
  reach the server right now. Check your connection and try again." with a Retry
  `secondary` Button.
- **Permission/role-gated variation:** there is **no role gate on this screen**
  (it's pre-auth). The B2B-vs-B2C divergence is a _mode_, not a permission. The
  post-auth **consumer-fallback** (signed-in user with no membership who lands
  on a B2B route → redirected to `/consumer`) is owned by `RequireAuth`
  (`onMissingMembership: 'consumerRedirect'`), not rendered here — but if such a
  user is bounced back to `/login` while already authenticated, show a one-line
  `InlineAlert`: "You're signed in as a personal learner — taking you to your
  learning." and redirect.

---

## 6. Interactions & motion

All motion subtle per FOUNDATION §4 (`fast`/`base`,
`ease.standard`/`ease.entrance`). **No `CelebrationBurst` here** — celebratory
marigold burst is reserved for gamification moments
(XP/streak/level-up/achievement/100%), never for auth.

- **Mode toggle (B2B ↔ B2C):** segmented control switch cross-fades the form
  region (`motion.fast`, `ease.standard`); the brand chip resets to the Lyceum
  mark when leaving B2B mode.
- **School-code → reveal step 2:** on resolve success, the email/password block
  slides+fades in below the brand chip (`motion.base`, `ease.entrance`); the
  code field collapses into the compact brand chip (height transition,
  `motion.base`). This is the one "delight" beat — kept restrained.
- **Password show/hide:** `IconButton` toggles input type instantly
  (`motion.instant`); icon swaps eye/eye-off.
- **Submit (optimistic-ish):** the hero `spark` Button enters loading
  immediately on click (no optimistic auth state — auth is server-authoritative;
  we only optimistically show the spinner). On failure, button returns to rest,
  `InlineAlert` enters with `motion.fast`.
- **Error entrance/exit:** `InlineAlert` uses `ease.entrance` in / `ease.exit`
  out; never jumps layout abruptly — reserve its space.
- **Confirmations:** none destructive here; forgot-password "sent" is a soft
  confirmation panel, not a `ConfirmDialog`.
- **Reduced motion:** all transitions degrade to instant opacity swaps (no
  slide/height animation) under `prefers-reduced-motion`.

---

## 7. Content & copy (warm, encouraging, low-friction)

**Hero / headings (Fraunces):**

- B2C login: "Welcome back." Sub (Schibsted, text.secondary): "Pick up right
  where you left off."
- B2C signup: "Start learning today." Sub: "Create your account — it takes a
  minute."
- B2B step 1: "Sign in to your school." Sub: "Enter the code your teacher gave
  you."
- B2B step 2 (after resolve): "Welcome to {tenant.name}." Sub: "Sign in with
  your school account."
- Forgot password: "Let's get you back in." Sub: "We'll email you a reset link."

**Labels:** "School code", "Email", "Password", "Full name" (signup), "Remember
me", "Confirm password".

**Buttons:** "Continue" (B2B step 1), "Sign in" (steps/B2C), "Create account",
"Send reset link", "Continue with Google".

**Footer links:** "Forgot password?", "New here? Create an account", "Use a
school code instead", "Have a personal account? Sign in".

**Empty/helper:** school-code helper: "Looks like 'SUB001' — ask your teacher if
you're not sure."

**Error copy (friendly-mapped — never raw codes):**

- Wrong password / no user: "That email and password don't match. Let's try that
  again — or reset your password."
- Too many attempts: "Too many tries for now. Give it a few minutes and you'll
  be back in."
- Invalid email format: "Hmm, that doesn't look like an email address."
- School code not found: "We couldn't find a school with that code. Double-check
  it with your teacher, or sign in with a personal account."
- Network: "We can't reach the server right now. Check your connection and try
  again."
- Disabled/suspended account: "This account isn't active right now. Reach out to
  your school admin and they'll sort it out." (generic — no internal status
  detail).

**Forgot-password confirmation:** "Check your inbox — we sent a reset link to
{email}. Don't see it? Peek in spam."

Tone rule: every error frames a next step and never blames ("Let's try that
again" not "Invalid credentials").

---

## 8. Domain rules surfaced

- **Minimal tenant projection — no enumeration leak.**
  `v1.identity.lookupTenantByCode` is the _only_ pre-auth read and returns
  **exactly** `{ tenantId, name, branding }`. Tenant branding (name, logo,
  low-chroma accent) appears **only after** a valid code resolves; before that,
  zero tenant identity is shown. A wrong/unknown code returns a generic
  not-found and the screen NEVER confirms which codes exist or how many schools
  there are. Do not store the resolved `tenantId` anywhere observable beyond the
  in-flight form state until sign-in completes.
- **Tenant isolation begins post-auth.** This screen issues no
  `tenants/{tenantId}/...` reads. Tenant-scoped data only loads after Firebase
  sign-in + claim attachment. B2C draws from the synthetic `platform_public`
  tenant + `user.consumerProfile`, established server-side — not written from
  here.
- **Consumer-fallback rule.** A signed-in user with **no membership** who hits a
  B2B route is redirected to `/consumer`
  (`RequireAuth.onMissingMembership: 'consumerRedirect'`). This screen's job is
  only to authenticate; the routing decision is downstream. Surface a soft
  one-liner if such a user is bounced back here while authenticated (see §5).
- **Auth is server-authoritative.** The client never decides who is allowed in;
  Firebase verifies credentials and claims drive role/tenant. No client-side
  "fake" success states.
- **No account-existence leak on reset.** Forgot-password shows the same
  confirmation regardless of whether the email is registered.
- **All data via `@levelup/api-client`.** The public lookup goes through the
  typed callable registry (`v1.identity.lookupTenantByCode`); responses
  Zod-validated; the UI never imports `firebase/firestore`. Auth itself flows
  through `shared-stores/auth-store` (the single source of truth with built-in
  friendly error mapping).
- **Answer-key / timer / gamification rules** are not applicable pre-auth (no
  content, no test, no XP). `CelebrationBurst` is explicitly NOT used here.

---

## 9. Accessibility

- **Single `<main>` landmark** inside `AuthLayout`; the auth card is a `<form>`
  with an accessible name from the heading (`aria-labelledby`).
- **Focus order:** brand/mode toggle → first field (school-code or email) →
  password → show/hide toggle → remember-me → hero CTA → secondary (Google) →
  footer links. On mode/step transition, focus moves to the first newly-revealed
  field. On error, focus moves to the `InlineAlert` (`role="alert"`,
  `aria-live="assertive"`) then is recoverable to the errored field.
- **Keyboard:** Enter submits the active form; segmented control is arrow-key
  navigable (`role="tablist"`/`radiogroup`); password show/hide is a real
  focusable `button` with `aria-pressed`. No keyboard trap; Escape on
  forgot-password confirmation returns to sign-in.
- **ARIA:** each `Input` has a visible `<label>` (not placeholder-only);
  `aria-invalid` + `aria-describedby` wiring errors to `FormFieldError`; the
  in-flight CTA sets `aria-busy="true"`; the resolving brand chip uses
  `aria-live="polite"` ("School found: {name}").
- **Contrast:** all text/bg pairs meet WCAG AA (4.5:1 body, 3:1 UI) per
  FOUNDATION §2; the spark CTA's `text.on-accent` on spark passes; status alerts
  pair color with an icon + label (never color-only).
- **Reduced motion:** honor `prefers-reduced-motion` — transitions become
  instant opacity changes; no slide/height animation, no spark glow pulse.
- **Touch targets ≥44px**; Google glyph has a text label, not icon-only.

---

## 10. Web ↔ mobile divergence (FOUNDATION §6)

Component **names/props match 1:1** between `shared-ui` (web) and `ui-native`
(mobile); only renderer differs.

- **Layout:** web `lg` two-column editorial split → mobile single full-bleed
  column; editorial panel dropped (or a slim header image). No `⌘K`
  CommandPalette anywhere in auth (none on mobile either).
- **Interaction:** hover affordances on links/toggles → press/active states on
  mobile; `IconButton` hover tooltip → none on mobile.
- **Google sign-in:** web uses `signInWithPopup`; mobile uses native Google
  Sign-In SDK / `signInWithRedirect` — same `SocialAuthButton` surface,
  different transport.
- **Keyboard:** mobile shows numeric/email keyboards via `inputMode` (email
  field → `inputMode="email"`, school-code → uppercase autocapitalize); no
  physical Enter-to-submit reliance — explicit CTA is primary.
- **Brand chip / forms:** identical composition; mobile inputs honor the ≥44px
  target natively and avoid the segmented control overflowing — it stacks if
  needed.
- **No Tabbar/Sidebar** on either platform here — `AuthLayout` is the only
  chrome; the `Tabbar` appears only post-auth.

---

## 11. Claude-design prompt (ready to paste)

```
Design the LEARNER AUTHENTICATION screen for the Auto-LevelUp student web app,
strictly conforming to the "Lyceum" design system (Direction A — Modern Scholarly)
in docs/rebuild-spec/design/00-FOUNDATION.md. Do NOT invent colors, fonts, spacing,
radii, shadows, motion, or component variants — compose only from FOUNDATION §2–§5
and cite tokens by semantic name.

CONTEXT: One welcoming front door, two flows.
(A) B2B school login = two steps: (1) "School code" Input + Continue (spark Button)
    that resolves a tenant via the PUBLIC v1.identity.lookupTenantByCode returning
    ONLY { tenantId, name, branding }; on success reveal email/password (step 2) and
    show a tenant brand chip (name + logo). A wrong code shows a friendly, generic
    "couldn't find that school" InlineAlert (status.warning) — NEVER reveal which
    codes exist.
(B) B2C consumer = email/password DirectLoginForm + "Continue with Google"
    (secondary Button), plus a /signup form and /forgot-password. No tenant branding.

LAYOUT: Render inside the shared AuthLayout — centered Card (e1, radius.lg) on
bg.canvas, max ~420px. At lg (1024+) split into a left editorial panel
(bg.surface-sunken, a Fraunces hero "Welcome back.") + right auth card. At sm/md it
collapses to a single column with 16/24 gutters, inputs full-width, ≥44px targets.
A quiet segmented control toggles "School code" vs "Personal account" (use Tabs as a
stand-in for the proposed SegmentedControl). Brand zone shows the Lyceum mark by
default; only AFTER a code resolves does it swap to the tenant chip.

TYPE: Fraunces for the hero heading, Schibsted Grotesk for labels/body/buttons,
Spline Sans Mono is NOT needed here. Spark Button = the ONE hero CTA per form;
everything else is secondary/ghost.

STATES: render the school-code resolving state (Skeleton brand chip + button spinner),
resolved step-2 state (tenant chip + email/password), a friendly credential-error
InlineAlert (status.error, warm copy like "That email and password don't match — let's
try that again"), and the forgot-password "reset link sent" confirmation.

MOTION: subtle only (motion.fast/base, ease.entrance/standard) — step-2 reveal
slides+fades in; honor prefers-reduced-motion. There is NO CelebrationBurst on auth
(that marigold spark burst is reserved for gamification only).

TONE: warm, encouraging, low-friction; every error names a next step and never blames.

A11Y: visible labels, role="alert" aria-live on errors, password show/hide as a real
aria-pressed button, focus moves to the newly revealed field on step change, WCAG AA
contrast, status paired with icon+label (never color alone).

DELIVER: a high-fidelity desktop (lg split) AND mobile (sm single-column) frame of the
B2B step-1, B2B step-2 (resolved), and B2C login states.
```
