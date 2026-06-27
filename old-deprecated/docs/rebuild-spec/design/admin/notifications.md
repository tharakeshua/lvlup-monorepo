# Notifications Inbox — Tenant-Admin Screen Spec

> **Area:** admin (tenant / academy admin portal, `apps/admin-web`) · **Route:**
> `/notifications` · **Role:** `tenantAdmin` Conforms to the **Lyceum**
> foundation (`docs/rebuild-spec/design/00-FOUNDATION.md`). All tokens cited by
> semantic name; no new colors/fonts/spacing/radii/shadows/motion invented
> except where explicitly flagged as a **proposed foundation addition**.
> Register: **serious / precision** (admin tooling), not the playful student
> register. Restraint in chrome; no celebratory motion.

---

## 1. Purpose & primary user

**Primary user:** Tenant administrator (academy / school admin) of **one**
tenant. Authenticated via the existing model: `firebaseUser` present **and**
`currentMembership.role === "tenantAdmin"` **and**
`currentMembership.tenantId === currentTenantId` (status report §1,
`RequireAuth.tsx`, allowedRoles `["tenantAdmin"]`). Scoped to a single tenant
context at a time (one tenant per JWT, auth-access §1.4).

**Job-to-be-done:** "As the admin of my academy, I need a single place to
**read, triage, and clear** the operational notifications addressed to me —
bulk-import completions, AI-budget alerts, at-risk-student flags, grading
completions, exam-result releases, space publishes, deadline reminders, and
system announcements — so nothing actionable falls through the cracks, and so I
can jump straight to the relevant record (a class, an exam, a student) from each
notice."

**Receiving, not sending.** This screen is the admin's **inbox** — it _receives_
notifications written server-side into
`/tenants/{tenantId}/notifications/{notificationId}` (notification.ts;
auth-access §2 "Recipient read; CF create"). It is **distinct from
Announcements** (`/announcements`, the _sending_ surface where an admin composes
outbound notices). Announcements are a different screen; this one never composes
or broadcasts. The only relationship: a `system_announcement`-type notification
may _land here_ as a received item.

**Relationship to the NotificationBell.** The Topbar `NotificationBell` (live
via `useUnreadCount` RTDB badge + a short `useNotifications` preview list) is
the _peek_; this page is the _full inbox_. The bell's "View all notifications"
action routes here (status report §1.2;
`NotificationBell.onViewAll → navigate('/notifications')`).

---

## 2. Entry points & route

**Route:** `/notifications` (lazy-loaded, wrapped by `RequireAuth` →
`AppLayout`; status report §1.2, App.tsx routes). Page file:
`apps/admin-web/src/pages/NotificationsPage.tsx` rendering the shared
`NotificationsPage` UI from `@levelup/shared-ui`.

**Entry points:**

- **Topbar `NotificationBell`** → "View all notifications" (the primary path;
  `onViewAll`).
- **Sidebar nav** — the inbox is reachable from the shell (status report §1.2
  lists `/notifications` among admin routes). Place it in the Topbar
  profile/bell cluster as the canonical entry; a Sidebar link is
  optional/secondary.
- **Direct URL / breadcrumb** (`Notifications`).
- **⌘K CommandPalette** → "Go to notifications" / "Mark all as read" (web only,
  foundation §6).
- **Deep link from a notification's `actionUrl`** — clicking a row navigates
  onward (e.g. `/classes/:id`, `/exams`, `/ai-usage`), so re-entry from those
  screens is common.

**Common-API reads/writes** (per `specs/common-api.md` §3.3 — `identity`
module). Today's live hooks call stringly-typed callables (`getNotifications`,
`markNotificationRead`) and an RTDB read; the rebuild folds these into the
single combined-mode `manageNotifications` callable
(`action: 'list' | 'markRead'`, kept as a discriminated combined-mode endpoint
per §3.1/§8) behind `api-client`:

