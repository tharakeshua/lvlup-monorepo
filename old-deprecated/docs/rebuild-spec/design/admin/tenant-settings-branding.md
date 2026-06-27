# Tenant Settings & Branding

> **Area:** admin · **Route:** `/settings` · **Role:** `tenantAdmin`
> (single-tenant scope) **Design system:** Lyceum — see
> [`../00-FOUNDATION.md`](../00-FOUNDATION.md). This spec composes only from
> foundation tokens and the §5 component inventory; it cites tokens by semantic
> name and never re-pastes hex. Register: **serious/credible** (admin chrome
> restraint), not the playful student register.

---

## 1. Purpose & primary user

**Primary user:** a tenant administrator (`tenantAdmin`) — the school / academy
operator responsible for one tenant. They are not a developer; they are an
operations owner who needs to keep their academy's identity, contact details, AI
configuration, and feedback policy correct and current.

**Job-to-be-done:** _"Configure how my academy presents itself and behaves — its
name and contact info, its logo and colors, the AI grading key, and the
evaluation-feedback policy — without breaking anything and without leaving the
Lyceum look-and-feel."_

**Why this screen is serious-register:** every value here is
tenant-authoritative and propagates to students, parents, and teachers (logo in
their shells, colors as accents, evaluation dimensions on their result screens).
Restraint, clear save/cancel affordances, explicit confirmation on destructive
actions, and zero ambiguity about what is server-authoritative. No celebratory
motion anywhere on this screen.

**Hard boundary:** a `tenantAdmin` may configure **only their own active
tenant**. There is no tenant picker for editing here; the tenant being edited is
always the one in the active-tenant claim. Tenant **creation**, plan/quota
limits, and feature-flag _grants_ are super-admin concerns (see §8).

---

## 2. Entry points & route

