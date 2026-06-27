# V13 Cycle 4 Test Report: Marketing Website & Landing Pages

**Vertical**: V13 — Marketing Website & Landing Pages **Cycle**: 4 (Combined
Pass 2 — Refinement) **Status**: FAIL — 1 Critical Blocker **Date**: 2026-03-08
**Tester**: QA Agent (Deep Build Verification) **Build Tool**: Astro 5.x

---

## Executive Summary

Cycle 4 delivered significant scope: 7 new pages, hero mockup upgrade, carousel
auto-play, View Transitions, FAQ/Breadcrumb JSON-LD, Netlify Forms, ARIA
enhancements, and print stylesheet. The `astro build` succeeds with 10 pages and
0 errors. However, deep inspection of the **built CSS output** revealed a
**critical CSS integration bug**: `global.css` is never imported, so design
tokens (`:root` variables), component classes (`.btn-primary`,
`.scroll-reveal`), focus styles, and print styles are all **absent from the
production build**. The site would render with broken colors and unstyled
components at runtime.

> **Note**: A prior test report on this file verified source code only. This
> report verifies the **actual build output** (`dist/`) against the plan.

---

## Build Verification

| Check                       | Result | Notes                           |
| --------------------------- | ------ | ------------------------------- |
| `astro check`               | PASS   | 0 errors, 0 warnings, 4 hints   |
| `astro build`               | PASS   | 10 pages built, 0 errors, 1.87s |
| Pages generated             | PASS   | 10/10 expected pages            |
| Sitemap generated           | PASS   | `sitemap-0.xml` with 8 URLs     |
| `compressHTML: true`        | PASS   | Verified in astro.config.mjs    |
| `inlineStylesheets: 'auto'` | PASS   | Verified in astro.config.mjs    |
| `dist/` size                | PASS   | 384K total, 19 files            |

### Pages Built

1. `/` — index.html
2. `/pricing` — pricing/index.html
3. `/contact` — contact/index.html
4. `/privacy` — privacy/index.html
5. `/terms` — terms/index.html
6. `/compliance` — compliance/index.html
7. `/cookies` — cookies/index.html
8. `/blog` — blog/index.html
9. `/404` — 404.html
10. `/thank-you` — thank-you/index.html

---

## CRITICAL ISSUE

### C1: `global.css` Not Imported — Design Tokens & Component Classes Missing from Production Build

**Severity**: CRITICAL / BLOCKER **Location**: `website/src/styles/global.css` +
`website/src/layouts/Layout.astro`

**Description**: `global.css` contains
`@tailwind base; @tailwind components; @tailwind utilities;` plus all custom
CSS:

- `:root` block with 40+ CSS custom properties (`--primary`, `--background`,
  `--foreground`, etc.)
- Component classes (`.btn-primary`, `.btn-secondary`, `.btn-ghost`,
  `.scroll-reveal`)
- Global `:focus-visible` outline
- `prefers-reduced-motion` base rules
- `@media print` stylesheet

**However, `global.css` is never imported** — not in `Layout.astro`, not in any
page or component. The `@astrojs/tailwind` plugin (default
`applyBaseStyles: true`) auto-injects its own `@tailwind` directives, so
Tailwind utility classes are generated. But all **custom CSS from global.css is
excluded**.

**Verification**: Python substring search on built CSS
(`dist/_astro/blog.BkIUYYha.css`, 31,724 bytes):

| Token                               |       In Build?        |
| ----------------------------------- | :--------------------: |
| `:root` block                       | **NO** (0 occurrences) |
| `--primary` definition              |         **NO**         |
| `.btn-primary`                      |         **NO**         |
| `.btn-secondary`                    |         **NO**         |
| `.btn-ghost`                        |         **NO**         |
| `.scroll-reveal`                    |         **NO**         |
| `:focus-visible` (base)             |         **NO**         |
| `@media print`                      |         **NO**         |
| `hsl(var(--primary))` references    |     YES (83 uses)      |
| `hsl(var(--background))` references |          YES           |

**Runtime impact**:

- **Colors broken**: All `hsl(var(--x))` resolve to nothing — no theming
- **Buttons unstyled**: `.btn-primary` etc. have no definition
- **Scroll animations broken**: `.scroll-reveal` sets `opacity: 0` but class not
  defined, so elements may render without animation framework
- **Focus indicators missing**: No global `:focus-visible` fallback
- **Print styles missing**: `@media print` not applied
- **Contrast fix not applied**: `--muted-foreground: 44%` adjustment absent

**Fix** (2 lines):

1. `astro.config.mjs`: `tailwind()` → `tailwind({ applyBaseStyles: false })`
2. `Layout.astro` frontmatter: add `import '../styles/global.css';`

---

## SEO Verification — ALL PASS

### Meta Tags (verified in built HTML)

All 10 pages confirmed to have: unique `<title>`, `<meta name="description">`,
`<link rel="canonical">`, full OG tags (type, url, title, description, image,
site_name), Twitter Card tags (summary_large_image).

### JSON-LD Structured Data

