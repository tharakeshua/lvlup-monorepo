# Student · Notifications

> Conforms to **Lyceum** (Direction A — "Modern Scholarly"). See
> `../00-FOUNDATION.md`. Tokens are cited by semantic name, never re-pasted.
> Student tone: warm, encouraging, supportive — nudges frame growth, never
> punishment.

---

## 1. Purpose & primary user

**Primary user:** A learner (B2B school student, role `student`; or B2C consumer
learner with no membership) checking what's new — a space they can now start, an
exam result that just dropped, an achievement they unlocked, or a gentle nudge
to come back to a streak/at-risk topic.

**Job-to-be-done:** _"Tell me what changed and what's worth my attention right
now, let me jump straight to it, and let me clear the noise."_ The notifications
center is the learner's quiet inbox: scannable, deep-linkable, and kind in how
it nudges. It must never feel like a guilt list — even at-risk and deadline
reminders read as "here's an easy win," not "you're behind."

This screen is the **full center** at `/notifications`; the **NotificationBell**
in the Topbar is its compact companion (recent + unread badge), powered by the
_same_ shared query so the two never disagree.

---

## 2. Entry points & route

**Route:** `/notifications` (B2B `AppShell` route tree; B2C consumer shell
reuses the same page under its own nav). Reached from:

- **Topbar `NotificationBell`** → "View all" (closes Popover, navigates to
  `/notifications`).
- Sidebar / mobile Tabbar item is optional; the bell is the canonical entry.
  Deep links from email/push land here or directly on the target entity.

**Reads / writes (via `@levelup/api-client` — UI never touches Firebase):**

- **List read:** `v1.identity.manageNotifications` with `action: 'list'`
  (paginated via the shared `PageRequest`/`pageResponse` fragment — `cursor` +
  `limit`, `nextCursor` for "load more"). Exposed through the headless
  `useNotifications({ unreadOnly, limit })` hook over the `NotificationsRepo`.
  Filter `unread` sets `unreadOnly: true`. `tenantId` is derived server-side
  from the active-tenant claim (not in the request body); for B2C the active
  context resolves to `platform_public`.
- **Mark read / mark-all-read:** `v1.identity.manageNotifications` with
  `action: 'markRead'` (single `notificationId`, or all for the current
  recipient) — `useMarkRead()` / `useMarkAllRead()`. Optimistic; invalidates the
  narrowest notifications query key on settle.
- **Unread badge count (realtime):** the RTDB `NotificationRTDBState` at
  `notifications/{tenantId}/{userId}/unreadCount`, subscribed via the realtime
  seam (`subscribe('notificationCount', …)`) behind `useUnreadCount()`. This
  same count feeds **both** the bell badge and the page's unread filter
  affordance — one source.
- **Deep-link target:** each `Notification.actionUrl` (e.g. `/spaces/:spaceId`,
  `/exams/:examId/results`, `/achievements`) drives client navigation on click.
  No extra read.

The `Notification` shape
(`packages/shared-types/src/notification/notification.ts`): `type`, `title`,
`body`, `entityType`/`entityId`, `actionUrl`, `isRead`, `createdAt`/`readAt`.
Relevant `type`s for students: `exam_results_released`, `new_exam_assigned`,
`new_space_assigned`, `space_published`, `submission_graded`, `student_at_risk`,
`deadline_reminder`, `system_announcement` (achievement unlocks arrive as a
gamification-flavored `system_announcement` until a dedicated
`achievement_unlocked` type is added — see Proposed additions).

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (Sidebar + Topbar on web; Topbar + bottom
**Tabbar** on mobile). Single reading column, max reading width (≈720), centered
in the canvas gutter (mobile 16 / tablet 24 / desktop 32).

