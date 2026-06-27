# Announcements — Compose & Manage

A teacher or tenant admin composes an announcement to one or more managed
classes (or to all classes/roles in scope), then reviews everything they've
already sent — drafts, scheduled, and published — with audience and read counts.
Sending is outward-facing, so it always confirms the audience size first. Staff
tone throughout: precise, credible, calm; the message _body_ is the teacher's
own voice. Conforms to the Lyceum foundation
(`docs/rebuild-spec/design/00-FOUNDATION.md`).

> **Route** `/announcements` · **Roles** `teacher` (managed classes only) ·
> `tenantAdmin` (all classes/roles in tenant) · **Primary APIs** read
> `listAnnouncements` (→ `v1.identity.listAnnouncements`) · write
> `v1.identity.saveAnnouncement` (upsert: draft/publish/archive + soft-delete).
> Audience names resolved via `classes.list` / `useTenantNames`. No
> platform-scope announcements here (that is a super-admin surface).

---

## 1. Purpose & primary user

**Primary user:** a `teacher` who needs to broadcast operational information to
their classes — a schedule change, an exam reminder, homework instructions, a
results-released note — in their own words, and to keep a record of what they've
sent and whether students have seen it. Secondary user: a `tenantAdmin` doing
the same across any class or role in the tenant.

**Job to be done:** _"Write a clear message, pick exactly who should get it,
confirm how many people that is, send (or schedule) it — and later see what I've
sent and how many have read it."_

This screen is **operational communication**, not authoring and not grading. It
does not create learning content (Spaces area), does not grade (Exams area), and
does not manage students (People area). Its only writes are announcement upserts
(`saveAnnouncement`). The body is composed in the shared `RichTextEditor`, which
emits **canonical Markdown** (the single content representation —
`webapps-design.md §2.3`); the live preview and the sent-list previews render
that same Markdown through the single `ContentRenderer`. There is exactly one
content format end-to-end — no TipTap-HTML vs KaTeX split.

---

## 2. Entry points & route

**Route:** `/announcements`. A sidebar item under the **People** (or
**Overview**) nav group, derived from the route manifest `navMeta`
(`webapps-design.md §3.2`/§4.1), gated `allow: ['teacher','tenantAdmin']`.
Deep-linkable. A query param `?compose=1` (or `#compose`) focuses the composer
on entry (used by "Announce" shortcuts elsewhere).

**Entry points:**

- Sidebar **People ▸ Announcements**.
- Dashboard quick action "Send an announcement".
- Class Detail (`class-detail-roster`) header overflow → "Announce to this
  class" (pre-selects that class in the composer audience).
- `NotificationBell` / a sent-announcement notification → "Manage
  announcements".
- CommandPalette (⌘K) "New announcement".

**Reads (via `@levelup/api-client` repositories / hooks — never Firestore
directly):**

- `listAnnouncements({ scope: 'tenant', status?, limit, cursor })` → the **Sent
  & drafts** list. Server scopes to the caller's tenant and, for `teacher`,
  projects only announcements whose `targetClassIds` intersect the caller's
  managed classes (server-authoritative scope, not a client filter). Uses the
  unified `PageRequest`/`pageResponse` fragment (`common-api.md §7`); `cursor`
  is opaque.
- `classes.list()` → the audience selector options (the caller's managed classes
  only; `tenantAdmin` gets all). Class names also resolve audience chips in list
  rows via `useTenantNames`-style batching — no per-id `getDoc` in the view.
- Read counts: each row's `readBy.length` against the resolved audience size
  come back on the list projection (server-computed; the client never aggregates
  `readBy`).

**Writes (callables only):**

- `v1.identity.saveAnnouncement` — the single upsert:
  - `id` absent → **create** (default `status: 'draft'`).
  - `id` present → **update** (edit a draft, or transition).
  - `data.status: 'published'` → **send/publish** (server stamps `publishedAt`,
    fans out notifications to the resolved audience via the
    analytics/notification sender, `be-analytics.md` `notification-sender`).
  - `data.expiresAt` (ISO) → **schedule/expiry** window (a future-dated
    effective time is honored server-side; the UI presents it as "Schedule" /
    "Expires").
  - `data.status: 'archived'` → **archive** (stop showing to students; record
    kept).
  - `delete: true` → soft-delete a draft.
- `targetRoles` / `targetClassIds` carry the audience. `scope` is fixed to
  `'tenant'` for this screen; `tenantId` is **never** in the body (derived from
  `ctx.activeTenantId` server-side — `common-api.md §4.4`).

