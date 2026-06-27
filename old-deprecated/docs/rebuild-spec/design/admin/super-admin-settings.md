# Platform Settings — Super-Admin

> **Area:** admin · super-admin (platform control plane) · **Route:**
> `/settings` **Design system:** Lyceum
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). Compose only from §5 components
> and §2–§4 tokens. Admin register = restraint in chrome (serious tooling), not
> the playful student register. **Source code:**
> `apps/super-admin/src/pages/SettingsPage.tsx` · **Status:**
> `docs/rebuild-spec/status/app-super-admin.md` · **API:**
> `docs/rebuild-spec/specs/common-api.md`

---

## 1. Purpose & primary user

**Primary user:** the **super-admin** — the platform operator running the
multi-tenant control plane. There is no membership row for this role; it is the
`isSuperAdmin` boolean on `/users/{uid}` plus the verified
`role === "superAdmin"` ID-token claim (`RequireAuth.tsx`, auth-access §1.5).
Cross-tenant by definition; this screen is platform-global, **not** scoped to
one tenant.

**Job-to-be-done:** _"Set and audit the platform-wide defaults and global
controls that govern every tenant — the default feature set new tenants inherit,
the platform-wide broadcast, AI-config presence, contact/branding, default
provisioning policy, and the maintenance-mode kill switch — from one
authoritative place, with confidence that each change is validated,
server-authoritative, and logged."_

This is the singleton `platform/config` doc (FOUNDATION calls for "global
defaults, default feature flags, platform contact/branding, AI config
presence"). It is **distinct from per-tenant settings** (which live under
`/tenants/{tenantId}` and are reached from `/tenants/:tenantId`). Nothing here
edits a single tenant's live config; it sets the _defaults_ and _global
posture_.

**Explicit non-goals on this screen:** provisioning/editing individual tenants
(→ `/tenants`), per-tenant feature toggles (→ `/feature-flags`), global rubric
presets (→ `/presets`), announcement draft/publish CRUD (→ `/announcements`),
billing/cost (→ `/llm-usage`). This screen is the _platform config_ surface
only.

---

## 2. Entry points & route

- **Route:** `/settings`, rendered inside `RequireAuth → AppLayout` (super-admin
  SPA, `App.tsx`). Lazy-loaded behind `Suspense` + `RouteErrorBoundary`.
- **Nav entry:** Sidebar **System** group → "Settings" (AppShell sidebar,
  role-driven from route manifest). Also reachable from the Topbar profile menu
  ("Platform settings") and ⌘K command palette (web-only).
- **Reads / writes (common-API).** Today the page reads and writes
  `platform/config` **directly from the client SDK**
  (`getDoc`/`setDoc(doc(db,"platform","config"))`, `SettingsPage.tsx:55,98`).
  The status report flags this as the one place that bypasses the "mutations via
  callable" rule with **no server validation and no audit log** (app-super-admin
  §4.4). The rebuild routes everything through the typed API seam (`api-client`
  → `api-contract` registry, common-api §3, §5):

  | Action                                    | Rebuild callable (proposed, super-admin only)                                                                                                                                                                                                                 | Notes                                                                                                                                                                                                                                                                                                                                             |
  | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | Load config                               | **`v1.identity.getPlatformConfig`** (`read` tier)                                                                                                                                                                                                             | Replaces direct `getDoc`. Returns the materialized `platform/config` projection + `aiConfigPresent` (server-derived: does the platform-default Secret Manager key resolve?).                                                                                                                                                                      |
  | Save config                               | **`v1.identity.savePlatformConfig`** (`write` tier)                                                                                                                                                                                                           | Replaces direct `setDoc`. Validates via registry `requestSchema`, writes audit log + `writePlatformActivity`, super-admin-gated. Recommended in app-super-admin §5.3 ("Route `platform/config` writes through a `savePlatformConfig` callable with validation + audit logging + a real `maintenanceMode` enforcement hook the other apps honor"). |
  | Feature-flag catalog                      | sourced from the **single canonical flag registry** in `shared-types`/`api-contract` (app-super-admin §5.2), not hardcoded per page (today the list is duplicated/divergent across `SettingsPage`, `FeatureFlagsPage`, and the `TenantFeatures` type — §4.3). |
  | Branding asset upload (proposed addition) | **`v1.identity.uploadTenantAsset`** reused for platform scope → `{ assetUrl }`                                                                                                                                                                                | For platform logo/contact branding (common-api §3.3).                                                                                                                                                                                                                                                                                             |

  These follow the registry/SDK contract: `api.identity.getPlatformConfig()` /
  `api.identity.savePlatformConfig(req)`, validated both directions
  (`validateResponses` in dev), errors via the typed `ApiErrorDetails` envelope
  (common-api §6). Because super-admin is cross-tenant, **no
  `tenantId`/`tenantOverride`** is involved — this is a platform-singleton,
  above the tenant layer.

