# V10: UI/UX Design System & Accessibility — Implementation Plan

**Date:** 2026-03-07 **Status:** Plan **Depends On:** V9 (Complete)

---

## Current State Assessment

### Design Tokens (`packages/tailwind-config/`)

- HSL CSS variable system with `class`-based dark mode
- Good foundation: primary, secondary, destructive, muted, accent, popover,
  card, sidebar colors
- EdTech-specific: tier colors (silver, gold, platinum, diamond), learning state
  colors
- Custom keyframes: glow, float, pulse-glow, slide-up, cosmic-spin
- Custom shadows: card, glow, tier-gold, tier-diamond
- Custom gradients: cosmic, space, progress, glow

### CSS Variable Inconsistency Across 5 Apps

| Variable    | student-web  |  parent-web  | teacher-web  |  admin-web   | super-admin  |
| ----------- | :----------: | :----------: | :----------: | :----------: | :----------: |
| `--success` |     Yes      |     Yes      |      No      |      No      |      No      |
| `--warning` |     Yes      |     Yes      |      No      |      No      |      No      |
| `--info`    |      No      |     Yes      |      No      |      No      |      No      |
| `--chart-*` |      No      |      No      |      No      |     Yes      |      No      |
| `--tier-*`  | Via theme.js | Via theme.js | Via theme.js | Via theme.js | Via theme.js |

### Existing Shared-UI (54 components)

- shadcn/ui baseline: accordion, alert, badge, button, card, dialog, dropdown,
  form, input, select, sheet, sidebar, table, tabs, toast, tooltip, etc.
- Already has: `Skeleton` (basic pulse), `StatusBadge` (with CVA variants +
  sr-only), `StatCard` (simple)
- gamification/ from V9: AchievementBadge, AchievementCard, LevelBadge,
  StreakWidget, MilestoneCard, StudyGoalCard
- **Missing**: EmptyState, DataTable (sort/filter/paginate), ProgressRing,
  enhanced StatsCard

### Framer Motion

- NOT installed in any package
- No animation library beyond Tailwind keyframes

### Accessibility

- Some ARIA: StatusBadge uses `<span className="sr-only">Status: </span>`
- Button has focus-visible ring classes
- No systematic ARIA audit, no keyboard nav patterns, no focus trap, no
  reduced-motion

---

## Implementation Plan

### Phase A: Standardize Design Tokens & CSS Variables

**A1: Extend `packages/tailwind-config/theme.js`**

- Add semantic colors: `success`, `warning`, `info` to `levelUpColors`
- Add `chart-1` through `chart-5` color slots
- Add typography scale: `fontFamily` (sans, mono), extended `fontSize` with
  line-height
- Add spacing tokens: consistent scale in `spacing` (verified existing is fine)
- Add focus ring tokens for accessibility

**A2: Create canonical CSS variables file**

- Create `packages/tailwind-config/variables.css` with the full canonical set of
  CSS variables (light + dark)
- Include: all base tokens + success/warning/info + chart-1..5 + tier-_ +
  state-_ + gradient/shadow tokens
- All 5 apps import this canonical file instead of duplicating variables

**A3: Update all 5 app `index.css` files**

- Replace duplicated `:root`/`.dark` blocks with
  `@import '@levelup/tailwind-config/variables.css'`
- Add any app-specific overrides below the import if needed

**Files:**

- `packages/tailwind-config/theme.js` — extend colors
- `packages/tailwind-config/variables.css` — new canonical file
- `packages/tailwind-config/package.json` — add `variables.css` to files
- `apps/*/src/index.css` (5 files) — import canonical variables

---

### Phase B: New Shared-UI Components

**B1: EmptyState component**

- Props: `icon`, `title`, `description`, `action` (button), `className`
- Accessible: ARIA role="status", descriptive text
- Supports dark mode via design tokens

**B2: DataTable component**

- Built on existing `<Table>` primitive
- Props: `columns` (TanStack Table column defs), `data`, `searchable`,
  `sortable`, `pageSize`
- Client-side sorting, filtering, pagination
- Accessible: ARIA `role="grid"`, `aria-sort` on headers, keyboard navigation
  for headers
- Uses existing `Input` for search, `Select` for page size, `Button` for
  pagination

**B3: ProgressRing (SVG circle)**

- Props: `value` (0-100), `size`, `strokeWidth`, `label`, `showValue`,
  `className`
- Accessible: `role="progressbar"`, `aria-valuenow`, `aria-valuemin`,
  `aria-valuemax`, `aria-label`
- Animated fill with CSS transition (respects `prefers-reduced-motion`)

**B4: Enhance StatsCard**

- Add optional `trend` (up/down/neutral with percentage)
- Add optional `loading` state using Skeleton
- Retain existing API backwards-compatible

**Files:**

- `packages/shared-ui/src/components/ui/empty-state.tsx`
- `packages/shared-ui/src/components/ui/data-table.tsx`
- `packages/shared-ui/src/components/ui/progress-ring.tsx`
- `packages/shared-ui/src/components/ui/stat-card.tsx` (enhance)
- `packages/shared-ui/src/index.ts` (add exports)
- `packages/shared-ui/package.json` (add `@tanstack/react-table` dependency)

---

### Phase C: Micro-Animations (Framer Motion)

**C1: Install framer-motion in shared-ui**

- Add `framer-motion` as dependency to `packages/shared-ui/`

**C2: Create animation primitives**