Maps to `common-api.md §3.3` identity module (`v1.identity.saveAnnouncement`,
`v1.identity.listAnnouncements`) and to the `webapps-design.md §5.1` teacher row
(announcements share the identity callable used by admin-web/super-admin — one
announcement system, `webapps-design.md` inconsistency-free).

> **Status vocabulary note.** The canonical `Announcement` model
> (`shared-types/notification/announcement.ts`) is
> `status: draft | published | archived` with `publishedAt` / `expiresAt`. This
> spec uses **Draft / Scheduled / Sent / Archived** as _display_ labels mapped
> onto that model: **Draft** = `draft`; **Scheduled** = `draft`/`published` with
> a future `expiresAt`/effective time pending; **Sent** = `published` (with
> `publishedAt`); **Archived** = `archived`. "Pin" is expressed as a `pinned`
> flag on the announcement (proposed addition — see §4). The UI never invents
> new wire states; it only relabels for staff clarity.

---

## 3. Layout (wireframe-as-text)

Rendered inside `PlatformLayout` → `AppShell` (sidebar + topbar). This screen
owns the main content column only; gutters follow foundation page-gutter tokens
(mobile 16 / tablet 24 / desktop 32), max content width 1200, with the composer
body field respecting the 60–72ch reading measure.

Two regions: a **Composer** (left/top) and a **Sent & drafts** list
(right/bottom). On `lg` they sit side-by-side as a 2-column split; below `md`
they stack (composer first).

```
AppShell ── Sidebar (People ▸ Announcements active) ── Topbar (tenant switcher · ⌘K · bell · profile)
└── Main (PageTransition, RouteAnnouncer)
    ┌──────────────────────────────────────────────────────────────────────────────────┐
    │ Breadcrumb:  People  ›  Announcements                                              │  AppBreadcrumb
    ├──────────────────────────────────────────────────────────────────────────────────┤
    │ H1  Announcements                          Fraunces 2xl                            │
    │     Compose a message for your classes and review what you've sent.   text.secondary│
    ├───────────────────────────────────┬──────────────────────────────────────────────┤
    │ COMPOSER  (Panel, e1, radius lg)  │  SENT & DRAFTS  (Panel)                       │
    │ ┌───────────────────────────────┐ │  Tabs:  All | Drafts | Scheduled | Sent       │  Tabs
    │ │ Audience                      │ │  [ Search title ]                  [ status ▾]│  DataTable toolbar
    │ │  ( ) My classes   (•) Select  │ │  ┌────────────────────────────────────────┐  │
    │ │  [ ClassMultiSelect ▾ ]       │ │  │ Title | Audience | Status | Sent | Read │  │  DataTable
    │ │   chips: Grade 10A ✕  9B ✕    │ │  │ Exam Friday | 2 classes | Sent | Jun 18 │  │   (sort/filter/
    │ │  Audience size: 58 students   │ │  │              | 41 / 58 read    [⋯]      │  │    paginate)
    │ ├───────────────────────────────┤ │  │ HW reminder | Grade 10A | Draft | —     │  │  Badge (status)
    │ │ Title                         │ │  │              | —              [⋯]       │  │  read-count chip
    │ │  [ Input ............... 0/120]│ │  │ Holiday note| All classes| Scheduled    │  │
    │ ├───────────────────────────────┤ │  │              | Jun 22 09:00   [⋯]       │  │
    │ │ Message            [Write|Pre.]│ │  └────────────────────────────────────────┘  │  Tabs(editor/preview)
    │ │  ┌───────────────────────────┐│ │  Pagination                                    │
    │ │  │ RichTextEditor (Markdown) ││ │                                                │
    │ │  │  B I • code  $math$  link ││ │  Row ⋯ menu: View · Edit (draft) · Duplicate · │  DropdownMenu
    │ │  └───────────────────────────┘│ │            Archive · Delete (draft)            │
    │ │  Preview → ContentRenderer    │ │                                                │
    │ ├───────────────────────────────┤ │  (Selecting a row opens a read-only Drawer:    │  Drawer/Sheet
    │ │ Options                       │ │   full rendered body, audience, read list,     │
    │ │  [ ] Pin to top               │ │   timeline draft→scheduled→sent)               │
    │ │  Schedule:  ( ) Send now      │ │                                                │
    │ │             ( ) Later [Date▾] │ │                                                │
    │ │  Expires (optional) [Date▾]   │ │                                                │
    │ ├───────────────────────────────┤ │                                                │
    │ │ [Save draft]  [ Send ▸ ] spark│ │                                                │
    │ └───────────────────────────────┘ │                                                │
    └───────────────────────────────────┴──────────────────────────────────────────────┘
```

