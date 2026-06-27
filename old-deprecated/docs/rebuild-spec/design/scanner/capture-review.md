# Capture Review — Scanner (flow step 4)

> Anchors to the **Lyceum** design language and tokens defined in
> `00-FOUNDATION`. No tokens are duplicated here; reference by name only.

## Purpose & user

The **scanner** (a school staff member with the `scanner` membership role) has
captured/added the answer-sheet pages for one student on one exam. This screen
lets them **review the captured pages, reorder mentally, remove mistakes,
inspect any page full-screen, and submit the set to AutoGrade** — the final
confirmation step before the upload is enqueued. It is the gate between "I took
photos" and "the server owns a submission".

## Entry / route

- Route: `#/scan/e/:examId/s/:studentId/review` (flow step 4 of the scan flow).
- Entered from the **Capture** screen (step 3) after the scanner taps "Review N
  pages".
- Back (`nav.back()`) returns to capture so more pages can be taken.
- On submit → navigates to the **Done / confirmation** route
  (`#/scan/e/:examId/s/:studentId/done`).

## Layout sketch (390 wide)

```
┌───────────────────────────────────────┐  (SPA shell topbar + tabbar — NOT in view)
│ ‹ back   Calculus Midterm · Aanya R.   │  capture-review__header
│          4 pages captured              │
├───────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐                │  capture-review__grid (3 cols)
│ │  ⊠1 │ │  ⊠2 │ │  ⊠3 │   tile = tinted │
│ │ pg1 │ │ pg2 │ │ pg3 │   box + file-   │
│ └─────┘ └─────┘ └─────┘   image icon +  │
│ ┌─────┐                    page number  │
│ │  ⊠4 │   each tile has an (x) remove   │
│ │ pg4 │   IconButton overlay            │
│ └─────┘                                 │
│                                         │
│  ⓘ Pages upload in this order. Drag…    │  capture-review__hint
│                                         │
│  (scrolls)                              │
├───────────────────────────────────────┤
│  4 pages           [ Submit to Auto… ]  │  capture-review__bar (sticky bottom)
└───────────────────────────────────────┘
        ↑ Fullscreen viewer = Modal overlay
```

## Components used

- **DS:** `Button` (primary submit / danger remove-in-modal), `IconButton`
  (remove `x`, viewer nav `chevron-left`/`chevron-right`, close `x`), `Icon`
  (`file-image`, `info`, `wifi-off`, `arrow-left`), `Modal` (fullscreen viewer),
  `Badge` (page-number chip on tiles), `Alert`/inline note (order hint, offline
  note).
- **Card-local layout classes** (all prefixed `capture-`):
  `capture-review__header`, `capture-review__grid`, `capture-review__tile`,
  `capture-review__tile-remove`, `capture-review__page-no`,
  `capture-review__hint`, `capture-review__bar`, `capture-review__viewer`,
  `capture-review__viewer-strip`, `capture-review__thumb`.

## States

- **Default** — 1+ pages: grid renders tiles; submit enabled, label "Submit to
  AutoGrade".
- **Empty** — 0 pages: grid hidden, an `EmptyState`-style inline note; submit
  **disabled** with inline helper "Add at least one page" beside the bar.
- **Offline** (`ctx.online() === false`) — submit label becomes "**Queue for
  upload**" with a `wifi-off` note explaining captures are saved offline and
  retried on reconnect (IndexedDB-durable).
- **Viewer open** — Modal shows the large page, a thumbnail strip, left/right
  nav, a "page X of N" counter; Esc / close button / scrim dismisses.
- **Removing last page** — after removing the final tile, view falls back to the
  empty state and disables submit.

## Interactions

- Tap a tile → opens fullscreen viewer at that index.
- Viewer chevrons / thumbnail strip change the active page; counter updates;
  wraps clamp at ends.
- `Esc` or the close `x` or scrim click closes the viewer.
- Remove `x` on a tile (or "Remove page" in the viewer) → removes from local
  state **and** writes through `ctx.setImages(fn)` so the shared store and
  IndexedDB queue stay in sync; toasts a confirmation.
- Submit (enabled only when pages ≥ 1) →
  `nav.go('#/scan/e/<examId>/s/<studentId>/done')`. Offline simply changes the
  label; the durable queue handles the actual upload.

## Domain rules surfaced

- **Tenant model:** scanner is scoped to a tenant (`ctx.scanner.code`/`school`);
  submissions belong to `tenants/{tenantId}` while scanners are top-level. The
  view never writes a submission doc — submit is a hand-off.
- **Server-side submit:** the actual upload calls the `uploadAnswerSheets`
  callable (compress ≤1920px / 85% JPEG, upload to Storage, **server allocates
  the submission id**). The frontend never writes the submission doc directly;
  duplicate guard / `already-exists` and `failed-precondition` are handled
  downstream and surfaced as friendly toasts on the Done screen.
- **Answer key is never shown** to the scanner anywhere on this screen.
- **Offline-durable:** captures live in an IndexedDB-backed queue and survive
  tab close; the offline submit label communicates this.

## Accessibility

- Every status is **icon + text**, never color alone (offline note pairs
  `wifi-off` + label; hint pairs `info` + text).
- All interactive controls (tile, remove, viewer nav, close, submit) have ≥44px
  touch targets; `IconButton` carries an `aria-label`.
- Viewer Modal traps focus, is dismissible via `Esc`, and the counter is
  announced as text.
- Submit disabled state is conveyed by the visible helper text, not color alone.

## Web ↔ mobile note

This is a **mobile-first PWA** screen (390×844). On larger viewports the same
view widens the grid to more columns and the sticky submit bar becomes a
right-aligned action bar; the viewer Modal centers with a max-width. The teacher
web app reuses the viewer Modal pattern in grading review but with the answer
key visible — that variation is **out of scope** for the scanner role.
