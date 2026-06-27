# Tenant / Role Switcher

> A Topbar control (not a page) that lets a user who belongs to multiple tenants
> — or holds both `teacher` and `tenantAdmin` memberships across tenants —
> switch their active operating context. The trigger shows the current tenant
> name + role; opening it surfaces a popover listing every accessible membership
> (tenant name, role, status), with the active one marked. Selecting one calls
> `v1.identity.switchActiveTenant`, the server rebuilds the JWT claims for the
> target tenant, the client force-refreshes its ID token, and the whole app
> re-subscribes — including re-injecting the new tenant's branding at the layout
> boundary.

**Route** none — a `headerRight` slot control in `PlatformLayout`'s `Topbar`
(also reachable via `CommandPalette` ⌘K) · **Roles** any caller whose accessible
memberships include ≥1 `teacher` or `tenantAdmin` membership (only those two
roles are listed; a single-membership user sees a static, non-interactive label)
· **Primary APIs** read: `useMemberships()` (from `auth-store`, already
loaded) + `useTenantNames(ids)` (NEW hook over `tenants` repo /
`identity.lookupTenantByCode` projection) · write:
`v1.identity.switchActiveTenant` → `{ tenantId }`, then client
`getIdToken(true)`

This spec conforms to `design/00-FOUNDATION.md` ("Lyceum / Modern Scholarly").
Every token, type, spacing, radius, elevation, motion value, and component is
cited by its FOUNDATION semantic name — no new tokens or variants are
introduced. Per FOUNDATION §1 this is a **staff operational** control: precise,
credible, calm. No gamification chrome; `spark` is never used here.

---

## 1. Purpose & primary user

**Primary user:** any authenticated staff user who holds more than one
accessible membership in the platform — e.g. a teacher who works at two campuses
(two tenants), or someone who is a `teacher` in tenant A and a `tenantAdmin` in
tenant B. A single-membership user is also a user of this control, but for them
it degrades to a read-only context label (no switching affordance).

**Job-to-be-done:** _"Show me which tenant and role I'm currently operating as,
let me confirm I'm in the right context, and let me switch to another tenant I
belong to in one or two interactions — without losing my place in the app's
sense of who I am."_

**What this control is.** A `headerRight` Topbar trigger that opens a `Popover`
(desktop) / `Sheet` (mobile) listing accessible memberships, performs a
server-side context switch on selection, and shows an in-flight switching state
while claims are rebuilt and the token refreshes.

**Explicitly NOT this control's job:**

- It does **not** create, edit, or join tenants (joining by code is
  `v1.identity.joinTenant`, a separate onboarding surface). It only switches
  _between memberships that already exist_.
- It does **not** switch role _within_ a single tenant — the JWT carries exactly
  one role per (user, tenant), so "role" here is a _property of the selected
  membership_, not an independent toggle. Switching to a different role means
  selecting a membership in a different tenant.
- It does **not** surface `student` / `parent` / `scanner` memberships — only
  `teacher` and `tenantAdmin` memberships are listed in the teacher portal
  (those are the only roles this app serves).
- It does **not** read tenant data via raw client `getDoc` from the layout. The
  legacy `AppLayout` did exactly that (`getDoc(doc(db,"tenants",id))` in a
  `useEffect`, see `status/app-teacher-web.md` §1.3); this spec **replaces**
  that with a `useTenantNames(ids)` hook (see §4).

**Emotional register:** quiet and trustworthy. Switching tenant context is
consequential (it changes _all_ the data the user sees), so the control
prioritizes clarity over flourish: an unambiguous "you are here" marker, an
honest in-flight state, and a calm confirmation. No celebratory motion, no
`spark`.

---

## 2. Entry points & route

This is a control, not a route. It is mounted by `PlatformLayout` when the app
config sets `features.roleSwitcher: true` (`specs/webapps-design.md` §3.1).
teacher-web sets that flag.

**Entry points:**

