# Global Users (Cross-Tenant) — Screen Spec

> **Area:** super-admin (Platform control plane) · **Route:** `/users` ·
> **Role:** `superAdmin` only **Design system:** Lyceum — conforms to
> `docs/rebuild-spec/design/00-FOUNDATION.md`. All
> color/type/spacing/radius/elevation/motion are cited by **semantic token name
> only**; no raw hex, no invented variants. Register: **precise/credible
> platform-operator** (serious admin chrome — explicitly NOT the playful student
> register). This is the one screen in the entire product that **deliberately
> crosses tenant isolation**, so the design must make that elevation legible,
> deliberate, and audited at every touch.

---

## 1. Purpose & primary user

**Primary user:** the **Super Admin** (`UnifiedUser.isSuperAdmin === true`, JWT
custom claim `role === "superAdmin"`). There is no tenant-admin or staff variant
of this screen — it lives in the platform control plane, not in any single
tenant's admin app.

**Job-to-be-done:** _"Find a human across the entire platform and act on them,
regardless of which tenant(s) they belong to."_ A support/ops scenario: a person
emails "I can't log in" or "delete my account" and the only stable handle is
their **email address**, not a tenant. The super admin must:

1. **Locate** the user by email or display-name prefix across _all_ `/users`
   (cross-tenant search).
2. **See their full identity footprint** — every active `userMembership` (role +
   tenant) the person holds, super-admin flag, last-login, created-at.
3. **Pivot** into the relevant tenant (deep-link to Tenant Detail) to manage
   them in context.
4. **Take elevated platform actions** (rebuild scope): disable the account,
   force a password reset, and request a scoped, audited "impersonate-scope"
   session into a specific tenant.

This is **read-mostly, high-privilege**. Most sessions are "look up one person,
jump to their tenant." The destructive/elevated actions are rare, individually
confirmed, and always written to the platform audit log. The page must read as a
**forensic lookup tool**, not a bulk roster manager.

---

## 2. Entry points & route

**Route:** `/users` (lazy route in `apps/super-admin/src/App.tsx`, gated by the
super-admin `RequireAuth` guard — denies unless `firebaseUser` exists **and**
Firestore `users/{uid}.isSuperAdmin === true` **and** the ID-token claim
`role === "superAdmin"`, defense-in-depth per `status/app-super-admin.md` §1.3
and `status/auth-access.md` §1.7).

**Entry points:**

- Sidebar → **Platform** nav group → **Users** (`AppShell` Sidebar; active item
  uses `brand.primary`).
- `⌘K` command palette (web only): "Find user", "Search users by email", "Go to
  Users".
- Deep link from anywhere a `uid`/email is surfaced (audit-log actor, tenant
  member list, support ticket) — `/users?q=<email>` pre-seeds the search box.

**Common-API reads/writes** (per `specs/common-api.md` §3.3; this is a
**cross-tenant** super-admin surface, so calls carry an explicit, audited
`tenantOverride` where a tenant is targeted — normal `ctx.activeTenantId`
derivation does **not** apply, per §4.4):

