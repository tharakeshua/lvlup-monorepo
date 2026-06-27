# Onboarding Wizard — First-run Tenant Setup

> **Area:** Admin (tenant control plane) · **Route:** `/onboarding` ·
> **Audience:** `tenantAdmin` **Register:** serious — precise, credible chrome
> for staff & admins (NOT the playful student register). Conforms to the Lyceum
> foundation (`docs/rebuild-spec/design/00-FOUNDATION.md`). All colors, type,
> spacing, radii, elevation, motion, and components are cited by **semantic
> token / §5 component name** — no raw hex, no invented variants. Two proposed
> foundation additions are flagged explicitly in §4.

---

## 1. Purpose & primary user

**Primary user:** a freshly-provisioned **tenant administrator** (`tenantAdmin`)
opening the academy console for the very first time. Their tenant exists
(created by a super-admin via `v1.identity.saveTenant`, which seeds the tenant
doc, `tenantCode`, default `features`, and the creator's `tenantAdmin`
membership) but `tenant.onboarding.completed !== true`.

**Job-to-be-done:** _"Get my academy from an empty shell to a usable state in a
few minutes, without reading docs — confirm who we are, what colors we wear,
what school year this is, and create the first class so I can start adding
people. Then hand me the join code so staff and students can get in."_

**Why a gating wizard, not optional setup:** the rest of admin-web is
meaningless until a tenant has identity + an academic session + at least one
class to hang students/exams/spaces on. `OnboardingGuard`
(`apps/admin-web/src/App.tsx:32`) therefore hard-redirects incomplete
`tenantAdmin`s here and keeps them here until
`tenant.onboarding.completed === true`. Super-admins bypass entirely
(`isSuperAdmin` short-circuit).

This is the **one moment** in the admin app where chrome is allowed slightly
more warmth than the rest of the console (a single welcoming hero, a success
beat at the end) — but still restrained: this is staff tooling, not a student
celebration. The marigold **spark** appears only as the final-step success
accent and the primary "Finish" CTA glow, never on the data-entry steps.

---

## 2. Entry points & route

**Route:** `/onboarding` (declared in `apps/admin-web/src/App.tsx:103`, rendered
inside `AppLayout` but deliberately _outside_ the `OnboardingGuard` wrapper that
gates every other route).

**Entry points**

1. **Automatic redirect (primary).** Any `tenantAdmin` whose active tenant has
   `onboarding.completed !== true` is `<Navigate replace>`-ed here from any
   route by `OnboardingGuard` (`App.tsx:48-55`). `replace` is used so the wizard
   is not a back-button trap.
2. **Resume.** If the admin reloads or returns mid-flow, the wizard re-derives
   the current step from `tenant.onboarding.completedSteps[]` (live from
   `useTenantStore`) and resumes at the first incomplete step rather than
   restarting at step 1.
3. **Never reachable once complete.** After completion the guard stops
   redirecting; navigating to `/onboarding` manually shows the
   completed/"already set up" terminal state with a single CTA back to the
   dashboard.

**Reads (common-API — `specs/common-api.md` §3.3)**

- Live tenant doc via the tenant subscription seam — in the rebuild this is the
  realtime concern noted in common-api §10
  (`subscribe('tenant', { tenantId }, cb)`), today
  `useTenantStore.subscribe(currentTenantId)`. Supplies `tenant.name`,
  `contactEmail`, `contactPhone`, `website`, `branding.*`, `tenantCode`, and
  `onboarding.{completed, completedSteps}` — the entire wizard's prefill +
  progress source.
- Auth context: `ctx.activeTenantId` + `ctx.role` from claims (common-api
  §4.3-4.4). `tenantId` is **derived server-side**, never sent in the request
  body (common-api §4.4).