- **Topbar trigger** — the primary entry. Lives in the `Topbar` left-of-center
  (or `headerRight`, per the shell's slot), rendered as the `RoleSwitcher`
  composite. Clicking/pressing it opens the popover.
- **Command palette (⌘K)** — `CommandPalette` exposes a "Switch tenant…" command
  and one command per accessible tenant ("Switch to {Tenant} ({role})").
  Selecting the parent command opens the same popover; selecting a specific
  tenant command performs the switch directly (skipping the popover). Web only
  (FOUNDATION §6 — no ⌘K on mobile).
- **Keyboard:** when the Topbar trigger has focus, `Enter`/`Space`/`↓` opens the
  popover.

**Reads powering it** (all via hooks over `@levelup/api-client` / stores — UI
never touches Firestore directly; `specs/webapps-design.md` §0, §7 item 18):

- `useMemberships()` — the caller's full membership set, already loaded and kept
  live by `auth-store` (`status/auth-access.md` §1.7). The control filters this
  to `role ∈ {teacher, tenantAdmin}` client-side (this is a presentation filter
  over data the user already legitimately holds — not a security boundary; the
  server re-authorizes the switch). Each membership carries `tenantId`, `role`,
  and `status` (`active` | `suspended` | …).
- `useTenantNames(ids)` (**NEW**, `specs/webapps-design.md` §7 item 18) —
  resolves a set of tenant IDs to `{ name, branding }` for display (tenant
  display name, optional logo, primary/accent). Backed by a `tenants` repo read
  (or the minimal `v1.identity.lookupTenantByCode` projection shape —
  `{ tenantId, name, branding }`, `common-api.md` §3.3 identity). The
  **current** tenant's name comes from `useTenant()` (`tenant-store`, already
  loaded); the hook only fetches the _other_ tenants' names. Replaces the legacy
  in-layout `getDoc` loop.

**Writes:**

- `v1.identity.switchActiveTenant({ tenantId })` → `{ tenantId }`
  (`common-api.md` §3.3 identity; `status/auth-access.md` §1.4). The server
  validates an active membership for the target tenant, rebuilds claims
  (`buildClaimsForMembership`), writes `users/{uid}.activeTenantId`, and returns
  the confirmed tenant id.
- After the callable resolves, the client calls `getIdToken(true)` to force the
  new claims into the live JWT (`auth-store.switchTenant`,
  `status/auth-access.md` §1.4 / `auth-store.ts:271-274`), then the stores
  re-subscribe and `PlatformLayout` re-injects the new tenant branding
  (`features.tenantBranding`).

There are no other writes. This control never mutates tenant data.

---

## 3. Layout (wireframe-as-text)

The control is composed of two pieces: the **Topbar trigger** (always visible)
and the **switcher surface** (a `Popover` on desktop, a `Sheet`/`Drawer` on
mobile) that opens from it. Both live inside `PlatformLayout` → `AppShell` →
`Topbar` (FOUNDATION §5 Navigation; `specs/webapps-design.md` §3.1). The control
owns only its trigger and the surface it opens — never the page.

### 3.1 Topbar trigger (collapsed)

```
┌─ Topbar ─────────────────────────────────────────────────────────────────────┐
│ [≡] │ ┌─ RoleSwitcher trigger ─────────────┐  …… [⌘K]  [🔔]  [theme]  [avatar] │
│     │ │ (Avatar•logo) {Tenant name}   ▾    │                                    │
│     │ │              {Role} · {status?}    │                                    │
│     │ └────────────────────────────────────┘                                    │
└───────────────────────────────────────────────────────────────────────────────┘
```

- A single button: leading `Avatar` (tenant logo or monogram from branding) ·
  two stacked lines — line 1 **tenant name** (`text.primary`, Schibsted medium,
  truncates), line 2 **role** as a small `Badge` (e.g. "Teacher" / "Admin",
  `text.secondary`) · trailing chevron `▾`.
- Radius `md`, `bg.surface` on `bg.canvas`, `border.subtle`; hover →
  `border.strong` + elevation `e1`. Min height 44px (FOUNDATION §4 touch
  target).
- **Single-membership users:** the same row renders **without** a chevron and
  **without** button affordance (a plain labeled region) — see §5.

### 3.2 Switcher surface — desktop `Popover`

```
┌─ Popover (anchored under trigger, e2, radius lg) ─────────────────┐
│  SWITCH WORKSPACE                                                  │  ← header (text.muted, caption)
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ (logo) Northwood Academy            Teacher        ✓ Active   │ │  ← active row, marked
│  ├──────────────────────────────────────────────────────────────┤ │
│  │ (logo) Riverside School             Admin                     │ │  ← selectable row
│  ├──────────────────────────────────────────────────────────────┤ │
│  │ (logo) Eastgate Institute           Teacher   · Suspended     │ │  ← disabled (status≠active)
│  └──────────────────────────────────────────────────────────────┘ │
│  ─────────────────────────────────────────────────────────────────│
│  Switching reloads all data for the selected workspace.           │  ← footer note (text.muted, 2xs)
└───────────────────────────────────────────────────────────────────┘
```

- **Header:** caption "Switch workspace" (`text.muted`, FOUNDATION §3 caption
  tracking).