```
┌─ AppShell ───────────────────────────────────────────────────────────────┐
│ Topbar:  … [search]    [🔔 NotificationBell ·badge]   [avatar]            │
│ Sidebar  ┌──────────────────────────────────────────────────────────────┐ │
│  (lg)    │  Notifications                                                │ │  ← Fraunces h2, text.primary
│          │  You're all caught up · 2 new            [✓ Mark all read]    │ │  ← summary line + ghost/secondary Button
│          │                                                              │ │
│          │  [ All ]  [ Unread · 2 ]                                      │ │  ← segmented Tabs / Chip filter (pill)
│          │ ───────────────────────────────────────────────────────────  │ │
│          │  Timeline                                                     │ │
│          │  ┌──────────────────────────────────────────────────────┐    │ │
│          │  │ ●  🎓  Your "Algebra II" results are ready            │    │ │  ← unread: spark dot + icon + title(600)
│          │  │       Nice work — see how you did.        2h ago  ⋯  │    │ │     body(secondary) · relative time(mono) · ⋯
│          │  └──────────────────────────────────────────────────────┘    │ │
│          │  ┌──────────────────────────────────────────────────────┐    │ │
│          │  │ ○  🔓  New space unlocked: "Dynamic Programming"      │    │ │  ← read: hollow dot, title weight 500
│          │  │       Ready when you are.                  1d ago  ⋯  │    │ │
│          │  └──────────────────────────────────────────────────────┘    │ │
│          │  ┌──────────────────────────────────────────────────────┐    │ │
│          │  │ ●  🔥  Keep your streak alive                         │    │ │  ← at-risk/streak nudge, supportive copy
│          │  │       A quick 5-min review keeps it going. 2d ago  ⋯  │    │ │
│          │  └──────────────────────────────────────────────────────┘    │ │
│          │  ── Earlier ──────────────────────────────────────────────    │ │  ← date-group separators (Today/Yesterday/Earlier)
│          │  …                                                            │ │
│          │           [ Load earlier notifications ]                      │ │  ← ghost Button, only if nextCursor
│          └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

**Regions:** (a) **Header** — title + one-line caught-up summary + "Mark all
read"; (b) **Filter row** — `All` / `Unread · n`; (c) **Timeline** —
date-grouped notification rows; (d) **Pagination footer** — "Load earlier" when
`nextCursor` present.

**Responsive:**

- **lg ≥ 1024:** Sidebar visible; single reading column centered; row meatballs
  (`⋯`) visible at rest.
- **md 768:** Sidebar collapsible; column full-width within gutters; `⋯` actions
  visible.
- **sm < 640:** Mobile Tabbar replaces Sidebar; bell stays in Topbar. Rows
  become full-bleed cards with larger touch targets (≥44px); per-row `⋯`
  collapses into a long-press / trailing swipe-to-read (see §10). Header summary
  wraps; "Mark all read" becomes a full-width secondary Button under the title.

**Bell Popover (companion, in Topbar):** a `Popover` (e3 elevation, radius.lg)
showing up to ~6 most-recent via `NotificationDropdown`, a "Mark all read"
affordance, and "View all" → `/notifications`. Same data, same row anatomy at
compact size.

---

## 4. Components used (FOUNDATION §5 only)

- **Navigation:** `AppShell`, `Sidebar`, `Topbar` (hosts the bell), `Tabbar`
  (mobile). `CommandPalette` (⌘K) is unaffected — web only.
- **NotificationBell** + its `Popover` + dropdown list (Topbar). Bell badge uses
  **Badge** (pill).
- **Containers:** `Tabs` (or `Chip`/`Tag` pair) for the All / Unread filter;
  `Popover` for the bell; `Tooltip` on icon-only actions; `Card`/row surface per
  notification.
- **Data:** **Timeline** (the date-grouped list spine), **Badge** (unread count
  on bell and on the `Unread · n` filter chip), **Skeleton** (loading),
  **EmptyState** (zero/zero-unread states), **Pagination** ("Load earlier"
  trigger), **Avatar** only if a notification carries a sender (not typical
  here), **DefinitionList** not used.
- **Primitives:** **Button** (`secondary` for "Mark all read", `ghost` for "Load
  earlier" and per-row "Mark read"), **IconButton** for the row `⋯` meatball and
  the per-row dismiss/mark control.
- **Feedback:** **Toast** (sonner) for "Marked all as read" confirmation + undo;
  **InlineAlert/Banner** for the partial/error state.
- **Domain components:** `AtRiskBadge` rendered inline on `student_at_risk` rows
  (paired with supportive copy). `StreakFlame` glyph as the leading icon for
  streak-reminder rows. `Achievement` thumbnail as the leading visual for
  achievement-style `system_announcement` rows. `XPMeter`/`LevelBadge` are NOT
  embedded here (they live on Dashboard) — this screen only _links_ to them.

**Proposed FOUNDATION additions (flagged, not invented into use):**

1. **`NotificationRow`** — a domain row primitive (leading type-icon + unread
   indicator, title, body, relative timestamp, trailing actions) shared by the
   page Timeline and the bell `NotificationDropdown`. Today both surfaces
   hand-roll the row; promoting it guarantees the bell and center stay visually
   identical. Until promoted, compose from Timeline + Card + Badge + IconButton.
2. **`RelativeTime`** — a tiny mono-numeric "2h ago / 1d ago / Jun 18" component
   with an `aria-label`/`title` carrying the absolute timestamp. Used here and
   in `SubmissionCard`/results. Until promoted, render with Spline Sans Mono per
   §3 and a `title` attr.
3. **`achievement_unlocked` notification type** — currently achievement nudges
   piggyback on `system_announcement`; a first-class type lets the row pick the
   `Achievement` visual + the one celebratory treatment deterministically.

---

## 5. States

- **Loading (skeleton):** Header renders immediately (static). Timeline shows
  4–6 `Skeleton` rows (leading dot + two text lines + a short mono time bar),
  warm `bg.surface-sunken` shimmer per `motion.base`. Filter chips render
  disabled. No layout shift when real rows arrive.
- **Empty — zero notifications ever:** centered `EmptyState` (Fraunces title,
  friendly illustration/icon). Copy in §7. No "Mark all read".
- **Empty — Unread filter, nothing unread:** distinct `EmptyState` celebrating
  the clean inbox ("You're all caught up"), with a `[ View all ]` link back to
  All.
- **Partial:** first page loaded, `nextCursor` present → "Load earlier
  notifications" Button. If a background refetch of the unread count fails but
  the list is fine, the page stays usable; the badge falls back to the last
  known count (no error chrome).
- **Error:** list fetch fails → `InlineAlert`/Banner (status.error icon + label,
  never color-only) inside the column with a `[ Try again ]` Button. Header
  still shows; filter chips disabled. Per §6 error model, copy derives from
  `ERROR_MESSAGES`.
- **Success:** date-grouped Timeline; unread rows visually distinct (see §6/§9);
  `Mark all read` enabled only when `unreadCount > 0`.
- **Role-gated variations:**
  - **B2B student:** notifications are tenant-scoped (`tenants/{tenantId}/...`);
    `recipientRole: 'student'`. Types include `new_exam_assigned`,
    `exam_results_released`, `student_at_risk`, `deadline_reminder`,
    `space_published`/`new_space_assigned`.
  - **B2C consumer:** active context is `platform_public`; no
    class/exam-assignment notifications. Surface is mostly `space_published`
    (store/library), `submission_graded` for owned spaces, achievement/streak
    nudges, and `system_announcement`. At-risk/class-deadline rows do not
    appear. The page renders identically; the feed is simply quieter.

---

## 6. Interactions & motion

- **Row click (deep-link + auto-read):** clicking a row navigates to `actionUrl`
  AND (if unread) fires `markRead` optimistically — the unread spark dot fades
  to the hollow read dot and the title de-emphasizes (weight 600→500) in
  `motion.fast` with `ease.standard`. The realtime badge decrements on RTDB
  settle; the optimistic UI doesn't wait for it. On mutation failure, the row
  silently reverts (it's low-stakes; no error toast for a single mark-read).
- **Per-row "Mark read" (`⋯` → Mark as read):** same optimistic dot transition,
  no navigation. Read→unread is not offered (notifications are not
  "unreadable").
- **Mark all read:** optimistic — all spark dots collapse to hollow together in
  one `motion.base` pass; header flips to "You're all caught up." A `Toast`
  confirms "Marked all as read" with a 5s **Undo**. Undo restores prior `isRead`
  flags (re-issues with the captured set). The realtime count zeroes on settle.
- **Filter switch (All ↔ Unread):** instant client-side re-query (`unreadOnly`);
  the active chip animates its underline/fill in `motion.fast`. Count on the
  `Unread · n` chip is the live RTDB value.
- **Load earlier:** ghost Button → next page appended below the date separators;
  new rows fade/slide-in subtly per `motion.base`/`ease.entrance`. Button shows
  an inline spinner while loading.
- **New notification arrives while viewing (realtime):** the badge count updates
  live; a subtle, non-celebratory `InlineAlert` pill appears at the top of the
  Timeline — "1 new notification — show" — rather than reordering under the
  user's cursor. Tapping it prepends the new row(s). This avoids jarring shifts
  and respects that motion here stays subtle.
- **Celebration boundary:** an **achievement-unlock** row (and only that) may
  carry the ONE celebratory moment — `CelebrationBurst` (spring pop + marigold
  `spark` burst) when the row is _first revealed_ (e.g., arriving live or first
  paint after unlock). Everywhere else on this screen motion is restrained per
  §4 durations/eases. At-risk, deadline, results, and space rows get NO burst —
  they are informative, not triumphant. Respect `prefers-reduced-motion`: bursts
  and slide-ins degrade to instant opacity.
- **Confirmations:** mark-all-read is reversible via Undo toast (no modal). No
  destructive deletes on this screen, so no `ConfirmDialog`.

---

## 7. Content & copy (warm, encouraging)

**Header**

- Title: **Notifications**
- Summary line (dynamic): `unreadCount > 0` → "You're almost caught up · **{n}
  new**"; `=== 0` → "You're all caught up — nothing new right now."
- Action: **Mark all read** (secondary). Aria-label "Mark all notifications as
  read."

**Filter chips:** `All` · `Unread · {n}`

**Date groups:** `Today` · `Yesterday` · `Earlier` (then month-day for older).

**Row titles & bodies by type (examples — server supplies title/body; these are
the tone target):**

- `exam_results_released` — "Your '{exam}' results are ready" · "Nice work
  getting through it — let's see how you did."
- `submission_graded` — "Your '{exam}' has been graded" · "Open it to view your
  feedback and where to focus next."
- `space_published` / `new_space_assigned` — "New space unlocked: '{space}'" ·
  "Ready when you are — no rush."
- `new_exam_assigned` — "A new test is waiting: '{exam}'" · "Take a look at the
  timing whenever you're ready."
- `deadline_reminder` — "'{exam}' is coming up soon" · "A little prep now makes
  it easier — you've got this."
- `student_at_risk` — "Let's give '{topic}' another look" · "A short review
  session can turn this around — start with one question." _(framed as a
  winnable nudge; never 'you are failing')_
- streak reminder (`system_announcement`) — "Keep your {n}-day streak going 🔥"
  · "Five minutes is all it takes to keep it alive."
- achievement (`system_announcement` / future `achievement_unlocked`) —
  "Achievement unlocked: {name}!" · "You earned this — well done."

**Relative time:** "Just now · 2h ago · 1d ago · Jun 18" (mono, with absolute
timestamp in `title`/aria).

**Empty — no notifications:** title "Nothing here yet" · body "When your teacher
publishes a space, releases results, or you unlock an achievement, it'll show up
here. Keep learning!" · subtle link "Back to dashboard."

**Empty — no unread:** title "You're all caught up" · body "No unread
notifications. Nice and tidy." · `[ View all ]`.

**Error:** title "We couldn't load your notifications" · body "This is on us,
not you. Give it another try in a moment." · `[ Try again ]`.

**Toasts:** "Marked all as read" + **Undo**. (Single mark-read is silent.)

---

## 8. Domain rules surfaced

- **One shared query feeds bell + page.** The `useNotifications` list and the
  `useUnreadCount` realtime badge are the single source for both the Topbar
  `NotificationBell` Popover and this center — they cannot disagree. The page's
  `Unread · n` chip and the bell badge read the same RTDB count.
- **Realtime badge is RTDB-derived, list is callable-derived.** The count comes
  from `notifications/{tenantId}/{userId}/unreadCount` (cheap, push-updated);
  the row content comes from `v1.identity.manageNotifications action:'list'`.
  Optimistic mark-read updates the UI immediately; the badge reconciles on RTDB
  settle (the RTDB value is authoritative for the number, the optimistic UI is
  authoritative for _this_ row's appearance).
- **Tenant isolation.** B2B reads are tenant-scoped; `tenantId` is derived from
  the active-tenant claim server-side, never sent in the body. B2C resolves to
  the synthetic `platform_public` context + `user.consumerProfile`. A learner
  only ever sees their own `recipientId` rows.
- **No answer keys, ever — and no premature results.** Notifications deep-link
  to entities but carry no protected content. A
  `submission_graded`/`exam_results_released` row only links to results the
  server has actually released (the results projection is gated server-side per
  `resultsReleased`); the notification itself is never created for an
  unreleased/locked assessment, so this surface cannot leak a score or an answer
  key. If a linked exam is still locked, the target page enforces the
  `AnswerKeyLock` state — the notification does not bypass it.
- **Timer is not this screen's concern**, but a `deadline_reminder` must never
  imply a client-trusted countdown — copy stays soft ("coming up soon"), and the
  authoritative timing lives on the timed-test screen (server `serverDeadline`).
- **Celebration is reserved.** Only achievement-unlock rows may trigger
  `CelebrationBurst`; informational nudges (at-risk, deadline, results) stay
  subtle. At-risk framing is supportive, never punitive (student tone is a hard
  rule).

---

## 9. Accessibility

- **Unread is encoded by icon + text, NOT color alone.** Each unread row carries
  (a) a filled `spark` dot vs hollow read dot (shape difference), (b) a heavier
  title weight, and (c) an `sr-only` "Unread —" prefix on the accessible name.
  The `Unread · n` filter chip states the count in text. (Conforms to §2 "never
  encode status by color alone.")
- **Live region for new arrivals:** an `aria-live="polite"` `aria-atomic="true"`
  region announces incoming count changes ("1 new notification") — mirroring the
  bell's existing live-region pattern (`NotificationBell.tsx`). The bell's
  `sr-only` "{n} unread notifications" is the canonical announcement; the page
  region announces deltas, not the full count, to avoid chatter.
- **Focus order:** Header (title → Mark all read) → filter chips → first
  Timeline row → … → Load earlier. Each row is a single focusable element (the
  whole row is the link); the per-row `⋯`/Mark-read is reachable as a secondary
  focus stop within the row (roving or explicit tab).
- **Keyboard:** rows are buttons/links — `Enter`/`Space` activates the deep-link
  (and marks read). `⋯` menu opens with `Enter`, navigable with arrows, `Esc`
  closes. Filter chips are a `tablist`/toggle group (arrow keys move between
  All/Unread). "Mark all read" and "Load earlier" are standard buttons. The bell
  `Popover` traps focus while open and returns focus to the bell on close.
- **ARIA:** Timeline is a `list`/`feed` with `role="list"`; each row
  `role="listitem"` (or `article` within a `feed`). New-arrival pill is
  `role="status"`. Time stamps expose the absolute time via `title` +
  `aria-label`. Icon-only `⋯` has an accessible label ("More actions for
  {title}").
- **Contrast:** all text/badge pairs meet WCAG AA (4.5:1 body, 3:1 UI) per §2;
  the unread `spark` dot is decorative (the text prefix carries the meaning), so
  its contrast is not load-bearing.
- **Reduced motion:** `prefers-reduced-motion` disables the `CelebrationBurst`,
  the slide-in of new rows, and the dot-transition animation (instant state
  change instead). Per §4.

---

## 10. Web ↔ mobile divergence (per FOUNDATION §6)

- **Shell:** web has Sidebar + Topbar bell + ⌘K `CommandPalette`; **mobile has
  bottom `Tabbar`**, Topbar bell, and **no command palette**.
- **Rows:** web rows expose the `⋯` meatball at rest with **hover** affordances;
  mobile uses **press** + an optional **swipe-left → Mark as read** gesture (and
  long-press for the actions sheet). Touch targets ≥44px; rows are full-bleed
  cards.
- **Mark-all / Load-earlier:** web shows them inline (text button in header /
  ghost button in footer); mobile promotes "Mark all read" to a full-width
  button under the header and uses **pull-to-refresh** + infinite-scroll instead
  of an explicit "Load earlier" button where idiomatic.
- **Bell Popover → Sheet:** the Topbar bell opens a `Popover` on web; on mobile
  the same `NotificationDropdown` content opens as a bottom `Sheet/Drawer`.
- **Realtime:** identical contract — both subscribe to the same RTDB
  `unreadCount` via the `subscribe()` seam; RN uses the native Firebase listener
  behind `shared-firebase`, web uses the web SDK. Component names/props match
  1:1 (`NotificationBell`, `NotificationRow` if promoted).
- **Celebration:** web `CelebrationBurst` uses framer-motion; RN uses Reanimated
  `spring` — same token-defined feel (§4), one celebratory moment,
  reduced-motion honored on both.

---

## 11. Claude-design prompt (ready to paste)

```
Design the STUDENT "Notifications" center for the Auto-LevelUp learner web app, conforming
strictly to the Lyceum design system (Direction A — "Modern Scholarly"; see
docs/rebuild-spec/design/00-FOUNDATION.md). Compose ONLY from Lyceum tokens and components —
do not invent colors, fonts, spacing, radii, shadows, motion, or variants. Cite tokens by
semantic name.

