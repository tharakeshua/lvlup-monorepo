# Announcements (Tenant) — Tenant-Admin Screen Spec

> **Area:** admin (tenant / academy control plane, `apps/admin-web`) ·
> **Route:** `/announcements` · **Role:** `tenantAdmin` Conforms to the
> **Lyceum** foundation (`docs/rebuild-spec/design/00-FOUNDATION.md`). All
> tokens cited by their semantic name; no new
> colors/fonts/spacing/radii/shadows/motion/components invented except where
> explicitly flagged as a **proposed foundation addition**. Register: **serious
> / precision** (admin tooling for staff & admins), NOT the playful student
> register. Restraint in chrome; energy reserved for the single primary CTA.

---

## 1. Purpose & primary user

**Primary user:** Tenant admin (academy / school administrator) — authenticated
as `tenantAdmin`, scoped to exactly ONE tenant via active-tenant custom claim
(`RequireAuth.tsx` asserts `currentMembership.tenantId === currentTenantId`;
status report §1 Auth & guards).

**Job-to-be-done:** "As the academy administrator, I need to compose, target,
schedule, and publish announcements to audiences inside **my** academy —
students, parents, teachers, and/or specific classes — and move each one through
a draft → publish → archive lifecycle, so that policy changes, exam notices,
schedule changes, holidays, and reminders reach exactly the right people, with a
record of who authored what and when. I also need visibility into **platform
notices** the operator has broadcast to all tenants, which I can read but never
edit."

**Two scopes, one screen — strict separation:**

- **Tenant announcements** (`scope: "tenant"`) — the admin **authors and
  manages** these. `tenantId` is the admin's own tenant (derived server-side
  from claims in the rebuild; `common-api.md §3.3 / §4.4).
- **Platform notices** (`scope: "platform"`) — authored by the platform
  super-admin in a _different_ app (`super-admin-announcements.md`). On this
  screen they are **read-only** context, surfaced as a banner band. A tenant
  admin can never create, edit, publish, or archive a platform notice, and never
  sees another tenant's announcements. Tenant isolation is a hard domain rule.

---

## 2. Entry points & route

**Route:** `/announcements` — lazy-loaded (`React.lazy` + `Suspense`), wrapped
by `RequireAuth({ allowedRoles: ["tenantAdmin"] })` → `AppLayout` (status report
§1; `App.tsx`).

**Entry points:**

- Sidebar nav, **Management** group ("Announcements"; `AppLayout.tsx`
  `navGroups`). Hover prefetches the lazy chunk via `ADMIN_PREFETCH_MAP` /
  `usePrefetch`.
- Direct URL / breadcrumb (`Academy › Announcements`).
- ⌘K command palette → "New announcement" / "Go to announcements" (web only).
- Optional deep-link from the dashboard ("Publish a reminder for the upcoming
  exam window").

**Common-API reads/writes** (per
`specs/common-api.md §3.3 — `identity`module; today's`callListAnnouncements`/`callSaveAnnouncement`
wrappers map to these registry names):

| Action                                            | Callable                                                          | Registry name                   | Notes                                                                                                                                                                                                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List tenant announcements                         | `listAnnouncements({ scope:"tenant", status?, cursor?, limit? })` | `v1.identity.listAnnouncements` | Unified **PageRequest/pageResponse** fragment (`common-api.md §7`): `{ cursor, limit }` → `{ items, nextCursor, total? }`. `status` optional (omit = all). `tenantId` derived server-side from claims (rebuild); legacy code passes `tenantId` explicitly. |
| List platform notices                             | `listAnnouncements({ scope:"platform", status:"published" })`     | `v1.identity.listAnnouncements` | Read-only band. Only `published` platform notices are returned to a tenant admin (server-gated).                                                                                                                                                           |
| Create / update / status-transition / soft-delete | `saveAnnouncement(req)`                                           | `v1.identity.saveAnnouncement`  | `save*` upsert convention: no `id` = create (server stamps `status:"draft"`, `scope:"tenant"`, `authorId`/`authorName`, `createdAt`); `id` present = update; `data.status` change = lifecycle transition; `delete:true` = soft-delete. `rateTier: write`.  |
| Class options for targeting                       | `listClasses()` (today `useClasses(tenantId)`)                    | `v1.identity.*` classes read    | Powers the **Target Classes** multi-select in the editor. Tenant-scoped.                                                                                                                                                                                   |