| Action                | Hook (today → rebuild)                                                                                                  | Registry name                                           | Notes                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List notifications    | `useNotifications(tenantId, uid, { unreadOnly, limit })` → `api.identity.manageNotifications({ action:'list', ... })`   | `v1.identity.manageNotifications` (`action:'list'`)     | `tenantId` **derived server-side** from `ctx.activeTenantId` (§4.4) — dropped from the request body; recipient derived from `ctx.uid`. Filter `unreadOnly`. Paginated via the unified **PageRequest/pageResponse** fragment (§7): `{ cursor, limit }` → `{ items, nextCursor, total? }` (replaces today's `{ hasMore, lastId }`). `rateTier: read`. `staleTime ~30s`. |
| Mark one read         | `useMarkRead({ tenantId, notificationId })` → `api.identity.manageNotifications({ action:'markRead', notificationId })` | `v1.identity.manageNotifications` (`action:'markRead'`) | Single id. Server stamps `readAt`, flips `isRead:true`. `rateTier: write`. Invalidates the narrowest key (`notificationKeys.list(...)`) — fixes the current coarse `["tenants", tenantId, "notifications"]` invalidation.                                                                                                                                             |
| Mark all read         | `useMarkAllRead({ tenantId })` → `api.identity.manageNotifications({ action:'markRead' })` (no id)                      | `v1.identity.manageNotifications` (`action:'markRead'`) | Omitting `notificationId` = mark-all-for-caller (mirrors today: both `useMarkRead`/`useMarkAllRead` hit the same `markNotificationRead` callable, distinguished by presence of `notificationId`). Returns `{ markedCount }`.                                                                                                                                          |
| Unread badge (Topbar) | `useUnreadCount(tenantId, uid)` (RTDB `notifications/{tenantId}/{uid}/unreadCount`)                                     | _realtime-contract_ (§10)                               | Real-time count for the bell; **parallel realtime concern** (`common-api.md §10`), not a callable. The inbox page itself does not need the badge, but the bell that links here does.                                                                                                                                                                                  |

**Response item shape** (from `Notification`, notification.ts):
`{ id, tenantId, recipientId, recipientRole:'tenantAdmin', type, title, body, entityType?, entityId?, actionUrl?, isRead, createdAt, readAt? }`.
Timestamps are `FirestoreTimestamp` → coerced by one shared `formatTimestamp`
util in the rebuild (today the UI casts `createdAt as unknown as string`, a
known fragility to fix).

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (§5 Navigation): persistent left **Sidebar**
(role-driven admin nav: Overview / Management / Analytics / Configuration) +
**Topbar** (tenant indicator, ⌘K search, `NotificationBell`, `RoleSwitcher`,
`ThemeToggle`, profile). This screen owns the main content region only. Admin is
desktop-first; max content width 1200, reading column ~720 for the list
(foundation §4). Page gutters: desktop 32 / tablet 24 / mobile 16. The inbox is
a **single-column reading list**, not a wide DataTable — content is text-dense
notices, so it favors the reading measure over tabular columns.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ TOPBAR  [Lyceum mark]  {Tenant name}        ⌘K   🔔³   ◐  ⟨avatar⟩         │
├────────────┬─────────────────────────────────────────────────────────────┤
│ SIDEBAR    │ MAIN (bg.canvas, gutter 32, content max ~720)                 │
│            │ ┌─ PageHeader ─────────────────────────────────────────────┐ │
│ Overview   │ │ Notifications                       [ Mark all as read ]  │ │
│ ▸ Dashboard│ │ Updates addressed to you in this academy.   (ghost/sec.)  │ │
│ Management │ └───────────────────────────────────────────────────────────┘ │
│  Users     │                                                                │
│  Classes   │  ┌ Tabs (filter) ──────────────────────────────────────────┐  │
│  Exams …   │  │  All        Unread ·3                                     │  │
│ Analytics  │  └───────────────────────────────────────────────────────────┘ │
│  …         │                                                                │
│ Config     │  ┌ Card (bg.surface, radius lg, e1) ───────────────────────┐  │
│  Settings  │  │  ── Today ───────────────────────────────────  (group)   │  │
│  Notif. ▸  │  │  ┌────────────────────────────────────────────────────┐  │  │
│            │  │  │[icon] AI budget alert            ● ·   Mark read   │  │  │
│            │  │  │ Tenant spend reached 80% of the monthly cap.       │  │  │
│            │  │  │ 12 min ago                      [Budget Alert]     │  │  │
│            │  │  └────────────────────────────────────────────────────┘  │  │
│            │  │  ┌────────────────────────────────────────────────────┐  │  │
│            │  │  │[icon] Bulk import complete             (read)       │  │  │
│            │  │  │ 248 students imported into Grade 9.                 │  │  │
│            │  │  │ 2 hours ago                  [Import Complete]      │  │  │
│            │  │  └────────────────────────────────────────────────────┘  │  │
│            │  │  ── Yesterday ───────────────────────────────  (group)   │  │
│            │  │  ┌────────────────────────────────────────────────────┐  │  │
│            │  │  │[icon] Student at risk             ●     Mark read   │  │  │
│            │  │  │ 3 students flagged in Class 10-B.                   │  │  │
│            │  │  │ Yesterday                      [At Risk Alert]     │  │  │
│            │  │  └────────────────────────────────────────────────────┘  │  │
│            │  │  ────────────────────────────────────────────────────    │  │
│            │  │              [ Load more ]   (cursor, ghost)              │  │
│            │  └───────────────────────────────────────────────────────────┘ │
└────────────┴─────────────────────────────────────────────────────────────┘
```

**Row anatomy** (one notification): a category **icon** (status-typed, not emoji
— see §4/§9), a **title** (Schibsted; weight 600 when unread, 500 when read), a
1–2 line **body** excerpt (`text.secondary`, `line-clamp-2`), a **relative
timestamp** (`text.muted`), a **type Chip** (e.g. "Budget Alert"), an **unread
dot** (`brand.primary`/`spark`, paired with the bold title + an `aria-label`),
and a **"Mark read"** ghost action that appears only when unread. Clicking the
row body navigates via `actionUrl` (and marks read).

**Date grouping.** Rows group under sticky **Today / Yesterday / Earlier**
sub-headers (matching `NotificationDropdown`'s `getDateGroup`), each header
`text.muted`, `bg.surface-sunken`, sticky within the Card scroll region.

**Grid & responsive** (foundation §4 breakpoints `sm 640 · md 768 · lg 1024`):

- **lg (≥1024, primary):** Sidebar pinned; PageHeader (title left, "Mark all as
  read" secondary/ghost button right); filter Tabs; single Card list at ~720
  reading width centered in the content region; "Mark read" actions inline-right
  per row.
- **md (768–1023):** Sidebar collapsible to icon rail; list spans available
  width; row keeps full anatomy; "Mark read" stays inline.
- **sm (<768, rare for admin):** Sidebar → mobile drawer + Tabbar (the
  bell/inbox lives in the Topbar, not the 4 primary Tabbar items); rows go
  full-bleed within the Card; the inline "Mark read" collapses behind the row
  (tap-to-open) or shows as a trailing IconButton (check) with
  `aria-label="Mark as read"`; tap target ≥44px. "Mark all as read" remains in
  the header. (See §10.)

"Mark all as read" is a **secondary/ghost** Button, not spark — the inbox has no
single hero CTA; this is restrained admin chrome.

---

## 4. Components used (foundation §5 only)

**Navigation:** AppShell, Sidebar, Topbar (hosts `NotificationBell`,
`RoleSwitcher`, profile), Breadcrumb, CommandPalette (⌘K, web only), Tabbar
(mobile).

**Containers:** Card (the list container, radius lg, e1, bg.surface), Tabs (All
/ Unread filter), Popover (mobile row-action menu / the `NotificationBell`
itself), Tooltip (timestamp absolute-time on hover; disabled-state reasons),
ScrollArea (the grouped list scroll region, mirroring live
`NotificationDropdown`).

**Primitives:** Button (`ghost` = "Mark all as read", per-row "Mark read", "Load
more", "Retry"; `secondary` acceptable for "Mark all as read"), IconButton
(mobile trailing "Mark as read" check).

**Data:** EmptyState (no notifications / no unread), Skeleton (loading rows),
Pagination (cursor "Load more"), Badge or Chip/Tag (the per-row **type label** —
e.g. "Budget Alert", "At Risk Alert", "Import Complete" — mapping
`NotificationType` → human label via the existing `typeLabels` map), Avatar (N/A
here; the leading slot is a category icon, not a person), Timeline (the
date-grouped list is conceptually a vertical Timeline; see proposal below).

**Feedback:** Toast (sonner — "Marked as read", "All caught up", error toasts),
InlineAlert/Banner (load error with Retry — **not** an empty state),
`QuotaWarningBanner` (shell-level, may sit above this page when quota is
breached; not owned by this screen).

**Domain components:** `AtRiskBadge` — reuse to render the `student_at_risk`
notification type's icon/label consistently with the analytics surfaces (status
report references at-risk detection; be-analytics). `InsightCard` patterns are
N/A (this is a list, not a card grid). `ContentRenderer` is **not** needed —
notification `body` is plain text, not markdown/KaTeX.

**Proposed foundation additions (flagged, no new tokens):**

1. **NotificationRow** — a named composite list-item (leading status icon +
   title + body excerpt + timestamp + type Badge + unread dot + trailing
   mark-read action). Built entirely from existing primitives (icon + text +
   Badge + Button) and tokens; flagged as a reusable domain component because
   the _same row_ renders in `NotificationDropdown` (bell), the admin inbox, and
   the future student/teacher/parent inboxes. Standardizing it kills the current
   divergence (the bell uses emoji icons + a 2-line layout; the page uses a
   `[10px]` type pill + a different layout). **No new tokens.**
2. **Notification type → semantic-status map** — a single shared mapping from
   `NotificationType` to `{ icon (lucide), label, statusTone }` so color/icon
   are consistent everywhere and never emoji-only. Suggested tones (all existing
   tokens): `ai_budget_alert` → `status.warning` (alert-triangle);
   `student_at_risk` → `status.error` (alert-octagon) + `AtRiskBadge`;
   `grading_complete`/`submission_graded`/`exam_results_released` →
   `status.success` (check-circle); `bulk_import_complete` → `status.info`
   (download); `deadline_reminder` → `status.warning` (clock);
   `space_published`/`new_space_assigned` → `status.info` (book-open);
   `new_exam_assigned` → `status.info` (file-text); `system_announcement` →
   `text.secondary`/`brand.primary` (megaphone). **No new tokens — maps onto
   existing status._ + text._ + brand.primary.**

(The current emoji icon set in `NotificationDropdown` is explicitly **rejected**
for the rebuild — emoji are not accessible, not theme-aware, and not in the
foundation. Replace with the lucide + semantic-tone map above.)

---

## 5. States

All loading/empty/error states use foundation skeleton/empty/alert patterns;
**never status-by-color-alone** (every type pairs icon + label + tone).

**Loading (skeleton).** First load / filter change: the Card renders **5
Skeleton rows** (a circular icon skeleton, two text lines of differing width for
title + body, a short timestamp skeleton, a pill skeleton for the type Badge).
PageHeader + Tabs render immediately (static). Today the live UI shows a single
centered spinner — the rebuild upgrades to row skeletons to avoid layout shift
and match the rest of admin.

**Empty.** Card body shows EmptyState centered (a check-circle or inbox icon in
a `bg.surface-sunken` circle, Fraunces title, Schibsted body):

- Filter = All: title **"No notifications yet"**, body _"You're all caught up.
  New updates about imports, budgets, and student activity will appear here."_
  (no CTA — there is nothing to create here; this is a receiving surface).
- Filter = Unread: title **"You're all caught up"**, body _"No unread
  notifications."_ with a `ghost` "View all" that switches to the All tab.
  (Mirrors live "All caught up!" affordance in `NotificationDropdown`.)

**Error.** React Query error → InlineAlert/Banner (variant `error`,
`status.error` + alert-triangle icon) above the list: **"Couldn't load
notifications."** with a `ghost` **Retry** button. Per `common-api.md §6.3`,
copy derives from `error.details.code` (`ERROR_MESSAGES`): `PERMISSION_DENIED` →
_"You don't have access to these notifications."_; `RATE_LIMITED` → _"Too many
requests — try again shortly."_; `TENANT_SUSPENDED` → _"This academy is
suspended."_ Errors render as a **banner, not the empty state** (fixes the
documented "errors render as empty states" anti-pattern, `common-api.md §6.3`).

**Partial.** A page loaded with `nextCursor` present → loaded rows + "Load more"
Pagination (cursor). A single row mid-`markRead` shows an inline busy state on
that row's "Mark read" button (spinner + `aria-busy`, disabled), other rows
interactive. "Mark all as read" in progress disables itself + shows a busy
state; the list optimistically flips all visible unread → read.

**Success.** Populated grouped list (Today / Yesterday / Earlier). Unread rows:
bold title (Schibsted 600), faint `brand.primary/5`-equivalent
**`bg.surface-sunken` tint** on the row, an unread dot (`brand.primary`, with
`aria-label="Unread"`), and a visible "Mark read" action. Read rows: medium
title (500), no tint, no dot, no inline action. Each row carries its type
Badge + relative timestamp.

**Permission-gated variations by role.**

- **tenantAdmin (only valid role for this app):** full read + mark-read +
  mark-all-read of **their own** notifications in **their** tenant.
- **Recipient scoping is absolute:** the list only ever returns notices where
  `recipientId == ctx.uid` and `recipientRole == 'tenantAdmin'` within
  `ctx.activeTenantId`. An admin never sees a teacher's, parent's, or student's
  notifications, nor another tenant's.
- **Any non-tenant-admin** reaching `/notifications`: blocked at `RequireAuth`
  (Access-Denied panel / redirect, status report §1) — the screen never renders.
  A stale token slipping through is denied server-side (`PERMISSION_DENIED` →
  error banner).

---

## 6. Interactions & motion (foundation §4 motion tokens)

**Motion budget — restrained admin register.** No celebratory/spark pops (those
are reserved for student gamification, foundation §4). Use
`instant`/`fast`/`base` with `ease.standard`. Respect `prefers-reduced-motion`.

**Open a notification (row click).** Clicking the row body: (1) if unread,
**optimistically** flips it to read — the unread dot fades out (`fast`), the
title de-emphasizes from 600→500, the row tint clears — and fires `markRead`;
(2) if the notification has an `actionUrl`, navigates there (e.g.
`/classes/:id`). This mirrors the live `onNotificationClick`
(mark-read-then-navigate). If `markRead` fails server-side, the row silently
reverts to unread (no blocking toast for a navigation-coupled read; a quiet
error toast only on hard failure).

**Mark one read (explicit button).** The row's "Mark read" ghost Button:
optimistic flip (dot fade `fast`, tint clear), inline busy state on the button,
then server confirm. Success → quiet (no toast needed for single; the visual
flip is the feedback) or a subtle `role="status"` announcement. Failure → row
reverts + error Toast (`ERROR_MESSAGES`).

**Mark all read.** Header "Mark all as read" ghost/secondary Button
(visible/enabled only when ≥1 unread): **optimistically** flips every visible
unread row → read (staggered dot fade is _not_ used — flip in place to keep it
calm), button shows busy, server confirms via `markRead` with no
`notificationId`. Toast **"All caught up."** with the `{ markedCount }`. On
failure, rows revert + error Toast. No ConfirmDialog — marking read is
non-destructive and reversible-in-spirit (re-reading is free), so a confirm
would be friction.

**Filter tabs.** Switching **All ⇄ Unread** refetches with `unreadOnly`
(matching live `onFilterChange`), content cross-fades `base`. Active tab uses
the `brand.primary` indicator. The Unread tab shows a count chip (from `total`
or the RTDB unread count) and is the admin's triage default consideration.

**Load more.** Cursor "Load more" appends the next page (`nextCursor`); the
button shows a busy state while fetching; appended rows fade in `fast`.
Date-group headers reflow as new days arrive.

**Realtime arrival.** When a new notification is written server-side, the Topbar
`NotificationBell` badge updates live (RTDB `useUnreadCount`). On the inbox
page, a new item appears on next refetch / window-focus revalidation (React
Query `staleTime ~30s`); a subtle `role="status"` announcement ("1 new
notification") may surface — no aggressive auto-prepend that would shift the
user's scroll position mid-read.

**Feedback summary:** mark-read interactions are **optimistic with rollback**;
"Mark all" → success Toast with count; no destructive actions and therefore **no
ConfirmDialogs** on this screen; errors → InlineAlert banner (load) or Toast
(mutation).

---

## 7. Content & copy (precise admin tone)

**Page**

- Title (Fraunces): **Notifications**
- Subtitle: _Updates addressed to you in this academy._
- Header action: **Mark all as read**

**Tabs:** **All** · **Unread** (with a count chip when >0)

**Date group headers:** Today · Yesterday · Earlier

**Per-row type labels** (the `typeLabels` map, kept verbatim from live, paired
with an icon — never label-less): Exam Results · New Exam · New Space · Grading
· Grading Complete · At Risk Alert · Deadline · Space Published · Import
Complete · Budget Alert · Announcement.

**Row action:** **Mark read** (inline, unread rows only) · mobile trailing
IconButton `aria-label="Mark as read"`.

**Timestamps:** relative ("Just now", "12 min ago", "2 hours ago", "Yesterday",
"3 days ago", then a localized date), matching live
`formatDate`/`getRelativeDate`. Absolute time available on hover/focus via
Tooltip.

**Empty states** (see §5):

- All: **"No notifications yet"** — _"You're all caught up. New updates about
  imports, budgets, and student activity will appear here."_
- Unread: **"You're all caught up"** — _"No unread notifications."_

**Errors:**

- Load: **"Couldn't load notifications."** + **Retry**.
- Mark-read failure: **"Couldn't update that notification."**
- Mark-all failure: **"Couldn't mark all as read."**
- Driven by `error.details.code` where specific (`PERMISSION_DENIED`,
  `RATE_LIMITED`, `TENANT_SUSPENDED`).

Tone: declarative, operator-grade, no exclamation marks in body copy (the one
"all caught up" reassurance aside), no student-facing warmth, no emoji. State
what happened and where ("248 students imported into Grade 9", "Tenant spend
reached 80% of the monthly cap").

---

## 8. Domain rules surfaced

1. **Tenant isolation (hard rule).** Notifications live at
   `/tenants/{tenantId}/notifications/{notificationId}`; the list is scoped to
   **`ctx.activeTenantId`**, derived server-side from claims — **not** from the
   request body (`common-api.md §4.4; auth-access §1.4`). An admin in tenant A
   can never read tenant B's notifications. Switching tenants via `RoleSwitcher`
   re-scopes the inbox entirely (the live subscription resets, status report
   §1).
2. **Recipient scoping (per-user RLS).** Only notices where
   `recipientId == ctx.uid` and `recipientRole == 'tenantAdmin'` are returned.
   Firestore rules enforce "Recipient read; CF create" (auth-access §2) —
   defense-in-depth behind the API. The admin sees only their own inbox, not a
   tenant-wide feed.
3. **Server-authoritative, CF-created.** Notifications are **never created from
   the client** — they are written by Cloud Function triggers/side-effects (on
   bulk-import complete, AI-budget threshold, at-risk detection, grading
   complete, exam results released, space published; see be-analytics +
   autograde triggers). The client only **reads** and **marks read**.
   `isRead`/`readAt` are server-stamped on `markRead`.
4. **RBAC gating (server-authoritative).** `manageNotifications` is authed
   (`authMode: 'authed'`) and recipient-gated server-side; the `RequireAuth`
   client guard is UX-only.
5. **Mark-read is the only mutation.** No create, no delete, no edit from this
   surface. `action:'markRead'` with an id = one; without an id =
   all-for-caller. `markedCount` is server-authoritative (the client trusts the
   returned count, not its optimistic guess, for the toast).
6. **AI budget / quota signals are notifications, not controls.** An
   `ai_budget_alert` row _surfaces_ a budget threshold breach (tenant spend vs
   the monthly cap; ties to `/ai-usage`, `useDailyCostSummaries`) but the inbox
   does **not** change budgets — its `actionUrl` deep-links to the AI-usage page
   where the admin can act. The shell-level `QuotaWarningBanner` is the harder,
   always-on signal; the inbox is the timestamped record.
7. **At-risk flags respect analytics access.** `student_at_risk` notifications
   reference `entityType:'student'`/`entityId`; the `actionUrl` lands on a
   tenant-scoped student/class view the admin already governs — no cross-tenant
   student leak.
8. **Audit.** Mark-read is a benign user action; mutation side-effects (if any)
   follow the platform's one audit-log convention (`common-api.md §9`),
   best-effort, non-blocking. No client-side audit write.
9. **Realtime badge is a parallel concern.** The unread count is RTDB-backed
   (`notifications/{tenantId}/{userId}/unreadCount`) and lives in the
   `realtime-contract` (`common-api.md §10`), tenant+uid scoped in
   `database.rules.json` (auth-access §1.8) — not in the request/response inbox
   path.

---

## 9. Accessibility (WCAG AA)

**Focus order:** Skip-to-content → Sidebar (Notifications/active item,
`aria-current="page"` where linked) → Topbar controls (incl. the
`NotificationBell` Popover trigger) → PageHeader "Mark all as read" → filter
Tabs (roving tabindex, WAI tabs pattern) → the list (each row's primary navigate
target, then its "Mark read" button, in DOM order) → "Load more". The list is a
`role="feed"` or an ordered list of `role="article"` items (each row a labeled
article: title + relative time as its accessible name).

**Keyboard:** Tabs operable with arrow keys. Every row's navigate action and
"Mark read" action are reachable by Tab — **no hover-only actions** (the inline
"Mark read" is always in the tab order on desktop; on mobile it's a persistent
trailing IconButton, not a hover reveal). Enter/Space on a row navigates (and
marks read); Enter/Space on "Mark read" marks read without navigating. `Esc`
closes the bell Popover and restores focus to the bell trigger.

**ARIA & semantics:** Unread state is **not color-alone** — each unread row
carries a visible unread dot **plus** an `aria-label`/visually-hidden text
("Unread") **plus** the bolder title weight; the type is a labeled Badge (text,
not color-only) with `aria-label` like _"Type: Budget alert"_. The
`NotificationBell` already models this well: `sr-only` "Notifications, N
unread" + an `aria-live="polite"` region for count changes
(NotificationBell.tsx) — carry that pattern. Toasts use `role="status"` (polite)
for success, `role="alert"` (assertive) for errors; the load-error banner is
`role="alert"`. Mark-read busy-states set `aria-busy` on the affected button and
announce "Marked as read" / "All marked as read" via a live region. Date-group
sub-headers are real headings (`<h2>`/`<h3>`) so screen-reader users can
navigate by group.

**Contrast:** All text/background pairs meet AA (4.5:1 body, 3:1 large/UI) via
foundation semantic tokens — `text.primary` on `bg.surface`, `text.secondary`
body excerpts ≥4.5:1, the unread-row `bg.surface-sunken` tint preserves title
contrast, type Badges meet 3:1 against their fills, and each status tone
(`status.warning/error/success/info`) is paired with an icon + label so it never
relies on hue.

**Reduced motion:** with `prefers-reduced-motion`, the unread-dot fade, row
de-emphasis, tab cross-fade, and "Load more" fade-in become instant state
changes. No motion is load-bearing; the unread→read transition is conveyed by
the dot/weight/tint change, not by animation.

**Never status-by-color-alone (foundation §2.4):** unread = dot + bold weight +
tint + "Unread" label; each notification type = icon + text Badge + tone.
At-risk uses `AtRiskBadge` (icon + label), budget uses an alert-triangle +
"Budget Alert" label.

---

## 10. Web ↔ mobile divergence

**Admin is primarily web/desktop.** This is the tenant-admin console
(`apps/admin-web`, a PWA). State explicitly: tenant-admins operate from a
desktop browser; there is **no React Native admin app**. The ⌘K **CommandPalette
is web-only** (foundation §6) — mobile has no command palette ("Go to
notifications" / "Mark all as read" shortcuts are desktop-only).

**Responsive / mobile-stacked behavior (PWA on a small viewport):**

- The inbox is already a single-column list, so there is **no table→cards
  transform** here (unlike DataTable screens) — the same row composite scales
  down. Below `md`, rows go full-bleed within the Card and the date-group
  headers stay sticky.
- **Inline "Mark read" → trailing IconButton** (a check,
  `aria-label="Mark as read"`, ≥44px) or a tap-to-reveal action; **hover →
  press** (no hover-only affordances). Absolute-time Tooltip on hover becomes
  long-press on touch.
- **Sidebar → mobile drawer + Tabbar;** the inbox is reached via the Topbar
  `NotificationBell` (which persists on mobile) or the drawer — it is not one of
  the 4 primary Tabbar destinations.
- **Pagination** stays cursor-based and identical (shared `pageResponse`
  fragment) across viewports.
- The shared `NotificationsPage`/`NotificationRow` component **names and props
  match 1:1** between web `shared-ui` and a future `ui-native` (foundation §6);
  only the renderer differs. No mobile-only data path — and the **same inbox
  logic is reused** by the student/teacher/parent RN apps' inboxes (the realtime
  badge + `manageNotifications` list are platform-neutral,
  `common-api.md §4/§10`).

---

## 11. Claude-design prompt (ready to paste)

```
You are designing ONE screen for the Auto-LevelUp tenant-admin web app (apps/admin-web), using the
"Lyceum" design system. Read and conform EXACTLY to docs/rebuild-spec/design/00-FOUNDATION.md — do not
invent colors, fonts, spacing, radii, shadows, motion, or component variants; compose only from its §5
component inventory and §2–§4 tokens, cited by semantic name (brand.primary, spark, bg.canvas, bg.surface,
bg.surface-sunken, text.primary/secondary/muted, border.subtle, status.success/warning/error/info,
radius lg/md/pill, e1, motion instant/fast/base, ease.standard). Register = SERIOUS / precision admin
tooling (NOT the playful student register) — restraint in chrome; NO spark CTA, NO celebratory motion.

SCREEN: "Notifications" inbox — route /notifications, role tenantAdmin only, scoped to ONE tenant.
Job: read, triage, and clear the operational notifications addressed to THIS admin (bulk-import complete,
AI budget alert, student at risk, grading complete, exam results released, space published, deadline,
system announcement). This is a RECEIVING inbox — distinct from /announcements (the sending surface). It
only reads + marks-read; it never composes or deletes.

Render inside AppShell (left admin Sidebar: Overview/Management/Analytics/Configuration; Topbar with a
NotificationBell showing a live unread badge, RoleSwitcher, ThemeToggle, ⌘K search, profile). Desktop-first,
content as a single-column reading list at ~720 width, gutter 32.

Build:
- PageHeader: Fraunces title "Notifications", subtitle "Updates addressed to you in this academy.",
  right-aligned GHOST/secondary Button "Mark all as read" (enabled only when there are unread items).
- Filter Tabs: "All" · "Unread" (Unread shows a count chip), brand.primary active indicator.
- A Card (radius lg, e1, bg.surface) containing a date-grouped list (sticky Today / Yesterday / Earlier
  sub-headers in text.muted on bg.surface-sunken). Each row (a NotificationRow composite):
    leading category ICON (lucide, NOT emoji) colored by a type→semantic-status map
      (ai_budget_alert=status.warning alert-triangle; student_at_risk=status.error alert-octagon via
       AtRiskBadge; grading/results=status.success check-circle; bulk_import=status.info download;
       deadline=status.warning clock; space/exam=status.info; system_announcement=brand.primary megaphone),
    title (Schibsted 600 when UNREAD, 500 when read),
    body excerpt (text.secondary, line-clamp-2),
    relative timestamp (text.muted; absolute time in a Tooltip on hover),
    a type Badge/Chip with the human label (Budget Alert, At Risk Alert, Import Complete, …),
    an unread dot (brand.primary) WITH an "Unread" aria-label + bolder title + a bg.surface-sunken row tint,
    and an inline GHOST "Mark read" Button visible ONLY on unread rows.
  Clicking the row body navigates via the notification's actionUrl AND marks it read.
- Cursor "Load more" Pagination footer (ghost Button, busy state while fetching).

States: 5 Skeleton rows on load (icon circle + 2 text lines + pill); EmptyState — All: "No notifications
yet" / "You're all caught up. New updates about imports, budgets, and student activity will appear here.";
Unread: "You're all caught up" / "No unread notifications" + ghost "View all"; load error → InlineAlert
banner "Couldn't load notifications." + Retry (NOT an empty state); per-row busy state during mark-read;
optimistic mark-read + mark-all with rollback on failure; "Mark all as read" → sonner Toast "All caught up."

Rules to surface: tenant-isolated + recipient-scoped (only THIS admin's own notices in THIS tenant, derived
server-side from claims — never from a body field); notifications are CF-created/server-authoritative (the
client only reads + marks read); mark-read is the ONLY mutation (no create/delete); ai_budget_alert and
student_at_risk are signals that deep-link out (to /ai-usage, to the student/class) — the inbox itself
changes nothing.

Accessibility: list as role=feed / articles with real heading group dividers; unread NEVER by color alone
(dot + "Unread" label + bold weight + tint); type Badges are text+icon, not color-only; no hover-only
actions (Mark read always tab-reachable); Enter/Space navigates a row, Enter/Space on "Mark read" marks
without navigating; aria-busy on mutating buttons + a polite live region announcing "Marked as read";
errors role=alert, success toasts role=status; AA contrast; prefers-reduced-motion → instant state changes.

Responsive: single-column list (NO table→cards transform); below md the inline "Mark read" becomes a
trailing check IconButton (aria-label "Mark as read", ≥44px), hover→press, Sidebar→drawer+Tabbar, inbox
reached via the Topbar bell; ⌘K is web-only. Component names/props match shared-ui 1:1 for RN reuse.

Output a single React + Tailwind screen composed from shared-ui components named in FOUNDATION §5, reading
the Lyceum CSS-variable tokens. No new tokens; if something seems missing (e.g. the NotificationRow
composite or the type→status icon map), note it as a proposed foundation addition rather than inventing it.
```
