# UI-MIGRATION-PATTERN — Lyceum for production web apps

**Binding recipe for UI-1/2/3/5/6.** How to move a production React app
(teacher-web, student-web, admin-web, parent-web, super-admin) from the generic
shadcn/SaaS-blue look onto the **Lyceum** design system without touching
behavior. Established by UI-1 on `apps/teacher-web`.

Sources of truth (read once per unit, in order):

1. `old-deprecated/docs/rebuild-spec/design/00-FOUNDATION.md` — tokens, banned
   list, component inventory
2. `old-deprecated/docs/rebuild-spec/design/build/CORE-API.md` — exact token
   names + component idioms
3. `old-deprecated/docs/rebuild-spec/design/build/app/web-<app>/` — redesigned
   SPA prototype (open the `.card.html` in a browser — it runs) +
   `ROUTE-TREE.md`
4. Per-screen specs in `design/{teacher,exams,spaces,student,admin}/*.md`
5. Your app's screen inventory
   (`docs/design-migration/<APP>-SCREEN-INVENTORY.md`; teacher-web's is the
   template)

---

## 1. Architecture — how Lyceum coexists with shadcn

`packages/lyceum-preset` (`@levelup/lyceum-preset`, zero deps) layers on top of
the existing `@levelup/tailwind-config` + shared-ui stack:

```
@levelup/tailwind-config/variables.css   shadcn HSL vars (@layer base)   ← keep
@levelup/lyceum-preset/tokens.css        Lyceum vars (--bg-canvas…) + --ly-* HSL twins
@levelup/lyceum-preset/bridge.css        REMAPS every shadcn var to Lyceum (unlayered → wins)
@levelup/lyceum-preset/base.css          body/heading element defaults (@layer base)
@levelup/lyceum-preset (preset.cjs)      Tailwind preset: Lyceum utilities, type scale, radius, motion
```

Consequences you rely on:

- **Every existing shared-ui/shadcn component repaints in Lyceum automatically**
  (`bg-background`, `text-primary`, `border-border`, sidebar vars, charts — all
  re-valued by bridge.css). Step 0 of a migration is therefore a whole-app
  repaint, not a rewrite.
- `.dark` keeps working (next-themes class strategy); `.high-contrast` a11y
  modes keep their own values (bridge steps aside via `:not(.high-contrast)`).
- `rounded-sm|md|lg|xl` become exact Lyceum stops 6/10/14/20px; the `text-*`
  scale becomes the Lyceum major-third scale (13px `text-sm`, 31px `text-2xl`,
  …). Expect ±1–2px layout shifts; that is the redesign, not a bug.

## 2. App adoption (one commit, before any lane)

1. `apps/<app>/package.json` → devDependencies:
   `"@levelup/lyceum-preset": "workspace:*"`, then a **filtered** install
   (`pnpm install --filter @levelup/<app>...`). ⚠️ Lockfile is serialized across
   the train — coordinate the install with the coordinator; never bare
   `pnpm install`.
2. `tailwind.config.ts` → `presets: [sharedConfig, lyceumPreset]` (Lyceum
   **last**).
3. `src/index.css` → after the existing variables.css import, add
   `@import '@levelup/lyceum-preset/lyceum.css';` (before `@tailwind base`).
4. Fonts, preferred form: `<link>` tags in `index.html` (copy from
   `packages/lyceum-preset/fonts.css` header) + import
   `tokens.css`/`bridge.css`/`base.css` individually instead of the bundle. The
   bundle's `@import`-based fonts are acceptable for a first pass.
5. Gate:
   `pnpm --filter @levelup/<app> typecheck && pnpm --filter @levelup/<app> build`,
   boot the app, confirm global repaint (warm paper canvas, indigo primary,
   Schibsted body, Fraunces h1–h3) in **both** light and dark.

## 3. Token mapping (old classes → Lyceum)

### 3a. shadcn semantic classes — KEEP, they're now Lyceum

`bg-background bg-card bg-popover bg-muted bg-accent bg-primary bg-secondary bg-destructive bg-sidebar* text-foreground text-muted-foreground text-*-foreground border-border border-input ring-ring bg-success bg-warning bg-info chart-*`
— leave untouched unless the screen's spec calls for a different role.

### 3b. Raw Tailwind palette classes — TRANSLATE (this is most of the lane work)

Match by **meaning**, not hue. The grep census of teacher-web shows the
offenders are mostly status colors:

