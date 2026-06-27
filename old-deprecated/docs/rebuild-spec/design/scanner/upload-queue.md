# Scanner · Upload Queue

> Lyceum (Modern Scholarly). Tokens/components by reference only — see
> `00-FOUNDATION.md`, `build/CORE-API.md`, `build/styles.css`,
> `build/components.css`. No raw hex, no banned fonts.

## 1. Purpose & primary user

The **offline-durable upload queue** for a **scanner** operator (membership role
`scanner`). After capturing a student's answer-sheet pages, the submit pipeline
hands the work to a device-local queue; this screen is where the operator
watches captures drain to AutoGrade, recovers failed uploads, and confirms
nothing is silently lost. The defining promise: **work is saved on this device
and survives closing the app** — uploads continue automatically when a
connection returns. It exposes upload mechanics only (status, progress,
retry/discard); it never surfaces grading internals or answer keys.

## 2. Entry / route

- Route: `#/queue` — the **Queue** tab in the scanner shell tabbar
  (`Scan · Queue · History`).
- Reached from any capture/submit flow that defers an upload (e.g.
  submit-confirm "View queue"), or directly via the tab.
- Common-API: items represent calls deferred to the **`uploadAnswerSheets`**
  callable (region `asia-south1`); the queue is backed by **IndexedDB
  persistence** so entries survive tab/app close.
- Reads from `ctx`: `queue[]`, `setQueue(fn)`, `online()`, `toast(...)`. Falls
  back to `UPLOAD_QUEUE_MOCK` so the card renders standalone. Each item:
  `{ id, status, exam, student, pages, progress?, error? }`.

## 3. Layout sketch (390px)

```
┌──────────────────────────────┐  ← scanner shell topbar + tabbar (Queue active)
│  Upload queue        [● Online]│  H1 + connectivity Badge (success/warning)
│  2 queued · 1 uploading ·     │  mono summary, dot-separated counts
│  2 failed · 1 done            │  ("done" only when nDone > 0)
│  [ ⟳ Retry all (2 failed) ]  │  secondary, block; disabled if nothing retryable
│  ┌────────────────────────┐  │
│  │ ▣ Saved on this device —│  │  hard-drive note (sunken surface):
│  │   survives closing app  │  │  offline-durability reassurance
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │  UploadQueueItem rows (list, gap-3):
│  │ ◐ Uploading · 64%      │  │   uploading → progress bar, static row
│  │ ✓ Uploaded             │  │   done/queued → static row
│  │ ⚠ Failed  [Retry] [🗑]  │  │   failed → red border + rowbar
│  │   Network timeout      │  │   failed row = tappable → detail modal
│  └────────────────────────┘  │
└──────────────────────────────┘
   ── empty ──   "Queue is clear" ✓ + [Scan a sheet → #/scan]
```

## 4. Components used

- `UploadQueueItem` — the per-item row: status icon, `name` (=
  `exam · student · N pages`), `progress` (uploading), `meta` status label.
- `Badge` — header connectivity chip: `variant="success" icon="wifi"` (Online) /
  `variant="warning" icon="wifi-off"` (Offline).
- `Button` — `secondary` block **Retry all (N failed)**; `ghost` per-row
  **Retry**; `secondary` **Scan a sheet** (empty); modal `primary` **Retry now**
  / `ghost` **Discard** / `secondary` **Close**.
- `IconButton` — per-row `trash-2` **Remove from queue**.
- `Modal` — `QueueDetailModal` (queue-item detail), title = status icon + label.
- `Icon` — lucide status set: `clock` (queued), `loader` (uploading),
  `check-circle-2` (done), `alert-triangle` (failed); `hard-drive` (device
  note), `cloud-check` (empty).
- `EmptyState` pattern (card-local `.upload-queue__empty`) — "Queue is clear".
- `Tabbar` — scanner shell nav (Queue active).

## 5. States

