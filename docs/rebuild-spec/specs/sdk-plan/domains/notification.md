# Notification Domain — Full Vertical-Slice Plan

> **Domain scope.** In-app notifications (per-user feed + read state),
> notification preferences (enabled-types + mute), the RTDB real-time unread
> **badge**, and **announcements** (platform/tenant broadcast with
> read-tracking). Spans the side-effect _producers_ (triggers that emit
> notifications) and the _consumer_ surface (list/mark-read/badge/preferences)
> the 8 apps render.
>
> **Live sources reconciled:**
> `packages/shared-types/src/notification/{notification.ts,announcement.ts,index.ts}`,
> `functions/identity/src/callable/{manage-notifications.ts,save-announcement.ts,list-announcements.ts}`,
> `functions/identity/src/notifications/notification-sender.ts` (+ **3 duplicate
> copies** under
> `functions/{analytics,autograde,levelup}/src/utils/notification-sender.ts`),
> the trigger callers (`on-space-published`, `on-exam-published`,
> `on-results-released`, `on-progress-milestone`, `finalize-submission`,
> `nightly-at-risk-detection`, `bulk-import-*`, `save-exam`).
>
> **The single biggest finding:** the notification-write logic
> (`sendNotification` / `sendBulkNotifications`, Firestore doc + RTDB badge
> increment) is **copy-pasted into 4 codebases**. The rebuild collapses this
> into **one** `@levelup/services/server` notification service (FAT shell,
> single writer of the badge), invoked by every trigger as a thin shell. This is
> the canonical "logic lives once" win for this domain.

---

## Domain entities (`@levelup/domain`)

All entities are **Zod-first `.strict()`**, types via `z.infer`, branded IDs,
ISO-8601 `Timestamp` (string). Module path: `@levelup/domain/notification`.

### Branded IDs (already partly present)

| Brand                           | Source                                                              | Note                                         |
| ------------------------------- | ------------------------------------------------------------------- | -------------------------------------------- |
| `NotificationId`                | exists (`branded.ts:67`, `asNotificationId:90`)                     | reuse                                        |
| `AnnouncementId`                | **NEW** — add `Brand<string,'AnnouncementId'>` + `asAnnouncementId` | live announcement IDs are bare `string` (D8) |
| `UserId`, `TenantId`, `ClassId` | exist                                                               | recipient + scope keys                       |

Cross-entity referent IDs reuse existing brands: `ExamId`, `SpaceId`,
`SubmissionId`, `StudentId`, `ClassId`.

### 1. `Notification` (feed item) — `NotificationSchema`

Collection: `/tenants/{tenantId}/notifications/{notificationId}` (unchanged
path).

