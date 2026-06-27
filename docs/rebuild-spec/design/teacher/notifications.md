# Notifications

> The teacher's notification feed — one recipient-scoped, reverse-chronological
> list of everything the platform has surfaced for _this_ staff member (at-risk
> flags raised by the nightly rule engine, submissions/grading complete, exam
> results released, spaces published, bulk-import outcomes, AI-budget alerts,
> system announcements), with read/unread state, type icons, relative
> timestamps, type/unread filters, mark-read and mark-all-read, and a deep-link
> from every row to its source. It is the full-page sibling of the topbar
> `NotificationBell` — both read from the **same** shared query, so the bell
> badge and this list never disagree and never double-fetch.

**Route** `/notifications` · **Roles** `teacher` (own feed) · `tenantAdmin` (own
feed) · **Primary APIs** `notifications` repo read
(`identity.manageNotifications` `action:'list'`, backed by Firestore
`tenants/{tenantId}/notifications` + the RTDB
`notifications/{tenantId}/{userId}` unread-count mirror) →
`identity.manageNotifications` `action:'markRead'` (single + all); optional
`notificationPreferences.*`

This spec conforms to `design/00-FOUNDATION.md` ("Lyceum / Modern Scholarly").
Every token, type, spacing, radius, elevation, motion value, and component is
cited by its FOUNDATION semantic name — no new tokens, fonts, colors, or
component variants are introduced. Per FOUNDATION §1 this is a **staff
operational surface**: precise, credible, **calm**. Status accents
(`status.error`/`status.warning`/`status.success`/`status.info`) are used
soberly and **always** paired with a type icon + label — never color alone
(FOUNDATION §2.3). There is **no gamification chrome** here — no XP, streak, or
level-up celebration; `spark` is permitted only as the single primary-CTA accent
(Mark all read) and never as an alarm. An unread dot may carry one subtle pulse,
fully suppressed under reduced-motion (§9).

---

## 1. Purpose & primary user