| Page          | Schema Type                                           | Status |
| ------------- | ----------------------------------------------------- | :----: |
| `/`           | SoftwareApplication + FAQPage (`@graph`, 8 Q&A pairs) |  PASS  |
| `/pricing`    | WebPage + ItemList (4 Offer items)                    |  PASS  |
| `/contact`    | ContactPage + Organization                            |  PASS  |
| `/privacy`    | WebPage                                               |  PASS  |
| `/terms`      | WebPage                                               |  PASS  |
| `/compliance` | WebPage                                               |  PASS  |
| `/cookies`    | WebPage                                               |  PASS  |
| `/blog`       | Blog                                                  |  PASS  |
| `/thank-you`  | WebPage                                               |  PASS  |

### Breadcrumb JSON-LD (verified in built HTML)

| Page           | Path                       | Status |
| -------------- | -------------------------- | :----: |
| `/pricing`     | Home > Pricing             |  PASS  |
| `/contact`     | Home > Contact             |  PASS  |
| `/privacy`     | Home > Privacy Policy      |  PASS  |
| `/terms`       | Home > Terms of Service    |  PASS  |
| `/compliance`  | Home > FERPA Compliance    |  PASS  |
| `/cookies`     | Home > Cookie Policy       |  PASS  |
| `/blog`        | Home > Blog                |  PASS  |
| `/thank-you`   | Home > Contact > Thank You |  PASS  |
| `/` (homepage) | None — expected            |  PASS  |
| `/404`         | None — expected            |  PASS  |

### Sitemap

| Check                                                                               | Status |
| ----------------------------------------------------------------------------------- | :----: |
| `sitemap-index.xml` generated                                                       |  PASS  |
| 8 URLs in `sitemap-0.xml`                                                           |  PASS  |
| `/thank-you` filtered out                                                           |  PASS  |
| Priorities: Home 1.0, Pricing 0.9, Contact 0.8, Blog 0.7, Compliance 0.6, Legal 0.4 |  PASS  |
| `robots.txt` with sitemap reference                                                 |  PASS  |

### Assets

| Asset                          | Size    |                   Status                    |
| ------------------------------ | ------- | :-----------------------------------------: |
| `og-default.png`               | 3,632 B | WARN — Too small for 1200x630 branded image |
| `apple-touch-icon.png`         | 495 B   |      WARN — Too small for 180x180 icon      |
| `favicon-32x32.png`            | 99 B    |       WARN — Too small for 32x32 icon       |
| `favicon.svg`                  | 322 B   |                    PASS                     |
| Layout `<head>` references all | —       |                    PASS                     |

### Font Loading — All PASS

- preconnect, async preload pattern, `display=swap`, noscript fallback

---

## Accessibility Verification

### Skip-to-Content — PASS (all 10 pages)

Verified in built HTML: skip link + `id="main-content"` on all pages.

### Heading Hierarchy (verified in built HTML)

| Page          | h1  | h2  | h3  |           Status           |
| ------------- | :-: | :-: | :-: | :------------------------: |
| `/`           |  1  |  5  | 12  |            PASS            |
| `/pricing`    |  1  |  2  |  8  |            PASS            |
| `/contact`    |  1  |  1  |  7  |            PASS            |
| `/privacy`    |  1  |  8  |  4  |            PASS            |
| `/terms`      |  1  |  8  |  4  |            PASS            |
| `/compliance` |  1  |  6  |  7  |            PASS            |
| `/cookies`    |  1  |  7  |  4  |            PASS            |
| `/blog`       |  1  |  4  |  4  |            PASS            |
| `/404`        |  1  |  0  |  4  | WARN — h1→h3 skip (footer) |
| `/thank-you`  |  1  |  0  |  4  | WARN — h1→h3 skip (footer) |

### ARIA Attributes (verified in built HTML)

Homepage: 41 `aria-label`, 15 `aria-expanded`, 9 `aria-controls`, 76
`aria-hidden`, 27 `role`

| Component        | Key ARIA                                                                 | Status |
| ---------------- | ------------------------------------------------------------------------ | :----: |
| Nav              | `aria-label`, `aria-current="page"`, `aria-expanded`, `aria-controls`    |  PASS  |
| Testimonials     | `role="region"`, `aria-roledescription="carousel"`, `aria-live="polite"` |  PASS  |
| Testimonial dots | `role="tablist"`, per-dot `role="tab"` + `aria-selected`                 |  PASS  |
| FAQ              | `aria-expanded`, `aria-controls`, `role="region"` + `aria-labelledby`    |  PASS  |
| Features         | `role="group"` + `aria-label` per card                                   |  PASS  |
| Pricing          | `role="group"` + `aria-label` per tier                                   |  PASS  |
| Contact form     | `aria-describedby`, `aria-invalid`, `role="alert"`                       |  PASS  |
| Decorative SVGs  | `aria-hidden="true"`                                                     |  PASS  |

### Keyboard Navigation — PASS

- Escape closes mobile menu (returns focus)
- FAQ toggles via `<button>` (Enter/Space)
- Scripts re-init on `astro:after-swap`

