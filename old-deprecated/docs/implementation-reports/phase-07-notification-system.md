# Phase 7: Notification System (In-App Notifications) — Implementation Report

## Summary

Built a complete in-app notification system with Firestore persistence, RTDB
real-time delivery, Cloud Function triggers, and frontend UI across all 4 tenant
apps. Notifications are created server-side by Cloud Functions and delivered in
real-time via RTDB unread count subscriptions.

---

## 1. Files Created

| File Path                                                           | Purpose                                                                                   |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `packages/shared-types/src/notification/notification.ts`            | Notification, NotificationType, NotificationPreferences, NotificationRTDBState interfaces |
| `packages/shared-types/src/notification/index.ts`                   | Barrel export                                                                             |
| `functions/identity/src/notifications/notification-sender.ts`       | Core sendNotification() + sendBulkNotifications() utility (identity codebase)             |
| `functions/identity/src/notifications/mark-notification-read.ts`    | Callable: mark single/all notifications read                                              |
| `functions/identity/src/notifications/get-notifications.ts`         | Callable: paginated notification retrieval with unread filter                             |
| `functions/autograde/src/utils/notification-sender.ts`              | Notification sender copy for autograde codebase                                           |
| `functions/levelup/src/utils/notification-sender.ts`                | Notification sender copy for levelup codebase                                             |
| `functions/analytics/src/utils/notification-sender.ts`              | Notification sender copy for analytics codebase                                           |
| `packages/shared-hooks/src/queries/useNotifications.ts`             | useNotifications, useUnreadCount, useMarkRead, useMarkAllRead hooks                       |
| `packages/shared-ui/src/components/layout/NotificationBell.tsx`     | Bell icon with unread badge + popover trigger                                             |
| `packages/shared-ui/src/components/layout/NotificationDropdown.tsx` | Scrollable dropdown grouped by Today/Yesterday/Earlier                                    |
| `packages/shared-ui/src/components/layout/NotificationsPage.tsx`    | Full-page notification list with All/Unread tabs                                          |
| `apps/teacher-web/src/pages/NotificationsPage.tsx`                  | Teacher notifications page                                                                |
| `apps/admin-web/src/pages/NotificationsPage.tsx`                    | Admin notifications page                                                                  |
| `apps/student-web/src/pages/NotificationsPage.tsx`                  | Student notifications page                                                                |
| `apps/parent-web/src/pages/NotificationsPage.tsx`                   | Parent notifications page                                                                 |

## 2. Files Modified

| File Path                                                         | Change                                                                      |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `packages/shared-types/src/index.ts`                              | Added `export * from './notification'`                                      |
| `packages/shared-hooks/src/queries/index.ts`                      | Added useNotifications, useUnreadCount, useMarkRead, useMarkAllRead exports |
| `packages/shared-ui/src/components/layout/index.ts`               | Added NotificationBell, NotificationDropdown, NotificationsPage exports     |
| `functions/identity/src/index.ts`                                 | Added markNotificationRead, getNotifications exports                        |
| `functions/autograde/src/callable/release-exam-results.ts`        | Added notification to students on exam results release                      |
| `functions/levelup/src/callable/publish-space.ts`                 | Added notification to students on space publish                             |
| `functions/analytics/src/schedulers/nightly-at-risk-detection.ts` | Added notifications to teachers + parents on newly at-risk students         |
| `functions/identity/src/callable/bulk-import-students.ts`         | Added notification to admin on import completion                            |
| `apps/teacher-web/src/layouts/AppLayout.tsx`                      | Added NotificationBell to headerRight                                       |
| `apps/admin-web/src/layouts/AppLayout.tsx`                        | Added NotificationBell to headerRight                                       |
| `apps/student-web/src/layouts/AppLayout.tsx`                      | Added NotificationBell to headerRight                                       |
| `apps/parent-web/src/layouts/AppLayout.tsx`                       | Added NotificationBell to headerRight                                       |
| `apps/teacher-web/src/App.tsx`                                    | Added `/notifications` route                                                |
| `apps/admin-web/src/App.tsx`                                      | Added `/notifications` route                                                |
| `apps/student-web/src/App.tsx`                                    | Added `/notifications` route                                                |
| `apps/parent-web/src/App.tsx`                                     | Added `/notifications` route                                                |
| `firestore.rules`                                                 | Added notification + notificationPreferences rules                          |
| `database.rules.json`                                             | Added /notifications/{tenantId}/{userId} rules                              |

