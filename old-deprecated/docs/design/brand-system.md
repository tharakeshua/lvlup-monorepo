# Auto-LevelUp Brand System

> Version 1.0 -- March 2026 Author: Aria, Creative Design Lead

---

## 1. Color Palette

Five colors. Each has a job. No exceptions.

| Role          | Name        | Hex       | HSL         | CMYK            | CSS Variable          |
| ------------- | ----------- | --------- | ----------- | --------------- | --------------------- |
| Primary       | Midnight    | `#0A1628` | 216 63% 10% | C96 M78 Y42 K62 | `--color-midnight`    |
| Accent        | Signal Blue | `#2563EB` | 217 91% 53% | C82 M52 Y0 K0   | `--color-signal-blue` |
| Semantic      | Verdigris   | `#0D9488` | 175 84% 32% | C85 M15 Y45 K5  | `--color-verdigris`   |
| Neutral Dark  | Graphite    | `#4B5563` | 220 9% 34%  | C55 M40 Y32 K25 | `--color-graphite`    |
| Neutral Light | Ash         | `#F3F4F6` | 220 14% 96% | C3 M2 Y2 K0     | `--color-ash`         |

White (`#FFFFFF`) is the substrate, not a palette color.

### Derived Values (computed, never added to the palette)

| Derived         | Value     | Usage                                |
| --------------- | --------- | ------------------------------------ |
| Signal Blue 8%  | `#EFF6FF` | Hover/active light blue tint         |
| Verdigris 8%    | `#F0FDFA` | Hover/active light teal tint         |
| Midnight 60%    | `#6B7280` | Muted/disabled states                |
| Midnight muted  | `#94A3B8` | Subheadline text on dark backgrounds |
| Midnight subtle | `#64748B` | Footer text, fine print              |
| Border standard | `#E5E7EB` | Card/section borders                 |
| Dark surface    | `#111D2E` | Hero gradient endpoint, dark card bg |
| Dark border     | `#1E293B` | Dividers on dark backgrounds         |

### Gradient Policy

Maximum one gradient across all surfaces. Reserved for the hero section only.

```
Direction: top-left to bottom-right
From: #0A1628 (Midnight)
To:   #111D2E (6% lightness shift)
```

Everything else is flat color.

### CSS Custom Properties

```css
:root {
  --color-midnight: #0a1628;
  --color-signal-blue: #2563eb;
  --color-verdigris: #0d9488;
  --color-graphite: #4b5563;
  --color-ash: #f3f4f6;
  --color-white: #ffffff;

  --color-dark-surface: #111d2e;
  --color-muted: #94a3b8;
  --color-subtle: #64748b;
  --color-border: #e5e7eb;
  --color-dark-border: #1e293b;
  --color-blue-tint: #eff6ff;
  --color-teal-tint: #f0fdfa;
  --color-disabled: #6b7280;
}
```

---

## 2. Typography

One typeface: Inter. Two voices from one family.

### Typeface

| Role               | Typeface | Weight Range | Fallback                             |
| ------------------ | -------- | ------------ | ------------------------------------ |
| Display + Headings | Inter    | 600-800      | system-ui, -apple-system, sans-serif |
| Body + UI          | Inter    | 400-500      | system-ui, -apple-system, sans-serif |

Load via Google Fonts:

```html
<link
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
  rel="stylesheet"
/>
```

### Type Scale (8pt grid, 1.25 ratio)

| Token      | Size             | Weight | Line Height | Letter Spacing | Usage                        |
| ---------- | ---------------- | ------ | ----------- | -------------- | ---------------------------- |
| `display`  | 48px / 3rem      | 800    | 1.05        | -0.03em        | Hero headline only (website) |
| `h1`       | 36px / 2.25rem   | 800    | 1.1         | -0.025em       | Page titles, section openers |
| `h2`       | 28px / 1.75rem   | 700    | 1.15        | -0.02em        | Section headings             |
| `h3`       | 22px / 1.375rem  | 700    | 1.2         | -0.015em       | Card titles, feature names   |
| `h4`       | 18px / 1.125rem  | 600    | 1.3         | -0.01em        | Sub-section labels           |
| `body`     | 16px / 1rem      | 400    | 1.6         | 0              | Paragraphs, descriptions     |
| `body-sm`  | 14px / 0.875rem  | 400    | 1.5         | 0              | Captions, metadata, small UI |
| `caption`  | 12px / 0.75rem   | 500    | 1.4         | 0.01em         | Labels, chips, overlines     |
| `overline` | 11px / 0.6875rem | 700    | 1.2         | 0.08em         | Section labels (uppercased)  |

### Print Scale

Multiply all sizes by 0.7 for A4 print. Display becomes 34px, body becomes 11px.
Line heights stay the same.