> **Flag both new callables as proposed `api-contract` additions** — they do not
> exist in today's `~47`-callable surface and are required to land the "no
> direct Firestore reads/writes in the UI" principle for this screen.

---

## 3. Layout — wireframe-as-text

Renders inside **AppShell** = persistent left **Sidebar** (System group active:
Settings) + **Topbar** (super-admin has **no tenant switcher** — platform scope;
topbar carries global search, notifications, profile). Page body is a single
reading column (max content width 1200, sections capped to a comfortable form
measure ~720; FOUNDATION §4). Content is a vertical stack of **Section/Card**
blocks with a sticky page header. Vertical rhythm `space.6` (24) between cards
(matches `space-y-6` today).

```
┌─ AppShell ───────────────────────────────────────────────────────────────┐
│ Sidebar │  Topbar  [ global search ]              [bell] [super-admin ▾]   │
│ Overview│ ┌───────────────────────────────────────────────────────────┐  │
│ ─────── │ │ PageHeader (sticky)                                        │  │
│ Platform│ │  Platform Settings        [ Discard ] [ Save changes ●]    │  │
│ ─────── │ │  Global configuration for the LevelUp platform            │  │
│ System  │ └───────────────────────────────────────────────────────────┘  │
│  Health │  ── unsaved-changes Banner (only when dirty) ──────────────     │
│ ▸Settings│ ┌─ Card: Platform Announcement (Bell) ─────────────────────┐  │
│  Announce│ │  Broadcast a message to all tenant admins                 │  │
│         │ │  [ Textarea (3 rows) ............................... ]     │  │
│         │ │  helper: "Visible to all tenant admins." · live preview   │  │
│         │ └───────────────────────────────────────────────────────────┘  │
│         │ ┌─ Card: Default Features for New Tenants (ToggleLeft) ─────┐  │
│         │ │  Inherited by every newly provisioned tenant              │  │
│         │ │  ┌ DefinitionList rows, divider between ────────────────┐ │  │
│         │ │  │ AutoGrade        Automated exam grading   [Switch ◐] │ │  │
│         │ │  │ LevelUp Spaces   Interactive learning     [Switch ◐] │ │  │
│         │ │  │ Scanner App      Mobile exam scanning     [Switch ○] │ │  │
│         │ │  │ AI Chat Tutor …  AI Grading … Analytics … (registry) │ │  │
│         │ │  │ Parent Portal · Bulk Import · API Access            │ │  │
│         │ │  └──────────────────────────────────────────────────────┘ │  │
│         │ └───────────────────────────────────────────────────────────┘  │
│         │ ┌─ Card: AI Configuration (Sparkles) ──────────────────────┐  │
│         │ │  Platform default AI provider                             │  │
│         │ │  Status  [ Badge: Configured ✓ / Not configured ! ]       │  │
│         │ │  Provider  Gemini (read-only)   Key  •••• (server-only)    │  │
│         │ └───────────────────────────────────────────────────────────┘  │
│         │ ┌─ Card: Platform Contact & Branding (Globe) ──────────────┐  │
│         │ │  Support email · Platform name · Logo (FileDrop)          │  │
│         │ └───────────────────────────────────────────────────────────┘  │
│         │ ┌─ Card: Provisioning Defaults (Settings) ─────────────────┐  │
│         │ │  Default plan [Select]  ·  Max tenants allowed [Input]    │  │
│         │ └───────────────────────────────────────────────────────────┘  │
│         │ ┌─ Card: Maintenance Mode (danger framing) ────────────────┐  │
│         │ │  Lock out all non-admin users   [Switch ○] → ConfirmDialog│  │
│         │ └───────────────────────────────────────────────────────────┘  │
│         │ ┌─ Card: Admin Account (Shield) ───────────────────────────┐  │
│         │ │  [avatar] Super Admin · email        [ Sign out ]         │  │
│         │ └───────────────────────────────────────────────────────────┘  │
└─────────┴───────────────────────────────────────────────────────────────┘
```