---

## 3. Notification Types Defined

```typescript
type NotificationType =
  | "exam_results_released" // → student, parent
  | "new_exam_assigned" // → student
  | "new_space_assigned" // → student
  | "submission_graded" // → student, parent
  | "grading_complete" // → teacher
  | "student_at_risk" // → teacher, parent
  | "deadline_reminder" // → student
  | "space_published" // → students in class
  | "bulk_import_complete" // → admin
  | "ai_budget_alert" // → admin
  | "system_announcement"; // → all
```

### Notification Interface

```typescript
interface Notification {
  id: string;
  tenantId: string;
  recipientId: string; // Firebase Auth UID
  recipientRole: "teacher" | "student" | "parent" | "tenantAdmin";
  type: NotificationType;
  title: string;
  body: string;
  entityType?: "exam" | "space" | "submission" | "student" | "class";
  entityId?: string;
  actionUrl?: string; // Relative path for deep linking
  isRead: boolean;
  createdAt: FirestoreTimestamp;
  readAt?: FirestoreTimestamp;
}
```

---

## 4. Cloud Functions & Triggers

### Callable Functions (identity codebase)

| Function               | Description                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `markNotificationRead` | Marks single notification (by ID) or all unread notifications as read. Decrements/resets RTDB unreadCount. Uses batch writes for mark-all.        |
| `getNotifications`     | Returns paginated notifications (cursor-based via startAfter). Supports unreadOnly filter. Max 50 per page. Serializes Timestamps to ISO strings. |

### Trigger Integrations (5 integration points)

| Trigger Location                         | Event                         | Recipients                                                            | NotificationType        |
| ---------------------------------------- | ----------------------------- | --------------------------------------------------------------------- | ----------------------- |
| `autograde/release-exam-results.ts`      | Exam results released         | Students (by studentUid from submissions)                             | `exam_results_released` |
| `levelup/publish-space.ts`               | Space published               | Students in space.classIds (active, by authUid)                       | `space_published`       |
| `analytics/nightly-at-risk-detection.ts` | Student newly flagged at-risk | Teachers (via class→teacher lookup) + Parents (via student.parentIds) | `student_at_risk`       |
| `identity/bulk-import-students.ts`       | Bulk import complete          | Caller admin (by callerUid)                                           | `bulk_import_complete`  |

### Notification Sender Utility

- `sendNotification(payload)` — Writes single doc to Firestore, increments RTDB
  unreadCount via transaction, sets RTDB latest preview
- `sendBulkNotifications(recipientIds, basePayload)` — Batch writes (450 per
  batch), bulk RTDB updates, parallel unreadCount increments

All trigger integrations are **non-blocking** (wrapped in try/catch) —
notification failures never block the primary operation.

---

## 5. Frontend Components

### NotificationBell (`packages/shared-ui/src/components/layout/NotificationBell.tsx`)

- Renders a `Bell` icon (lucide-react) inside a `Popover` (shadcn/ui)
- Shows unread count badge (red, top-right corner): 1-9 as number, 10-99 as
  number, 99+ for overflow
- Click opens `NotificationDropdown` in popover
- Props: notifications[], unreadCount, isLoading, onNotificationClick,
  onMarkAllRead, onViewAll

### NotificationDropdown (`packages/shared-ui/src/components/layout/NotificationDropdown.tsx`)

- Grouped by date: Today / Yesterday / Earlier (sticky headers)
- Each notification shows: type emoji icon, title (bold if unread), body (2-line
  clamp), relative timestamp, blue dot for unread
- Click navigates to actionUrl and marks as read
- "Mark all as read" button in header
- "View all" link at bottom → navigates to /notifications
- ScrollArea with max-h-96 for overflow
- Empty state and loading spinner

### NotificationsPage (`packages/shared-ui/src/components/layout/NotificationsPage.tsx`)

- Full-page list inside a Card
- Tab filter: All | Unread (using shadcn Tabs)
- Each notification row: title, type badge, body, timestamp, "Mark read" button
- "Mark all as read" button in header
- "Load more" button for pagination
- Unread notifications highlighted with primary/5 background

### Hooks (`packages/shared-hooks/src/queries/useNotifications.ts`)