| Old (examples)                                         | Lyceum replacement                                                  | When                                |
| ------------------------------------------------------ | ------------------------------------------------------------------- | ----------------------------------- |
| `bg-white`, `bg-gray-50`                               | `bg-surface`, `bg-canvas` / `bg-surface-sunken`                     | card vs page vs inset fill          |
| `text-gray-900/700`                                    | `text-fg` / `text-fg-secondary`                                     | primary/secondary text              |
| `text-gray-500/400`, `text-slate-*`                    | `text-fg-muted`                                                     | captions, meta                      |
| `border-gray-200/300`                                  | `border-subtle` / `border-strong`                                   | hairlines vs inputs                 |
| `bg-blue-600`, `text-blue-600` (action/brand)          | `bg-brand text-fg-on-accent`, `text-brand`                          | buttons, links, active nav          |
| `bg-blue-50`, `border-blue-200` (info surfaces)        | `bg-info-subtle`, or `bg-brand-subtle` for selected/brand states    | read the intent                     |
| `text-blue-500/700` (informational)                    | `text-info`                                                         | status text                         |
| `bg-emerald-500`, `bg-green-100`, `text-green-600/700` | `bg-success` / `bg-success-subtle` / `text-success`                 | success/graded/complete             |
| `text-green-*` on progress/mastery                     | `text-mastery-mastered`, `bg-mastery-in-progress`                   | learning-state UI                   |
| `bg-red-100/500`, `text-red-400…700`                   | `bg-error-subtle` / `bg-error` / `text-error`                       | errors, failing, overdue            |
| `text-amber-*`, `text-orange-*`                        | `text-warning`; `text-confidence-med` when it encodes AI confidence | needs-review states                 |
| AI-confidence colors (any hue)                         | `confidence-low` / `confidence-med` / `confidence-high`             | <0.7 / 0.7–0.9 / >0.9 routing       |
| Grade letters (any hue)                                | `text-grade-a…f` / `GradePill` idiom                                | grade displays                      |
| XP/streak/gamification yellows                         | `text-xp`, `text-streak`, `bg-spark`                                | spark register ONLY here + hero CTA |
| dark-mode pairs (`bg-green-900`, `bg-blue-950`, …)     | delete — semantic tokens flip themselves                            | everywhere                          |
| `text-white` on colored fills                          | `text-fg-on-accent`                                                 | buttons/badges                      |

Banned outright (00-FOUNDATION AI-slop filter): `#3B82F6`-family blues as brand,
Inter/Roboto, purple-on-white gradients, glassmorphism, pure `#FFF` surfaces.
Status must never be color-only — pair icon + label.

### 3c. Typography

| Old                                             | New                                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Page/section titles (`text-2xl font-bold` etc.) | `font-display text-2xl` (Fraunces; weight ≤ `font-semibold`; base.css already styles bare h1–h3) |
| Hero numbers / big stats                        | `font-display` + optical sizing (free via base.css) or `font-mono` for tabular data              |
| Timers, scores, IDs, counts                     | `font-mono` (tabular-nums applied by base.css)                                                   |
| Uppercase section labels/kickers                | `text-xs font-bold uppercase tracking-caps text-brand`                                           |
| Body/labels/buttons                             | `font-sans` (default) — never Fraunces below h3                                                  |

### 3d. Radius · elevation · motion

| Old                                    | New                                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| `rounded-xl`/`rounded-2xl` on cards    | `rounded-lg` (14px — the card radius)                                                  |
| `rounded-full` on chips/badges/avatars | `rounded-pill` (or keep `rounded-full`; identical result)                              |
| `shadow`, `shadow-md`, `shadow-lg`     | `shadow-e1` (rest) / `shadow-e2` (hover, popover) / `shadow-e3` (modal)                |
| ad-hoc `transition-all duration-200`   | `transition-<prop> duration-base ease-standard` (or `duration-fast` for hover)         |
| entrance animations                    | `animate-ly-rise`; gamification pop `animate-ly-pop` — ONE celebratory moment per flow |

## 4. Component idiom translations (per CORE-API §2–§3)

- **Card:** `bg-card border border-border rounded-lg shadow-e1`, hover →
  `shadow-e2` + `duration-fast`. No gradient headers.
- **Table:** column headers
  `text-xs font-bold uppercase tracking-caps text-fg-muted` with a
  `border-b border-strong`; rows `border-b border-subtle`, numeric cells
  `font-mono text-right`. Row hover `bg-surface-sunken/60`.
- **Tabs:** underline style — active tab `text-brand border-b-2 border-brand`,
  inactive `text-fg-muted`; pill variant only inside toolbars.
- **Dialogs/Sheets/Drawers:** surface `bg-card rounded-lg shadow-e3`; title in
  `font-display text-lg`; keep Radix wiring + all `data-*`/aria attributes
  exactly as-is.
- **Forms:** label `text-sm font-medium text-fg-secondary`; input
  `bg-surface border-strong rounded-md focus-visible:ring-ring`; error text
  `text-error text-sm` + icon; required marker `text-error`.
