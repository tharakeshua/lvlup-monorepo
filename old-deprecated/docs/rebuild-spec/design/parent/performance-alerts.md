# Parent — Performance Alerts

**Purpose & user.** A parent (Anita Sharma) lands here to triage every
server-derived alert across her children. Alerts are produced by the nightly
at-risk review and the analytics pipeline — the parent never authors them, never
resolves them manually, and never sees an answer key. The screen answers one
question fast: _who needs my attention, and what do I do next?_

**Entry / route.** `#/alerts`. Reached from the sidebar (Alerts nav, error badge
`1`), the dashboard attention strip, and notification deep-links. Sidebar badge
count mirrors the number of actionable (non-positive) alerts.

## Layout (text wireframe)

```
Page header:  "Alerts"   sub: server-derived · updated 6h ago · [Nightly tag]
Filter chips:  [All] [Aarav] [Diya]                         (single-select)
─────────────────────────────────────────────────────────────
Alert list (cards, severity-ordered):
  ┌ [△ err]  Diya is at risk            <AtRiskBadge watch>   [chevron] [View progress]
  │          Declining scores · 0-day streak · 44% completion
  ├ [○ warn] Diya — Mathematics 48%                            [chevron] [View results]
  ├ [↧ warn] Diya — Science 44% complete                       [chevron] [View space]
  ├ [⏱ info] Diya — 0-day streak                               [chevron] [View progress]
  └ [✓ info] Aarav is on track                                 [chevron] [View progress]
─────────────────────────────────────────────────────────────
Empty-state variant (when a filtered child has no alerts):
  EmptyState "No alerts for Aarav" — on track, nothing flagged.
```

## Components used (CORE-API)

`Icon`, `Button`, `Chip` (filter chips, `active`), `AtRiskBadge`
(`level="watch"`), `Badge`, `Alert` (states rail), `EmptyState`, `Skeleton`,
`Avatar`. Severity icon-chips are screen-local (status-error/warning/info subtle
bg) — every color is paired with a lucide icon + text label, never color alone.

## States

- **Loading.** Skeleton list: 3–4 rows (icon chip circle + two text lines +
  action stub).
- **Empty (per child / global).** `EmptyState` "No alerts" with `shield-check`
  icon — happy path, the child is on track.
- **Error.** `Alert variant="error"` "Couldn't load alerts" with Retry;
  per-list, not full-screen.
- **Success.** Severity-ordered rows: at-risk (error) → low-score /
  low-completion (warning) → low-streak (info) → positive on-track (info).

## Interactions & flows

- Filter chips **All / Aarav / Diya** single-select, filter the list
  client-side; selecting a child with zero alerts shows the empty variant.
- Each row is a button → `go('#/...')`: at-risk → `#/children/diya/progress`;
  low-score → `#/children/diya/results`; low-completion →
  `#/children/diya/progress`; low-streak → `#/children/diya/progress`; on-track
  → `#/children/aarav/progress`.
- Trailing action button mirrors the row target (View progress / View results /
  View space).

## Domain rules

- **Released-only.** Score numbers (Math 48%) reflect released results
  exclusively; nothing draft/unreleased surfaces.
- **Answer-key-hidden.** No answer keys, rubrics, or correct answers ever shown
  to parents.
- **Server-derived.** Severity, reasons, and ordering come from the nightly
  review / analytics — read-only; the parent cannot dismiss, snooze, or resolve.
  Positive "on track" rows are derived signals too.

## A11y

- Each alert row is a single focusable `<button>` with an `aria-label` combining
  child + reason + status. Chevron and icon-chip are `aria-hidden`; meaning
  carried by text.
- Filter chips are a single-select group (`role="group"`,
  `aria-pressed`/`active`).
- Status conveyed by icon + label + color together (never color alone).
  Focus-visible ring on every row and chip; severity order matches DOM order for
  screen readers.