### CSS

```css
.type-display {
  font-size: 3rem;
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.03em;
}
.type-h1 {
  font-size: 2.25rem;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.025em;
}
.type-h2 {
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.02em;
}
.type-h3 {
  font-size: 1.375rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.015em;
}
.type-h4 {
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
}
.type-body {
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.6;
  letter-spacing: 0;
}
.type-body-sm {
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.5;
  letter-spacing: 0;
}
.type-caption {
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
}
.type-overline {
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
```

---

## 3. Spacing Scale

Every spacing value is a multiple of 8px. No exceptions.

| Token     | Value | CSS Variable | Usage                                         |
| --------- | ----- | ------------ | --------------------------------------------- |
| `space-0` | 0     | `--space-0`  | Reset                                         |
| `space-1` | 4px   | `--space-1`  | Inline padding, icon-to-label gap (half-step) |
| `space-2` | 8px   | `--space-2`  | Minimum gap between related elements          |
| `space-3` | 16px  | `--space-3`  | Standard card padding, sibling gap            |
| `space-4` | 24px  | `--space-4`  | Section inner padding                         |
| `space-5` | 32px  | `--space-5`  | Section-to-section gap                        |
| `space-6` | 48px  | `--space-6`  | Major section dividers                        |
| `space-7` | 64px  | `--space-7`  | Page-level vertical rhythm                    |
| `space-8` | 96px  | `--space-8`  | Hero section vertical padding                 |
| `space-9` | 128px | `--space-9`  | Maximum breathing room                        |

### CSS

```css
:root {
  --space-0: 0;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 16px;
  --space-4: 24px;
  --space-5: 32px;
  --space-6: 48px;
  --space-7: 64px;
  --space-8: 96px;
  --space-9: 128px;
}
```

---

## 4. Border Radius

| Token         | Value  | CSS Variable    | Usage                             |
| ------------- | ------ | --------------- | --------------------------------- |
| `radius-none` | 0      | `--radius-none` | Tables, full-bleed sections       |
| `radius-sm`   | 4px    | `--radius-sm`   | Chips, badges, buttons, small UI  |
| `radius-md`   | 8px    | `--radius-md`   | Cards, inputs                     |
| `radius-lg`   | 12px   | `--radius-lg`   | Hero feature cards, modals (rare) |
| `radius-full` | 9999px | `--radius-full` | Pills, avatars, circular elements |

**Rule:** Cards get `radius-md`. Nothing gets `radius-lg` unless it is a
hero-level feature card. Buttons get `radius-sm`.

---

## 5. Shadow System

Elements do NOT have shadows by default. Shadows appear on hover or for elevated
UI only.

| Token         | Value                               | CSS Variable    | Usage                     |
| ------------- | ----------------------------------- | --------------- | ------------------------- |
| `shadow-none` | none                                | `--shadow-none` | Default for everything    |
| `shadow-sm`   | `0 1px 2px rgba(10, 22, 40, 0.05)`  | `--shadow-sm`   | Subtle card lift on hover |
| `shadow-md`   | `0 4px 12px rgba(10, 22, 40, 0.08)` | `--shadow-md`   | Elevated cards, dropdowns |
| `shadow-lg`   | `0 8px 24px rgba(10, 22, 40, 0.12)` | `--shadow-lg`   | Modals, overlays (rare)   |

**Rule:** If adding `shadow-md` to a static card, stop. Use a 1px border
instead.

---

## 6. Icon Grid Specification

All icons are bespoke SVGs built from the brand geometry.

| Property      | Value                                        |
| ------------- | -------------------------------------------- |
| Viewbox       | `0 0 24 24`                                  |
| Optical grid  | 20px live area (2px padding each side)       |
| Stroke weight | 1.5px                                        |
| Corner radius | 1.5px on stroke joins                        |
| Line cap      | `round`                                      |
| Line join     | `round`                                      |
| Fill          | `none` (stroke-only)                         |
| Default color | `currentColor`                               |
| Construction  | Circles, rectangles, 45/90-degree lines only |

### Icon Set (18 icons)