**Writes (common-API — `specs/common-api.md` §3.3, `identity` module)** | Step |
Callable | Notes | |---|---|---| | School info | `v1.identity.saveTenant`
(update branch — `id` present) | name, contactEmail, contactPhone?, website? | |
Branding | `v1.identity.uploadTenantAsset` → `{ assetUrl }`, then
`v1.identity.saveTenant` with `branding.{logoUrl, primaryColor, accentColor}` |
logo upload returns a signed/stored URL; colors persisted on `branding.*` | |
Academic session | `v1.identity.saveAcademicSession` →
`SaveResponse{ id, created }` |
`{ name, startDate?, endDate?, isCurrent: true }` | | First class |
`v1.identity.saveClass` → `SaveResponse{ id, created }` |
`{ name, grade, section?, academicSessionId }` | | Step progress |
`v1.identity.saveTenant` with `onboarding.completedSteps` (append) | server is
authoritative for the array | | Completion | `v1.identity.saveTenant` with
`onboarding.{completed:true, completedSteps, completedAt}` | flips the guard;
**server stamps `completedAt`** | | Staff invite (optional) |
`v1.identity.createOrgUser` (role `teacher`/`staff`) or surfaced as "share the
code" | invites are optional; code-sharing is the zero-friction default |

> **Contract notes vs today's code.** The live `OnboardingWizardPage.tsx` calls
> `callSaveTenant`, `callSaveAcademicSession`, `callSaveClass` and sets
> `onboarding.completed` **client-side** (`lines 136-139`). In the rebuild,
> **completion and `completedAt` are server-authoritative** — the client
> requests completion, the server validates the required steps were actually
> persisted before flipping `completed:true` (closes the "client can mark itself
> done" gap). `saveAcademicSession` returns the new session `id`, which the
> class step **must** consume as `academicSessionId` (today's code drops this
> link — a real bug to fix here: a class created in onboarding should belong to
> the session just created).

---

## 3. Layout — wireframe-as-text

The wizard renders inside **`AppShell`** (§5 Navigation) but in a
**reduced-chrome variant**: because the admin is gated and cannot use the rest
of the app yet, the **Sidebar nav is rendered disabled/dimmed** (visible for
orientation, not actionable) and the **Topbar** keeps only tenant identity,
theme toggle, and profile/sign-out — no search, no ⌘K, no notifications bell
(there's nothing to navigate to). This signals "you're in setup" without hiding
where they'll land.

Content is a **single centered column**, `max-w` ~720 (foundation reading
measure; `Card` content stays ≤ 60–72ch), page gutters per foundation (16 mobile
/ 24 tablet / 32 desktop), vertical rhythm in spacing tokens (`space.8` between
major regions).

```
┌─────────────────────────────────────────────────────────────────────────┐
│ TOPBAR (AppShell, reduced):  [Tenant name + code chip]      [theme] [you]│
├───────────────┬───────────────────────────────────────────────────────── │
│ SIDEBAR       │  ┌─────────────────── centered column (max 720) ───────┐ │
│ (dimmed,      │  │  HERO                                                │ │
│  disabled —   │  │   h1 (Fraunces): "Welcome to {Tenant}"               │ │
│  Overview /   │  │   subhead (Schibsted, text.secondary)                │ │
│  Management / │  │                                                      │ │
│  Analytics /  │  │  STEPPER  ●─━━─○─━━─○─━━─○   (4 nodes + connectors)   │ │
│  Config       │  │   School · Branding · Session · First Class          │ │
│  groups)      │  │   [step N of 4]            [progress %]               │ │
│               │  │                                                      │ │
│               │  │  ┌── Card (e1, radius lg) ─────────────────────────┐ │ │
│               │  │  │ CardHeader: step title + description            │ │ │
│               │  │  │ CardContent: the step's form / panel            │ │ │
│               │  │  │   (Inputs, Select, FileDrop, color swatches…)   │ │ │
│               │  │  │ Footer row:  [Back] ……… [Skip]  [Continue ›]    │ │ │
│               │  │  └─────────────────────────────────────────────────┘ │ │
│               │  │                                                      │ │
│               │  │  small print: "You can change all of this later in   │ │
│               │  │   Settings."  (text.muted)                           │ │
│               │  └──────────────────────────────────────────────────────┘ │
└───────────────┴───────────────────────────────────────────────────────────┘
```

**Step inventory** (rebuild — branding added to the live 3-step + done):

1. **School info** — `name*`, `contactEmail*`, `contactPhone`, `website`.
   Prefilled from the tenant doc.
2. **Branding** — logo `FileDrop` (`uploadTenantAsset`), `primaryColor` +
   `accentColor` swatch pickers. _Skippable._ Live preview of the brand on a
   mini topbar mock. (NEW step; see §4 note on color-input.)
3. **Academic session** — `name*` (default `"{year}-{year+1}"`), `startDate`,
   `endDate` (`DatePicker`). `isCurrent:true` is implicit. _Skippable._
4. **First class** — `name*`, `grade*`, `section`; auto-linked to the session
   created in step 3 (`academicSessionId`). _Skippable._
5. **Done** (terminal, not a numbered step) — success beat, **tenant join code**
   (mono, copyable), and a "share with staff / invite teachers" affordance, then
   **Go to Dashboard**.

**Responsive behavior**

- **lg (≥1024):** AppShell sidebar (dimmed) + centered column as drawn. Two-up
  field rows (phone+website, start+end, grade+section) use a 2-col grid.
- **md (768–1023):** sidebar collapses to icon rail (still dimmed); column
  widens to gutter. Two-up rows remain 2-col where they fit, else stack.
- **sm (<768):** **no sidebar** (admin is desktop-first — see §10); full-width
  column, gutter 16. Stepper **collapses to "Step 2 of 4 · Branding" + a
  `ProgressBar`** instead of 4 labeled nodes (labels are `hidden sm:inline` in
  today's code; the rebuild swaps to an explicit count + bar so the current step
  is named). All two-up rows stack to single column. Footer buttons go
  full-width, stacked (`Continue` on top).

---

## 4. Components used

All from **FOUNDATION §5** unless flagged as a proposed addition.

**Containers / layout**

- `AppShell` (sidebar + topbar) — **reduced-chrome variant** (see §3). Sidebar
  `Sidebar` rendered in a **disabled/dimmed** state; `Topbar` minus
  search/⌘K/notifications.
- `Card` (radius `lg`, elevation `e1`) wrapping each step's header + content +
  footer.
- `Section` for the hero block.

**Primitives**

- `Input` — text/email/url fields (school name, email, phone, website, session
  name, class name, grade, section).
- `DatePicker` — session start / end dates.
- `Select` — _not strictly required_; grade could be a free `Input` (matches
  live code) or a `Select` of common grades. Spec'd as `Input` to mirror real
  data (free-form grade strings like `"10"`).
- `FileDrop` — logo upload in the Branding step.
- `Button` variants: `primary` (Continue / Finish Setup / Go to Dashboard),
  `ghost` (Back), `secondary` (Skip — restrained, low-emphasis), `spark`
  (**only** the final "Go to Dashboard" hero CTA on the Done step).
- `IconButton` — copy-to-clipboard on the tenant code.

**Data / feedback**

- Custom **Stepper** — composed from `Badge`/`Chip` (pill, per-node) +
  `ProgressBar` + connector rule. The foundation lists `ProgressBar`,
  `ProgressRing`, `Badge`, `Chip` but **not a named Stepper/Wizard component**.
  → **Proposed foundation addition: `Stepper`** (horizontal, numbered, states:
  complete / current / upcoming / skipped). It is reused by every multi-step
  admin flow (session rollover, bulk import, exam create). Until added, compose
  from the listed primitives exactly as drawn in §3; do **not** invent new
  tokens — node fills use `brand.primary` (current), `brand.primary` @
  low-emphasis surface (complete), `bg.inset`/`text.muted` (upcoming).
- `Skeleton` — initial tenant-load placeholder for the hero + first card.
- `InlineAlert`/`Banner` — per-step validation summary and any save error.
- `FormFieldError` — per-field validation under each `Input`.
- `Toast` (sonner) — "School info saved", "Academic session created", "First
  class created", "Tenant code copied".
- `LoadingOverlay` — over the active `Card` while a step's callable is in flight
  (replaces today's button-only "Saving…" label so the whole step is locked
  during the write).
- `DefinitionList` — Done step: shows what was set up (school, session, class)
  as a confirmation recap.
- `Stat`/`Badge` — tenant code presented as a prominent mono chip.

**Domain components**

- `AnswerKeyLock` etc. are **not** used here (no assessment surface).
- The Done step's join-code block is a plain `Input readOnly` +
  `IconButton(copy)` using **mono** type (`Spline Sans Mono`) per the
  foundation's "IDs use mono" rule.

> **Proposed foundation addition #2 — `ColorSwatchInput`.** The Branding step
> needs a brand-color picker (`primaryColor`, `accentColor`). §5 has no
> swatch/color input. Proposed: a small `ColorSwatchInput` (a labeled trigger
> showing the current color + a popover of a constrained palette **derived from
> foundation primitives**, plus a hex field). Critically, the academy's chosen
> brand color **does not override Lyceum tokens** — it's stored on `branding.*`
> for the student/parent-facing surfaces only; admin chrome stays on
> `brand.primary`. Flag for the foundation owner.

---

## 5. States

**Loading (skeleton).** While the tenant subscription resolves (no `tenant`
yet), render the hero as a `Skeleton` line pair and the first `Card` as a
skeleton header + 3 skeleton field rows + a skeleton footer. The stepper renders
structurally with all nodes in the "upcoming" style. No interaction until
`tenant` is present.

**Resume (partial).** `tenant.onboarding.completedSteps` is non-empty but
`completed !== true`. Mark each listed step **complete** in the stepper, prefill
every step's form from the tenant/session/class docs, and **open the first
incomplete step**. A subtle `InlineAlert` (info) at the top: _"Picking up where
you left off."_

**Empty (true first run).** `completedSteps` empty. Open at **School info**,
prefilled only with whatever `saveTenant` seeded (`name`, `contactEmail`). This
is the default.

**Per-step in-flight.** On Continue: `LoadingOverlay` over the active `Card`,
primary button shows a spinner + "Saving…", Back/Skip disabled. Optimistically
advance only **after** the callable resolves and the step is appended to
`completedSteps` server-side (see §6 — advancement is not optimistic, because
the guard depends on real persisted progress).

**Error.** Callable rejects → `LoadingOverlay` clears, step stays put, a
`Banner` (status.error) renders the mapped message from the error envelope
(`error.details.code` → `ERROR_MESSAGES`, common-api §6.3) and per-field
`FormFieldError`s for any `validationErrors[]`. A `Toast` (error) mirrors it.
The admin can correct and retry; no progress is lost. Specific cases:

- `VALIDATION_ERROR` → inline field errors + summary banner.
- `QUOTA_EXCEEDED` / `FEATURE_DISABLED` → banner with the recovery hint (rare at
  onboarding, but a tenant on a capped plan could hit a class/session limit;
  surface it honestly rather than failing silently).
- `TENANT_SUSPENDED` → full-card banner blocking the wizard with "Contact your
  platform administrator" — a suspended tenant must not be onboarded.
- Network/`UNKNOWN` → retryable banner with a Retry button (re-issues the same
  step callable).

**Success (Done).** Terminal state: green `status.success` check medallion,
recap `DefinitionList`, the mono tenant-code chip, an optional "Invite teachers"
expander, and the `spark` "Go to Dashboard" CTA. This is the **only**
marigold-spark moment in the whole flow.

**Already-complete.** If reached after completion: a compact card — "Your
academy is set up." + tenant code + "Go to Dashboard" (`primary`, not `spark` —
the celebration is spent).

**Permission-gated variations by role**

- **`tenantAdmin` (the only intended user):** full wizard as specced.
- **`superAdmin`:** the guard never sends them here; if they navigate manually
  they see a thin **info banner**: _"You're viewing a tenant's onboarding as a
  super-admin. Changes here write to {Tenant} via `tenantOverride` and are
  audited."_ — and every write carries the explicit `tenantOverride` (common-api
  §4.4), never the super-admin's own claim tenant. This preserves **tenant
  isolation** even in cross-tenant operation.
