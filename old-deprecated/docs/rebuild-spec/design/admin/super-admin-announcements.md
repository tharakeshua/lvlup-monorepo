# Platform Announcements — Super-Admin Screen Spec

> **Area:** admin (super-admin / platform control plane) · **Route:**
> `/announcements` · **Role:** `superAdmin` Conforms to the **Lyceum**
> foundation (`docs/rebuild-spec/design/00-FOUNDATION.md`). All tokens cited by
> semantic name; no new colors/fonts/spacing/radii/shadows/motion invented
> except where explicitly flagged as a **proposed foundation addition**.
> Register: **serious / precision** (admin tooling), not the playful student
> register. Restraint in chrome.

---

## 1. Purpose & primary user

**Primary user:** Platform super-admin — the operator of the multi-tenant
control plane (`apps/super-admin`). Authenticated via defense-in-depth:
`firebaseUser` present **and** `users/{uid}.isSuperAdmin === true` **and**
ID-token claim `role === "superAdmin"` (per status report §1.3,
`RequireAuth.tsx`).

**Job-to-be-done:** "As the platform operator, I need to compose, schedule, and
publish **platform-wide** announcements that reach tenants/roles across the
whole platform — and manage them through a draft → publish → archive lifecycle —
so that maintenance windows, policy changes, new-feature notices, and incident
notices reach the right audience reliably, with a clear record of who authored
what and when."

**Distinct from tenant announcements.** This screen edits
**`scope: "platform"`** announcements only. A tenant-admin's announcements
(`scope: "tenant"`, derived `tenantId` from claims) are a _different_ surface in
a different app. Tenant isolation is a hard domain rule: a platform announcement
is authored at platform scope and is **never** silently scoped to one tenant;
conversely this screen never reads or writes tenant-scoped announcements.
(Status report §4.5 flags that the legacy free-text
`platform/config.announcement` string overlaps this CRUD — the rebuild **drops**
the free-text string; this screen is the single authoritative
platform-announcement surface.)

---

## 2. Entry points & route

**Route:** `/announcements` (lazy-loaded, wrapped by `RequireAuth` →
`AppLayout`; status report §1.2).

**Entry points:**

