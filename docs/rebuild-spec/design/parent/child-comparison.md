# Parent · Compare Children

**Purpose & user.** A parent of 2+ children compares them side-by-side on
released, server-derived metrics so they can see at a glance which child is
thriving and which needs support. Read-only; no grading internals.

**Entry / route.** `#/compare` (sidebar → Overview is upstream; this lives under
Compare). Reached from the Children list "Compare" CTA and the dashboard.
Requires ≥2 linked children — if only 1, the screen shows an empty state
instead.

## Layout (text wireframe)

```
┌ Compare Children ─────────────────────────────────────── [View all children →] ┐
│ Side-by-side · released results only · updated 2h ago                            │
├──────────────────────────────┬──────────────────────────────────────────────────┤
│  ┌ AARAV (Grade 9) ────────┐ │  ┌ DIYA (Grade 7) ───────────────────────────┐  │
│  │   (•ProgressRing 82%•)  │ │  │   (•ProgressRing 61%•)   [Watch]           │  │
│  │   Avg score             │ │  │   Avg score                                │  │
│  └─────────────────────────┘ │  └────────────────────────────────────────────┘  │
├──────────────────────────────┴──────────────────────────────────────────────────┤
│  Metric comparison (DataTable) — BEST cell highlighted w/ check                  │
│   Metric            │ Aarav        │ Diya                                        │
│   Avg score         │ 82% ✓best    │ 61%                                         │
│   Exams taken       │ 6            │ 4                                           │
│   Spaces completed  │ 78% ✓best    │ 44%                                         │
│   Streak (days)     │ 12 ✓best     │ 0                                          │
│   At-risk           │ No ✓best     │ Watch                                       │
├──────────────────────────────────────────────────────────────────────────────────┤
│  Subject averages (grouped bars, inline divs) — Aarav vs Diya per subject        │
│   Mathematics  ▮▮▮▮ 79  ▮▮▮ 58   …                                              │
└──────────────────────────────────────────────────────────────────────────────────┘
```

## Components used (CORE-API)

`ProgressRing` (overall score per child), `DataTable` (metric comparison rows),
`Avatar` (child initials), `Badge` / `AtRiskBadge` (Watch flag, Best cell),
`Icon` (check, status, subject icons), `Button` (CTAs). Custom inline divs for
the grouped bar chart (no chart lib).

## States

- **Loading.** Skeleton rings + skeleton table rows.
- **Empty (only 1 child).** EmptyState "Add a second child to compare" — screen
  requires ≥2.
- **Error.** Per-section Alert with Retry; table renders independently of chart.
- **Success.** Two columns + table + chart as wireframed.

## Interactions & flows

- Child column header → `#/children/aarav/progress` (per-child progress).
- "View all children" → `#/children`.
- "Watch" badge / At-risk row → `#/alerts`.
- Subject bar / exam metric → `#/children/aarav/results`.
- Best-performer cell highlighted with subtle brand/success bg + check icon
  (computed server-side, never client-recomputed).

## Domain rules

- **Released-only.** Every score/grade shown is from released results;
  unreleased exams excluded.
- **Answer keys NEVER shown** to parents anywhere on this screen.
- All metrics (avg, completion, streak, at-risk, best-cell) are
  **server-derived**; the UI only displays.
- Requires ≥2 children — note satisfied by the two-column layout.

## A11y

- Rings carry `aria-label` with child + score; chart wrapped in `role="img"`
  with full text alt.
- Best cell pairs the brand bg with a check **icon + "Best" label** (never color
  alone).
- At-risk uses icon + "Watch" text, not color alone.
- DataTable uses real `<th>` scope; CTAs are focusable buttons with descriptive
  labels; respects `prefers-reduced-motion`.