- **Any non-admin role** (`teacher`/`student`/`staff`/`parent`) cannot reach
  admin-web at all — `RequireAuth` gates the app to
  `allowedRoles={["tenantAdmin"]}` (`App.tsx:85`) and shows Access Denied before
  this route evaluates. The wizard does not need its own per-role empty state
  for them.

---

## 6. Interactions & motion

Motion uses §4 tokens only; everything is **subtle** except the single Done
celebration.

**Step advance (forward).**

1. Admin fills the step, clicks **Continue** (`Button primary`).
2. Client-side Zod validation (reusing the callable's `requestSchema`,
   common-api §5.2) runs first; failures show `FormFieldError`s instantly, no
   network call.
3. On pass: `LoadingOverlay` fades in over the `Card` (`fast` 160ms,
   `ease.standard`), button → spinner+"Saving…".
4. Callable resolves → server appends the step to `completedSteps`. The outgoing
   `Card` content cross-fades to the next step (`base` 220ms, `ease.entrance` in
   / `ease.exit` out), the stepper's current node advances (the connector fills
   left-to-right, `base`), and a success `Toast` fires.
5. **Advancement is server-confirmed, not optimistic** — because
   `OnboardingGuard` reads real `completedSteps`, advancing before persistence
   could desync the guard on a mid-flow reload. (Contrast: ordinary admin tables
   can update optimistically; the gating wizard cannot.)

