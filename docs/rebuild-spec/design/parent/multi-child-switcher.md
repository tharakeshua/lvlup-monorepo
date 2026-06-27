# Active-Child Switcher — Parent Portal

> Design language: Lyceum (Modern Scholarly) · Slug: `multi-child-switcher` ·
> View: `ChildSwitcherView` · Shell: bare

## 1. Purpose

Lets a parent with multiple linked children pick which child is "active" across
the portal. The active child scopes Progress, Exam Results, and Space Progress
to one learner. Surfaced as a topbar dropdown menu/popover, not a full page.

## 2. Route / entry

- No standalone route. Opened from the topbar child chip ("Aarav Sharma ▾").
- In the SPA it drops as a popover anchored under that chip.
- CTAs deep-link: `#/compare` (Compare all) and `#/children` (Manage children).

## 3. Layout wireframe

```
┌────────────────────────────────────┐  ← surface, ~320px, shadow-e3, radius-lg
│  Switch child                       │     border-subtle
├────────────────────────────────────┤
│ [AS] Aarav Sharma          ✓        │  ← active row (selected)
│      Grade 9 · Avg 82%              │
├────────────────────────────────────┤
│ [DS] Diya Sharma                    │
│      Grade 7 · Avg 61% · • Watch    │  ← at-risk dot + label
├────────────────────────────────────┤
│ [⇄ Compare all]  [⚙ Manage children]│  ← footer actions
└────────────────────────────────────┘
```

## 4. Components (window.LvlupV0DesignSystem_5d0725)

- `Avatar` — child initials (AS / DS), size sm.
- `Badge` / `AtRiskBadge` — Diya "Watch" at-risk status (dot + label, paired
  with color).
- `Icon` — lucide: `check` (active), `alert-triangle` (risk), `git-compare`,
  `users`, `users-round`.
- `Button` — footer actions (ghost / secondary).

## 5. States

- **Active row**: highlighted background, trailing `check` icon,
  `aria-checked=true`.
- **Hover / focus**: row background `--bg-surface-sunken`, focus ring on
  keyboard nav.
- **At-risk child**: warning status dot + "Watch" label on Diya's meta line.
- **Single child** (not in sample): menu still renders one row, no switch
  affordance needed.
- **Loading**: skeleton rows (deferred to shell; panel assumes data present).

## 6. Flows

1. Parent clicks topbar child chip → panel opens.
2. Clicking a child row sets `active` (local `useState`) and shows the check on
   that row.
3. In SPA, selecting closes the popover and re-scopes child-specific views.
4. "Compare all" → `go('#/compare')`. "Manage children" → `go('#/children')`.

## 7. Domain rules

- Released results only; averages shown are from released exams. No answer keys
  here.
- Avg %, grade, streak are server-derived, read-only.
- At-risk flag (Diya) is nightly-review derived; parent cannot dismiss from this
  menu.
- Children list is the parent's linked roster only (Aarav, Diya under Anita
  Sharma).

## 8. Accessibility

- Panel: `role="menu"` titled "Switch child"; rows are `role="menuitemradio"`
  with `aria-checked` reflecting active.
- Each row `aria-label` includes name, grade, avg, and risk status when present.
- Status color never sole signal: at-risk pairs dot + "Watch" text + icon.
- Full keyboard nav; visible focus ring (`--ring-focus`); reduced-motion
  respected.
