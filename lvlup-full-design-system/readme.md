# Lyceum — Design System

"Modern Scholarly" design system for **Lyceum**, an AI-assisted assessment and
gamified-learning platform. The product spans three role surfaces — **teacher**
(classes, grading, analytics, at-risk insights), **exams** (authoring,
server-authoritative delivery, AI grading with human-in-the-loop override,
results release) and **admin / super-admin** (tenant provisioning, billing, LLM
usage, platform health) — plus a student-facing learning experience (spaces,
story-point mastery tracks, XP, streaks, leaderboards).

The voice is scholarly but warm; the surface is paper-toned rather than stark
white, the accent a scholarly indigo, with a marigold "spark" reserved for
motivation and primary moments.

> **Sources:** this system was authored from the in-project token + class
> library (`tokens/lyceum.css`, `components.css`) and the prototype screens
> under `prototypes/`. No external Figma or repo was attached; if you have one,
> add it via the Import menu so components can be reconciled against the real
> product.

---

## Index (root manifest)

| Path                                | What it is                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `styles.css`                        | Global entry — `@import`s tokens + fonts. Consumers link this one file.                                                        |
| `tokens/lyceum.css`                 | All design tokens (primitives → semantic roles → domain scales).                                                               |
| `tokens/fonts.css`                  | `@font-face` / webfont declarations (Google Fonts, variable).                                                                  |
| `components.css`                    | The class library every React component renders into.                                                                          |
| `components/<group>/`               | React components (`.jsx` + `.d.ts` + `.prompt.md` + demo `.card.html`); `_shared/` holds the `Icon`/`cx`/`omit` helper module. |
| `cards/`, `foundations/`            | Foundation specimen cards for the Design System tab.                                                                           |
| `prototypes/{teacher,admin,exams}/` | Full application screens composed from the system.                                                                             |
| `_ds_bundle.js` _(generated)_       | Compiled runtime — exposes `window.LvlupV0DesignSystem_5d0725`.                                                                |

**Component groups:** primitives · containers · data · feedback · navigation ·
gamification · learning · assessment · scanner, plus a shared `_shared/` helper
module. Full inventory (matching the compiled bundle):

- **\_shared** — `Icon` (renders an inline lucide SVG by kebab-case name) plus
  the `cx` / `omit` helpers every component imports. Not a showcased component
  dir — it has no demo card.
- **primitives** — Button, IconButton, Input, Textarea, Select, Field, Checkbox,
  Radio, Switch, Slider, FileDrop
- **containers** — Card, Panel, Section, Accordion, Tabs, Drawer, Modal,
  Popover, Tooltip
- **data** — DataTable, DefinitionList, Stat, Badge, Chip, Avatar, AvatarGroup,
  Timeline, EmptyState, Skeleton, Pagination, ProgressBar, ProgressRing
- **feedback** — Alert, Toast, LoadingOverlay
- **navigation** — NavItem, Breadcrumb, Tabbar, CommandPalette, Kbd
- **gamification** — XPMeter, StreakFlame, LevelBadge, LeaderboardRow,
  Achievement
- **learning** — SpaceCard, StoryPointTrack, StoryPointNode, InsightCard,
  TutorChatBubble, AtRiskBadge, ContentRenderer
- **assessment** — QuestionCard, Option, GradePill, ConfidenceBadge,
  RubricBreakdown, ManualOverrideControl, AnswerKeyLock, TimerBar,
  SubmissionCard
- **scanner** — ScanFrame, UploadQueueItem

`Icon` lives in `_shared/` (imported across the library); the `kbd` visual is
available both as the `Kbd` component and the bare `.kbd` class. Each
component's full props contract lives in its sibling `<Name>.d.ts`.

---

## Consuming this system

```html
<link rel="stylesheet" href="styles.css" />
<script
  src="https://unpkg.com/react@18.3.1/umd/react.development.js"
  …
></script>
<script
  src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js"
  …
></script>
<script
  src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js"
  …
></script>
<script src="_ds_bundle.js"></script>
<!-- exposes the namespace -->
<script src="https://unpkg.com/lucide@latest"></script>
<!-- icons (required by <Icon>) -->
<script type="text/babel">
  const { Button, DataTable, QuestionCard } = window.LvlupV0DesignSystem_5d0725;
</script>
```

Never `<script src>` a component's `.jsx` directly — only the compiled
`_ds_bundle.js`.

---

## Content fundamentals

- **Address the user as "you"; the platform is implicit** — "You are 2 story
  points away from mastering Data Structures." Never "the user."
