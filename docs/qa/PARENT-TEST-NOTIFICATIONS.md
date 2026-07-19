# Parent test / assignment notifications

## Create path

| Producer                       | Path                                                                  | Parent notify?                                                                                        |
| ------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `v1.levelup.assignContent`     | `packages/services/src/levelup/assign.ts` → `emitNotificationService` | **Yes** — fans out to student + linked parent `authUid`s (`new_exam_assigned` / `new_space_assigned`) |
| Autograde `onExamPublished`    | `functions/autograde/src/triggers/on-exam-published.ts`               | **Yes** — resolves `student.authUid` / `parent.authUid` (redeploy required)                           |
| Outbox drain                   | `packages/services/src/notification/triggers.ts`                      | Uses canonical types; parent only if `recipientUids` include parent auth UIDs                         |
| Legacy `sendBulkNotifications` | identity/autograde notification-sender                                | Dual-writes `recipientUid` + `recipientId`                                                            |

## `listNotifications` 500 (fixed)

Root cause: service queried `recipientUid` + `orderBy(createdAt)` but deployed
Firestore composites only covered legacy `recipientId`. That raised
`FAILED_PRECONDITION` → `INTERNAL_ERROR` (500).

Fix in `listNotificationsService`:

1. Equality-only queries (no `orderBy(createdAt)`), merge `recipientUid` +
   legacy `recipientId`
2. Defensive `projectNotification` (legacy types / missing `readAt` / payload →
   strict schema)
3. Added `recipientUid` composites in `firestore.indexes.json` (deploy when
   able)

## Demo heal

```bash
node scripts/heal-parent-test-notification.mjs
```

Writes `ntf_greenwood-parent-aarav-test_handover01` for Suresh → Aarav
assigned-test copy. Does **not** rewrite `tenantCodes`.

## Verify

```bash
npx playwright test -c tests/e2e/qa-parent-test-notifications.config.ts
```

Screenshots: `tmp/qa-parent-notify-*.png`