**Responsive (admin is desktop-first — §10):**

- **lg (≥1024):** sidebar pinned; form column ~720 within the 1200 shell;
  "Provisioning Defaults" uses a 2-col grid (Default plan / Max tenants),
  matching today's `md:grid-cols-2`.
- **md (768–1023):** sidebar collapses to icon rail or a Drawer (AppShell
  behavior); cards full-width single column; 2-col grids remain 2-col where
  width allows, else stack.
- **sm (<768):** Topbar hosts the menu trigger; mobile bottom-nav (4 items) per
  super-admin shell; cards stack full-width gutter 16; the sticky header's
  action buttons collapse — Save persists, Discard moves into an overflow.
  Maintenance toggle keeps its confirm. (Super-admin is rarely operated on
  phone; this is graceful-degradation, not a primary target.)

---

## 4. Components used (FOUNDATION §5 only)

- **AppShell** (Sidebar + Topbar) — host chrome.
- **PageHeader** pattern via **Section** + heading (Fraunces display for the H1;
  Schibsted for the description) + primary **Button** (Save) and ghost
  **Button** (Discard) in the actions slot.
- **Card** / **Section** — each settings group (radius `lg`, `e1` at rest,
  `border.subtle`).
- **DefinitionList** — the default-features rows and the AI-config / branding /
  provisioning key–value pairs.
- **Switch** — each default-feature flag and the maintenance toggle.
- **Textarea** — platform announcement.
- **Input** — support email, platform name, max-tenants.
- **Select** — default plan (replaces today's read-only `Input`; values from the
  canonical `TenantPlan` enum — no empty-string option, per memory lessons).
- **FileDrop** — platform logo upload (branding).
- **Badge** — AI-config presence (Configured / Not configured), each pairing an
  icon + text label (never color-alone).
- **Button** (primary / secondary / ghost / **danger**) — Save (primary),
  Discard (ghost), Sign out (secondary), maintenance confirm (danger).
- **InlineAlert / Banner** — the dirty "unsaved changes" bar and the load-error
  banner.
- **ConfirmDialog** — maintenance-mode enable/disable confirmation (today's
  `AlertDialog`).
- **Toast (sonner)** — save success / failure.
- **Skeleton** — loading state (4 card skeletons, matching today).
- **Avatar** — admin-account block.
- **Tooltip** — on disabled Save (explains why), on server-only AI key field.
- **LoadingOverlay** — optional, over a card during its own in-flight save (if
  sections become independently savable).

**Proposed foundation additions (flagged):**

