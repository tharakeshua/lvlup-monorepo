# Parent Dashboard

## Purpose & user

Home for a **parent/guardian** (Anita Sharma) at Beacon Hill Academy. Gives a
fast, trustworthy overview of all linked children — performance, streaks, space
completion, and any at-risk flags — plus quick paths into per-child progress and
released results. Read-only oversight surface; the parent never edits academic
data.

## Entry / route

- Route: `#/` (default landing after login / child-context selection).
- Shell mode: `shell` (ParentShell sidebar + topbar), active nav = `dashboard`.

## Layout (text wireframe)

```
┌ ParentShell (sidebar + topbar: school chip, child chip, notifications) ──────────┐
│  Good morning, Anita.            updated · Saturday, June 20        [Notifications]│
│                                                                                    │
│  ┌Stat────────┐ ┌Stat────────┐ ┌Stat────────┐ ┌Stat────────┐                      │
│  │ Children 2 │ │ Avg perf   │ │ At-risk 1  │ │ School code│                      │
│  │            │ │ 72%        │ │ (warn)     │ │ BHA-204    │                      │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘                      │
│                                                                                    │
│  [! Alert warning] Diya Sharma flagged at-risk → View alerts                       │
│                                                                                    │
│  Quick actions:  [View alerts] [Compare children] [Notifications]                  │
│                                                                                    │
│  Your children                                                                     │
│  ┌Child card — Aarav──────────────┐  ┌Child card — Diya (at-risk)──────────┐       │
│  │ AS  Aarav · Grade 9            │  │ DS  Diya · Grade 7   [Watch]         │       │
│  │ Avg 82%  · 🔥 12-day streak    │  │ Avg 61%  · streak 0                  │       │
│  │ Spaces ▓▓▓▓▓▓▓░ 78%            │  │ Spaces ▓▓▓▓░░░░ 44%                  │       │
│  │ [Progress] [Results]           │  │ [Progress] [Results]                 │       │
│  └────────────────────────────────┘  └──────────────────────────────────────┘     │
│                                                                                    │
│  Recent activity ────────────────────────────────────  → View all                 │
│  • Diya flagged at-risk · 2h     • Aarav results released · 5h   ...               │
└────────────────────────────────────────────────────────────────────────────────┘
```

## Components used (CORE-API)

- `Stat` (4× KPI strip), `Alert variant="warning"`, `Button` (quick actions +
  per-child CTAs), `Avatar`, `Badge`, `Chip`, `ProgressBar`, `StreakFlame`,
  `AtRiskBadge level="watch"`, `Icon`, `IconButton`, `EmptyState`, `Skeleton`,
  `NavItem` (in shell).

## States

- **Loading:** KPI + child cards render `Skeleton` rows (no layout shift).
- **Empty:** no linked children → `EmptyState` (icon `user-plus`, "No children
  linked yet", body pointing to school code BHA-204).
- **Error:** per-section `Alert variant="error"` with Retry; shell + nav still
  usable.
- **Success:** full data as above; at-risk child shows `AtRiskBadge` + warning
  Alert banner.

## Interactions & flows

- Alert banner / "View alerts" → `#/alerts`.
- "Compare children" → `#/compare`; "Notifications" → `#/notifications`.
- Per-child "Progress" → `#/children/<id>/progress`; "Results" →
  `#/children/<id>/results`.
- Recent-activity list → `#/notifications`.
- All CTAs go through `go('#/...')`.

## Domain rules

- **Released-only:** every score/avg/result shown is server-released; unreleased
  work is invisible to parents.
- **Answer keys are NEVER shown** to parents anywhere.
- At-risk status, averages, streaks, and completion % are **server-derived** —
  display-only, never client-computed or editable.

## A11y

- Single `<h1>` "Good morning, Anita."; KPI strip is a labelled `group`.
- Status colors always paired with icon+label (warning Alert, AtRiskBadge
  "Watch", StreakFlame).
- Child cards are keyboard-reachable; CTAs are real `Button`s with descriptive
  labels.
- Progress bars expose `value`; activity list uses semantic list markup.