| Name         | File                    | Description                                         |
| ------------ | ----------------------- | --------------------------------------------------- |
| learning     | `icon-learning.svg`     | Open book with upward arrow on right page           |
| progress     | `icon-progress.svg`     | 3 ascending bars with checkpoint dot                |
| exam         | `icon-exam.svg`         | Clipboard with lines and checkmark                  |
| grading      | `icon-grading.svg`      | Pencil on ruled surface with "A"                    |
| ai           | `icon-ai.svg`           | Neural node: center circle, 4 radiating connections |
| student      | `icon-student.svg`      | Bust with graduation cap                            |
| teacher      | `icon-teacher.svg`      | Bust with pointer/ruler                             |
| upload       | `icon-upload.svg`       | Upward arrow from open box                          |
| analytics    | `icon-analytics.svg`    | Line chart trending up with data point              |
| settings     | `icon-settings.svg`     | Hexagonal gear with center circle                   |
| notification | `icon-notification.svg` | Bell with dot indicator                             |
| calendar     | `icon-calendar.svg`     | Calendar with binding rings and date grid           |
| badge        | `icon-badge.svg`        | Shield with centered star                           |
| search       | `icon-search.svg`       | Magnifying glass                                    |
| report       | `icon-report.svg`       | Document with bar chart                             |
| home         | `icon-home.svg`         | House with door                                     |
| scan         | `icon-scan.svg`         | Phone with scan line and corner brackets            |
| feedback     | `icon-feedback.svg`     | Speech bubble with lines                            |

### Usage in HTML

Icons are always inlined as SVG, never loaded from a library. Stroke color uses
`currentColor` by default and is overridden via `color` or `style` on the parent
element.

```html
<span style="color: #0D9488;">
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <!-- icon paths -->
  </svg>
</span>
```

---

## 7. Component Patterns

### Card (standard)

```
Background: #FFFFFF (or #F3F4F6 on white sections)
Border: 1px solid #E5E7EB
Border-radius: 8px (radius-md)
Padding: 16px (space-3)
Shadow: none (shadow-sm on hover)
```

### Card with accent

```
Same as standard +
Border-left: 3px solid [accent color]
  Signal Blue (#2563EB) for LvlUp Spaces features
  Verdigris (#0D9488) for AutoGrade features
```

### Button (primary)

```
Background: #2563EB
Color: #FFFFFF
Font: Inter 600, 14px
Padding: 8px 20px
Border-radius: 4px (radius-sm)
Border: none
Hover: darken by 8%
```

### Button (secondary)

```
Background: transparent
Color: #FFFFFF (on dark) or #0A1628 (on light)
Border: 1px solid rgba(255,255,255,0.2) (on dark) or 1px solid #E5E7EB (on light)
Font: Inter 600, 14px
Padding: 8px 20px
Border-radius: 4px (radius-sm)
```

### Overline label

```
Font: Inter 700, 11px
Letter-spacing: 0.08em
Text-transform: uppercase
Color: Signal Blue (on dark backgrounds) or Graphite (on light backgrounds)
```

---

## 8. Voice and Tone

### Voice Attributes

- **Confident, not arrogant.** "Auto-LevelUp solves this" not "Auto-LevelUp is
  the best."
- **Precise, not verbose.** Lead with the number, the metric, the outcome.
- **Warm, not casual.** We talk to school principals, not startup founders.
- **Direct, not hyperbolic.** No "revolutionary," "game-changing," or
  "disruptive."

### Headline Pattern

Structure: [Subject] + [Verb] + [Outcome]

- "Every Student Deserves to Level Up."
- "Grade a Class Exam in 8 Minutes."
- "AI Grades. Teachers Decide."

### CTA Pattern

- Primary: "Book a Demo" or "Request a Demo"
- Secondary: "See How It Works"
- Never: "Sign Up Free," "Get Started Now," "Try It Today"

---

## 9. Tailwind CSS Configuration

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        midnight: "#0A1628",
        "signal-blue": "#2563EB",
        verdigris: "#0D9488",
        graphite: "#4B5563",
        ash: "#F3F4F6",
        "dark-surface": "#111D2E",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      fontSize: {
        display: [
          "3rem",
          { lineHeight: "1.05", letterSpacing: "-0.03em", fontWeight: "800" },
        ],
        h1: [
          "2.25rem",
          { lineHeight: "1.1", letterSpacing: "-0.025em", fontWeight: "800" },
        ],
        h2: [
          "1.75rem",
          { lineHeight: "1.15", letterSpacing: "-0.02em", fontWeight: "700" },
        ],
        h3: [
          "1.375rem",
          { lineHeight: "1.2", letterSpacing: "-0.015em", fontWeight: "700" },
        ],
        h4: [
          "1.125rem",
          { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "600" },
        ],
      },
      spacing: {
        "space-1": "4px",
        "space-2": "8px",
        "space-3": "16px",
        "space-4": "24px",
        "space-5": "32px",
        "space-6": "48px",
        "space-7": "64px",
        "space-8": "96px",
        "space-9": "128px",
      },
      borderRadius: {
        sm: "4px",
        md: "8px",
        lg: "12px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(10, 22, 40, 0.05)",
        md: "0 4px 12px rgba(10, 22, 40, 0.08)",
        lg: "0 8px 24px rgba(10, 22, 40, 0.12)",
      },
    },
  },
};
```

---

_End of Brand System v1.0_