**Server-authoritative request/response shapes** (from live
`callable-types.ts`):

- `SaveAnnouncementRequest = { id?, tenantId?, data: { title?, body?, scope?, targetRoles?: string[], targetClassIds?: string[], status?: "draft"|"published"|"archived", expiresAt?: string }, delete? }`.
- `ListAnnouncementsResponse.announcements[]` =
  `{ id, title, body, authorName, scope, status, targetRoles?, targetClassIds?, publishedAt?, archivedAt?, expiresAt?, createdAt, updatedAt }`
  (timestamps as `{ seconds }` today → coerced by one shared `formatTimestamp`
  util; status report §4.9).

**Auth gating (server-authoritative):** `scope:"tenant"` writes gate on
`isTenantAdmin(tenantId)` (=
`hasRole(tenantId,'tenantAdmin') || isSuperAdmin()`; `firestore.rules`).
`authorId` / `authorName` / `createdAt` / initial `status` are
**server-stamped** — never trusted from the client body. A tenant admin cannot
set `scope:"platform"`; the server rejects it.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (§5 Navigation): persistent left **Sidebar**
(role-driven nav, "Announcements" active in the Management group) + **Topbar**
(tenant switcher / tenant name, ⌘K search, `NotificationBell`, `ThemeToggle`,
profile). A `QuotaWarningBanner` may sit above the page content (shell-owned).
This screen owns the main content region only. Admin is desktop-first; max
content width 1200 (foundation §4). Page gutters: desktop 32 / tablet 24 /
mobile 16. Vertical rhythm between regions: spacing 6 (24px).

```
┌──────────────────────────────────────────────────────────────────────────┐
│ TOPBAR  [Lyceum mark]  ⟨Academy name ▾⟩          ⌘K   🔔   ◐   ⟨avatar⟩   │
├────────────┬─────────────────────────────────────────────────────────────┤
│ SIDEBAR    │ MAIN (bg.canvas, gutter 32, max-w 1200)                       │
│ Overview   │ ┌─ PageHeader ─────────────────────────────────────────────┐ │
│  Dashboard │ │ Announcements              [ + New announcement ] (spark) │ │
│ Management │ │ Broadcast notices to your academy.                        │ │
│ ▸ Announce │ └───────────────────────────────────────────────────────────┘ │
│  Users     │                                                                │
│  Classes   │ ┌─ Platform notices (InlineAlert band, status.info) ───────┐  │
│  Spaces    │ │ ⓘ Platform notices                                        │  │
│  Exams     │ │ ┌ Card (read-only) ──┐  ┌ Card (read-only) ──┐            │  │
│ Analytics  │ │ │ Maintenance window  │  │ New feature: …      │           │  │
│ Config     │ │ │ ContentRenderer …   │  │ ContentRenderer …   │           │  │
│  Settings  │ │ │ 12 Jun · Platform   │  │ 09 Jun · Platform   │           │  │
│            │ │ └────────────────────┘  └────────────────────┘            │  │
│            │ └───────────────────────────────────────────────────────────┘ │
│            │                                                                │
│            │ ┌ Tabs (status filter) ────────────────────────────────────┐  │
│            │ │  All · Draft · Published · Archived        (count chips)   │  │
│            │ └───────────────────────────────────────────────────────────┘ │
│            │ ┌ Card (bg.surface, radius lg, e1) ─────────────────────────┐  │
│            │ │ DataTable                                                  │  │
│            │ │  Title          Status   Audience   Author   Created  ⋯   │  │
│            │ │ ─────────────────────────────────────────────────────────  │  │
│            │ │  Exam timetable Published Students  A. Rao   12 Jun  ⋯     │  │
│            │ │   body preview…          +2 classes                        │  │
│            │ │  Holiday notice Draft     Everyone  A. Rao   11 Jun  ⋯     │  │
│            │ │ …                                                          │  │
│            │ │ ─────────────────────────────────────────────────────────  │  │
│            │ │  Pagination                       rows ⟨20 ▾⟩  ‹ 1/3 ›     │  │
│            │ └───────────────────────────────────────────────────────────┘ │
└────────────┴─────────────────────────────────────────────────────────────┘
```

**Editor (Modal/Dialog, max-w ~560, e3, max-h 90vh scroll):**