**Route:** `/settings` (under `RequireAuth allowedRoles={["tenantAdmin"]}` +
`OnboardingGuard`), rendered inside `AppLayout` → `AppShell`. Reached from the
Sidebar **Configuration** nav group, from the Topbar profile menu ("Tenant
settings"), and via `⌘K` command "Settings" (web-only).

**Reads (all via `packages/api-client`, never direct Firestore — common-api
§"Key shift"):**

- The active **Tenant** doc is already live in `useTenantStore` (subscription
  wired in `App.tsx`); the page reads
  `tenant.{name, tenantCode, contactEmail, contactPhone, website, contactPerson, address, branding, settings, subscription, features}`
  from the store. No extra fetch for the tenant itself.
- **Evaluation settings list** — today an inline
  `collection(db, .../evaluationSettings)` read in `SettingsPage.tsx`. In the
  rebuild this MUST move behind a typed callable/query (status report §4.1,
  common-api §"Key shift"). Proposed: `v1.identity.listEvaluationSettings`
  (paginated, tenant-derived) — **flagged below as a required API addition**;
  the current code's direct Firestore read and direct `updateDoc` are
  non-conformant.

**Writes (all via `api-client` typed callables — `specs/common-api.md`):**

- **Branding, contact, general settings, feature toggles** → today
  `callSaveTenant` (`v1.identity.saveTenant`). Per common-api §118,
  `v1.identity.saveTenant` is the **super-admin** create/update entry and
  `tenantId` is no longer accepted in the body (derived from the active-tenant
  claim). A `tenantAdmin` self-service settings edit therefore needs a
  **tenant-scoped** write that authorizes `isTenantAdmin(activeTenant)` and
  accepts only the admin-editable subset. **Flagged in §4/§8 as a required API
  addition:** `v1.identity.updateMyTenantSettings` (tenant-derived; accepts
  `{ profile?, branding?, settings?, features? }`; rejects `subscription`,
  `tenantCode`, `status`, `ownerUid`). Until it exists, the screen is
  contract-blocked on super-admin-only `saveTenant`.
- **Logo / banner / favicon upload** → `v1.identity.uploadTenantAsset`
  (common-api §121) → `{ assetUrl }`. Two-step: callable returns a signed PUT
  URL + public URL; the browser `PUT`s the file directly to Storage (see
  `LogoUploader.tsx`). The asset URL is then persisted onto `branding.*` via the
  tenant-update write above.
- **Gemini API key** → the same tenant-update write, field
  `settings.geminiKey…`. The server stores a secret **ref**
  (`settings.geminiKeyRef`) and returns only a boolean `settings.geminiKeySet`;
  the key value is never read back to the client.

**Server-authoritative, read-only on this screen:** `tenantCode`,
`subscription.{plan, maxStudents, maxTeachers, maxSpaces, maxExamsPerMonth}`,
`usage.*`, `status`, and the _availability_ of each feature flag (a tenantAdmin
may toggle a granted feature on/off but cannot grant one their plan excludes —
§8).

---

## 3. Layout — wireframe-as-text

Rendered in the `AppShell` content region (Sidebar + Topbar persist). Page max
content width = foundation reading-to-layout max (1200); the settings forms sit
in a centered column capped near 960 so form rows stay in a comfortable 60–72ch
measure. Page gutters follow foundation (mobile 16 / tablet 24 / desktop 32).

```
AppShell
├─ Sidebar (Configuration group → "Settings" active)
├─ Topbar (tenant name + code chip · search · notifications · profile)
└─ Content
   ┌─────────────────────────────────────────────────────────────────────┐
   │ PAGE HEADER  (gap-2)                                                 │
   │   h1 "Tenant settings"            [Badge: plan]  [Chip: tenantCode]  │
   │   p.secondary "Configure how {tenant.name} appears and behaves."     │
   ├─────────────────────────────────────────────────────────────────────┤
   │ Tabs  (md+: horizontal · sm: 2-col grid as today)                   │
   │   [General] [Branding] [Evaluation] [Features] [AI & API]           │
   ├─────────────────────────────────────────────────────────────────────┤
   │ TAB PANEL  (vertical stack of Section/Card, gap-6)                  │
   │ ┌──── General ───────────────────────────────────────────────────┐ │
   │ │ Section "School information"            [Edit ▸ / Cancel·Save]  │ │
   │ │   2-col grid (md+) → 1-col (sm):                               │ │
   │ │   • School name (Input)        • Tenant code (Input, read-only │ │
   │ │   • Contact email (Input)        + Copy IconButton, mono)      │ │
   │ │   • Contact phone (Input)      • Website (Input)               │ │
   │ │   • Contact person (Input)                                     │ │
   │ │   • Address sub-group (street/city/state/country/zip)          │ │
   │ ├──── General ───────────────────────────────────────────────────┤ │
   │ │ Section "Subscription" (read-only DefinitionList)              │ │
   │ │   Plan · Max students · Max teachers · Max spaces  (Stat tiles)│ │
   │ │   InlineAlert (info): "Managed by your platform provider."     │ │
   │ └────────────────────────────────────────────────────────────────┘ │
   │ ┌──── Branding ──────────────────────────────────────────────────┐ │
   │ │ Section "Logo & assets"                                        │ │
   │ │   FileDrop (LogoUploader) — preview tile + drop zone           │ │
   │ │ Section "Brand color" (constrained — see §8)    [Edit/Save]    │ │
   │ │   • Brand accent picker → choose from Lyceum-allowed swatches  │ │
   │ │   • (advanced) hex Input, validated to AA against bg.surface   │ │
   │ │ Section "Preview" — live Card mocking a shell header + button  │ │
   │ └────────────────────────────────────────────────────────────────┘ │
   │ ┌──── Evaluation ────────────────────────────────────────────────┐ │
   │ │ List of evaluation-setting Cards (Default badge)               │ │
   │ │   per card: dimension Chips (toggle) + 2 Switches              │ │
   │ └────────────────────────────────────────────────────────────────┘ │
   │ ┌──── Features ──────────────────────────────────────────────────┐ │
   │ │ DefinitionList of TenantFeatures, each a Switch row            │ │
   │ │   (disabled+Tooltip when plan excludes the feature)            │ │
   │ └────────────────────────────────────────────────────────────────┘ │
   │ ┌──── AI & API ──────────────────────────────────────────────────┐ │
   │ │ Section "Gemini API key" — masked field + Set/Update/Remove    │ │
   │ │   InlineAlert (info): key is stored server-side, never shown.  │ │
   │ └────────────────────────────────────────────────────────────────┘ │
   └─────────────────────────────────────────────────────────────────────┘
```

**Responsive behavior:**

- **sm (≤640):** single-column. Tabs render as a 2-col grid (matches current
  `grid-cols-2`). Section header Edit/Save controls wrap below the title. Stat
  tiles stack 1-col. Color swatches wrap.
- **md (768):** form rows go 2-col grid; Tabs become a horizontal row;
  Subscription stats 3-col.
- **lg (1024+):** content centered ≤960; persistent Sidebar; Branding preview
  can sit side-by-side with the color controls (2-col) instead of stacked.

---

## 4. Components used (FOUNDATION §5 only)

| Region           | Components                                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Shell            | `AppShell`, `Sidebar`, `Topbar`, `Breadcrumb`                                                                                 |
| Header           | `Badge` (plan), `Chip/Tag` (tenantCode, mono), `IconButton` (copy)                                                            |
| Tabs             | `Tabs`                                                                                                                        |
| Sections         | `Section`, `Card`, `Panel`, `DefinitionList`, `Accordion` (address sub-group, optional)                                       |
| Inputs           | `Input`, `Label`, `FormFieldError`, `Switch`, `Select` (timezone/locale), `FileDrop` (logo)                                   |
| Subscription     | `Stat/KPI`, `DefinitionList`                                                                                                  |
| Actions          | `Button` (primary save, secondary cancel, ghost edit, **danger** remove-key), `ConfirmDialog`, `Modal/Dialog` (API key entry) |
| Feedback         | `Toast` (sonner), `InlineAlert/Banner`, `Skeleton`, `LoadingOverlay`, `Tooltip`                                               |
| Branding preview | `Card`, `Avatar` (logo), `ProgressBar`, `Button` (mocked, non-interactive)                                                    |

**Proposed foundation additions (flagged — do NOT silently invent):**

1. **`ColorTokenPicker`** (domain/admin) — a constrained swatch picker that
   offers **only** Lyceum-approved brand options (the indigo `brand.primary`
   family and the marigold `spark` family, plus an "auto" default) and, in an
   advanced disclosure, a hex `Input` that is **validated to ≥4.5:1 against
   `bg.surface` and ≥3:1 for UI** before it can be saved. This is the single
   mechanism that keeps tenant branding "within Lyceum constraints." Rationale:
   the current free-text `#hex` input (`SettingsPage.tsx` lines 572–627, default
   placeholder the **banned** SaaS-blue `#3B82F6`) directly violates the
   foundation's color governance. Until `ColorTokenPicker` exists, branding
   color editing should fall back to _swatch-from-approved-set only_ (no
   arbitrary hex).
2. **API additions** (not UI): `v1.identity.updateMyTenantSettings`
   (tenant-scoped self-update) and `v1.identity.listEvaluationSettings` — see §2
   and §8. These unblock the screen from super-admin-only `saveTenant` and from
   direct Firestore reads/writes.

No new colors, fonts, spacing, radii, shadows, or motion are introduced.

---

## 5. States

**Loading**

- Tenant doc not yet hydrated in `useTenantStore`: render the page header + a
  `Skeleton` block per Section (do **not** flash empty inputs). Tabs are
  interactive; their panels show skeletons.
- Evaluation tab list loading: `Skeleton` rows (current behaviour, kept).

**Empty**

- _Evaluation:_ no `evaluationSettings` → `EmptyState` titled "No evaluation
  policy yet" with body "A default feedback configuration will be created
  automatically the first time grading runs." (no primary CTA — it is
  server-provisioned).