| Field           | Type                                                           | Notes / drift reconciliation                                                                                                                                                                                                                                                                                                                                                       |
| --------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`            | `NotificationId`                                               | branded (was bare string, D8)                                                                                                                                                                                                                                                                                                                                                      |
| `tenantId`      | `TenantId`                                                     | branded                                                                                                                                                                                                                                                                                                                                                                            |
| `recipientUid`  | `UserId`                                                       | **DRIFT FIX (D12):** live doc writes `recipientId`, schema declared `recipientUid`. Canonicalize on **`recipientUid`** (auth uid), matching the `authUid`-not-`uid` rule (D3). Server migration shim reads either; contract emits `recipientUid` only.                                                                                                                             |
| `recipientRole` | `NotificationRecipientRole` enum                               | `'teacher' \| 'student' \| 'parent' \| 'tenantAdmin'`                                                                                                                                                                                                                                                                                                                              |
| `type`          | `NotificationType` enum (discriminant)                         | see enum below                                                                                                                                                                                                                                                                                                                                                                     |
| `payload`       | **discriminated union on `type`** (`NotificationPayloadUnion`) | **DRIFT FIX:** today `title`/`body` are free-text strings produced ad-hoc in 4 places. Promote to a real `z.discriminatedUnion('type', …)` carrying typed context per type (e.g. `exam_results_released → { examId, examTitle, score? }`). `title`/`body` become **server-rendered presentation fields** derived from the typed payload (single render table), so copy lives once. |
| `title`         | `string` (≤200)                                                | server-rendered from payload; client never authors                                                                                                                                                                                                                                                                                                                                 |
| `body`          | `string` (≤1000)                                               | server-rendered                                                                                                                                                                                                                                                                                                                                                                    |
| `entityType?`   | `NotificationEntityType` enum                                  | `'exam' \| 'space' \| 'submission' \| 'student' \| 'class'`                                                                                                                                                                                                                                                                                                                        |
| `entityId?`     | `string`                                                       | the referent id (validated server-side, review #11)                                                                                                                                                                                                                                                                                                                                |
| `actionUrl?`    | `string`                                                       | deep-link path                                                                                                                                                                                                                                                                                                                                                                     |
| `isRead`        | `boolean`                                                      | read state (server/owner-write only via markRead)                                                                                                                                                                                                                                                                                                                                  |
| `createdAt`     | `Timestamp` (ISO)                                              | **DRIFT FIX (D4):** live writes Firestore `serverTimestamp()`, callable already `.toISOString()`s on read; interface said `FirestoreTimestamp`. Canonical = ISO string at the edge; server adapter converts.                                                                                                                                                                       |
| `readAt?`       | `Timestamp \| null` (ISO)                                      | set on markRead                                                                                                                                                                                                                                                                                                                                                                    |

`NotificationType` enum (`as const`):
`exam_results_released · new_exam_assigned · new_space_assigned · submission_graded · grading_complete · student_at_risk · deadline_reminder · space_published · bulk_import_complete · ai_budget_alert · system_announcement`.

**No `ALLOWED_TRANSITIONS`** — the only lifecycle is `isRead: false → true`
(monotonic, one-way), enforced inline server-side. Documented as a degenerate
2-state machine (`unread → read`, terminal) but not a table entry.

### 2. `NotificationPreferences` — `NotificationPreferencesSchema`

Collection: `/tenants/{tenantId}/notificationPreferences/{userId}`. **No Zod
schema exists today** (REVIEW §4 "entities with NO schema"). Add it.

| Field          | Type                      | Notes                                                     |
| -------------- | ------------------------- | --------------------------------------------------------- |
| `id`           | `string` (== userId)      | composite-key doc id                                      |
| `tenantId`     | `TenantId`                | branded                                                   |
| `userId`       | `UserId`                  | branded; **DRIFT:** align on `authUid`/`UserId` semantics |
| `enabledTypes` | `NotificationType[]`      | allow-list; default = all types enabled                   |
| `muteUntil?`   | `Timestamp \| null` (ISO) | global mute window                                        |

### 3. `NotificationBadgeState` — `NotificationBadgeStateSchema`

RTDB path: `/notifications/{tenantId}/{userId}/`. This is the realtime **badge**
payload (was `NotificationRTDBState`; rename to `NotificationBadgeState` to
match the `SUBSCRIPTIONS` registry naming).

| Field         | Type                                                                                          | Notes                                                                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unreadCount` | `number` (int ≥0)                                                                             | server-maintained single-writer counter                                                                                                             |
| `latest?`     | `{ id: NotificationId; title: string; type: NotificationType; createdAt: number (epoch ms) }` | RTDB stays epoch-ms (it's RTDB, not Firestore); domain notes the deliberate exception, edge adapter exposes it as-is to the badge subscription only |

> This is the only place epoch-ms survives (D4) — justified: RTDB has no
> Timestamp type and the badge is a throwaway projection. The domain schema
> explicitly fences it (comment + `.brand` note) so it doesn't leak the
> trichotomy back into Firestore-backed entities.

### 4. `Announcement` — `AnnouncementSchema`

Collections: platform `/announcements/{id}` · tenant
`/tenants/{tenantId}/announcements/{id}`. **No Zod schema exists today** (REVIEW
§4). Add it.

| Field             | Type                                | Notes / drift                                                                                                                                                                                                                                                                                                                              |
| ----------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`              | `AnnouncementId`                    | branded (NEW)                                                                                                                                                                                                                                                                                                                              |
| `tenantId?`       | `TenantId \| null`                  | null ⇔ `scope:'platform'`                                                                                                                                                                                                                                                                                                                  |
| `title`           | `string` (≤200)                     |                                                                                                                                                                                                                                                                                                                                            |
| `body`            | `string` (≤5000)                    |                                                                                                                                                                                                                                                                                                                                            |
| `authorUid`       | `UserId`                            | **DRIFT (D3):** standardize on `authUid` naming — already `authorUid`, keep                                                                                                                                                                                                                                                                |
| `authorName`      | `string`                            | denormalized snapshot                                                                                                                                                                                                                                                                                                                      |
| `scope`           | `AnnouncementScope` enum            | `'platform' \| 'tenant'`                                                                                                                                                                                                                                                                                                                   |
| `targetRoles?`    | `NotificationRecipientRole[]` (≤10) | tenant-scoped targeting (was loose `string[]`)                                                                                                                                                                                                                                                                                             |
| `targetClassIds?` | `ClassId[]` (≤100)                  | branded                                                                                                                                                                                                                                                                                                                                    |
| `status`          | `AnnouncementStatus` enum           | `'draft' \| 'published' \| 'archived'` — **HAS `ALLOWED_TRANSITIONS`** (below)                                                                                                                                                                                                                                                             |
| `publishedAt?`    | `Timestamp \| null` (ISO)           |                                                                                                                                                                                                                                                                                                                                            |
| `archivedAt?`     | `Timestamp \| null` (ISO)           |                                                                                                                                                                                                                                                                                                                                            |
| `expiresAt?`      | `Timestamp \| null` (ISO)           |                                                                                                                                                                                                                                                                                                                                            |
| `readBy`          | **deprecated → subcollection**      | **DRIFT FIX (D6/D7):** live `readBy: string[]` is an unbounded FK-array rewritten on every read. Replace with read-tracking subcollection `/announcements/{id}/reads/{userId}` (`{ userId, readAt }`). The list response exposes a derived `isReadByMe: boolean`, never the array. (Migration: server dual-reads array during transition.) |
| `createdAt`       | `Timestamp` (ISO)                   | D4 fix                                                                                                                                                                                                                                                                                                                                     |
| `updatedAt`       | `Timestamp` (ISO)                   | D4 fix                                                                                                                                                                                                                                                                                                                                     |

### `ALLOWED_TRANSITIONS` (build-time-checked data, in `@levelup/api-contract`, sourced from these enums)

```ts
ALLOWED_TRANSITIONS.announcement = {
  draft: ["published", "archived"],
  published: ["archived"],
  archived: [], // terminal
} as const;
```

Notification read-state is **not** a transition table (degenerate monotonic
flag).

---

## API contract (`@levelup/api-contract`)

Module: `identity` (these callables live in **identity-fn**, per common-api
§3.3). All request schemas are `.strict()` and **declare NO `tenantId` field** —
tenantId derives from `ctx` claims (D2 fix). The live
`manageNotifications`/`saveAnnouncement`/`listAnnouncements` all currently take
`tenantId` from body — the rebuild strips it.

### Reads (replace direct Firestore reads + the list-mode of `manageNotifications`)

#### `v1.identity.listNotifications` _(split out of `manageNotifications.action:'list'`)_

- **name** `v1.identity.listNotifications` · **module** `identity`
- **request** `{ ...PageRequest }` (`cursor?`, `limit≤50`). No `tenantId`, no
  `recipientUid` (it's `ctx.uid`).
- **response** `pageResponse(NotificationListItemSchema)` →
  `{ items: Notification[], nextCursor, total? }`
- **authMode** `authed` · **rateTier** `read` · **idempotent** no ·
  **invalidates** none

#### `v1.identity.getNotificationBadge` _(NEW — non-realtime fallback read of the badge)_

- **request** `{}` · **response** `NotificationBadgeStateSchema` · **authMode**
  `authed` · **rateTier** `read`
- Lets web/RN render the badge once on load before the realtime subscription
  warms up.

#### `v1.identity.getNotificationPreferences` _(NEW)_

- **request** `{}` · **response** `NotificationPreferencesSchema` (returns
  defaults if no doc)
- **authMode** `authed` · **rateTier** `read`

#### `v1.identity.listAnnouncements` _(exists; tighten)_

- **request**
  `{ scope?: 'platform'|'tenant', status?: AnnouncementStatus, ...PageRequest }`
  — **`tenantId` removed** (scope derived from ctx: tenant scope uses
  `ctx.tenantId`; platform scope allowed for any authed user reading published,
  full status only for super-admin/tenantAdmin).
- **response** `pageResponse(AnnouncementListItemSchema)` where each item adds
  derived `isReadByMe: boolean` and resolves `publishedAt/expiresAt` to ISO
  (live returns raw `unknown` — D4 fix).
- **authMode** `authed` · **rateTier** `read`

### Writes

#### `v1.identity.markNotificationRead` _(split out of `manageNotifications.action:'markRead'`)_

- **request** discriminated:
  `{ mode: 'one', notificationId: NotificationId } | { mode: 'all' }` (replaces
  the ambiguous `notificationId?`+`markAllRead?` pair; `.strict()` union).
- **response** `{ unreadCount: number }` — returns the **authoritative** new
  badge count (was `{ success }`), so the optimistic client reconciles exactly.
- **authMode** `authed` · **rateTier** `write` · **idempotent** yes (re-marking
  a read notification is a no-op) · **invalidates**
  `['notifications','notificationBadge']`
- **On the conservative optimistic allow-list** (§5.5 of design: "notification
  mark-read").

#### `v1.identity.saveNotificationPreferences` _(NEW)_

- **request**
  `{ enabledTypes?: NotificationType[], muteUntil?: Timestamp|null }`
- **response** `NotificationPreferencesSchema`
- **authMode** `authed` · **rateTier** `write` · **idempotent** yes ·
  **invalidates** `['notificationPreferences']`

#### `v1.identity.saveAnnouncement` _(exists; tighten — combined create/update/delete)_

- **request**
  `{ id?: AnnouncementId, scope: AnnouncementScope, data: { title?, body?, targetRoles?, targetClassIds?, status?, expiresAt? }, delete?: boolean }`
  — **`tenantId` removed** (tenant scope ⇒ `ctx.tenantId`; platform scope ⇒
  super-admin only).
- **response** `{ id: AnnouncementId, created?: boolean, deleted?: boolean }`
- **authMode** `authed` · **rateTier** `write` · **idempotent** no (status
  transition is authority-sensitive) · **invalidates** `['announcements']`
- Status changes are **server-enforced** against
  `ALLOWED_TRANSITIONS.announcement` (not in the live code today).

#### `v1.identity.markAnnouncementRead` _(NEW — replaces client `readBy` array mutation)_

- **request** `{ announcementId: AnnouncementId }` · **response**
  `{ isReadByMe: true }`
- **authMode** `authed` · **rateTier** `write` · **idempotent** yes ·
  **invalidates** `['announcements']`
- **On the conservative optimistic allow-list** (mark-read class).

> **Combined-mode note (common-api §85).** common-api lists
> `manageNotifications.action` as a kept discriminated combined endpoint. This
> plan **splits it** into `listNotifications` + `markNotificationRead` because
> the two halves have different `rateTier` (read vs write), different
> `invalidates`, and only one is optimistic — keeping them combined forces a
> lying contract. If the orchestrator insists on parity with common-api, retain
> `v1.identity.manageNotifications` as a thin facade delegating to the two
> services. **Open question flagged below.**

### `SUBSCRIPTIONS` (realtime registry — already declared in SDK-SERVER-DESIGN §5.6)

```ts
'v1.notification.badge': { params: z.object({}), payload: NotificationBadgeStateSchema }
```

- `params` empty: tenant+uid come from the authed transport context
  (`/notifications/{tenantId}/{uid}`).
- Firestore-transport impl = RTDB listener on the badge path. The one realtime
  feature in this domain.

---

## Repositories (`@levelup/repositories`)

Per-entity repos + one cross-entity view repo. None import each other except the
declared view.

### `notificationRepo` (`createNotificationRepo(api)`)

| Method                                         | Behavior                                                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `list(filter?)`                                | `paginate(cursor => api.identity.listNotifications({ cursor, limit }))` — opaque cursor hidden, returns `Page<Notification>`.         |
| `getBadge()`                                   | `api.identity.getNotificationBadge()` — one-shot badge fallback.                                                                      |
| `markRead(notificationId)`                     | `api.identity.markNotificationRead({ mode:'one', notificationId })` → returns `{ unreadCount }`.                                      |
| `markAllRead()`                                | `api.identity.markNotificationRead({ mode:'all' })`.                                                                                  |
| `getPreferences()`                             | `api.identity.getNotificationPreferences()` (fills defaults: all types enabled, no mute).                                             |
| `savePreferences(input)`                       | `api.identity.saveNotificationPreferences(input)`.                                                                                    |
| `isTypeEnabled(prefs, type)` _(derived, pure)_ | client-side helper for settings UI; mirrors server mute/enable logic for instant UX.                                                  |
| `renderCopy(notification)` _(derived, pure)_   | view-model: returns `{ icon, label, accent }` per `type` for the feed UI — the **presentation** half; server still owns `title/body`. |

### `announcementRepo` (`createAnnouncementRepo(api)`)

| Method                                  | Behavior                                                                                                                                           |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list(filter?)`                         | `paginate(cursor => api.identity.listAnnouncements({ scope, status, cursor, limit }))` → `Page<AnnouncementListItem>` (each carries `isReadByMe`). |
| `save(input)`                           | `api.identity.saveAnnouncement(input)`.                                                                                                            |
| `remove(id)`                            | `api.identity.saveAnnouncement({ id, delete:true, scope })`.                                                                                       |
| `markRead(announcementId)`              | `api.identity.markAnnouncementRead({ announcementId })`.                                                                                           |
| `canTransition(from, to)` _(pre-check)_ | `ALLOWED_TRANSITIONS.announcement[from]?.includes(to) ?? false` — UI disables Publish/Archive without re-implementing the rule.                    |

### `notificationCenterRepo` _(cross-entity **view** repo — marked)_

Assembles the unified "notification center" view shown in the bell dropdown /
inbox across all 8 apps:

- `inbox()` — merges the **first page of notifications** + **unread
  announcements targeted at me** into one time-ordered view model, plus the
  badge `unreadCount`, in **one batched fan-out** (parallel
  `listNotifications` + `listAnnouncements(status:'published')` + `getBadge`),
  collapsing the N+1 the UI would otherwise do. Returns
  `{ items: InboxItem[], unreadCount }` where `InboxItem` is a discriminated
  `{ kind:'notification' } | { kind:'announcement' }`.
- This is the only place the two entities meet; per the design's "repos may not
  import each other except via declared view repos" rule,
  `notificationCenterRepo` depends on the two leaf repos.

---

## Query hooks (`@levelup/query`)

Query-key factories:

```ts
export const notificationKeys = {
  all: ["notifications"] as const,
  list: (f?) => [...notificationKeys.all, "list", f ?? {}] as const,
  badge: () => ["notificationBadge"] as const,
  prefs: () => ["notificationPreferences"] as const,
};
export const announcementKeys = {
  all: ["announcements"] as const,
  list: (f?) => [...announcementKeys.all, "list", f ?? {}] as const,
};
```

| Hook                               | Type                                                                                                                                            | Invalidates / behavior                                                                                                                                                                        | Optimistic?                                                  |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `useNotifications(filter?)`        | `useInfiniteQuery`                                                                                                                              | reads `notificationKeys.list`                                                                                                                                                                 | —                                                            |
| `useNotificationBadge()`           | `useSubscription('v1.notification.badge', {})` (realtime) with `useNotificationBadgeQuery()` one-shot fallback seeding `notificationKeys.badge` | live RTDB push                                                                                                                                                                                | —                                                            |
| `useMarkNotificationRead()`        | `useMutation`                                                                                                                                   | invalidates `notifications` + `notificationBadge`; **optimistically** flips `isRead` in the cached page and decrements badge `unreadCount`, reconciles to server's returned `{ unreadCount }` | ✅ **allow-list**                                            |
| `useMarkAllNotificationsRead()`    | `useMutation`                                                                                                                                   | same; optimistically zeroes badge + flips all cached items                                                                                                                                    | ✅ **allow-list**                                            |
| `useNotificationPreferences()`     | `useQuery`                                                                                                                                      | `notificationKeys.prefs`                                                                                                                                                                      | —                                                            |
| `useSaveNotificationPreferences()` | `useMutation`                                                                                                                                   | invalidates `notificationPreferences`                                                                                                                                                         | ❌ (settings write, round-trips)                             |
| `useAnnouncements(filter?)`        | `useInfiniteQuery`                                                                                                                              | `announcementKeys.list`                                                                                                                                                                       | —                                                            |
| `useSaveAnnouncement()`            | `useMutation`                                                                                                                                   | invalidates `announcementKeys.all`                                                                                                                                                            | ❌ **never** (publish/lifecycle transition — §5.5 exclusion) |
| `useMarkAnnouncementRead()`        | `useMutation`                                                                                                                                   | invalidates `announcements`; optimistically sets `isReadByMe:true` on cached item                                                                                                             | ✅ **allow-list** (mark-read class)                          |
| `useNotificationCenter()`          | `useQuery` over `notificationCenterRepo.inbox()`                                                                                                | merged inbox view-model                                                                                                                                                                       | —                                                            |

**Optimistic allow-list summary for this domain:** `markNotificationRead`,
`markAllNotificationsRead`, `markAnnouncementRead` (all mark-read, §5.5).
**Excluded:** `saveAnnouncement` (publish/lifecycle),
`saveNotificationPreferences` (settings round-trip). A lint rule flags any
optimistic config attached to `saveAnnouncement`.

---

## Server services (`@levelup/services/{shared,server}`)

Every service is `fn(input, ctx: AuthContext)`, never imports
`firebase-functions`. The `authorize()` policy keys come from `@levelup/access`.

### `services/server` (server-only — single writer of the badge + announcement lifecycle)

#### `emitNotificationService(input, ctx?)` — **THE consolidation** ⚷

Replaces the **4 duplicated** `sendNotification`/`sendBulkNotifications` copies.
The _only_ writer of the notification doc **and** the RTDB badge counter
(single-writer invariant). Triggers/schedulers/callables call it.

- `input`:
  `{ tenantId, recipients: { uid, role }[], type, payloadContext, entityType?, entityId?, actionUrl? }`
- Renders `title`/`body` from the **one** copy table keyed by `type` (kills the
  4-way copy drift).
- Writes Firestore batch (≤450/batch, preserving live batching) **and**
  transactionally increments each recipient's RTDB `unreadCount` + sets `latest`
  (single-writer per badge value, idempotent on `(tenantId, uid, dedupeKey)` to
  survive trigger retries).
- Respects `NotificationPreferences` (skips muted/disabled types) — **new**
  behavior the preferences type was created for but never wired.
- Server-only because it writes the authoritative badge counter (review #9
  denormalized counters).
- **policy:** internal (trigger-invoked); when called from a callable path,
  `authorize(ctx, 'notification.emit')`.

#### `markNotificationReadService(input, ctx)` ⚷ (badge counter)

- `authorize(ctx, 'notification.read.self')` — must own the notification
  (`recipientUid == ctx.uid`).
- `mode:'one'`: load doc, verify ownership, flip `isRead`+`readAt` if unread,
  **decrement** RTDB count.
- `mode:'all'`: batch-update all unread for `ctx.uid`, **reset** RTDB count
  to 0.
- Returns authoritative `{ unreadCount }`. Server is sole writer of the counter
  ⚷.

#### `saveAnnouncementService(input, ctx)` ⚷ (lifecycle)

- `authorize(ctx, 'announcement.manage')`: platform scope ⇒ `ctx.isSuperAdmin`;
  tenant scope ⇒ tenantAdmin/super-admin for `ctx.tenantId`.
- `assertTransition(existing.status → input.status, ALLOWED_TRANSITIONS.announcement)`
  — **server enforces** (absent in live code). Sets `publishedAt`/`archivedAt`
  from injected `ctx.now()`.
- `tenantId` from `ctx`, **never body** (D2). Validates `targetClassIds` exist
  in-tenant (review #11).
- **On publish:** enqueues `onAnnouncementPublished` outbox/trigger to fan-out
  `system_announcement` notifications to targeted recipients via
  `emitNotificationService` (reliable side-effect, not fire-and-forget —
  common-api §347).

#### `markAnnouncementReadService(input, ctx)`

- `authorize(ctx, 'announcement.read.self')`. Writes
  `/announcements/{id}/reads/{ctx.uid}` (subcollection, replacing the unbounded
  `readBy` array, D6). Idempotent.

### `services/shared` (client-safe reads — projection/shaping only, no authority writes)

#### `listNotificationsService(input, ctx)`

- Queries `recipientUid == ctx.uid` ordered `createdAt desc`, cursor-paginated;
  projects to ISO timestamps; `authorize(ctx, 'notification.read.self')`.

#### `getNotificationBadgeService(input, ctx)`

- Reads RTDB badge for `(ctx.tenantId, ctx.uid)`; returns
  `{ unreadCount, latest? }`.

#### `getNotificationPreferencesService` / `saveNotificationPreferencesService(input, ctx)`

- Read/upsert `/tenants/{ctx.tenantId}/notificationPreferences/{ctx.uid}`;
  defaults when absent. Save is client-safe (user owns their own prefs) but
  still `authorize(ctx, 'notification.prefs.self')`.

#### `listAnnouncementsService(input, ctx)`

- Resolves collection by `scope` (platform vs `tenants/${ctx.tenantId}`).
  Non-admin callers are forced to `status:'published'` and non-expired
  (`expiresAt > now`). Joins each item's read-doc to derive `isReadByMe` in one
  batched `getAll` (N+1 collapse). `authorize(ctx, 'announcement.read')`.

### `authorize()` policy keys used

`notification.emit` · `notification.read.self` · `notification.prefs.self` ·
`announcement.read` · `announcement.read.self` · `announcement.manage`.

---

## Function shells (callable / trigger / scheduler)

All in **identity-fn** (callables) + side-effect producers spread across
codebases. Every shell is thin over a service.

### `onCall` adapters (identity-fn)

Each: `ctx = buildAuthContext(request.auth)` →
`input = parseRequest(request.data, Schema)` → `service(input, ctx)`.

- `v1.identity.listNotifications` → `listNotificationsService`
- `v1.identity.markNotificationRead` → `markNotificationReadService`
- `v1.identity.getNotificationBadge` → `getNotificationBadgeService`
- `v1.identity.getNotificationPreferences` → `getNotificationPreferencesService`
- `v1.identity.saveNotificationPreferences` →
  `saveNotificationPreferencesService`
- `v1.identity.listAnnouncements` → `listAnnouncementsService`
- `v1.identity.saveAnnouncement` → `saveAnnouncementService`
- `v1.identity.markAnnouncementRead` → `markAnnouncementReadService`
- _(optional facade)_ `v1.identity.manageNotifications` → delegates by `action`
  to the two split services.

### Triggers (single-writer, idempotent, outbox) — all delegate to `emitNotificationService`

These are the notification **producers**, today each carrying its own duplicate
sender. The rebuild makes them thin shells that build a recipient list and call
the one service.

| Trigger                   | Codebase     | Type → recipients                                                     | Notes                                                                                                 |
| ------------------------- | ------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `onSpacePublished`        | levelup-fn   | `new_space_assigned`/`space_published` → students in assigned classes | replaces inline `save-space.ts` fire-and-forget + the trigger copy                                    |
| `onExamPublished`         | autograde-fn | `new_exam_assigned` → assigned students                               | from `on-exam-published.ts`                                                                           |
| `onResultsReleased`       | autograde-fn | `exam_results_released` → students + parents + author                 | from `on-results-released.ts`; multi-recipient bulk                                                   |
| `onSubmissionFinalized`   | autograde-fn | `submission_graded`/`grading_complete` → student + teacher            | from `finalize-submission.ts`                                                                         |
| `onProgressMilestone`     | analytics-fn | milestone/`student_at_risk` → student + admins + parents              | from `on-progress-milestone.ts`                                                                       |
| `onAnnouncementPublished` | identity-fn  | `system_announcement` → targeted roles/classes                        | **NEW** — reliable fan-out from `saveAnnouncementService` publish (outbox), replaces no-fan-out today |
| `onBulkImportComplete`    | identity-fn  | `bulk_import_complete` → initiating admin                             | from `bulk-import-{students,teachers}.ts` inline                                                      |

**Idempotency / single-writer:** `emitNotificationService` dedupes on
`(tenantId, recipientUid, entityType, entityId, type)` so trigger retries don't
double-notify or double-increment the badge. The RTDB counter is written only by
this service (single writer of the derived badge value).

**Outbox:** must-deliver notifications (results-released, announcement publish)
route through a transactional outbox / Firestore-trigger so a transient
RTDB/Firestore failure retries rather than the live `.catch(log)`
fire-and-forget (common-api §347, levelup report rec #6). No Cloud Tasks
orchestration needed (single-step fan-out); the outbox trigger suffices.

### Schedulers / cron

| Scheduler                              | Codebase                     | Service                                                                                                                                                               |
| -------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nightlyAtRiskDetection`               | analytics-fn                 | computes at-risk students → calls `emitNotificationService` (`student_at_risk`) — from `nightly-at-risk-detection.ts`; thin over the detection service + emit service |
| `deadlineReminderCron`                 | analytics-fn (or levelup-fn) | scans upcoming exam/test deadlines → `emitNotificationService` (`deadline_reminder`) — wires the existing `deadline_reminder` type that currently has no producer     |
| `expireAnnouncementsCron` _(optional)_ | identity-fn                  | flips `published → archived` for past-`expiresAt` announcements via `saveAnnouncementService` (server-side transition)                                                |

---

## Authority boundary (server-only ⚷)

Mapped to REVIEW §6 items:

| Field / operation                                                                       | Why server-only                                                                                                                        | REVIEW ref              |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `tenantId` for notifications/preferences/announcements                                  | claim-derived, never from request body (live takes it from body — D2)                                                                  | #1                      |
| RTDB **badge `unreadCount`** + `latest`                                                 | denormalized counter; single-writer = `emitNotificationService` / `markNotificationReadService`; SDK reads (realtime) but never writes | #9                      |
| `Notification` doc **creation** (`emitNotificationService`)                             | trigger-maintained side-effect; clients can never self-notify another user                                                             | #9, side-effects row §4 |
| `Notification.isRead` / `readAt`                                                        | only the owner via `markNotificationRead` (`recipientUid == ctx.uid`); not free client write                                           | #9                      |
| `title`/`body` rendering                                                                | server renders from typed payload; client never authors notification copy                                                              | —                       |
| `Announcement.status` lifecycle (`draft/published/archived`) + `publishedAt/archivedAt` | server-only transitions, `ALLOWED_TRANSITIONS`-enforced, results-style gating                                                          | #10                     |
| Announcement **publish authorization** (platform ⇒ super-admin; tenant ⇒ tenantAdmin)   | role from claims, not request                                                                                                          | #2, #3                  |
| `targetClassIds` referent existence                                                     | server existence-validates in-tenant                                                                                                   | #11                     |
| Announcement **read-tracking** (`/reads/{uid}` subcollection)                           | owner-write only; replaces client-mutable `readBy` array                                                                               | #3-style                |

SDK may **read** projections (feed, badge, `isReadByMe`) and **request**
mark-read/save, but the server computes and commits every authoritative value
above.

---

## Drift & open questions

### Drift reconciliations (from REVIEW)

- **D12 `recipientId` vs `recipientUid`:** live doc writes `recipientId`;
  schema/review say `recipientUid`. → Canonicalize on **`recipientUid`**
  (consistent with the `authUid`-not-`uid` rule D3). Server reads either during
  migration; contract emits `recipientUid` only.
- **D4 timestamp trichotomy:** Firestore `serverTimestamp()`
  (notifications/announcements) → **ISO at the edge** (callable already
  `.toISOString()`s on read; make it uniform). RTDB badge `createdAt` stays
  **epoch-ms** — the single fenced exception (RTDB has no Timestamp type).
- **D8 no branded IDs:** add `NotificationId` (exists) usage + **new
  `AnnouncementId`** brand; brand `recipientUid`/`tenantId`/`targetClassIds` in
  the persisted shapes.
- **D9 `.passthrough()` / no schema:** `NotificationPreferences` and
  `Announcement` have **no Zod schema today** (REVIEW §4) — author them
  Zod-first `.strict()`.
- **D6 `Announcement.readBy: string[]` (record/array-as-relation):** unbounded
  array rewritten per read → **`/announcements/{id}/reads/{uid}`
  subcollection**; expose derived `isReadByMe`.
- **Discriminated payload union:** `Notification.payload` becomes a real
  `z.discriminatedUnion('type', …)` (mirrors the `UnifiedItem.payload` fix the
  spec demands for content, §4.3) so each `type` carries typed context and
  `title/body` are rendered once.
- **D2 tenantId-from-body:** all three live callables take `tenantId` from body
  → removed; derived from `ctx`. (`saveAnnouncement` keeps a `scope` field but
  tenant scope binds to `ctx.tenantId`.)
- **4× duplicated `notification-sender.ts`**
  (identity/analytics/autograde/levelup) → one `emitNotificationService` in
  `@levelup/services/server`. **This is the domain's headline cleanup.**

### Open questions

1. **`manageNotifications` split vs facade.** common-api §85/§334 keeps
   `manageNotifications.action` as a combined discriminated endpoint; this plan
   **splits** it (different rateTier/invalidates/optimism). → Recommend split +
   optional thin facade for contract parity. **Needs orchestrator ruling.**
2. **Notification preferences enforcement point.** `enabledTypes`/`muteUntil`
   exist as types but are never read. → Recommend `emitNotificationService`
   filters recipients by their prefs at emit time (skip muted / disabled types).
   Confirm: should mute suppress the **doc** entirely, or write it
   `isRead`-style suppressed-from-badge? (Recommend: suppress the badge
   increment but still persist the doc, so the feed is complete and mute is
   non-destructive.)
3. **Badge realtime vs poll on RN.** `v1.notification.badge` is RTDB-listener
   today. Confirm the `getNotificationBadge` one-shot fallback is enough before
   the listener warms, and that RN uses the same RTDB listener via
   `transport-firebase` (no SSE in v1).
4. **`deadline_reminder` producer.** The type exists with no emitter. →
   Recommend a `deadlineReminderCron` scheduler; confirm which codebase owns
   deadline scanning (analytics vs levelup test-sessions).
5. **Announcement `targetRoles` type.** Live is loose `string[]`; tighten to
   `NotificationRecipientRole[]`? Confirm whether announcements can target
   staff/scanner roles beyond the 4 notification roles.
6. **Cross-tenant platform announcement notifications.** When a super-admin
   publishes a `platform` announcement, fan-out to _every tenant's_ users is a
   large job. → Recommend Cloud Tasks paginated fan-out (the one place
   multi-step orchestration may be warranted) rather than a single trigger.