- Sidebar nav, **System** group (status report §1.2; `AppLayout.tsx`).
- Direct URL / breadcrumb (`Platform › Announcements`).
- ⌘K command palette → "New announcement" / "Go to announcements" (web only).
- Deep link from a dashboard banner ("a maintenance window is scheduled — review
  announcement").

**Common-API reads/writes** (per `specs/common-api.md` §3.3 — `identity` module;
the rebuild moves the legacy direct paths behind the typed registry; today's
`callListAnnouncements`/`callSaveAnnouncement` map to these):

| Action                                            | Callable (`api.identity.*`)                              | Registry name                   | Notes                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------- | -------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List announcements                                | `listAnnouncements({ scope:"platform", status?, page })` | `v1.identity.listAnnouncements` | Uses the unified **PageRequest/pageResponse** fragment (`common-api.md §7`): `{ cursor, limit }` → `{ items, nextCursor, total? }`. `status` filter optional (omit = all). **`scope:"platform"` is server-gated to super-admin.**                                                                         |
| Create / update / status-transition / soft-delete | `saveAnnouncement(req)`                                  | `v1.identity.saveAnnouncement`  | `save*` upsert convention (`common-api.md §3.1`): no `id` = create (server stamps `status:"draft"`, `scope:"platform"`, `authorId`/`authorName`, `createdAt`); `id` present = update; `data.status` transition = lifecycle; `data.deleted = true` (today `delete:true`) = soft-delete. `rateTier: write`. |

**Auth gating (server-authoritative):** both callables gate `scope:"platform"`
on `isSuperAdmin` (status report §2.3; auth-access §1.6).
`authorId`/`authorName`/`createdAt`/`status` are **server-stamped** — never
trusted from the client body. The audit trail is written server-side
(`writePlatformActivity` / one audit-log collection, `common-api.md §9`).

**Response shape (from live `ListAnnouncementsResponse`):** each item =
`{ id, title, body, status: "draft"|"published"|"archived", scope, authorId, authorName, createdAt, expiresAt? }`
(timestamps as `{ seconds }` today → coerced by one shared `formatTimestamp`
util in the rebuild; status report §4.8).

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (§5 Navigation): persistent left **Sidebar**
(role-driven nav, "Announcements" active in the System group) + **Topbar**
(platform-scope indicator, ⌘K search, notifications, profile). This screen owns
the main content region only. Admin is desktop-first; max content width 1200
(foundation §4). Page gutters: desktop 32 / tablet 24 / mobile 16.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ TOPBAR  [Lyceum mark]  Platform control plane        ⌘K   🔔   ◐  ⟨avatar⟩ │
├────────────┬─────────────────────────────────────────────────────────────┤
│ SIDEBAR    │ MAIN (bg.canvas, gutter 32)                                   │
│            │ ┌─ PageHeader ─────────────────────────────────────────────┐ │
│ Overview   │ │ Platform announcements        [ + New announcement ]      │ │
│  Dashboard │ │ Compose and schedule platform-wide notices.   (spark CTA) │ │
│ Platform   │ └───────────────────────────────────────────────────────────┘ │
│  Tenants   │                                                                │
│  Analytics │  ┌ Tabs (status filter) ───────────────────────────────────┐  │
│  …         │  │  All · Draft · Published · Archived          (count chips)│  │
│ System     │  └───────────────────────────────────────────────────────────┘ │
│ ▸ Announce │                                                                │
│  Health    │  ┌ Card (bg.surface, radius lg, e1) ───────────────────────┐  │
│  Settings  │  │ DataTable                                                │  │
│            │  │ ┌──────┬────────┬───────┬─────────┬─────────┬──────────┐ │  │
│            │  │ │TITLE │ STATUS │AUDIENCE│ AUTHOR  │ SCHEDULE│ ACTIONS  │ │  │
│            │  │ ├──────┼────────┼───────┼─────────┼─────────┼──────────┤ │  │
│            │  │ │Maint.│●Publ’d │All tn.│ S. Admin│Jun 22→24│ ⋯        │ │  │
│            │  │ │ …body│        │       │         │ (mono)  │          │ │  │
│            │  │ │New ft│○Draft  │Admins │ S. Admin│  —      │Edit Pub ⋯│ │  │
│            │  │ └──────┴────────┴───────┴─────────┴─────────┴──────────┘ │  │
│            │  │ Pagination (cursor)                       Rows 1–20 of N │  │
│            │  └───────────────────────────────────────────────────────────┘ │
└────────────┴─────────────────────────────────────────────────────────────┘
```

**Compose/edit happens in a Modal/Dialog** (overlay, max-w-lg, e3), not a
separate route — matching live behavior and keeping list context.

**Grid & responsive (foundation §4 breakpoints `sm 640 · md 768 · lg 1024`):**

- **lg (≥1024, primary):** sidebar pinned; PageHeader row (title left, primary
  CTA right); status Tabs; full 6-column DataTable; compose Modal centered.
- **md (768–1023):** sidebar collapsible to icon rail; DataTable keeps
  Title/Status/Schedule/Actions, **Audience + Author collapse into a secondary
  line under Title** (cards-density). Pagination full width.
- **sm (<768, rare for admin):** sidebar → mobile drawer + 4-item Tabbar;
  **DataTable → stacked SubmissionCard-style rows** (one Card per announcement:
  title + body excerpt, a Status Badge + Audience Chip row, schedule in mono,
  actions in an overflow Popover/Sheet). Compose Modal → full-height
  Drawer/Sheet. (See §10.)

The header CTA uses the **spark** Button variant — this is the single primary
action on the page; everything else (filters, row actions) stays restrained
chrome.

---

## 4. Components used (foundation §5 only)

**Navigation:** AppShell, Sidebar, Topbar, Breadcrumb, CommandPalette (⌘K),
Tabbar (mobile).

**Containers:** Card (the table container, radius lg, e1), Modal/Dialog
(compose/edit), Drawer/Sheet (mobile compose + mobile row actions), Tabs (status
filter), Popover (row overflow actions), Tooltip (disabled-action reasons),
ConfirmDialog (delete + publish confirmations).

**Primitives:** Button (`spark` = New announcement / Publish-confirm primary;
`ghost` = row Edit/Publish/Archive; `danger` = Delete), IconButton (overflow ⋯),
Input (title, schedule fields), Textarea (body), DatePicker (publish-at /
expires-at), Select (audience scope), Combobox (target tenants/roles
multi-select), Checkbox (role targets), Switch ("schedule for later").

**Data:** DataTable (sort by Created/Schedule, filter via Tabs, cursor
Pagination, no row-select needed), Badge (status: draft/published/archived),
Chip/Tag (audience targets: "All tenants", "Admins", role chips), Stat/KPI count
chips on tabs (optional), Pagination, Skeleton (loading rows), EmptyState (no
announcements).

**Feedback:** Toast (sonner — save/publish/archive/delete confirmations),
InlineAlert/Banner (publish-scope warning; expired-notice), FormFieldError
(title/body validation), LoadingOverlay (none needed — inline button-busy state
preferred).

**Domain components:** `ContentRenderer` (md+KaTeX) — **proposed use:** render a
live **preview** of the announcement body in the compose dialog and in a
row-expand, since announcement bodies may carry markdown. (`AnswerKeyLock`,
grading, XP components are N/A here.)

**Proposed foundation additions (flagged):**

1. **AudienceTargetField** — a composite (Select scope + Combobox tenants +
   Checkbox role set) for platform-scale targeting. Built entirely from existing
   §5 primitives (Select/Combobox/Checkbox/Chip); proposed as a _named
   composite_ in the domain inventory for reuse by tenant-announcement screens.
   **No new tokens.**
2. **ScheduleStateBadge** — a Badge variant rendering scheduled/live/expired
   schedule state. Maps onto existing Badge +
   `status.info`/`status.success`/`text.muted` tokens; flagged only because
   "scheduled vs live vs expired" is a 3-state pill not in the current Badge
   variant list. **No new tokens.**

---

## 5. States

All loading/empty/error states use foundation skeleton/empty/alert patterns;
**never status-by-color-alone** (every status pairs Badge color + icon + label).

**Loading (skeleton).** On first load / tab change: DataTable renders 5 Skeleton
rows (matching live: title line + body sub-line, a pill-shaped status skeleton,
author/created/schedule line skeletons, an action-cluster skeleton).
PageHeader + Tabs render immediately (static). Mono columns (schedule) reserve
tabular width to avoid layout shift.

**Empty.** Card body shows EmptyState centered (Megaphone icon in a
`bg.surface-sunken` circle, Fraunces title, Schibsted body):

- Filter = All: title _"No platform announcements yet"_, body _"Compose your
  first platform-wide announcement to notify tenants and staff."_, primary spark
  Button _"New announcement"_.
- Filter = Draft/Published/Archived: title _"No {status} announcements"_, body
  _"No announcements match this status."_ (no CTA; offer a "View all" ghost
  link).

**Error.** React Query error → InlineAlert/Banner (variant `error`,
`status.error` + alert-triangle icon) above the table: _"Couldn't load
announcements."_ with a `ghost` **Retry** button. Per `common-api.md §6.3`, copy
is driven by `error.details.code` (`ERROR_MESSAGES`): e.g. `PERMISSION_DENIED` →
_"You don't have access to platform announcements."_; `RATE_LIMITED` → _"Too
many requests — try again shortly."_ Errors render as a banner, **not** as the
empty state (fixes the "errors render as empty states" anti-pattern,
`common-api.md §6.3`).

**Partial.** A page loaded but `nextCursor` present → table shows loaded rows +
Pagination "Load more / next". A row mid-mutation
(publishing/archiving/deleting) shows an inline busy state on that row's action
button (spinner + disabled), other rows interactive. If `total` is unknown
(cheap-count absent), Pagination shows "Rows 1–20" without a grand total
(`common-api.md §7`).

**Success.** Populated DataTable. Each row: **Title** (Schibsted 500) + 1-line
body excerpt (`line-clamp-1`, `text.muted`); **Status** Badge (draft =
`text.secondary`/outline + circle-dashed icon; published = `status.success` +
check-circle icon; archived = `text.muted` + archive icon); **Audience** Chips
("All tenants" or specific tenant/role chips); **Author** (`authorName`,
`text.secondary`); **Schedule** (publish-at → expires-at in **Spline Sans
Mono**, `tabular-nums`; "—" when none); **Actions** (status-dependent, see §6).

**Permission-gated variations by role.**

- **superAdmin (only valid role):** full read + all lifecycle actions.
- **Any non-super-admin** reaching `/announcements`: blocked at `RequireAuth`
  (redirect to login / not-authorized) — the screen never renders. If a stale
  token slips through, the server denies `scope:"platform"` with
  `PERMISSION_DENIED` and the page shows the error banner. **Tenant-admins do
  not see this screen** (their announcements are a separate tenant-scoped
  surface).

---

## 6. Interactions & motion (foundation §4 motion tokens)

**Motion budget — restrained admin register.** No celebratory/spark pops here
(those are reserved for student gamification, foundation §4). Use
`instant`/`fast`/`base` with `ease.standard`; modal enter `base` +
`ease.entrance`, exit `fast` + `ease.exit`. Respect `prefers-reduced-motion`.

**Open compose (create).** Click spark **New announcement** → Modal mounts
(scale 0.98→1 + fade, `base`, `ease.entrance`; backdrop e3 dim). Focus moves to
Title input. Dialog description: _"Saved as a draft — published only when you
explicitly publish."_

**Compose fields & flow.**

- **Title** (Input, required, `maxLength 200`), **Body** (Textarea, required,
  `maxLength 5000`, with a "Preview" toggle rendering `ContentRenderer`).
- **Audience (AudienceTargetField):** Select scope = `All tenants` (default) |
  `Specific tenants` | `By role`. Choosing "Specific tenants" reveals a Combobox
  (multi-select tenant picker, async-searched via the platform tenant list); "By
  role" reveals role Checkboxes (tenant-admins / teachers / students / staff /
  parents). Selections render as removable Chips.
- **Schedule:** a Switch _"Schedule for later"_. Off = publishes immediately on
  Publish. On = reveals a **publish-at** DatePicker (must be future).
  **Expires-at** DatePicker is always available (optional). Validation inline
  via FormFieldError (e.g. expires-at must be after publish-at).
- Save buttons: secondary **Cancel**, primary **Create draft** (disabled until
  title + body non-empty, mirroring live). On success: Modal exits, Toast
  _"Draft created"_, table invalidates (`["platform","announcements"]`).

**Edit (drafts only).** Row **Edit** (ghost) opens the same Modal pre-filled;
primary becomes **Save changes**. Editing is restricted to `draft` status
(published announcements are immutable in-place; to change a published one,
archive + recreate, or — proposed — an explicit "edit published" path with a
confirm + audit note).

**Publish.** Row **Publish** (ghost, `status.success` text) → **ConfirmDialog**
_"Publish to {audience}?"_ summarizing the resolved audience and (if scheduled)
the go-live time. On confirm: optimistic row Badge flips draft→published
(`fast`), the action busy-state shows, then server confirms; Toast
_"Announcement published."_ On error: row reverts, error Toast with
`ERROR_MESSAGES` copy. Publish is a state-machine transition
(`saveAnnouncement({ id, data:{ status:"published" }})`) — the server is
authoritative on allowed transitions.

**Archive.** Published rows show **Archive** (ghost, `status.warning` text) →
ConfirmDialog → optimistic flip to archived; Toast _"Announcement archived."_

**Delete (soft).** Any row's overflow ⋯ → **Delete** (danger) →
**ConfirmDialog**: _"Delete '{title}'? This removes it from the platform. This
can't be undone."_ Confirm calls
`saveAnnouncement({ id, data:{ deleted:true } })` (soft-delete per `save*`
convention). Toast _"Announcement deleted."_ (Optimistic removal; revert on
failure.)

**Filter tabs.** Switching Tabs refetches with `status` filter (`base` content
cross-fade); active tab uses `brand.primary` underline/indicator. Count chips on
tabs update from `total`.

**Feedback summary:** all mutations → sonner Toast;
destructive/irreversible-feeling actions (publish, archive, delete) →
ConfirmDialog first; optimistic updates on status flips + delete with rollback
on error.

---

## 7. Content & copy (precise admin tone)

**Page**

- Title (Fraunces): **Platform announcements**
- Subtitle: _Compose and schedule platform-wide notices for tenants and staff._
- Primary CTA: **New announcement**

**Tabs:** All · Draft · Published · Archived

**Table headers:** Title · Status · Audience · Author · Schedule · _(actions,
unlabeled)_

**Status labels (paired with icon):** Draft · Published · Archived

**Compose / edit dialog**

- Create title: **New announcement** — desc: _"Saved as a draft. It reaches no
  one until you publish."_
- Edit title: **Edit announcement** — desc: _"Update this draft."_
- Fields: **Title** _(required)_ · **Body** _(required, markdown supported)_ ·
  **Audience** · **Schedule for later** _(toggle)_ · **Publish at** · **Expires
  at** _(optional)_
- Footer: **Cancel** · **Create draft** / **Save changes**
- Field errors: _"Title is required."_ · _"Body is required."_ · _"Expiry must
  be after the publish date."_ · _"Publish date must be in the future."_

**Confirmations**

- Publish: title **Publish announcement** — _"This will be visible to {audience}
  immediately."_ (or _"…at {go-live time}."_) — action **Publish**.
- Archive: title **Archive announcement** — _"Archived announcements stop
  showing to recipients but stay in the record."_ — action **Archive**.
- Delete: title **Delete announcement** — _"Delete '{title}'? This removes it
  from the platform. This can't be undone."_ — action **Delete**.

**Empty states:** see §5. **Errors:** _"Couldn't load announcements."_ /
_"Couldn't save the announcement."_ / _"You don't have access to platform
announcements."_ (driven by `error.details.code`).

Tone: declarative, operator-grade, no exclamation marks, no student-facing
warmth. Audience and consequences stated plainly ("reaches no one until you
publish", "visible to {audience} immediately").

---

## 8. Domain rules surfaced

1. **Tenant isolation (hard rule).** This screen reads/writes
   **`scope:"platform"`** only. It never lists or mutates tenant-scoped
   announcements, and a platform announcement is authored at platform scope —
   `tenantId` is **not** in the request body for this surface
   (`common-api.md §4.4`). When targeting "Specific tenants", the selection is
   _audience routing_, not a tenant write — the announcement remains a
   platform-scoped doc.
2. **RBAC gating (server-authoritative).** `scope:"platform"` on both
   `listAnnouncements` and `saveAnnouncement` is gated on `isSuperAdmin`
   server-side (auth-access §1.6; status report §2.3). The client guard is
   UX-only; the server is the enforcement layer.
3. **Server-stamped fields.** `authorId`, `authorName`, `createdAt`, `scope`,
   and initial `status:"draft"` are stamped server-side — the client cannot
   forge authorship or back-date. Status transitions are validated against the
   server state machine (draft → published → archived; soft-delete via
   `deleted:true`).
4. **Audit logging.** Every mutation (create/update/publish/archive/delete)
   writes an audit entry (`writePlatformActivity` / unified audit-log,
   `common-api.md §9`) surfaced in the platform Dashboard activity feed. The UI
   states this implicitly via authorship + immutable history; no client-side
   audit write.
5. **Soft-delete only.** "Delete" is a soft-delete (`deleted:true`) consistent
   with the platform's data-safety posture (status report §1.5 / §4.2) — no hard
   purge from this screen.
6. **Schedule & expiry are server-evaluated.** "Published" visibility honoring
   publish-at/expires-at is computed server-side; the UI never shows an expired
   announcement as live. Schedule values are advisory inputs validated
   server-side.
7. **No answer-key / sensitive-content surface.** N/A to this screen, but the
   general platform invariant holds: nothing on this surface exposes
   tenant-private data; audience selection lists only tenant _names/ids_ the
   super-admin already governs.
8. **Rate limiting / quota.** `saveAnnouncement` is `rateTier: write`
   (`common-api.md §9`); rapid repeated publishes surface `RATE_LIMITED` via the
   error banner/Toast.

---

## 9. Accessibility (WCAG AA)

**Focus order:** Skip-to-content → Sidebar (Announcements active,
`aria-current="page"`) → Topbar controls → PageHeader CTA → status Tabs (roving
tabindex) → DataTable (header sort buttons → row action clusters in DOM order) →
Pagination. Opening the compose Modal traps focus (focus → Title); Esc + Cancel
close and **restore focus to the triggering control** (New announcement button,
or the row's Edit button).

**Keyboard:** Tabs operable with arrow keys (WAI tabs pattern). Every row action
reachable via Tab (no hover-only actions — the row-action cluster is always in
the tab order, or behind a keyboard-openable overflow Popover on dense
breakpoints). ConfirmDialog: Enter = primary action only when focus is on it;
default focus lands on **Cancel** for destructive dialogs (delete/archive) to
prevent accidental confirmation. DatePicker is fully keyboard-navigable.

**ARIA & semantics:** DataTable uses real `<table>` semantics
(`<th scope="col">`, sortable headers as `<button aria-sort>`). Status Badges
expose label text (not color-only) and an `aria-label` like _"Status:
Published"_. Audience Chips are a labeled list. Toasts use `role="status"`
(polite) for success and `role="alert"` (assertive) for errors. The error banner
is `role="alert"`. Mutation busy-states set `aria-busy` on the affected button
and announce _"Publishing…"/"Deleted"_ via a live region.

**Contrast:** All text/background pairs meet AA (4.5:1 body, 3:1 large/UI) using
foundation semantic tokens — `text.primary` on `bg.surface`, status Badges meet
3:1 against their fills. The spark CTA (`text.on-accent` on `spark`) is verified
for the button label.

**Never status-by-color-alone (foundation §2.4):** every status = color **+
icon + text label** (draft/published/archived each have a distinct lucide icon:
circle-dashed / check-circle / archive). Schedule state (scheduled/live/expired)
likewise pairs color with a label.

**Reduced motion:** with `prefers-reduced-motion`, modal/tab transitions become
instant opacity changes; optimistic row flips skip the slide/fade and update in
place. No motion is load-bearing.

---

## 10. Web ↔ mobile divergence

**Admin is primarily web/desktop.** This control-plane screen is designed and
optimized for desktop (`apps/super-admin`, a PWA). State this explicitly:
super-admins operate from a desktop browser; there is **no React Native
super-admin app**. The ⌘K **CommandPalette is web-only** (foundation §6) —
mobile has no command palette.

**Responsive / mobile-stacked behavior (when the PWA is opened on a small
viewport):**

- **DataTable → stacked Cards** below `md`: each announcement becomes a Card
  (title + body excerpt, a row of Status Badge + Audience Chips, schedule in
  mono, actions in an overflow Popover/Sheet) — mirroring the foundation's
  "table on web → stacked cards on mobile" rule (§6).
- **Compose Modal → Drawer/Sheet** (bottom sheet, full-height) on mobile; same
  fields, same validation.
- **Hover → press:** row actions are not hover-revealed on touch; the overflow ⋯
  opens a Sheet of actions. Touch targets ≥44px (foundation §4).
- **Sidebar → mobile drawer + 4-item Tabbar**; "Announcements" reachable from
  the drawer (it's in the System group, not the 4 primary Tabbar items).
- **Pagination** stays cursor-based and identical (shared `pageResponse`
  fragment) across viewports.

Component **names/props are identical** to any future shared-ui usage
(foundation §6); only the renderer differs. No mobile-only data path.

---

## 11. Claude-design prompt (ready to paste)

```
You are designing ONE screen for the Auto-LevelUp super-admin (platform control plane) web app,
using the "Lyceum" design system. Read and conform EXACTLY to docs/rebuild-spec/design/00-FOUNDATION.md
— do not invent colors, fonts, spacing, radii, shadows, motion, or component variants; compose only
from its §5 component inventory and §2–§4 tokens, cited by semantic name (brand.primary, bg.surface,
spark, status.success/warning/error/info, text.primary/secondary/muted, border.subtle, radius lg/md/pill,
e1/e3, motion fast/base, ease.standard/entrance/exit). Register = SERIOUS / precision admin tooling
(NOT the playful student register) — restraint in chrome; the only spark accent is the single primary CTA.

SCREEN: "Platform announcements" — route /announcements, role superAdmin only.
Job: compose, target (platform-scale audience), schedule, and run a draft→published→archived lifecycle
for PLATFORM-WIDE announcements (scope:"platform"), distinct from tenant announcements.

Render inside AppShell (left Sidebar with "Announcements" active in a System nav group; Topbar with
⌘K search, notifications, profile). Desktop-first, max content width 1200, gutter 32.

Build:
- PageHeader: Fraunces title "Platform announcements", subtitle "Compose and schedule platform-wide
  notices for tenants and staff.", right-aligned SPARK Button "New announcement".
- Status Tabs: All · Draft · Published · Archived (brand.primary active indicator, optional count chips).
- A Card (radius lg, e1, bg.surface) containing a DataTable with columns:
  Title (name + line-clamped body excerpt in text.muted) · Status (Badge: draft=outline+circle-dashed,
  published=status.success+check-circle, archived=text.muted+archive — NEVER color-only, always
  icon+label) · Audience (Chips: "All tenants" or specific tenant/role chips) · Author · Schedule
  (publish-at → expires-at in Spline Sans Mono, tabular-nums, "—" if none) · Actions (status-dependent:
  drafts → ghost Edit + ghost Publish(status.success text); published → ghost Archive(status.warning);
  all → overflow ⋯ with danger Delete). Cursor Pagination footer.
- Compose/Edit in a Modal (max-w-lg, e3): Input Title (required, max 200), Textarea Body (required,
  max 5000, with a ContentRenderer markdown Preview toggle), an AudienceTargetField (Select scope:
  All tenants | Specific tenants | By role → reveals a Combobox tenant multi-select OR role Checkboxes,
  rendered as removable Chips), a "Schedule for later" Switch revealing a publish-at DatePicker, and an
  optional expires-at DatePicker. Footer: secondary Cancel + primary "Create draft" / "Save changes"
  (disabled until title+body non-empty).
- ConfirmDialogs for Publish ("visible to {audience} immediately"), Archive, and Delete (soft-delete,
  "can't be undone"). sonner Toasts on every mutation.

States: skeleton rows on load; EmptyState (Megaphone) per filter; error → InlineAlert banner with Retry
(NOT empty state); optimistic status flips + delete with rollback; per-row busy state during mutation.

Rules to surface visually: this is PLATFORM scope only (never tenant-scoped — tenant isolation is hard);
authorship/created/status are server-stamped; delete is soft; super-admin-only (server-authoritative RBAC);
every action audited.

Accessibility: real table semantics, sortable header buttons (aria-sort), tab order with no hover-only
actions, focus-trapped modal restoring focus on close, destructive ConfirmDialogs default-focus Cancel,
status announced via aria-label + live region, AA contrast, prefers-reduced-motion → instant transitions,
status never by color alone.

Responsive: below md, DataTable → stacked Cards, compose Modal → bottom Drawer/Sheet, row actions → Sheet,
⌘K is web-only. Touch targets ≥44px.

Output a single React + Tailwind screen composed from shared-ui components named in FOUNDATION §5,
reading the Lyceum CSS-variable tokens. No new tokens; if something seems missing, note it as a proposed
foundation addition rather than inventing it.
```