**Responsive behavior:**

- **`lg` (≥1024):** 2-column split — Composer (sticky, ~480–560px) left, **Sent
  & drafts** list (DataTable, flexible) right. Audience size and Send button
  always visible without scrolling the list.
- **`md` (768–1023):** single column, **Composer first**, then the list. The
  list `DataTable` keeps Title / Status / Sent / Read; Audience collapses into
  the row-expand or a secondary line. Composer Write/Preview stays a `Tabs`
  toggle.
- **`sm` (<768):** single column. Composer fields full-width; ClassMultiSelect
  becomes a full-width sheet picker. **List `DataTable` → stacked cards**
  (Title, status `Badge`, audience summary, read count, sent date; row `⋯`
  actions in a sheet). The Send / Save-draft buttons pin to a sticky bottom
  action bar (≥44px). Sidebar → `MobileBottomNav`. Write/Preview tabs persist.

---

## 4. Components used

All from FOUNDATION §5 / the `shared-ui` inventory (`webapps-design.md §2.2`),
with **one proposed addition** noted below.

| Region             | Component(s)                                                                                     | Notes                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Breadcrumb         | `AppBreadcrumb` / `Breadcrumb`                                                                   | `People › Announcements`; derived.                                           |
| Page header        | `Section` + Fraunces 2xl title + `text.secondary` subtitle                                       | No card; band only.                                                          |
| Composer container | `Panel` / `Card` (radius `lg`, `e1`)                                                             | Sticky on `lg`.                                                              |
| Audience mode      | `Radio` group ("My classes" / "Select classes")                                                  | `tenantAdmin` also gets a "Roles" option (see below).                        |
| Class audience     | `EntityPicker` / `ClassMultiSelect` (`@levelup/shared-ui/data`) + `Chip/Tag`                     | Options = managed classes only (`teacher`) / all (`admin`). Removable chips. |
| Audience size      | `Stat` inline + mono numeric (`Spline Sans Mono`)                                                | Server-resolved count; "58 students".                                        |
| Title              | `Input` (with `0/120` counter, `FormFieldError`)                                                 | RHF + `zodResolver` over the `saveAnnouncement` request schema.              |
| Message body       | `RichTextEditor` (`@levelup/shared-ui/editor`) emitting **canonical Markdown**                   | Single content representation.                                               |
| Preview            | `ContentRenderer` (`@levelup/shared-ui/markdown`) inside a Write/Preview `Tabs`                  | Same renderer students see — WYSIWYG fidelity.                               |
| Options            | `Checkbox` (Pin), `Radio` (Send now / Later), `DatePicker` (schedule, expires)                   | Schedule/expiry → `data.expiresAt` / effective time.                         |
| Actions            | `Button` (secondary "Save draft"); `Button` **spark** "Send"                                     | Spark is the one CTA accent (foundation §2.2).                               |
| Send confirm       | `ConfirmDialog`                                                                                  | Shows audience size before sending (§6).                                     |
| List container     | `Panel` + `Tabs` (All/Drafts/Scheduled/Sent)                                                     | Status filter.                                                               |
| List               | `DataTable` (`@levelup/shared-ui/data`) with `useDataTable` headless core                        | Owns search/sort/filter/select/paginate.                                     |
| Status cell        | `Badge` (status variant)                                                                         | Draft / Scheduled / Sent / Archived — icon + label, never color-only.        |
| Read count cell    | `Chip/Tag` + mono `41 / 58` (+ optional `ProgressBar`)                                           | Server-computed from `readBy` vs audience.                                   |
| Audience cell      | `Chip/Tag` group ("2 classes" / "Grade 10A")                                                     | Names via `useTenantNames`.                                                  |
| Row actions        | `DropdownMenu` (View · Edit · Duplicate · Archive · Delete)                                      | Edit/Delete only for drafts.                                                 |
| Detail view        | `Drawer/Sheet` + `ContentRenderer` + `Timeline` (draft→scheduled→sent) + read roster             | Read-only.                                                                   |
| States             | `Skeleton`, `EmptyState`, `ErrorState`, `InlineAlert/Banner`, `Toast` (sonner), `LoadingOverlay` | See §5.                                                                      |

