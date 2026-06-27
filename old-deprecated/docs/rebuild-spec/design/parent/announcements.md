# Parent — Announcements

## Purpose & user

A read-only feed of school, class, and exam announcements for the parent (Anita
Sharma) at Beacon Hill Academy (BHA-204). Parents consume announcements; they
cannot post, edit, or reply. The screen helps a parent stay informed about
meetings, released results, and school events relevant to their children (Aarav,
Diya).

## Entry / route

- Hash route: `#/announcements`
- Sidebar nav: Overview → Announcements (icon `megaphone`).
- Reached from dashboard quick-links and notification deep-links.

## Layout (text wireframe)

```
┌ Page header ─────────────────────────────────────────────┐
│ Announcements                                             │
│ Updates from Beacon Hill Academy · BHA-204               │
├ Filter chips ────────────────────────────────────────────┤
│ [All] [School] [Class] [Exam]                            │
├ Pinned / featured card ──────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [Pinned] [School]                                     │ │
│ │ Parent-Teacher Meeting — June 28                      │ │
│ │ Principal's Office · 12 Jun 2026 (mono)               │ │
│ │ Full body text shown (featured is always expanded).   │ │
│ └─────────────────────────────────────────────────────┘ │
├ Feed (grouped by recency) ───────────────────────────────┤
│ This week                                                │
│  ▸ [Exam]  Grade 9 DSA unit exam results released        │
│            Mr. Rao · 18 Jun 2026 (mono)                  │
│            One-line excerpt…             [chevron]       │
│  ▸ [Class] Annual Day rehearsals                          │
│            Ms. Kapoor · 17 Jun 2026 (mono)               │
│ Earlier                                                  │
│  ▸ [School] Library timings updated for summer term      │
│  ▸ [School] Fee receipt portal maintenance window        │
└──────────────────────────────────────────────────────────┘
```

Each feed row is an accordion item: clicking the row (or chevron) expands full
text inline.

## Components used (CORE-API)

- `Chip` — category filters (All/School/Class/Exam) + inline category tags.
- `Badge` — `Pinned` marker on featured card; category badge variants.
- `Card` chrome (screen-local `.acard`) — featured + feed container.
- Custom expand (controlled `useState` open id) — accordion behavior.
- `Icon` — `megaphone`, `pin`, `chevron-down`/`chevron-right`, category glyphs.
- `EmptyState` — empty / filtered-empty.
- `Skeleton`, `Alert` — loading / error states.

## States

- **Loading:** header + 3 skeleton feed rows (text + circle skeletons).
- **Empty (no announcements):** `EmptyState` icon `megaphone`, "No announcements
  yet", body "When Beacon Hill posts updates, they'll appear here."
- **Empty (filtered):** `EmptyState` icon `filter`, "No <category>
  announcements", with a "Clear filter" ghost action.
- **Error:** `Alert variant="error"` "Couldn't load announcements" + Retry.
- **Success:** pinned card + grouped feed.

## Interactions & flows

- Filter chips set active category (single-select). `All` resets. Filtering
  re-renders the feed; the pinned card stays if it matches the active filter,
  else hides.
- Clicking a feed row toggles inline expansion (single open id via `useState`;
  opening one collapses others — accordion). Chevron rotates (`chevron-right` →
  `chevron-down`).
- "Released results" exam announcement includes a ghost CTA `View results` →
  `go('#/children/aarav/results/ex_midterm')`.
- No compose / reply / edit affordances anywhere (read-only).

## Domain rules

- **Released-only:** exam announcements reference results only after release; no
  in-progress exam content surfaces.
- **Answer-key-hidden:** announcement bodies never expose answer keys, rubrics,
  or per-question keys — only summary text + a link to the released results
  screen.
- **Server-derived:** all items, ordering, recency grouping, and the pinned flag
  are server-authoritative; the parent cannot reorder or pin.

## A11y

- Page `<h1>` "Announcements"; feed grouped under `<h2>` recency labels.
- Filter chips in a `role="group"` with `aria-pressed` on active chip.
- Each accordion trigger is a `<button>` with `aria-expanded`, `aria-controls`,
  pointing to the panel `id`; panel has `role="region"`.
- Category color always paired with an icon + text label (never color alone).
- Date stamps use `--font-mono`; visible focus ring (`--ring-focus`) on all
  interactive rows.
- `prefers-reduced-motion`: disable chevron/expand transitions.
