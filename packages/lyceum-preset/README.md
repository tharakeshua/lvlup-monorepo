# @levelup/lyceum-preset

The **Lyceum** design system ("Modern Scholarly") as a shared token layer for
all 5 LevelUp web apps. Fraunces display serif + Schibsted Grotesk UI + Spline
Sans Mono, warm paper/ink neutrals, scholarly indigo brand, marigold "spark"
accent.

**Source of truth:** `old-deprecated/docs/rebuild-spec/design/00-FOUNDATION.md`
§2–§4 and `build/tokens/lyceum.css` (frozen Lyceum core). This package is a
faithful port — do not invent values here; change the foundation first.

## What's inside

| File         | Role                                                                                                                                                                                                                                                                 |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preset.cjs` | Tailwind v3 preset: Lyceum colors (semantic + primitives), type scale, radius, elevation, motion. Stacks after `@levelup/tailwind-config`.                                                                                                                           |
| `tokens.css` | The Lyceum custom properties (`--bg-canvas`, `--brand-primary`, …, exactly as in CORE-API.md) + `--ly-*` HSL twins for alpha-capable utilities. Dark theme under `.dark` and `[data-theme="dark"]`.                                                                  |
| `bridge.css` | **The coexistence trick.** Overrides every shadcn HSL variable from `@levelup/tailwind-config/variables.css` with Lyceum values — all existing shared-ui/shadcn components repaint in Lyceum with zero component edits. Steps aside when `.high-contrast` is active. |
| `base.css`   | Opt-in element defaults (`@layer base`): body on canvas, h1–h3 in Fraunces with optical sizing, tabular numerals for mono.                                                                                                                                           |
| `fonts.css`  | Google Fonts `@import` (prefer `<link>` in index.html — see file header).                                                                                                                                                                                            |
| `lyceum.css` | Convenience bundle: fonts + tokens + bridge + base.                                                                                                                                                                                                                  |
| `tokens.cjs` | JS source of truth; `tokens.css`/`bridge.css` are generated from it.                                                                                                                                                                                                 |

`tokens.css` and `bridge.css` are **generated** — edit `tokens.cjs`, then
`node scripts/generate-css.cjs`.

## Adopting in an app (2 edits + 1 dep)

1. `package.json`: add `"@levelup/lyceum-preset": "workspace:*"` to
   devDependencies.
2. `tailwind.config.ts`:

   ```ts
   import sharedConfig from "@levelup/tailwind-config";
   import lyceumPreset from "@levelup/lyceum-preset";

   export default {
     presets: [sharedConfig, lyceumPreset], // Lyceum LAST — it wins overlaps
     content: [
       /* unchanged */
     ],
     safelist: sharedSafelist,
   } satisfies Config;
   ```

3. `src/index.css`:

   ```css
   @import "@levelup/tailwind-config/variables.css"; /* keep: a11y modes, resets */
   @import "@levelup/lyceum-preset/lyceum.css"; /* AFTER variables.css */
   @tailwind base;
   @tailwind components;
   @tailwind utilities;
   ```

That alone repaints the whole app (shadcn semantic classes now resolve to
Lyceum). Screen-by-screen restyle then follows
`docs/design-migration/UI-MIGRATION-PATTERN.md`.

## Utility cheat-sheet (what the preset adds)

- Backgrounds: `bg-canvas` · `bg-surface` · `bg-surface-sunken` ·
  `bg-surface-inset`
- Text: `text-fg` · `text-fg-secondary` · `text-fg-muted` · `text-fg-on-accent`
- Borders: `border-subtle` · `border-strong`
- Brand: `bg-brand` / `hover:bg-brand-hover` / `bg-brand-subtle` /
  `border-brand-muted`
- Spark (gamification/CTA only): `bg-spark` / `bg-spark-hover` /
  `bg-spark-subtle` / `shadow-glow-spark`
- Status: `bg-success|warning|error|info` (+ `-subtle` fills)
- Domain: `bg-confidence-low|med|high` · `text-grade-a…f` ·
  `bg-mastery-not-started|in-progress|mastered` · `text-xp` · `text-streak`
- Type: `font-display` (Fraunces) · `font-sans` (Schibsted) · `font-mono`
  (Spline); `text-2xs…text-5xl` = Lyceum major-third scale with paired
  leading/tracking; `tracking-caps` for uppercase kickers
- Radius: `rounded-sm|md|lg|xl` = 6/10/14/20px · `rounded-pill`
- Elevation: `shadow-e1|e2|e3` (warm-tinted)
- Motion: `duration-instant|fast|base|slow|page` · `ease-standard|entrance|exit`
  · `animate-ly-rise` · `animate-ly-pop`
- Layout: `max-w-content` (1200) · `max-w-reading` (720)

Semantic colors support alpha modifiers (`bg-brand/20`) via the `--ly-*` twins
and flip automatically in dark mode. Primitive scales (`paper-*`, `ink-*`,
`marigold-*`, Lyceum `indigo-*`) are static escape hatches — prefer semantic.

⚠️ The preset overrides Tailwind built-ins on purpose: the default `text-*` size
scale, `rounded-sm|md|lg|xl`, and the six Lyceum `indigo` stops
(50/200/400/500/600/700). Banned by the foundation: raw SaaS-blue hexes,
Inter/Roboto, `bg-blue-*` for brand, gradients-on-white, pure `#FFF` surfaces.