### `prefers-reduced-motion`

- Component `<style>` blocks: Hero, 404, Thank-you — PASS
- Global CSS base rule — DEFINED in source, **not in build** (see C1)

### Focus Styles

- Source:
  `:focus-visible { outline: 2px solid hsl(var(--primary)); outline-offset: 2px }`
  — DEFINED
- **Build output**: NOT present (see C1)

### Color Contrast

- Source: `--muted-foreground` adjusted to 44% lightness — DEFINED
- **Build output**: `:root` not present, adjustment NOT applied (see C1)

---

## Component Verification — Source Code Review

### Hero (`Hero.astro`) — PASS

High-fidelity dashboard mockup (browser chrome, sidebar, 4 metric cards, bar
chart, progress ring 87%), floating animation, gradient text, responsive,
`prefers-reduced-motion`.

### Testimonials (`Testimonials.astro`) — PASS

6 testimonials, 5s auto-play, wraps, pauses on hover/focus,
`prefers-reduced-motion`, dot indicators, full ARIA carousel.

### FAQ (`FAQ.astro`) — PASS

8 items, accordion, `aria-expanded`/`aria-controls`, `role="region"` +
`aria-labelledby`.

### Contact Form (`contact.astro`) — PASS

Netlify Forms, honeypot, validation, loading/error/success states, ARIA
integration, graceful non-Netlify fallback.

### Legal Pages — PASS

Privacy (8 sections + COPPA), Terms (8 sections), Compliance (FERPA/COPPA/SOC2
badges), Cookies (type table). All with JSON-LD + breadcrumbs.

### Blog — PASS

Placeholder with 3 article cards, newsletter signup, JSON-LD Blog schema.

### 404 — PASS

CSS animation, `prefers-reduced-motion`, CTAs, popular page links.

### Thank You — PASS

Animated checkmark, 24-hour message, CTAs, `prefers-reduced-motion`.

### View Transitions — PASS

`ClientRouter` (Astro 5.x), `transition:persist` on Nav, 5 components re-init on
`astro:after-swap`.

### Button Micro-Interactions — DEFINED in source, **NOT in build** (see C1)

### Print Stylesheet — DEFINED in source, **NOT in build** (see C1)

---

## Minor Issues

| #   | Issue                                                         | Severity |
| --- | ------------------------------------------------------------- | -------- |
| M1  | OG image likely placeholder (3.6KB for 1200x630)              | Low      |
| M2  | Favicon PNGs likely placeholder (99B, 495B)                   | Low      |
| M3  | Social media links are `#` placeholder                        | Low      |
| M4  | "Learn more" → non-existent anchors (`/#schools-detail`)      | Low      |
| M5  | 404/Thank-You skip h2 level (footer h3s)                      | Low      |
| M6  | Blog newsletter "Notify Me" has no backend                    | Low      |
| M7  | `astro check` 4 hints (onload/rel vars, type attr on scripts) | Info     |

---

## Test Summary

| Category                           |  Pass   | Fail  | Warn  |
| ---------------------------------- | :-----: | :---: | :---: |
| Build (7 checks)                   |    7    |   0   |   0   |
| SEO meta tags (10 pages)           |   10    |   0   |   0   |
| JSON-LD schemas (9 pages)          |    9    |   0   |   0   |
| Breadcrumbs (10 pages)             |   10    |   0   |   0   |
| Sitemap & robots (5 checks)        |    5    |   0   |   0   |
| Assets (4 items)                   |    1    |   0   |   3   |
| Font loading (4 checks)            |    4    |   0   |   0   |
| Skip-to-content (10 pages)         |   10    |   0   |   0   |
| Heading hierarchy (10 pages)       |    8    |   0   |   2   |
| ARIA (8 components)                |    8    |   0   |   0   |
| Keyboard (3 checks)                |    3    |   0   |   0   |
| **CSS integration (build output)** |  **0**  | **1** | **0** |
| Components (14 checks)             |   14    |   0   |   0   |
| View Transitions (5 checks)        |    5    |   0   |   0   |
| Contact form (7 checks)            |    7    |   0   |   0   |
| **TOTAL (110 checks)**             | **101** | **1** | **5** |

---

## Verdict: FAIL

### Blocker

**C1 (global.css not imported)** must be resolved. Without it, the production
site ships with broken colors, unstyled buttons, no scroll animations, no focus
indicators, and no print styles. The fix is 2 lines.

### Recommended Patch

```diff
# astro.config.mjs
- tailwind(),
+ tailwind({ applyBaseStyles: false }),

# Layout.astro (frontmatter)
+ import '../styles/global.css';
```

After patching: rebuild and verify `:root` variables, `.btn-primary`,
`.scroll-reveal`, `:focus-visible`, and `@media print` all appear in
`dist/_astro/*.css`.

### Deferred to Cycle 5

- Replace placeholder OG image and favicon PNGs with branded assets
- Add real social media links
- Add "Learn more" anchor targets
- Blog newsletter backend
- Monthly/annual pricing toggle
- Cookie consent banner
- Lighthouse CI automation
- E2E tests for contact form