- **List:** one `DropdownMenu`/`Popover` row per accessible membership. Each
  row: leading `Avatar` (tenant logo/monogram) · tenant **name**
  (`text.primary`) · trailing `Badge` (role) · trailing status marker.
  - **Active row:** a `status.success` check + "Active" label; visually selected
    (`bg.surface-sunken`, `border.focus` left rule). Not selectable (it is the
    current context).
  - **Selectable row:** hover → `bg.surface-sunken`, pointer cursor.
  - **Suspended/inactive membership:** rendered disabled (`text.muted`,
    `· Suspended` chip), not selectable — the server would reject the switch
    anyway, so the client mirrors that read-only.
- **Footer note:** a single `text.muted` 2xs line — "Switching reloads all data
  for the selected workspace." — so the consequence is stated before action.
- Width ~320–360px; max-height with internal `ScrollArea` if >~7 memberships;
  radius `lg`, elevation `e2` (FOUNDATION §4 popover elevation).

### 3.3 In-flight (switching) — same surface, swapped body

```
┌─ Popover ─────────────────────────────────────────────────────────┐
│  SWITCHING…                                                        │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ (logo) Riverside School        Admin     ◐ Switching…        │ │  ← selected row, inline spinner
│  └──────────────────────────────────────────────────────────────┘ │
│  Rebuilding your access for this workspace.                        │
└───────────────────────────────────────────────────────────────────┘
```

The selected row shows an inline indeterminate `ProgressRing`/spinner +
"Switching…"; the other rows dim and become non-interactive (the whole surface
is busy). A `LoadingOverlay` is **not** used (it would block the topbar); the
surface stays open and self-contained until resolution.

### 3.4 Mobile `Sheet`

On `< md`, the trigger is a compact pill in the mobile header; tapping opens a
bottom `Sheet`/`Drawer` (FOUNDATION §5 Drawer/Sheet, FOUNDATION §6 "tenant
switcher is a sheet/Drawer on mobile") with the identical list (rows full-width,
≥44px tall), the same active marker, the same in-flight state, and a top "Switch
workspace" title with a close affordance.

**Responsive summary:**

- **sm (<768):** trigger collapses to a pill (logo + truncated name + chevron);
  surface = bottom `Sheet`, full-width rows.
- **md (768–1023):** trigger shows logo + name + role badge; surface = anchored
  `Popover` (~320px).
- **lg+ (≥1024):** identical to md; the Topbar has room for the two-line
  trigger; ⌘K commands also available.

---

## 4. Components used

All from FOUNDATION §5 / the `shared-ui` inventory (`specs/webapps-design.md`
§2.2). The composite itself — `RoleSwitcher` — is already named in both
FOUNDATION §5 (Navigation: "RoleSwitcher (merged mobile apps)") and the shell
inventory (`specs/webapps-design.md` §2.2 layout). No new primitive is
introduced.

| Part              | Component(s)                                                                                                                | Notes                                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Composite         | `RoleSwitcher` (FOUNDATION §5 / `shared-ui/layout`)                                                                         | The container; rendered in the `headerRight`/`Topbar` slot by `PlatformLayout` behind `features.roleSwitcher`. |
| Trigger           | `Button` (ghost/secondary variant) or `DropdownMenu.Trigger`, `Avatar` (tenant logo/monogram), `Badge` (role), chevron icon | Two-line label; min 44px; truncates tenant name.                                                               |
| Surface (desktop) | `Popover` (or `DropdownMenu`)                                                                                               | Anchored under trigger; radius `lg`, elevation `e2`.                                                           |
| Surface (mobile)  | `Sheet`/`Drawer`                                                                                                            | Bottom sheet; FOUNDATION §6 parity.                                                                            |
| Rows              | `DropdownMenu.Item` / list row, `Avatar`, `Badge` (role), `Chip`/`Tag` (status), check icon                                 | Active marked with `status.success` check + "Active"; suspended rows disabled.                                 |
| In-flight         | `ProgressRing` / inline `Skeleton` for unresolved names, busy state on the surface                                          | Inline spinner on the selected row; not a full `LoadingOverlay`.                                               |
| Feedback          | `Toast` (sonner)                                                                                                            | Success "Switched to {Tenant}", error toast on failure.                                                        |
| Errors (surface)  | `InlineAlert`/`ErrorState`                                                                                                  | Rendered inside the surface if `switchActiveTenant` rejects (membership no longer active, tenant suspended).   |
| Empty/degraded    | plain labeled region (no popover)                                                                                           | Single-membership case (see §5).                                                                               |
| Command entry     | `CommandPalette` (⌘K)                                                                                                       | Hosts "Switch tenant…" + per-tenant commands; web only.                                                        |

**Data hooks (not components, but required):**

- `useMemberships()` — `auth-store` selector (existing). Source of the
  membership list.
- `useTenant()` — `tenant-store` selector (existing). Source of the _current_
  tenant's name/branding.
