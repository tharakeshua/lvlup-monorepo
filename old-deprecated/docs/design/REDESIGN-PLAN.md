# Auto-LevelUp — Design Redesign Plan

> **Author:** Aria, Creative Design Lead **Version:** 1.0 — March 2026
> **Status:** PLAN — awaiting approval before implementation

---

## Executive Summary

The current pamphlet and brochure are functional but visually generic. They rely
on emoji as icons, use too many gradients, have no typographic hierarchy beyond
weight variation, and look like they were made with a template builder. The
color palette has 11+ named colors — no restraint, no system.

This redesign establishes a single brand system and applies it ruthlessly across
three surfaces: marketing website, A4 tri-fold brochure, and DL pamphlet. The
goal is simple: a school principal picks up our brochure or lands on our website
and thinks _"these people are serious."_

---

## 1. Brand System

### 1.1 Color Palette — 5 Colors, No Exceptions

Every color has a purpose. If a color doesn't have a job, it doesn't exist.

| Role              | Name        | Hex       | HSL            | CMYK              | Usage                                                                            |
| ----------------- | ----------- | --------- | -------------- | ----------------- | -------------------------------------------------------------------------------- |
| **Primary**       | Midnight    | `#0A1628` | `216° 63% 10%` | `C96 M78 Y42 K62` | Headlines, nav, footer, primary text, hero backgrounds                           |
| **Accent**        | Signal Blue | `#2563EB` | `217° 91% 53%` | `C82 M52 Y0 K0`   | CTAs, links, interactive elements, key data points, LvlUp Spaces identity        |
| **Neutral Dark**  | Graphite    | `#4B5563` | `220° 9% 34%`  | `C55 M40 Y32 K25` | Body text, secondary labels, descriptions                                        |
| **Neutral Light** | Ash         | `#F3F4F6` | `220° 14% 96%` | `C3 M2 Y2 K0`     | Section backgrounds, card fills, dividers, breathing room                        |
| **Semantic**      | Verdigris   | `#0D9488` | `175° 84% 32%` | `C85 M15 Y45 K5`  | AutoGrade identity, success states, secondary accent for product differentiation |

**Derived values** (computed, not added to the palette):

- Signal Blue at 8% opacity → `#EFF6FF` for light blue tints on hover/active
  states