**Back.** `Button ghost` — instant, no write, returns to the previous step with
its values intact (form state is held in the wizard, re-hydrated from the
tenant/session/class docs on reload).

**Skip.** `Button secondary` on Branding / Session / First Class. Skipping
advances **without** a write and **without** marking the step complete. Because
completion requires the _required_ steps, a skipped session/class is allowed but
the Done step's recap honestly shows "Not set up yet — add later in Settings."
School info is **not skippable** (name + contactEmail are required to identify
the tenant). If the admin tries to finish with no class, a `ConfirmDialog`:
_"Finish without creating a class? You can add classes later, but you'll need at
least one before enrolling students."_ — Cancel / Finish anyway.

**Stepper node click (jump back).** Clicking a **completed** node returns to it
(editable); clicking an **upcoming** node is disabled (matches live
`handleSkipToStep`, `OnboardingWizardPage.tsx:164-169`). Hover on an enabled
node lifts it with `e2` and `instant` (100ms) color transition.

**Logo upload (Branding).** `FileDrop` accepts image, shows an upload progress
`ProgressBar`, calls `uploadTenantAsset`, then on `{assetUrl}` shows a thumbnail
with a "Replace" affordance. The mini-topbar preview updates live (no write to
`branding.logoUrl` until Continue, batching logo+colors into one `saveTenant`).

