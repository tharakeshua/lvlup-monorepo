# Children Roster — Parent Portal

## Purpose & user

Lets a **parent** (Anita Sharma) see every child linked to their account at a
glance, with each child's released performance snapshot, and jump into the
per-child Progress / Exam Results / Space Progress views. This is the parent's
home for the "My Children" section.

## Entry / route

- Route: `#/children`
- Sidebar nav: **My Children → Children** (active).
- Reached from Dashboard child summaries and from the topbar child switcher.

## Layout (text wireframe)

```
My Children                                  [ Compare children → ]
2 linked · Beacon Hill Academy · BHA-204
──────────────────────────────────────────────────────────────
┌───────────────────────────────────────── child card ──────┐
│ (AS)  Aarav Sharma                                          │
│       Grade 9 · Beacon Hill Academy        [ Exam avg 82% ] │
│                                                             │
│  Exam avg   Spaces      Streak        Exams taken           │
│   82%        78% ▓▓▓░    🔥 12 days     14                  │
│                                                             │
│  Recent exams                                               │
│   Midterm — DSA            [A 88%]                          │
│   Unit Test — Mathematics  [B 79%]                          │
│   Quiz — Physics           [B 81%]                          │
│  ─────────────────────────────────────────────────────────│
│  [ Progress ]  [ Results ]  [ Space progress ]             │
└─────────────────────────────────────────────────────────────┘
┌───────────────────────────────────────── child card ──────┐
│ (DS)  Diya Sharma   ⚠ Watch                                 │
│       Grade 7 · Beacon Hill Academy        [ Exam avg 61% ] │
│  ... metric row · recent exams · actions ...                │
└─────────────────────────────────────────────────────────────┘
```

## Components used (CORE-API)

`Card`, `Avatar`, `Stat`, `ProgressBar`, `GradePill`, `StreakFlame`,
`AtRiskBadge`, `Button`, `Badge`, `Icon`, `EmptyState`, `Skeleton`, `Alert` —
all from `window.LvlupV0DesignSystem_5d0725`.

## States

- **Loading:** skeleton child cards (avatar circle + text lines + metric
  placeholders).
- **Empty:** `EmptyState` (icon `users`) "No children linked yet" with body
  explaining to contact the school to link a student, plus a "Contact school"
  action.
- **Error:** `Alert variant="error"` "Couldn't load your children" with a Retry
  button; sidebar/shell stays intact.
- **Success:** one detailed card per linked child (Aarav, Diya).

## Interactions & flows

- **Compare children** (page action) → `#/compare`.
- Per child: **Progress** → `#/children/<id>/progress`; **Results** →
  `#/children/<id>/results`; **Space progress** → `#/progress`.
- Recent-exam rows are read-only chips (score + GradePill); the whole card's
  Results button is the path into detail. Tapping a child card surface is not a
  separate action — explicit buttons drive navigation for clarity.
- `AtRiskBadge level="watch"` appears only for Diya (server-derived flag).

## Domain rules

- **Released-only:** every exam score / average / grade shown is from RELEASED
  results. Unreleased exams never appear.
- **Answer keys are NEVER shown** to parents anywhere on this screen — only
  scores and letter grades.
- All metrics (avg, completion %, streak, exams taken, at-risk flag) are
  **server-derived**; the UI never computes them client-side.
- Parents have read-only access — no edit/grade affordances.

## A11y

- Page `<h1>` "My Children"; each child card is a `<section>` with
  `aria-labelledby` pointing at the child name heading.
- Status color is always paired with an icon + text label (AtRiskBadge "Watch",
  GradePill letter+score, StreakFlame day count) — never color alone.
- Metric row uses a labelled group; each stat has a visible text label.
- All action buttons are real `<button>`/links with discernible text;
  focus-visible rings via tokens.
- Avatars are decorative (`aria-hidden`) since the name is adjacent text.
