# Scanner · Submit Confirm

> Lyceum (Modern Scholarly). Tokens/components by reference only — see
> `build/CORE-API.md`, `build/styles.css`, `build/components.css`. No raw hex,
> no banned fonts.

## 1. Purpose & user

The final step of the capture flow. A **scanner** operator (membership role
`scanner`) has photographed every page of one student's answer sheet and tapped
**Submit**. This screen runs the submit pipeline, then confirms the upload
succeeded — and gets them back to scanning the next student as fast as possible.
It must also gracefully communicate the three non-happy outcomes (duplicate,
offline-queued, exam-closed) without exposing any grading internals.

## 2. Entry / route

- Route: `#/scan/e/:examId/s/:studentId/done` (flow step 5).
- Reached from **submit-review** when the operator confirms the page set.
- Params: `{ examId, studentId }`.
- Reads from `ctx`: `selectedExam`, `selectedStudent`, `images[]` (page count),
  `online`. Falls back to local mock data so the card renders standalone.

## 3. Layout sketch

```
┌──────────────────────────────┐  ← SPA shell topbar + tabbar (NOT in view)
│  [PROGRESS OVERLAY on mount] │
│   ◐ Compressing images       │  stepper, ~600ms apart,
│   ◐ Uploading to storage     │  spinner → check per row
│   ◐ Creating submission      │
├──────────────────────────────┤
│  ✓  Submitted for grading    │  success panel (status-success)
│  ──────────────────────────  │
│  Exam      Mid-term · Algebra│  DefinitionList summary
│  Student   R. Sharma · R-014 │
│  Pages     4 pages           │
│  Time      14:32:07 (mono)   │
│  ──────────────────────────  │
│  [ Scan another student ]    │  primary
│  [ Back to exams ]           │  secondary
├──────────────────────────────┤
│  State preview tiles:        │  dev affordance to flip
│  ⟳ duplicate / offline / fail│  to the three error variants
└──────────────────────────────┘
```

## 4. Components used

- `Panel` / `Card` — success container.
- `Icon` `name="check-circle"` (status-success tint) — success mark.
- `DefinitionList` — exam / student / pages / submission-time summary; time in
  `--font-mono`.
- `Button` `variant="primary"` block — "Scan another student";
  `variant="secondary"` block — "Back to exams".
- `Alert` — error variants: `warning` (duplicate), `info` (offline), `error`
  (failed-precondition), each with an inline action link.
- `Badge` — small "Page N" / status chips.
- Card-local progress overlay (stepper) using `Icon` (`loader` spinner →
  `check-circle`) + `--spark`/`status-success`.
- Uses `ctx.toast` to echo each pipeline step.

## 5. States

| State                            | Trigger                        | Treatment                                                                                                                                         |
| -------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **submitting**                   | on mount                       | Full-bleed overlay stepper: Compressing → Uploading → Creating submission. Each row spinner → check ~600ms apart. Toast per step.                 |
| **success**                      | pipeline resolves OK           | Calm success panel + summary + 2 actions. Live region announces "Submitted for grading".                                                          |
| **duplicate** (`already-exists`) | server duplicate guard         | `Alert variant="warning"` — "Already submitted — this student was already scanned for this exam." + link **View in history** → `#/history`.       |
| **offline**                      | `ctx.online === false`         | `Alert variant="info"` — "You're offline — saved to the upload queue. It'll send automatically when you reconnect." + **View queue** → `#/queue`. |
| **failed-precondition**          | exam not `published`/`grading` | `Alert variant="error"` — "This exam isn't open for scanning right now." (no retry — operator must pick another exam).                            |
| empty pages (defensive)          | `images` empty                 | summary shows "0 pages"; success still allowed (card resilience).                                                                                 |

Status is **never** color-alone — every state pairs a lucide icon + text label.

## 6. Interactions

- On mount: kick the stepper via `setTimeout` chain (3 × ~600ms). After the last
  step, settle into the outcome state (success by default; in standalone the
  state-preview tiles let you flip to each error).
- "Scan another student" → `nav.go('#/scan/e/' + params.examId)` (returns to
  capture for a fresh student, same exam).
- "Back to exams" → `nav.go('#/scan')`.
- Duplicate "View in history" → `nav.go('#/history')`.
- Offline "View queue" → `nav.go('#/queue')`.
- All actions are full-width buttons / ≥44px touch targets.

## 7. Domain rules surfaced

- **Tenant model**: scanner is scoped to a tenant (`ctx.scanner.code`/`school`);
  the submission belongs to
  `tenants/{tenantId}/exams/{examId}/submissions/{id}`. The id is
  **server-allocated** — the frontend never writes the submission doc.
- **Server-side submit**: this view only reflects the result of the
  `uploadAnswerSheets` callable (region `asia-south1`). Compression (max 1920px,
  85% JPEG) + Storage upload happen before the callable; the stepper mirrors
  that pipeline.
- **Duplicate guard** is server-side (`already-exists`) and surfaced as a
  friendly warning, not a stack trace.
- **failed-precondition** maps to exam not in `published`/`grading` — phrased
  for operators, no internal codes.
- **Offline durability**: when offline the capture is held in the IndexedDB
  upload queue (survives tab close) and auto-retries on reconnect — this screen
  points the operator to the queue, it does not silently drop work.
- **Answer key is never shown** to the scanner anywhere on this screen.

## 8. Accessibility

- Outcome region is an `aria-live="polite"` announcement ("Submitted for
  grading" / error text).
- Progress stepper rows expose state via icon + visible label (not color), and
  `aria-busy` while spinning.
- All buttons/links ≥44px touch height; visible focus ring (`--ring-focus`).
- Mono submission time has an accessible label ("Submitted at …").
- Error alerts use `role="status"`/`alert` semantics via the DS `Alert`.

## 9. Web ↔ mobile note

Phone-first (390×844). On a wider intake/desktop kiosk the same view would
center the success panel in a max-width column and could pair "Scan another"
with a queued-uploads side rail; the action stack stays the primary CTA. The
submit pipeline, server-allocated id, and answer-key concealment are identical
across form factors.