CONTEXT
- Route /notifications inside AppShell (Sidebar + Topbar on web; Topbar + bottom Tabbar on
  mobile). The Topbar hosts a NotificationBell with an unread Badge; the bell Popover and this
  page share ONE query + ONE realtime unread count, so they never disagree.
- Audience: a learner (B2B school student OR B2C consumer). Tone is WARM and ENCOURAGING —
  nudges (at-risk, streaks, deadlines) frame a winnable next step, never punishment.

LAYOUT
- Single reading column (~720) centered in the canvas gutter (16/24/32). Regions:
  (1) Header: Fraunces "Notifications" title + a one-line "caught up" summary + a secondary
      "Mark all read" button.
  (2) Filter row: All | Unread·n (segmented Tabs/Chips, count from live RTDB).
  (3) Timeline: date-grouped rows (Today / Yesterday / Earlier).
  (4) Footer: ghost "Load earlier notifications" button when more pages exist.

NOTIFICATION ROW (shared with the bell dropdown)
- Leading: a type icon; unread rows ALSO show a filled marigold `spark` dot, read rows a hollow
  dot (shape difference, NOT color alone). Title in Schibsted Grotesk (weight 600 unread / 500
  read), body in text.secondary, relative time in Spline Sans Mono (with absolute time in title/aria).