```
┌ New announcement / Edit announcement ───────────────── ✕ ┐
│ Compose a notice for your academy. Saved as a draft.      │
│                                                            │
│ Title *            [_________________________]  (≤200)     │
│ Body *  [ Write · Preview ]  ← Tabs                        │
│   Write:   ⌶ Textarea (Markdown + KaTeX), ≤5000            │
│   Preview: ContentRenderer (md + KaTeX) live render        │
│ Expiry date (optional)        [ 2026-06-30  ▾ ]  DatePicker│
│ ── Audience ─────────────────────────────────────────────  │
│ Target roles (optional · default Everyone)                 │
│   ☐ Students   ☐ Parents   ☐ Teachers                      │
│ Target classes (optional · default All classes)            │
│   ┌ scroll list, search ───────────────┐                  │
│   │ ☑ Grade 10 – A   ☐ Grade 10 – B …  │                  │
│   └─────────────────────────────────────┘                 │
│ Audience summary: “Students · 2 classes (≈ 84 recipients)” │
│                                                            │
│              [ Cancel ]  [ Save draft ]  [ Publish ▸ ]      │
└────────────────────────────────────────────────────────────┘
```

**Responsive behavior:**

- **lg (≥1024):** layout as drawn. Sidebar persistent. Platform-notice cards
  2-up grid (`sm:grid-cols-2`). Full DataTable with all columns. Editor centered
  Modal.
- **md (768–1023):** Sidebar collapsible to icon rail (shell-owned).
  Platform-notice cards 2-up. DataTable keeps Title / Status / Audience /
  Created; Author moves into the row's expandable detail or the `⋯` actions.
  Editor Modal width clamps to viewport − 32.
- **sm (<768):** Sidebar → `MobileBottomNav`. Platform notices single column.
  **DataTable rows collapse to stacked `Card`s** (Title + body preview, Status
  `Badge`, Audience chips, Created, `⋯` actions). Editor becomes a full-height
  bottom **Sheet/Drawer**. PageHeader CTA collapses to an icon-labeled
  `IconButton` if space-constrained.

---

## 4. Components used (FOUNDATION §5 only)

**Navigation / shell:** `AppShell`, `Sidebar`, `Topbar`, `Tabbar` (mobile),
`Breadcrumb`, `CommandPalette` (⌘K, web-only), `RoleSwitcher` (shell-owned).

**Containers:** `Card` (platform-notice cards; table wrapper), `Panel`, `Tabs`
(status filter; **Write/Preview** toggle in editor), `Modal/Dialog` (create/edit
editor on web), `Drawer/Sheet` (editor on mobile), `Popover` (row `⋯` actions
menu), `Tooltip` (icon-only actions).

**Primitives:** `Button` (primary = New announcement uses **spark** CTA
treatment per foundation §2.2; secondary = Save draft; ghost = row actions;
danger = Delete in confirm), `IconButton` (row `⋯`), `Input` (Title; class
search), `Textarea` (Body — Markdown source), `Select`/`Combobox`
(rows-per-page; class filter if promoted), `Checkbox` (target roles; class
multi-select), `DatePicker` (expiry).

**Data:** `DataTable` (sort by Created/Status/Title, status-tab filter,
pagination, optional bulk-select), `Badge` (status: Draft / Published /
Archived), `Chip/Tag` (audience: role + class chips, "+N classes" overflow),
`Avatar` (author), `EmptyState` (no announcements), `Skeleton` (loading),
`Pagination` (`DataTablePagination`), `DefinitionList` (audience summary in
editor).

**Feedback:** `Toast` (sonner — save/publish/archive/delete results),
`InlineAlert/Banner` (Platform notices band header; permission-gated notices),
`ConfirmDialog` (Publish, Archive, Delete confirmations), `FormFieldError`
(title/body validation), `LoadingOverlay` (editor save in flight).

**Domain components:** `ContentRenderer` (md + KaTeX) — renders the announcement
**Body** in the editor **Preview** tab, in the platform-notice cards, and in the
expanded row/detail. This is the single canonical rich-content renderer
(foundation §3, §5).

**Proposed foundation additions (flagged):**