| State                     | Trigger               | Treatment                                                                                                                                                                            |
| ------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **queued**                | waiting in line       | `clock` + "Queued"; static row; detail says "Pages will upload automatically" (+ "once you reconnect" when offline).                                                                 |
| **uploading**             | pages streaming up    | `loader` + "Uploading"; row shows `progress` %; detail explains server allocates the submission once all pages arrive.                                                               |
| **done**                  | callable resolved OK  | `check-circle-2` + "Uploaded"; static row; detail: "AutoGrade has received all N pages."                                                                                             |
| **failed**                | upload/callable error | `alert-triangle` + "Failed"; **red border**, inline error text, **Retry** + remove rowbar; row is tappable → detail with full error + Discard/Retry.                                 |
| **empty — "queue clear"** | `items.length === 0`  | `cloud-check` (success tint), "Queue is clear", reassurance copy, **Scan a sheet** CTA.                                                                                              |
| **offline**               | `online() === false`  | header Badge → warning "Offline"; all **Retry**/**Retry now** buttons disabled; "Retry all" shows a warning toast instead of acting; detail notes "Retry is disabled while offline." |

Status is **never** color-alone — every state pairs a lucide icon + text label.

## 6. Interactions & motion

- **Retry all** — re-queues every `failed` item (`status → queued`, clears
  `error`), toast "Retrying all". If offline, no-op + warning toast "Items will
  retry automatically when you reconnect." Disabled when
  `retryable (failed + queued) === 0`.
- **Per-item retry** — single failed item back to `queued`, toast "Re-queued".
  Disabled offline.
- **Per-item remove** — `trash-2` drops the item from the queue, toast "Removed
  from queue — these pages were discarded from this device."
- **Queue-item detail modal** — tapping a failed row opens `QueueDetailModal`:
  exam/student/pages, error block, and status-appropriate footer (failed →
  Discard + Retry now; others → Close). Re-queue/remove close the modal.
- **Auto-retry on reconnect** — the queue drains automatically when `online()`
  returns true; the operator does not have to manually retry (manual retry is a
  recovery affordance, not the primary path).
- Motion: row `border-color`/`box-shadow` transitions on
  `--dur-fast`/`--ease-standard`; focus ring via `--ring-focus`. No gratuitous
  animation — uploading uses a quiet progress indicator.

## 7. Domain rules surfaced

- **Offline-durable IndexedDB** — the queue persists in IndexedDB and **survives
  tab/app close**; the `hard-drive` note states this plainly so the operator
  trusts that captures aren't lost.
- **Server-side submit** — each item is a deferred **`uploadAnswerSheets`**
  callable in region **`asia-south1`**; the submission id is
  **server-allocated** (the client never writes the submission doc). The
  frontend only reflects upload status.
- **Duplicate guard** — a server-side `already-exists` outcome is surfaced as a
  friendly per-item failure (re-queue/discard), never a stack trace.
- **Tenant isolation** — the queue and its uploads are scoped to the scanner's
  tenant (`ctx.scanner.code`/`school`); items belong under
  `tenants/{tenantId}/exams/{examId}/submissions/...` server-side.
- **No grading internals / answer key** anywhere on this screen.

## 8. Accessibility

- Each row's status is conveyed by **icon + visible label** (e.g.
  `alert-triangle` + "Failed"), not color alone; the red failed border is
  supplementary.
- Failed rows are real `<button>` hit targets with `aria-label` "Open details
  for {student} — {status}"; visible `--ring-focus` on `:focus-visible`.
- `IconButton` remove and per-row `Button` carry descriptive labels ("Remove
  {student} from queue"); modal focus is trapped and returns on close.
- Connectivity changes (Online/Offline) and queue mutations are echoed via
  `ctx.toast` (live-region) so screen-reader users hear re-queue/removal
  outcomes.
- All actionable controls meet **≥44px** touch height.

## 9. Web ↔ mobile note

Phone-first (390×844). On a desktop intake kiosk the same queue becomes a
centered max-width list (or a side rail alongside a live scan view), with hover
affordances replacing tap-to-open-detail; bulk **Retry all** and per-item
recovery stay identical. The IndexedDB durability, `uploadAnswerSheets` callable
(asia-south1), server-allocated ids, duplicate guard, and tenant scoping are the
same across form factors — only layout density and the open-detail gesture
differ.