- Trailing: a `⋯` IconButton (Mark as read / open). Whole row is the deep-link to actionUrl.
- Use AtRiskBadge inline on at-risk rows, a StreakFlame glyph for streak nudges, and an
  Achievement visual for achievement rows.

STATES: skeleton (4–6 rows), empty (no notifications) + empty (no unread, "You're all caught
up"), error InlineAlert with Try again, partial (Load earlier), success.

MOTION: subtle everywhere (motion.fast/base, ease.standard/entrance). The ONE celebratory moment
— a CelebrationBurst spring pop + marigold spark burst — is reserved for an achievement-unlock
row only. Mark-read fades the spark dot to hollow optimistically; Mark-all-read collapses all
dots together + shows a Toast with Undo. New live arrivals announce via aria-live and offer a
non-jarring "1 new — show" pill at the top (no auto-reorder). Honor prefers-reduced-motion.

DOMAIN RULES: tenant-scoped (B2B) / platform_public (B2C); notifications carry no protected
content and only link to RELEASED results (never bypass AnswerKeyLock); deadline copy stays soft
(timer is server-authoritative, not implied here); celebration reserved for achievements only.

A11Y: unread by icon+text+weight (not color); aria-live polite for new-count deltas; row =
single focusable link, ⋯ a secondary stop; filter is a toggle group (arrow keys); WCAG AA
contrast; reduced-motion degrades bursts/slides to instant.

Deliver responsive web (sm 640 / md 768 / lg 1024): on mobile use bottom Tabbar (no ⌘K),
press + swipe-to-read on rows, full-width "Mark all read", pull-to-refresh + infinite scroll,
and the bell content as a bottom Sheet. Reference 00-FOUNDATION.md §2–§5 for every token and
component used.
```