- `packages/shared-ui/src/components/motion/` directory
- `AnimatedCard` — Card wrapper with hover scale + shadow lift
- `FadeIn` — fade + slide-up entrance animation
- `PageTransition` — layout animation wrapper for route transitions
- `CountUp` — animated number counter for scores/stats
- `AnimatedList` — staggered children entrance
- `SkeletonShimmer` — enhanced skeleton with shimmer gradient animation
- All respect `prefers-reduced-motion` via `useReducedMotion()` hook

**C3: Create `useReducedMotion` hook**

- `packages/shared-ui/src/hooks/use-reduced-motion.ts`
- Returns `boolean` from `window.matchMedia('(prefers-reduced-motion: reduce)')`
- Used by all motion components to disable animations

**Files:**

- `packages/shared-ui/package.json` (add framer-motion)
- `packages/shared-ui/src/components/motion/AnimatedCard.tsx`
- `packages/shared-ui/src/components/motion/FadeIn.tsx`
- `packages/shared-ui/src/components/motion/PageTransition.tsx`
- `packages/shared-ui/src/components/motion/CountUp.tsx`
- `packages/shared-ui/src/components/motion/AnimatedList.tsx`
- `packages/shared-ui/src/components/motion/SkeletonShimmer.tsx`
- `packages/shared-ui/src/components/motion/index.ts`
- `packages/shared-ui/src/hooks/use-reduced-motion.ts`
- `packages/shared-ui/src/index.ts` (add motion exports)

---

### Phase D: Accessibility Audit & Fixes

**D1: Focus indicator standardization**

- Add `--ring-width` and `--ring-offset` CSS variables
- Ensure all interactive elements have visible `focus-visible` outline
- Add `:focus-visible` global styles in canonical CSS

**D2: ARIA audit for existing components**

- StatusBadge — already has sr-only (good)
- Dialog/Sheet/AlertDialog — verify `aria-labelledby`, `aria-describedby`
- Sidebar nav — add `aria-current="page"` for active items
- Form components — verify `aria-invalid`, `aria-describedby` for errors
- Table — add `role="grid"` pattern with sortable header announcements

**D3: Keyboard navigation**

- Verify tab order in sidebar navigation
- Ensure all dialogs trap focus correctly (Radix does this by default)
- Add keyboard shortcuts for common actions where applicable

**D4: Create `useKeyboardNav` hook**

- Arrow key navigation for lists/grids
- `packages/shared-hooks/src/ui/useKeyboardNav.ts`

**D5: Add `skip-to-content` link**

- Create `SkipToContent` component in shared-ui
- Add to all 5 app layouts

**Files:**

- `packages/tailwind-config/variables.css` (focus ring variables)
- `packages/shared-ui/src/components/ui/skip-to-content.tsx`
- `packages/shared-hooks/src/ui/useKeyboardNav.ts`
- `packages/shared-hooks/src/index.ts` (exports)
- All 5 app layouts (add SkipToContent)

---

### Phase E: Dark/Light Mode Consistency & High-Contrast

**E1: Canonical variables already handled in Phase A**

**E2: High-contrast mode**

- Add `.high-contrast` class in canonical CSS with higher contrast values
- Add `--hc-*` overrides: stronger borders, larger text contrast ratio
- Hook: `useHighContrast()` toggle in shared-ui

**E3: Theme toggle component**

- Create `ThemeToggle` component (light/dark/system/high-contrast)
- Uses `next-themes` `useTheme()` internally
- Accessible with `aria-label` and keyboard support

**Files:**

- `packages/tailwind-config/variables.css` (high-contrast block)
- `packages/shared-ui/src/components/ui/theme-toggle.tsx`
- `packages/shared-ui/src/hooks/use-high-contrast.ts`

---

## Task List

| #   | Task                                             | Files                                       | Size | Phase |
| --- | ------------------------------------------------ | ------------------------------------------- | ---- | ----- |
| 1   | Extend tailwind-config theme tokens              | tailwind-config/theme.js                    | S    | A     |
| 2   | Create canonical CSS variables file              | tailwind-config/variables.css               | M    | A     |
| 3   | Update tailwind-config package.json              | tailwind-config/package.json                | S    | A     |
| 4   | Standardize 5 app index.css files                | apps/\*/src/index.css                       | S    | A     |
| 5   | Build EmptyState component                       | shared-ui/components/ui/empty-state.tsx     | S    | B     |
| 6   | Build DataTable component                        | shared-ui/components/ui/data-table.tsx      | L    | B     |
| 7   | Build ProgressRing component                     | shared-ui/components/ui/progress-ring.tsx   | S    | B     |
| 8   | Enhance StatCard component                       | shared-ui/components/ui/stat-card.tsx       | S    | B     |
| 9   | Export new components                            | shared-ui/src/index.ts, package.json        | S    | B     |
| 10  | Install framer-motion + create motion primitives | shared-ui/components/motion/                | M    | C     |
| 11  | Create useReducedMotion hook                     | shared-ui/hooks/use-reduced-motion.ts       | S    | C     |
| 12  | Focus indicator & global a11y styles             | tailwind-config/variables.css               | S    | D     |
| 13  | SkipToContent component                          | shared-ui/components/ui/skip-to-content.tsx | S    | D     |
| 14  | Add SkipToContent to all 5 app layouts           | apps/\*/layouts/AppLayout.tsx               | S    | D     |
| 15  | High-contrast mode CSS + hook                    | variables.css, use-high-contrast.ts         | S    | E     |
| 16  | ThemeToggle component                            | shared-ui/components/ui/theme-toggle.tsx    | S    | E     |
| 17  | Build verification                               | all packages                                | S    | —     |
| 18  | Test report                                      | docs/evolution/v10-design-system/           | S    | —     |

**Estimated total: 18 tasks across 5 phases**