- _Branding:_ no logo/colors set → preview Section is hidden (matches current
  null-guard); FileDrop shows its resting prompt; color controls show the
  "Lyceum default" swatch as selected.
- _AI & API:_ `settings.geminiKeySet === false` → masked field reads "No key
  configured" with a **Set key** primary button.

**Error**

- Read error (tenant subscription failure): page-level `InlineAlert` variant
  `error` with a Retry action; never a blank page. Subscription-store errors
  surface here, not as a toast.
- Write error: keep edit mode open, restore nothing, surface a `Toast` (error)
  with the server message and a `FormFieldError` under the offending field when
  the error is field-scoped (e.g. invalid email/phone/hex).
- Upload error: `LogoUploader` toasts the specific reason ("File must be under
  2MB", "Only PNG, JPEG, SVG, or WebP"); the preview reverts to the last-saved
  logo.

**Partial**

- Edit-in-progress per Section: only the active Section is in edit mode; other
  Sections stay read-only. Saving one Section never submits another. (Current
  code already isolates `isEditingSchool` / `isEditingBranding`.)
- A logo uploaded outside an open edit session auto-persists just the
  `branding.logoUrl` (current behaviour), with a toast; colors are untouched.

**Success**

- After a successful write: exit edit mode, show `Toast` (success, neutral
  wording — no celebration), and let the live tenant subscription reconcile the
  displayed values (server-authoritative; do not trust local form state as truth
  once saved).

**Permission-gated variations**

- `tenantAdmin` (the only role that can reach `/settings`): full edit of
  profile, branding, evaluation, granted features, and AI key.
- `superAdmin` impersonating/visiting: same screen but also sees the otherwise
  read-only subscription/feature _grant_ controls become editable (out of scope
  here; routed to super-admin app).
- `staff` with `StaffPermissions` (future, status report rec #9): if
  `canManageSettings` is false, Sidebar hides "Settings" and the route guard
  denies — this screen renders only for permitted users. Within the screen, the
  **AI & API** tab is additionally gated behind a "manage billing/keys"
  permission when present; absent that, the tab is hidden, not shown-disabled,
  to avoid leaking that a key exists.

---

## 6. Interactions & motion (foundation §4 tokens)

**Edit → Save flow (per Section):**

1. Resting Section is read-only; "Edit" is a `ghost` Button. Activating it
   reveals editable inputs and swaps the header control cluster to `Cancel`
   (secondary/ghost) + `Save` (primary). Reveal uses
   `fast 160ms / ease.standard`; nothing slides far — opacity + 2px settle only.
2. Inline validation on blur (email regex, phone, hex-AA). Invalid fields show
   `FormFieldError` and block Save.
3. **No optimistic mutation of server-authoritative branding** that other users
   immediately consume — Save shows the Button in `loading` state, awaits the
   callable, then the live subscription reconciles. (We avoid optimism here
   precisely because these values fan out tenant-wide; a rolled-back optimistic
   logo would be jarring.)
4. Success → exit edit, `Toast` success (`base 220ms` enter, `ease.entrance`).

**Logo upload:** `FileDrop` drag-over uses `border.focus` tint at
`instant/fast`; progress is a determinate `ProgressBar` driven by real XHR
progress (`LogoUploader.tsx` lines 56–73). On done: preview cross-fades
(`base/ease.standard`). Clearing the preview is immediate and persists an empty
`logoUrl` via the update write.

**Color pick:** selecting a swatch updates the **live Branding Preview** Card
instantly (preview is local, not persisted) so the admin sees the result before
committing. Persisting still requires Save.

**Confirmations (`ConfirmDialog`, elevation `e3`):**

- **Remove API key** — destructive; `danger` Button opens a ConfirmDialog: title
  "Remove Gemini API key?", body "AI grading and chat will stop working for
  {tenant.name} until a new key is added." Confirm label "Remove key".
- **Reset branding to Lyceum default** (if offered) — Confirm before clearing
  custom colors/logo.

**Reduced motion:** with `prefers-reduced-motion`, all reveals/cross-fades
become instant opacity swaps; the upload ProgressBar remains (it conveys real
status, not decoration). No celebratory/spring motion exists on this screen
regardless of setting.

---

## 7. Content & copy (precise admin tone)

**Page header**

- h1: **"Tenant settings"**
- sub: _"Configure how {tenant.name} appears and behaves across LevelUp."_

**Tab labels:** General · Branding · Evaluation · Features · AI & API

**General**

- Section: **"School information"**. Labels: School name · Tenant code · Contact
  email · Contact phone · Contact person · Website · Address.
- Tenant code helper (read-only): _"Students and staff use this code to join
  your academy. It can't be changed."_
- Copy button success toast: _"Tenant code copied."_
- Subscription Section: **"Subscription"**, InlineAlert (info): _"Your plan and
  limits are managed by your platform provider. Contact support to change
  them."_

**Branding**

- Section **"Logo & assets"**, FileDrop prompt: _"Drop your logo here, or click
  to browse."_ helper _"PNG, JPEG, SVG, or WebP — max 2 MB. Square works best."_
- Section **"Brand color"**, helper: _"Choose an accent within the LevelUp
  palette. Custom colors must stay legible — we check contrast before saving."_
- Preview Section title: **"Preview"**, caption _"How your branding appears to
  students and staff."_

**Evaluation**

- Intro: _"Control which feedback dimensions and summaries students see on their
  results."_
- Empty: title **"No evaluation policy yet"**, body _"A default feedback
  configuration is created automatically the first time grading runs."_

**Features**

- Intro: _"Turn academy features on or off. Greyed-out features aren't included
  in your current plan."_
- Disabled-feature Tooltip: _"Not available on the {plan} plan."_

**AI & API**

- Section **"Gemini API key"**, body: _"Used for AI grading and chat. Your key
  is stored securely and never shown again after you save it."_
- Masked states: _"No key configured."_ / _"•••••••••••••• (key set)"_. Buttons:
  **Set key** / **Update key** / **Remove**.

**Error copy (representative):**

- Invalid email: _"Enter a valid email address."_
- Invalid phone: _"Enter a valid phone number."_
- Invalid/low-contrast color: _"That color is hard to read on a light
  background. Pick a darker shade or use a preset."_
- Save failure (generic): _"Couldn't save your changes. Please try again."_ +
  server detail in the toast description.
- Upload too large: _"That file is over 2 MB. Choose a smaller image."_

---

## 8. Domain rules surfaced

1. **Tenant isolation (hard rule).** Every read and write is scoped to the
   **active-tenant claim**; `tenantId` is derived server-side, never sent from
   the client (common-api §"`tenantId` is no longer in the request body"). A
   `tenantAdmin` can edit only their own tenant. Firestore rules enforce
   `isTenantAdmin(tenantId)` on `/tenants/{tenantId}` writes (status report §2
   access model).
2. **RBAC / least privilege.** Route is gated to `tenantAdmin`; `RequireAuth`
   additionally asserts `currentMembership.tenantId === currentTenantId` (audit
   A1 fix). Future `StaffPermissions` gate the AI/key tab and (eventually) the
   whole screen (status report rec #9).
3. **Super-admin vs tenant-admin write split.** `v1.identity.saveTenant` is
   **super-admin** (create tenant, tenantCode reservation, feature _grants_,
   plan). Tenant-admin self-service must use a **separate tenant-scoped write**
   (`updateMyTenantSettings`, §4) that accepts only
   `{ profile, branding, settings, features }` and **rejects** `subscription`,
   `tenantCode`, `status`, `ownerUid`. The UI renders those four fields as
   read-only with the "managed by provider" alert — the restriction is enforced
   server-side, not just hidden in UI.
4. **Quota / cost budgets are server-authoritative & read-only here.**
   `subscription.max*` and `usage.*` come from the server and are displayed,
   never edited, on this screen. Feature toggles are bounded by the plan: a
   `tenantAdmin` may switch a _granted_ feature on/off, but cannot enable a
   feature the plan excludes — the Switch is disabled with a plan Tooltip, and
   the server rejects out-of-plan enables regardless of client state.
5. **Branding must stay within Lyceum.** Colors are constrained to the approved
   palette (`brand.primary` / `spark` families) or AA-validated custom hex
   (`ColorTokenPicker`, §4). The server is the final arbiter: reject colors
   failing contrast, reject disallowed asset types/sizes. The displayed brand
   color is what the server stored, not what the form typed.
6. **Secrets never round-trip.** The Gemini key is write-only from the client.
   The server stores a ref (`settings.geminiKeyRef`) and exposes only
   `settings.geminiKeySet: boolean`. The UI must never render or log a key;
   "Remove" clears the ref server-side.
7. **Asset uploads are mediated.** `uploadTenantAsset` issues a short-lived
   signed PUT URL scoped to the tenant's Storage path; the browser uploads
   directly, then the returned public URL is persisted onto `branding`. Content
   type and size are validated client-side (UX) **and** server-side (authority).
8. **Audit.** Every settings/branding/feature/key mutation is attributed
   (`updatedBy`, `updatedAt`) and should emit an audit event (who changed what,
   when) — branding and feature-flag changes are tenant-affecting and must be
   traceable (auth-access spec). The UI need not render the log here, but must
   not bypass the audited callable path (no direct Firestore writes — the
   current `updateDoc` on evaluation settings is non-conformant).
9. **Deprecated fields.** Read `branding.logoUrl` with a fallback to top-level
   `tenant.logoUrl`, but **write only `branding.*`** (status report §4.9 / type
   deprecation). Never write the deprecated top-level fields.

---

## 9. Accessibility (WCAG AA)

- **Focus order:** page header → Tabs (roving tabindex, arrow-key navigation per
  WAI-ARIA Tabs) → within the active panel, top-to-bottom: Section header
  Edit/Save controls → fields in DOM order → next Section. Tab panels use
  `role="tabpanel"` + `aria-labelledby` the tab.
- **Keyboard:** all controls reachable and operable without a pointer. FileDrop
  is a real `<button>`/labelled input (click + Enter/Space open the picker; drag
  is an enhancement, never the only path). Copy IconButton is focusable with an
  `aria-label="Copy tenant code"`. ConfirmDialog traps focus, restores focus to
  the trigger on close, and is dismissible with Esc.
- **Forms:** every `Input` has an associated `<label>` (`Label`); errors use
  `aria-invalid` + `aria-describedby` pointing at `FormFieldError`; the masked
  key field uses `type="password"` with a clear accessible name.
- **Contrast:** all text/UI pairs meet AA (4.5:1 body, 3:1 large/UI) on
  `bg.surface`. **Custom brand colors are validated to the same thresholds
  before they can be saved** — branding cannot introduce a failing pair.
- **Never status-by-color-alone:** the "Default" evaluation badge carries text;
  feature on/off uses a `Switch` with a visible on/off label, not just a colored
  track; disabled features pair the muted style with a Tooltip reason; save
  success is a toast with words, not just a color flash. Color swatches expose
  their token name as accessible text/`aria-label`, not color alone.
- **Live regions:** save success/failure and copy actions announce via the
  existing route-announcer / `aria-live` polite region; upload progress
  announces start and completion.
- **Reduced motion:** honor `prefers-reduced-motion` (§6) — instant transitions;
  no motion required to perceive any state change.

---

## 10. Web ↔ mobile divergence

Admin is **web-first**; `/settings` is a **web-only** screen — there is no
native tenant-settings screen in the learner RN app or the scanner. State
explicitly:

- **`⌘K` command palette is web-only.** The Sidebar/Topbar entry points are the
  mobile-relevant ones if a future responsive/PWA admin view exists; ⌘K is never
  assumed on mobile.
- **Responsive (not native) only:** on small viewports the same React web screen
  reflows (Tabs → 2-col grid, form rows → single column, side-by-side preview →
  stacked) per §3. There is no separate RN component tree and no `ui-native`
  parity component for this screen.
- **Hover → press:** any hover-revealed affordance (Edit link emphasis,
  prefetch-on-hover) must have an equivalent tap/long-press path on touch; touch
  targets ≥44px (foundation §4).
- **Branding consumed cross-platform:** while _editing_ is web-only, the values
  set here (logo, colors, evaluation policy, features) are **consumed** by every
  client including RN — so saved values must remain valid Lyceum tokens/assets
  that the native shell can render.

---

## 11. Claude-design prompt (ready to paste)

```
You are designing ONE screen for Auto-LevelUp's ADMIN web app, using the "Lyceum" design system.
FIRST read docs/rebuild-spec/design/00-FOUNDATION.md and conform exactly — do NOT invent colors,
fonts, spacing, radii, shadows, motion, or component variants. Compose only from the §5 component
inventory and cite tokens by semantic name (brand.primary, spark, bg.surface, status.error, etc.).

SCREEN: "Tenant Settings & Branding" — route /settings, role tenantAdmin, single-tenant scope.
REGISTER: serious/credible (admin chrome, restraint). NO celebratory or gamified motion anywhere.

Build inside AppShell (persistent Sidebar + Topbar). Page header: h1 "Tenant settings" (Fraunces),
secondary subtitle, a plan Badge and a mono tenantCode Chip with a copy IconButton. Below it a Tabs
component with: General · Branding · Evaluation · Features · AI & API.

GENERAL tab: "School information" Section/Card with a 2-col (md+) / 1-col (sm) form: School name,
Tenant code (READ-ONLY, mono, copy button), Contact email, Contact phone, Contact person, Website,
and an Address sub-group. Per-Section "Edit" (ghost Button) → reveals inputs + Cancel/Save. A second
"Subscription" Section showing Plan / Max students / Max teachers / Max spaces as read-only Stat tiles
with an info InlineAlert "managed by your platform provider".

BRANDING tab: a FileDrop logo uploader (preview tile + drop zone; PNG/JPEG/SVG/WebP, max 2MB, real
determinate ProgressBar). A "Brand color" Section that offers ONLY Lyceum-approved swatches (the
indigo brand.primary family and marigold spark family + an auto default); any advanced hex input must
be contrast-validated to AA against bg.surface before Save. A live "Preview" Card mocking a shell
header (logo + tenant name on the chosen color) and a sample button + progress bar — preview updates
instantly, persistence requires Save.

EVALUATION tab: a list of evaluation-setting Cards (Default badge), each with toggleable dimension
Chips and two Switches (show strengths / show key takeaway). EmptyState when none.

FEATURES tab: a DefinitionList of tenant features, each a Switch row; features the plan excludes are
disabled with a Tooltip "Not available on the {plan} plan".

AI & API tab: a masked Gemini API key field (write-only; never shown after save) with Set/Update
buttons and a DANGER "Remove" that opens a ConfirmDialog. Info InlineAlert that the key is stored
server-side and never displayed.

STATES: skeleton while the tenant doc hydrates; per-Section edit isolation; AA-validated inline field
errors (FormFieldError); neutral success Toasts (no celebration); error InlineAlert for read failures.
Save is NOT optimistic for tenant-wide branding — show Button loading, await server, reconcile from the
live tenant subscription. Honor prefers-reduced-motion (instant transitions).

DOMAIN RULES to encode visually: tenant isolation (no tenant picker — always the active tenant);
subscription/quota/tenantCode/status are server-authoritative and read-only; feature toggles bounded by
plan; brand colors constrained to Lyceum + AA; the API key never round-trips to the client. Never
encode status by color alone (pair every state with icon + text). Web-only screen; ⌘K is web-only.

Motion strictly from foundation §4 (fast 160 reveal, base 220 toast, ease.standard); modals at e3,
cards at e1. Output a single responsive React + Tailwind screen reading Lyceum CSS custom properties.
```