**Proposed addition (justified):** a **`pinned: boolean`** field on the
announcement contract (`SaveAnnouncementRequest.data.pinned?`) surfaced as the
"Pin to top" `Checkbox`. The current wire type (`callable-types.ts`) does not
carry it; the screen brief requires an optional pin. This is a **contract
addition**, not a new UI component (it composes from `Checkbox` + `Badge`). If
the team declines the contract change, the Pin control is feature-flagged off
and the canonical status model is unaffected. No other new components are needed
— `RichTextEditor`, `ContentRenderer`, `EntityPicker`/`ClassMultiSelect`,
`DataTable`, `Badge`, `ConfirmDialog`, spark `Button` all exist in the
inventory.

---

## 5. States

**Loading (skeleton):**

- **Composer:** field-shaped `Skeleton`s for Audience, Title, body editor, and
  Options; Save/Send disabled. The class options load with the composer; until
  they resolve, the audience picker shows a small inline spinner and Send stays
  disabled (can't send to an unresolved audience).
- **List:** `DataTable` skeleton — 6–8 `Skeleton` rows matching columns; toolbar
  present but search/filter disabled. The list and composer load from
  independent queries, so the **composer is usable before the list resolves**
  (partial is normal).

**Empty:**

- **No announcements yet:** list `EmptyState` — title "No announcements yet",
  body "Anything you send to your classes will appear here, with read counts.",
  and a subtle pointer to the composer (no separate CTA; the composer is already
  on-screen).
- **A status tab is empty** (e.g. Scheduled): inline `EmptyState` "Nothing
  scheduled." within that tab.
- **No managed classes** (`teacher` with zero classes): composer audience shows
  `EmptyState` "You don't manage any classes yet. Announcements are sent to your
  classes." and Send is disabled.

**Error:**

- **List read fails:** full-region `ErrorState` (distinct from empty —
  `common-api.md §6.3`), "Couldn't load announcements." + "Retry". Composer
  stays usable.
- **Audience/class options fail to load:** `InlineAlert` in the composer
  "Couldn't load your classes — try again before sending." with Retry; Send
  disabled until resolved.
- **Send/save fails:** `Toast` (error) with copy from `ERROR_MESSAGES` keyed on
  `error.details.code`; the optimistic row rolls back; the composer retains its
  content (never lost on failure). A `RATE_LIMITED` code maps to "You're sending
  too quickly — try again in a moment." (the identity write tier is
  rate-limited, `common-api.md §9`).

**Partial:** list rows present but read counts pending → read cell shows mono
"—" (not "0", which would be a false claim of zero reads). Audience chips
resolve lazily — show "{n} classes" until names arrive.

**Success:** composer cleared (or returned to a fresh draft) after Send; the new
announcement appears at the top of the list (optimistic insert, reconciled by
the server `id`); `Toast` confirms ("Sent to 58 students" / "Draft saved" /
"Scheduled for Jun 22, 9:00 AM").

**Permission-gated variants (by role):**

- `teacher`: audience is **restricted to managed classes** — the "Roles"
  audience option is hidden; ClassMultiSelect lists only managed classes; the
  "My classes" mode resolves to exactly those. The list shows only announcements
  intersecting their managed classes. Gated additionally by `TeacherPermissions`
  (a teacher without a communications/announce permission sees the composer
  **read-only or absent** and the list read-only — controls hidden, not merely
  disabled).
- `tenantAdmin`: full tenant scope — all classes selectable, plus a
  `targetRoles` mode (e.g. "All teachers", "All students"). Can
  view/edit/archive any tenant announcement.
- **No platform scope** here regardless of role — platform-wide announcements
  are the super-admin surface (`scope: 'platform'` is never settable on this
  screen).

---

## 6. Interactions & motion

Motion uses foundation tokens only; `prefers-reduced-motion` removes transforms
and keeps opacity ≤ `fast`. No gamification chrome — this is a staff surface (no
XP/streak/marigold burst).

- **Page entry:** `PageTransition` fade/slide at `page` (420ms) `ease.entrance`.
- **Audience selection:** toggling "My classes" ↔ "Select classes" reveals/hides
  `ClassMultiSelect` at `fast` (160ms). Adding/removing a class chip recomputes
  **Audience size** with a brief mono count tick (no celebration). Audience size
  is **server-resolved** (the callable returns the resolved student count for
  the chosen classes/roles) — the client does not sum enrollments itself, so
  de-duplication across overlapping classes is correct.
- **Write ↔ Preview:** `Tabs` cross-fade at `fast`; Preview renders the live
  Markdown via `ContentRenderer`, identical to the student view.
- **Save draft:** `saveAnnouncement` with `status: 'draft'`. Optimistic: the
  draft appears (or updates) at the top of the **Drafts** tab with a pending
  shimmer; `Toast` "Draft saved". No confirm (drafts are private and
  reversible).