- `useTenantNames(ids)` — **NEW** hook (`specs/webapps-design.md` §7 item 18;
  `status/app-teacher-web.md` §5 rec 11). Resolves the _other_ tenants' display
  names + branding via the `tenants` repo / `lookupTenantByCode` projection.
  **This hook is the explicit replacement for the legacy in-layout `getDoc`
  loop** and is the one net-new piece this control mandates. Justification: the
  layout/control must not import `firebase/firestore` or build collection paths
  (FOUNDATION cross-platform rule §6; `specs/webapps-design.md` §0 principle 3);
  a typed, cached, RN-reusable hook over the api-client is the correct seam, and
  it lets the names be fetched once and shared with the ⌘K command list.

**Proposed addition — none beyond `useTenantNames`.** `RoleSwitcher` already
exists in the inventory; this spec only _specifies its teacher-portal behavior_
and pins the new read hook it depends on.

---

## 5. States

**Loading (names unresolved).** The membership list itself is already loaded
(from `auth-store`), so the trigger and rows can render immediately with
`tenantId` placeholders. While `useTenantNames(ids)` resolves the _other_
tenants' display names, each unresolved row shows a small inline `Skeleton`
where the name will be (and the trigger shows the current tenant's name, which
is always already available from `tenant-store`). No full-surface spinner. The
skeleton crossfades to the name over `base` (220ms) `ease.entrance`.