- Verdigris at 8% opacity → `#F0FDFA` for light teal tints
- Midnight at 60% → `#6B7280` for muted/disabled states
- White `#FFFFFF` for card surfaces (not a "color" — it's the substrate)

**What's gone:**

- Navy2 (`#1e3a8a`), Sky (`#0ea5e9`), Emerald (`#059669`), Violet (`#7c3aed`),
  Purple (`#9333ea`), Amber (`#d97706`), Rose (`#e11d48`) — all deleted
- All multi-stop gradients — deleted entirely. We use flat color or a
  single-direction subtle gradient (Midnight to Midnight+8% lighter) for hero
  sections only

**Gradient policy:** Maximum one gradient on the entire site/brochure — the hero
section. It goes from `#0A1628` to `#111D2E` (a 6% lightness shift). Everything
else is flat color. Gradients are a crutch for indecisive palettes.

### 1.2 Typography — 2 Typefaces, Hard Commitment

| Role                   | Typeface                             | Fallback                 | Why                                                                                                                                            |
| ---------------------- | ------------------------------------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Display + Headings** | **Inter** (variable, 600–800 weight) | system-ui, -apple-system | Geometric precision, tight letter-spacing at large sizes, excellent for data-heavy education context. Already loaded — zero additional weight. |
| **Body + UI**          | **Inter** (variable, 400–500 weight) | system-ui, -apple-system | Same family for body ensures perfect vertical rhythm. The variable font covers all weights in one file.                                        |

We are _not_ adding a second typeface. Inter at display sizes (tight tracking,
heavy weight) and Inter at body sizes (normal tracking, regular weight) read as
two distinct voices from one family. Adding a serif or display face would be
decorative, not functional. Education content needs clarity, not personality
through type variety.

**Type Scale (8pt grid, 1.25 ratio):**

| Token      | Size             | Weight | Line Height | Letter Spacing | Usage                             |
| ---------- | ---------------- | ------ | ----------- | -------------- | --------------------------------- |
| `display`  | 48px / 3rem      | 800    | 1.05        | -0.03em        | Hero headline only (website)      |
| `h1`       | 36px / 2.25rem   | 800    | 1.1         | -0.025em       | Page titles, section openers      |
| `h2`       | 28px / 1.75rem   | 700    | 1.15        | -0.02em        | Section headings                  |
| `h3`       | 22px / 1.375rem  | 700    | 1.2         | -0.015em       | Card titles, feature names        |
| `h4`       | 18px / 1.125rem  | 600    | 1.3         | -0.01em        | Sub-section labels                |
| `body`     | 16px / 1rem      | 400    | 1.6         | 0              | Paragraphs, descriptions          |
| `body-sm`  | 14px / 0.875rem  | 400    | 1.5         | 0              | Captions, metadata, small UI text |
| `caption`  | 12px / 0.75rem   | 500    | 1.4         | 0.01em         | Labels, chips, overlines          |
| `overline` | 11px / 0.6875rem | 700    | 1.2         | 0.08em         | Section labels (uppercased)       |

**Print scale:** Multiply all sizes by 0.7 for A4 print. The `display` token
becomes 34px on paper, `body` becomes 11px. Line heights stay the same.

### 1.3 Spacing Scale — 8pt Base Grid

Every spacing value is a multiple of 8px. No exceptions. No `padding: 5px`. No
`margin: 10px`.

| Token     | Value | Usage                                                                  |
| --------- | ----- | ---------------------------------------------------------------------- |
| `space-0` | 0     | Reset                                                                  |
| `space-1` | 4px   | Inline padding, icon-to-label gap (half-step, only for tight contexts) |
| `space-2` | 8px   | Minimum gap between related elements                                   |
| `space-3` | 16px  | Standard card padding, gap between sibling elements                    |
| `space-4` | 24px  | Section inner padding                                                  |
| `space-5` | 32px  | Section-to-section gap                                                 |
| `space-6` | 48px  | Major section dividers                                                 |
| `space-7` | 64px  | Page-level vertical rhythm                                             |
| `space-8` | 96px  | Hero section vertical padding                                          |
| `space-9` | 128px | Maximum breathing room                                                 |

### 1.4 Border Radius

| Token         | Value  | Usage                             |
| ------------- | ------ | --------------------------------- |
| `radius-none` | 0      | Tables, full-bleed sections       |
| `radius-sm`   | 4px    | Chips, badges, small UI elements  |
| `radius-md`   | 8px    | Cards, inputs, buttons            |
| `radius-lg`   | 12px   | Feature cards, modals             |
| `radius-full` | 9999px | Pills, avatars, circular elements |

**The rule:** Cards get `radius-md`. Nothing gets `radius-lg` unless it's a
hero-level feature card. Buttons get `radius-sm`. No rounded everything.

### 1.5 Shadow System — Restrained

| Token         | Value                               | Usage                     |
| ------------- | ----------------------------------- | ------------------------- |
| `shadow-none` | none                                | Default. Most elements.   |
| `shadow-sm`   | `0 1px 2px rgba(10, 22, 40, 0.05)`  | Subtle card lift on hover |
| `shadow-md`   | `0 4px 12px rgba(10, 22, 40, 0.08)` | Elevated cards, dropdowns |
| `shadow-lg`   | `0 8px 24px rgba(10, 22, 40, 0.12)` | Modals, overlays — RARE   |

**The rule:** Elements do NOT have shadows by default. Shadows appear on hover
or for truly elevated UI (modals, tooltips). If you're adding `shadow-md` to a
static card, stop and ask if the card actually needs elevation or if a 1px
border would suffice.

### 1.6 Icon Grid Specification

All icons are constructed on the same geometric grid. No pre-made library icons.
Every icon is a bespoke SVG.

| Property                   | Value                                                                                                                              | Rationale                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Viewbox**                | `0 0 24 24`                                                                                                                        | Standard 24px grid                                                   |
| **Optical grid**           | 20px live area within the 24px frame (2px padding each side)                                                                       | Ensures optical alignment when icons sit beside text                 |
| **Stroke weight**          | 1.5px                                                                                                                              | Matches Inter's stem weight at 16px body size                        |
| **Corner radius**          | 1.5px on all stroke joins                                                                                                          | Consistent with the `radius-sm` design token                         |
| **Line cap**               | `round`                                                                                                                            | Softer than `butt`, more precise than `square`                       |
| **Line join**              | `round`                                                                                                                            | Consistent with cap                                                  |
| **Fill**                   | `none` — all icons are stroke-only                                                                                                 | Outline style reads cleaner at small sizes, distinguishes from emoji |
| **Color**                  | `currentColor`                                                                                                                     | Icons inherit text color — no hardcoded fills                        |
| **Construction principle** | Every icon built from circles, rectangles, and 45/90-degree lines only. No freeform curves. This gives the set geometric cohesion. |

---

## 2. Icon Set Plan

16 bespoke SVG icons. Each described with exact visual construction so
implementation is unambiguous.

| #   | Name           | Visual Concept                                                                         | Construction Geometry                                                                                                                                                              |
| --- | -------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `learning`     | Open book with a subtle upward arrow integrated into the right page                    | Two angled rectangles forming a book spine. Right page has a 45° arrow pointing up-right. Stroke only.                                                                             |
| 2   | `progress`     | Ascending bar chart (3 bars) with a small checkpoint dot on the tallest bar            | Three vertical rectangles at 40%, 65%, 100% height. Small circle (r=1.5) centered on top of the tallest bar.                                                                       |
| 3   | `exam`         | Clipboard with three horizontal lines and a checkmark on the bottom line               | Rectangle with a small tab at top-center (the clip). Three horizontal lines evenly spaced. Bottom line terminates with a small check (two strokes at 45° and -45°).                |
| 4   | `grading`      | Pencil writing on a ruled surface, with a small "A" floating above                     | Diagonal pencil (45°, bottom-left to mid-center). Two horizontal rules below. Small uppercase "A" at top-right constructed from three strokes.                                     |
| 5   | `ai`           | A minimal neural node: center circle with 4 lines radiating to 4 smaller outer circles | Center circle (r=3). Four lines at 45° intervals connecting to four smaller circles (r=1.5) at the grid edges. Clean, geometric, not a brain.                                      |
| 6   | `student`      | Minimal bust silhouette with a small graduation cap                                    | Circle for head (r=3, centered above). Shoulders as a half-ellipse below. Small square rotated 45° on top of head circle (the mortarboard) with a horizontal line.                 |
| 7   | `teacher`      | Bust silhouette with a pointer/ruler extending from the right hand                     | Circle head, shoulder curve. A diagonal line extending from right shoulder area at 30° (the pointer), with a small perpendicular endcap.                                           |
| 8   | `upload`       | Upward arrow emerging from an open box                                                 | Open-top rectangle (the tray/box). Vertical arrow centered above, with a standard arrowhead (two 45° lines).                                                                       |
| 9   | `analytics`    | Line chart trending upward with a small data point circle at the peak                  | Rectangle frame (axes). A polyline starting low-left, dipping slightly, then rising sharply to upper-right. Circle at the peak (r=1.5).                                            |
| 10  | `settings`     | Single gear — hexagonal outer ring with a center circle                                | Hexagon (6 vertices) with small rectangular teeth on each edge (notches). Circle in the center (r=2.5). Simple, not overly detailed.                                               |
| 11  | `notification` | Bell shape with a small dot indicator at top-right                                     | Bell silhouette: half-circle dome, straight sides widening to a flat bottom, small clapper circle beneath. Small filled circle (r=1.5) at the 2-o'clock position as the indicator. |
| 12  | `calendar`     | Minimal calendar: rectangle with two binding rings and a grid of dots                  | Rectangle body. Two short vertical lines protruding from the top edge (binding rings). 3x3 grid of small circles (r=0.8) inside the body representing dates.                       |
| 13  | `badge`        | Shield shape with a star centered inside                                               | Shield path: pointed bottom, flat top with slight outward curve on sides. Five-pointed star centered inside, constructed from 5 line segments.                                     |
| 14  | `search`       | Circle with a diagonal line extending from lower-right (magnifying glass)              | Circle (r=4) for the lens. Diagonal line at 45° extending from the 5-o'clock position of the circle downward-right (the handle).                                                   |
| 15  | `report`       | Document with a small bar chart in the lower half                                      | Rectangle with a folded corner (upper-right triangle). Two horizontal lines in the upper third (text). Three small vertical bars of increasing height in the lower half (chart).   |
| 16  | `home`         | House: pentagon (triangle roof on rectangle body) with a small door rectangle          | Triangle on top (the roof). Rectangle below (the body). Smaller rectangle centered at the bottom edge (the door). All constructed from straight lines.                             |
| 17  | `scan`         | Phone outline with a scanning line across the middle                                   | Rounded rectangle (phone body). Horizontal dashed line at mid-height (the scan line). Small corner brackets at the document area indicating scan frame.                            |
| 18  | `feedback`     | Speech bubble with three horizontal lines inside                                       | Rounded rectangle with a small triangle pointer at bottom-left. Three horizontal lines inside, decreasing in width from top to bottom.                                             |

---

## 3. Website Design Spec Plan

### 3.1 Navigation

**Structure:** Fixed top bar, 64px height. Logo left, nav links center, CTA
right.

- **Logo:** "Auto-LevelUp" wordmark in Inter 700, 18px. "Auto" in Midnight,
  "LevelUp" in Signal Blue. No icon/box — text only.
- **Nav links:** Home, Features, How It Works, For Schools, Pricing — Inter 500,
  14px, Graphite. Active state: Signal Blue with a 2px bottom border.
- **CTA button:** "Book a Demo" — Signal Blue background, white text, Inter 600,
  14px, `radius-sm`, 8px 20px padding.
- **Sticky behavior:** Nav becomes translucent (`backdrop-blur(12px)`, white at
  80% opacity) on scroll. No shadow — just the blur.
- **Mobile:** Hamburger icon (three horizontal lines, 1.5px stroke, from our
  icon grid). Slides in a full-screen menu from the right, Midnight background,
  white text, staggered fade-in (each item 50ms delayed).

### 3.2 Hero Section

**Layout:** Full-viewport height. Split asymmetrically: 55% text left, 45%
visual right.

**Background:** Midnight (`#0A1628`) with a single subtle gradient to `#111D2E`
from top-left to bottom-right. No circles, no blobs, no decorative shapes.

**Left side:**

- Overline: "AI-POWERED EDUCATION PLATFORM" — `overline` token, Signal Blue,
  letterspaced
- Headline: "Every Student Deserves to Level Up." — `display` token, white, 800
  weight
- Subheadline: The 15-second elevator pitch — `body` token, `#94A3B8` (Midnight
  at 40% lightness), max-width 520px
- Two buttons side by side:
  - Primary: "Book a Demo" — Signal Blue bg, white text, `radius-sm`
  - Secondary: "See How It Works" — transparent bg, white border (1px, 20%
    opacity), white text, `radius-sm`
- Below buttons: a small proof stat strip — "15 Question Types | 8-Minute
  Grading | 24/7 AI Tutor" — `caption` token, `#64748B`

**Right side:**

- Abstract representation of the platform — NOT a screenshot, NOT an
  illustration, NOT a 3D render
- A minimal isometric arrangement of UI card fragments: a small progress bar
  card, a grading result snippet, a badge notification — all using our exact
  color tokens, drawn as flat SVG/CSS, offset on a subtle grid
- These fragments float with a gentle parallax on scroll (2-4px shift per 100px
  scroll)

**Motion:**

- Headline: fade up + 20px translate, 600ms, ease-out, 200ms delay
- Subheadline: fade up, 600ms, ease-out, 400ms delay
- Buttons: fade up, 400ms, ease-out, 600ms delay
- Right-side cards: staggered fade-in from right, each 100ms apart, 800ms total
- No bounce. No overshoot. No spring physics.

### 3.3 Problem Section

**Layout:** White background. Centered content, max-width 1120px.

**Structure:**

- Overline: "THE CHALLENGE" — `overline` token, Graphite
- Heading: "Schools Face Four Problems Every Day" — `h1` token, Midnight
- 4 problem cards in a 2x2 grid (gap: 24px)

**Each card:**

- Left border: 3px, Verdigris (NOT rose — we no longer have a rose color.
  Problems get the accent that implies "we fix this")
- Bespoke icon from our set (top-left, 24px, Verdigris)
- Title: `h4` token, Midnight
- Description: `body-sm` token, Graphite, max 2 lines
- Background: Ash (`#F3F4F6`)
- No shadow. 1px border in `#E5E7EB`.

**Motion:** Cards stagger in on scroll, 100ms apart, fade up + 12px translate,
400ms ease-out.

### 3.4 Solution Overview Section

**Layout:** Midnight background, full-width.

**Structure:**

- Overline: "THE SOLUTION" — `overline` token, Signal Blue
- Heading: "Two Platforms. One Student Profile. Complete Insight." — `h1` token,
  white
- Two product cards side by side (60/40 gap: 32px)

**LvlUp Spaces card (left):**

- Header stripe: Signal Blue, 4px top border
- Title: "LvlUp Spaces" — `h2` token, white on Midnight card background
  (`#111D2E`)
- Subtitle: "Continuous AI-Powered Learning" — `body-sm`, `#94A3B8`
- 5 key bullets with bespoke icons, each `body-sm`, white
- Key stat: "15 Question Types" — large number in Signal Blue, label beneath

**AutoGrade card (right):**

- Header stripe: Verdigris, 4px top border
- Same structure, Verdigris accent for stat number
- Key stat: "8 Minutes" — large number

**Motion:** Cards slide in from their respective sides (left card from left,
right from right), 16px translate, 500ms, ease-out. Staggered by 150ms.

### 3.5 Features Section — LvlUp Spaces

**Layout:** White background. Alternating left-right layout for each feature
cluster.

**Structure:** 3 feature clusters, each containing:

- A label on the left or right (alternating)
- A visual representation on the opposite side

**Cluster 1 — AI Tutor + Evaluator:**

- Left: Heading + description + 3 key bullets
- Right: Stylized chat interface mockup (flat SVG/CSS) showing a Socratic Q&A
  exchange with our exact type tokens and colors

**Cluster 2 — 15 Question Types + Adaptive Difficulty:**

- Right: Heading + description + grid of question type chips (3x5 or 5x3)
- Left: A minimal difficulty curve visualization — a line chart showing
  adaptation over time

**Cluster 3 — Gamification + Progress:**

- Left: Heading + description + badges row (5 badges from Common to Legendary,
  using our icon grid)
- Right: A progress dashboard fragment showing XP bar, streak counter, level
  indicator

**Motion per cluster:** Scroll-triggered. Text side fades in + 16px translate
from its side. Visual side fades in 200ms later. No parallax — just reveal.

### 3.6 Features Section — AutoGrade

**Layout:** Ash background, full-width.

**Structure:**

- Heading: "From Scan to Student Feedback — Before the Next Period." — `h1`,
  Midnight
- The 5-step pipeline as a horizontal flow:
  - Each step: bespoke icon (scan, exam, ai, grading, report) + step name +
    one-line description
  - Connected by a thin horizontal line (1.5px, Verdigris) with subtle animated
    dashes on scroll
  - Active step (on hover or scroll position): Verdigris background, white text

**Below the pipeline:**

- 2x2 grid of AutoGrade feature cards (same card style as Problem section but
  with Verdigris accent)
- Features: Rubric Modes, Bulk Grading, Manual Override, Cost Tracking

**Motion:** Pipeline steps reveal left-to-right on scroll, 100ms stagger, each
step's connecting line draws in (stroke-dashoffset animation, 300ms).

### 3.7 Stakeholder Sections

**Layout:** One section per stakeholder (Teacher, Student, Parent, Admin). Each
gets its own page-section.

**Visual approach:** All four use the SAME layout template. Differentiation
comes from the headline and content, NOT from different colors per stakeholder.
All use Midnight + Signal Blue. We are NOT assigning amber to parents or violet
to admins — that was the old chaos.

**Template per stakeholder:**

- Left 40%: Heading ("For Teachers" / "For Students" / etc.), `h2`, Midnight.
  Sub-heading with the stakeholder's primary message from CONTENT-SPEC. 5
  bullets.
- Right 60%: A "dashboard preview" — a flat, stylized card arrangement showing
  what that stakeholder sees in the platform. Built with our color tokens, not a
  screenshot. Each dashboard preview uses the same card geometry but different
  data.

**Motion:** Text fades in from left, dashboard preview fades in from right,
200ms stagger.

### 3.8 Social Proof / Stats Section

**Layout:** Midnight background. A single row of 5 key stats, centered.

**Stats:** 15 Question Types | 8 Apps | 8 Min Grading | 24/7 AI Tutor | 5
At-Risk Signals

**Each stat:**

- Large number: `display` token equivalent (48px), white, 800 weight
- Label below: `caption` token, `#94A3B8`
- No boxes, no cards, no icons — just numbers and labels with generous spacing

**Motion:** Each number counts up from 0 on scroll entry (200ms per digit,
staggered 100ms between stats). Text stays static.

### 3.9 Footer

**Layout:** Midnight background, `space-7` top padding, `space-5` bottom
padding.

**Structure:**

- Top row: Logo (text wordmark), tagline, and "Book a Demo" CTA button
- Middle row (3 columns): Product links (LvlUp Spaces, AutoGrade), Company links
  (About, Contact), Legal links (Privacy, Terms)
- Bottom row: Copyright line, `caption` token, `#64748B`
- No social icons unless they're bespoke from our icon set

**Divider:** 1px horizontal line, `#1E293B`, between middle and bottom rows.

---

## 4. Brochure Redesign Plan

### 4.1 Format & Layout System

**Format:** A4 (210mm x 297mm), 12 pages, perfect-bound booklet style (intended
for digital PDF distribution and short-run print).

**Grid:** 12-column, 5mm column gutter, 8pt baseline grid.

**Margins:**

- Top: 15mm
- Bottom: 12mm (footer area)
- Inside (spine): 18mm
- Outside: 12mm
- Bleed: 3mm all sides

**Safe zone:** All text and critical elements inside a 186mm x 270mm live area.

### 4.2 Page-by-Page Breakdown

#### Page 1 — Cover

**What changes from current:** The current cover has a centered layout with a
gradient background, oversized logo box, and multiple text layers (eyebrow,
headline, tagline, pill row, divider, footer text). It's busy.

**New approach:**

- Background: Midnight flat color. No gradient.
- Upper third: "Auto-LevelUp" wordmark in white, Inter 800, 28pt. Left-aligned,
  not centered.
- Center: Headline "Every Student Deserves to Level Up." — Inter 800, 42pt,
  white. Left-aligned. Line break after "Deserves" — second line in Signal Blue.
- Lower third: Thin horizontal rule (0.5pt, white at 20%). Below it: "AI-Powered
  Learning + Intelligent Grading — Built for Schools" in Inter 400, 11pt,
  `#94A3B8`.
- Bottom edge: `autolevelup.in` in Inter 500, 9pt, `#64748B`.
- No emoji. No pills. No circles. No decorative elements. The cover is type,
  color, and space.

#### Page 2 — The Problem

**What changes:** Remove rose/red gradient header. Remove emoji in challenge
cards. Remove the big quote block.

**New approach:**

- Header strip: 15mm Midnight bar at top with "THE CHALLENGE" overline in Signal
  Blue, left-aligned.
- Heading: "Schools Face Four Problems Every Day" — h1 token scaled for print,
  Midnight.
- Four problem cards in a 2x2 grid. Each card:
  - Left border: 2pt, Verdigris
  - Icon: Bespoke icon from our set (learning, grading, analytics,
    notification), Verdigris
  - Title: Inter 700, 11pt, Midnight
  - Body: Inter 400, 9pt, Graphite
  - Background: Ash
- Bottom of page: Bridge statement — "Auto-LevelUp solves all four." in Inter
  700, 14pt, Midnight. No gradient strip. Just text with authority.

#### Page 3 — Platform Overview

**What changes:** Remove emoji from pillar cards. Remove apps-row chip cloud.
Simplify the stat rows.

**New approach:**

- Heading: "Two Platforms. One Student Profile." — h1 token, Midnight
- Two-column layout, equal width:
  - Left column: LvlUp Spaces card. Signal Blue 2pt top border. Icon: `learning`
    bespoke icon. Title, subtitle, 5 bullets, 3 key stats (15 types, 5 modes,
    24/7 tutor).
  - Right column: AutoGrade card. Verdigris 2pt top border. Icon: `grading`
    bespoke icon. Same structure. Key stats: 8 min, 4 rubrics, 5-step pipeline.
- Below both cards: A single connecting statement: "Both share a single student
  profile — learning insights inform exam preparation, and exam performance
  informs the learning path." — Inter 400, 10pt, Graphite, centered.

#### Pages 4–5 — LvlUp Spaces Deep Dive

**What changes:** Remove emoji from mode cards and question type cards. Replace
badge colors with restrained system. Simplify question type grid from 15
individual cards to a categorized table.

**Page 4 — Content & Modes:**

- Heading: "LvlUp Spaces — What Students Learn, How They Learn It" — h2,
  Midnight
- Question types presented as a clean 2-column table (not a grid of 15 cards):
  - Left column: Auto-Graded (9 types) — listed with type name, one-line
    description
  - Right column: AI-Graded (6 types) — listed similarly
  - Each column header: Signal Blue chip for Auto, Verdigris chip for AI
- Below: 5 Story Point Modes as a horizontal row of 5 equal cards. Each: bespoke
  icon, mode name (Inter 700), one-line description (Inter 400). No emoji.
  Active mode (Standard) has Signal Blue border.

**Page 5 — AI & Gamification:**

- Two feature blocks, stacked:
  - Block 1: AI Features (AI Tutor, AI Evaluator, Adaptive Engine) — 3 cards in
    a row. Bespoke icons (`ai`, `feedback`, `analytics`). Title + 2-line
    description each.
  - Block 2: Gamification — XP/Levels/Streaks/Badges described in a compact
    horizontal layout. Rarity tiers shown as 5 small chips (Common through
    Legendary) with no color variation beyond the label — all chips are Ash
    background with Graphite text. The tier name does the work, not color
    coding.

#### Pages 6–7 — AutoGrade Deep Dive

**Page 6 — The Pipeline:**

- Heading: "AutoGrade — From Scan to Feedback in 8 Minutes" — h2, Midnight
- 5-step pipeline as a vertical flow (better for print than horizontal):
  - Each step: Step number (Signal Blue circle), bespoke icon, title (Inter 700,
    11pt), 2-line description, time estimate
  - Steps connected by a vertical line (1pt, `#E5E7EB`)
- Below: Key stat callout — "40 students x 10 questions = 400 grading tasks
  processed simultaneously" — Inter 700, 12pt, Midnight, with a Verdigris
  underline

**Page 7 — Intelligence & Control:**

- 4 Rubric Modes as a 2x2 grid (Criteria, Dimension, Holistic, Hybrid). Each:
  bespoke icon, name, 2-line description. Verdigris accent.
- Feedback Anatomy: "What Every Student Gets" — a structured list of the 6
  feedback fields, presented as a simple numbered list with descriptions.
- Manual Override callout: "AI grades. Teachers decide." — boxed statement, 2pt
  Midnight border, centered text.

#### Page 8 — For Teachers

**What changes:** Remove emoji avatar. Remove gradient header. Apply universal
stakeholder template.

**New approach:**

- Header: 15mm Midnight bar. "FOR TEACHERS" overline, Signal Blue. `teacher`
  bespoke icon, white, 32px.
- Primary message: The teacher value proposition from CONTENT-SPEC, set in Inter
  400, 11pt, Graphite.
- 5 bullets from the 5-bullet version in CONTENT-SPEC.
- "A Day With Auto-LevelUp" timeline: 5 time entries (7 AM, 9 AM, 12 PM, 4 PM, 5
  PM) with one-line descriptions of how the platform fits into a teacher's day.
  Simple table layout, no emoji, no icons in timeline — just time and text.

#### Page 9 — For Students

- Same template as Page 8 but with `student` icon.
- Student value proposition + 5 bullets.
- Instead of timeline: "The Student Journey" — 5 stages (Open App → Choose Space
  → Learn → Get Feedback → Level Up), each with a one-line description.
  Presented as a numbered vertical list with step numbers in Signal Blue
  circles.

#### Page 10 — For Parents

- Same template. `notification` icon (parents care about alerts).
- Parent value proposition + 5 bullets.
- Alert types section: 4 alert categories (Score Drop, Inactivity, At-Risk,
  Milestone) shown as 4 compact cards. No color-coding per alert type — all use
  the same card style with a small label.

#### Page 11 — For School Admins

- Same template. `settings` icon.
- Admin value proposition + 5 bullets.
- Cost transparency section: A simple 3-item row showing "Per Exam | Per
  Submission | Per Month" cost tracking visibility.

#### Page 12 — Getting Started + CTA

**What changes:** Remove emoji from onboarding steps. Remove gradient. Simplify
to a powerful close.

**New approach:**

- Heading: "Getting Started Is Simple" — h2, Midnight
- 4 onboarding steps in a horizontal row: (1) Schedule a Demo → (2) Configure
  Your School → (3) Import Students → (4) Go Live. Each: step number in Signal
  Blue circle, bespoke icon, title, one-line description.
- Middle: Value summary — 4 key benefits in a single row (Time Saved, Students
  Seen, Parents Informed, Costs Controlled). Just text, no cards.
- Bottom third: Full-width Midnight background block.
  - "Book a Demo" — Inter 800, 24pt, white
  - `autolevelup.in/demo` — Inter 500, 14pt, Signal Blue
  - Contact details in `#94A3B8`

### 4.3 What's Removed Across All Pages

- All emoji (replaced with bespoke SVG icons)
- All multi-color gradient headers (replaced with flat Midnight or white)
- Rose/red problem signaling (replaced with Verdigris "we fix this" accent)
- Amber/violet/purple stakeholder color-coding (replaced with one consistent
  system)
- "Bridge" gradient strips between sections (replaced with typography and space)
- Decorative circles/blobs in backgrounds
- Pill/chip clouds

---

## 5. Pamphlet Redesign Plan

### 5.1 Format Decision

**Format:** A4, 2-page (front and back). NOT a DL fold — A4 gives us room to
breathe, matches the brochure format, and is standard for school distribution in
India.

**Grid:** 6-column (simplified from brochure's 12), 5mm gutter, 8pt baseline.

**Margins:** Top 12mm, Bottom 10mm, Left 10mm, Right 10mm. Bleed: 3mm.

### 5.2 Page 1 — Problem + Solution

**What changes from current:** Remove emoji from problem cards. Remove the
indigo bridge strip. Remove gradient from header. Tighten spacing — current
design has too many layers (header → problem → bridge → pillars → footer = 5
zones for one page).

**New approach — 3 zones only:**

**Zone 1 — Header (top 30%):**

- Background: Midnight flat
- Wordmark: "Auto-LevelUp" — Inter 800, 6mm, white, left-aligned
- Headline: "Every Student Deserves to Level Up." — Inter 800, 10mm, white.
  "Deserves" on its own line in Signal Blue.
- Subheadline: "AI-powered learning + intelligent exam grading — built for
  schools." — Inter 400, 3.5mm, `#94A3B8`
- No tagline chip. No decorative circles.

**Zone 2 — Problems (middle 25%):**

- Background: Ash
- Label: "THE CHALLENGE" — overline token, Graphite
- 4 problems in a 2x2 grid. Each:
  - Bespoke icon (24px, Verdigris)
  - Title: Inter 700, 3.5mm, Midnight
  - Description: Inter 400, 2.8mm, Graphite, max 2 lines
  - Left border: 2pt Verdigris
- No emoji. No rose color.

**Zone 3 — Two Pillars (bottom 45%):**

- Background: White
- Heading: "One Platform. Two Purpose-Built Products." — Inter 700, 5mm,
  Midnight, centered
- Two cards side by side:
  - LvlUp Spaces: Signal Blue 2pt top border. `learning` icon. Name, subtitle, 5
    compact bullets with check marks.
  - AutoGrade: Verdigris 2pt top border. `grading` icon. Same structure.
  - Cards have Ash background, 1pt `#E5E7EB` border, `radius-md`
- Footer bar: Midnight, 8mm height. "Auto-LevelUp" left, "Page 1 of 2" right.

### 5.3 Page 2 — Benefits + CTA

**What changes:** Remove emoji from stakeholder cards. Remove feature strip.
Simplify trust section. Make CTA dominant.

**New approach — 3 zones:**

**Zone 1 — Stats Bar (top 10%):**

- Background: Midnight
- 5 stats in a row: 15 Question Types | 8 Min Grading | 24/7 AI Tutor | 4 Rubric
  Modes | 5 At-Risk Signals
- Number: Inter 800, 7mm, white
- Label: Inter 500, 2.5mm, `#94A3B8`

**Zone 2 — Stakeholder Grid (middle 60%):**

- Heading: "One Platform. Every Stakeholder." — Inter 700, 5mm, Midnight,
  centered
- 2x2 grid of stakeholder cards (Teacher, Student, Parent, Admin):
  - Each card: Bespoke icon (from our set), stakeholder name (Inter 700, 3.8mm),
    3 bullets (from the 3-bullet versions in CONTENT-SPEC)
  - All cards same style — Signal Blue icon color, Ash background, 1pt border
  - No per-stakeholder color coding (no blue for teacher, green for student,
    amber for parent, purple for admin — that's the old chaos)

**Zone 3 — CTA (bottom 30%):**

- Background: Midnight
- "Ready to Transform Your School?" — Inter 800, 6mm, white
- "Book a demo and see Auto-LevelUp in action." — Inter 400, 3.5mm, `#94A3B8`
- CTA button: Signal Blue rectangle, "Request a Demo" white text, `radius-sm`
- URL: `autolevelup.in/demo` — Signal Blue, below button
- QR code placeholder: White square, 18mm, right-aligned
- Contact info in `#64748B`

---

## 6. Implementation Roadmap

### Phase 1 — Brand Foundation (Must complete first — everything else depends on this)

| #   | Deliverable                     | Output                                           | Blocks                      |
| --- | ------------------------------- | ------------------------------------------------ | --------------------------- |
| 1.1 | Brand System Document           | `docs/design/brand-system.md`                    | Everything                  |
| 1.2 | Tailwind Config / Design Tokens | CSS custom properties + Tailwind theme extension | Website, Brochure, Pamphlet |
| 1.3 | Icon Grid Template              | SVG template file with grid guides               | Icon Set                    |

### Phase 2 — Icon Set (Unblocked after Phase 1)

| #   | Deliverable               | Output                    | Blocks                      |
| --- | ------------------------- | ------------------------- | --------------------------- |
| 2.1 | Core 18 bespoke SVG icons | `docs/design/icons/*.svg` | Website, Brochure, Pamphlet |

### Phase 3 — Pamphlet (Fastest to complete — 2 pages, proves the system works)

| #   | Deliverable                | Output                                | Blocks                                |
| --- | -------------------------- | ------------------------------------- | ------------------------------------- |
| 3.1 | Pamphlet HTML (redesigned) | `docs/marketing/output/pamphlet.html` | Nothing (standalone proof-of-concept) |

### Phase 4 — Brochure (Longer, but reuses Phase 2 icons and Phase 1 tokens)

| #   | Deliverable                          | Output                                | Blocks  |
| --- | ------------------------------------ | ------------------------------------- | ------- |
| 4.1 | Brochure HTML (redesigned, 12 pages) | `docs/marketing/output/brochure.html` | Nothing |

### Phase 5 — Website Spec (Design document, not implementation)

| #   | Deliverable         | Output                        | Blocks                                 |
| --- | ------------------- | ----------------------------- | -------------------------------------- |
| 5.1 | Website Design Spec | `docs/design/website-spec.md` | Website implementation (separate team) |

### Execution Order

```
Phase 1.1 (brand-system.md)
    ↓
Phase 1.2 (tokens) + Phase 1.3 (icon grid)  [parallel]
    ↓
Phase 2.1 (18 icons)
    ↓
Phase 3.1 (pamphlet) + Phase 4.1 (brochure) + Phase 5.1 (website-spec)  [parallel]
```

Total deliverables: 5 files + 18 SVG icons.

---

## 7. Design Critique of Current State

For the record, here's what's wrong with the current assets so this plan's
decisions have clear rationale:

### Current Pamphlet Issues

1. **11+ colors in CSS variables** — no palette discipline
2. **Emoji as icons** (📚 📝 🔍 👨‍👩‍👧 🎯 📄 🤖 📊 🏆 📱 🔒 🏛️ 💰 🎓 🔗) — reads as
   amateur
3. **Multiple gradient backgrounds** (grad-1, grad-2, grad-3) — visual noise
4. **Rose/red used for problems** — aggressive, makes the pamphlet feel negative
   before the solution arrives
5. **Different colors per stakeholder** (blue teacher, green student, amber
   parent, purple admin) — no unity
6. **Indigo bridge strip** between sections — unnecessary layer, breaks reading
   flow
7. **Trust section uses emoji** (🏛️ 💰 🎓) — weakest part of the strongest
   message

### Current Brochure Issues

1. **Same palette chaos** as pamphlet, amplified across 12 pages
2. **Each page has a different gradient header color** — feels like 12 different
   brochures stitched together
3. **Emoji throughout** — question type cards, mode cards, gamification cards,
   pipeline steps, features
4. **Too many visual systems** — rarity chips, badge colors, mode card active
   states, alert type colors — each inventing its own rules
5. **Cover is over-designed** — logo box + brand text + eyebrow + headline +
   tagline + pill row + divider + footer = 8 visual layers on one page
6. **"Day in Life" timeline uses emoji** — undermines the credibility of the
   narrative

### What This Plan Fixes

- 5 colors instead of 11+
- 18 bespoke SVG icons instead of emoji
- 1 gradient (hero only) instead of 6+
- 1 stakeholder card style instead of 4 color-coded variants
- Consistent page template instead of per-page custom headers
- Typography does the hierarchy work, not color
- Every decision traceable to a token in the brand system

---

_End of Auto-LevelUp Design Redesign Plan v1.0_ _Prepared by Aria, Creative
Design Lead — March 2026_