- **Send (the guarded flow):** clicking spark **Send** opens a `ConfirmDialog`
  that **states the audience size before sending** — "Send "{title}" to **58
  students** across 2 classes? They'll be notified immediately." Because it is
  outward-facing and irreversible-ish (notifications fan out), confirm is
  **mandatory** and the default focus is on Cancel; the user must explicitly
  move to Confirm. On confirm: `saveAnnouncement` with `status: 'published'`.
  **Optimistic insert** — the row appears at the top of **Sent** with a pending
  shimmer and "Sending…" status; on the callable's success it reconciles to the
  server `id` + `publishedAt` and a `Toast` confirms "Sent to 58 students". On
  failure the optimistic row rolls out and the composer keeps its content.
- **Schedule (Send later):** choosing "Later" + a future `DatePicker` value
  changes the Send confirm copy to "Schedule "{title}" for **Jun 22, 9:00 AM**
  to 58 students?" and the row lands in **Scheduled**. Server honors the
  effective time; the client does not run timers.
- **Edit a draft / scheduled:** row `⋯` → Edit loads it back into the composer
  (composer scrolls into view on `sm`). Saving updates in place.
- **Archive:** row `⋯` → Archive → `ConfirmDialog` ("Archive this announcement?
  Students will no longer see it; the record is kept."). `saveAnnouncement`
  `status: 'archived'`. Optimistic move out of active tabs.
- **Delete (drafts only):** `ConfirmDialog` (danger) → `saveAnnouncement`
  `delete: true`. Optimistic removal + rollback on error.
- **Open detail:** clicking a row opens a read-only `Drawer` with the fully
  rendered body (`ContentRenderer`), the resolved audience, the read roster (who
  has / hasn't read), and a `Timeline` (created → scheduled → sent → archived).
  Drawer enters at `base` (220ms) `ease.standard`, `e3`.
- **Pin:** the "Pin to top" `Checkbox` sets `pinned`; pinned sent items sort
  first in the list and carry a `Badge` "Pinned".
- **Row hover/press:** surface lift to `e2` at `fast`; the `⋯` menu
  `stopPropagation`s so it never opens the detail Drawer.

---

## 7. Content & copy

**Header**

- H1: `Announcements`.
- Subtitle: `Compose a message for your classes and review what you've sent.`

**Composer**

- Section labels: `Audience` · `Title` · `Message` · `Options`.
- Audience modes: `My classes` · `Select classes` (admin also `Roles`).
- ClassMultiSelect placeholder: `Choose classes…`.
- Audience size line: `Audience: {n} students` (and `· {m} classes` when
  applicable). Zero-audience: `No recipients — choose at least one class.`
- Title `Input` placeholder:
  `Subject line (e.g. "Friday's exam moved to room 204")`; counter `{n}/120`.
- Message editor toolbar uses standard `RichTextEditor` affordances (bold,
  italic, list, code, math `$…$`, link). Empty-body helper:
  `Write your message. Students see it formatted exactly as the preview.`
- Write/Preview tabs: `Write` · `Preview`.
- Options: `Pin to top` · schedule `Send now` / `Send later` (with
  `Choose date & time`) · `Expires (optional)`.
- Buttons: secondary `Save draft` · spark `Send`.

**Send confirm (ConfirmDialog)**

- Title: `Send this announcement?`
- Body (immediate):
  `Send "{title}" to {n} students across {m} class(es)? They'll be notified right away.`
- Body (scheduled):
  `Schedule "{title}" for {date, time}? {n} students across {m} class(es) will be notified then.`
- Confirm: `Send now` / `Schedule` · Cancel: `Keep editing`.

**Archive / Delete confirms**

- Archive title: `Archive announcement?` · body:
  `"{title}" will no longer be shown to students. The record and read counts are kept.`
  · `Archive` / `Cancel`.
- Delete (draft) title: `Delete draft?` · body:
  `"{title}" will be permanently removed. This can't be undone.` · `Delete`
  (danger) / `Cancel`.

**List**

- Tabs: `All` · `Drafts` · `Scheduled` · `Sent`.
- Toolbar: search placeholder `Search by title`; status filter `All statuses`.
- Columns: `Title` · `Audience` · `Status` · `Sent` (or `Scheduled` / `—`) ·
  `Read` · (actions).
- Status `Badge` labels: `Draft` · `Scheduled` · `Sent` · `Archived` (+ `Pinned`
  badge when pinned).
- Read cell: `{read} / {audience} read` (mono). Pending: `—`.
- Row `⋯`: `View` · `Edit` (drafts/scheduled) · `Duplicate` · `Archive` ·
  `Delete` (drafts).
- Empty (list): title `No announcements yet`; body
  `Anything you send to your classes will appear here, with read counts.`
- Empty (tab): `Nothing here yet.`

**Detail drawer**

- Header: title + status `Badge` + sent/scheduled date.
- Sections: `Message` (rendered) · `Audience` (`{n} students · {classes}`) ·
  `Read by` (`{read} of {audience}`) · `Timeline`.

**Errors (staff tone, direct):**

- List load: `Couldn't load announcements. Retry.`
- Classes load: `Couldn't load your classes — try again before sending.`
- Send failure:
  `Couldn't send the announcement. Your message is still here — try again.`
- Rate limited: `You're sending too quickly — try again in a moment.`
- Permission:
  `You don't have permission to send announcements. Contact your administrator.`

---

## 8. Domain rules surfaced

- **Tenant isolation:** every read/write is scoped to the caller's active
  tenant; `tenantId` is derived from claims server-side and is **never** a form
  field or visible value (`common-api.md §4.4`). Cross-tenant classes/recipients
  never appear; `scope` is fixed to `'tenant'`.
- **Teacher audience scope:** a `teacher` can only target classes in their claim
  `classIds` / `managedClassIds`, with the 15-class **`classIdsOverflow`**
  Firestore fallback resolved server-side (`auth-access.md §1.3`). The
  ClassMultiSelect lists only managed classes, and the list view is
  server-projected to announcements intersecting those classes — the UI trusts
  the server scope and never re-derives access from local membership.
  `tenantAdmin` may target any class or role.
- **Reads = repositories, writes = callables:** no direct client Firestore
  writes. The list comes from `v1.identity.listAnnouncements`; every
  create/edit/send/schedule/archive/delete is `v1.identity.saveAnnouncement`.
  There is **one** announcement system shared with admin-web/super-admin
  (`webapps-design.md §5.x`) — no per-app copy.
- **Server-authoritative audience size & notification fan-out:** the audience
  count returned for the chosen classes/roles is computed server-side (correct
  de-duplication across overlapping classes); the client never sums enrollments.
  Publishing fans out notifications via the server notification sender
  (`be-analytics.md` `notification-sender`) — the UI does not write notification
  docs.
- **Server-authoritative read counts:** read state is the server's `readBy` set
  projected against the resolved audience; the client renders
  `{read}/{audience}` read-only and never recomputes it. Absence of a count is
  shown as "—", not "0".
- **One canonical content representation:** the body is **Markdown** (GFM +
  `$…$`/`$$…$$`), authored by `RichTextEditor` and rendered by the single
  `ContentRenderer` for preview, the list/detail, and the student-facing view
  (`webapps-design.md §2.3`). No TipTap-HTML; no `preprocessMath` heuristic at
  runtime.
- **Outward-facing send is guarded:** sending always requires a `ConfirmDialog`
  that states the audience size first; sending is not a single-click action.
  Scheduling defers the effective time to the server (no client timers).
- **Status state machine:** transitions follow the canonical `Announcement`
  model (`draft → published`, `published → archived`, soft-delete on drafts) via
  `saveAnnouncement`; the UI relabels (Draft/Scheduled/Sent/Archived) but never
  invents wire states (`common-api.md §3.1` `ALLOWED_TRANSITIONS`).
- **No authoring, grading, or answer keys:** this screen never touches space
  content, submissions, or answer keys; it only sends operational messages.

---

## 9. Accessibility

- **Focus order:** Breadcrumb → H1 (skipped from tab order) → Composer: Audience
  mode `Radio`s → ClassMultiSelect → Title → Message editor → Options → Save
  draft → Send. Then the list: Tabs → Search → status filter → `DataTable`
  (header sort buttons, then rows) → Pagination. The `ConfirmDialog` and detail
  `Drawer` trap focus and restore it to the triggering control on close.
- **Keyboard:**
  - Radio group: arrow keys move selection.
  - `ClassMultiSelect`: combobox semantics — type to filter, arrows to move,
    Enter to add, Backspace to remove the last chip; each chip's remove is a
    focusable control with an `aria-label` ("Remove Grade 10A").
  - `RichTextEditor`: standard rich-text keyboard map; `Cmd/Ctrl+Enter` triggers
    the primary action (Save draft) without sending; **Send is never bound to a
    single keystroke** (outward-facing).
  - Write/Preview `Tabs`: Left/Right between, Enter/Space activate.
  - `ConfirmDialog`: Esc cancels; default focus on **Cancel** (the
    destructive/outward action requires explicit focus on Send/Confirm). Enter
    does **not** auto-send.
  - `DataTable`: sortable headers are buttons announcing `aria-sort`; rows are
    reachable and Enter opens the detail Drawer; `⋯` menu opens with
    Enter/Space, arrow-navigable.
- **ARIA / semantics:** the list is a real `<table>` with `<th scope="col">`;
  status `Badge`s and the audience/read chips include text (never color-only).
  The audience size is announced via an `aria-live="polite"` region so
  screen-reader users hear the count update as classes change. Icon-only
  controls (chip remove, `⋯`) have `aria-label`s. `RouteAnnouncer` announces
  "Announcements" on navigation.
- **Contrast:** all text/background pairs meet WCAG AA via semantic tokens
  (`text.primary`/`text.secondary` on `bg.surface`/`bg.canvas`); status badges
  pair icon + label so meaning never relies on
  `status.success`/`status.warning`/`status.error` hue alone. The spark `Send`
  button meets contrast for `text.on-accent` on `spark`.
- **Reduced motion:** `prefers-reduced-motion` disables row-lift transforms,
  tab/preview slides, and Drawer/Dialog scale — opacity-only at `fast`. No
  gamification motion exists to suppress.
- **Touch targets:** ≥44px for Send, Save draft, tab triggers, row `⋯`, chip
  removes, and pagination on `sm`.

---

## 10. Web↔mobile divergence (RN parity)

Component **names/props match 1:1** between `shared-ui` (web) and `ui-native`
(mobile); the headless cores (`useDataTable`, the `saveAnnouncement` mutation
hook, the audience-resolution query over `@levelup/api-client`) are reused
verbatim — only renderers differ.

- **Layout:** web 2-column split → RN single stacked scroll (Composer then
  list), or a two-tab "Compose / Sent" segmented control.
- **List:** web `DataTable` → RN **stacked cards** (Title, status `Badge`,
  audience summary, read count, date; `⋯` → action sheet). Search/filter become
  a filter sheet rather than column headers.
- **Audience picker:** web `ClassMultiSelect` dropdown → RN full-screen
  multi-select sheet; same options and server-resolved count.
- **RichTextEditor / ContentRenderer:** the editor maps to the RN rich-text
  input; `ContentRenderer` renders the same Markdown natively — one content
  format across platforms (no HTML).
- **Send confirm:** web `ConfirmDialog` → RN bottom-sheet confirm; **still shows
  audience size and still requires explicit confirm**.
- **Detail:** web `Drawer` → RN bottom-sheet / pushed screen with the same
  rendered body, audience, read roster, and timeline.
- **Hover → press:** row hover-lift and prefetch-on-hover have no RN analog
  (press feedback; navigate-then-load with skeletons).
- **No ⌘K:** CommandPalette is web-only; RN uses native navigation.
  `Cmd/Ctrl+Enter` save shortcut is web-only.
- **Data parity:** identical reads/writes via the same callable registry, so an
  RN teacher build shows the same scope-gated audience, server-authoritative
  counts, and one announcement system with no extra logic.

---

## 11. Claude-design prompt

```
You are generating the "Announcements — Compose & Manage" screen for the Auto-LevelUp
TEACHER operational web portal. Conform EXACTLY to the Lyceum design system in
docs/rebuild-spec/design/00-FOUNDATION.md and this spec
(docs/rebuild-spec/design/teacher/announcements-compose.md). Do NOT invent tokens, fonts,
colors, spacing, radii, or component variants — compose only from FOUNDATION §2–§5,
citing semantic token names (bg.canvas, bg.surface, text.primary, text.secondary,
brand.primary, status.success/warning/error, spark, e1/e2/e3, radius md/lg/pill, motion
instant/fast/base/page, ease.standard/ease.entrance). Fonts: Fraunces (display/headings),
Schibsted Grotesk (UI/body/tables/labels), Spline Sans Mono (audience size, read counts,
dates). Warm paper neutrals + deep indigo primary; the marigold "spark" accent is used on
the single "Send" CTA only — everything else is precise, credible, calm staff chrome (no
XP/streak/celebration).

Route: /announcements. Render inside PlatformLayout/AppShell (sidebar People▸Announcements
active, topbar with tenant switcher/⌘K/bell/profile). Two regions in a 2-column split on lg
(stacked, composer first, below md):

COMPOSER (Panel, e1, radius lg, sticky on lg):
- Audience: Radio "My classes" / "Select classes" (tenantAdmin also "Roles"); an
  EntityPicker/ClassMultiSelect (managed classes only for teacher, all for admin) with
  removable Chips; a server-resolved "Audience: {n} students · {m} classes" line in mono
  (aria-live polite).
- Title: Input with 0/120 counter (RHF + zodResolver over the saveAnnouncement schema).
- Message: RichTextEditor emitting CANONICAL MARKDOWN, with a Write/Preview Tabs toggle;
  Preview renders via the single ContentRenderer (identical to the student view) — one
  content format, no TipTap-HTML, no preprocessMath.
- Options: "Pin to top" Checkbox; schedule Radio "Send now"/"Send later" (DatePicker);
  optional "Expires" DatePicker.
- Actions: secondary "Save draft" + spark "Send".

SENT & DRAFTS LIST (Panel):
- Tabs: All / Drafts / Scheduled / Sent. Toolbar: search "Search by title" + status filter.
- DataTable (@levelup/shared-ui/data, headless useDataTable): columns Title, Audience
  (Chips via useTenantNames), Status (Badge: Draft/Scheduled/Sent/Archived + Pinned, icon+
  label, never color-only), Sent/Scheduled date (mono), Read ("{read}/{audience}" mono, "—"
  when pending), and a ⋯ DropdownMenu (View · Edit[drafts] · Duplicate · Archive · Delete
  [drafts]). Row click → read-only Drawer with rendered body (ContentRenderer), audience,
  read roster, and a draft→scheduled→sent Timeline. Pagination.

SEND FLOW (guarded, outward-facing): clicking spark "Send" opens a ConfirmDialog that
STATES THE AUDIENCE SIZE FIRST — 'Send "{title}" to {n} students across {m} class(es)?
They'll be notified right away.' (scheduled variant names the date). Default focus on
Cancel; sending is never a single keystroke. On confirm → saveAnnouncement status:
'published' with OPTIMISTIC insert at the top of Sent (pending shimmer → reconcile to
server id/publishedAt) + Toast "Sent to {n} students"; on failure roll the row back and
keep the composer content. Save draft = saveAnnouncement status:'draft' (no confirm,
optimistic, Toast "Draft saved"). Archive/Delete via ConfirmDialog.

STATES: skeletons per region (composer usable before list resolves); distinct EmptyState
("No announcements yet — Anything you send to your classes will appear here, with read
counts.") vs ErrorState ("Couldn't load announcements. Retry."); composer empty-class
state; partial = read counts "—" not "0". Permission-gated: teacher limited to managed
classes (no Roles option, no platform scope), a teacher without announce permission sees
composer/controls read-only or hidden; tenantAdmin gets all classes + Roles; platform
scope is never available here.

DOMAIN RULES (must hold): tenantId derived from claims server-side — never a field or
visible value; scope fixed to 'tenant'; teachers target only managed classes (classIds/
managedClassIds claim, 15-class overflow fallback) — trust server scope, don't re-derive;
reads are repositories (listAnnouncements), writes are callables (v1.identity.saveAnnouncement)
— no direct client Firestore writes; audience size and read counts are server-authoritative
(client never sums enrollments or recomputes readBy); ONE canonical Markdown body rendered
by one ContentRenderer for preview + student view; status transitions follow the canonical
draft→published→archived model (UI relabels to Draft/Scheduled/Sent/Archived but invents no
wire states); no authoring/grading/answer-keys on this screen.

MOTION: PageTransition (page); audience reveal + Write/Preview cross-fade (fast); row
hover-lift to e2 (fast); Drawer/Dialog at e3 (base, ease.standard); honor prefers-reduced-
motion (opacity-only, no transforms; no gamification celebration anywhere).

A11Y: roving-tabindex Tabs; combobox ClassMultiSelect with labelled removable chips;
aria-live audience count; real <table> with scope="col"; sortable header buttons announce
aria-sort; Badge/chips never color-only; icon buttons have aria-labels; ConfirmDialog
default-focuses Cancel and Enter does not auto-send; focus trap + restore in Dialog/Drawer;
RouteAnnouncer on nav; ≥44px touch targets; WCAG AA contrast via semantic tokens
(text.on-accent on spark for Send).

RESPONSIVE: lg = 2-column split (sticky composer + DataTable list); md = single column,
composer first, list keeps Title/Status/Sent/Read; sm = list becomes stacked cards,
ClassMultiSelect becomes a sheet, Send/Save pin to a sticky bottom bar, sidebar →
MobileBottomNav. Keep component names/props 1:1 with a future RN (ui-native) build.

Output a single React + Tailwind screen composed from shared-ui components, with the exact
headings, labels, empty-state, and error copy from §7 of this spec.
```
