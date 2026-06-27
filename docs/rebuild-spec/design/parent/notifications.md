# Parent · Notifications

> Lyceum (Modern Scholarly). Account-area notification center for the parent.
> Released-only events; never exposes answer keys or unreleased scores.

## Purpose & user

A parent (Anita Sharma) reviews a single, chronological feed of school events
about her children — exam results released, at-risk flags, school announcements,
and the weekly digest. She can filter to unread and clear the inbox. Every item
links to a screen she is already permitted to see; the notification itself
carries no protected content.

## Entry / route

- Route: `#/notifications`
- Reached from: sidebar `Notifications`, topbar bell `IconButton`, "View all" on
  dashboard notifications card.

## Layout (text wireframe)

```
ParentShell (active="notifications")
└─ main
   ├─ Header
   │   "Notifications"            [Mark all read]  (secondary, disabled when 0 unread)
   │   sub: "Updates about Aarav and Diya · released results only"
   │   meta: 🕒 Updated <mono> · ⚙ server-derived · Badge(brand) "N new"
   ├─ Filter tabs (role=tablist):  [All]  [Unread · N]
   ├─ List (role=list)
   │   row: [unread dot] [type icon tile] title + child chip
   │                      meta line · <mono time>      [action link →]
   │   … exam_result / at_risk / announcement / digest rows …
   └─ Empty state (when filter yields nothing): "All caught up"
```

## Components used (CORE-API)

`NavItem`, `Avatar`, `Badge`, `Chip` (filter tabs), `Button`, `IconButton`,
`Icon`, `AtRiskBadge`, `EmptyState`, `Alert`, `Skeleton`. Shell = `ParentShell`
(shared verbatim).

## States

- **Loading** — header static; 4–5 skeleton rows (circle icon + two text lines +
  short mono stamp).
- **Empty (no notifications ever)** — `EmptyState icon="inbox"` "Nothing here
  yet" + body about future events.
- **Empty (Unread filter, none unread)** — `EmptyState icon="check-circle"` "All
  caught up" + ghost "View all".
- **Error** — `Alert variant="error"` "Couldn't load notifications" + Retry
  (icon + label, never colour alone).
- **Success** — grouped/flat chronological rows; unread rows carry a brand dot
  and stronger title weight.

## Interactions & flows

- Click row → `markRead(id)` via `useState`, then `go(href)` to the linked
  route.
- "Mark all read" → all rows read; button disables; "N new" badge → 0.
- Filter `All | Unread` via `Chip active` toggling; Unread chip shows live
  count.
- Action link per row routes to: exam_result →
  `#/children/aarav/results/ex_midterm`; at_risk → `#/alerts`; announcement →
  `#/announcements`; digest → `#/progress`.

## Domain rules

- **Released-only**: result notifications appear only after the teacher
  releases; copy never includes a score the parent can't already see on the
  results screen.
- **Answer keys never shown**: links land on parent-permitted screens
  (results/alerts/announcements) that themselves honour AnswerKeyLock.
- **Server-derived**: at-risk + digest items come from the nightly review /
  analytics jobs; read-state is the only client-mutable field.
- Items reference shared children: Aarav (id `aarav`, on track) and Diya (id
  `diya`, at-risk/watch).

## A11y

- Tabs: `role="tablist"`/`role="tab"` + `aria-selected`; list:
  `role="list"`/`listitem`.
- Each row is a `<button>` with `aria-label` = "(Unread —) {title}. {meta}.
  {time}".
- Unread dot paired with `sr-only` "Unread —" text; status meaning never by
  colour alone (icon + label).
- Visible focus ring (`--ring-focus`); `prefers-reduced-motion` removes row
  transitions; `aria-live="polite"` summary announces unread count.