- **Buttons:** primary
  `bg-brand hover:bg-brand-hover text-fg-on-accent rounded-md`; secondary =
  outline `border-strong text-fg hover:bg-surface-sunken`; danger `bg-error`;
  **spark** variant (`bg-spark text-ink-900 shadow-glow-spark`) reserved for the
  one hero CTA/gamified action per screen, if any.
- **Badges/status chips:**
  `rounded-pill bg-<status>-subtle text-<status> text-2xs font-medium px-2` +
  leading icon. Confidence: `ConfidenceBadge` idiom — low/med/high color +
  numeric value in `font-mono`.
- **Stats/KPIs:** label `text-xs uppercase tracking-caps text-fg-muted`, value
  `font-display text-3xl`, delta `text-success`/`text-error` with arrow icon.
- **Empty states:** icon in `text-fg-muted`, `font-display text-lg` title,
  one-line body, single brand action. Encouraging copy for students, precise for
  staff.
- **Skeletons:** `bg-surface-sunken animate-pulse rounded-md` — match the real
  layout's boxes.
- **Sidebar/nav:** groups labeled with kicker style; active item =
  `bg-sidebar-accent text-sidebar-accent-foreground` (bridge makes this
  indigo-subtle) + a 2px `bg-brand` left rail; wordmark in Fraunces.
- **Grading/domain components:** follow the domain idioms in CORE-API §3
  (`GradePill`, `RubricBreakdown`, `TimerBar` tones, `UploadQueueItem` states) —
  translate their anatomy into your existing components, don't import the
  prototype bundle.

## 5. Per-lane migration recipe (follow verbatim)

Lanes for teacher-web (other apps: derive equivalent lanes from your inventory,
~4–6 route-clusters each, product-critical flows LAST so you're practiced):
**L1** exam lifecycle → **L2** grading/submissions → **L3** people/classes →
**L4** dashboard/analytics → **L5** shell/nav/auth.

Per lane:

1. **Read** the lane's per-screen specs + open the prototype at those routes
   (browser, `1440×940`).
2. **Baseline screenshots** of the current screens (Playwright, light + dark)
   into `apps/<app>/e2e/__lyceum-baseline__/` or a tmp dir.
3. **Translate tokens** file-by-file using §3 tables — class swaps only. Then
   apply §4 idiom upgrades where the spec shows different anatomy (e.g., kicker
   headers, mono numerics).
4. **Do NOT touch:** `@levelup/query` hooks and their call signatures,
   routes/guards (`RequireAuth`, route paths), `SessionProvider`/`sdk/`,
   business logic, data mapping, aria/keyboard wiring. JSX structure changes are
   allowed only for visual anatomy, never for data flow.
5. **e2e selectors:** preserve every `data-testid`/`getByRole`/`getByText`
   target. If a visual change must alter one (e.g., button text case), list it
   in the lane report and update the spec file in the same commit.
6. **Screenshot-compare** vs the prototype screen (side-by-side eyeball, not
   pixel-diff — the prototype is a target, data will differ). Check:
   canvas/surface hierarchy, display type on titles, status colors semantic,
   dark mode, focus rings visible.
7. **Gates per lane:** `typecheck` + `build` green; app boots; the lane's happy
   path click-through works (for grading/submissions: the full E2E-verified flow
   — upload → queue → review → override → release — must behave identically);
   existing Playwright e2e for the lane passes.
8. **Report** the lane: files touched, selector changes (if any), spec
   deviations + why, screenshots.

Commit per lane, not per file. Never mix a token-layer change (packages/) into a
lane commit.

## 6. Verification gates (per app, end of migration)

- `pnpm --filter @levelup/<app> typecheck` ✅
- `pnpm --filter @levelup/<app> build` ✅
- Playwright e2e suite for the app ✅ (selector updates deliberate + listed)
- Light/dark parity sweep: every migrated route in both themes — no unreadable
  pair, no un-flipped raw palette class left (grep gate below)
- Raw-palette regression grep (should trend to ~0; justify any survivor):
  `grep -rnE '(bg|text|border|ring)-(gray|slate|zinc|blue|emerald|teal|violet|purple)-[0-9]' src/ | grep -v node_modules`
- a11y spot-check: focus-visible ring on interactive elements, AA contrast on
  new pairings (the token pairs in §3 are pre-cleared; custom combos need a
  check), status = icon + label, `prefers-reduced-motion` honored (variables.css
  handles globally).

## 7. Escalation rules

- Screen has no spec/prototype → system idioms only (§4); never invent tokens.
  List it in your inventory as GAP.
- Need a new token/variant → coordinator (foundation change), not a local hex.
- Any new dependency (including Framer Motion) → ping coordinator BEFORE adding;
  lockfile is serialized. The preset's CSS keyframes cover the standard
  entrance/pop needs.
- Conflict between spec and live behavior → behavior wins; note the divergence
  in the lane report.