**Completion.** On the final required write, the server flips
`onboarding.completed:true` + stamps `completedAt`. The client transitions to
the **Done** card with the **one celebratory beat**: a `spring` pop on the
success medallion + a brief marigold (`spark`) glow on the "Go to Dashboard"
button (`spark glow` elevation token). This is the foundation-sanctioned single
celebratory moment — kept tasteful for admin tone (no confetti, no XP).

**Copy code.** `IconButton` →
`navigator.clipboard.writeText(tenant.tenantCode)`, icon swaps check↔copy for
2s, success `Toast`. (Matches live behavior,
`OnboardingWizardPage.tsx:392-404`.)

**Go to Dashboard.** Navigates to `/`; the guard now passes and the dashboard
mounts normally.

**Reduced motion.** With `prefers-reduced-motion`, all cross-fades/connector
animations become instant opacity swaps, the spring pop becomes a static
medallion, and the spark glow renders as a static border accent — no movement
(§9).

---

## 7. Content & copy

Tone: **precise, warm-but-professional admin voice.** Confident, brief, no
exclamation spam, no student-y gamification language. "You" = the admin.

**Hero**

- h1 (Fraunces): `Welcome to {Tenant name}` (fallback `Welcome to Auto-LevelUp`
  if name not yet set).
- Subhead (text.secondary):
  `Let's get your academy set up — a few minutes, and you can change everything later.`

**Stepper labels:** `School` · `Branding` · `Academic session` · `First class`.
Caption under stepper: `Step {n} of 4`.

**Step 1 — School info**

- Title: `School information` · Description:
  `Confirm how your academy is identified across the platform.`
- Labels: `School name *`, `Contact email *`, `Phone`, `Website`.
- Placeholders: `e.g. Springfield Academy`, `admin@school.edu`,
  `+91 98765 43210`, `https://school.edu`.
- Validation copy: `Enter a school name.` / `Enter a valid contact email.`
- Primary: `Continue ›`

**Step 2 — Branding**

- Title: `Branding` · Description:
  `Add your logo and colors. These appear to your students and parents.`
- Labels: `Logo`, `Primary color`, `Accent color`.
- FileDrop empty: `Drop a logo here, or browse` · helper
  `PNG or SVG, up to 2 MB. Square works best.`
- Helper under colors:
  `Your brand colors style student- and parent-facing screens. The admin console keeps the standard theme.`
- Secondary: `Skip for now` · Primary: `Continue ›`

**Step 3 — Academic session**

- Title: `Academic session` · Description:
  `Create your current school year. Students, classes, and exams are organized under it.`
- Labels: `Session name *`, `Start date`, `End date`.
- Placeholder: `e.g. 2026-2027`.
- Validation: `Enter a session name.` / `End date must be after the start date.`
- Secondary: `Skip for now` · Primary: `Continue ›`