| Action                              | Callable (rebuild `v1.*` registry)                                                                                | Auth / notes                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search users (primary read)         | `v1.identity.searchUsers` (`{ query, ...PageRequest }` → `pageResponse(UserSearchResult)`)                        | **super-admin only**; email/displayName **prefix** search over `/users`, joins active `userMemberships` via **batched** `where('uid','in',…)` (rebuild fixes today's N+1, `status/be-identity.md` §4.9). `rateTier: 'read'`. Unified pagination fragment §7 (today it is `limit(20)` with no cursor — rebuild adds `nextCursor`). |
| Open tenant in context              | navigate to `/tenants/{tenantId}` (Tenant Detail)                                                                 | read-only pivot; reads `v1.identity.getTenant` there                                                                                                                                                                                                                                                                              |
| Disable / re-enable account         | `v1.identity.setUserStatus` _(proposed new callable — see §4)_ (`{ uid, status: 'disabled'\|'active' }`)          | super-admin only; sets `/users/{uid}.status`, calls `admin.auth().revokeRefreshTokens(uid)` (auth-access rec #5, closes the ~1h stale-claims window) + writes platform audit                                                                                                                                                      |
| Force password reset                | `v1.identity.sendPasswordReset` _(proposed)_ (`{ uid }`)                                                          | super-admin only; triggers Firebase Auth reset email; audited. Never returns or sets a password (credentials are never handled client-side, `status/be-identity.md` §3.4)                                                                                                                                                         |
| Impersonate-scope (enter tenant as) | `v1.identity.startImpersonation` _(proposed)_ (`{ targetUid, tenantId, reason }`) → `{ sessionToken, expiresAt }` | super-admin only; **time-boxed, reason-required, fully audited** scoped session into ONE tenant. Mints a constrained claim set; does NOT grant write to another tenant beyond the targeted one                                                                                                                                    |

> **Rebuild correction vs. live code
> (`apps/super-admin/src/pages/GlobalUsersPage.tsx`):** today the page only does
> `callSearchUsers({ query, limit: 20 })` and a single row-click navigation to
> the user's _first_ tenant. It has **no** per-user actions, no membership-aware
> pivot (always jumps to `memberships[0]`), no pagination cursor, and an ad-hoc
> `formatTimestamp` shim. The disable / reset / impersonate-scope actions named
> in this screen's scope **do not exist yet** and are flagged below (§4) as
> proposed callables + a proposed `RowActionMenu` usage; the search-and-list
> core maps 1:1 to the existing `searchUsers` response shape.

**Real response shape (source of truth,
`packages/shared-types/src/callable-types.ts` `SearchUsersResponse`):**

```
users[]: {
  uid: string
  email: string | null
  displayName: string | null
  isSuperAdmin: boolean
  activeTenantId: string | null
  lastLoginAt: unknown   // Firestore Timestamp | null — coerce via shared util
  createdAt: unknown
  memberships[]: { tenantId: string; tenantCode: string; role: string }  // ACTIVE only
}
```

The membership join is **active-only** (`where('status','==','active')`,
`functions/identity/src/callable/search-users.ts`); suspended/deactivated
memberships are intentionally not surfaced as live roles.

---

## 3. Layout — wireframe-as-text

Renders inside **AppShell** (`§5 Navigation`): persistent **Sidebar** (platform
nav, **Platform → Users** active) + **Topbar**. On super-admin the Topbar's
tenant switcher is replaced by a **platform-scope indicator** (no single active
tenant); search / notifications / profile remain. This spec owns only the **main
content region**. Page gutters: desktop `space-8` (32), tablet `space-6` (24),
mobile `space-4` (16). Max content width 1200; the table fills the column and
scrolls-x on narrow widths.

```
AppShell  (super-admin platform scope)
┌──────────┬───────────────────────────────────────────────────────────────┐
│          │ Topbar: [◆ Platform]          [⌘K search]   [🔔]  [avatar ▾]    │
│ Sidebar  ├───────────────────────────────────────────────────────────────┤
│ Overview │  Breadcrumb: Platform › Users                                   │
│ ►Platform│                                                                 │
│  Tenants │  ┌── PAGE HEADER ───────────────────────────────────────────┐  │
│  Users ◄ │  │ H1 "Global Users"                                        │  │
│  Analytics  │ sub "Search and act on users across every tenant"        │  │
│  Presets │  └──────────────────────────────────────────────────────────┘  │
│  LLM     │                                                                 │
│ System   │  ┌── ELEVATED-SCOPE BANNER (InlineAlert, info) ─────────────┐  │
│  Health  │  │ ⓘ Cross-tenant view. Actions here are platform-level and │  │
│  Settings│  │   audited. You are operating outside any single tenant.  │  │
│          │  └──────────────────────────────────────────────────────────┘  │
│          │                                                                 │
│          │  ┌── SEARCH (Card) ─────────────────────────────────────────┐  │
│          │  │ [🔍 Search by email or name…]              (autofocus)   │  │
│          │  │  hint: "Prefix match on email or display name"           │  │
│          │  └──────────────────────────────────────────────────────────┘  │
│          │                                                                 │
│          │  ┌── RESULTS (Card → DataTable) ────────────────────────────┐  │
│          │  │ Name        Email           Memberships     LastLogin  ⋯ │  │
│          │  │ ───────────────────────────────────────────────────────  │  │
│          │  │ A. Rao      a@x.edu  [teacher@SUB001][parent@DPS02]  3d  ⋯ │  │
│          │  │ ◆ S. Khan   s@plat   ⚑SUPER-ADMIN  [—]               1h  ⋯ │  │
│          │  │ …                                                        │  │
│          │  └──────────────────────────────────────────────────────────┘  │
│          │  Showing 12 · ‹ load more / next ›        (updating…)          │
└──────────┴───────────────────────────────────────────────────────────────┘
```

**Region breakdown**

- **Page header:** `h1` "Global Users" (Fraunces, `text-2xl`) + subtitle
  (Schibsted, `text-sm`, `text.secondary`). No "+ Add" CTA — user _creation_ is
  a tenant-admin / `createOrgUser` concern, never cross-tenant here. The header
  stays deliberately sparse to signal a lookup tool, not a CRUD roster.
- **Elevated-scope banner:** a persistent `InlineAlert` (`status.info` accent,
  info icon) immediately under the header that states this view crosses tenant
  isolation and that actions are audited. This is a **domain-rule affordance**,
  not chrome — it must always render on this route (see §8).
- **Search Card:** a single full-width `Input` with a leading search icon,
  **autofocus on mount** (matches live behavior), `space-4` padding, and a
  sub-hint clarifying it is a **prefix** match (the backend uses
  `startAt(q)…endAt(q+)`, so "an" finds "Ana" but not "Joanna"). Debounced
  300ms before firing the query (live code uses `useDebounce(300)`).
- **Results Card → DataTable** (`§5 Data`): columns
  1. **Name** — `displayName` or em-dash fallback; the row's super-admin users
     carry a leading `◆` mark + a `LevelBadge`-free, neutral **"Super Admin"**
     Badge (NOT spark — see §8).
  2. **Email** — `text.secondary`, mono (`Spline Sans Mono`, IDs/identifiers
     read as mono per §3 typography). Selectable/copyable.
  3. **Memberships** — a wrap of `Chip`s, one per active membership, label
     `"{role} @ {tenantCode}"` (e.g. `teacher @ SUB001`). Empty → a muted
     `"No active memberships"` chip. Each chip is itself a link to that tenant.
  4. **Last login** — relative time, mono tabular-nums, coerced from the
     Firestore Timestamp via the shared timestamp util (rebuild replaces the
     per-page `formatTimestamp` shim, `status/be-identity.md` §4 /
     `app-super-admin.md` §4.8). A muted tooltip shows the absolute datetime.
  5. **Actions (⋯)** — a `Popover`/`RowActionMenu` (proposed, §4) with **Open in
     tenant…**, **Disable account / Re-enable**, **Force password reset**,
     **Impersonate-scope…**. Destructive items are visually separated and
     labelled with `status.error` text.
- **Result footer:** `"Showing N"` + `(updating…)` when `isFetching`, and
  pagination control (`§5 Pagination`) consuming `nextCursor` (rebuild) —
  load-more or next/prev.

**Responsive (admin is desktop-first — see §10):**

- **lg (≥1024):** full 5-column DataTable as above; row actions in the trailing
  `⋯` cell.
- **md (768–1023):** drop the **Created** detail (only Last login shown);
  Memberships chips may wrap to two lines; table scrolls-x if needed.
- **sm (<768):** DataTable collapses to **stacked result cards** (one `Card` per
  user: Name + super-admin Badge on line 1; email line 2; membership chips line
  3; last-login + a single overflow `⋯` action button line 4). The
  elevated-scope banner and search remain full-width and pinned above the list.

---

## 4. Components used (from FOUNDATION §5)

**From the inventory, no new primitives required for the core:**

- **Navigation:** `AppShell`, `Sidebar`, `Topbar`, `Breadcrumb`,
  `CommandPalette` (⌘K, web-only).
- **Containers:** `Card` (search + results wrappers), `Popover` (row action menu
  container), `Modal/Dialog` + `ConfirmDialog` (elevated-action confirmations),
  `Tooltip` (absolute timestamp, super-admin explainer).
- **Primitives:** `Input` (search, with leading icon), `Button` (`ghost` for row
  actions, `danger` for disable, `secondary` for cancel), `IconButton` (`⋯`
  overflow), `Combobox`/`Select` (tenant picker inside Impersonate-scope
  dialog), `Textarea` (impersonation **reason**), `Checkbox` (impersonation "I
  understand…" gate).
- **Data:** `DataTable` (sort by name/last-login, no row-select needed — this
  screen does no bulk ops), `Chip/Tag` (membership chips), `Badge` (super-admin
  flag, account-status), `Avatar` (optional leading user glyph), `EmptyState`,
  `Skeleton`, `Pagination`, `DefinitionList` (inside an optional user detail
  drawer).
- **Feedback:** `Toast` (sonner) for action results, `InlineAlert/Banner` (the
  elevated-scope banner + error state), `ConfirmDialog`, `LoadingOverlay`.

**Domain components:** none of the assessment domain components apply.
(Explicitly: no `XPMeter`/`StreakFlame`/`LevelBadge` — gamification chrome is
banned in this admin register, §1 and §8.)

**Proposed additions / flags (do NOT invent silently):**

1. **`RowActionMenu`** — a thin composition of `IconButton` (`⋯`) + `Popover` +
   menu items, with a `danger` section. Likely already implied by `DataTable` +
   `Popover`; if not present in `shared-ui`, add it once at the foundation level
   (it recurs in tenants/users/staff tables) rather than per-screen. **Flagged
   as a proposed shared component, not a new token.**
2. **Account-status `Badge` variants** — `active` (uses `status.success`),
   `disabled` (uses `status.error`), `super-admin` (neutral, uses
   `border.strong` outline + `text.secondary`, _not_ `spark`). These are **value
   mappings onto existing semantic tokens**, not new colors. Confirm `Badge`
   exposes these intents; if it only has `active`, extend its intent enum
   (foundation-level, not a new hue).
3. **Three new callables** — `v1.identity.setUserStatus`,
   `v1.identity.sendPasswordReset`, `v1.identity.startImpersonation` (§2). These
   are **backend additions**, surfaced here so the design isn't built on
   non-existent endpoints. Until they ship, the row menu shows only **"Open in
   tenant…"** and the destructive items render **disabled with a "coming
   soon"/permission tooltip** rather than being faked.

---

## 5. States

All states render inside the Results `Card`; the search `Card` + elevated-scope
banner are always present.

- **Initial (no query):** `EmptyState` inside the results card — `UserCircle2`
  glyph at `text.muted`, copy _"Search the platform"_ / _"Type an email or name
  to find a user across every tenant."_ (Live code shows this for
  `query.length < 1`.) No network call fires until the debounced query is ≥1
  char.
- **Loading (skeleton):** when a debounced query ≥1 char is in flight and there
  is no cached data — 5–6 `Skeleton` rows mirroring the table: a small circular
  avatar skeleton, two stacked text bars (name + email), a chip-width bar
  (memberships), a short bar (last login). Motion `fast` (160ms) fade-in;
  respects reduced-motion. (Matches the live skeleton block.)
- **Refetching (partial):** when results already exist and a new query/cursor is
  loading, keep the current rows visible and show `"(updating…)"` in the
  footer + a thin top progress shimmer on the results card. Never blank the
  table on refetch.
- **Empty (no matches):** `EmptyState` — _"No users found for “{query}”."_ + a
  hint line: _"Search matches the start of an email or name. Try the full
  email."_ (reinforces the prefix-match domain quirk).
- **Error:** `InlineAlert` (`status.error`, error icon + label, never
  color-alone) inside the results card: _"Couldn’t search users. {recovery
  hint}"_ with a **Retry** `Button` (`secondary`). Error copy is driven by
  `error.details.code` via `useApiError` / `ERROR_MESSAGES`
  (`specs/common-api.md` §6). A `PERMISSION_DENIED` here is a hard stop (see
  permission gating).
- **Success:** populated `DataTable` (or stacked cards on sm) + footer count +
  pagination.
- **Action in-flight (elevated):** the triggering row's `⋯` button shows a
  spinner; the row is dimmed but not removed; a `Toast` confirms on
  success/failure. Disable/re-enable optimistically flips the status Badge (see
  §6).

**Permission-gated variations by role:**

- **Non-super-admin reaching `/users`:** never rendered — the route guard
  redirects/denies before mount (Firestore flag **and** claim, §2). There is no
  "degraded read-only" tenant-admin view of this screen; cross-tenant search is
  super-admin-exclusive by domain rule.
- **Within super-admin:** all rows and all actions are available. The only
  per-row gating is **self-protection**: a super admin may not **disable** or
  **impersonate-scope** _their own_ account row, and may not impersonate
  **another super admin** — those menu items render disabled with an explanatory
  tooltip (mirrors the rules-level self-elevation/self-status block,
  `auth-access.md` §1.5).
- **Backend not yet shipped:** destructive/impersonate items disabled with
  tooltip (§4.3).

---

## 6. Interactions & motion (FOUNDATION §4 tokens)

**Search flow:**

1. User types → `Input` updates instantly; query is **debounced 300ms** before
   the `useQuery` fires (`enabled: query.length >= 1`, `staleTime: 30s`).
2. Results swap in with a `fast` (160ms) `ease.standard` cross-fade; existing
   rows persist during refetch (no layout jump).
3. `⌘K` → "Find user" focuses the search input (web only).

**Pivot to tenant:**

- Clicking a **membership chip** navigates to that specific
  `/tenants/{tenantId}` (rebuild fix — live code always jumps to
  `memberships[0]`, ignoring which membership you meant). Clicking a row's
  **Open in tenant…** action with >1 membership opens a small `Popover`/`Select`
  to choose which tenant first.
- Page transition uses the `page` (420ms) `ease.entrance` route transition
  defined by AppShell.

**Elevated actions (all require explicit confirmation — never optimistic on
first commit):**

- **Disable account:** `⋯` → "Disable account" → `ConfirmDialog` ("Disable
  {email}? They will be signed out of all tenants and cannot log in until
  re-enabled."). On confirm: optimistic Badge flip to `disabled`, `Toast`
  success ("Account disabled · audit logged"); on failure, revert Badge + error
  `Toast`. The server call also revokes refresh tokens.
- **Force password reset:** `⋯` → confirm in a `Dialog` (no optimistic UI —
  nothing visible changes) → `Toast` ("Reset email sent to {email}").
- **Impersonate-scope:** `⋯` → opens a `Modal` that **requires** (a) a tenant
  `Select` (only the user's _active_ memberships are valid targets), (b) a
  free-text **reason** `Textarea`, and (c) a checked **"I understand this is
  logged"** `Checkbox` before the primary `danger` Button enables. On confirm, a
  banner-style session-context appears and the session is time-boxed; ending it
  returns to platform scope.

**Motion discipline:** everything here uses the **subtle** end of the motion
scale (`instant`/`fast`/`base`). **No celebratory spring, no marigold burst** —
that single gamification moment is reserved for student XP/level-up (§4
foundation) and is explicitly out of register for admin tooling. Confirmation
dialogs use `e3` elevation and `base` (220ms) `ease.entrance` in / `ease.exit`
out.

---

## 7. Content & copy (precise admin tone)

- **H1:** `Global Users`
- **Subtitle:** `Search and act on users across every tenant`
- **Elevated-scope banner:**
  `Cross-tenant view. You are operating outside any single tenant — every action here is platform-level and written to the audit log.`
- **Search placeholder:** `Search by email or name…`
- **Search hint:**
  `Prefix match — searches the start of an email or display name.`
- **Column headers:** `Name` · `Email` · `Memberships` · `Last login` ·
  (actions, no header)
- **Membership chip:** `{role} @ {tenantCode}` (e.g. `teacher @ SUB001`); empty
  → `No active memberships`
- **Super-admin badge:** `Super Admin`
- **Status badges:** `Active` · `Disabled`
- **Initial empty state:** title `Search the platform` · body
  `Type an email or name to find a user across every tenant.`
- **No-results empty state:** title `No users found` · body
  `Nothing matches “{query}”. Search matches the start of an email or name — try the full email.`
- **Error:** title `Couldn’t search users` · body
  `{recovery hint from ERROR_MESSAGES}. Try again.` · button `Retry`
- **Result footer:** `Showing {n} result{s}` · suffix ` (updating…)` while
  fetching
- **Disable confirm:** title `Disable this account?` · body
  `{email} will be signed out of all tenants and blocked from signing in until re-enabled. This is logged.`
  · confirm `Disable account` (danger) · cancel `Cancel`
- **Password-reset confirm:** title `Send password reset?` · body
  `A password-reset email will be sent to {email}. You will never see or set their password.`
  · confirm `Send reset email`
- **Impersonate-scope dialog:** title `Enter a tenant as this user` · fields:
  `Tenant` (select), `Reason (required)` (textarea, placeholder
  `e.g. Investigating login failure — ticket #1234`), checkbox
  `I understand this session is time-boxed and audited.` · confirm
  `Start scoped session` (danger) · helper
  `You will act inside {tenantCode} only. Ends automatically in 30 min.`

Tone rules: imperative, specific, no exclamation marks, no emoji, no
encouragement language. Every elevated action's copy explicitly names the
**consequence** and the **audit**.

---

## 8. Domain rules surfaced

1. **Tenant isolation is deliberately crossed here — and only here.** This is
   the platform control plane; the elevated-scope banner makes that explicit and
   persistent. Every tenant-targeting action sends an explicit
   `tenantOverride`/`tenantId` (NOT `ctx.activeTenantId`, which is null for
   super-admin) and is audited (`specs/common-api.md` §4.4, §9).
2. **RBAC gating is absolute.** Route + every callable re-check super-admin via
   the three-layer guard (Firestore `isSuperAdmin` flag + custom claim +
   per-callable `getUser(uid).isSuperAdmin` assertion, `app-super-admin.md`
   §1.3, `search-users.ts`). No tenant-admin path reaches this data. Server is
   authoritative — the UI guard is UX-only.
3. **Audit logging on every mutation.** Disable, password-reset, and
   impersonate-scope each write to the platform audit log
   (`/platformActivityLog` + per-tenant `auditLogs`, `be-identity.md` §1.5). The
   impersonation **reason** is captured and stored. Search reads are themselves
   logged server-side (`logger.info('searchUsers completed', …)`).
4. **Self-protection / no self-elevation.** A super admin cannot disable,
   status-change, or impersonate their own row, nor impersonate another super
   admin — mirroring the rules-level block on self-`isSuperAdmin`/self-`status`
   change (`auth-access.md` §1.5). Those menu items render disabled with a
   reason tooltip.
5. **Credentials are never handled client-side.** Password reset only _triggers_
   a Firebase Auth email; the UI never displays, sets, or receives a password
   (consistent with signed-URL credential delivery, `be-identity.md` §3.4).
6. **Active-only membership truth.** The Memberships column reflects
   `status: 'active'` joins only; a suspended membership is intentionally absent
   (a deactivated-tenant member shows fewer/zero chips). Do not render stale
   roles.
7. **Server-authoritative values.** `lastLoginAt`, `isSuperAdmin`, membership
   role/tenant, and account status all come from the server response — the
   client only formats them (timestamp coercion via shared util), never computes
   or infers status.
8. **Token revocation on disable.** Disabling calls `revokeRefreshTokens(uid)`
   server-side so the account loses access promptly rather than waiting up to
   ~1h for claim expiry (`auth-access.md` rec #5). The UI's optimistic
   "Disabled" badge therefore reflects a real, immediate effect.
9. **Gamification chrome is out of register.** No XP/streak/level visuals; the
   super-admin Badge is a neutral outline (`border.strong` + `text.secondary`),
   never `spark` — `spark`/marigold is reserved for student energy/CTA accents
   (§2.2 foundation).
10. **Prefix-search honesty.** The UI tells the operator that search is a prefix
    match (not full-text), so a failed lookup is understood as "type more of the
    email," not "user doesn't exist" — preventing false negatives on a forensic
    tool.

---

## 9. Accessibility (WCAG AA)

- **Focus order:** Skip-to-content → Sidebar (Users active) → search `Input`
  (receives initial autofocus) → results table → per-row actionable cells
  (membership chip links, then `⋯` action) → pagination. Logical top-to-bottom,
  left-to-right.
- **Keyboard:** search is fully keyboard-operable; `Enter` is a no-op beyond the
  debounce (results are live). `DataTable` rows: `Tab` reaches each interactive
  element; the `⋯` `RowActionMenu` opens with `Enter`/`Space`, items are
  arrow-navigable, `Esc` closes and returns focus to the `⋯` trigger (`Popover`
  focus-trap + restore). `ConfirmDialog`/`Modal` trap focus, `Esc` cancels,
  focus returns to the invoking control. `⌘K` opens the command palette (web).
- **ARIA:** results table uses a proper `<table>` with
  `<caption class="sr-only">User search results</caption>` (live code already
  does this), `scope="col"` headers, and `aria-sort` on sortable columns. The
  result count + `(updating…)` lives in an `aria-live="polite"` region so screen
  readers hear "Showing 12 results." Skeleton has `aria-busy="true"`. The
  elevated-scope banner is `role="status"`. Action menu uses
  `aria-haspopup="menu"`/`aria-expanded`. Each membership chip link has an
  accessible name like "Open tenant SUB001 (teacher)."
- **Status never by color alone:** the super-admin flag = neutral outline Badge
  **with the text "Super Admin"** + a `◆` glyph; account status =
  `Active`/`Disabled` Badge with **text + icon** (success check / error slash),
  never a bare dot. Confidence/grade color scales don't appear here.
- **Contrast:** all text/bg pairs meet AA (4.5:1 body, 3:1 large/UI).
  `text.muted` is used only for non-essential hints, not for load-bearing data;
  emails and timestamps use `text.secondary` which clears AA on `bg.surface`.
  Focus ring = `border.focus` 3px (§4 `focus ring`), visible on every
  interactive element in both themes.
- **Reduced motion:** `prefers-reduced-motion` removes the cross-fade/shimmer;
  results swap instantly, dialogs appear without slide. (No spring exists here
  to suppress.)
- **Touch targets:** ≥44px for `⋯`, chips, and pagination on the sm stacked-card
  layout.

---

## 10. Web↔mobile divergence

**This is a web/desktop-first admin surface.** The super-admin control plane is
a PWA (per `app-super-admin.md` §1.1) used on laptops by ops/support staff;
there is **no native React Native super-admin app** in scope. Divergence is
therefore _responsive web_, not web-vs-native:

- **Desktop (lg):** full `DataTable`, hover-reveal `⋯` actions, `⌘K` command
  palette, `Popover`/`Tooltip` on hover.
- **Tablet (md):** table persists, drops the Created/secondary timestamp, chips
  wrap; actions stay in the `⋯` cell (tap, not hover).
- **Mobile (sm):** the **`DataTable` collapses to stacked result `Card`s** (the
  foundation §6 "table on web → stacked cards" rule), hover→press for all
  affordances, and **no `⌘K` command palette** (web-only per §5/§6 foundation;
  search is via the on-page input only). The elevated-scope banner and search
  pin to the top.
- **No mobile-specific destructive shortcuts:** elevated actions still require
  the full `ConfirmDialog`/`Modal` flow regardless of viewport — the gravity of
  cross-tenant disable/impersonate must not be reduced on small screens.

---

## 11. Claude-design prompt (ready to paste)

```
You are designing ONE screen for the Auto-LevelUp super-admin (platform control-plane) web app,
using the "Lyceum" design system. FIRST read docs/rebuild-spec/design/00-FOUNDATION.md and conform
EXACTLY: use ONLY the semantic color tokens (brand.primary, bg.surface, bg.canvas, text.primary/
secondary/muted, border.subtle/strong/focus, status.info/success/error, spark — but DO NOT use spark
here), the type families (Fraunces display, Schibsted Grotesk UI, Spline Sans Mono for IDs/emails/
timestamps), the §4 spacing/radius/elevation/motion tokens, and ONLY components from the §5 inventory.
NEVER invent colors, fonts, radii, shadows, motion, or component variants. Cite tokens by name, never hex.

SCREEN: "Global Users (Cross-Tenant)" — route /users, role superAdmin ONLY.
REGISTER: precise, credible, serious platform-operator tooling. NOT the playful student register.
NO gamification chrome (no XP/streak/level/marigold spark accents).

This screen DELIBERATELY crosses tenant isolation — it is the only one that does. Make that legible:
render a persistent InlineAlert (status.info) elevated-scope banner under the header stating
"Cross-tenant view — every action is platform-level and audited."

LAYOUT (inside AppShell: Sidebar with Platform→Users active, Topbar showing a platform-scope indicator
instead of a tenant switcher, Breadcrumb "Platform › Users"):
- Page header: H1 "Global Users" (Fraunces text-2xl) + subtitle "Search and act on users across every tenant".
- Elevated-scope InlineAlert banner (info).
- Search Card: one full-width Input with leading search icon, autofocus, placeholder "Search by email or
  name…", hint "Prefix match — searches the start of an email or display name." Debounce 300ms.
- Results Card → DataTable, columns: Name (displayName, with a neutral outline "Super Admin" Badge +
  ◆ glyph for super admins — NEVER spark), Email (Spline Mono, text.secondary), Memberships (wrap of
  Chips "{role} @ {tenantCode}", each a link to /tenants/{tenantId}; empty → muted "No active memberships"),
  Last login (relative time, mono tabular-nums, tooltip = absolute), and a trailing ⋯ RowActionMenu
  (Popover) with: "Open in tenant…", "Disable account / Re-enable" (status.error), "Force password reset",
  "Impersonate-scope…" (danger). Footer: "Showing N results" + "(updating…)" while refetching + Pagination.

DATA SHAPE (real, from SearchUsersResponse): users[] { uid, email|null, displayName|null, isSuperAdmin,
activeTenantId|null, lastLoginAt, createdAt, memberships[]{ tenantId, tenantCode, role } } — memberships
are ACTIVE-only. Search is a backend prefix match over email/displayName.

STATES: initial (EmptyState "Search the platform"), loading (5–6 Skeleton rows mirroring the table),
refetching (keep rows, show "(updating…)"), empty ("No users found — nothing matches “{query}”…"),
error (status.error InlineAlert + Retry), success. Self-protection: a super admin can't disable/impersonate
their own row or impersonate another super admin → those menu items disabled with a tooltip.

INTERACTIONS/MOTION (subtle only — fast 160ms / base 220ms, ease.standard/entrance; NO spring, NO burst):
debounced search with fast cross-fade; membership-chip click → that specific tenant; elevated actions each
open a ConfirmDialog/Modal (disable = optimistic Badge flip + toast "audit logged"; impersonate-scope Modal
REQUIRES a tenant Select + a required reason Textarea + an "I understand this is logged" Checkbox before the
danger Button enables).

A11Y: focus order Sidebar→search(autofocus)→table→row actions→pagination; table with sr-only caption,
scope="col", aria-sort; result count + "(updating…)" in aria-live="polite"; status NEVER by color alone
(Super Admin = outline Badge + text + ◆; Active/Disabled = Badge + icon + label); border.focus 3px ring;
respect prefers-reduced-motion; ≥44px touch targets.

RESPONSIVE: desktop = full DataTable + hover ⋯ + ⌘K; md = drop Created column, chips wrap; sm = DataTable
collapses to stacked result Cards, hover→press, NO ⌘K command palette. Admin is web/desktop-first; there is
no native super-admin app.

DOMAIN RULES TO HONOR VISUALLY: tenant isolation is deliberately crossed (banner + audit); super-admin-only
RBAC; every elevated action is confirmed + audited + names its consequence; credentials never shown
(password reset only emails); server-authoritative values (client only formats); active-only memberships;
no self-elevation/self-status; gamification accents banned.

Deliver clean, accessible, production-ready React + Tailwind (reading Lyceum CSS custom properties via
@theme) using shared-ui component names from §5 (AppShell, Sidebar, Topbar, Card, Input, DataTable, Chip,
Badge, Popover, ConfirmDialog, Modal, Textarea, Select, Checkbox, EmptyState, Skeleton, Pagination,
InlineAlert, Toast, Tooltip). Cite token names in comments where a color/space/motion choice is made.
```
