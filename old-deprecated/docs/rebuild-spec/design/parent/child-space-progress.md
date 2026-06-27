# Parent — Space Progress

## Purpose & user

Parent (Anita Sharma) sees every LevelUp learning space across all linked
children in one place, grouped per child, so she can tell at a glance which
subjects are progressing and which are stalled. Read-only; LevelUp-progress
oriented (distinct from exam results).

## Entry / route

- Hash route: `#/progress` (sidebar "Space Progress", `active="spaces"`).
- Reached from sidebar, from the child cards on `#/children` (Space progress
  button), and from the dashboard.

## Layout (text wireframe)

```
[ParentShell · sidebar=Space Progress active]
┌─────────────────────────────────────────────────────────────┐
│ H1  Space Progress                         [Compare children]│
│ sub: 2 children · 6 spaces · Beacon Hill Academy · BHA-204   │
├─────────────────────────────────────────────────────────────┤
│ ┌── child section (Aarav) ─────────────────────────────────┐ │
│ │ [Avatar AS]  Aarav Sharma  Grade 9 · 3 spaces · 78% avg  │ │
│ │ ┌ space ─┐ ┌ space ─┐ ┌ space ─┐                          │ │
│ │ │ DSA    │ │ Maths  │ │ Physics│  ← grid of SpaceCards    │ │
│ │ │ Badge  │ │ Badge  │ │ Badge  │    (status)              │ │
│ │ │ Progr% │ │ Progr% │ │ Progr% │                          │ │
│ │ │ pts·SP │ │ pts·SP │ │ pts·SP │  ← mono pts + 6/8 SP     │ │
│ │ │ track  │ │ track  │ │ track  │  ← mini StoryPointTrack  │ │
│ │ └────────┘ └────────┘ └────────┘                          │ │
│ └──────────────────────────────────────────────────────────┘ │
│ ┌── child section (Diya · Watch) ──────────────────────────┐ │
│ │ [Avatar DS]  Diya Sharma  Grade 7 · Watch · 44% avg      │ │
│ │  Maths(44) · Science(20) · English(50)                   │ │
│ └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Components used (CORE-API)

- `SpaceCard` chrome / `Card` — per-space tile.
- `Badge` — space status (In progress / Mastered / Not started).
- `ProgressBar` — completion %.
- `StoryPointTrack` (`StoryPointNode`) — mini mastery path per space.
- `Avatar` — child section header.
- `AtRiskBadge {level:'watch'}` — flag on Diya.
- `Icon`, `Button` (Compare children, per-card Open progress), `EmptyState`,
  `Skeleton`, `Alert` for states.

## States

- **Loading**: skeleton child header + 3 skeleton space tiles per section.
- **Empty (no spaces)**: child has no assigned spaces → `EmptyState` ("No spaces
  assigned yet") inside that child's section.
- **Empty (no children)**: full-page `EmptyState` ("No children linked").
- **Error**: per-section `Alert variant="error"` with Retry; never blocks other
  children.
- **Success**: grouped sections with populated SpaceCards.

## Interactions & flows

- Each SpaceCard → `go('#/children/<id>/progress')` (child progress detail).
- Header "Compare children" → `go('#/compare')`.
- Sections rendered per child in roster order (Aarav, then Diya).
- Status Badge always paired with an icon + text label (never color alone).

## Domain rules

- All numbers are **server-derived** LevelUp progress (completion %, mastered
  story-point counts, points). No client computation of mastery.
- **Released-only**: nothing here exposes scores beyond released aggregates;
  this screen is progress, not grades.
- **Answer keys are NEVER shown** to parents anywhere on this screen.
- Points shown in mono; story-point counts as `mastered/total`.

## A11y

- Each child section is a `<section aria-labelledby>` with the child name
  heading.
- SpaceCard grid uses `role="list"`/`role="listitem"`; each card has an
  `aria-label` summarizing space, status, and completion.
- ProgressBar and StoryPointTrack carry text equivalents (status word +
  `n/total mastered`).
- Watch flag is an `AtRiskBadge` (icon + "Watch" text), not color-only.