**Step 4 — First class**

- Title: `Create your first class` · Description:
  `One class is enough to start enrolling students.`
- Labels: `Class name *`, `Grade *`, `Section`.
- Placeholders: `e.g. Class 10-A`, `e.g. 10`, `e.g. A`.
- Validation: `Enter a class name.` / `Enter a grade.`
- Skip confirm (see §6): title `Finish without a class?`, body
  `You can add classes later in Management, but you'll need at least one before enrolling students.`,
  actions `Cancel` / `Finish anyway`.
- Secondary: `Skip` · Primary: `Finish setup ✓`

**Done (terminal)**

- Title: `You're all set.` · Description:
  `{Tenant name} is ready. Share your join code so staff and students can get in.`
- Recap heading: `What we set up`
- Join-code label: `Your join code` · helper
  `Staff and students enter this code on the sign-in screen to join {Tenant name}.`
- Copy button aria-label: `Copy join code`
- Invite expander: `Invite teachers now` → reveals an inline `createOrgUser`
  mini-form (`Name`, `Email`, role `Teacher`), or
  `Skip — share the code instead`.
- Skipped-step recap line:
  `Academic session — not set up yet · Add later in Settings.`
- Primary (spark): `Go to dashboard ›`

**Empty / resume / error**

- Resume info banner: `Picking up where you left off.`
- Generic save error banner:
  `We couldn't save this step. {server message} Check the highlighted fields and try again.`
- Network/retry banner: `Something went wrong saving your changes.` + `Retry`
  button.
- Suspended-tenant banner:
  `This academy is currently suspended. Contact your platform administrator before continuing setup.`
- Super-admin viewing banner:
  `You're editing {Tenant name}'s onboarding as a super-admin. Changes are audited.`
- Footer small print (every step):
  `You can change all of this later in Settings.`

---

## 8. Domain rules surfaced