**Empty / single-membership (degraded, not interactive).** If the caller has
exactly one `teacher`/`tenantAdmin` membership, the control renders as a
**static labeled region** — logo + tenant name + role badge, no chevron, not
focusable as a button, no popover. (FOUNDATION §5 RoleSwitcher is "available to
every app that has multiple memberships" — `specs/webapps-design.md` §3.1.) An
optional `text.muted` caption is omitted to keep the topbar quiet. The ⌘K
"Switch tenant…" command is also hidden in this case.

**Default / success (multiple memberships).** Trigger shows the active context;
opening the surface lists all memberships with the active one marked. This is
the steady state.

**In-flight (switching).** On selecting a target row: the surface enters a busy
state (§3.3) — selected row shows inline spinner + "Switching…", others dim and
disable, the trigger itself shows a subtle busy affordance. The user cannot
select another row until the in-flight switch resolves or fails. This state
spans the full sequence: `switchActiveTenant` callable → `getIdToken(true)` →
stores re-subscribe → branding re-inject.

**Error.** Distinct from empty (FOUNDATION §5; `specs` §2.2 `ErrorState`). If
`switchActiveTenant` rejects, the surface renders an in-surface `InlineAlert`
(`status.error`, icon + label, never color-alone) with copy mapped from
`error.details.code` (`common-api.md` §6 — e.g. `PERMISSION_DENIED` /
`TENANT_SUSPENDED` / `NOT_FOUND`), and a "Try again" affordance. The active
context is **unchanged** (the switch is atomic from the client's perspective —
claims only change on a successful callable + token refresh), so the user is
never left in a half-switched state. A toast also fires. If `getIdToken(true)`
fails after a successful callable (rare), the control surfaces "We updated your
workspace but couldn't refresh your session — please reload," with a reload
action, rather than silently proceeding with stale claims.

**Partial.** The only partial case is name resolution (above) — the list is
usable before all names load (IDs/monograms render; suspended/active markers
come from membership data, which is fully local). The switch action itself is
never partial.

**Permission-gated variants by role:**

- The control lists `teacher` and `tenantAdmin` memberships identically; **role
  is shown, not gated** — both roles can switch. A `tenantAdmin` and a `teacher`
  see the same control mechanics.
- **Suspended memberships** are shown disabled (read-only) regardless of role;
  the server enforces this (`switchActiveTenant` requires an _active_ membership
  — `status/auth-access.md` §1.4), and the client mirrors it so the user never
  attempts a doomed switch.
- This control does **not** appear in super-admin (that app uses a
  platform-level switcher variant with no tenant binding —
  `specs/webapps-design.md` §3.1); the teacher portal only ever binds to a
  tenant.

---

## 6. Interactions & motion

**Core flow (switch context):**

1. User clicks/presses the Topbar trigger → `Popover` (desktop) / `Sheet`
   (mobile) opens with `ease.entrance` over `base` (220ms): scale-from-95% +
   fade on desktop, slide-up on mobile.
2. The list shows memberships; the active one is marked and non-selectable.
3. User selects a different, **active** membership row.
4. The surface enters its in-flight state (§3.3); the selected row shows an
   inline spinner.
5. `v1.identity.switchActiveTenant({ tenantId })` is invoked. **`tenantId` is
   the only field** — it is the _target_ tenant (not the caller's current
   tenant, which the server reads from the existing claim); the active tenant
   for _other_ calls is always claim-derived, never a body field
   (`common-api.md` §4.4).
6. On success, the client calls `getIdToken(true)`; `auth-store`/`tenant-store`
   re-subscribe to the new tenant; `PlatformLayout` re-injects the new tenant's
   `primary`/`accent`/logo as CSS custom properties at the layout boundary
   (`features.tenantBranding`, `specs/webapps-design.md` §2.1). The surface
   closes, a `Toast` confirms "Switched to {Tenant name}," and the app's data
   re-loads for the new tenant.
7. On failure, the in-surface `ErrorState` + toast appear; context is unchanged.

**No optimistic context switch.** This is the deliberate exception to the
platform's general optimistic-update posture: the active tenant must **never**
be shown as switched until the server has rebuilt claims and the token has
refreshed, because the entire app's data scoping depends on the live JWT.
Showing the new tenant's chrome before claims land would render data the user
isn't yet authorized for. So the trigger label updates only **after** the token
refresh resolves — the in-flight state covers the gap. (Contrast: the rest of
the portal uses optimistic updates freely; this control does not.)

**Confirmation.** No separate `ConfirmDialog` for an ordinary switch — selecting
a row _is_ the confirmation, and the footer note states the consequence up
front. (Rationale: a switch is reversible — the user can switch back — and a
modal-on-every-switch would be friction for multi-campus teachers who switch
routinely.) The one place a confirm could appear is if the user has **unsaved
work** on the current surface (e.g. mid-edit in an authoring surface); in that
case the host surface's own unsaved-changes guard intercepts
navigation/context-change and asks to discard — this control defers to that
existing guard rather than reimplementing it.

**Motion (FOUNDATION §4 tokens, "felt not seen"):**

- Surface open: `ease.entrance` / `base`. Surface close + Esc: `ease.exit` /
  `fast` (160ms).
- Row hover: `bg.surface` → `bg.surface-sunken` over `fast`, `ease.standard`.
- In-flight spinner: indeterminate `ProgressRing` (no progress fakery).
- **Reduced motion:** `prefers-reduced-motion` → the surface uses a
  **cross-fade, not a slide/scale** (per the brief), and the post-switch
  transition is an instant content swap with no parallax. The in-flight spinner
  becomes a static "Switching…" label with an `aria-busy` region rather than an
  animated ring.
- **No celebratory motion.** Per FOUNDATION §4 the one spring/marigold-burst is
  reserved for student gamification; switching tenants is a calm, instrumental
  act — no `spark`, no burst.

**Command palette flow.** ⌘K → "Switch tenant…" opens the same popover; or ⌘K →
"Switch to {Tenant} ({role})" performs the switch directly (steps 5–7) with the
same in-flight + toast feedback, the surface never opening. Esc dismisses the
palette (`ease.exit`).

**Feedback summary:** open/close are silent; a successful switch fires one
success `Toast`; a failed switch fires one error `Toast` + the in-surface alert.
Name-resolution and steady state are silent.

---

## 7. Content & copy

Tone: direct, professional, calm (FOUNDATION §1 staff register). Tenant names
and roles in Schibsted; no numerics of note here.

**Trigger**

- Line 1: `{Tenant name}` (e.g. `Northwood Academy`). Fallback while unresolved:
  the tenant id is **not** shown raw — a monogram avatar + a `Skeleton`
  placeholder render instead; the _current_ tenant's name is always available so
  the trigger never shows a placeholder for the active context.
- Line 2 (role badge): `Teacher` (for `teacher`) · `Admin` (for `tenantAdmin`).
  (Use "Admin," not "Tenant admin," in the badge for brevity; the surface row
  may use "Admin" likewise.)
- `aria-label` on the trigger:
  `Current workspace: {Tenant name}, {role}. Switch workspace.`

**Surface**

- Header caption: `Switch workspace`
- Active row marker: `Active` (with `status.success` check icon).
- Suspended row marker: `Suspended` (`text.muted` chip; row disabled).
- Footer note: `Switching reloads all data for the selected workspace.`

**In-flight**

- Header caption swaps to: `Switching…`
- Selected row inline label: `Switching…`
- Body line: `Rebuilding your access for this workspace.`

**Success**

- Toast: `Switched to {Tenant name}.`

**Error** (copy mapped from `error.details.code`, `common-api.md` §6; defaults
below)

- In-surface alert title: `Couldn't switch workspace`
- Body by code:
  - `TENANT_SUSPENDED`:
    `That workspace isn't active right now. Contact your administrator.`
  - `PERMISSION_DENIED` / `NOT_FOUND` (membership gone/inactive):
    `You no longer have access to that workspace.`
  - generic: `Something went wrong switching workspaces. Please try again.`
- Action: `Try again`
- Toast (error): `Couldn't switch to {Tenant name}.`
- Post-callable token-refresh failure: title `Session needs a refresh`, body
  `Your workspace changed but we couldn't refresh your session. Please reload.`,
  action `Reload`.

**Single-membership (degraded)**

- No interactive copy — just the static `{Tenant name}` + role badge. No "you
  only have one workspace" message (it would be noise).

**Command palette**

- Parent command: `Switch tenant…`
- Per-tenant command: `Switch to {Tenant name} ({role})`

Note on vocabulary: the user-facing word is **"workspace,"** not "tenant" (which
is internal jargon). Role labels are **"Teacher" / "Admin."** This keeps staff
copy plain while the underlying domain term stays "tenant" in code and this
spec.

---

## 8. Domain rules surfaced

- **Single active tenant in the JWT at a time.** Claims are single-tenant
  (`status/auth-access.md` §1.3–1.4); the control reflects exactly one active
  context and switches the whole context atomically. There is no "multi-tenant
  view" and no client-side merging across tenants.
- **`tenantId` is claim-derived everywhere except this one call.** Every other
  API call omits `tenantId` (server reads `ctx.activeTenantId`, `common-api.md`
  §4.4). This control's `switchActiveTenant({ tenantId })` is the _one_ place a
  tenant id is a request field — and it is the **target**, validated server-side
  against the caller's memberships, not trusted blindly.
- **Server rebuilds claims; client force-refreshes the token.** The switch is
  server-authoritative: `switchActiveTenant` rebuilds claims via
  `buildClaimsForMembership` and writes `users/{uid}.activeTenantId`; the client
  then `getIdToken(true)` to make the new claims live (`status/auth-access.md`
  §1.4). The UI never fabricates or edits claims.
- **Only `teacher`/`tenantAdmin` memberships are listed.** The portal serves
  those two roles; `student`/`parent`/`scanner` memberships the same human may
  hold are not shown here (they belong to other apps).
- **Only _active_ memberships are switchable.** Suspended/inactive memberships
  are shown disabled; the server enforces the active-membership requirement, and
  on tenant deactivation memberships are suspended and refresh tokens revoked
  (`status/auth-access.md` §1.4, §5 rec 5) — so a stale entry can't be used.
- **Tenant branding re-injects at the layout boundary.** After a successful
  switch, `PlatformLayout` injects the new tenant's `primary`/`accent`/logo as
  CSS custom properties (`features.tenantBranding`, `specs/webapps-design.md`
  §2.1) — the same mechanism the legacy `useTenantBranding` used, but now a
  shell feature flag, not app-local code.
- **No raw Firestore reads in the layout/control.** The legacy
  `getDoc(doc(db,"tenants",id))` loop in `AppLayout`
  (`status/app-teacher-web.md` §1.3) is replaced by `useTenantNames(ids)` over
  the api-client (`specs/webapps-design.md` §7 item 18). The control imports no
  `firebase/*`.
- **Reads via repos/hooks, writes via callables.** Memberships and names are
  reads (store + repo hook); the switch is a callable. No direct client writes
  (`specs/webapps-design.md` §0 principle 3).
- **Tenant isolation holds across the switch.** Before the token refresh lands,
  the app still sees the _old_ tenant's data only; after, the _new_ tenant's
  only. There is never a window where both tenants' data are visible — which is
  exactly why the switch is non-optimistic (§6).
- **No tenant enumeration leak.** Name resolution uses only the minimal
  projection (`{ tenantId, name, branding }`) for tenants the user already has
  memberships in — it never lists or probes tenants the user doesn't belong to
  (`status/auth-access.md` §4 item 7 / §5 rec 9; `common-api.md` §3.3
  `lookupTenantByCode` minimal projection).

---

## 9. Accessibility

Conforms to FOUNDATION §2 (contrast) and §4 (reduced-motion), and
`specs/webapps-design.md` §2.4.

- **Trigger semantics:** the trigger is a real `<button>` with
  `aria-haspopup="menu"` (or `"dialog"` for the sheet), `aria-expanded`
  reflecting open state, and the `aria-label` from §7. In the single-membership
  degraded case it is **not** a button (no `aria-haspopup`, not in tab order) —
  just a labeled `region`/text, so screen-reader users aren't offered an action
  that does nothing.
- **Focus order & trap:** opening the surface moves focus to the first
  selectable (non-active) row, or to the active row if all others are disabled.
  Focus is trapped within the `Popover`/`Sheet` while open; `Esc` closes and
  returns focus to the trigger (`ease.exit`). The surface is dismissable by
  click-outside (desktop) and the close control / scrim (mobile).
- **Keyboard:** `↑/↓` move between rows, `Home/End` jump to first/last,
  `Enter`/`Space` selects the focused row (triggering the switch), `Esc` closes.
  The active row and suspended rows are skipped by arrow navigation or announced
  as disabled (`aria-disabled="true"`), never silently focusable-but-inert.
- **Active/status not color-alone:** the active membership is marked with a
  **check icon + the text "Active,"** not just a background tint; suspended rows
  carry the text "Suspended," not just muted color (FOUNDATION §2 — "never
  encode status by color alone"). Role is a text `Badge` ("Teacher"/"Admin"),
  not a color swatch.
- **In-flight announcement:** the busy state sets `aria-busy="true"` on the
  surface and exposes a polite live region announcing "Switching to {Tenant
  name}…"; success is announced via the toast's live region ("Switched to
  {Tenant name}"); the error alert carries `role="alert"`.
- **Contrast:** all text/background pairs use semantic tokens meeting WCAG AA
  (4.5:1 body, 3:1 large/UI). `text.muted` is used only for the footer note and
  status chips at sizes that still meet AA.
- **Touch targets:** rows and the trigger are ≥44px (FOUNDATION §4), critical on
  the mobile `Sheet`.
- **Reduced motion:** `prefers-reduced-motion` replaces the open/close
  slide/scale with a **cross-fade**, removes the spinner animation in favor of a
  static "Switching…" `aria-busy` label, and makes the post-switch app re-render
  an instant swap (no transition). (Per the brief: reduced-motion = cross-fade
  not slide.)

---

## 10. Web↔mobile divergence (RN parity)

Component names/props match 1:1 between `shared-ui` (web) and `ui-native`
(mobile) per FOUNDATION §6; only the renderer differs. The same headless data
(`useMemberships`, `useTenant`, `useTenantNames`) over `@levelup/api-client` and
the same `v1.identity.switchActiveTenant` callable power both. RN reuses
`auth-store`/`tenant-store` unchanged (both are DOM-free,
`status/auth-access.md` §5 rec 7).

- **Surface form:** web opens an anchored `Popover` (or `DropdownMenu`); RN
  opens a bottom `Sheet`/`Drawer` (FOUNDATION §6 explicitly: "tenant switcher is
  a sheet/Drawer on mobile rather than a Topbar dropdown"). Same list, same
  active marker, same in-flight + error states.
- **Trigger placement:** web = Topbar `headerRight` slot; RN = a compact pill in
  the app header (since there's no persistent sidebar/topbar — RN uses a
  header + `Tabbar`, `specs/webapps-design.md` §3.2).
- **No ⌘K on mobile:** the command-palette entry points are web-only (FOUNDATION
  §6). RN exposes only the trigger.
- **Hover → press:** web row hover (`bg.surface-sunken`) maps to RN
  pressed/active state.
- **Motion:** web `Popover` scale/fade via `ease.entrance`; RN `Sheet` slide-up
  via the spring/Reanimated equivalent — but both honor reduced-motion as a
  **cross-fade** and neither uses a celebratory burst.
- **Token refresh + branding re-inject:** identical mechanism —
  `getIdToken(true)` then store re-subscribe; RN reads the same
  `colorScheme`/branding token switch (`specs/webapps-design.md` §2.1) so the
  new tenant's primary/accent/logo apply at its layout boundary just as on web.
- **Name resolution:** `useTenantNames(ids)` is platform-neutral (api-client
  only); identical on both. The legacy web-only `getDoc` loop has no RN analogue
  and is removed on both platforms.

---

## 11. A Claude-design prompt

```text
You are generating the **Tenant / Role Switcher** control for the Auto-LevelUp teacher-web
portal. Conform EXACTLY to the "Lyceum / Modern Scholarly" design system in
docs/rebuild-spec/design/00-FOUNDATION.md and to this spec
(docs/rebuild-spec/design/teacher/tenant-switcher.md). Do NOT invent colors, fonts, spacing,
radius, elevation, or component variants — compose only from FOUNDATION tokens and the
shared-ui inventory, citing semantic token names (bg.canvas, bg.surface, bg.surface-sunken,
text.primary/secondary/muted, brand.primary, status.success/error, border.subtle/strong/
focus). Fonts: Schibsted Grotesk (UI/labels), Fraunces only if a heading is needed. Radius md
on the trigger, lg on the popover surface. Elevation e1 on trigger hover, e2 on the popover.
spark is NEVER used.

THIS IS A TOPBAR CONTROL, NOT A PAGE. It is the `RoleSwitcher` composite rendered in
PlatformLayout's Topbar headerRight slot (behind features.roleSwitcher), plus the surface it
opens. ROLES: any user with >=1 accessible `teacher` or `tenantAdmin` membership. TONE:
precise, credible, calm — switching tenant context is consequential; prioritize clarity over
flourish. No gamification chrome.

BUILD:
1. TRIGGER (always visible): a button with a leading Avatar (tenant logo/monogram), two
   stacked lines — line 1 = tenant NAME (text.primary, truncates), line 2 = a small Badge
   for the role ("Teacher" or "Admin", text.secondary) — and a trailing chevron. min 44px,
   bg.surface on bg.canvas, border.subtle; hover -> border.strong + e1. User-facing word is
   "workspace," not "tenant." If the user has exactly ONE membership, render this as a STATIC
   labeled region with NO chevron, NOT focusable, NO popover.
2. SURFACE: desktop = Popover anchored under the trigger (~320px, radius lg, e2); mobile = a
   bottom Sheet/Drawer with identical content. Header caption "Switch workspace". One row per
   accessible membership: Avatar (logo) · tenant name · role Badge · status marker. Mark the
   ACTIVE row with a status.success CHECK ICON + the text "Active" (selected, non-selectable,
   bg.surface-sunken). Show SUSPENDED memberships disabled with a "Suspended" chip
   (text.muted), not selectable. Footer note (text.muted, 2xs): "Switching reloads all data
   for the selected workspace." Use a ScrollArea if >~7 rows.
3. IN-FLIGHT: on selecting an active row, swap the surface to a busy state — selected row
   shows an inline ProgressRing + "Switching…", other rows dim/disable, header caption ->
   "Switching…", body "Rebuilding your access for this workspace." Do NOT use a full-screen
   LoadingOverlay; keep the surface open and self-contained.

DATA & BEHAVIOR (never touch firebase/* directly): list comes from useMemberships()
(auth-store), FILTERED to role in {teacher, tenantAdmin}. The CURRENT tenant's name comes
from useTenant() (tenant-store, always available). OTHER tenants' names/logos come from a NEW
useTenantNames(ids) hook over @levelup/api-client (this REPLACES the legacy in-layout
getDoc(doc(db,"tenants",id)) loop — do not reintroduce it). While other names resolve, show a
small inline Skeleton in the row name slot. On selecting a row, call
v1.identity.switchActiveTenant({ tenantId }) (tenantId = the TARGET; it's the only field — the
server derives the current tenant from claims), then on success call getIdToken(true) to force
the new claims live, let the stores re-subscribe, and let PlatformLayout re-inject the new
tenant's branding (primary/accent/logo) at the layout boundary. Close the surface and fire a
success Toast "Switched to {Tenant name}." The switch is NOT optimistic — the trigger label
updates only AFTER the token refresh resolves (never show the new context before claims land,
or you'd render data the user isn't yet authorized for).

STATES: loading = membership rows render immediately, unresolved names show inline Skeletons;
single-membership = static label (no popover); error = on switchActiveTenant rejection, render
an in-surface InlineAlert (status.error, icon+label) with copy mapped from error.details.code
(TENANT_SUSPENDED, PERMISSION_DENIED/NOT_FOUND, generic) + a "Try again" action + an error
Toast, and leave the active context UNCHANGED; post-refresh token failure = "Session needs a
refresh / Reload".

MOTION: Popover open ease.entrance/base (scale-95+fade), close ease.exit/fast; row hover
bg.surface -> bg.surface-sunken over fast/ease.standard. REDUCED MOTION: use a CROSS-FADE, not
a slide/scale; replace the spinner with a static "Switching…" aria-busy label; instant
post-switch swap. NO celebratory motion.

A11Y: trigger is a real button with aria-haspopup + aria-expanded + aria-label
"Current workspace: {name}, {role}. Switch workspace." (NOT a button in the single-membership
case). Focus trap in the open surface; Esc closes and returns focus to the trigger; arrow keys
move rows, Enter/Space selects, disabled/active rows are aria-disabled and skipped. Active and
suspended status are conveyed by ICON + TEXT, never color alone. Busy state sets aria-busy and
a polite live region; the error alert uses role="alert". WCAG AA contrast; >=44px targets.

Deliver clean React + Tailwind composing @levelup/shared-ui (RoleSwitcher, Popover/Sheet,
DropdownMenu, Avatar, Badge, Chip, ProgressRing, Skeleton, InlineAlert, Toast, Button) plus
the useMemberships/useTenant/useTenantNames hooks and the switchActiveTenant callable. The
control imports NO firebase/* and builds NO collection paths.
```