- **Tone:** plain, encouraging, precise. Scholarly without being stiff; no hype,
  no exclamation spam. One idea per line.
- **Casing:** Sentence case for everything — headings, buttons, labels ("Publish
  lesson", not "Publish Lesson"). UPPERCASE is reserved for eyebrows / stat
  labels / option markers, applied via CSS letter-spacing, never typed.
- **Domain vocabulary is fixed:** _space_ (a subject), _story point_ (a unit of
  mastery), _mastery_ (not "completion"), _confidence_ (the model's 0–1 routing
  score), _spark_ (the marigold motivational accent). Grades are letters
  **A–F**; scores are written `18/20` in mono.
- **Numbers are tabular mono** (Spline Sans Mono): XP, scores, timers,
  percentages, IDs.
- **No emoji** in product chrome. The only glyphs used inline are a check (✓)
  inside mastered nodes and the streak flame, both rendered as SVG/CSS, not
  emoji.
- **Buttons are verb-first:** "Open lesson", "Review", "Publish space".
  Destructive actions name the object ("Delete exam").

---

## Visual foundations

**Color.** Two-tier: raw primitive scales (Paper warm-neutrals, Ink
warm-charcoal, Indigo brand, Marigold spark, plus green/amber/red/sky status
hues) feed semantic roles (`--bg-canvas`, `--text-primary`, `--brand-primary`,
`--spark`, `--status-*`). Components reference **semantic tokens only**. Canvas
is warm paper (`--paper-50`), surfaces are near-white warm (`--warm-white`) —
never pure `#fff` or `#000`. A `[data-theme="dark"]` scope is scaffolded. Domain
color scales exist for confidence (low/med/high → red/amber/green), grades
(A–F), and mastery (not-started / in-progress / mastered).

**Type.** Fraunces (serif) for display & headings — scholarly authority;
Schibsted Grotesk for all UI/body; Spline Sans Mono for every numeric/code
surface. Scale is a 1.25 major third on a 16px base, `--text-2xs … --text-5xl`.
Display sizes get slight negative tracking (`--tracking-display`); mono uses
`font-variant-numeric: tabular-nums`.

**Spacing & shape.** 4px base rhythm (`--space-1 … --space-24`). Radii step sm 6
/ md 10 / lg 14 / xl 20 / pill. Cards use `--radius-lg`; pills/badges use
`--radius-pill`.

**Elevation.** Warm-tinted shadows — ink at low alpha, never neutral black —
`--shadow-e1/e2/e3`. The spark accent carries a dedicated `--glow-spark`. Cards
rest at e1 and lift to e2 on hover (`.card--interactive` translates up 2px).

**Motion.** Durations `--dur-instant 100 … --dur-page 420`; `--ease-standard`
for most transitions, `--ease-entrance` for things sliding/growing in (drawers,
XP fills). Hover = color/background shift; press = `translateY(1px)`. No
decorative looping animation on content.

**Borders & focus.** Hairline `--border-subtle` for dividers, `--border-strong`
for inputs/chips. Focus is a token ring (`--ring-focus`), never the default
outline. Dashed borders signal "protected / overridable" states (answer-key
lock, manual override).

**Layout.** App shell is a 248px sidebar + 60px topbar + scrolling main, all on
the warm canvas. Content max-width via `--reading-max` for long-form lesson
content.

---

## Iconography

- **Lucide** (CDN, `unpkg.com/lucide@latest`) is the icon system. The
  `<Icon name="…">` component renders an inline lucide SVG by kebab-case name
  (e.g. `chevron-down`, `graduation-cap`); it reads the lucide UMD global, so
  that script must be on the page. Default stroke-width 2, `currentColor`.
- A few domain glyphs are hand-inlined as SVG where they carry brand meaning and
  need custom fill: the **streak flame** (filled, spark-colored) and the
  mastered-node **check**. These are intentional, not lucide.
- **No emoji, no icon fonts, no PNG icons.** If a needed glyph isn't in lucide,
  add it as an inline SVG in the component rather than substituting an emoji.

---

## Authoring rule

Every component is `<Name>.jsx` + a sibling `<Name>.d.ts` (PascalCase), under
its group folder, with a `@dsCard` demo `.html` per directory. Components import
React only and style **exclusively** via existing `components.css` classes — no
new CSS, no CSS-in-JS, no npm. One capitalized export = one public component
(e.g. `Avatar` + `AvatarGroup`, `QuestionCard` + `Option` share a file). After
any edit, run `check_design_system` until it reports clean.

Generated — never hand-write: `_ds_bundle.js`, `_ds_manifest.json`,
`_adherence.oxlintrc.json`.