1. **Onboarding is a hard gate (server-authoritative completion).** The app is
   unusable until `tenant.onboarding.completed === true`. `OnboardingGuard`
   enforces the redirect; **completion is set by the server**, not the client,
   after it verifies the required steps were actually persisted. (Fixes the live
   code's client-side `completed:true`, `OnboardingWizardPage.tsx:136-139`.)
   `completedAt` is **server-stamped**.
2. **Tenant isolation is absolute.** Every write derives `tenantId` from
   `ctx.activeTenantId` (the caller's claim), never from the request body
   (common-api §4.4). A `tenantAdmin` can only onboard **their own** tenant.
   Super-admins acting cross-tenant must pass an explicit, **audited**
   `tenantOverride` and the UI labels that they are operating on another tenant
   (§5). Path-based isolation (`/tenants/{tenantId}/...`) is unchanged.
3. **RBAC gating.** Only `tenantAdmin` reaches admin-web
   (`RequireAuth allowedRoles=["tenantAdmin"]`, `App.tsx:85`) and
   `assertTenantAdminOrSuperAdmin` re-checks server-side on every callable
   (be-identity §1.6, auth-access §1.6). The wizard never trusts the client role
   alone.
4. **Provisioning side effects are server-owned.** Creating the first class
   triggers denormalized roster/stat updates and membership/claims plumbing
   server-side (be-identity §1.4). The UI requests; it does not write
   `studentIds`, claims, or counters. `createOrgUser` (invite path) runs the
   Auth-user + membership + claims saga with rollback (be-identity §1.4, §5.4) —
   the wizard surfaces only success/failure.
5. **Session → class linkage.** The class created in step 4 **must** carry
   `academicSessionId` from step 3's `SaveResponse.id`. Onboarding establishes
   the canonical current session (`isCurrent:true`) that downstream admin pages
   depend on.
6. **Quota / feature gates apply even at onboarding.** `assertQuota` /
   `assertFeatureEnabled` run on
   `saveClass`/`saveAcademicSession`/`createOrgUser` (be-identity §1.3). A
   capped plan hitting a limit surfaces an honest
   `QUOTA_EXCEEDED`/`FEATURE_DISABLED` banner — the wizard never bypasses
   governance.
7. **Branding does not override the design system.**
   `branding.{primaryColor,accentColor,logoUrl}` styles
   **student/parent-facing** surfaces only; the admin console and all admin
   chrome remain on Lyceum `brand.primary`/tokens. The Branding step's copy says
   so explicitly.
8. **Audit logging.** Every mutating step writes a best-effort tenant audit
   entry (`logTenantAction`) and platform activity entry (be-identity §1.3,
   §1.5). Onboarding completion is itself an auditable event.
9. **Join code is shareable but not secret-bearing.** The `tenantCode` is the
   join key (used by `lookupTenantByCode` pre-auth + `joinTenant`). It is safe
   to display/copy; it is **not** a credential and grants no access without
   Firebase auth + an admin-issued membership. No passwords are ever shown here.
10. **Pre-auth lookup exposure is minimized.** The join code maps (via the
    **public** `lookupTenantByCode`) to a minimal projection
    `{ tenantId, name, branding }` only (common-api §3.3, auth-access rec #9) —
    the wizard's "share this code" affordance is consistent with that minimized
    surface.

---

## 9. Accessibility (WCAG AA)

- **Landmark & heading order.** One `<h1>` (hero). Each step `Card` header is an
  `<h2>`. Focus order: skip-link → topbar identity → (dimmed sidebar items are
  `aria-disabled`/not tab-stops) → hero → stepper → first focusable field → … →
  footer Back / Skip / Continue. On step change, focus moves to the new step's
  `<h2>` (or first field) and the change is announced via the route/step
  announcer (`aria-live="polite"`).
- **Stepper semantics.** Rendered as an ordered list with `aria-current="step"`
  on the active node. Each node has an accessible name
  `Step {n}: {label}, {complete|current|upcoming|skipped}` — **status is never
  color-alone**: complete nodes carry a check icon + "Completed" in the
  accessible name, current carries the count, upcoming is dimmed _and_ labeled.
  On `sm`, the `Step n of 4 · {label}` text + `ProgressBar` (with
  `aria-valuenow`) carries the same information textually.
- **Forms.** Every `Input`/`DatePicker`/`FileDrop` has a programmatic `<label>`
  (`htmlFor`/`id`), required fields marked with both the `*` glyph and
  `aria-required="true"`. Errors use `aria-describedby` pointing at the
  `FormFieldError`, `aria-invalid="true"`, and the error summary `Banner` is an
  `aria-live="assertive"` region receiving focus on submit failure.
- **Keyboard.** Entire flow operable without a mouse: Tab/Shift-Tab through
  fields, Enter submits the step (Continue), Esc closes the skip
  `ConfirmDialog`, Space activates the copy `IconButton`. `FileDrop` is
  keyboard-reachable with an explicit "browse" button (drag-drop is an
  enhancement, never the only path).
- **Contrast.** All text/control pairs meet AA (4.5:1 body, 3:1 large/UI) using
  foundation semantic tokens. The dimmed sidebar still meets ≥3:1 for its
  (non-interactive) text so it's legible, not invisible. The success medallion
  pairs `status.success` with a check icon + text, never green alone.
- **Loading.** `LoadingOverlay` exposes `role="status"`/`aria-busy` on the step
  `Card`; the "Saving…" state is announced, and focus is trapped within the
  disabled card until resolution.
- **Reduced motion.** `prefers-reduced-motion: reduce` → cross-fades, connector
  fills, the spring medallion pop, and the spark glow all degrade to
  instant/static (§6). No essential information is conveyed by motion alone.
- **Copy feedback.** Code-copied state announced via `aria-live` ("Join code
  copied") in addition to the icon swap and toast — not icon-only.

---

## 10. Web ↔ mobile divergence

Admin-web is **primarily a web/desktop tool** — academy setup is a deliberate,
form-heavy, desktop-first task and there is no React Native admin app planned
(the RN apps are learner + scanner only, per common-api §1). State this
explicitly: **the Onboarding Wizard ships web-only.**

**Web specifics that have no mobile counterpart**

- The **⌘K command palette is web-only** (and is _suppressed entirely_ on this
  screen anyway — there's nowhere to navigate during gated setup).
- Hover affordances (stepper-node lift `e2`, prefetch) are pointer-only.

**Responsive (small-viewport web) behavior** — the wizard must still be usable
on a phone browser because an admin may open the link on mobile:

- AppShell sidebar drops out below `md`; stepper collapses to
  `Step n of 4 · {label}` + `ProgressBar` (§3, sm).
- All two-up field rows stack to single column; footer buttons go full-width
  stacked (`Continue` first).
- Touch targets ≥44px (foundation). `FileDrop` exposes the native file picker.
- Component **names/props are identical** to any future shared-ui usage
  (foundation §6) — only the renderer differs — but no `ui-native` parity build
  is required for this admin-only screen.

---

## 11. Claude-design prompt (ready to paste)

```
You are designing ONE screen for the Auto-LevelUp admin console rebuild, in the "Lyceum" design system.
FIRST read docs/rebuild-spec/design/00-FOUNDATION.md and conform EXACTLY: use ONLY its semantic color tokens
(brand.primary, spark, bg.surface, bg.canvas, text.primary/secondary/muted, border.subtle, status.success/error,
etc.), its type families (Fraunces display, Schibsted Grotesk UI, Spline Sans Mono for codes/IDs), its
spacing/radius/elevation/motion tokens, and ONLY the §5 component inventory. Do NOT invent colors, fonts, or
component variants. Register: SERIOUS — precise, credible admin chrome, NOT the playful student register. The ONE
allowed celebratory moment is the final success beat.

SCREEN: First-run tenant Onboarding Wizard, route /onboarding, audience tenantAdmin. It is a HARD GATE: the rest of
admin-web is locked until tenant.onboarding.completed === true (a server-authoritative flag). Render inside the
AppShell but in a REDUCED-CHROME variant: sidebar visible-but-dimmed/disabled, topbar shows only tenant
identity + theme + profile (NO search, NO ⌘K, NO notifications).

LAYOUT: single centered column, max ~720. Hero (h1 Fraunces "Welcome to {Tenant}", text.secondary subhead). A
horizontal STEPPER with 4 nodes (School · Branding · Academic session · First class) + "Step n of 4". Below it, a
Card (radius lg, elevation e1) holding the current step: CardHeader (h2 title + description), CardContent (the
step's form), and a footer row [Back ghost] … [Skip secondary] [Continue primary].

STEPS:
1) School info — name*, contactEmail*, phone, website (prefilled).
2) Branding — logo FileDrop + primary/accent color swatch inputs, with a live mini-topbar preview. Copy must state
   brand colors style STUDENT/PARENT screens only; the admin console keeps the standard theme. Skippable.
3) Academic session — name* (default "{year}-{year+1}"), start/end DatePickers. Skippable.
4) First class — name*, grade*, section; auto-linked to the session from step 3. Skippable (with a confirm dialog
   "Finish without a class?").
DONE (terminal): a spring-pop success medallion (status.success + check icon), a "What we set up" DefinitionList
recap, the tenant join code in MONO as a copyable chip (IconButton copy), an optional "Invite teachers now"
expander, and a SPARK primary CTA "Go to dashboard" (the single marigold spark + spark-glow moment).

STATES: skeleton load; resume (prefilled, open first incomplete step, "Picking up where you left off" info banner);
per-step LoadingOverlay while saving; error Banner (status.error) mapped from the typed error envelope with
per-field FormFieldError; quota/feature/suspended banners; toasts on each save.

MOTION (foundation §4 only, subtle): step cross-fade base 220ms ease.entrance/exit; connector fill base; the ONLY
spring + spark glow is the Done medallion + CTA. Respect prefers-reduced-motion (everything becomes instant/static).

A11Y: one h1, h2 per step, focus moves to new step heading on advance; stepper as an ordered list with
aria-current="step" and status conveyed by icon+text NOT color alone; labeled required fields (aria-required,
aria-invalid, aria-describedby); error summary aria-live; full keyboard operation; AA contrast; copy-success
announced via aria-live.

DOMAIN RULES to honor visually: completion is server-set (client cannot self-complete); tenantId is derived from
the caller's claim (tenant isolation); branding never overrides Lyceum admin tokens; the join code is shareable but
not a credential and no passwords are shown; quota/feature gates can legitimately block a step.

Two foundation additions are pre-approved for this screen ONLY if needed: a `Stepper` (horizontal numbered:
complete/current/upcoming/skipped) composed from foundation tokens, and a `ColorSwatchInput` whose palette derives
from foundation primitives. Flag both as proposed foundation additions; do not introduce any other new token or
variant.

Deliver desktop (lg) as the primary, plus the sm-stacked variant (no sidebar; stepper → "Step n of 4 · {label}" +
ProgressBar; full-width stacked footer buttons).
```