1. **`AiConfigStatus` (domain component)** — a small status row pairing a
   `Badge` (status.success "Configured" / status.warning "Not configured") with
   provider name and a server-only masked key affordance. Composes existing
   tokens; lives next to `AnswerKeyLock` conceptually (a "server-only secret,
   never revealed" visual). _Propose adding to §5 domain components._
2. **`MaintenanceModeToggle` pattern** — a danger-framed switch row (border
   `status.error` at rest is **too loud**; use `border.subtle` + a danger-tinted
   icon and an "armed" affordance) gated by `ConfirmDialog`. Composable from
   existing primitives; documented here as a pattern, not a new token.

No new colors, fonts, radii, shadows, or motion are introduced.

---

## 5. States

**Loading (skeleton).** 4 stacked **Card** skeletons; each = a `Skeleton` title
(`h-5 w-40`) + sub-line (`h-3 w-64`) + 3 row skeletons (`h-10 w-full`). The Save
button is hidden until load completes (today gates `actions` on `!isLoading`).
No layout shift — skeletons occupy final card heights. Skeleton shimmer respects
`prefers-reduced-motion` (static when reduced).

**Empty.** The singleton may not exist yet (`getDoc` returns `{}` → first-run).
There is no "no data" empty _page_; instead fields render at their documented
defaults and an **InlineAlert (info)** appears at top: _"No platform
configuration saved yet — these are the platform defaults. Save to make them
authoritative."_ Announcement shows its placeholder; features default to ON
(today `?? true`); plan defaults to "trial"; max-tenants shows "Unlimited".

**Error.** Load failure → **InlineAlert (destructive / `status.error`)** with
`AlertCircle` icon, title "Couldn't load platform settings", the server message,
and a **"Try again"** link that re-runs the query (today's `refetch`). The form
is not shown while the load errored. Save failure → **Toast (error)** with the
typed `ApiErrorDetails.message`; the dirty state is preserved so the operator
can retry; the optimistic value rolls back (see §6).

**Partial.** AI-config presence can be unknown if the secret probe times out →
AI badge shows a neutral **status.info** "Checking…" with a subtle pulse, never
a false "Configured". If the canonical flag registry is reachable but
`platform/config.defaultFeatures` is sparse, each missing flag falls back to its
registry `default` and is visually marked (a muted "default" chip) so the
operator sees inherited vs explicitly-set values.

**Success.** After save → **Toast (success)** "Platform settings saved", the
dirty banner dismisses, Save returns to disabled, and the query is
invalidated/refetched so displayed values are server-authoritative (no trusting
the optimistic local copy long-term).

**Permission-gated variations by role.** This route is **super-admin only** —
`RequireAuth` denies unless `firebaseUser` + `users.isSuperAdmin === true` +
token claim `role === "superAdmin"` (app-super-admin §1.3). There is **no
tenant-admin or staff view** of this screen; a non-super-admin who reaches the
URL gets the route guard's access-denied state, not a read-only form.
(Tenant-admins manage their own tenant at `/tenants/:tenantId` in a different
app surface.) No within-screen role downgrade exists — it is all-or-nothing
access.

---

## 6. Interactions & motion (§4 motion tokens)

- **Dirty tracking.** Any field change sets `isDirty` (today's pattern); the
  sticky **unsaved-changes Banner** slides in with `motion.fast` (160ms,
  `ease.entrance`) and Save enables. Discard reverts local state to the last
  loaded config (no network) and dismisses the banner with `motion.fast`
  `ease.exit`.
- **Save flow.** Save → button shows pending label ("Saving…") + disabled; calls
  `api.identity.savePlatformConfig`. **Optimistic update:**
  features/announcement reflect immediately; on success, invalidate + refetch to
  lock to server-authoritative values; on error, roll back to pre-save snapshot
  and toast. Toast uses sonner (FOUNDATION §5 Feedback). Transitions are subtle
  — `motion.base` (220ms) for state changes; **no celebratory motion** here
  (gamification's spring/marigold burst is the student register, explicitly
  _not_ admin chrome, FOUNDATION §1, §4).
- **Maintenance mode.** Toggling **on** opens a **ConfirmDialog** (`e3`
  elevation, `motion.base` entrance) — destructive framing, primary action is a
  **danger Button** "Enable maintenance mode". Only on confirm does the switch
  flip + `isDirty` set; cancel leaves it off (today's exact behavior). Toggling
  **off** also confirms ("This will restore access for all users"). The actual
  lockout is **server-enforced** via the `maintenanceMode` flag other apps honor
  (app-super-admin §5.3) — the toggle records intent; it is not the enforcement.
- **Feature toggles.** Each Switch flips instantly (local, `motion.instant`
  100ms thumb travel) and marks dirty; these are _defaults for future tenants_,
  so there is no live blast-radius — no per-toggle confirm needed.
- **Branding upload.** FileDrop accepts an image → uploads via
  `uploadTenantAsset` (platform scope) → returns `assetUrl`; shows an
  UploadQueueItem-style inline progress, then a thumbnail. Failure toasts and
  keeps the drop zone.
- **AI-config refresh.** A small ghost "Re-check" IconButton re-runs the
  server-side secret probe (`getPlatformConfig` derives `aiConfigPresent`);
  badge animates from "Checking…" to its resolved state with `motion.fast`.
- **Sign out.** In the Admin Account card; immediate (no confirm) — it is
  reversible by logging back in.
- All animations honor `prefers-reduced-motion`: banners and dialogs cross-fade
  instead of translating; no shimmer.

---

## 7. Content & copy (precise admin tone)

- **H1:** `Platform Settings` · **Sub:**
  `Global configuration for the LevelUp platform.`
- **Save button:** `Save changes` (pending: `Saving…`) · **Discard:** `Discard`
- **Unsaved banner:** `You have unsaved changes.` + `Discard` / `Save changes`.
- **Announcement card** — Title `Platform Announcement` · Desc
  `Broadcast a message to all tenant admins.` · Textarea placeholder
  `Enter announcement text (leave empty for none)…` · Helper (set):
  `Visible to every tenant admin until cleared.` · Helper (empty):
  `No active announcement.`
- **Default Features card** — Title `Default Features for New Tenants` · Desc
  `These are applied when a new tenant is provisioned. They do not change existing tenants.`
  · Rows use the canonical registry labels/descriptions: AutoGrade · LevelUp
  Spaces · Scanner App · AI Chat Tutor · AI Grading · Analytics · Parent Portal
  · Bulk Import · API Access.
- **AI Configuration card** — Title `AI Configuration` · Desc
  `Platform default AI provider used when a tenant has no key of its own.` ·
  Badge `Configured` / `Not configured` · Key field label `Default API key` ·
  masked value `•••• (stored in Secret Manager)` with helper
  `Keys are write-only and never displayed.`
- **Contact & Branding card** — Title `Platform Contact & Branding` ·
  `Support email`, `Platform name`, `Logo` (FileDrop hint:
  `PNG or SVG, up to 1 MB`).
- **Provisioning Defaults card** — Title `Provisioning Defaults` ·
  `Default plan` (Select) · `Max tenants allowed` (Input; placeholder
  `Unlimited`).
- **Maintenance Mode card** — Title `Maintenance Mode` · Desc
  `When enabled, all non-admin users see a maintenance page and cannot access the platform.`
  · Confirm dialog title `Enable maintenance mode?` · body
  `This will prevent all non-admin users from accessing the platform. They will see a maintenance page instead.`
  · confirm `Enable maintenance mode` · cancel `Cancel`. Disable-confirm body:
  `This will restore access for all users.`
- **Admin Account card** — Title `Admin Account` · `Sign out`.
- **Error copy:** load → `Couldn't load platform settings.` + `Try again`. save
  → `Couldn't save platform settings. Your changes were not applied.` (toast;
  preserves edits). validation → field-level FormFieldError from
  `ApiErrorDetails.validationErrors` (e.g.
  `Support email must be a valid address.`,
  `Max tenants must be a positive number.`).
- **Empty/first-run:**
  `No platform configuration saved yet — showing platform defaults. Save to make them authoritative.`

Tone throughout: declarative, consequence-forward, no exclamation marks, no
encouragement language. This is the serious register.

---

## 8. Domain rules surfaced

1. **Platform-singleton, above tenant isolation.** `platform/config` is a single
   doc with no `tenantId`; only super-admin reads/writes it (firestore.rules
   gate `isSuperAdmin()`, app-super-admin §2.4). Tenant isolation still _frames_
   the screen: changes here are **defaults inherited by new tenants**, never a
   back-door write into an existing tenant's config. The copy must make "does
   not change existing tenants" explicit so the operator never confuses platform
   defaults with per-tenant live state.
2. **Server-authoritative values.** Save goes through `savePlatformConfig` with
   server-side validation + audit (replacing today's unvalidated client
   `setDoc`, app-super-admin §4.4/§5.3). The UI never treats its optimistic copy
   as truth past the round-trip — it refetches. `maxTenants`/`defaultPlan` are
   policy values enforced server-side at provisioning time, not merely cosmetic.
3. **RBAC gating.** Super-admin only (Firestore flag + verified custom claim,
   defense-in-depth, auth-access §1.3/§1.5). No partial/read-only role view.
4. **AI key is server-only / never shown.** The default AI key lives in Secret
   Manager (`tenant-…-gemini` pattern, app-super-admin §1.5). The UI shows
   **presence only** (a derived boolean) and a masked, write-only field —
   mirroring the platform's **answer-key-never-shown** discipline (FOUNDATION
   §8, `AnswerKeyLock`). No secret value is ever returned to the client.
5. **Audit logging.** Every save writes a platform activity/audit entry
   (`writePlatformActivity` + audit log) — closing the "no audit log" gap on the
   current direct-write path (app-super-admin §4.4). Maintenance-mode toggles
   and announcement changes are individually auditable events.
6. **Maintenance mode is an enforcement contract, not a UI flag.** Setting it
   must be honored by the other apps' server/guard layer (the "real
   `maintenanceMode` enforcement hook the other apps honor", app-super-admin
   §5.3). The dialog frames its blast radius (all non-admin users) before arming
   it.
7. **Single feature-flag registry.** Flags here come from the one canonical
   registry (app-super-admin §5.2), not a page-local hardcoded list — preventing
   the current 3-way drift between `SettingsPage`, `FeatureFlagsPage`, and
   `TenantFeatures`.
8. **Defaults must actually flow to provisioning.** Per §4.4 of the status
   report, today's `defaultFeatures` is never consumed by `saveTenant`. The
   rebuild's contract is that `savePlatformConfig` defaults are read by
   `saveTenant` at create time — the screen's whole purpose depends on this
   wiring being real.

---

## 9. Accessibility

- **Focus order:** skip-to-content → Topbar → Sidebar (Settings active,
  `aria-current="page"`) → PageHeader Save/Discard → each Card in DOM order
  (Announcement → Features → AI → Branding → Provisioning → Maintenance → Admin
  Account) → within a card, label-then-control. Logical, top-to-bottom.
- **Keyboard:** every control reachable/operable by keyboard. Switches toggle on
  Space/Enter; Select opens with Enter/Space, navigates with arrows (Radix
  Select — no empty-string value, per memory). ConfirmDialog traps focus, ESC =
  cancel, Enter on the focused action; on close, focus returns to the
  maintenance Switch. Save is reachable from anywhere via the sticky header.
- **ARIA / semantics:** each Card is a `<section>` with an `aria-labelledby`
  pointing at its title; the features list is a labelled group; each Switch has
  an associated `<Label>` and `aria-describedby` → its description text; the
  dirty banner is `role="status"` (polite) so changes are announced without
  stealing focus; the load-error InlineAlert is `role="alert"`. The AI key field
  is `aria-readonly` with a description that it is write-only.
- **Status never by color alone (FOUNDATION §2.3, §8):** AI-config badge pairs
  color **with an icon and the words** "Configured"/"Not configured".
  Maintenance "armed" state pairs the danger tint with a lock/alert icon and a
  text "Active" label. Feature defaults marked with a text "default" chip, not
  just muted color.
- **Contrast (WCAG AA):** all text/control pairs meet 4.5:1 body / 3:1 large+UI
  (FOUNDATION §2). Disabled Save uses reduced opacity **plus** a Tooltip ("No
  changes to save") so the disabled reason is non-visual-only. Switch on/off
  states are distinguishable by thumb position + label, not hue alone.
- **Reduced motion:** `prefers-reduced-motion` → banner/dialog/badge transitions
  become cross-fades; no skeleton shimmer; no slide.
- **Targets:** ≥44px touch targets on switches and buttons (FOUNDATION §4).

---

## 10. Web ↔ mobile divergence

**Admin tooling is primarily web/desktop.** The super-admin control plane is a
Vite/React SPA; there is **no React Native super-admin app** (common-api §2
lists RN apps as learner-rn + scanner-rn only). State this explicitly: this
screen is built for desktop operation.

- **⌘K command palette** entry to `/settings` is **web-only** (FOUNDATION §6).
  No command palette on mobile.
- **Tenant switcher** is absent in both web and any responsive view —
  super-admin is platform-scoped, not tenant-scoped.
- **Responsive (within web), not native:** the same web app degrades gracefully
  — sidebar collapses to a Drawer/rail at md, cards stack full-width at sm with
  gutter 16, the 2-col Provisioning grid stacks, and the sticky header's
  secondary actions move to an overflow while Save stays primary. Hover
  affordances (prefetch, tooltips) become press/long-press on touch. The
  maintenance ConfirmDialog renders as a centered Dialog on desktop and may
  present as a Sheet/Drawer on narrow widths (AppShell behavior) — content and
  confirmation semantics are identical.
- **Component parity** with `shared-ui` is maintained (names/props 1:1), but no
  `ui-native` counterpart ships for this screen.

---

## 11. Claude-design prompt (ready to paste)

```
You are designing ONE screen for the Auto-LevelUp super-admin control plane.
Conform EXACTLY to the Lyceum design system in docs/rebuild-spec/design/00-FOUNDATION.md
(read it first). Use ONLY its §5 components and §2–§4 tokens. Do NOT invent colors,
fonts, spacing, radii, shadows, motion, or component variants. Cite tokens by semantic
name (brand.primary, bg.surface, status.error, spark, status.success). This is ADMIN
tooling — the serious, precise register: restraint in chrome, NO playful/gamified motion.

SCREEN: "Platform Settings" — super-admin only — route /settings.
It edits the platform-singleton platform/config doc: GLOBAL DEFAULTS, not per-tenant
settings. It is above tenant isolation; super-admin is cross-tenant (no tenant switcher).

Build inside AppShell (left Sidebar with System group, Settings active; Topbar with
global search + notifications + profile, NO tenant switcher). Single reading column,
max width ~1200, form measure ~720, cards stacked with 24px (space.6) gaps.

CARDS, in order (each = §5 Card/Section, radius lg, e1, border.subtle):
1. Platform Announcement — Textarea (3 rows) + helper, broadcast to all tenant admins.
2. Default Features for New Tenants — DefinitionList of rows, each a §5 Switch, labels
   from the canonical flag registry: AutoGrade, LevelUp Spaces, Scanner App, AI Chat
   Tutor, AI Grading, Analytics, Parent Portal, Bulk Import, API Access. Copy must say
   "applied to new tenants; does not change existing tenants."
3. AI Configuration — Badge (Configured / Not configured: icon + text, NEVER color
   alone), provider "Gemini" read-only, default API key masked as "•••• (stored in
   Secret Manager)" with helper "write-only, never displayed" (mirror AnswerKeyLock).
4. Platform Contact & Branding — Input support email, Input platform name, FileDrop logo.
5. Provisioning Defaults — Select default plan (no empty-string value), Input max tenants
   ("Unlimited" placeholder); 2-col grid at lg, stack below.
6. Maintenance Mode — danger-framed Switch row; turning ON opens a §5 ConfirmDialog
   ("Enable maintenance mode?", danger primary button); records intent, server-enforced.
7. Admin Account — Avatar + name + email + secondary "Sign out" button.

PageHeader: H1 "Platform Settings" (Fraunces), sub "Global configuration for the LevelUp
platform" (Schibsted), with a sticky actions row: ghost "Discard" + primary "Save changes"
(disabled until dirty, with a tooltip "No changes to save"). When dirty, show an InlineAlert
"You have unsaved changes." Save = optimistic then refetch (server-authoritative); success
= sonner Toast "Platform settings saved"; failure = error Toast preserving edits.

STATES to render: loading (4 Card skeletons), first-run empty (info InlineAlert: defaults
shown, "Save to make authoritative"), load error (destructive InlineAlert + "Try again"),
success. Reads/writes go through api.identity.getPlatformConfig / savePlatformConfig
(typed API seam — no direct Firestore).

ACCESSIBILITY: logical top-down focus order; each card is a labelled <section>; switches
have <Label> + aria-describedby; dirty banner role=status, error role=alert; status never
by color alone (icon+label); WCAG AA contrast; honor prefers-reduced-motion (cross-fade,
no shimmer); 44px targets. Motion: fast/base tokens only, ease.standard/entrance/exit; NO
celebratory motion.

Deliver desktop-first; show the sm-stacked responsive variant (sidebar→Drawer, single
column, gutter 16). Output clean React + the shared-ui components named in FOUNDATION §5.
```