1. **`AudienceSummary`** — a small derived line ("Students · 2 classes · ~84
   recipients") composed from `Chip` + `text.secondary`; if reused across
   notification/messaging surfaces, promote to a named domain component. Until
   then, compose from existing `Chip/Tag` + `DefinitionList`.
2. **Recipient-count estimate** ("~84 recipients") requires a server-side count
   not in today's contract. Flagged as a **proposed API addition**
   (`estimateAudience` or an inline count on `saveAnnouncement` dry-run); render
   it only when the server provides it, otherwise omit the count and show
   audience composition alone.

No new colors, fonts, radii, shadows, or motion are introduced.

---

## 5. States — loading / empty / error / partial / success (role-gated)

**Permission gate (whole screen):** non-`tenantAdmin` never reach
`/announcements` (`RequireAuth`). `superAdmin` bypasses (status report §1). If
`currentTenantId` is null (mid tenant-switch), show the shell skeleton, not an
error.

**Platform-notices band:**

- _Loading:_ 2 `Skeleton` `Card`s (matches live behavior).
- _Empty:_ band is **omitted entirely** (no notices, no header) — never render
  an empty "Platform notices" heading.
- _Error:_ band silently hidden (non-blocking context); log only. It must never
  block the tenant admin's own work.

**Tenant announcements table:**

- _Loading:_ `DataTable` skeleton — 5 placeholder rows (Title + body line,
  Status pill, Audience, Author, Created, action skeleton).
- _Empty (no announcements at all):_ `EmptyState` — `Megaphone` glyph in a
  `bg.surface-sunken` circle, title "No announcements yet", body "Create your
  first announcement to reach students, parents, and teachers.", primary
  `Button` "New announcement" (spark).
- _Empty (filter yields none):_ `EmptyState` variant — "No {status}
  announcements", body "No announcements match this filter.", secondary action
  "Clear filter" → back to **All**.
- _Error:_ `InlineAlert` (status.error) inside the card region — "Couldn't load
  announcements." + Retry `Button` (re-runs the query). Never a blank table.
- _Partial:_ successive pages stream via `Pagination`/cursor; an inline row
  `Skeleton` shimmer appears under the last row while the next page loads.
  Stale-while-revalidate: existing rows stay visible during refetch.
- _Success:_ rows with `Badge` status, audience `Chip`s, author `Avatar`+name,
  `formatTimestamp(createdAt)` in mono tabular numerals.

**Per-row action availability (lifecycle-gated, mirrors live + extended):**

- `draft` → **Edit**, **Publish**, **Delete**.
- `published` → **Edit** (content edits allowed; re-publishes), **Archive**,
  **View**.
- `archived` → **View**, **Restore to draft** (Restore is a flagged extension of
  today's UI), **Delete**.
- Disabled actions render as disabled `Button`s with a `Tooltip` reason — never
  hidden silently where the user might expect them.

**Editor:**

- _Idle:_ fields editable; **Save draft** enabled once Title and Body are
  non-empty; **Publish** enabled once a valid audience is resolved.
- _Saving:_ `LoadingOverlay` over the dialog body; footer buttons disabled;
  label "Saving…".
- _Validation error:_ `FormFieldError` under the offending field; toast
  suppressed for inline-recoverable errors.
- _Save error:_ `Toast` (status.error) "Couldn't save announcement" + server
  message; dialog stays open with input preserved.

---

## 6. Interactions & motion (foundation §4 motion tokens)

**Open editor:** "New announcement" / row "Edit" → Modal enters with
`ease.entrance` over `base` (220ms): scale 0.98→1 + fade; backdrop fades. Mobile
Sheet slides up `ease.entrance`. First focusable = Title input (focus moves on
open).

**Compose Body:** Textarea holds Markdown/KaTeX source. The **Write / Preview**
`Tabs` toggle (`fast` 160ms cross-fade) renders the live `ContentRenderer`. No
raw HTML; source is the stored value.

**Audience targeting:** toggling a role/class `Checkbox` updates the
**AudienceSummary** line instantly (optimistic, local). Default (no roles, no
classes) reads "Everyone in this academy". Selecting roles and/or classes
narrows it; the summary recomputes with `instant` (100ms) opacity tick on the
count.

**Save draft:** `saveAnnouncement` (no/`id`). **Optimistic insert/patch** into
the tenant query cache so the new draft appears immediately in the table; on
success → `Toast` (status.success) "Draft saved" and dialog closes
(`ease.exit`); on error → rollback + dialog stays open with a toast. Narrow
cache invalidation on the `["tenant", tenantId, "announcements"]` key family
(status report §4 recommends narrow keys).

**Publish (state transition):** **ConfirmDialog** first — "Publish this
announcement? It will be visible to {audience summary} and cannot be unpublished
— only archived." Confirm →
`saveAnnouncement({ id, data:{ status:"published" } })`. Optimistic `Badge` flip
Draft→Published with a subtle `fast` color cross-fade (status.success). On
success → `Toast` "Announcement published". This is staff chrome: **no
celebratory spark burst** — that motion is reserved for student gamification
(foundation §4).

**Archive:** ghost/danger action → **ConfirmDialog** "Archive this announcement?
It will stop being shown to recipients." → optimistic status flip
Published→Archived (status.warning). Toast "Announcement archived".

**Delete (draft/archived only):** **ConfirmDialog** with destructive `Button`
(danger) — "Delete this announcement permanently? This can't be undone." →
`saveAnnouncement({ id, delete:true })` → optimistic row removal + Toast
"Announcement deleted" with an **Undo** affordance window where the contract
supports it; otherwise no Undo.

**Status filter tabs:** switching tabs refetches the scoped list; rows
cross-fade `fast`; selected tab underline slides `ease.standard`.

**Reduced motion:** all entrance/exit/cross-fades degrade to instant opacity
swaps; no scale/slide. Status flips still animate **icon+label change**, never
color-only (foundation §2.2).

---

## 7. Content & copy (precise admin tone)

**Page:**

- Title (h1, Fraunces): "Announcements".
- Subtitle (text.secondary): "Broadcast notices to your academy."
- Primary CTA: "New announcement".

**Platform-notices band:**

- Header (with `Info` glyph): "Platform notices".
- Card meta: "{date} · Platform" (author shown as the platform operator name
  when present). No edit affordances — these are read-only.

**Table columns:** "Title" · "Status" · "Audience" · "Author" · "Created" ·
(actions).

- Status `Badge` labels: "Draft" / "Published" / "Archived".
- Audience cell: role/class `Chip`s; default "Everyone" when no targeting; "+N
  classes" overflow chip.
- Created: localized date, mono tabular.

**Empty states:**

- No announcements: title "No announcements yet" · body "Create your first
  announcement to reach students, parents, and teachers." · CTA "New
  announcement".
- Filtered empty: title "No {status} announcements" · body "No announcements
  match this filter." · action "Clear filter".

**Editor:**

- Title: "New announcement" / "Edit announcement".
- Description: "Compose a notice for your academy. It will be saved as a draft."
  (create) / "Update this announcement." (edit).
- Field labels: "Title _", "Body _", "Expiry date (optional)", "Target roles
  (optional)", "Target classes (optional)".
- Helper under roles: "Leave unchecked to send to everyone." Under classes:
  "Leave unchecked to send to all classes."
- Body tabs: "Write" / "Preview".
- Buttons: "Cancel", "Save draft", "Publish".

**Confirmations:**

- Publish: "Publish this announcement? It will be visible to {audience} and can
  only be archived afterward — not unpublished."
- Archive: "Archive this announcement? It will stop being shown to recipients."
- Delete: "Delete this announcement permanently? This can't be undone."

**Errors / toasts:**

- Validation: "Title and body are required." (inline + suppressible toast).
- Save fail: "Couldn't save announcement." + server detail.
- Load fail: "Couldn't load announcements." + "Retry".
- Success: "Draft saved." / "Announcement published." / "Announcement archived."
  / "Announcement deleted."

Tone: declarative, operational, no exclamation marks, no student-facing warmth.
Sentence case throughout.

---

## 8. Domain rules surfaced

- **Tenant isolation (hard rule).** Every read/write is scoped to the admin's
  single active tenant. `tenantId` is derived server-side from the active-tenant
  claim (rebuild; `common-api.md §4.4`); a tenant admin can never list, target,
  or edit another tenant's announcements, and
  `listAnnouncements({scope:"platform"})` returns only published, broadcast
  platform notices — never tenant data.
- **Scope is server-enforced.** A `tenantAdmin` cannot author
  `scope:"platform"`; the server rejects that scope. The editor never exposes a
  scope selector — scope is implicit (`tenant`).
- **RBAC.** Writes gate on `isTenantAdmin(tenantId)` (`firestore.rules`).
  `staffPermissions` may further gate who among staff can publish (status report
  §4 notes permissions are defined but partly unenforced in UI — the rebuild
  should drive the publish/delete affordances off a
  `useCan('manageAnnouncements')` hook).
- **Server-authoritative fields.** `authorId`, `authorName`, `createdAt`,
  `updatedAt`, `publishedAt`, `archivedAt`, and the **initial** `status` are
  stamped server-side and never trusted from the client body. The client sends
  only `title`, `body`, `targetRoles`, `targetClassIds`, `expiresAt`, and
  explicit lifecycle transitions.
- **Lifecycle is a state machine.** `draft → published → archived`;
  `archived → draft` (restore) where allowed. Published cannot revert to draft
  except via the restore-from-archived path. The UI offers only valid
  transitions for each row's current status.
- **Audience targeting semantics.** Empty `targetRoles` = all roles; empty
  `targetClassIds` = all classes. These ANDs/ORs (role ∩ class) are resolved
  server-side at delivery; the UI's "Everyone" / recipient estimate is advisory,
  and any recipient count is **server-computed**, not client-guessed.
- **Audit.** Create / publish / archive / delete write a server-side audit entry
  (author, timestamp, scope, target) — `common-api.md` audit-log. The visible
  Author + Created columns reflect that record.
- **Expiry.** `expiresAt` is an ISO date the admin may set; expired
  announcements stop being delivered. Expiry is enforced server-side, not by
  client filtering.
- **Cost / quota.** Announcements are not AI-billed, but broadcast volume may
  interact with notification quotas (`QuotaWarningBanner`, shell-owned); if a
  tenant is over its notification quota, publish is blocked server-side with a
  clear error surfaced as a toast.

---

## 9. Accessibility (WCAG AA)

- **Focus order:** PageHeader CTA → status `Tabs` (roving tabindex, arrow-key
  navigation) → table rows (each row's actions reachable via `Tab`; `⋯` menu is
  a `Popover` with arrow-key item navigation and `Esc` to close) → pagination.
  Opening the editor traps focus inside the Modal/Sheet; `Esc` and Cancel both
  close and **return focus to the trigger**.
- **Editor focus:** on open, focus moves to Title. Write/Preview `Tabs` use
  `role="tablist"`; Body Textarea is labeled; DatePicker is keyboard-operable;
  role/class `Checkbox`es are real inputs with associated `<label>`s.
- **Keyboard:** all actions operable without a pointer. Confirm dialogs
  default-focus the safe (Cancel) action for destructive operations; the
  destructive `Button` is reachable but not default-focused.
- **ARIA:** status filter tabs `aria-selected`; table is a semantic `<table>`
  with `<th scope="col">`; status changes announce via an `aria-live="polite"`
  region ("Announcement published"); the route announcer (shell) announces
  navigation. Platform-notices band has `aria-label="Platform notices"`.
- **Status is never color-alone:** every status `Badge` and audience `Chip`
  pairs **icon + text label** (Draft/Published/Archived), satisfying foundation
  §2.2. Confidence/grade palettes are not used here.
- **Contrast:** text/background pairs meet AA (4.5:1 body, 3:1 large/UI) using
  `text.primary`/`text.secondary` on `bg.surface`/`bg.canvas`; status badges use
  the semantic status tokens whose foreground/background pairs are AA-verified
  in the foundation.
- **Reduced motion:** `prefers-reduced-motion` collapses all transitions to
  instant opacity changes; no slide/scale; status transitions still convey
  change via label+icon.
- **Content rendering:** `ContentRenderer` output (Markdown + KaTeX) carries
  proper heading hierarchy and `aria` for math (MathML / alt text), so screen
  readers can announce equation content in announcement bodies.

---

## 10. Web ↔ mobile divergence

Admin is **web-first** (desktop console). There is no native admin app; the only
"mobile" target is the **responsive web** layout at `sm`.

- **DataTable → stacked Cards** at `sm` (foundation §6 rule): each announcement
  becomes a `Card` (Title + body preview, Status `Badge`, audience `Chip`s,
  Created, `⋯` actions).
- **Editor Modal → bottom Sheet/Drawer** at `sm`, full-height, scrollable.
- **⌘K command palette is web-only** (foundation §6). No command palette on
  touch/mobile-web; entry is via the PageHeader CTA and bottom-nav.
- **Hover → press:** row hover affordances (action reveal, prefetch on hover)
  degrade to always-visible actions / tap on touch.
- **Sidebar → `MobileBottomNav`** (shell-owned) at `sm`.
- No camera/scanner, XP, or offline-queue concerns apply to this admin screen —
  those domain components are out of scope here.

---

## 11. Claude-design prompt (ready to paste)

```
You are designing ONE screen for the Auto-LevelUp admin web app, conforming to the
"Lyceum" design system in docs/rebuild-spec/design/00-FOUNDATION.md. Read that
foundation first and use ONLY its tokens and §5 component inventory — invent no new
colors, fonts, spacing, radii, shadows, motion, or component variants. Cite tokens by
semantic name (brand.primary, bg.surface, spark, status.error, text.secondary, etc.).

SCREEN: "Announcements (Tenant)" — route /announcements — role: tenantAdmin
(scoped to ONE tenant; tenant isolation is a hard rule). Register: serious/precision
admin tooling, NOT the playful student register. Restraint in chrome; energy only on
the single primary "New announcement" CTA (spark treatment).

Render inside AppShell (persistent Sidebar with "Announcements" active in the
Management group + Topbar with tenant switcher, ⌘K, NotificationBell, ThemeToggle,
profile). Desktop-first, max content width 1200, gutters 32/24/16.

Compose these regions, top to bottom:
1. PageHeader: h1 "Announcements" (Fraunces), subtitle "Broadcast notices to your
   academy." (text.secondary), primary "New announcement" button (spark CTA).
2. Platform-notices band (InlineAlert + read-only Cards, status.info accent): header
   "Platform notices" with an info glyph; 2-up grid of read-only Cards each rendering
   a notice body via ContentRenderer (md+KaTeX) + "{date} · Platform" meta. OMIT the
   whole band if there are none. These are NEVER editable by a tenant admin.
3. Status filter Tabs: All · Draft · Published · Archived (with count chips).
4. DataTable inside a Card (radius lg, e1): columns Title (+body preview), Status
   (Badge: Draft/Published/Archived — icon+label, never color-alone), Audience
   (role/class Chips, default "Everyone", "+N classes" overflow), Author (Avatar+name),
   Created (mono tabular date), and a row ⋯ actions Popover. Per-status actions:
   draft → Edit/Publish/Delete; published → Edit/Archive/View; archived →
   View/Restore/Delete. DataTablePagination at the bottom.

Editor = centered Modal/Dialog (web) / bottom Sheet (mobile), max-w ~560, e3,
scrollable: Title (Input, ≤200) *, Body * with a Write/Preview Tabs toggle (Write =
Textarea Markdown/KaTeX source ≤5000; Preview = live ContentRenderer), Expiry date
(optional DatePicker), Target roles (Checkboxes: Students/Parents/Teachers, default
Everyone), Target classes (searchable scroll list of Checkboxes, default All classes),
an AudienceSummary line, and footer buttons Cancel / Save draft / Publish.

States: skeleton loading rows; EmptyState ("No announcements yet" + Megaphone glyph +
CTA) and filtered-empty variant; InlineAlert error + Retry; optimistic insert/patch on
save with sonner Toasts ("Draft saved", "Announcement published", etc.); ConfirmDialog
before Publish / Archive / Delete (delete uses a danger button). NO celebratory spark
burst on publish — that motion is student-only.

Motion per foundation §4 (ease.entrance/exit, base/fast). Respect prefers-reduced-motion
(instant opacity swaps). Accessibility: focus trap in editor returning focus to trigger,
roving-tabindex tabs, aria-live status announcements, AA contrast, status by icon+label
not color alone. Responsive: table → stacked Cards at sm, Modal → Sheet at sm, ⌘K
web-only.

Domain rules to honor visually: tenant isolation (only this academy's announcements;
platform notices read-only), scope is implicit "tenant" (no scope selector), lifecycle
state machine draft→published→archived, author/createdAt/status server-stamped, audience
defaults (empty roles=all, empty classes=all), any recipient count is server-computed.

Output: a clean, production-grade React + Tailwind implementation using the Lyceum
tokens (CSS custom properties / @theme), composing the §5 components and the
ContentRenderer domain component. Light and dark theme both correct.
```