| Hook                                           | Description                                                                                                                   |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `useNotifications(tenantId, userId, options?)` | TanStack Query wrapping getNotifications callable. 30s staleTime. Supports unreadOnly and limit options.                      |
| `useUnreadCount(tenantId, userId)`             | Direct RTDB `onValue` subscription to `/notifications/{tenantId}/{userId}/unreadCount`. Returns number, updates in real-time. |
| `useMarkRead()`                                | useMutation wrapping markNotificationRead callable (single). Invalidates notification queries on success.                     |
| `useMarkAllRead()`                             | useMutation wrapping markNotificationRead callable (all). Invalidates notification queries on success.                        |

### App Integration

All 4 AppLayout files updated:

- Import NotificationBell from @levelup/shared-ui
- Import notification hooks from @levelup/shared-hooks
- Render NotificationBell as `headerRight` prop to AppShell
- Wire up onNotificationClick (mark read + navigate), onMarkAllRead, onViewAll

---

## 6. RTDB Integration

### Data Structure

```
/notifications/{tenantId}/{userId}/
  unreadCount: number          // Atomically incremented/decremented via transactions
  latest: {                    // Most recent notification preview
    id: string
    title: string
    type: NotificationType
    createdAt: number          // Unix timestamp ms
  }
```

### Write Path (Server-side)

- On `sendNotification()`: transaction increment unreadCount +1, set latest
- On `sendBulkNotifications()`: parallel transaction increments, batch latest
  updates
- On `markNotificationRead()` (single): transaction decrement unreadCount -1
  (min 0)
- On `markNotificationRead()` (all): set unreadCount to 0

### Read Path (Client-side)

- `useUnreadCount()` hook: `onValue` listener on
  `/notifications/{tenantId}/{userId}/unreadCount`
- Instant badge updates without polling
- Cleanup on component unmount or tenantId/userId change

### Security Rules

```json
"notifications": {
  "$tenantId": {
    "$userId": {
      ".read": "auth != null && auth.uid === $userId && auth.token.tenantId === $tenantId",
      ".write": false
    }
  }
}
```

---

## 7. Firestore Security Rules

```
/tenants/{tenantId}/notifications/{notifId}
  - read: auth.uid == resource.data.recipientId && belongsToTenant
  - update: auth.uid == resource.data.recipientId && only isRead/readAt fields
  - create/delete: false (Cloud Functions only via Admin SDK)

/tenants/{tenantId}/notificationPreferences/{userId}
  - read/write: auth.uid == userId && belongsToTenant
```

---

## 8. Design Decisions

### Notification Sender Duplication

Each Cloud Function codebase (identity, autograde, levelup, analytics) has its
own copy of `notification-sender.ts` because they are separate deployable units
with independent `node_modules`. A shared npm package could be extracted later
but the current approach avoids build complexity. The utility is ~100 lines and
stable.

### Non-blocking Triggers

All notification sends in existing functions are wrapped in try/catch with
`console.warn`. This ensures that notification failures (e.g., RTDB unavailable)
never break core operations like releasing exam results or publishing spaces.

### RTDB for Real-time Counts

Using RTDB (not Firestore onSnapshot) for unread counts because:

1. Lower latency for simple counter reads
2. Atomic transactions for increment/decrement
3. Cheaper at scale (RTDB charges per connection, not per read)
4. Already used in the platform for practiceProgress and leaderboards

### Cursor-based Pagination

`getNotifications` uses Firestore document cursors (startAfter) instead of
offset-based pagination for consistent results when new notifications arrive
during pagination.

### Server-side Notification Creation

All notifications are created by Cloud Functions (Admin SDK), never by clients.
This ensures:

1. Notifications can't be spoofed
2. Business logic (who gets notified) stays server-side
3. Firestore rules can safely deny client creates

---

## 9. Build Verification

- `shared-types` ✅ (tsup build with DTS)
- `shared-hooks` ✅ (tsup build)
- `shared-ui` ✅ (tsup build)
- `functions-identity` ✅ (tsc)
- `functions-autograde` ✅ (tsc)
- `functions-levelup` ✅ (tsc)
- `functions-analytics` ✅ (tsc)
- `teacher-web` ✅ (vite build)
- `super-admin` ✅ (vite build)
- `admin-web`, `student-web`, `parent-web` — Build blocked by pre-existing
  `DownloadPDFButton.tsx` firebase/functions resolution issue from concurrent
  session; notification code itself compiles cleanly