**Primary user:** a `teacher` or `tenantAdmin` reviewing their own platform
notifications. The feed is strictly **recipient-scoped** — a user sees only
notifications whose `recipientId == their uid` (auth-access §1.5, "recipient
read"); there is no "all-tenant notifications" admin view here. The
job-to-be-done is **review-and-act**:

> _"Show me what's happened that needs my attention — newest first, with the
> unread ones obvious — let me jump straight to the thing each one is about,
> clear the ones I've seen, and not have the bell badge lie to me afterward."_

This is the **triage-and-route** surface. It complements (does not replace):

- The topbar **`NotificationBell`** + **`NotificationDropdown`** — the
  quick-glance peek (latest few + unread count). This page is the full,
  filterable history. Both share one query (§2, §8).
- **At-Risk Students** (`/analytics/at-risk`) — the actionable triage console
  for `student_at_risk`. A `student_at_risk` notification here deep-links
  _there_ (or to the named student's detail), it does not re-render the roster.
- **Grading Review** (`/exams/:examId/submissions/:submissionId`) — where a
  `submission_graded` / `grading_complete` notification routes for the actual
  review work.
- **Settings** — where richer per-type notification preferences live if the
  tenant exposes them; this page may host a lightweight "Preferences" entry but
  is not the settings authority.

**Explicitly NOT this screen's job:** creating, editing, or deleting
notifications (notifications are **server-created only** — by analytics
triggers, schedulers, and the `notification-sender`; auth-access §1.5,
be-analytics §1); computing at-risk or any status (the client renders flags, it
never decides them); grading, authoring, or releasing exams (those happen on the
surfaces this page links _out_ to); or showing another user's feed. The only
writes available are **mark-read** and **mark-all-read** (and optional
preference toggles) — all via callable.

**Emotional register:** quiet and dependable. Even `student_at_risk` and
`ai_budget_alert` rows read as _signal_, not alarm — a sober `status` accent, a
clear label, never a klaxon.

---

## 2. Entry points & route

**Route:** `/notifications`, gated by
`RequireAuth allow={['teacher','tenantAdmin']}` (FOUNDATION §4 single
config-driven guard; `specs/webapps-design.md` §4.2). It sits in the **System**
nav group (`navMeta.group: 'System'`, label "Notifications", icon `bell`).

**Entry points:**

- **Topbar `NotificationBell`** → its dropdown's "View all" footer routes here.
  The bell badge and this page are fed by the **same**
  `useUnreadCount`/`useNotifications` query (single source — FOUNDATION §5
  Topbar; `specs/webapps-design.md` §3.1: _"one shared query/store feeds both
  the bell and the notifications page"_).
- **System → Notifications** sidebar item (`AppSidebar`).
- **`CommandPalette` (⌘K)** "Notifications".
- **Mobile**: the bell lives in the mobile header; "View all" / a
  `MobileBottomNav` entry (if configured) opens this page.

**Reads powering it** (all via `@levelup/api-client` repositories /
`shared-hooks/headless`; the UI never touches Firestore or builds collection
paths — `specs/webapps-design.md` §6, common-api §3.3):

- **`notifications` repo `list`** → `identity.manageNotifications` with
  `action: 'list'`, paginated via the unified `PageRequest`/`pageResponse`
  fragment (common-api §7: `cursor` + `limit`, `nextCursor` = null at end).
  Returns `Notification[]` (`shared-types/.../notification/notification.ts`):
  `{ id, recipientId, recipientRole, type, title, body, entityType?, entityId?, actionUrl?, isRead, createdAt, readAt? }`.
  **`recipientId` is derived from `ctx.uid` server-side**, and **`tenantId` from
  `ctx.activeTenantId`** — neither is a request field (common-api §4.4). The
  current `useNotifications(tenantId, userId, { unreadOnly, limit })` hook is
  the migration ancestor; the rebuilt hook drops the explicit ids
  (claim-derived) and gains opaque-cursor paging.
- **`notifications` repo unread-count** → `useUnreadCount`, sourced from the
  **RTDB mirror** `notifications/{tenantId}/{userId}/unreadCount`
  (`NotificationRTDBState`, written by `notification-sender`; be-analytics §2).
  This realtime path keeps the bell badge and this page's "Unread (n)" filter
  count live without re-listing. It is a **parallel realtime concern**
  (common-api §10) behind the same `subscribe(name, params, cb)` seam — RN and
  web subscribe identically.
- **Filter** (`all` / `unread` / by type) maps to the list request: `unread`
  sets `unreadOnly: true` server-side; by-type sets a `type` filter. The
  type-filter option set is the fixed `NotificationType` enum (§7) — not a
  separate fetch.

**Writes** (all callables — no direct client Firestore writes;
`specs/webapps-design.md` §6, §7 item 8):

- **`identity.manageNotifications` `action: 'markRead'`** with a single
  `notificationId` — marks one read (sets `isRead: true`, `readAt`),
  server-decrements the RTDB mirror.
- **`identity.manageNotifications` `action: 'markRead'`** with no id / an
  `all: true` discriminator — **mark all read** (server batch; resets the RTDB
  `unreadCount` to 0). _(If v1 only exposes per-id markRead, "Mark all read"
  fans out client-side over the loaded unread set; preferred is one server call
  — `specs/webapps-design.md` §7.)_
- **Optional `notificationPreferences.*`** (`enabledTypes`, `muteUntil`) if the
  tenant surfaces a Preferences panel — a callable write, never a direct
  `updateDoc`.

There is **no create, no edit, no delete** from this surface. Reads are repo
methods; writes are callables; stats/counts are server-authoritative (RTDB
mirror) — the client never recomputes the unread count from the list.

---

## 3. Layout (wireframe-as-text)

Rendered inside `PlatformLayout` → `AppShell` (FOUNDATION §5 Navigation;
`specs/webapps-design.md` §3.1): persistent left `Sidebar`, `Topbar` (tenant
switcher, ⌘K search, `NotificationBell`, profile / `ThemeToggle`), and on mobile
a `Tabbar` (`MobileBottomNav`) replacing the sidebar. This screen owns only the
**main content region**. Page gutters follow FOUNDATION §4 (mobile 16 / tablet
24 / desktop 32). The feed is a **reading column** — max content width 720
(FOUNDATION §4 reading measure), centered, so rows stay scannable and never
stretch edge-to-edge on `xl`. Vertical rhythm uses `gap` from the spacing scale:
header → toolbar space-6/`24`, toolbar → list space-4/`16`, between rows space-0
(rows are separated by `border.subtle` dividers, not gaps). The list sits on
`bg.surface`, radius `lg`, elevation `e1` at rest; the page is `bg.canvas`.

```
┌─ AppShell ────────────────────────────────────────────────────────────────────────┐
│ Sidebar │  Topbar: [tenant ▾] ………… [⌘K search] [🔔 bell •3] [theme] [avatar]        │
│ (nav)   ├───────────────────────────────────────────────────────────────────────────┤
│         │  MAIN  (reading column, max-w 720, centered, gutter responsive)            │
│         │  ┌─ Page header ───────────────────────────────────────────────────────┐   │
│         │  │ h1 "Notifications"                                  [ Mark all read ] │   │
│         │  │ subhead: "3 unread · 41 total"                                        │   │
│         │  └──────────────────────────────────────────────────────────────────────┘   │
│         │  ┌─ Toolbar (sticky on scroll) ────────────────────────────────────────┐   │
│         │  │ [ All ] [ Unread •3 ]      Type: [ All types ▾ ]                      │   │
│         │  └──────────────────────────────────────────────────────────────────────┘   │
│         │  ┌─ Feed (list, on bg.surface, radius lg, e1) ─────────────────────────┐   │
│         │  │ • ⚑  Student at risk: Aarav S. flagged                  6h ago   ⋯   │   │  ← unread (dot + bg.surface-sunken tint)
│         │  │      2 reasons · DSA · tap to review                                 │   │
│         │  ├──────────────────────────────────────────────────────────────────────┤   │
│         │  │   ✓  Grading complete: Midterm — Class 10-A            9h ago   ⋯   │   │  ← read (no dot, plain bg.surface)
│         │  │      28 of 28 submissions graded                                     │   │
│         │  ├──────────────────────────────────────────────────────────────────────┤   │
│         │  │   📤 Results released: Unit Test 3                     Yesterday  ⋯  │   │
│         │  │ ────────────────  Earlier  ──────────────── (date group label)       │   │
│         │  │   📚 Space published: Linked Lists                    3 days ago     │   │
│         │  └──────────────────────────────────────────────────────────────────────┘   │
│         │  [ Load older ]  (cursor pagination)                                        │
└─────────┴───────────────────────────────────────────────────────────────────────────┘
```

**Row anatomy:** leading **type icon** in a status-tinted circular chip (24px,
radius `pill`) → title (`text.primary`, Schibsted 600, `base`) + one-line body
(`text.secondary`, `sm`, truncated) → trailing **relative timestamp**
(`text.muted`, `xs`, mono `Spline Sans Mono` for the value, e.g. "6h ago") →
overflow `⋯` `IconButton` (mark read / mark unread is read-only-safe-omit). An
**unread** row carries a leading 8px dot in the row's status color and a faint
`bg.surface-sunken` row tint; a **read** row is plain `bg.surface` with
`text.secondary` title weight 500. The whole row is one click target
(deep-link).

**Responsive (FOUNDATION §4 breakpoints):**

- **`sm` (<768):** single column, full-width within gutters (16). Toolbar filter
  tabs become a horizontally scrollable `Tabs` strip; the type `Select`
  collapses to an icon-triggered `Sheet` of type checkboxes. "Mark all read"
  moves into the header as a compact `IconButton` with label-on-`md`. Rows are
  taller (touch ≥44px), body text allowed two lines.
- **`md` (768–1023):** reading column with gutter 24; toolbar inline (tabs +
  type select on one row).
- **`lg`+ (≥1024):** reading column centered at max-w 720, gutter 32; "Mark all
  read" is a full `Button` in the header; date-group labels ("Today / Yesterday
  / Earlier") render as sticky sub-headers within the list.

---

## 4. Components used

All from FOUNDATION §5 / the `shared-ui` inventory (`specs/webapps-design.md`
§2.2). No new component variants.

- **`AppShell` / `Sidebar` / `Topbar` / `MobileBottomNav`** (FOUNDATION §5
  Navigation) — provided by `PlatformLayout`; this screen renders into MAIN
  only.
- **`NotificationBell`** (`shared-ui/layout`) — topbar; **shares the same
  query** as this page (single source). Cited for the shell-parity contract; not
  re-implemented here.
- **`Tabs`** (FOUNDATION §5 Containers) — the **All / Unread** filter, with an
  unread count `Badge` on the Unread tab.
- **`Select`** (FOUNDATION §5 Primitives) — the **Type** filter (option set =
  `NotificationType` enum + "All types"). Never an empty-string value (per
  project guardrail).
- **Notification row** — composed from primitives: a leading icon chip
  (`Avatar`/icon container), `Badge` (`pill`) for the unread dot, title/body
  text, mono timestamp, and a trailing `IconButton` (overflow `⋯`) +
  `DropdownMenu` (Mark read / Mark unread / Open). _(This list-row is a
  composite of existing primitives, matching the existing
  `shared-ui/layout/NotificationsPage` + `NotificationDropdown`; no new
  component is proposed.)_
- **`Badge`** (FOUNDATION §5 Data) — unread dot per row and the unread count on
  the Unread tab.
- **`Button` (spark)** — "Mark all read" primary CTA (the single permitted
  `spark` accent; disabled when unread count = 0).
- **`EmptyState`** (FOUNDATION §5 Data; `shared-ui/data`) — zero notifications
  and zero-for-current-filter variants.
- **`ErrorState`** (`shared-ui/data`, distinct from empty —
  `specs/webapps-design.md` §2.2) — list load failure.
- **`Skeleton`** (FOUNDATION §5 Data) — loading rows.
- **`Pagination` / "Load older"** (FOUNDATION §5 Data) — cursor pagination
  footer (`nextCursor`).
- **`Toast` (sonner)** (FOUNDATION §5 Feedback) — confirmation of "Mark all
  read" and failure rollbacks.
- **`Tooltip`** (FOUNDATION §5 Containers) — icon-only affordances (overflow,
  mobile mark-all) get accessible labels.
- **`DropdownMenu`** (FOUNDATION §5 Navigation primitives) — per-row `⋯`
  actions.

**Proposed addition:** none. The optional **Preferences** affordance, if
surfaced, reuses `Drawer/Sheet` + `Switch` + `DatePicker` (mute-until) from
FOUNDATION §5 — all existing.

---

## 5. States

Permission note: both roles (`teacher`, `tenantAdmin`) see the **same** UI —
each user's own recipient-scoped feed. There is **no role-conditional content**
here beyond the obvious fact that the _kinds_ of notifications differ by what
the server sent that user (e.g. an admin may receive `ai_budget_alert` /
`bulk_import_complete`; a teacher receives `student_at_risk` /
`submission_graded`). No action is permission-gated — mark-read is always
allowed on one's own notifications.

- **Loading (skeleton):** header renders immediately; the feed shows 6–8
  `Skeleton` rows (icon-chip circle + two text bars + a short timestamp bar),
  `bg.surface`, divided by `border.subtle`. Toolbar tabs render disabled until
  first page resolves. No layout shift when rows arrive.
- **Empty (no notifications at all):** `EmptyState` — bell illustration/icon,
  Fraunces title (FOUNDATION §3 empty-state title), supportive body, no CTA
  (nothing to create). Copy in §7.
- **Empty for current filter** (e.g. Unread filter with zero unread, or a Type
  filter with no matches): a lighter `EmptyState` variant with a "Show all"
  reset that clears the filter (and the URL param). Distinct copy from the
  global-empty (§7).
- **Error:** `ErrorState` (not `EmptyState`) — neutral icon, title, body, and a
  **Retry** `Button` (secondary) that refetches. Uses `useApiError` →
  `error.details.code` (common-api §6.3). A partial-page error (first page
  loaded, "Load older" fails) shows an inline `InlineAlert` above the "Load
  older" button with Retry, leaving loaded rows intact.
- **Partial:** first page loaded, more available → "Load older" footer button
  (idle/loading/exhausted states). While paging, a small `Skeleton` row set
  appends; on exhaustion the button is replaced by a muted "You're all caught
  up" end-cap.
- **Success:** populated feed, newest first, date-grouped (Today / Yesterday /
  Earlier). Unread rows tinted + dotted; "Mark all read" enabled iff unread > 0.
  The Unread tab `Badge` mirrors the live RTDB count.
- **Optimistic mark-read (per row):** clicking a row (or its Mark-read action)
  immediately drops the dot, removes the tint, decrements the Unread tab badge,
  and (if Unread filter active) animates the row out — _before_ the callable
  resolves. On failure, the change rolls back and a `Toast` (`status.error`)
  explains; the bell badge (shared query) reconciles to the server count.
- **Realtime arrival:** when the RTDB mirror reports a new notification (or
  count change) while the page is open, the Unread badge updates live; a subtle
  "1 new notification — refresh" `InlineAlert`/pill appears at the top of the
  feed rather than reordering under the user's cursor (prevents content
  jumping). Tapping it prepends the new rows.
- **Offline:** `OfflineBanner` (shell) shows; the cached last page renders
  read-only; mark-read actions queue/disable with a tooltip "Reconnect to
  update". No client-only writes.

---

## 6. Interactions & motion (FOUNDATION §4 motion tokens)

- **Open a notification (deep-link):** tapping a row navigates to
  `notification.actionUrl` (e.g. `/analytics/at-risk?...`,
  `/exams/:examId/submissions/:submissionId`, `/students/:studentId/report`,
  `/spaces/:spaceId/edit`). If unread, this **also** fires optimistic mark-read
  in the same gesture (matches the live `onNotificationClick` behavior). Page
  transition uses the shell's `PageTransition` (`page 420ms`, `ease.entrance`).
- **Optimistic mark-read:** dot fade-out + tint removal over `fast 160ms`,
  `ease.standard`. Unread-tab badge count steps down instantly. Under the
  **Unread** filter, the row collapses out: height + opacity over `base 220ms`,
  `ease.exit`. On rollback, the row re-inserts with `ease.entrance`.
- **Mark all read:** `spark` primary `Button`. Optimistic — all dots/tints clear
  and the Unread badge → 0 immediately; a `Toast` (`status.success`) "All
  notifications marked as read" confirms on resolve. No confirmation dialog
  (non-destructive, reversible by the server's natural state — and there is no
  "unread all"). On failure, state rolls back + `status.error` Toast.
- **Filter switch (All / Unread / Type):** instant client-side view filter when
  data is already loaded; if the filter requires a different server query
  (`unreadOnly`/`type`), the list cross-fades (`fast 160ms`) over a brief
  skeleton. Filter selection is written to the **URL**
  (`?filter=unread&type=student_at_risk`) so the view is deep-linkable,
  back-button-stable, and RN-navigable — never local-only state.
- **Unread pulse:** a freshly arrived unread dot may pulse **once** (a single
  `instant 100ms`→`fast` opacity/scale tick), never a looping animation. Fully
  suppressed under `prefers-reduced-motion` (§9) — the dot simply appears.
- **New-arrival pill:** the "N new — refresh" pill enters with `ease.entrance`
  (`base 220ms`); dismiss/insert on tap.
- **Hover/focus (web):** row hover raises to `bg.surface-sunken`; focus shows
  the FOUNDATION focus ring (`border.focus`, `0 0 0 3px indigo @35%`). The `⋯`
  `DropdownMenu` opens at `e2`.
- **Load older:** button → loading spinner inline; appended skeletons resolve
  into rows with a soft `fast` fade. No scroll jump.
- **No celebratory motion** anywhere — this is staff chrome (FOUNDATION §1). The
  one `spark` is the Mark-all-read button accent.

---

## 7. Content & copy (staff tone — precise, calm, professional)

**Page header**

- h1: `Notifications`
- Subhead (dynamic): `{unread} unread · {total} total` — e.g. "3 unread · 41
  total". When zero unread: `You're all caught up · {total} total`.
- Primary CTA: `Mark all read` (disabled state tooltip:
  `No unread notifications`).

**Filter toolbar**

- Tabs: `All` · `Unread` (with count `Badge`).
- Type select trigger: `All types`. Options (labels for the `NotificationType`
  enum):
  - `student_at_risk` → **Student at risk**
  - `submission_graded` → **Submission graded**
  - `grading_complete` → **Grading complete**
  - `exam_results_released` → **Results released**
  - `new_exam_assigned` → **New exam assigned**
  - `new_space_assigned` → **New space assigned**
  - `space_published` → **Space published**
  - `deadline_reminder` → **Deadline reminder**
  - `bulk_import_complete` → **Import complete**
  - `ai_budget_alert` → **AI budget alert**
  - `system_announcement` → **Announcement**

**Row examples (title / body)** — titles come from the server
(`notification.title`/`body`); these are representative:

- Student at risk — _"Aarav Sharma flagged as at-risk"_ / _"2 reasons · Class
  10-A · Tap to review"_
- Grading complete — _"Grading complete: Midterm"_ / _"28 of 28 submissions
  graded · Class 10-A"_
- Results released — _"Results released: Unit Test 3"_ / _"Visible to students
  now"_
- Space published — _"Space published: Linked Lists"_
- Import complete — _"Student import complete"_ / _"142 added · 3 skipped"_
- AI budget alert — _"AI usage at 80% of this month's budget"_ (admin) — sober
  `status.warning`, no exclamation.

**Date-group labels:** `Today` · `Yesterday` · `Earlier` (within last 30 days) ·
`Older`.

**Per-row overflow menu:** `Open` · `Mark as read` / `Mark as unread`.

**Empty — no notifications at all**

- Title (Fraunces): `Nothing to review`
- Body:
  `When something needs your attention — a student flagged, grading finished, or results released — it'll show up here.`
- No CTA.

**Empty — Unread filter, none unread**

- Title: `You're all caught up`
- Body: `No unread notifications. Switch to All to see your history.`
- Action: `Show all`

**Empty — Type filter, no matches**

- Title: `No {type label} notifications`
- Body: `Nothing here for this type yet.`
- Action: `Clear filter`

**Error — list failed to load**

- Title: `Couldn't load notifications`
- Body:
  `Something went wrong fetching your feed. Check your connection and try again.`
- Action: `Retry`

**Partial / pagination**

- Footer button: `Load older`
- Exhausted end-cap: `You've reached the start of your notifications.`

**Toasts**

- Mark all read success: `All notifications marked as read.`
- Mark-read failure: `Couldn't update that notification. Please try again.`
- Mark all read failure: `Couldn't mark all as read. Please try again.`

**Offline**

- Banner (shell): standard `OfflineBanner`. Queued-action tooltip:
  `Reconnect to update.`

Tone rules honored: no exclamation marks on alerts, no "urgent!/alert!"
language, no emoji in copy, direct verbs ("Mark all read", "Load older",
"Retry"). At-risk and budget items are framed as signal, never blame.

---

## 8. Domain rules surfaced

- **Recipient-scoped, read-own.** The feed shows only notifications where
  `recipientId == ctx.uid`; `recipientId` and `tenantId` are derived server-side
  from claims, never request fields (common-api §4.4; auth-access §1.5
  "recipient read"). No teacher or admin can read another user's feed from here.
- **Tenant isolation.** Scoped to `ctx.activeTenantId`
  (`tenants/{tenantId}/notifications`); switching tenants in the topbar swaps
  the entire feed and the bell count — no cross-tenant bleed (auth-access §1.5;
  common-api §4.4).
- **Server-created only.** Notifications are written exclusively by the backend
  (`notification-sender`, analytics triggers/schedulers — be-analytics §1–2).
  The client never creates, edits, or deletes; only `markRead` (one + all) is a
  permitted write. No client Firestore writes (`specs/webapps-design.md` §6).
- **Single source for bell + page.** The topbar `NotificationBell` and this page
  consume the **same** `useNotifications`/`useUnreadCount` query and the
  **same** RTDB unread-count mirror — no double-fetch, no count divergence
  (`specs/webapps-design.md` §3.1). Marking read here updates the bell badge in
  the same tick.
- **Server-authoritative unread count.** The unread count comes from the RTDB
  mirror `notifications/{tenantId}/{userId}/unreadCount` (be-analytics §2), not
  a client recount of the list. Optimistic decrements are reconciled to the
  server value.
- **At-risk is read-only signal.** A `student_at_risk` notification surfaces
  `isAtRisk`/`atRiskReasons` computed by the nightly rule engine
  (`nightlyAtRiskDetection` + `at-risk-rules.ts`; be-analytics §1). This page
  never computes, overrides, or clears risk — it links to the At-Risk console /
  student detail.
- **Results-release gating respected downstream.** An `exam_results_released`
  notification only ever exists _because_ the server released results
  (`onExamResultsReleased`; honoring `releaseResultsAutomatically`). The
  deep-link routes to a surface that itself enforces the release gate; this page
  renders no submission content, scores, or answer keys inline.
- **No answer keys, no raw content.** Rows carry only `title`/`body`/`actionUrl`
  — never question content, rubric internals, or answer keys (auth-access §1.5
  answer-key deny-all).
- **Reduced-motion for unread pulse.** Any unread-dot pulse respects
  `prefers-reduced-motion` (FOUNDATION §4; §9 here).
- **Status never by color alone.** Every status-tinted row pairs the color with
  a type icon + text label (FOUNDATION §2.3).

---

## 9. Accessibility

- **Landmark & heading order:** MAIN is `role="main"` (from `AppShell`); h1
  "Notifications" is the single page h1. The feed is a `role="feed"` (or an
  accessible `<ul>` of `<li>` rows) with each row an article exposing its title
  as the accessible name and read/unread state via `aria-label` (e.g. "Unread:
  Aarav Sharma flagged as at-risk, 6 hours ago").
- **Focus order:** Skip-to-content → h1 → Mark-all-read → filter Tabs → Type
  select → first feed row → … → Load older. The "N new" arrival pill is inserted
  into focus order at the top of the feed (announced politely, not
  auto-focused).
- **Keyboard:** Tabs are arrow-key navigable (Radix `Tabs`); `Select` is
  keyboard-operable (and never uses an empty-string value). Each row is
  reachable via Tab and activated with Enter/Space (navigates + marks read). The
  `⋯` `DropdownMenu` opens with Enter/Space and is arrow-navigable. "Mark all
  read" is a standard button. A roving-tabindex row model keeps Tab stops to
  one-per-row (not per inner control), with the overflow menu reachable via a
  secondary key (e.g. right-arrow / dedicated focus) — matching the grading-list
  keyboard ergonomics pattern.
- **ARIA / live regions:** the unread count uses `aria-live="polite"` on the
  subhead and Unread-tab badge so screen readers hear count changes after
  mark-read. The "N new notifications" pill is an `aria-live="polite"` status
  (not assertive — it must not interrupt). Optimistic mark-read announces
  "Marked as read" politely.
- **Icon-only controls:** the `⋯` overflow and the mobile compact "Mark all
  read" carry `aria-label` + `Tooltip`. The unread dot is decorative
  (`aria-hidden`); unread state is conveyed in the row's accessible name, never
  by the dot alone.
- **Contrast:** all text/background and status-on-surface pairs meet WCAG AA
  (FOUNDATION §2.3 — body 4.5:1, large/UI 3:1). `text.muted` timestamps are
  sized/weighted to clear the small-text threshold. Status accents are paired
  with icon + label (no color-only meaning).
- **Reduced motion:** under `prefers-reduced-motion`, the unread-dot pulse is
  removed entirely, the Unread-filter row-collapse becomes an instant remove (no
  height animation), cross-fades become instant swaps, and `PageTransition`
  falls back to the shell's reduced-motion variant.
- **Touch targets:** rows and all controls ≥44px on mobile (FOUNDATION §4).

---

## 10. Web↔mobile divergence (RN parity)

Component **names and props match 1:1** between `shared-ui` (web) and
`ui-native` (mobile); only the renderer differs (FOUNDATION §6). Notes:

- **Same data, same hooks:** RN imports the identical platform-neutral hooks
  (`useNotifications`, `useUnreadCount`, mark-read mutations) over
  `@levelup/api-client` and the same `subscribe(...)` realtime seam for the
  unread mirror (common-api §5.3, §10). No DOM coupling.
- **List rendering:** web renders a scrolling reading column; RN uses a
  `FlatList`/`SectionList` (sections = date groups) with pull-to-refresh and
  onEndReached cursor paging (replacing the "Load older" button).
- **Bell parity:** web has a topbar `NotificationBell` + dropdown; RN surfaces a
  header bell icon with a badge that routes to the full screen — same shared
  query/count, no double-fetch.
- **Interaction:** web hover/focus → RN press states; web `DropdownMenu` (`⋯`) →
  RN long-press / trailing action menu or a swipe-to-mark-read gesture; web
  cross-fades → RN spring/timing equivalents (still no celebratory motion).
- **No command palette / no ⌘K** on mobile (FOUNDATION §6) — the bell and a nav
  entry are the entry points.
- **Filters:** web Tabs + Select → RN segmented control (All/Unread) + a
  bottom-sheet type picker.
- **Reduced motion / OS settings:** RN reads the OS reduce-motion flag to
  suppress the unread pulse, identically to web.
- **Deep-links:** `actionUrl` is consumed by the RN `react-navigation` renderer
  from the same route manifest (`specs/webapps-design.md` §3.2), so a
  notification opens the equivalent native screen.

---

## 11. A Claude-design prompt

```text
You are designing the "Notifications" screen for the Auto-LevelUp TEACHER web portal.
STRICTLY conform to the Lyceum / Modern Scholarly design system in
docs/rebuild-spec/design/00-FOUNDATION.md. Do NOT invent tokens, fonts, colors,
spacing, radii, or component variants — compose ONLY from FOUNDATION §5 components
and cite tokens by their semantic names (bg.canvas, bg.surface, bg.surface-sunken,
text.primary/secondary/muted, border.subtle/strong/focus, brand.primary, spark,
status.success/warning/error/info). Fonts: Fraunces (display/empty-state titles),
Schibsted Grotesk (UI/body), Spline Sans Mono (timestamps). Motion tokens:
instant/fast/base/slow/page with ease.standard/entrance/exit. Respect
prefers-reduced-motion.

CONTEXT: This is a STAFF OPERATIONAL surface — precise, credible, CALM. No
gamification chrome (no XP/streak/level-up). spark is allowed ONLY as the single
"Mark all read" primary-CTA accent. Status accents are sober and ALWAYS paired with
a type icon + text label, never color alone.

ROLE & DATA: roles teacher and tenantAdmin; each user sees ONLY their own
recipient-scoped feed (recipientId == uid, tenantId from claims — never form fields).
Reads via the notifications repo (identity.manageNotifications action:'list', cursor
pagination); writes via callables (identity.manageNotifications action:'markRead' for
single and all). The topbar NotificationBell and this page share ONE query and ONE
RTDB unread-count mirror — bell badge and page never disagree, never double-fetch.
Notification types: student_at_risk, submission_graded, grading_complete,
exam_results_released, new_exam_assigned, new_space_assigned, space_published,
deadline_reminder, bulk_import_complete, ai_budget_alert, system_announcement.

BUILD inside PlatformLayout → AppShell (sidebar + topbar). MAIN is a reading column,
max-width 720, centered, on bg.canvas; the feed list sits on bg.surface, radius lg,
elevation e1, rows divided by border.subtle.

LAYOUT:
- Page header: h1 "Notifications", dynamic subhead "{unread} unread · {total} total",
  and a spark primary Button "Mark all read" (disabled when unread = 0).
- Toolbar (sticky on scroll): Tabs [All | Unread •count], plus a Type Select
  ("All types" + the enum labels). Filter state lives in the URL (?filter=&type=).
- Feed: reverse-chronological rows grouped by date (Today / Yesterday / Earlier).
  Row = leading type-icon chip (status-tinted, radius pill) + title (Schibsted 600,
  base) + one-line body (text.secondary, sm, truncated) + trailing relative timestamp
  (Spline Sans Mono, xs, text.muted) + a ⋯ overflow DropdownMenu (Open / Mark read).
  Unread rows: 8px status-color dot + faint bg.surface-sunken tint + title weight 600.
  Read rows: plain bg.surface, title weight 500. Whole row is one click target.
- Footer: "Load older" cursor pagination; exhausted end-cap "You've reached the start".

STATES: skeleton rows (loading); EmptyState "Nothing to review" (global empty);
filter-empty variants ("You're all caught up" with Show all; "No {type} notifications"
with Clear filter); ErrorState (distinct from empty) "Couldn't load notifications" +
Retry; partial (Load older). Optimistic mark-read: tapping a row drops the dot, removes
the tint, decrements the Unread badge, and (under Unread filter) collapses the row out
BEFORE the callable resolves, with rollback + status.error Toast on failure. Mark all
read is optimistic with a status.success Toast, no confirm dialog. A polite "N new —
refresh" pill appears on realtime arrival instead of reordering under the cursor.

MOTION: dot fade fast/ease.standard; unread row collapse base/ease.exit; rollback
ease.entrance; ONE-shot unread-dot pulse (suppressed under reduced-motion); no
celebratory motion anywhere; spark only on Mark all read.

ACCESSIBILITY: role="feed"/list with per-row accessible names encoding unread state
(not color/dot alone); aria-live="polite" on the unread count and the new-arrival pill;
roving-tabindex rows (Enter/Space opens + marks read); icon-only controls get aria-label
+ Tooltip; WCAG AA contrast; full reduced-motion fallbacks; ≥44px touch targets.

Deliver a desktop (lg) layout and a mobile (sm) layout (segmented All/Unread control,
bottom-sheet type picker, pull-to-refresh / onEndReached paging). Components,
tokens, and copy must trace back to FOUNDATION and to
docs/rebuild-spec/design/teacher/notifications.md.
```
